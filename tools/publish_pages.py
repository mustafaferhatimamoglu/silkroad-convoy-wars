"""Oyunun herkese acik kopyasi (GitHub Pages) - YALNIZ kod.

Yayinlanan: index.html, sw.js, src/, vendor/ (bizim kodumuz + acik kaynak kutuphaneler).
Yayinlanmayan: assets/ (Silkroad dosyalari, Joymax'in telifli icerigi). Arkadas oyunu Pages'ten
acar; Silkroad dosyalari davet edenin bilgisayarindan bir kez iner ve tarayicida kalir.

  python tools/publish_pages.py build [klasor]   kopyayi olustur (varsayilan tools/rally/work/pages)
  python tools/publish_pages.py serve [port]     kopyayi yerelde Pages gibi (alt dizinde) sun, varsayilan 5080
  python tools/publish_pages.py publish          gh-pages dalina gonder, Pages'i ac (ilk sefer)

serve ile yayin oncesi deneme: oyun sunucusu 5070'te acikken arkadas tarafi
http://localhost:5080/silkroad-convoy-wars/?host=http://localhost:5070&join=ODA&stage=hotan

Surum: src/version.js icindeki BUILD, commit kimligi + tarihle doldurulur (yerelde 'dev').
Lobide kurucu ile uyenin ag protokolu (PROTOCOL) ve etap verisi karsilastirilir; uyusmazsa
"Hazirim" acilmaz. Kodu degistirince yeniden yayinlamak yeter.
"""
import datetime
import os
import shutil
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, 'tools', 'rally', 'work', 'pages')
FILES = ('index.html', 'sw.js')
DIRS = ('src', 'vendor')


def git(*args, cwd=ROOT):
    return subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def build(out):
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)
    for f in FILES:
        shutil.copy2(os.path.join(ROOT, f), os.path.join(out, f))
    for d in DIRS:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(out, d))
    rev = git('rev-parse', '--short', 'HEAD')
    dirty = git('status', '--porcelain', '--', *FILES, *DIRS) != ''
    tag = f"{rev}{'+' if dirty else ''}-{datetime.date.today().isoformat()}"
    vp = os.path.join(out, 'src', 'version.js')
    s = open(vp, encoding='utf-8').read()
    assert "export const BUILD = 'dev';" in s
    open(vp, 'w', encoding='utf-8', newline='\n').write(s.replace("export const BUILD = 'dev';", f"export const BUILD = '{tag}';"))
    open(os.path.join(out, '.nojekyll'), 'w').close()   # Jekyll alt cizgili dosyalari gizlemesin
    n, size = 0, 0
    for dp, _, fs in os.walk(out):
        for f in fs:
            n += 1
            size += os.path.getsize(os.path.join(dp, f))
    print(f'kopya: {out}  ({n} dosya, {size / 1048576:.1f} MB, surum {tag})')
    if os.path.exists(os.path.join(out, 'assets')):
        raise SystemExit('HATA: assets/ yayina girmemeli')
    return tag


def publish():
    remote = git('remote', 'get-url', 'origin')
    repo = remote.rstrip('/').removesuffix('.git').split('github.com/')[-1]
    out = tempfile.mkdtemp(prefix='sro-pages-')
    tag = build(out)
    name, email = git('config', 'user.name'), git('config', 'user.email')
    git('init', '-q', cwd=out)
    git('checkout', '-q', '-b', 'gh-pages', cwd=out)
    git('add', '-A', cwd=out)
    git('-c', f'user.name={name}', '-c', f'user.email={email}', 'commit', '-q', '-m',
        f'Pages: oyun kodu {tag}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>', cwd=out)
    git('push', '-q', '-f', remote, 'gh-pages', cwd=out)
    shutil.rmtree(out, ignore_errors=True)
    r = subprocess.run(['gh', 'api', f'repos/{repo}/pages'], capture_output=True, text=True)
    if r.returncode != 0:
        subprocess.run(['gh', 'api', '-X', 'POST', f'repos/{repo}/pages', '-f', 'source[branch]=gh-pages', '-f', 'source[path]=/'],
                       check=True, capture_output=True, text=True)
        print('GitHub Pages acildi (ilk yayin birkac dakika surebilir).')
    owner, name_ = repo.split('/')
    print(f'yayinlandi: https://{owner}.github.io/{name_}/  (surum {tag})')


def serve(port):
    import functools
    import http.server
    name = 'silkroad-convoy-wars'
    root = os.path.join(ROOT, 'tools', 'rally', 'work', 'pages-root')
    build(os.path.join(root, name))

    class H(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                          '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css'}

        def end_headers(self):
            self.send_header('Cache-Control', 'no-cache')
            super().end_headers()

        def log_message(self, *a):
            pass

    import socket
    import threading

    class S6(http.server.ThreadingHTTPServer):
        address_family = socket.AF_INET6

    handler = functools.partial(H, directory=root)
    try:   # localhost hem 127.0.0.1 hem ::1 olabilir
        threading.Thread(target=S6(('::1', port), handler).serve_forever, daemon=True).start()
    except OSError:
        pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    print(f'Pages benzetimi: http://localhost:{port}/{name}/', flush=True)
    srv.serve_forever()


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'build':
        build(sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT)
    elif cmd == 'serve':
        serve(int(sys.argv[2]) if len(sys.argv) > 2 else 5080)
    elif cmd == 'publish':
        publish()
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
