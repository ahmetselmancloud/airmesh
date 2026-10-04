package server

import (
	"archive/zip"
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/skip2/go-qrcode"
)

type FileItem struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
	IsDir   bool   `json:"isDir"`
}

type ListFilesResponse struct {
	CurrentDir string     `json:"currentDir"`
	Files      []FileItem `json:"files"`
}

type DeviceInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	IP          string `json:"ip"`
	UserAgent   string `json:"userAgent"`
	ConnectedAt string `json:"connectedAt"`
}

type Server struct {
	SharedDir string
	WebFS     fs.FS
	hub       *WSHub
	sec       *SecurityManager
}

func NewServer(sharedDir string, webFS fs.FS) *Server {
	return &Server{
		SharedDir: sharedDir,
		WebFS:     webFS,
		hub:       newWSHub(),
		sec:       NewSecurityManager(),
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	// Captive portal probes redirect
	captiveHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusFound)
	})
	mux.Handle("/generate_204", captiveHandler)
	mux.Handle("/gen_204", captiveHandler)
	mux.Handle("/hotspot-detect.html", captiveHandler)
	mux.Handle("/ncsi.txt", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("Microsoft NCSI"))
	}))
	mux.Handle("/connecttest.txt", captiveHandler)

	// API Endpoints
	mux.HandleFunc("/api/files", s.handleListFiles)
	mux.HandleFunc("/api/download", s.handleDownload)
	mux.HandleFunc("/api/stream", s.handleStream)
	mux.HandleFunc("/api/upload", s.handleUpload)
	mux.HandleFunc("/api/zip", s.handleZipStream)
	mux.HandleFunc("/api/qr", s.handleQR)
	mux.HandleFunc("/api/radar", s.handleRadar)
	mux.HandleFunc("/api/hotspot", s.handleHotspot)
	mux.HandleFunc("/api/hotspot/qr", s.handleHotspotQR)
	mux.HandleFunc("/api/delete", s.handleDelete)
	mux.HandleFunc("/api/mkdir", s.handleMkdir)
	mux.HandleFunc("/api/rename", s.handleRename)
	mux.HandleFunc("/api/storage", s.handleStorage)
	mux.HandleFunc("/api/openfolder", s.handleOpenFolder)
	mux.HandleFunc("/api/speedtest/ping", s.handleSpeedtestPing)
	mux.HandleFunc("/api/speedtest/download", s.handleSpeedtestDownload)
	mux.HandleFunc("/api/speedtest/upload", s.handleSpeedtestUpload)
	mux.HandleFunc("/api/auth/status", s.handleAuthStatus)
	mux.HandleFunc("/api/auth/verify", s.handleAuthVerify)
	mux.HandleFunc("/api/auth/config", s.handleAuthConfig)
	mux.HandleFunc("/ws", s.handleWebSocket)

	// Static web assets from embedded filesystem
	fileServer := http.FileServer(http.FS(s.WebFS))
	mux.Handle("/", fileServer)

	return s.withCORS(s.withSecurity(mux))
}

