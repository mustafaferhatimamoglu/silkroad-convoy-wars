"""Dunya sablonu: orijinal Silkroad haritasindan KABA yerlesim (yalnizca bu bilgisayarda calisir).

Orijinal harita verisi (V4'un PK2'den urettigi assets/map, git disi) okunur; oyuna giden yalnizca
kaba ozet olur: 16 m izgarada yumusatilmis yukseklik, 8 m izgarada zemin sinifi (kum, toprak,
cimen, kaya, kar, tas doseme...), 32 m bloklarda su seviyesi ve nesne yerlesimi (tur + konum +
boyut: sur, kapi, kule, ev, agac...). Hicbir orijinal dosya (doku, model, yukseklik verisinin
kendisi) pakete girmez; ayrinti (2 m arazi, dokular, modeller) oyunda bizim ureticimizle olusur.

  python tools/gen/blueprint.py            -> content/world/ (blueprint.json + *.dat gzip)
  python tools/gen/blueprint.py --preview  -> ayrica tools/gen/out/bp_*.png onizlemeleri

Kaynak klasoru: SRO_MAP ortam degiskeni (varsayilan C:/Silkroad/Silkroad_V4/assets/map).
"""
import gzip
import json
import math
import os
import re
import struct
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.environ.get('SRO_MAP', 'C:/Silkroad/Silkroad_V4/assets/map')
OUT = os.path.join(ROOT, 'content', 'world')
PREV = os.path.join(ROOT, 'tools', 'gen', 'out')

# ana dunya (sagdaki ozel alanlar haric)
RX0, RX1, RZ0, RZ1 = 30, 180, 35, 127
H_RES = 16          # m, yukseklik izgarasi
G_RES = 8           # m, zemin sinifi izgarasi
HN = 192 // H_RES   # bolge basina 12
GN = 192 // G_RES   # bolge basina 24
VOID_H = -32768

# zemin siniflari (oyundaki doku adlariyla ayni sira: GenData eslestirir)
CLASSES = ['void', 'sand', 'dirt', 'gravel', 'grass', 'steppe', 'forest', 'rock', 'redrock', 'snow', 'mud', 'paving', 'cobble', 'farmland']
C = {n: i for i, n in enumerate(CLASSES)}


def classify(name, flags, color):
    n = name.lower()
    r, g, b = color
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    if re.search(r'marble|tile|city|floor|brick|_road|pha_road|wood', n):
        return C['paving'] if lum > 95 else C['cobble']
    # sehir dosemeleri (Konstantiniyye, Iskenderiye, Semerkant tas meydanlari)
    if re.search(r'(const|alex|samar|jang|dunh)\w*stone|godgarden_stone', n):
        return C['cobble'] if 'const' in n else C['paving'] if lum > 95 else C['cobble']
    if flags == 9 or re.search(r'snow|_ice|wreck_ice', n):
        return C['snow']
    if flags in (6, 7) or re.search(r'water|swmp', n):
        return C['mud']
    if flags == 10 or 'grass' in n:
        if r > g * 1.02:
            return C['steppe']
        return C['forest'] if lum < 55 else C['grass']
    if flags == 3 or re.search(r'rock|_rok|cliff', n):
        return C['redrock'] if (r > g * 1.22 and r > b * 1.5) else C['rock']
    if flags == 1 or 'sand' in n or 'salt' in n:
        return C['sand']
    if 'stone' in n and lum < 110:
        return C['gravel']
    if 'fld' in n and g > r * 0.95 and lum < 90:
        return C['farmland']
    if lum > 125 and r > b * 1.25:
        return C['sand']
    if r > g * 1.3 and r > b * 1.7 and re.search(r'canyon|petra_stone|cliff', n):
        return C['redrock']
    return C['dirt']                                             # kizil tozlu tarla/toprak da toprak


def read_region(key):
    p = os.path.join(SRC, 'regions', f'{key}.bin')
    if not os.path.exists(p):
        return None
    d = open(p, 'rb').read()
    h = np.frombuffer(d, np.float32, 9409, 32).reshape(97, 97)
    t = np.frombuffer(d, np.uint16, 9409, 37668).reshape(97, 97)
    wt = np.frombuffer(d, np.uint8, 36, 84328).reshape(6, 6)
    wh = np.frombuffer(d, np.float32, 36, 84364).reshape(6, 6)
    return h, t, wt, wh


