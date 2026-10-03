@echo off
chcp 65001 > nul
title OLLAMA TASK MASTER - SILKROAD V2 (%100 GÖREV MOTORU)
echo =====================================================================
echo    SILKROAD V2 - OLLAMA OTONOM TERSINE MUHENDISLIK MOTORU (%100 HEDEF)
echo    Model: huihui_ai/qwen2.5-coder-abliterate:7b (RTX 5060)
echo    Kurallar: C:\Rules.md ve C:\Secret.md Uyumlu (0 USD Maliyet)
echo =====================================================================
echo.

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe

if not exist "%PYTHON_EXE%" (
    echo [HATA] Python bulunamadi: %PYTHON_EXE%
    pause
    exit /b 1
)

cd /d "C:\Silkroad\Silkroad_V2"
"%PYTHON_EXE%" -u "ollama_task_master.py"

echo.
echo =====================================================================
echo    ISLEM TAMAMLANDI VEYA DURDURULDU.
echo =====================================================================
pause
