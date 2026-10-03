package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type SecurityManager struct {
	sync.RWMutex
	PinEnabled  bool                 `json:"pinEnabled"`
	PinCode     string               `json:"pinCode"`
	ReadOnly    bool                 `json:"readOnly"`
	AllowDelete bool                 `json:"allowDelete"`
	tokens      map[string]time.Time
}

func NewSecurityManager() *SecurityManager {
	return &SecurityManager{
		PinEnabled:  false,
		PinCode:     "",
		ReadOnly:    false,
		AllowDelete: false, // Default: misafirler dosya silemez
		tokens:      make(map[string]time.Time),
	}
}

// IsAdmin checks if request originates from localhost / host machine
func (sm *SecurityManager) IsAdmin(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	if ip != nil && ip.IsLoopback() {
		return true
	}
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
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

func (sm *SecurityManager) VerifyPin(pin string) (string, bool) {
	sm.Lock()
	defer sm.Unlock()

	if !sm.PinEnabled || pin == sm.PinCode {
		tokenBytes := make([]byte, 16)
		_, _ = rand.Read(tokenBytes)
		token := hex.EncodeToString(tokenBytes)
		sm.tokens[token] = time.Now().Add(24 * time.Hour)
		return token, true
	}
	return "", false
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

	token, ok := s.sec.VerifyPin(strings.TrimSpace(req.Pin))
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "error",
			"message": "Hatalı PIN kodu. Lütfen tekrar deneyin.",
		})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "airmesh_token",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: false,
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