func (s *Server) withSecurity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Exclude captive portal probes from strict Host check because devices send captive.apple.com etc.
		isCaptiveProbe := path == "/generate_204" || path == "/gen_204" ||
			path == "/hotspot-detect.html" || path == "/ncsi.txt" || path == "/connecttest.txt"

		if !isCaptiveProbe {
			// DNS Rebinding protection: validate Host header
			if !s.sec.IsValidHost(r.Host) {
				http.Error(w, "Geçersiz Host başlığı (DNS Rebinding engellendi)", http.StatusBadRequest)
				return
			}
		}

		// Exclude public assets & public auth endpoints
		if path == "/" ||
			path == "/index.html" ||
			path == "/style.css" ||
			path == "/app.js" ||
			path == "/manifest.json" ||
			path == "/sw.js" ||
			path == "/favicon.ico" ||
			isCaptiveProbe ||
			path == "/api/auth/status" ||
			path == "/api/auth/verify" {
			next.ServeHTTP(w, r)
			return
		}

		// Enforce PIN authentication if enabled
		if !s.sec.CheckAuth(r) {
			if strings.HasPrefix(path, "/api/") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"auth_required","message":"PIN kodu gereklidir."}`))
				return
			}
			if path == "/ws" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if s.sec.IsAllowedOrigin(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-AirMesh-Token")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			} else {
				// Reject preflight for unauthorized cross-origin requests
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusForbidden)
					return
				}
			}
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleListFiles(w http.ResponseWriter, r *http.Request) {
	dirParam := r.URL.Query().Get("dir")
	targetDir, err := s.getSafeRelPath(dirParam)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		http.Error(w, fmt.Sprintf("Klasör okunamadı: %v", err), http.StatusInternalServerError)
		return
	}

	var files []FileItem
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, FileItem{
			Name:    entry.Name(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format("02.01.2006 15:04"),
			IsDir:   entry.IsDir(),
		})
	}

	cleanRel := filepath.ToSlash(filepath.Clean(filepath.FromSlash(dirParam)))
	if cleanRel == "." || cleanRel == "/" || cleanRel == "\\" {
		cleanRel = ""
	}

	resp := ListFilesResponse{
		CurrentDir: cleanRel,
		Files:      files,
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(resp)
}

func (s *Server) getSafeRelPath(relPath string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash(relPath))

	absShared, err := filepath.Abs(s.SharedDir)
	if err != nil {
		absShared = s.SharedDir
	}
	realShared, err := filepath.EvalSymlinks(absShared)
	if err != nil {
		realShared = absShared
	}

	if clean == "." || clean == "/" || clean == "\\" || clean == "" {
		return realShared, nil
	}

	if strings.HasPrefix(clean, "..") || strings.Contains(clean, "/../") || strings.Contains(clean, "\\..\\") {
		return "", errors.New("geçersiz yol (path traversal engellendi)")
	}

	fullPath := filepath.Join(realShared, clean)

	// If file or target directory exists, resolve symlinks
	targetPath := fullPath
	if fi, err := os.Lstat(fullPath); err == nil {
		if fi.Mode()&os.ModeSymlink != 0 {
			resolved, err := filepath.EvalSymlinks(fullPath)
			if err != nil {
				return "", errors.New("sembolik link çözülemedi")
			}
			targetPath = resolved
		}
	} else {
		// Target doesn't exist yet (e.g. upload or mkdir), evaluate parent dir
		parentDir := filepath.Dir(fullPath)
		if realParent, err := filepath.EvalSymlinks(parentDir); err == nil {
			targetPath = filepath.Join(realParent, filepath.Base(fullPath))
		}
	}

	rel, err := filepath.Rel(realShared, targetPath)
	if err != nil || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", errors.New("yetkisiz dizin erişimi engellendi (symlink veya path escape)")
	}

	return targetPath, nil
}

func (s *Server) getSafeFilePath(fileName string) (string, error) {
	return s.getSafeRelPath(fileName)
}

func (s *Server) handleMkdir(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Yalnızca POST desteklenir", http.StatusMethodNotAllowed)
		return
	}

	if !s.sec.IsAdmin(r) && s.sec.ReadOnly {
		http.Error(w, "Oda salt-okunur modundadır. Klasör oluşturulamaz.", http.StatusForbidden)
		return
	}

	dirParam := r.URL.Query().Get("dir")
	folderName := strings.TrimSpace(r.URL.Query().Get("name"))
	if folderName == "" {
		http.Error(w, "Klasör adı belirtilmedi", http.StatusBadRequest)
		return
	}

	cleanFolderName := filepath.Base(filepath.Clean(folderName))
	relTarget := filepath.Join(dirParam, cleanFolderName)
	targetPath, err := s.getSafeRelPath(relTarget)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := os.MkdirAll(targetPath, 0755); err != nil {
		http.Error(w, fmt.Sprintf("Klasör oluşturulamadı: %v", err), http.StatusInternalServerError)
		return
	}

	s.hub.broadcast([]byte(`{"type":"file_list_updated"}`))
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"success","message":"Klasör oluşturuldu"}`))
}