def main():
    world = json.load(open(os.path.join(SRC, 'world.json')))
    tiles = json.load(open(os.path.join(SRC, 'textures', 'tiles.json')))
    tclass = np.zeros(1024, np.uint8)
    tcol = np.zeros((1024, 3), np.float32)
    for k, v in tiles.items():
        tclass[int(k)] = classify(os.path.splitext(v['source'])[0], v['flags'], v['color'])
        tcol[int(k)] = v['color'][:3]
    W, H = (RX1 - RX0 + 1), (RZ1 - RZ0 + 1)
    hgt = np.full((H * HN, W * HN), np.nan, np.float32)            # [z][x], z guneyden kuzeye
    gnd = np.zeros((H * GN, W * GN), np.uint8)
    wat = np.full((H * 6, W * 6), VOID_H, np.int16)
    col = np.zeros((H * HN, W * HN, 3), np.uint8)                   # 16 m ortalama zemin rengi (sRGB)
    have = 0
    for r in world['regions']:
        if r.get('isDungeon') or not (RX0 <= r['x'] <= RX1 and RZ0 <= r['z'] <= RZ1):
            continue
        d = read_region(r['key'])
        if d is None:
            continue
        have += 1
        h, t, wt, wh = d
        hm = h * 0.1                                                  # metre
        ix, iz = r['x'] - RX0, r['z'] - RZ0
        # 16 m: 8x8 hucre ortalamasi; 8 m: 4x4 hucre cogunluk sinifi
        hgt[iz * HN:(iz + 1) * HN, ix * HN:(ix + 1) * HN] = hm[:96, :96].reshape(HN, 8, HN, 8).mean(axis=(1, 3))
        col[iz * HN:(iz + 1) * HN, ix * HN:(ix + 1) * HN] = np.clip(tcol[t[:96, :96] & 0x3ff].reshape(HN, 8, HN, 8, 3).mean(axis=(1, 3)), 0, 255).astype(np.uint8)
        cls = tclass[t[:96, :96] & 0x3ff]
        oh = np.eye(len(CLASSES), dtype=np.uint8)[cls].reshape(GN, 4, GN, 4, len(CLASSES)).sum(axis=(1, 3))
        gnd[iz * GN:(iz + 1) * GN, ix * GN:(ix + 1) * GN] = oh.argmax(axis=2)
        for a in range(6):
            for b in range(6):
                if wt[a, b] != 255:
                    wat[iz * 6 + a, ix * 6 + b] = int(round(wh[a, b] * 0.1 * 10))   # dm
    print(f'bolge {have}, izgara {hgt.shape}, zemin {gnd.shape}')
    # kaba: 1 ornekli yumusatma (bos alanlara tasmadan)
    m = ~np.isnan(hgt)
    hz = np.where(m, hgt, 0.0)
    k = np.array([1, 2, 1], np.float32)
    def blur(a):
        a = np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 0, a)
        return np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 1, a)
    num, den = blur(hz), blur(m.astype(np.float32))
    smooth = np.where(m, num / np.maximum(den, 1e-6), np.nan)
    hq = np.where(m, np.clip(np.round(smooth * 10), -32000, 32000), VOID_H).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    for name, arr in (('heights', hq), ('ground', gnd), ('water', wat), ('color', col)):
        open(os.path.join(OUT, f'{name}.dat'), 'wb').write(gzip.compress(arr.tobytes(), 9, mtime=0))
    meta = {
        'format': 'silkroad-v5-blueprint', 'version': 1,
        'note': 'Orijinal haritanin kaba ozeti (tools/gen/blueprint.py). Satir-major [z][x], z guneyden kuzeye.',
        'regionM': 192, 'rx0': RX0, 'rx1': RX1, 'rz0': RZ0, 'rz1': RZ1,
        'heights': {'file': 'heights.dat', 'res': H_RES, 'w': W * HN, 'h': H * HN, 'type': 'int16', 'unit': 'dm', 'void': VOID_H},
        'ground': {'file': 'ground.dat', 'res': G_RES, 'w': W * GN, 'h': H * GN, 'type': 'uint8', 'classes': CLASSES},
        'water': {'file': 'water.dat', 'res': 32, 'w': W * 6, 'h': H * 6, 'type': 'int16', 'unit': 'dm', 'none': VOID_H},
        'color': {'file': 'color.dat', 'res': H_RES, 'w': W * HN, 'h': H * HN, 'type': 'uint8x3', 'note': 'zemin ortalama rengi'},
    }
    json.dump(meta, open(os.path.join(OUT, 'blueprint.json'), 'w'), indent=1)
    for name in ('heights', 'ground', 'water', 'color'):
        print(name, os.path.getsize(os.path.join(OUT, f'{name}.dat')) // 1024, 'KB')
    if '--preview' in sys.argv:
        preview(hq, gnd, wat)


PALETTE = {
    'void': (0, 0, 0), 'sand': (222, 196, 140), 'dirt': (140, 112, 76), 'gravel': (150, 146, 136), 'grass': (92, 128, 56),
    'steppe': (164, 150, 92), 'forest': (54, 84, 40), 'rock': (120, 116, 110), 'redrock': (168, 92, 60), 'snow': (240, 244, 250),
    'mud': (90, 80, 60), 'paving': (200, 196, 186), 'cobble': (150, 144, 134), 'farmland': (120, 110, 50),
}


def preview(hq, gnd, wat):
    from PIL import Image
    os.makedirs(PREV, exist_ok=True)
    pal = np.array([PALETTE[c] for c in CLASSES], np.uint8)
    img = pal[gnd][::-1]
    Image.fromarray(img).save(os.path.join(PREV, 'bp_ground.png'))
    h = hq.astype(np.float32) / 10
    v = hq != VOID_H
    lo, hi = np.percentile(h[v], 1), np.percentile(h[v], 99)
    g = np.where(v, np.clip((h - lo) / (hi - lo) * 255, 0, 255), 0).astype(np.uint8)[::-1]
    # tepe golgesi
    hx = np.zeros_like(h); hx[:, 1:-1] = h[:, 2:] - h[:, :-2]
    hz2 = np.zeros_like(h); hz2[1:-1, :] = h[2:, :] - h[:-2, :]
    shade = np.clip(1 + (-hx + hz2) / (2 * H_RES) * 1.2, 0.4, 1.5)[::-1]
    col = np.repeat(np.repeat(pal[gnd], 1, 0), 1, 1)[::2, ::2][::-1].astype(np.float32)
    col = col[:shade.shape[0], :shade.shape[1]] * shade[..., None]
    w = (wat != VOID_H)
    wi = np.kron(w, np.ones((2, 2), bool))[::-1][:col.shape[0], :col.shape[1]]
    col[wi] = col[wi] * 0.3 + np.array([40, 90, 150]) * 0.7
    Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(PREV, 'bp_shaded.png'))
    Image.fromarray(g).save(os.path.join(PREV, 'bp_height.png'))
    print('onizleme:', PREV)


