@echo off
chcp 65001 >nul
title SILKROAD MULTI-AGENT & 3D OYUN BASLATICI
cls
echo ==============================================================
echo       SILKROAD: MULTI-AGENT MOTORU VE 3D OYUN SISTEMI
echo ==============================================================
echo.
echo [1/3] Yerel Ollama Motoru kontrol ediliyor...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo       [OK] Ollama zaten arka planda calisiyor.
) else (
    echo       [BASLATILIYOR] Ollama daemon calistiriliyor...
    start "Ollama Service" /min "C:\Users\Administrator\AppData\Local\Programs\Ollama\ollama.exe" serve
    timeout /t 2 >nul
)

echo.
echo [2/3] Web Sunucusu ve Orkestrasyon Hatti baslatiliyor...
tasklist /FI "IMAGENAME eq python.exe" 2>NUL | find /I /N "python.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo       [OK] Web Sunucusu zaten arka planda calisiyor.
) else (
    echo       [BASLATILIYOR] Web Sunucusu baslatiliyor...
    start "Silkroad Orchestrator" /min "C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe" "c:\Silkroad\Silkroad\start_orchestrator.py"
    timeout /t 2 >nul
)

echo.
echo [3/3] Tarayici panelleri aciliyor...
start http://localhost:5050
start http://localhost:5050/3d/

echo.
echo ==============================================================
echo   HER SEY HAZIR! Tum sistemler basariyla ayaga kalkti.
echo   - Gelistirme ve Yonetim Paneli: http://localhost:5050
echo   - 3D Silkroad Oyunu:            http://localhost:5050/3d/
echo ==============================================================
echo Bu pencereyi kapatabilirsiniz.
timeout /t 4 >nul
exit
