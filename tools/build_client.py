"""Dagitim paketleri: tek exe istemci + ayri sunucu paketi (dist/ altinda, git disi).

  python tools/build_client.py

  dist/SilkroadV5-<surum>.exe          oyunun tamami (index.html, src/, vendor/, content/) icinde;
                                       arkadasa yalniz bu dosya verilir. Windows'ta hazir gelen
                                       .NET Framework derleyicisiyle (csc.exe) derlenir.
  dist/SilkroadV5-Sunucu-<surum>.zip   cok oyunculu sunucu (server.py + baslaticilar); oyun
                                       dosyasi icermez. Python 3 gerekir.

Silkroad'in kendi dosyalari (assets/) hicbir pakete girmez: V5'in dunyasi, dokulari, muzigi ve
simgesi kendi uretimimizdir. Kervan RPG / karakter kodu (eski Silkroad karakterlerine bagli) da
pakete alinmaz.
"""
import glob
import hashlib
import io
import os
import re
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
LAUNCHER = os.path.join(ROOT, 'tools', 'launcher')

INCLUDE = ['index.html', 'src', 'vendor', 'content']
# eski Silkroad karakter/ekonomi verisine bagli, menuden kaldirilmis bolumler
EXCLUDE = ['src/rpg/', 'src/chars/', 'src/modes/KervanMode.js', 'src/modes/CharViewMode.js', 'src/ui/KervanUI.js']


def version():
    s = open(os.path.join(ROOT, 'src', 'version.js'), encoding='utf-8').read()
    v = re.search(r"export const VERSION = '(\d+\.\d+\.\d+)'", s).group(1)
    sv = re.search(r'^VERSION = "(\d+\.\d+\.\d+)"', open(os.path.join(ROOT, 'server', 'server.py'), encoding='utf-8').read(), re.M).group(1)
    if v != sv:
        sys.exit(f'istemci {v} ve sunucu {sv} surumu farkli (python tools/bump.py)')
    return v


def game_files():
    out = []
    for item in INCLUDE:
        p = os.path.join(ROOT, item)
        if os.path.isfile(p):
            out.append(item)
            continue
        for f in glob.glob(os.path.join(p, '**', '*'), recursive=True):
            if os.path.isdir(f):
                continue
            rel = os.path.relpath(f, ROOT).replace('\\', '/')
            if any(rel.startswith(e) for e in EXCLUDE) or '/.' in '/' + rel or rel.endswith(('.md', '.map')):
                continue
            out.append(rel)
    return sorted(out)


def game_zip(files):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in files:
            ext = os.path.splitext(rel)[1].lower()
            z.write(os.path.join(ROOT, rel), rel, compress_type=zipfile.ZIP_STORED if ext in ('.jpg', '.png') else zipfile.ZIP_DEFLATED)
    return buf.getvalue()


def find_csc():
    win = os.environ.get('WINDIR', r'C:\Windows')
    for fw in ('Framework64', 'Framework'):
        cands = sorted(glob.glob(os.path.join(win, 'Microsoft.NET', fw, 'v4.*', 'csc.exe')))
        if cands:
            return cands[-1]
    sys.exit('csc.exe bulunamadi (.NET Framework 4)')


def build_exe(v, zbytes):
    os.makedirs(DIST, exist_ok=True)
    tmp = os.path.join(DIST, 'build')
    os.makedirs(tmp, exist_ok=True)
    zpath = os.path.join(tmp, 'oyun.zip')
    open(zpath, 'wb').write(zbytes)
    info = os.path.join(tmp, 'BuildInfo.cs')
    h = hashlib.sha1(zbytes).hexdigest()[:8]     # ayni surumun farkli derlemesi ayri klasore acilsin
    open(info, 'w', encoding='utf-8').write(
        f'static class BuildInfo {{ public const string Version = "{v}"; public const string Hash = "{h}"; '
        f'public const string AssemblyVersion = "{v}.0"; }}\n')
    out = os.path.join(DIST, f'SilkroadV5-{v}.exe')
    cmd = [find_csc(), '/nologo', '/target:winexe', '/optimize+', '/codepage:65001', f'/out:{out}',
           f'/win32icon:{os.path.join(LAUNCHER, "icon.ico")}', f'/resource:{zpath},oyun.zip',
           '/r:System.IO.Compression.dll', '/r:System.IO.Compression.FileSystem.dll', '/r:System.Windows.Forms.dll',
           '/r:System.Management.dll', os.path.join(LAUNCHER, 'Launcher.cs'), info]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        print(r.stdout, r.stderr)
        sys.exit('derleme hatasi')
    os.remove(zpath)
    return out


SERVER_README = """Silkroad: Convoy Wars {v} - cok oyunculu sunucu
==================================================

Bu paket yalniz sunucudur (oyun dosyasi icermez). Oyunu oynayan herkes SilkroadV5-{v}.exe
kullanir; surumler birebir ayni olmali (farkli surumdeki oyuncuyu sunucu iceri almaz).

Gerekenler: Python 3 (https://www.python.org/ - kurarken "Add to PATH" isaretleyin).

  SUNUCU.bat            yerel ag (ayni evdeki/ofisteki bilgisayarlar)
  INTERNET_SUNUCU.bat   internetten: Cloudflare hizli tuneli acilir, sabit IP ya da modem ayari
                        gerekmez. cloudflared.exe'yi bu klasore koyun:
                        https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
                        (indirince adini cloudflared.exe yapin)

Sunucu acilinca pencerede yazan adresi arkadaslariniza verin; oyunda
Cok Oyunculu -> Sunucu adresi kutusuna yazip Baglan'a basarlar.
"""

BAT = """@echo off
chcp 65001 >nul
title Silkroad: Convoy Wars {v} - sunucu
cd /d "%~dp0"
where python >nul 2>nul || (echo Python bulunamadi: https://www.python.org/ & pause & exit /b)
python server.py 5070 {args}
pause
"""


def build_server(v):
    out = os.path.join(DIST, f'SilkroadV5-Sunucu-{v}.zip')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(ROOT, 'server', 'server.py'), 'server.py')
        z.writestr('SUNUCU.bat', BAT.format(v=v, args='--lan').replace('\n', '\r\n'))
        z.writestr('INTERNET_SUNUCU.bat', BAT.format(v=v, args='--tunnel').replace('\n', '\r\n'))
        z.writestr('BENIOKU.txt', SERVER_README.format(v=v).replace('\n', '\r\n'))
    return out


def main():
    v = version()
    files = game_files()
    leaked = [f for f in files if f.startswith('assets/')]
    if leaked:
        sys.exit(f'pakete Silkroad dosyasi girdi: {leaked[:3]}')
    zb = game_zip(files)
    print(f'surum {v}: {len(files)} dosya, oyun paketi {len(zb) / 1048576:.1f} MB')
    exe = build_exe(v, zb)
    print(f'istemci: {os.path.relpath(exe, ROOT)} ({os.path.getsize(exe) / 1048576:.1f} MB)')
    srv = build_server(v)
    print(f'sunucu:  {os.path.relpath(srv, ROOT)}')


if __name__ == '__main__':
    main()