func (s *Server) handleRename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Yalnızca POST desteklenir", http.StatusMethodNotAllowed)
		return
	}

	if !s.sec.IsAdmin(r) && s.sec.ReadOnly {
		http.Error(w, "Oda salt-okunur modundadır. İsim değiştirilemez.", http.StatusForbidden)
		return
	}

	dirParam := r.URL.Query().Get("dir")
	oldName := strings.TrimSpace(r.URL.Query().Get("old"))
	newName := strings.TrimSpace(r.URL.Query().Get("new"))

	if oldName == "" || newName == "" {
		http.Error(w, "Eski veya yeni dosya adı belirtilmedi", http.StatusBadRequest)
		return
	}

	oldRel := filepath.Join(dirParam, oldName)
	oldPath, err := s.getSafeRelPath(oldRel)
	if err != nil {
		http.Error(w, "Geçersiz eski dosya yolu: "+err.Error(), http.StatusBadRequest)
		return
	}

	newRel := filepath.Join(dirParam, newName)
	newPath, err := s.getSafeRelPath(newRel)
	if err != nil {
		http.Error(w, "Geçersiz yeni dosya yolu: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Ensure destination directory exists (useful if moving into a folder)
	destDir := filepath.Dir(newPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		http.Error(w, "Hedef klasör hazırlanamadı: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		http.Error(w, "İsim değiştirilemedi: "+err.Error(), http.StatusInternalServerError)
		return
	}

	s.hub.broadcast([]byte(`{"type":"file_list_updated"}`))
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"success","message":"İsim başarıyla değiştirildi"}`))
}

func (s *Server) handleStorage(w http.ResponseWriter, r *http.Request) {
	info, err := getDiskStorage(s.SharedDir)
	if err != nil {
		http.Error(w, "Disk bilgisi alınamadı: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(info)
}

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	fileName := r.URL.Query().Get("file")
	dirParam := r.URL.Query().Get("dir")
	if fileName == "" {
		http.Error(w, "Dosya adı belirtilmedi", http.StatusBadRequest)
		return
	}

	relPath := filepath.Join(dirParam, fileName)
	fullPath, err := s.getSafeRelPath(relPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, err := os.Open(fullPath)
	if err != nil {
		http.Error(w, "Dosya bulunamadı", http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "Dosya bilgisi alınamadı", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", stat.Name()))
	w.Header().Set("Accept-Ranges", "bytes")
	http.ServeContent(w, r, stat.Name(), stat.ModTime(), file)
}

func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	fileName := r.URL.Query().Get("file")
	dirParam := r.URL.Query().Get("dir")
	if fileName == "" {
		http.Error(w, "Dosya adı belirtilmedi", http.StatusBadRequest)
		return
	}

	relPath := filepath.Join(dirParam, fileName)
	fullPath, err := s.getSafeRelPath(relPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, err := os.Open(fullPath)
	if err != nil {
		http.Error(w, "Dosya bulunamadı", http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "Dosya bilgisi alınamadı", http.StatusInternalServerError)
		return
	}

	contentType := mime.TypeByExtension(filepath.Ext(stat.Name()))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Accept-Ranges", "bytes")
	http.ServeContent(w, r, stat.Name(), stat.ModTime(), file)
}

// resolveUniqueFilePath checks if target exists and appends (1), (2) to prevent accidental data loss
func resolveUniqueFilePath(fullPath string) string {
	if _, err := os.Stat(fullPath); errors.Is(err, os.ErrNotExist) {
		return fullPath
	}

	dir := filepath.Dir(fullPath)
	base := filepath.Base(fullPath)
	ext := filepath.Ext(base)
	nameWithoutExt := strings.TrimSuffix(base, ext)

	for i := 1; i < 10000; i++ {
		candidate := filepath.Join(dir, fmt.Sprintf("%s (%d)%s", nameWithoutExt, i, ext))
		if _, err := os.Stat(candidate); errors.Is(err, os.ErrNotExist) {
			return candidate
		}
	}
	return filepath.Join(dir, fmt.Sprintf("%s_%d%s", nameWithoutExt, time.Now().UnixNano(), ext))
}

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Yalnızca POST desteklenir", http.StatusMethodNotAllowed)
		return
	}

	if !s.sec.IsAdmin(r) && s.sec.ReadOnly {
		http.Error(w, "Oda salt-okunur (read-only) modundadır. Dosya yüklenemez.", http.StatusForbidden)
		return
	}

	dirParam := r.URL.Query().Get("dir")
	fileName := r.URL.Query().Get("name")
	if fileName == "" {
		// Try multipart header
		err := r.ParseMultipartForm(32 << 20) // 32MB in RAM
		if err == nil && r.MultipartForm != nil {
			defer r.MultipartForm.RemoveAll() // Clean up temporary multipart files
			if len(r.MultipartForm.File) > 0 {
				for _, headers := range r.MultipartForm.File {
					for _, h := range headers {
						src, err := h.Open()
						if err != nil {
							continue
						}
						relPath := filepath.Join(dirParam, h.Filename)
						targetPath, err := s.getSafeRelPath(relPath)
						if err != nil {
							_ = src.Close()
							continue
						}
						_ = os.MkdirAll(filepath.Dir(targetPath), 0755)

						finalPath := resolveUniqueFilePath(targetPath)
						tmpPath := finalPath + fmt.Sprintf(".tmp_%d", time.Now().UnixNano())
						dst, err := os.Create(tmpPath)
						if err == nil {
							writer := bufio.NewWriterSize(dst, 4*1024*1024)
							if _, err := io.Copy(writer, src); err == nil {
								_ = writer.Flush()
								_ = dst.Close()
								_ = os.Rename(tmpPath, finalPath)
							} else {
								_ = dst.Close()
								_ = os.Remove(tmpPath)
							}
						}
						_ = src.Close()
					}
				}
				s.hub.broadcast([]byte(`{"type":"file_list_updated"}`))
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		http.Error(w, "Dosya adı belirtilmedi", http.StatusBadRequest)
		return
	}

	relPath := filepath.Join(dirParam, fileName)
	fullPath, err := s.getSafeRelPath(relPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	_ = os.MkdirAll(filepath.Dir(fullPath), 0755)

	finalPath := resolveUniqueFilePath(fullPath)
	savedFileName := filepath.Base(finalPath)

	uploader := r.URL.Query().Get("uploader")
	if uploader == "" {
		uploader = "Bir Cihaz"
	}

	// Atomic writing: write to temporary file first, clean up on failure
	tmpPath := finalPath + fmt.Sprintf(".tmp_%d", time.Now().UnixNano())
	outFile, err := os.Create(tmpPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Dosya oluşturulamadı: %v", err), http.StatusInternalServerError)
		return
	}

	bufWriter := bufio.NewWriterSize(outFile, 4*1024*1024) // 4MB buffer
	_, err = io.Copy(bufWriter, r.Body)
	if err != nil {
		_ = outFile.Close()
		_ = os.Remove(tmpPath) // Remove orphan partial file
		http.Error(w, fmt.Sprintf("Yazma hatası: %v", err), http.StatusInternalServerError)
		return
	}
	_ = bufWriter.Flush()
	_ = outFile.Close()

	if err := os.Rename(tmpPath, finalPath); err != nil {
		_ = os.Remove(tmpPath)
		http.Error(w, fmt.Sprintf("Dosya taşınamadı: %v", err), http.StatusInternalServerError)
		return
	}

	// Broadcast upload notification and list refresh to all clients
	toastPayload, _ := json.Marshal(map[string]interface{}{
		"type":     "file_uploaded",
		"fileName": savedFileName,
		"uploader": uploader,
	})
	s.hub.broadcast(toastPayload)
	s.hub.broadcast([]byte(`{"type":"file_list_updated"}`))

	// Trigger native Windows Toast Notification
	sendWindowsNotification("AirMesh - Yeni Dosya", fmt.Sprintf("%s (%s tarafından)", savedFileName, uploader))

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

// On-the-fly streaming zip using zip.Store (zero CPU compression overhead for maximum transfer speed)
func (s *Server) handleZipStream(w http.ResponseWriter, r *http.Request) {
	dirParam := r.URL.Query().Get("dir")
	targetDir, err := s.getSafeRelPath(dirParam)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	filesQuery := r.URL.Query().Get("files")
	var targetFiles []string
	archiveName := "airmesh_tum_dosyalar.zip"

	if filesQuery != "" {
		archiveName = "airmesh_secilen_dosyalar.zip"
		parts := strings.Split(filesQuery, ",")
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				targetFiles = append(targetFiles, trimmed)
			}
		}
	} else {
		entries, err := os.ReadDir(targetDir)
		if err != nil {
			http.Error(w, "Klasör okunamadı", http.StatusInternalServerError)
			return
		}
		for _, e := range entries {
			targetFiles = append(targetFiles, e.Name())
		}
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", archiveName))

	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	for _, fileName := range targetFiles {
		relPath := filepath.Join(dirParam, fileName)
		filePath, err := s.getSafeRelPath(relPath)
		if err != nil {
			continue
		}
		s.addFileOrDirToZip(zipWriter, filePath, fileName)
	}
}

func (s *Server) addFileOrDirToZip(zw *zip.Writer, absPath, relName string) {
	info, err := os.Stat(absPath)
	if err != nil {
		return
	}
	if info.IsDir() {
		_ = filepath.Walk(absPath, func(path string, fi os.FileInfo, err error) error {
			if err != nil || fi.IsDir() {
				return nil
			}
			subRel, err := filepath.Rel(absPath, path)
			if err != nil {
				return nil
			}
			zipEntryName := filepath.ToSlash(filepath.Join(relName, subRel))
			f, err := os.Open(path)
			if err != nil {
				return nil
			}
			defer f.Close()

			header, err := zip.FileInfoHeader(fi)
			if err != nil {
				return nil
			}
			header.Name = zipEntryName
			header.Method = zip.Store // Zero CPU, raw disk/network throughput!
			w, err := zw.CreateHeader(header)
			if err == nil {
				_, _ = io.Copy(w, f)
			}
			return nil
		})
	} else {
		f, err := os.Open(absPath)
		if err != nil {
			return
		}
		defer f.Close()

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return
		}
		header.Name = filepath.ToSlash(relName)
		header.Method = zip.Store // Zero CPU, raw disk/network throughput!
		w, err := zw.CreateHeader(header)
		if err == nil {
			_, _ = io.Copy(w, f)
		}
	}
}

// Generates dynamic QR code PNG for the provided URL/text
func (s *Server) handleQR(w http.ResponseWriter, r *http.Request) {
	text := r.URL.Query().Get("text")
	if text == "" {
		text = "http://" + r.Host
	}
	png, err := qrcode.Encode(text, qrcode.Medium, 256)
	if err != nil {
		http.Error(w, "QR üretilemedi", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(png)
}

func (s *Server) handleRadar(w http.ResponseWriter, r *http.Request) {
	devices := s.hub.getConnectedDevices()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(devices)
}

func (s *Server) handleHotspot(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		// Only host admin can toggle hotspot
		if !s.sec.IsAdmin(r) {
			http.Error(w, "Yalnızca Host bilgisayar Hotspot açıp kapatabilir", http.StatusForbidden)
			return
		}

		action := r.URL.Query().Get("action")
		if action == "start" {
			_ = ToggleHotspot(true)
		} else if action == "stop" {
			_ = ToggleHotspot(false)
		}
	}

	cfg, err := GetHotspotConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(cfg)
}

func (s *Server) handleHotspotQR(w http.ResponseWriter, r *http.Request) {
	cfg, err := GetHotspotConfig()
	if err != nil || cfg.SSID == "" {
		http.Error(w, "Hotspot bilgisi alınamadı", http.StatusInternalServerError)
		return
	}

	wifiQR := GetWifiQRContent(cfg.SSID, cfg.Passphrase)
	png, err := qrcode.Encode(wifiQR, qrcode.Medium, 256)
	if err != nil {
		http.Error(w, "Wi-Fi QR oluşturulamadı", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(png)
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Yalnızca POST desteklenir", http.StatusMethodNotAllowed)
		return
	}

	if !s.sec.IsAdmin(r) && !s.sec.AllowDelete {
		http.Error(w, "Dosya silme yetkiniz bulunmamaktadır.", http.StatusForbidden)
		return
	}

	dirParam := r.URL.Query().Get("dir")
	fileParam := r.URL.Query().Get("file")
	if fileParam == "" {
		fileParam = r.URL.Query().Get("files")
	}
	if fileParam == "" {
		http.Error(w, "Dosya adı belirtilmedi", http.StatusBadRequest)
		return
	}

	targets := strings.Split(fileParam, ",")
	for _, fn := range targets {
		fn = strings.TrimSpace(fn)
		if fn == "" {
			continue
		}
		relPath := filepath.Join(dirParam, fn)
		fullPath, err := s.getSafeRelPath(relPath)
		if err == nil {
			_ = os.RemoveAll(fullPath)
		}
	}

	s.hub.broadcast([]byte(`{"type":"file_list_updated"}`))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"deleted"}`))
}