if __name__ == '__main__' and '--objects' not in sys.argv:
    main()


# ---------------------------------------------------------------- nesneler

MODELS = os.environ.get('SRO_MODELS', os.path.join(os.path.dirname(SRC), 'models'))

CULTURES = [('china', 'china'), ('oasis', 'desert'), ('north africa', 'egypt'), ('arabia', 'persian'), ('west asia', 'persian'),
            ('central asia', 'persian'), ('asia minor', 'byzantine'), ('europe', 'byzantine'), ('guild', 'china'), ('ruins', 'ruin')]

# ad -> tur (sira onemli: ilk eslesen)
KINDS = [
    ('nature', [('grass', r'weed|grs|grass|herbage|flower|reed|barley|wheat|plant|lotus|lily'), ('bush', r'smalltree|bush|branch|shrub|cactus'),
                ('palm', r'palm|tropical|date'), ('pine', r'pine|fir|kara_tree|snow.*tree|needle'), ('bamboo', r'bamboo'),
                ('willow', r'willow|sadtree'), ('tree', r'tree|longtree|oak|poplar|cypress'), ('rock', r'rock|stone|cliff|crag')]),
    ('struct', [('wall', r'wall|castle_w|_sung|seong'), ('gate', r'gate|_mun\b|door'), ('tower', r'tower|_tw|top\d|pagoda|tap\d'),
                ('bridge', r'bridge'), ('ship', r'ship|boat|ferry_(?!buil|ware)'), ('tent', r'tent'), ('fence', r'fence|rail|barrier'),
                ('well', r'well'), ('lamp', r'lamp|light|torch|lantern'), ('flag', r'flag|banner'), ('statue', r'statue|buddha|sculpt'),
                ('stair', r'stair|step'), ('house', r'.*')]),
]
KIND_LIST = ['grass', 'bush', 'palm', 'pine', 'bamboo', 'willow', 'tree', 'rock', 'wall', 'gate', 'tower', 'bridge', 'ship', 'tent',
             'fence', 'well', 'lamp', 'flag', 'statue', 'stair', 'house', 'prop']


