"""Silkroad: Convoy Wars V5 - cok oyunculu sunucu.

Istemciden (oyunun kendisi: SilkroadV5.exe ya da tarayici) ayri bir programdir. Oyun mantigi
calistirmaz ve oyun dosyasi sunmaz: /ws adresinde WebSocket oda sistemi kurar, odadaki oyuncular
arasinda mesaj aktarir (herkes kendi aracini simule eder, botlari oda kurucusu surer).

Surum: istemci "hello" mesajinda surumunu yollar; sunucunun surumuyle birebir ayni degilse
baglanti reddedilir (farkli surumler ayni dunyayi/etabi farkli kurar). Her degisiklikte
tools/bump.py iki tarafin surumunu birlikte yukseltir.

Internet: --tunnel ile Cloudflare'in ucretsiz hizli tuneli (cloudflared) acilir; sabit IP, modem
ayari ya da hesap gerekmez. Cikan https://....trycloudflare.com adresini arkadasina ver; istemcide
Cok Oyunculu -> Sunucu adresi kutusuna yazar.

Gelistirme / yerel ag: --client <klasor> verilirse o klasordeki oyun da ayni adresten sunulur
(tarayiciyla oynamak icin). Yalniz oyunun calismasi icin gereken dosyalar sunulur (index.html,
src/, vendor/, content/); git gecmisi, araclar ve klasor listeleri disariya kapalidir.

Kullanim:  python server/server.py [port] [--lan] [--tunnel] [--client DIR] [--open]
  --lan     yerel agdaki diger bilgisayarlar baglanabilsin (0.0.0.0 dinlenir)
  --tunnel  internetten baglanti: cloudflared (server/, tools/ ya da PATH) ile tunel
  --client  oyun klasorunu da sun (or. --client .)
  --open    acilista oyunu tarayicida ac (--client ile)
"""
import base64
import hashlib
import http.server
import json
import mimetypes
import os
import random
import re
import shutil
import socket
import socketserver
import struct
import subprocess
import sys
import atexit
import threading
import time
import webbrowser

VERSION = "5.2.0"

HERE = os.path.dirname(os.path.abspath(__file__))
ARGV = sys.argv[1:]


def _opt(name):
    if name in ARGV:
        i = ARGV.index(name)
        if i + 1 < len(ARGV) and not ARGV[i + 1].startswith("--"):
            return ARGV[i + 1]
    return None


CLIENT = _opt("--client")
CLIENT = os.path.abspath(CLIENT) if CLIENT else None
POS = [a for i, a in enumerate(ARGV) if not a.startswith("--") and (i == 0 or ARGV[i - 1] != "--client")]
PORT = int(POS[0]) if POS else 5070
LAN = "--lan" in ARGV
TUNNEL = "--tunnel" in ARGV
TUNNEL_URL = None
WS_IDLE = 90               # sn: bu kadar sessiz kalan WebSocket kapatilir
STATS = {"sent": 0}
STATS_LOCK = threading.Lock()

# --client ile disariya sunulan yollar (gerisi 404)
ALLOWED_FILES = {"/", "/index.html"}
ALLOWED_PREFIXES = ("/src/", "/vendor/", "/content/")

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


def lan_addresses():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                ips.add(ip)
    except OSError:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))   # paket gonderilmez; varsayilan arayuzu bulur
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    return sorted(ips)


# ---------------------------------------------------------------- oda sistemi

MAX_ROOM = 8
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class Conn:
    _next = 1
    _lock = threading.Lock()

    def __init__(self, sock):
        with Conn._lock:
            self.id = Conn._next
            Conn._next += 1
        self.sock = sock
        self.name = f"Oyuncu {self.id}"
        self.room = None
        self.send_lock = threading.Lock()
        self.alive = True
        self.ok = False            # surumu dogrulanmis "hello" gelene dek yalniz hello/ping kabul

    def send(self, obj):
        data = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        n = len(data)
        if n < 126:
            head = struct.pack("!BB", 0x81, n)
        elif n < 65536:
            head = struct.pack("!BBH", 0x81, 126, n)
        else:
            head = struct.pack("!BBQ", 0x81, 127, n)
        try:
            with self.send_lock:
                self.sock.sendall(head + data)
        except OSError:
            self.alive = False