func (s *Server) handleSpeedtestPing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	_, _ = w.Write([]byte("pong"))
}

func (s *Server) handleSpeedtestDownload(w http.ResponseWriter, r *http.Request) {
	sizeMB := 30
	if sStr := r.URL.Query().Get("size"); sStr != "" {
		if val, err := strconv.Atoi(sStr); err == nil && val > 0 && val <= 200 {
			sizeMB = val
		}
	}
	totalBytes := int64(sizeMB) * 1024 * 1024
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(totalBytes, 10))

	chunk := make([]byte, 64*1024) // 64KB dummy buffer
	var written int64
	for written < totalBytes {
		toWrite := int64(len(chunk))
		if totalBytes-written < toWrite {
			toWrite = totalBytes - written
		}
		n, err := w.Write(chunk[:toWrite])
		if err != nil {
			return
		}
		written += int64(n)
	}
}

func (s *Server) handleSpeedtestUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Yalnızca POST desteklenir", http.StatusMethodNotAllowed)
		return
	}
	start := time.Now()
	written, err := io.Copy(io.Discard, r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	elapsed := time.Since(start).Seconds()
	if elapsed <= 0 {
		elapsed = 0.001
	}
	speedMBs := (float64(written) / (1024 * 1024)) / elapsed

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"bytes":    written,
		"seconds":  elapsed,
		"speedMBs": speedMBs,
	})
}

