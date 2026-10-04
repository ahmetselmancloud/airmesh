package server

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type pinAttempt struct {
	count       int
	lastAttempt time.Time
	lockedUntil time.Time
}

type SecurityManager struct {
	sync.RWMutex
	PinEnabled  bool                 `json:"pinEnabled"`
	PinCode     string               `json:"pinCode"`
	ReadOnly    bool                 `json:"readOnly"`
	AllowDelete bool                 `json:"allowDelete"`
	tokens      map[string]time.Time
	attempts    map[string]*pinAttempt
}

func NewSecurityManager() *SecurityManager {
	sm := &SecurityManager{
		PinEnabled:  false,
		PinCode:     "",
		ReadOnly:    false,
		AllowDelete: false, // Default: misafirler dosya silemez
		tokens:      make(map[string]time.Time),
		attempts:    make(map[string]*pinAttempt),
	}

	// Periodic token & attempt pruning
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		for range ticker.C {
			sm.pruneExpired()
		}
	}()

	return sm
}

func (sm *SecurityManager) pruneExpired() {
	sm.Lock()
	defer sm.Unlock()

	now := time.Now()
	for t, exp := range sm.tokens {
		if now.After(exp) {
			delete(sm.tokens, t)
		}
	}

	for ip, att := range sm.attempts {
		if now.Sub(att.lastAttempt) > 15*time.Minute && now.After(att.lockedUntil) {
			delete(sm.attempts, ip)
		}
	}
}

// GetClientIP extracts IP address safely supporting both IPv4 and IPv6
func GetClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return strings.Trim(host, "[]")
}

// IsValidHost verifies Host header to prevent DNS Rebinding attacks
func (sm *SecurityManager) IsValidHost(hostHeader string) bool {
	if hostHeader == "" {
		return false
	}

	h, _, err := net.SplitHostPort(hostHeader)
	if err != nil {
		h = hostHeader
	}
	h = strings.Trim(strings.ToLower(h), "[]")

	if h == "localhost" || h == "127.0.0.1" || h == "::1" {
		return true
	}

	// Check if IP is valid local / private address
	ip := net.ParseIP(h)
	if ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
			return true
		}
	}

	// Check if host matches any local network interface IP
	localIPs, err := GetLocalIPs()
	if err == nil {
		for _, lip := range localIPs {
			if h == strings.ToLower(lip) {
				return true
			}
		}
	}

	return false
}

// IsAllowedOrigin checks if incoming Origin is trusted
func (sm *SecurityManager) IsAllowedOrigin(originHeader string) bool {
	if originHeader == "" {
		return true
	}

	u, err := url.Parse(originHeader)
	if err != nil {
		return false
	}

	return sm.IsValidHost(u.Host)
}

// IsAdmin checks if request originates from localhost / host machine
func (sm *SecurityManager) IsAdmin(r *http.Request) bool {
	clientIP := GetClientIP(r)
	ip := net.ParseIP(clientIP)
	if ip != nil && ip.IsLoopback() {
		return true
	}
	return clientIP == "localhost" || clientIP == "127.0.0.1" || clientIP == "::1"
}

// CheckAuth checks if caller is authenticated (Admin or valid PIN session)
func (sm *SecurityManager) CheckAuth(r *http.Request) bool {
	if sm.IsAdmin(r) {
		return true
	}

	sm.RLock()
	defer sm.RUnlock()

	if !sm.PinEnabled {
		return true
	}

	token := r.Header.Get("X-AirMesh-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		if cookie, err := r.Cookie("airmesh_token"); err == nil {
			token = cookie.Value
		}
	}

	if token == "" {
		return false
	}

	expiry, exists := sm.tokens[token]
	if !exists || time.Now().After(expiry) {
		return false
	}

	return true
}

