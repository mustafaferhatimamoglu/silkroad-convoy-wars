@echo off
chcp 65001 >nul
title SILKROAD: CONVOY WARS V5 - COK OYUNCULU (YEREL AG)
cd /d "%~dp0.."

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" set PYTHON_EXE=python

echo ============================================================
echo    SILKROAD: CONVOY WARS V5 - cok oyunculu (yerel ag)
echo    Bu bilgisayar sunucu olur; ayni agdaki arkadaslarin oyunda
echo    Cok Oyunculu - Sunucu adresi kutusuna asagidaki "Yerel ag"
echo    adresini yazar. Windows guvenlik duvari sorarsa "Ozel aglar"
echo    icin izin ver. Kapatmak icin Ctrl+C
echo ============================================================
"%PYTHON_EXE%" server\server.py 5070 --lan --client . --open
pause
