"""
Joymax PK2 arsiv okuyucu (Silkroad Online).

PK2 yapisi:
  - 256 byte header ("JoyMax File Manager!")
  - Dizin bloklari: 20 entry x 128 byte = 2560 byte, Blowfish ile sifreli
  - Entry: type(1) name(81) times(24) position(8) size(4) nextChain(8) pad(2)
  - Dosya verileri sifresizdir.
"""
import os
import struct
from Cryptodome.Cipher import Blowfish

HEADER_SIZE = 256
ENTRY_SIZE = 128
ENTRIES_PER_BLOCK = 20
BLOCK_SIZE = ENTRY_SIZE * ENTRIES_PER_BLOCK

DEFAULT_KEY = b"169841"
SALT = bytes([0x03, 0xF8, 0xE4, 0x44, 0x88, 0x99, 0x3F, 0x64, 0xFE, 0x35])


def _derive_key(key: bytes) -> bytes:
    return bytes(k ^ SALT[i] for i, k in enumerate(key[:len(SALT)]))


def _swap32(data: bytes) -> bytes:
    """Her 4 byte'lik kelimenin byte sirasini ters cevir (Joymax little-endian Blowfish)."""
    b = bytearray(data)
    b[0::4], b[1::4], b[2::4], b[3::4] = data[3::4], data[2::4], data[1::4], data[0::4]
    return bytes(b)


class PK2Entry:
    __slots__ = ("type", "name", "position", "size", "path")

    def __init__(self, etype, name, position, size, path):
        self.type = etype
        self.name = name
        self.position = position
        self.size = size
        self.path = path

    @property
    def is_dir(self):
        return self.type == 1

    @property
    def is_file(self):
        return self.type == 2


class PK2Archive:
    def __init__(self, path: str, key: bytes = DEFAULT_KEY):
        self.path = path
        self.f = open(path, "rb")
        header = self.f.read(HEADER_SIZE)
        self.signature = header[:30].split(b"\x00")[0].decode("ascii", "replace")
        self.version, self.encrypted = struct.unpack_from("<IB", header, 30)
        self._cipher = Blowfish.new(_derive_key(key), Blowfish.MODE_ECB) if self.encrypted else None
        self._swap = True
        if self._cipher:
            self._detect_endianness()
        self.files = {}   # path(lower) -> PK2Entry
        self.dirs = set()

    def close(self):
        self.f.close()

    # ---------------------------------------------------------------- crypto
    def _decrypt(self, data: bytes) -> bytes:
        if not self._cipher:
            return data
        if self._swap:
            return _swap32(self._cipher.decrypt(_swap32(data)))
        return self._cipher.decrypt(data)

    def _detect_endianness(self):
        self.f.seek(HEADER_SIZE)
        raw = self.f.read(BLOCK_SIZE)
        for swap in (True, False):
            self._swap = swap
            d = self._decrypt(raw[:ENTRY_SIZE])
            if d[0] == 1 and d[1:3] == b".\x00":
                return
        raise RuntimeError("PK2 kok blogu cozulemedi (yanlis anahtar?)")

    # ---------------------------------------------------------------- parsing
    def _read_block(self, offset: int):
        self.f.seek(offset)
        data = self._decrypt(self.f.read(BLOCK_SIZE))
        entries = []
        next_chain = 0
        for i in range(ENTRIES_PER_BLOCK):
            e = data[i * ENTRY_SIZE:(i + 1) * ENTRY_SIZE]
            etype = e[0]
            name = e[1:82].split(b"\x00")[0].decode("cp949", "replace")
            position, size, nchain = struct.unpack_from("<qIq", e, 106)
            if etype in (1, 2):
                entries.append((etype, name, position, size))
            if i == ENTRIES_PER_BLOCK - 1:
                next_chain = nchain
        return entries, next_chain

    def scan(self):
        """Tum dizin agacini tara."""
        stack = [(HEADER_SIZE, "")]
        visited = set()
        while stack:
            offset, prefix = stack.pop()
            while offset and offset not in visited:
                visited.add(offset)
                entries, nxt = self._read_block(offset)
                for etype, name, position, size in entries:
                    if name in (".", ".."):
                        continue
                    path = f"{prefix}{name}"
                    if etype == 1:
                        self.dirs.add(path.lower())
                        stack.append((position, path + "/"))
                    else:
                        self.files[path.lower()] = PK2Entry(etype, name, position, size, path)
                offset = nxt
        return self

    def read(self, entry_or_path) -> bytes:
        e = entry_or_path if isinstance(entry_or_path, PK2Entry) else self.files[entry_or_path.lower().replace("\\", "/")]
        self.f.seek(e.position)
        return self.f.read(e.size)

    def extract_all(self, out_dir: str, filter_fn=None, progress=None):
        n = 0
        items = sorted(self.files.values(), key=lambda x: x.position)
        for i, e in enumerate(items):
            if filter_fn and not filter_fn(e.path):
                continue
            dst = os.path.join(out_dir, *e.path.split("/"))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "wb") as w:
                w.write(self.read(e))
            n += 1
            if progress and i % 2000 == 0:
                progress(i, len(items))
        return n
