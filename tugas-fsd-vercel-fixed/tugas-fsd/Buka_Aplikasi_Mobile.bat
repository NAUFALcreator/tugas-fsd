@echo off
title SIANTRI Mobile App
cd /d "%~dp0"

echo ========================================================
echo   SIANTRI Mobile (Tampilan Layar HP)
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

:: 2. Buka dalam dimensi smartphone (414 x 820)
echo [2/2] Membuka jendela aplikasi mobile...

set "EDGE_PATH="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_PATH=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_PATH=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
)

if defined EDGE_PATH (
    start "" "%EDGE_PATH%" --app=http://localhost:3000/mobile.html --window-size=414,820
) else (
    start "" "http://localhost:3000/mobile.html"
)

echo ========================================================
echo   SIANTRI Mobile Berhasil Diluncurkan!
echo   - URL Mobile: http://localhost:3000/mobile.html
echo ========================================================
ping -n 3 127.0.0.1 >nul
exit
