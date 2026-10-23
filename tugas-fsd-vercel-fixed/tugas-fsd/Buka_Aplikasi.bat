@echo off
title SIANTRI - Sistem Antrean Terpadu
cd /d "%~dp0"

echo ========================================================
echo   SIANTRI - Sistem Antrean Terpadu
echo ========================================================

:: 1. Cek apakah server port 3000 sudah aktif
netstat -ano | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo [1/2] Menyalakan Server SIANTRI di port 3000...
    start "SIANTRI Server" /min cmd /c "node server.js"
    ping -n 3 127.0.0.1 >nul
) else (
    echo [1/2] Server SIANTRI sudah aktif di port 3000.
)

:: 2. Buka antarmuka aplikasi dalam mode App Window
echo [2/2] Membuka jendela aplikasi...

set "EDGE_PATH="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_PATH=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_PATH=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
)

if defined EDGE_PATH (
    start "" "%EDGE_PATH%" --app=http://localhost:3000 --window-size=1280,820
) else (
    start "" "http://localhost:3000"
)

echo ========================================================
echo   Aplikasi SIANTRI Berhasil Diluncurkan!
echo   - Web Desktop : http://localhost:3000
echo   - Mode Mobile : http://localhost:3000/mobile.html
echo   - Monitor TV  : http://localhost:3000/monitor.html
echo ========================================================
ping -n 3 127.0.0.1 >nul
exit
