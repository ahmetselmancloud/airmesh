package server

import (
	"net"
)

// OptimizedTCPListener wraps net.TCPListener to apply 4MB socket buffers and TCP_NODELAY
type OptimizedTCPListener struct {
	*net.TCPListener
	BufferSize int
}

// NewOptimizedListener creates a TCP listener with custom buffer settings
func NewOptimizedListener(addr string, bufferSize int) (*OptimizedTCPListener, error) {
	tcpAddr, err := net.ResolveTCPAddr("tcp", addr)
	if err != nil {
		return nil, err
	}

	l, err := net.ListenTCP("tcp", tcpAddr)
	if err != nil {
		return nil, err
	}

	return &OptimizedTCPListener{
		TCPListener: l,
		BufferSize:  bufferSize,
	}, nil
}

// Accept wraps connection acceptance with high-throughput TCP options
func (l *OptimizedTCPListener) Accept() (net.Conn, error) {
	conn, err := l.TCPListener.AcceptTCP()
	if err != nil {
		return nil, err
	}

	// TCP_NODELAY = 1: Eliminate Nagle's delay for immediate packet dispatch
	_ = conn.SetNoDelay(true)

	// High throughput 4MB socket buffers for 80-90+ MB/s Wi-Fi transfers
	if l.BufferSize > 0 {
		_ = conn.SetReadBuffer(l.BufferSize)
		_ = conn.SetWriteBuffer(l.BufferSize)
	}

	return conn, nil
}
