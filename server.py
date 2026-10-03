import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def main():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"=====================================================================")
        print(f"   SILKROAD: CONVOY WARS - 3D ACIK DUNYA SUNUCUSU AKTIF")
        print(f"   Adres: http://localhost:{PORT}")
        print(f"   Durdurmak icin: Ctrl+C")
        print(f"=====================================================================")
        sys.stdout.flush()
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nSunucu kapatildi.")

if __name__ == "__main__":
    main()
