@echo off
chcp 65001 > nul
title SILKROAD: CONVOY WARS - 3D ACIK DUNYA KERVAN SAVASLARI
echo =====================================================================
echo    SILKROAD: CONVOY WARS (MODERN LOKOMOTIF & KERVAN SAVASLARI)
echo    3D Three.js Motoru - 60 FPS Tam Ekran Oynanabilir Surum
echo =====================================================================
echo.

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe

cd /d "C:\Silkroad\Silkroad_V2"

echo [BILGI] Oyun tarayicida aciliyor (http://localhost:8080/index.html)...
start http://localhost:8080/index.html

if exist "%PYTHON_EXE%" (
    "%PYTHON_EXE%" -u "server.py"
) else (
    start "" "index.html"
)

pause