// Pure Go RFC6455 WebSocket Implementation
type WSClient struct {
	conn        net.Conn
	hub         *WSHub
	id          string
	name        string
	ip          string
	userAgent   string
	connectedAt time.Time
}

type WSHub struct {
	mu          sync.Mutex
	clients     map[*WSClient]bool
	lastSyncMsg []byte
	emptyTimer  *time.Timer
}

func newWSHub() *WSHub {
	return &WSHub{
		clients: make(map[*WSClient]bool),
	}
}

func (h *WSHub) getConnectedDevices() []DeviceInfo {
	h.mu.Lock()
	defer h.mu.Unlock()

	var list []DeviceInfo
	for c := range h.clients {
		list = append(list, DeviceInfo{
			ID:          c.id,
			Name:        c.name,
			IP:          c.ip,
			UserAgent:   c.userAgent,
			ConnectedAt: c.connectedAt.Format("15:04:05"),
		})
	}
	return list
}

func (h *WSHub) register(c *WSClient) {
	h.mu.Lock()
	h.clients[c] = true
	count := len(h.clients)
	lastSync := h.lastSyncMsg
	if h.emptyTimer != nil {
		h.emptyTimer.Stop()
		h.emptyTimer = nil
	}
	h.mu.Unlock()

	h.broadcastDeviceList()
	if len(lastSync) > 0 {
		frame := encodeWSTextFrame(lastSync)
		_ = c.conn.SetWriteDeadline(time.Now().Add(3 * time.Second))
		_, _ = c.conn.Write(frame)
	}
	_ = count
}

