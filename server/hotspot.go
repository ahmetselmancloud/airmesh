package server

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"sync"
)

type HotspotConfig struct {
	SSID       string `json:"ssid"`
	Passphrase string `json:"passphrase"`
	Band       string `json:"band"`
	State      string `json:"state"` // "On" or "Off"
}

var (
	hotspotMu    sync.Mutex
	cachedConfig *HotspotConfig
)

// GetHotspotConfig queries Windows 10/11 Mobile Hotspot configuration
func GetHotspotConfig() (*HotspotConfig, error) {
	if runtime.GOOS != "windows" {
		return &HotspotConfig{
			State: "Unsupported",
			SSID:  "AirMesh (Masaüstü Modu)",
		}, nil
	}

	hotspotMu.Lock()
	defer hotspotMu.Unlock()

	psScript := `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + "`" + `1' })[0]
[Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime] | Out-Null
[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType=WindowsRuntime] | Out-Null
$profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
if (-not $profile) {
	@{ state = "NoNetwork"; ssid = ""; passphrase = ""; band = "" } | ConvertTo-Json -Compress
	exit
}
$tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
$cfg = $tm.GetCurrentAccessPointConfiguration()
$obj = @{
	state = $tm.TetheringOperationalState.ToString()
	ssid = $cfg.Ssid
	passphrase = $cfg.Passphrase
	band = $cfg.Band.ToString()
}
$obj | ConvertTo-Json -Compress
`

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript)
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("hotspot sorgulanamadı: %w", err)
	}

	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return nil, fmt.Errorf("boş yanıt alındı")
	}

	var cfg HotspotConfig
	if err := json.Unmarshal([]byte(trimmed), &cfg); err != nil {
		return nil, fmt.Errorf("hotspot çıktısı çözülemedi: %w", err)
	}

	cachedConfig = &cfg
	return &cfg, nil
}

// ToggleHotspot starts or stops the Windows 10/11 Mobile Hotspot
func ToggleHotspot(enable bool) error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("hotspot otomasyonu şu anda yalnızca Windows 10/11 üzerinde desteklenmektedir")
	}

	hotspotMu.Lock()
	defer hotspotMu.Unlock()

	action := "StartTetheringAsync"
	if !enable {
		action = "StopTetheringAsync"
	}

	psScript := fmt.Sprintf(`
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`+"`"+`1' })[0]
Function AwaitOperation($asyncOp, $type) {
	$asTask = $asTaskGeneric.MakeGenericMethod($type)
	$netTask = $asTask.Invoke($null, @($asyncOp))
	$netTask.Wait(8000)
	return $netTask.Result
}
[Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime] | Out-Null
[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType=WindowsRuntime] | Out-Null
$profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
if ($profile) {
	$tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
	$op = $tm.%s()
	AwaitOperation $op ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult]) | Out-Null
}
`, action)

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript)
	return cmd.Run()
}

// GetWifiQRContent formats Wi-Fi credentials into standard QR code string
func GetWifiQRContent(ssid, passphrase string) string {
	return fmt.Sprintf("WIFI:S:%s;T:WPA;P:%s;;", ssid, passphrase)
}
