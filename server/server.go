package server

import (
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
	"path/filepath"
	"strings"
	"sync"
)

type FileItem struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
	IsDir   bool   `json:"isDir"`
}

type Server struct {
	SharedDir string
	WebFS     fs.FS
	hub       *WSHub
}

func NewServer(sharedDir string, webFS fs.FS) *Server {
	return &Server{
		SharedDir: sharedDir,
		WebFS:     webFS,
		hub:       newWSHub(),
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
	mux.HandleFunc("/ws", s.handleWebSocket)

	// Static web assets from embedded filesystem
	fileServer := http.FileServer(http.FS(s.WebFS))
	mux.Handle("/", fileServer)

	return s.withCORS(mux)
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleListFiles(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(s.SharedDir)
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

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(files)
}

func (s *Server) getSafeFilePath(fileName string) (string, error) {
	cleanName := filepath.Base(filepath.Clean(fileName))
	if cleanName == "." || cleanName == "/" || cleanName == "\\" {
		return "", errors.New("geçersiz dosya adı")
	}
	fullPath := filepath.Join(s.SharedDir, cleanName)
	return fullPath, nil
}

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	fileName := r.URL.Query().Get("file")
	if fileName == "" {
		http.Error(w, "Dosya adı belirtilmedi", http.StatusBadRequest)
		return
	}

	fullPath, err := s.getSafeFilePath(fileName)
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
	if fileName == "" {
		http.Error(w, "Dosya adı belirtilmedi", http.StatusBadRequest)
		return
	}

	fullPath, err := s.getSafeFilePath(fileName)
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

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Yalnızca POST desteklenir", http.StatusMethodNotAllowed)
		return
	}

	fileName := r.URL.Query().Get("name")
	if fileName == "" {
		// Try multipart header
		err := r.ParseMultipartForm(32 << 20) // 32MB in RAM
		if err == nil && r.MultipartForm != nil && len(r.MultipartForm.File) > 0 {
			for _, headers := range r.MultipartForm.File {
				for _, h := range headers {
					src, err := h.Open()
					if err != nil {
						continue
					}
					targetPath, _ := s.getSafeFilePath(h.Filename)
					dst, err := os.Create(targetPath)
					if err == nil {
						writer := bufio.NewWriterSize(dst, 4*1024*1024)
						_, _ = io.Copy(writer, src)
						_ = writer.Flush()
						_ = dst.Close()
					}
					_ = src.Close()
				}
			}
			s.hub.broadcast([]byte(`{"type":"file_list_updated"}`))
			w.WriteHeader(http.StatusOK)
			return
		}
		http.Error(w, "Dosya adı belirtilmedi", http.StatusBadRequest)
		return
	}

	fullPath, err := s.getSafeFilePath(fileName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Direct streaming from body to disk with 4MB buffer (No memory bloat!)
	outFile, err := os.Create(fullPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Dosya oluşturulamadı: %v", err), http.StatusInternalServerError)
		return
	}
	defer outFile.Close()

	bufWriter := bufio.NewWriterSize(outFile, 4*1024*1024) // 4MB buffer
	_, err = io.Copy(bufWriter, r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Yazma hatası: %v", err), http.StatusInternalServerError)
		return
	}
	_ = bufWriter.Flush()

	s.hub.broadcast([]byte(`{"type":"file_list_updated"}`))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

// Pure Go RFC6455 WebSocket Implementation
type WSClient struct {
	conn net.Conn
	hub  *WSHub
	id   string
	name string
}

type WSHub struct {
	mu      sync.Mutex
	clients map[*WSClient]bool
}

func newWSHub() *WSHub {
	return &WSHub{
		clients: make(map[*WSClient]bool),
	}
}

func (h *WSHub) register(c *WSClient) {
	h.mu.Lock()
	h.clients[c] = true
	count := len(h.clients)
	h.mu.Unlock()

	h.broadcast([]byte(fmt.Sprintf(`{"type":"device_count","count":%d}`, count)))
}

func (h *WSHub) unregister(c *WSClient) {
	h.mu.Lock()
	delete(h.clients, c)
	count := len(h.clients)
	h.mu.Unlock()

	h.broadcast([]byte(fmt.Sprintf(`{"type":"device_count","count":%d}`, count)))
}

func (h *WSHub) broadcast(msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	frame := encodeWSTextFrame(msg)
	for client := range h.clients {
		_, _ = client.conn.Write(frame)
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
	_, _ = bufrw.WriteString(res)
	_ = bufrw.Flush()

	client := &WSClient{
		conn: conn,
		hub:  s.hub,
		id:   r.URL.Query().Get("id"),
		name: r.URL.Query().Get("name"),
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
			s.hub.broadcast(msg)
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
