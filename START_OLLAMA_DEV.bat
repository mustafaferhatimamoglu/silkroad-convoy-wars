@echo off
chcp 65001 > nul
title OLLAMA TEST-DRIVEN GAME DEV LOOP - SILKROAD V2
echo =====================================================================
echo    SILKROAD V2 - OLLAMA TEST-ODAKLI OTONOM OYUN GELISDIRME MOTORU
echo    Model: huihui_ai/qwen2.5-coder-abliterate:7b (RTX 5060)
echo    Kurallar: C:\Rules.md Uyumlu ^| extracted\ Salt-Okunur
echo =====================================================================
echo.

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe

if not exist "%PYTHON_EXE%" (
    echo [HATA] Python bulunamadi: %PYTHON_EXE%
    pause
    exit /b 1
)

cd /d "C:\Silkroad\Silkroad_V2"
"%PYTHON_EXE%" -u "ollama_dev_loop.py"

echo.
echo =====================================================================
echo    GELISTIRME DONGUSU TAMAMLANDI.
echo =====================================================================
pause
