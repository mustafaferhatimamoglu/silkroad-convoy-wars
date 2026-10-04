"""Silkroad V4 yerel oyun sunucusu.

Statik dosyalari cok is parcacikli olarak sunar. ES modulleri icin dogru MIME
turlerini zorlar (Windows kayit defteri .js dosyalarini bazen text/plain verir)
ve buyuk oyun varliklarini (assets/) tarayici onbellegine birakir.

Kullanim:  python server.py [port]
"""
import http.server
import mimetypes
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5070

MIME = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".bin": "application/octet-stream",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".css": "text/css",
    ".html": "text/html; charset=utf-8",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
}
for ext, mime in MIME.items():
    mimetypes.add_type(mime, ext)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **MIME}

    def end_headers(self):
        # Oyun varliklari degismez: uzun onbellek. Kod her zaman taze yuklensin.
        if self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=86400")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Sadece hatalari yaz; binlerce varlik istegi konsolu bogmasin.
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class Server6(Server):
    address_family = socket.AF_INET6


def main():
    url = f"http://localhost:{PORT}/"
    # localhost hem 127.0.0.1 hem ::1 olarak cozulebilir; sadece yerel arayuzleri dinle
    try:
        httpd = Server(("127.0.0.1", PORT), Handler)
        try:
            httpd6 = Server6(("::1", PORT), Handler)
            threading.Thread(target=httpd6.serve_forever, daemon=True).start()
        except OSError:
            pass
    except OSError:
        print(f"Port {PORT} kullaniliyor; sunucu zaten acik olabilir. Tarayici aciliyor: {url}")
        if "--no-browser" not in sys.argv:
            webbrowser.open(url)
        return
    print("=" * 60)
    print("  SILKROAD: CONVOY WARS V4  -  yerel sunucu")
    print(f"  Adres: {url}")
    print("  Kapatmak icin Ctrl+C")
    print("=" * 60)
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
