import http.server
import socketserver
import webbrowser
import os
import sys
import json

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class RobustHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path == "/report_err":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8', errors='replace')
            with open(os.path.join(DIRECTORY, "browser_error.log"), "a", encoding="utf-8") as f:
                f.write(post_data + "\n")
            print(f"\n[!!! BROWSER ERROR REPORTED !!!]: {post_data}\n")
            sys.stdout.flush()
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def main():
    os.chdir(DIRECTORY)
    try:
        with ReusableTCPServer(("", PORT), RobustHandler) as httpd:
            print("=" * 69)
            print(f"   SILKROAD: CONVOY WARS - 3D ACIK DUNYA SUNUCUSU AKTIF")
            print(f"   Adres: http://localhost:{PORT}")
            print(f"   Durdurmak icin: Ctrl+C")
            print("=" * 69)
            sys.stdout.flush()
            webbrowser.open(f"http://localhost:{PORT}")
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nSunucu kapatildi.")
    except OSError as e:
        print(f"[UYARI] Port {PORT} zaten baska bir sunucu tarafindan kullaniliyor. Tarayici aciliyor...")
        webbrowser.open(f"http://localhost:{PORT}")

if __name__ == "__main__":
    main()
