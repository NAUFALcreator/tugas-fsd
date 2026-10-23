@echo off
title SIANTRI Online Tunnel (Akses HP dari Mana Saja)
cd /d "%~dp0"

echo ========================================================
echo   SIANTRI - Akses Online untuk Smartphone / HP
echo ========================================================

netstat -ano | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo [1/2] Menyalakan Server SIANTRI...
    start "SIANTRI Server" /min cmd /c "node server.js"
    ping -n 3 127.0.0.1 >nul
) else (
    echo [1/2] Server SIANTRI aktif di port 3000.
)

echo.
echo [2/2] Menghubungkan tunnel publik (HTTPS)...
echo Tunggu beberapa detik hingga link "https://...lhr.life" muncul di bawah.
echo Buka link tersebut di browser HP Anda (Chrome / Safari)!
echo.
echo ========================================================
echo.

"C:\Windows\System32\OpenSSH\ssh.exe" -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run
pause
