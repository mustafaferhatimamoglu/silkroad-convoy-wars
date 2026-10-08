"""Surum yukseltme: istemci (src/version.js) ve sunucu (server/server.py) birlikte.

Her degisiklikte ara surum (minor) bir artar: 5.1.0 -> 5.2.0. Sunucu ve istemci surumleri
birebir ayni olmazsa sunucu baglantiyi reddeder; iki dosya hep birlikte degismelidir.

  python tools/bump.py            ara surumu yukselt (5.1.0 -> 5.2.0)
  python tools/bump.py --show     simdiki surumu yaz
  python tools/bump.py --set 5.4.0
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = [
    (os.path.join(ROOT, 'src', 'version.js'), re.compile(r"(export const VERSION = ')(\d+\.\d+\.\d+)(';)")),
    (os.path.join(ROOT, 'server', 'server.py'), re.compile(r'(^VERSION = ")(\d+\.\d+\.\d+)(")', re.M)),
]


def current():
    vers = []
    for path, rx in FILES:
        m = rx.search(open(path, encoding='utf-8').read())
        if not m:
            sys.exit(f'surum bulunamadi: {path}')
        vers.append(m.group(2))
    if len(set(vers)) != 1:
        sys.exit(f'istemci ve sunucu surumu farkli: {vers}')
    return vers[0]


def write(v):
    for path, rx in FILES:
        s = open(path, encoding='utf-8').read()
        s = rx.sub(lambda m: m.group(1) + v + m.group(3), s, count=1)
        open(path, 'w', encoding='utf-8', newline='\n').write(s)


def main():
    v = current()
    if '--show' in sys.argv:
        print(v)
        return
    if '--set' in sys.argv:
        nv = sys.argv[sys.argv.index('--set') + 1]
        if not re.fullmatch(r'\d+\.\d+\.\d+', nv):
            sys.exit('surum bicimi: 5.4.0')
    else:
        a, b, _ = (int(x) for x in v.split('.'))
        nv = f'{a}.{b + 1}.0'
    write(nv)
    print(f'{v} -> {nv}')


if __name__ == '__main__':
    main()
