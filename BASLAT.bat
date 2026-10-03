@echo off
title Silkroad Online V3 Web Server (Port 5050)
cd /d "%~dp0"
echo ========================================================
echo    Silkroad Online V3 - Web ve Three.js Sunucusu
echo ========================================================
echo Sunucu baslatiliyor: http://localhost:5050
echo Kapatmak icin bu pencereyi kapatabilir veya Ctrl+C yapabilirsiniz.
echo.

start http://localhost:5050/index.html
start http://localhost:5050/MAP/viewer.html

"C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe" -m http.server 5050
pause