// VerifyPin handles constant-time PIN comparison and IP-based rate limiting
func (sm *SecurityManager) VerifyPin(clientIP, pin string) (string, bool, string) {
	sm.Lock()
	defer sm.Unlock()

	now := time.Now()
	att, exists := sm.attempts[clientIP]
	if !exists {
		att = &pinAttempt{}
		sm.attempts[clientIP] = att
	}

	// Check if IP is currently locked out
	if now.Before(att.lockedUntil) {
		waitSec := int(time.Until(att.lockedUntil).Seconds())
		return "", false, fmt.Sprintf("Çok fazla hatalı deneme! Lütfen %d saniye bekleyin.", waitSec)
	}

	// Constant-time check
	pinMatch := subtle.ConstantTimeCompare([]byte(pin), []byte(sm.PinCode)) == 1
	if !sm.PinEnabled || pinMatch {
		// Reset failure counter on success
		att.count = 0
		att.lockedUntil = time.Time{}

		tokenBytes := make([]byte, 16)
		_, _ = rand.Read(tokenBytes)
		token := hex.EncodeToString(tokenBytes)
		sm.tokens[token] = now.Add(24 * time.Hour)
		return token, true, ""
	}

	// Failed attempt
	att.count++
	att.lastAttempt = now

	if att.count >= 5 {
		att.lockedUntil = now.Add(2 * time.Minute)
		return "", false, "Çok fazla hatalı PIN denemesi! 2 dakika boyunca giriş kilitlendi."
	}

	kalan := 5 - att.count
	return "", false, fmt.Sprintf("Hatalı PIN kodu! (Kalan deneme hakkı: %d)", kalan)
}

func (sm *SecurityManager) UpdateConfig(pinEnabled bool, pinCode string, readOnly, allowDelete bool) {
	sm.Lock()
	defer sm.Unlock()

	sm.PinEnabled = pinEnabled
	if pinCode != "" {
		sm.PinCode = strings.TrimSpace(pinCode)
	}
	sm.ReadOnly = readOnly
	sm.AllowDelete = allowDelete

	if !sm.PinEnabled {
		sm.tokens = make(map[string]time.Time)
		sm.attempts = make(map[string]*pinAttempt)
	}
}

type AuthStatusResponse struct {
	PinEnabled  bool   `json:"pinEnabled"`
	ReadOnly    bool   `json:"readOnly"`
	AllowDelete bool   `json:"allowDelete"`
	IsAdmin     bool   `json:"isAdmin"`
	IsAuth      bool   `json:"isAuth"`
	PinCode     string `json:"pinCode,omitempty"`
}

func (s *Server) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	isAdmin := s.sec.IsAdmin(r)
	isAuth := s.sec.CheckAuth(r)

	s.sec.RLock()
	defer s.sec.RUnlock()

	resp := AuthStatusResponse{
		PinEnabled:  s.sec.PinEnabled,
		ReadOnly:    s.sec.ReadOnly,
		AllowDelete: s.sec.AllowDelete,
		IsAdmin:     isAdmin,
		IsAuth:      isAuth,
	}

	if isAdmin {
		resp.PinCode = s.sec.PinCode
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleAuthVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Yalnızca POST metodu", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Pin string `json:"pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Geçersiz istek gövdesi", http.StatusBadRequest)
		return
	}

	clientIP := GetClientIP(r)
	token, ok, errMsg := s.sec.VerifyPin(clientIP, strings.TrimSpace(req.Pin))
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "error",
			"message": errMsg,
		})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "airmesh_token",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"token":   token,
		"message": "Giriş başarılı",
	})
}

func (s *Server) handleAuthConfig(w http.ResponseWriter, r *http.Request) {
	if !s.sec.IsAdmin(r) {
		http.Error(w, "Bu ayarı yalnızca oda yöneticisi (Host PC) değiştirebilir.", http.StatusForbidden)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Yalnızca POST metodu", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		PinEnabled  bool   `json:"pinEnabled"`
		PinCode     string `json:"pinCode"`
		ReadOnly    bool   `json:"readOnly"`
		AllowDelete bool   `json:"allowDelete"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Geçersiz istek", http.StatusBadRequest)
		return
	}

	s.sec.UpdateConfig(req.PinEnabled, req.PinCode, req.ReadOnly, req.AllowDelete)

	// Broadcast security config updated event to all connected devices
	s.hub.broadcast([]byte(`{"type":"security_config_updated"}`))

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Güvenlik ayarları güncellendi",
	})
}
