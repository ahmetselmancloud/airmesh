@echo off
chcp 65001 > nul
title AirMesh — Yüksek Hızlı Yerel Paylaşım Sunucusu

echo ===================================================
echo     ⚡ AirMesh Yerel Paylaşım Başlatılıyor ⚡
echo ===================================================

set PATH=%USERPROFILE%\go_sdk\go\bin;%PATH%

if not exist "%USERPROFILE%\go_sdk\go\bin\go.exe" (
    where go >nul 2>nul
    if %errorlevel% neq 0 (
        echo [HATA] Go derleyicisi bulunamadı!
        pause
        exit /b 1
    )
)

echo [1/2] AirMesh derleniyor...
go build -o airmesh.exe main.go
if %errorlevel% neq 0 (
    echo [HATA] Derleme başarısız oldu!
    pause
    exit /b 1
)

echo [2/2] Sunucu çalıştırılıyor...
airmesh.exe -dir shared -port 8080
pause
