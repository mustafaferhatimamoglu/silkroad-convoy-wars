"""Ralli parkurlarinin yukseklik profili (kaba sablonun parcasi; yalniz bu bilgisayardaki V4 verisinden).

16 m'lik sablon yuksekligi ucurum kenarlarini ve yol yarmalarini yumusatir; parkur yolu ise
orijinal yol yuzeyini izlemeli (kopru basi, kanyon tabani, sirt yolu). Her etabin yol noktalarinda
orijinal arazinin yuksekligi (2 m izgaradan bilinear, 0.1 m) content/world/trackh.json'a yazilir;
oyun parkur seridini bu profile gore duzler (src/world/gen/GenData.js).

  python -I tools/gen/trackheights.py
"""
import json
import os
import re
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blueprint import read_region  # noqa: E402

_cache = {}


def region(rx, rz):
    k = (rx, rz)
    if k not in _cache:
        r = read_region(f'{rz}_{rx}')
        _cache[k] = None if r is None else r[0] * 0.1
    return _cache[k]


def height(X, Z):
    rx, rz = int(X // 192), int(Z // 192)
    h = region(rx, rz)
    if h is None:
        return None
    fx, fz = (X - rx * 192) / 2, (Z - rz * 192) / 2
    j, i = min(int(fx), 95), min(int(fz), 95)
    tx, tz = fx - j, fz - i
    a, b, c, d = h[i, j], h[i, j + 1], h[i + 1, j], h[i + 1, j + 1]
    return float((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz)


def main():
    src = open(os.path.join(ROOT, 'src', 'data', 'rally.js'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'^  (\w+): \{', src, re.M):
        sid = m.group(1)
        body = src[m.end():]
        pm = re.search(r'path: \[(.*?)\n    \],', body, re.S)
        pts = [(float(a), float(b)) for a, b in re.findall(r'\[([\d.]+), ([\d.]+)\]', pm.group(1))]
        hs = []
        for rx, rz in pts:
            h = height(rx * 192, rz * 192)
            hs.append(round(h, 1) if h is not None else None)
        # bos noktalar komsudan
        for k in range(len(hs)):
            if hs[k] is None:
                hs[k] = next((hs[q] for q in range(k, len(hs)) if hs[q] is not None), 0.0)
        out[sid] = hs
        print(sid, len(hs), 'nokta', 'min', min(hs), 'max', max(hs))
    json.dump(out, open(os.path.join(ROOT, 'content', 'world', 'trackh.json'), 'w'), separators=(',', ':'))


if __name__ == '__main__':
    main()
