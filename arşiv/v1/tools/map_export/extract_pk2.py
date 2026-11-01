"""Map.pk2 icerigini oldugu gibi (ham) diske cikartir.

Kullanim:
    python extract_pk2.py <arsiv.pk2> <cikis_klasoru>
"""
import sys
import time
from pk2 import PK2Archive


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else r"C:\Silkroad\Silkroad_V2\extracted\client\Map.pk2"
    dst = sys.argv[2] if len(sys.argv) > 2 else r"C:\Silkroad\Silkroad_V2\extracted\Map_raw"
    t = time.time()
    a = PK2Archive(src).scan()
    print(f"{len(a.files)} dosya, {len(a.dirs)} klasor bulundu -> {dst}")
    n = a.extract_all(dst, progress=lambda i, total: print(f"  {i}/{total}"))
    print(f"Tamamlandi: {n} dosya, {time.time() - t:.1f} sn")


if __name__ == "__main__":
    main()