def model_kind(path):
    p = path.lower()
    name = os.path.splitext(os.path.basename(p))[0]
    culture = next((c for k, c in CULTURES if k in p), 'common')
    group = 'nature' if '/nature/' in p else 'struct'
    if group == 'struct' and '/artifact/' in p:
        kind = 'prop'
        for k, rx in KINDS[1][1]:
            if k in ('lamp', 'flag', 'statue', 'well', 'fence') and re.search(rx, name):
                kind = k
                break
        return kind, culture
    for k, rx in KINDS[0 if group == 'nature' else 1][1]:
        if re.search(rx, name):
            return k, culture
    return ('tree' if group == 'nature' else 'house'), culture


def model_bbox(mid):
    """V4'un donusturdugu modelin sinir kutusu (metre, Three yerel ekseni) ya da None."""
    p = os.path.join(MODELS, 'models', f'{mid}.json')
    if not os.path.exists(p):
        return None
    d = json.load(open(p))
    lo, hi = np.full(3, np.inf), np.full(3, -np.inf)
    for m in d.get('meshes', []):
        gp = os.path.join(MODELS, 'geometry', os.path.basename(m['geom']))
        if not os.path.exists(gp):
            continue
        g = json.load(open(gp))
        a = np.asarray(g['data']['attributes']['position']['array'], np.float32).reshape(-1, 3)
        if len(a):
            lo = np.minimum(lo, a.min(0)); hi = np.maximum(hi, a.max(0))
    if not np.isfinite(lo).all():
        return None
    return [round(float(v) * 0.1, 2) for v in (*lo, *hi)]


def extract_objects():
    world = json.load(open(os.path.join(SRC, 'world.json')))
    paths = json.load(open(os.path.join(SRC, 'objects', 'models.json')))
    cache_p = os.path.join(PREV, 'model_bbox.json')
    cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
    table, index = [], {}
    regions = {}
    count = 0
    for r in world['regions']:
        if r.get('isDungeon') or not (RX0 <= r['x'] <= RX1 and RZ0 <= r['z'] <= RZ1) or not r.get('objects'):
            continue
        o = json.load(open(os.path.join(SRC, 'objects', f"{r['key']}.json")))
        out = []
        for mid, x, y, z, yaw, _uid, _st in o['objects']:
            mid = str(mid)
            if mid not in index:
                if mid not in cache:
                    cache[mid] = model_bbox(mid)
                bb = cache[mid]
                kind, culture = model_kind(paths.get(mid, {}).get('path', ''))
                if bb is None:
                    index[mid] = -1
                    continue
                index[mid] = len(table)
                name = os.path.splitext(os.path.basename(paths[mid]['path']))[0]
                table.append([KIND_LIST.index(kind), culture, *bb, name])
            k = index[mid]
            if k < 0:
                continue
            X = r['x'] * 192 + x * 0.1
            Z = r['z'] * 192 + z * 0.1
            out.append([k, round(X, 2), round(Z, 2), round(y * 0.1, 2), round(yaw, 4)])
            count += 1
        if out:
            regions[f"{r['x']},{r['z']}"] = out
    os.makedirs(PREV, exist_ok=True)
    json.dump(cache, open(cache_p, 'w'))
    data = {'kinds': KIND_LIST, 'fields': ['kind', 'culture', 'x0', 'y0', 'z0', 'x1', 'y1', 'z1', 'name'],
            'models': table, 'objects': ['model', 'X', 'Z', 'Y', 'yaw'], 'regions': regions}
    raw = json.dumps(data, separators=(',', ':')).encode('utf-8')
    open(os.path.join(OUT, 'objects.dat'), 'wb').write(gzip.compress(raw, 9))
    import collections
    kc = collections.Counter()
    for lst in regions.values():
        for ob in lst:
            kc[KIND_LIST[table[ob[0]][0]]] += 1
    print(f'nesne {count}, model {len(table)}, objects.dat {os.path.getsize(os.path.join(OUT, "objects.dat")) // 1024} KB')
    print(kc.most_common())


if __name__ == '__main__' and '--objects' in sys.argv:
    extract_objects()
