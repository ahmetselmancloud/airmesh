package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestHostValidation(t *testing.T) {
	sm := NewSecurityManager()

	validHosts := []string{
		"localhost",
		"localhost:8080",
		"127.0.0.1",
		"127.0.0.1:8080",
		"[::1]",
		"[::1]:8080",
		"192.168.1.15",
		"192.168.1.15:8080",
		"10.0.0.5",
		"172.16.0.10:8081",
	}

	for _, h := range validHosts {
		if !sm.IsValidHost(h) {
			t.Errorf("Host '%s' geçerli olmalıydı fakat reddedildi", h)
		}
	}

	invalidHosts := []string{
		"evil.com",
		"evil.com:8080",
		"attacker.org",
		"attacker.org:80",
		"random-domain.xyz",
	}

	for _, h := range invalidHosts {
		if sm.IsValidHost(h) {
			t.Errorf("Zararlı host '%s' reddedilmeliydi fakat kabul edildi", h)
		}
	}
}

func TestPinRateLimiting(t *testing.T) {
	sm := NewSecurityManager()
	sm.UpdateConfig(true, "1234", false, false)
	clientIP := "192.168.1.100"

	// 4 wrong attempts should fail with remaining count
	for i := 1; i <= 4; i++ {
		_, ok, msg := sm.VerifyPin(clientIP, "0000")
		if ok {
			t.Fatalf("Yanlış PIN kabul edilmemeliydi")
		}
		if msg == "" {
			t.Errorf("Hata mesajı boş olmamalı")
		}
	}

	// 5th wrong attempt should lock out
	_, ok, _ := sm.VerifyPin(clientIP, "0000")
	if ok {
		t.Fatalf("5. yanlış PIN kabul edilmemeliydi")
	}
	if !testing.Short() {
		// Attempting again while locked should be blocked
		_, ok2, _ := sm.VerifyPin(clientIP, "1234")
		if ok2 {
			t.Errorf("Kilitliyken doğru PIN bile girilse kilit süresi dolmadan açılmamalı")
		}
	}

	// Another IP should not be locked out and can verify correct PIN
	otherIP := "192.168.1.101"
	token, ok3, _ := sm.VerifyPin(otherIP, "1234")
	if !ok3 || token == "" {
		t.Errorf("Diğer IP doğru PIN ile giriş yapabilmeliydi")
	}
}

func TestCreateUniqueFile(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "airmesh_test_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	f1, path1, err := createUniqueFile(tempDir, "test.txt")
	if err != nil {
		t.Fatal(err)
	}
	f1.Close()

	if filepath.Base(path1) != "test.txt" {
		t.Errorf("Beklenen: test.txt, Alınan: %s", filepath.Base(path1))
	}

	// Second creation with same name should create test (1).txt
	f2, path2, err := createUniqueFile(tempDir, "test.txt")
	if err != nil {
		t.Fatal(err)
	}
	f2.Close()

	if filepath.Base(path2) != "test (1).txt" {
		t.Errorf("Beklenen: test (1).txt, Alınan: %s", filepath.Base(path2))
	}
}

