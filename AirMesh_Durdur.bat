@echo off
chcp 65001 >nul
title AirMesh Durdur
cd /d "%~dp0"
echo ==================================================================
echo   🛑 AirMesh Sunucusu Durduruluyor...
echo ==================================================================
taskkill /F /IM airmesh.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ AirMesh başarıyla durduruldu.
) else (
    echo.
    echo ℹ️ AirMesh zaten çalışmıyor.
)
timeout /t 2 >nul