func (h *WSHub) unregister(c *WSClient) {
	h.mu.Lock()
	delete(h.clients, c)
	count := len(h.clients)
	if count == 0 {
		if h.emptyTimer != nil {
			h.emptyTimer.Stop()
		}
		h.emptyTimer = time.AfterFunc(5*time.Minute, func() {
			fmt.Println("\n💤 [Akıllı Güç Tasarrufu] 5 dakikadır bağlı alıcı cihaz bulunamadı. Hotspot kapatılıyor...")
			if runtime.GOOS == "windows" {
				_ = ToggleHotspot(false)
			}
		})
	}
	h.mu.Unlock()

	h.broadcastDeviceList()
}

func (h *WSHub) broadcastDeviceList() {
	devices := h.getConnectedDevices()
	payload, _ := json.Marshal(map[string]interface{}{
		"type":    "device_list_updated",
		"devices": devices,
		"count":   len(devices),
	})
	h.broadcast(payload)
}

func (h *WSHub) broadcast(msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	frame := encodeWSTextFrame(msg)
	var deadClients []*WSClient
	for client := range h.clients {
		// Set short write deadline so slow or hung clients never block the server broadcast
		_ = client.conn.SetWriteDeadline(time.Now().Add(3 * time.Second))
		if _, err := client.conn.Write(frame); err != nil {
			deadClients = append(deadClients, client)
		}
	}

	for _, dc := range deadClients {
		delete(h.clients, dc)
		_ = dc.conn.Close()
	}
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		http.Error(w, "Not a websocket handshake", http.StatusBadRequest)
		return
	}

	key := r.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		http.Error(w, "Missing Sec-WebSocket-Key", http.StatusBadRequest)
		return
	}

	h := sha1.New()
	h.Write([]byte(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	accept := base64.StdEncoding.EncodeToString(h.Sum(nil))

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "Hijacking not supported", http.StatusInternalServerError)
		return
	}

	conn, bufrw, err := hijacker.Hijack()
	if err != nil {
		return
	}

	// Send handshake response
	res := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
	if _, err := bufrw.WriteString(res); err != nil {
		_ = conn.Close()
		return
	}
	if err := bufrw.Flush(); err != nil {
		_ = conn.Close()
		return
	}

	clientIP := GetClientIP(r)

	client := &WSClient{
		conn:        conn,
		hub:         s.hub,
		id:          r.URL.Query().Get("id"),
		name:        r.URL.Query().Get("name"),
		ip:          clientIP,
		userAgent:   r.UserAgent(),
		connectedAt: time.Now(),
	}

	if client.name == "" {
		client.name = "Misafir Cihaz"
	}

	s.hub.register(client)
	defer func() {
		s.hub.unregister(client)
		_ = conn.Close()
	}()

	// Read message loop
	for {
		msg, err := readWSFrame(bufrw)
		if err != nil {
			break
		}
		if len(msg) > 0 {
			var baseMsg struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(msg, &baseMsg); err == nil {
				// Only permit client-originated actions (chat, sync_play); block spoofed internal server events
				if baseMsg.Type == "chat" || baseMsg.Type == "sync_play" || baseMsg.Type == "sync_play_track" {
					if baseMsg.Type == "sync_play" || baseMsg.Type == "sync_play_track" {
						s.hub.mu.Lock()
						s.hub.lastSyncMsg = msg
						s.hub.mu.Unlock()
					}
					s.hub.broadcast(msg)
				}
			}
		}
	}
}

