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

if exist "%PYTHON_EXE%" (
    echo [BILGI] Yerel Web Sunucusu baslatiliyor (http://localhost:8080)...
    "%PYTHON_EXE%" -u "server.py"
) else (
    echo [BILGI] Python bulunamadi, dogrudan varsayilan tarayicida aciliyor...
    start "" "index.html"
)

pause
