@echo off
chcp 65001 >nul
title SILKROAD: CONVOY WARS V4 - INTERNET
cd /d "%~dp0"

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" set PYTHON_EXE=python

echo ============================================================
echo    SILKROAD: CONVOY WARS V4 - internetten cok oyunculu
echo    Cloudflare hizli tuneli acilir: sabit IP, modem ayari ya da
echo    hesap gerekmez. Oyunda Cok Oyunculu - Oda kur - "Davet dosyasi"
echo    ile arkadasina gonder; dosyayi acinca odana baglanir.
echo    Pencere kapaninca tunel de kapanir. Kapatmak icin Ctrl+C
echo ============================================================
if not exist "tools\cloudflared.exe" (
  echo.
  echo  tools\cloudflared.exe bulunamadi. Cloudflare'in resmi surumunu indirip
  echo  tools klasorune cloudflared.exe adiyla koyun:
  echo  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  echo.
)
"%PYTHON_EXE%" server.py 5070 --tunnel
pause