func readWSFrame(r *bufio.ReadWriter) ([]byte, error) {
	b0, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	opcode := b0 & 0x0F
	if opcode == 0x08 { // Close frame
		return nil, io.EOF
	}

	b1, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	isMasked := (b1 & 0x80) != 0
	payloadLen := int64(b1 & 0x7F)

	if payloadLen == 126 {
		var l uint16
		if err := binary.Read(r, binary.BigEndian, &l); err != nil {
			return nil, err
		}
		payloadLen = int64(l)
	} else if payloadLen == 127 {
		var l uint64
		if err := binary.Read(r, binary.BigEndian, &l); err != nil {
			return nil, err
		}
		payloadLen = int64(l)
	}

	// Frame size limit (Max 1 MB) to prevent OOM attacks
	const maxWSFrameSize = 1024 * 1024
	if payloadLen > maxWSFrameSize || payloadLen < 0 {
		return nil, fmt.Errorf("WebSocket çerçevesi çok büyük (%d bayt, limit: 1MB)", payloadLen)
	}

	var maskKey [4]byte
	if isMasked {
		if _, err := io.ReadFull(r, maskKey[:]); err != nil {
			return nil, err
		}
	}

	payload := make([]byte, payloadLen)
	if _, err := io.ReadFull(r, payload); err != nil {
		return nil, err
	}

	if isMasked {
		for i := 0; i < int(payloadLen); i++ {
			payload[i] ^= maskKey[i%4]
		}
	}

	return payload, nil
}

