@echo off
chcp 65001 >nul
title SILKROAD: CONVOY WARS V5 - INTERNET
cd /d "%~dp0"

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" set PYTHON_EXE=python

echo ============================================================
echo    SILKROAD: CONVOY WARS V5 - internetten cok oyunculu
echo    Cok oyunculu sunucu + Cloudflare hizli tuneli acilir (sabit IP,
echo    modem ayari ya da hesap gerekmez) ve oyun tarayicida acilir.
echo    Asagida yazan https://....trycloudflare.com adresini arkadasina
echo    ver: oyunda (SilkroadV5 exe) Cok Oyunculu - Sunucu adresi kutusuna
echo    yazar. Surumleriniz ayni olmali. Pencere kapaninca sunucu kapanir.
echo ============================================================
if not exist "server\cloudflared.exe" if not exist "tools\cloudflared.exe" (
  echo.
  echo  server\cloudflared.exe bulunamadi. Cloudflare'in resmi surumunu indirip
  echo  server klasorune cloudflared.exe adiyla koyun:
  echo  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  echo.
)
"%PYTHON_EXE%" server\server.py 5070 --tunnel --client . --open
pause