class Room:
    def __init__(self, code, host):
        self.code = code
        self.host = host
        self.members = {host.id: host}
        self.started = False
        self.open = False          # basladiktan sonra da katilinabilir (serbest gezinti)
        self.mode = ""
        self.created = time.time()

    def info(self):
        return {"t": "room", "code": self.code, "host": self.host.id, "started": self.started, "open": self.open, "mode": self.mode,
                "members": [{"id": c.id, "name": c.name} for c in self.members.values()]}

    def broadcast(self, obj, exclude=None):
        for c in list(self.members.values()):
            if c is not exclude:
                c.send(obj)


ROOMS = {}
ROOMS_LOCK = threading.Lock()


def new_code():
    letters = "ABCDEFGHJKLMNPRSTUVYZ"
    while True:
        code = "".join(random.choice(letters) for _ in range(4))
        if code not in ROOMS:
            return code


def leave_room(c):
    with ROOMS_LOCK:
        r = c.room
        if not r:
            return
        r.members.pop(c.id, None)
        c.room = None
        if not r.members:
            ROOMS.pop(r.code, None)
            return
        if r.host is c:   # kurucu ayrildi: en eski uye kurucu olur
            r.host = next(iter(r.members.values()))
        info = r.info()
    r.broadcast({"t": "left", "id": c.id})
    r.broadcast(info)


def handle_message(c, msg):
    t = msg.get("t")
    if t == "hello":
        v = str(msg.get("v") or "")
        if v != VERSION:
            c.send({"t": "error", "code": "version", "server": VERSION, "client": v,
                    "msg": f"Sürüm uyuşmuyor: sunucu {VERSION}, oyunun {v or 'eski'}. Aynı sürümü kullanın."})
            c.alive = False
            return
        c.ok = True
        c.name = str(msg.get("name") or c.name)[:24]
        c.send({"t": "welcome", "id": c.id, "s": time.time() * 1000, "v": VERSION})
        return
    if t == "ping":
        c.send({"t": "pong", "c": msg.get("c"), "s": time.time() * 1000})
        return
    if not c.ok:
        return
    if t == "rooms":
        with ROOMS_LOCK:
            lst = [{"code": r.code, "host": r.host.name, "n": len(r.members), "started": r.started, "open": r.open, "mode": r.mode}
                   for r in ROOMS.values()]
        c.send({"t": "rooms", "list": lst})
    elif t == "create":
        leave_room(c)
        with ROOMS_LOCK:
            r = Room(new_code(), c)
            ROOMS[r.code] = r
            c.room = r
            info = r.info()
        c.send(info)
    elif t == "join":
        code = str(msg.get("code") or "").upper().strip()
        with ROOMS_LOCK:
            r = ROOMS.get(code)
            err = None if r else "Oda bulunamadı"
            if r and len(r.members) >= MAX_ROOM:
                err = "Oda dolu"
            if r and r.started and not r.open:
                err = "Yarış başlamış"
        if err:
            c.send({"t": "error", "msg": err})
            return
        leave_room(c)
        with ROOMS_LOCK:
            r.members[c.id] = c
            c.room = r
            info = r.info()
        r.broadcast(info)
    elif t == "leave":
        leave_room(c)
    elif t == "started":
        r = c.room
        if r and r.host is c:
            r.started = bool(msg.get("v", True))
            r.open = bool(msg.get("open", False)) and r.started
            r.mode = str(msg.get("mode") or "")[:12] if r.started else ""
            r.broadcast(r.info())
    elif t == "relay":
        r = c.room
        if not r:
            return
        to, d = msg.get("to", "all"), msg.get("d")
        out = {"t": "relay", "from": c.id, "d": d}
        if to == "all":
            r.broadcast(out, exclude=c)
        elif to == "host":
            r.host.send(out)
        else:
            m = r.members.get(to)
            if m:
                m.send(out)


