package server

import (
	"fmt"
	"net"
	"strings"

	"github.com/skip2/go-qrcode"
)

// GetLocalIPs returns filtered, prioritized IPv4 addresses
// The primary Wi-Fi / LAN IP is always placed at index 0.
func GetLocalIPs() ([]string, error) {
	var prioritized []string
	seen := make(map[string]bool)

	// 1. Detect primary outbound LAN IP via socket routing table
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		localAddr := conn.LocalAddr().(*net.UDPAddr)
		_ = conn.Close()
		ip := localAddr.IP.To4()
		if ip != nil && !ip.IsLoopback() {
			ipStr := ip.String()
			prioritized = append(prioritized, ipStr)
			seen[ipStr] = true
		}
	}

	// 2. Scan network interfaces and filter out virtualization/VPN subnets
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}

			// Skip known virtual adapters by name
			nameLower := strings.ToLower(iface.Name)
			if strings.Contains(nameLower, "virtual") ||
				strings.Contains(nameLower, "vethernet") ||
				strings.Contains(nameLower, "tailscale") ||
				strings.Contains(nameLower, "bluetooth") ||
				strings.Contains(nameLower, "docker") {
				continue
			}

			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}

			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}

				if ip == nil || ip.IsLoopback() {
					continue
				}

				ip = ip.To4()
				if ip == nil {
					continue
				}

				ipStr := ip.String()
				if seen[ipStr] {
					continue
				}

				// Filter out VirtualBox, Tailscale, APIPA, WSL ranges
				if strings.HasPrefix(ipStr, "192.168.56.") || // VirtualBox
					strings.HasPrefix(ipStr, "100.") || // Tailscale / CGNAT
					strings.HasPrefix(ipStr, "169.254.") || // APIPA
					strings.HasPrefix(ipStr, "172.18.") { // Hyper-V
					continue
				}

				prioritized = append(prioritized, ipStr)
				seen[ipStr] = true
			}
		}
	}

	if len(prioritized) == 0 {
		prioritized = append(prioritized, "127.0.0.1")
	}

	return prioritized, nil
}

// PrintBanner prints a clean terminal banner and ASCII QR codes for the host
func PrintBanner(ips []string, port int, sharedDir string, captiveEnabled bool, hotspotCfg *HotspotConfig) {
	fmt.Println("==================================================================")
	fmt.Println("   ⚡ AirMesh — Yüksek Hızlı Yerel Dosya & Medya Ekosistemi ⚡   ")
	fmt.Println("==================================================================")
	fmt.Printf("📂 Paylaşılan Klasör: %s\n", sharedDir)
	fmt.Printf("🌐 Port: %d (TCP_NODELAY & 4MB Buffers Aktif)\n", port)
	if captiveEnabled {
		fmt.Println("📡 Captive Portal DNS: Aktif (UDP :53)")
	} else {
		fmt.Println("📡 Captive Portal DNS: Devre Dışı (Standart mod)")
	}

	if hotspotCfg != nil && hotspotCfg.SSID != "" {
		fmt.Println("------------------------------------------------------------------")
		fmt.Printf("📶 Mobil Etkin Nokta (Hotspot): %s [Durum: %s]\n", hotspotCfg.SSID, hotspotCfg.State)
		fmt.Printf("🔑 Hotspot Parolası: %s\n", hotspotCfg.Passphrase)
		wifiQR := GetWifiQRContent(hotspotCfg.SSID, hotspotCfg.Passphrase)
		qWifi, err := qrcode.New(wifiQR, qrcode.Medium)
		if err == nil {
			fmt.Println("📷 Telefonla Wi-Fi'a Şifresiz Katılmak İçin Okutun:")
			fmt.Println(qWifi.ToSmallString(true))
		}
	}

	fmt.Println("------------------------------------------------------------------")
	fmt.Println("📱 Alıcı Cihazlar İçin Doğrudan Web Bağlantı Adresleri:")
	
	primaryURL := fmt.Sprintf("http://%s:%d", ips[0], port)
	fmt.Printf("   👉 %s (⭐ Önerilen Wi-Fi Adresi)\n", primaryURL)
	for i := 1; i < len(ips); i++ {
		fmt.Printf("   👉 http://%s:%d\n", ips[i], port)
	}

	fmt.Println("------------------------------------------------------------------")
	fmt.Printf("📷 Web Arayüzünü Açmak İçin QR Kod (%s):\n", primaryURL)
	q, err := qrcode.New(primaryURL, qrcode.Medium)
	if err == nil {
		fmt.Println(q.ToSmallString(true))
	}

	fmt.Println("------------------------------------------------------------------")
	fmt.Println("💡 Telefonunuzu bilgisayarla AYNI Wi-Fi ağına bağlayıp")
	fmt.Println("   yukarıdaki QR kodu kameranızla okutmanız yeterlidir!")
	fmt.Println("==================================================================")
}
