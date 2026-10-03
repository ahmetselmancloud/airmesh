package server

import (
	"fmt"
	"net"
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

// PrintBanner prints a clean terminal banner for the host
func PrintBanner(ips []string, port int, sharedDir string, captiveEnabled bool) {
	fmt.Println("==================================================================")
	fmt.Println("   ⚡ AirMesh — Yüksek Hızlı Yerel Dosya & Medya Ekosistemi ⚡   ")
	fmt.Println("==================================================================")
	fmt.Printf("📂 Paylaşılan Klasör: %s\n", sharedDir)
	fmt.Printf("🌐 Port: %d\n", port)
	if captiveEnabled {
		fmt.Println("📡 Captive Portal DNS: Aktif (UDP :53)")
	} else {
		fmt.Println("📡 Captive Portal DNS: Devre Dışı (Standart mod)")
	}
	fmt.Println("------------------------------------------------------------------")
	fmt.Println("📱 Alıcı Cihazlar İçin Doğrudan Bağlantı Adresleri:")
	for _, ip := range ips {
		fmt.Printf("   👉 http://%s:%d\n", ip, port)
	}
	fmt.Println("------------------------------------------------------------------")
	fmt.Println("💡 Not: Telefon veya bilgisayarları aynı Wi-Fi / Hotspot ağına")
	fmt.Println("   bağlayıp yukarıdaki adresi tarayıcıda açmanız yeterlidir!")
	fmt.Println("==================================================================")
}
