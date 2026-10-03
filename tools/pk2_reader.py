"""
Silkroad V2 - Read-Only PK2 File Reader Tool
'extracted/client/' dizinindeki orijinal PK2 arşivlerini KESİNLİKLE salt-okunur (read-only 'rb')
olarak inceler ve dizin ağacını çıkartır. Asla dosyalara yazma işlemi yapmaz.
"""
import os
import struct

class PK2ReadOnlyReader:
    def __init__(self, pk2_path):
        self.pk2_path = pk2_path
        if not os.path.exists(pk2_path):
            raise FileNotFoundError(f"PK2 arşivi bulunamadı: {pk2_path}")

    def read_header(self):
        # Yalnızca 'rb' (read-binary) modunda açılır (Read-only koruması)
        with open(self.pk2_path, "rb") as f:
            magic = f.read(30).decode(errors="ignore").strip("\x00")
            version = struct.unpack("<I", f.read(4))[0]
            is_encrypted = bool(f.read(1)[0])
        return {
            "magic": magic,
            "version": hex(version),
            "is_encrypted": is_encrypted,
            "file_size": os.path.getsize(self.pk2_path)
        }