func TestGetSafeRelPathSecurity(t *testing.T) {
	tempShared, err := os.MkdirTemp("", "airmesh_shared_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempShared)

	srv := &Server{SharedDir: tempShared}

	// Normal valid relative path
	safe, err := srv.getSafeRelPath("sub/folder")
	if err != nil {
		t.Errorf("Geçerli alt dizin reddedildi: %v", err)
	}
	if safe == "" {
		t.Errorf("Güvenli yol boş olamaz")
	}

	// Directory traversal attempt
	_, err = srv.getSafeRelPath("../../Windows/System32")
	if err == nil {
		t.Errorf("Path traversal engellenmeliydi fakat geçti")
	}

	_, err = srv.getSafeRelPath("../")
	if err == nil {
		t.Errorf("Üst dizine çıkış engellenmeliydi")
	}
}

func TestIntermediateSymlinkJunctionEscapeBlocked(t *testing.T) {
	tempShared, err := os.MkdirTemp("", "airmesh_shared_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempShared)

	outsideDir, err := os.MkdirTemp("", "airmesh_outside_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(outsideDir)

	secretFile := filepath.Join(outsideDir, "secret.txt")
	if err := os.WriteFile(secretFile, []byte("super_secret"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create symlink inside shared pointing to outsideDir
	linkPath := filepath.Join(tempShared, "link")
	err = os.Symlink(outsideDir, linkPath)
	if err != nil {
		t.Skip("Symlink oluşturulamadı (Windows Developer Mode veya yetki gerekebilir), test atlanıyor")
	}

	srv := &Server{SharedDir: tempShared}

	// Attempting to access link/secret.txt must be rejected because it resolves outside tempShared!
	_, err = srv.getSafeRelPath("link/secret.txt")
	if err == nil {
		t.Fatalf("Ara dizin symlink/junction kaçışı engellenmeliydi fakat başarılı oldu!")
	}
}

func TestCSRFBlockingWithUntrustedOrigin(t *testing.T) {
	tempShared, err := os.MkdirTemp("", "airmesh_shared_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempShared)

	victimPath := filepath.Join(tempShared, "victim.txt")
	_ = os.WriteFile(victimPath, []byte("important data"), 0644)

	srv := NewServer(tempShared, os.DirFS(tempShared))
	handler := srv.Routes()

	// 1. Untrusted Origin POST to /api/delete
	req := httptest.NewRequest("POST", "/api/delete?file=victim.txt", nil)
	req.Header.Set("Origin", "https://evil.com")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("Untrusted Origin isteği 403 Forbidden ile engellenmeliydi, dönen kod: %d", rec.Code)
	}

	// Verify file was NOT deleted
	if _, err := os.Stat(victimPath); os.IsNotExist(err) {
		t.Fatalf("CSRF saldırısı dosyayı sildi! Dosya korunmalıydı.")
	}

	// 2. Sec-Fetch-Site cross-site
	req2 := httptest.NewRequest("POST", "/api/delete?file=victim.txt", nil)
	req2.Header.Set("Sec-Fetch-Site", "cross-site")
	rec2 := httptest.NewRecorder()

	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusForbidden {
		t.Fatalf("Sec-Fetch-Site: cross-site isteği 403 ile engellenmeliydi, dönen kod: %d", rec2.Code)
	}
}

func TestCaptiveAppleProbeLandingPage(t *testing.T) {
	tempShared, err := os.MkdirTemp("", "airmesh_shared_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempShared)

	srv := NewServer(tempShared, os.DirFS(tempShared))
	handler := srv.Routes()

	// Probe request with Host: captive.apple.com to /
	req := httptest.NewRequest("GET", "/", nil)
	req.Host = "captive.apple.com"
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Should not return 400 Bad Request!
	if rec.Code == http.StatusBadRequest {
		t.Fatalf("Captive portal probe 400 Bad Request almamalı! Dönen kod: %d", rec.Code)
	}
}

func TestDNSNoErrorsOnNonAQueries(t *testing.T) {
	dns, err := StartCaptiveDNS("192.168.1.1")
	if err != nil {
		t.Skip("Port 53 açılamadı (ICS veya yetki), test atlanıyor")
	}
	defer dns.Stop()

	time.Sleep(10 * time.Millisecond)

	// Simulate AAAA query (QTYPE = 28 / 0x001c)
	req := []byte{
		0x12, 0x34, // TXID
		0x01, 0x00, // Standard query
		0x00, 0x01, // QDCOUNT = 1
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x06, 'g', 'o', 'o', 'g', 'l', 'e',
		0x03, 'c', 'o', 'm', 0x00,
		0x00, 0x1c, // QTYPE = AAAA (28)
		0x00, 0x01, // QCLASS = IN (1)
	}

	resp := dns.createDNSResponse(req)
	if resp == nil {
		t.Fatalf("AAAA sorgusuna boş yanıt (nil) dönülmemeli, boş NOERROR dönülmeli!")
	}

	// ANCOUNT should be 0 (bytes 6..7)
	anCount := int(resp[6])<<8 | int(resp[7])
	if anCount != 0 {
		t.Errorf("AAAA yanıtında ANCOUNT 0 olmalıydı, alınan: %d", anCount)
	}
}
