@echo off
chcp 65001 >nul
title SILKROAD: CONVOY WARS V4
cd /d "%~dp0"

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" set PYTHON_EXE=python

echo ============================================================
echo    SILKROAD: CONVOY WARS V4
echo    Sunucu: http://localhost:5070/   (kapatmak icin Ctrl+C)
echo ============================================================
"%PYTHON_EXE%" server.py 5070
pause
