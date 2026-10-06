"""Silkroad V4 yerel oyun sunucusu.

Statik dosyalari cok is parcacikli olarak sunar. ES modulleri icin dogru MIME
turlerini zorlar (Windows kayit defteri .js dosyalarini bazen text/plain verir)
ve buyuk oyun varliklarini (assets/) tarayici onbellegine birakir.

Cok oyunculu: /ws adresinde WebSocket (yalnizca standart kutuphane) ile oda sistemi.
Sunucu oyun mantigi calistirmaz; odadaki oyuncular arasinda mesaj aktarir (yaris
durumu her oyuncunun kendi tarayicisinda, botlar oda kurucusunda simule edilir).

Kullanim:  python server.py [port] [--lan] [--no-browser]
  --lan   yerel agdaki diger bilgisayarlar baglanabilsin (0.0.0.0 dinlenir)
"""
import base64
import hashlib
import http.server
import json
import mimetypes
import os
import random
import socket
import socketserver
import struct
import sys
import threading
import time
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
PORT = int(ARGS[0]) if ARGS else 5070
LAN = "--lan" in sys.argv

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
        self.created = time.time()

    def info(self):
        return {"t": "room", "code": self.code, "host": self.host.id, "started": self.started,
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
        c.name = str(msg.get("name") or c.name)[:24]
        c.send({"t": "welcome", "id": c.id, "s": time.time() * 1000})
    elif t == "ping":
        c.send({"t": "pong", "c": msg.get("c"), "s": time.time() * 1000})
    elif t == "rooms":
        with ROOMS_LOCK:
            lst = [{"code": r.code, "host": r.host.name, "n": len(r.members), "started": r.started} for r in ROOMS.values()]
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
            if r and r.started:
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


# ---------------------------------------------------------------- HTTP

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **MIME}

    def do_GET(self):
        if self.path.startswith("/ws") and self.headers.get("Upgrade", "").lower() == "websocket":
            return self.websocket()
        if self.path.startswith("/api/info"):
            body = json.dumps({"lan": LAN, "port": PORT, "addresses": lan_addresses() if LAN else []}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

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
        sock.settimeout(None)
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
        # Oyun varliklari degismez: uzun onbellek. Kod her zaman taze yuklensin.
        if self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=86400")
        elif not self.path.startswith("/ws"):
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
    # localhost hem 127.0.0.1 hem ::1 olarak cozulebilir; LAN modunda tum IPv4 arayuzleri
    try:
        httpd = Server(("0.0.0.0" if LAN else "127.0.0.1", PORT), Handler)
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
    if LAN:
        for ip in lan_addresses():
            print(f"  Yerel ag: http://{ip}:{PORT}/   (arkadaslarin bu adrese girsin)")
        print("  Windows guvenlik duvari sorarsa 'Ozel aglar' icin izin verin.")
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