def recv_exact(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError
        buf += chunk
    return buf


def ws_loop(c):
    sock = c.sock
    frag = b""
    while c.alive:
        b1, b2 = recv_exact(sock, 2)
        fin, op = b1 & 0x80, b1 & 0x0F
        masked, n = b2 & 0x80, b2 & 0x7F
        if n == 126:
            n = struct.unpack("!H", recv_exact(sock, 2))[0]
        elif n == 127:
            n = struct.unpack("!Q", recv_exact(sock, 8))[0]
        if n > 1 << 20:
            raise ConnectionError
        mask = recv_exact(sock, 4) if masked else b"\0\0\0\0"
        data = bytearray(recv_exact(sock, n))
        for i in range(n):
            data[i] ^= mask[i & 3]
        if op == 0x8:
            break
        if op == 0x9:   # ping -> pong
            with c.send_lock:
                sock.sendall(struct.pack("!BB", 0x8A, len(data)) + bytes(data))
            continue
        if op in (0x1, 0x0):
            frag += bytes(data)
            if not fin:
                continue
            payload, frag = frag, b""
            try:
                msg = json.loads(payload.decode("utf-8"))
            except ValueError:
                continue
            if isinstance(msg, dict):
                handle_message(c, msg)


def server_info():
    with ROOMS_LOCK:
        players = sum(len(r.members) for r in ROOMS.values())
        rooms = len(ROOMS)
    return {"server": "silkroad", "version": VERSION, "lan": LAN, "port": PORT, "addresses": lan_addresses() if LAN else [],
            "tunnel": TUNNEL_URL, "tunnelWanted": TUNNEL, "rooms": rooms, "players": players, "client": bool(CLIENT),
            "sent": STATS["sent"]}


STATUS_PAGE = """<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Silkroad V5 sunucusu</title>
<style>body{{font:16px/1.5 Georgia,serif;background:#15110b;color:#eadfc6;display:grid;place-items:center;height:100vh;margin:0}}
div{{padding:24px 30px;border:1px solid #6b5630;border-radius:10px;max-width:520px}}b{{color:#f2c46d}}</style></head>
<body><div><h2>Silkroad: Convoy Wars sunucusu</h2><p>Sürüm <b>{v}</b> çalışıyor.</p>
<p>Bu adres oyunun kendisi değil, çok oyunculu sunucudur. Oyunu (SilkroadV5.exe) aç,
<b>Çok Oyunculu</b> ekranında <b>Sunucu adresi</b> kutusuna bu sayfanın adresini yaz.</p></div></body></html>"""


# ---------------------------------------------------------------- HTTP

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CLIENT or HERE, **kwargs)

    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **MIME}

    def _bytes(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/ws") and self.headers.get("Upgrade", "").lower() == "websocket":
            return self.websocket()
        if self.path.startswith("/api/info"):
            return self._bytes(json.dumps(server_info()).encode("utf-8"), "application/json")
        if not CLIENT:
            if self.path.split("?", 1)[0] in ("/", "/index.html"):
                return self._bytes(STATUS_PAGE.format(v=VERSION).encode("utf-8"), "text/html; charset=utf-8")
            self.send_error(404, "Bulunamadi")
            return None
        return super().do_GET()

    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        ok = path in ALLOWED_FILES or path.startswith(ALLOWED_PREFIXES)
        if not CLIENT or not ok or "/." in path or ".." in path:
            self.send_error(404, "Bulunamadi")
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404, "Bulunamadi")
        return None

    def copyfile(self, source, outputfile):
        n = 0
        while True:
            buf = source.read(64 * 1024)
            if not buf:
                break
            outputfile.write(buf)
            n += len(buf)
        with STATS_LOCK:
            STATS["sent"] += n

    def websocket(self):
        key = self.headers.get("Sec-WebSocket-Key", "")
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()
        self.wfile.flush()
        sock = self.connection
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        # istemci 2 sn'de bir ping atar (arka plandaki sekmede dakikada bire inebilir): uzun sure
        # hic veri gelmezse baglanti olu sayilir (kopan internet, uyuyan bilgisayar), oyuncu odadan duser
        sock.settimeout(WS_IDLE)
        c = Conn(sock)
        try:
            ws_loop(c)
        except (ConnectionError, OSError):
            pass
        finally:
            c.alive = False
            leave_room(c)
            self.close_connection = True

    def end_headers(self):
        if not self.path.startswith("/ws"):
            # oyun kodu her zaman taze yuklensin (surum degisince eski dosya kalmasin)
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Sadece hatalari yaz; binlerce dosya istegi konsolu bogmasin.
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


