package server

import (
	"fmt"
	"net"

	"github.com/skip2/go-qrcode"
)

// GetLocalIPs returns non-loopback IPv4 addresses
func GetLocalIPs() ([]string, error) {
	var ips []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	for _, iface := range interfaces {
		// Skip down and loopback interfaces
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
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

			// Exclude common virtualization/docker bridge IPs if possible, but keep local LAN/Hotspot
			ipStr := ip.String()
			ips = append(ips, ipStr)
		}
	}

	return ips, nil
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
		fmt.Printf("📶 Windows Mobil Etkin Nokta (Hotspot): %s [Durum: %s]\n", hotspotCfg.SSID, hotspotCfg.State)
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
	
	var primaryURL string
	for i, ip := range ips {
		url := fmt.Sprintf("http://%s:%d", ip, port)
		if i == 0 {
			primaryURL = url
		}
		fmt.Printf("   👉 %s\n", url)
	}

	if primaryURL != "" {
		fmt.Println("------------------------------------------------------------------")
		fmt.Println("📷 Web Arayüzünü Açmak İçin QR Kod:")
		q, err := qrcode.New(primaryURL, qrcode.Medium)
		if err == nil {
			fmt.Println(q.ToSmallString(true))
		}
	}

	fmt.Println("------------------------------------------------------------------")
	fmt.Println("💡 Telefonunuzu aynı Wi-Fi/Hotspot ağına bağlayıp web arayüzünü açın.")
	fmt.Println("==================================================================")
}
