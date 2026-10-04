package server

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"net"
	"sync"
)

// CaptiveDNSServer handles captive portal detection probes
type CaptiveDNSServer struct {
	sync.RWMutex
	TargetIP net.IP
	conn     *net.UDPConn
	running  bool
}

// StartCaptiveDNS starts listening on UDP port 53
func StartCaptiveDNS(targetIPStr string) (*CaptiveDNSServer, error) {
	ip := net.ParseIP(targetIPStr).To4()
	if ip == nil {
		return nil, fmt.Errorf("geçersiz IPv4 adresi: %s", targetIPStr)
	}

	addr, err := net.ResolveUDPAddr("udp", "0.0.0.0:53")
	if err != nil {
		return nil, err
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return nil, fmt.Errorf("port 53 açılamadı (yönetici yetkisi veya ICS meşgul olabilir): %w", err)
	}

	server := &CaptiveDNSServer{
		TargetIP: ip,
		conn:     conn,
		running:  true,
	}

	go server.listen()
	return server, nil
}

func (s *CaptiveDNSServer) SetTargetIP(newIP net.IP) {
	s.Lock()
	defer s.Unlock()
	if ipv4 := newIP.To4(); ipv4 != nil {
		s.TargetIP = ipv4
	}
}

func (s *CaptiveDNSServer) Stop() {
	s.running = false
	if s.conn != nil {
		s.conn.Close()
	}
}

func (s *CaptiveDNSServer) listen() {
	buf := make([]byte, 512)
	for s.running {
		n, remoteAddr, err := s.conn.ReadFrom(buf)
		if err != nil {
			if !s.running {
				break
			}
			continue
		}

		if n < 12 {
			continue // Invalid DNS header length
		}

		// Handle request and generate response
		response := s.createDNSResponse(buf[:n])
		if len(response) > 0 {
			_, _ = s.conn.WriteTo(response, remoteAddr)
		}
	}
}

func (s *CaptiveDNSServer) createDNSResponse(req []byte) []byte {
	// 12 bytes header
	// [0..1] Transaction ID
	// [2..3] Flags
	// [4..5] QDCOUNT
	// [6..7] ANCOUNT
	// [8..9] NSCOUNT
	// [10..11] ARCOUNT

	txID := req[0:2]
	qdCount := binary.BigEndian.Uint16(req[4:6])
	if qdCount == 0 {
		return nil
	}

	// Parse QNAME to see query
	idx := 12
	for idx < len(req) && req[idx] != 0 {
		labelLen := int(req[idx])
		idx += 1 + labelLen
	}
	idx += 1 // 0x00 terminal
	if idx+4 > len(req) {
		return nil
	}
	qType := binary.BigEndian.Uint16(req[idx : idx+2])
	idx += 4 // QTYPE (2) + QCLASS (2)

	// If not Type A (1) (e.g. AAAA for IPv6 = 28, TXT = 16, HTTPS = 65, etc.):
	// Return valid empty NOERROR response (ANCOUNT=0)
	// This immediately tells client devices that no record exists instead of timing out!
	if qType != 1 {
		var noErrRes bytes.Buffer
		noErrRes.Write(txID)
		noErrRes.Write([]byte{0x81, 0x80})                                     // Standard Response, No Error
		noErrRes.Write([]byte{0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}) // QDCOUNT=1, ANCOUNT=0
		noErrRes.Write(req[12:idx])                                            // Echo question
		return noErrRes.Bytes()
	}

	s.RLock()
	targetIP := s.TargetIP
	s.RUnlock()

	var res bytes.Buffer
	// Header
	res.Write(txID)
	// Flags: 0x8180 (Standard Query Response, No Error)
	res.Write([]byte{0x81, 0x80})
	// Questions: 1, Answers: 1, Authority: 0, Additional: 0
	res.Write([]byte{0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00})

	// Question Section (echo back from query)
	res.Write(req[12:idx])

	// Answer Section
	// Name pointer to question (0xc00c)
	res.Write([]byte{0xc0, 0x0c})
	// Type A (0x0001)
	res.Write([]byte{0x00, 0x01})
	// Class IN (0x0001)
	res.Write([]byte{0x00, 0x01})
	// TTL: 60 seconds (0x0000003c)
	res.Write([]byte{0x00, 0x00, 0x00, 0x3c})
	// RDLENGTH: 4 bytes for IPv4
	res.Write([]byte{0x00, 0x04})
	// RDATA: IPv4 target IP
	res.Write(targetIP)

	return res.Bytes()
}