func encodeWSTextFrame(data []byte) []byte {
	l := len(data)
	var header []byte

	if l <= 125 {
		header = []byte{0x81, byte(l)}
	} else if l <= 65535 {
		header = make([]byte, 4)
		header[0] = 0x81
		header[1] = 126
		binary.BigEndian.PutUint16(header[2:], uint16(l))
	} else {
		header = make([]byte, 10)
		header[0] = 0x81
		header[1] = 127
		binary.BigEndian.PutUint64(header[2:], uint64(l))
	}

	return append(header, data...)
}

func (s *Server) handleOpenFolder(w http.ResponseWriter, r *http.Request) {
	if !s.sec.IsAdmin(r) {
		http.Error(w, "Yalnızca Host bilgisayar klasör açabilir", http.StatusForbidden)
		return
	}

	absPath, err := filepath.Abs(s.SharedDir)
	if err != nil {
		absPath = s.SharedDir
	}
	go func() {
		if runtime.GOOS == "windows" {
			_ = exec.Command("explorer.exe", absPath).Start()
		} else if runtime.GOOS == "darwin" {
			_ = exec.Command("open", absPath).Start()
		} else {
			_ = exec.Command("xdg-open", absPath).Start()
		}
	}()
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"status":"success","path":%q}`, absPath)))
}

func sendWindowsNotification(title, message string) {
	if runtime.GOOS != "windows" {
		return
	}
	go func() {
		script := fmt.Sprintf(`[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $xml = [xml]$template.GetXml(); $xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode(%q)) > $null; $xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode(%q)) > $null; $toastXml = New-Object Windows.Data.Xml.Dom.XmlDocument; $toastXml.LoadXml($xml.OuterXml); $toast = [Windows.UI.Notifications.ToastNotification]::new($toastXml); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('AirMesh').Show($toast)`, title, message)
		cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
		_ = cmd.Run()
	}()
}
