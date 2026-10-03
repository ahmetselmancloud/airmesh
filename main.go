package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

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
			// Not critical: non-admin users cannot bind to 53, server still works!
			// fmt.Printf("⚠️  DNS uyarısı: %v\n", err)
		} else {
			dnsServer = dns
			defer dnsServer.Stop()
		}
	}

	// Query Windows Mobile Hotspot config
	hotspotCfg, _ := server.GetHotspotConfig()

	// Print beautiful terminal banner
	server.PrintBanner(localIPs, *portFlag, sharedDir, dnsServer != nil, hotspotCfg)

	// Create and start HTTP server with 4MB TCP socket buffers and TCP_NODELAY
	srv := server.NewServer(sharedDir, webSubFS)
	httpServer := &http.Server{
		Handler: srv.Routes(),
	}

	listener, err := server.NewOptimizedListener(fmt.Sprintf("0.0.0.0:%d", *portFlag), 4*1024*1024)
	if err != nil {
		log.Fatalf("Soket dinlenemedi: %v", err)
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
