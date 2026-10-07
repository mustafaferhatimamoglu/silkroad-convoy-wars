@echo off
chcp 65001 >nul
title SILKROAD: CONVOY WARS V4 - COK OYUNCULU (YEREL AG)
cd /d "%~dp0.."

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" set PYTHON_EXE=python

echo ============================================================
echo    SILKROAD: CONVOY WARS V4 - cok oyunculu (yerel ag)
echo    Bu bilgisayar sunucu olur; ayni agdaki arkadaslarin asagida
echo    yazan "Yerel ag" adresini tarayicida acar.
echo    Windows guvenlik duvari sorarsa "Ozel aglar" icin izin ver.
echo    Kapatmak icin Ctrl+C
echo ============================================================
"%PYTHON_EXE%" server.py 5070 --lan
pause