# ---------------------------------------------------------------- internet tuneli

def find_cloudflared():
    for d in (HERE, os.path.join(os.path.dirname(HERE), "tools")):
        for name in ("cloudflared.exe", "cloudflared"):
            p = os.path.join(d, name)
            if os.path.exists(p):
                return p
    return shutil.which("cloudflared")


def start_tunnel():
    """Cloudflare hizli tuneli: bu bilgisayardan disariya baglanir (sabit IP / port yonlendirme gerekmez)."""
    exe = find_cloudflared()
    if not exe:
        print("  UYARI: cloudflared bulunamadi; internet baglantisi kapali.")
        print("  server/cloudflared.exe olarak koyun (Cloudflare'in resmi GitHub surumu: cloudflared-windows-amd64.exe).")
        return None
    # ayni konsolu paylasir: pencere kapaninca tunel de kapanir
    proc = subprocess.Popen([exe, "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{PORT}"],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")

    def reader():
        global TUNNEL_URL
        for line in proc.stdout:
            m = re.search(r"https://[-a-z0-9]+\.trycloudflare\.com", line)
            if m and not TUNNEL_URL:
                TUNNEL_URL = m.group(0)
                print(f"  Internet adresi hazir: {TUNNEL_URL}")
                print("  Arkadasin oyunda Cok Oyunculu -> Sunucu adresi kutusuna bunu yazsin.")
        if not TUNNEL_URL:
            print("  UYARI: internet tuneli acilamadi (cloudflared kapandi).")

    threading.Thread(target=reader, daemon=True).start()
    atexit.register(lambda: proc.poll() is None and proc.terminate())
    return proc


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class Server6(Server):
    address_family = socket.AF_INET6


def main():
    url = f"http://localhost:{PORT}/"
    # localhost hem 127.0.0.1 hem ::1 olarak cozulebilir; LAN modunda tum IPv4 arayuzleri
    try:
        httpd = Server(("0.0.0.0" if LAN else "127.0.0.1", PORT), Handler)
        try:
            httpd6 = Server6(("::1", PORT), Handler)
            threading.Thread(target=httpd6.serve_forever, daemon=True).start()
        except OSError:
            pass
    except OSError:
        print(f"Port {PORT} kullaniliyor; sunucu zaten acik olabilir.")
        if CLIENT and "--open" in ARGV:
            webbrowser.open(url)
        return
    print("=" * 60)
    print(f"  SILKROAD: CONVOY WARS  -  cok oyunculu sunucu {VERSION}")
    print(f"  Bu bilgisayardan: {url}")
    if CLIENT:
        print(f"  Oyun da sunuluyor: {CLIENT}")
    if LAN:
        for ip in lan_addresses():
            print(f"  Yerel ag: http://{ip}:{PORT}/   (arkadaslarin Sunucu adresi kutusuna bunu yazsin)")
        print("  Windows guvenlik duvari sorarsa 'Ozel aglar' icin izin verin.")
    if TUNNEL:
        print("  Internet tuneli aciliyor (birkac saniye)...")
        start_tunnel()
    print("  Kapatmak icin Ctrl+C")
    print("=" * 60)
    if CLIENT and "--open" in ARGV:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
