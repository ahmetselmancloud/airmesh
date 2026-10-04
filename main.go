package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"airmesh/server"
)

//go:embed web/*
var embeddedWeb embed.FS

func main() {
	dirFlag := flag.String("dir", "./shared", "Paylaşılacak hedef klasör")
	portFlag := flag.Int("port", 8080, "HTTP sunucusu dinleme portu")
	dnsFlag := flag.Bool("dns", true, "Captive portal DNS sunucusunu başlat (Port 53)")
	flag.Parse()

	// Ensure shared directory exists
	sharedDir, err := filepath.Abs(*dirFlag)
	if err != nil {
		log.Fatalf("Klasör yolu çözülemedi: %v", err)
	}
	if err := os.MkdirAll(sharedDir, 0755); err != nil {
		log.Fatalf("Klasör oluşturulamadı: %v", err)
	}

	// Sub-filesystem for web folder
	webSubFS, err := fs.Sub(embeddedWeb, "web")
	if err != nil {
		log.Fatalf("Gömülü web dosyaları yüklenemedi: %v", err)
	}

	// Detect local IPs
	localIPs, err := server.GetLocalIPs()
	if err != nil || len(localIPs) == 0 {
		localIPs = []string{"127.0.0.1"}
	}

	// Captive DNS initialization
	var dnsServer *server.CaptiveDNSServer
	primaryIP := localIPs[0]
	if *dnsFlag {
		dns, err := server.StartCaptiveDNS(primaryIP)
		if err != nil {
			fmt.Printf("ℹ️  DNS Bilgisi: Port 53 açılamadı (%v).\n    (Windows ICS devrede ise bu beklenen durumdur; AirMesh HTTP üzerinden çalışmaya devam eder.)\n\n", err)
		} else {
			dnsServer = dns
			defer dnsServer.Stop()

			// Dynamic IP updater: if Hotspot starts and assigns 192.168.137.1, update DNS target IP immediately!
			go func() {
				ticker := time.NewTicker(5 * time.Second)
				for range ticker.C {
					newIPs, err := server.GetLocalIPs()
					if err == nil && len(newIPs) > 0 {
						for _, nip := range newIPs {
							if strings.HasPrefix(nip, "192.168.137.") {
								dnsServer.SetTargetIP(net.ParseIP(nip))
								break
							}
						}
					}
				}
			}()
		}
	}

	// Bind listener with automatic port fallback if port is busy
	port := *portFlag
	var listener *server.OptimizedTCPListener
	for i := 0; i < 10; i++ {
		tryPort := port + i
		l, err := server.NewOptimizedListener(fmt.Sprintf("0.0.0.0:%d", tryPort), 4*1024*1024)
		if err == nil {
			listener = l
			port = tryPort
			if i > 0 {
				fmt.Printf("⚠️  Port %d meşgul olduğu için otomatik olarak Port %d seçildi.\n", *portFlag, port)
			}
			break
		}
	}
	if listener == nil {
		log.Fatalf("Port %d ve sonraki portlar dinlenemedi.", *portFlag)
	}

	// Try port 80 auxiliary redirector for seamless Captive Portal detection on mobile
	go func() {
		p80Listener, err := net.Listen("tcp", ":80")
		if err == nil {
			defer p80Listener.Close()
			p80Mux := http.NewServeMux()
			p80Mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
				http.Redirect(w, r, fmt.Sprintf("http://%s:%d/", localIPs[0], port), http.StatusFound)
			})
			_ = http.Serve(p80Listener, p80Mux)
		}
	}()

	// Query Windows Mobile Hotspot config
	hotspotCfg, _ := server.GetHotspotConfig()

	// Print beautiful terminal banner with actual active port
	server.PrintBanner(localIPs, port, sharedDir, dnsServer != nil, hotspotCfg)

	// Create and start HTTP server with 4MB TCP socket buffers, Slowloris protection and TCP_NODELAY
	srv := server.NewServer(sharedDir, webSubFS)
	httpServer := &http.Server{
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 5 * time.Second, // Slowloris mitigation
		IdleTimeout:       60 * time.Second,
	}

	// Graceful shutdown handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		fmt.Println("\n🛑 AirMesh kapatılıyor...")
		if dnsServer != nil {
			dnsServer.Stop()
		}
		_ = httpServer.Close()
		_ = listener.Close()
		os.Exit(0)
	}()

	if err := httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP sunucu hatası: %v", err)
	}
}
