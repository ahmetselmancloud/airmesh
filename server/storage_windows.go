//go:build windows

package server

import (
	"syscall"
	"unsafe"
)

type StorageInfo struct {
	Total       uint64  `json:"total"`
	Free        uint64  `json:"free"`
	Used        uint64  `json:"used"`
	PercentUsed float64 `json:"percentUsed"`
}

func getDiskStorage(path string) (*StorageInfo, error) {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getDiskFreeSpaceEx := kernel32.NewProc("GetDiskFreeSpaceExW")

	var freeBytesAvailable, totalNumberOfBytes, totalNumberOfFreeBytes uint64
	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return nil, err
	}

	r1, _, err := getDiskFreeSpaceEx.Call(
		uintptr(unsafe.Pointer(pathPtr)),
		uintptr(unsafe.Pointer(&freeBytesAvailable)),
		uintptr(unsafe.Pointer(&totalNumberOfBytes)),
		uintptr(unsafe.Pointer(&totalNumberOfFreeBytes)),
	)
	if r1 == 0 {
		return nil, err
	}

	used := totalNumberOfBytes - freeBytesAvailable
	percent := 0.0
	if totalNumberOfBytes > 0 {
		percent = (float64(used) / float64(totalNumberOfBytes)) * 100.0
	}

	return &StorageInfo{
		Total:       totalNumberOfBytes,
		Free:        freeBytesAvailable,
		Used:        used,
		PercentUsed: percent,
	}, nil
}
