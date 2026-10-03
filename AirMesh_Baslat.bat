@echo off
chcp 65001 >nul
title AirMesh - Yerel Paylaşım Ekosistemi
cd /d "%~dp0"
echo ==================================================================
echo   🚀 AirMesh - Yerel Dosya ve Medya Paylaşım Sunucusu
echo ==================================================================
echo.
echo Sunucu başlatılıyor...
echo (Durdurmak için bu pencereyi kapatabilir veya Ctrl+C yapabilirsiniz)
echo.
airmesh.exe
pause
