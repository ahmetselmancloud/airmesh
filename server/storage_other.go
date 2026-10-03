//go:build !windows

package server

type StorageInfo struct {
	Total       uint64  `json:"total"`
	Free        uint64  `json:"free"`
	Used        uint64  `json:"used"`
	PercentUsed float64 `json:"percentUsed"`
}

func getDiskStorage(path string) (*StorageInfo, error) {
	return &StorageInfo{
		Total:       100 * 1024 * 1024 * 1024,
		Free:        50 * 1024 * 1024 * 1024,
		Used:        50 * 1024 * 1024 * 1024,
		PercentUsed: 50.0,
	}, nil
}
