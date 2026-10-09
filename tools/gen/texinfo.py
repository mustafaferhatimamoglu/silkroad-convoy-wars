"""Yapi dokularinin KABA bilgisi (yalnizca bu bilgisayarda): ortalama renk + malzeme turu.

Orijinal dokular (V4'un donusturdugu assets/models/textures, git disi) yalnizca okunur; oyuna
giden tek sey her dokunun ortalama rengi ve ad/renkten tahmin edilen turudur (cati kiremidi,
siva, tas, ahsap, metal/altin, cimen, dosemeli zemin...). Oyun kendi dokularini bu renkle boyar.

  python tools/gen/texinfo.py   -> tools/gen/out/tex_info.json
"""
import json
import os
import re

from PIL import Image

MODELS = os.environ.get('SRO_MODELS', 'C:/Silkroad/Silkroad_V4/assets/models')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'tex_info.json')
CLASSES = ['plaster', 'stone', 'brick', 'wood', 'roof', 'metal', 'grass', 'paving', 'marble', 'cloth', 'water', 'glass']


def classify(name, rgb):
    n = name.lower()
    r, g, b = rgb
    sat = max(rgb) - min(rgb)
    if re.search(r'water|wtr', n): return 'water'
    if re.search(r'grass|lawn|garden|leaf|bush|tree|turf', n) or (g > r * 1.15 and g > b * 1.15): return 'grass'
    if re.search(r'roof|jibung|giwa|kiwa|tile_r|_ru\d|dome|ji_', n): return 'roof'
    if re.search(r'gold|metal|iron|copper|bronze|bell', n): return 'metal'
    if re.search(r'glass|window_g', n): return 'glass'
    if re.search(r'cloth|fabric|tent|flag|curtain|carpet|banner', n): return 'cloth'
    if re.search(r'wood|namu|gidung|pillar|column|door|board|plank|log|beam|nangan', n): return 'wood'
    if re.search(r'brick|byuk_b|bk\d', n): return 'brick'
    if re.search(r'marble|daeri', n): return 'marble'
    if re.search(r'floor|badak|bottom|ground|road|pave|tile|stair|gyedan|step', n): return 'paving'
    if re.search(r'stone|rock|dol|wall|byuk|castle|seong|fort|block', n): return 'stone'
    return 'plaster'


def main():
    tdir = os.path.join(MODELS, 'textures')
    info = {}
    for f in sorted(os.listdir(tdir)):
        p = os.path.join(tdir, f)
        try:
            im = Image.open(p).convert('RGBA').resize((32, 32))
        except Exception:
            continue
        px = [q for q in im.get_flattened_data() if q[3] > 128] or list(im.get_flattened_data())
        rgb = tuple(int(sum(q[i] for q in px) / len(px)) for i in range(3))
        info[f.lower()] = [CLASSES.index(classify(os.path.splitext(f)[0], rgb)), *rgb]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'classes': CLASSES, 'tex': info}, open(OUT, 'w'))
    # ucgen basina renk ornegi icin 32x32 kucuk kopyalar (yalnizca yerel arac; oyuna girmez)
    names = sorted(info)
    blob = bytearray()
    index = {}
    for f in names:
        try:
            im = Image.open(os.path.join(tdir, f)).convert('RGB').resize((32, 32), Image.BILINEAR)
        except Exception:
            continue
        index[f] = len(blob) // 3072
        blob += im.tobytes()
    open(os.path.join(os.path.dirname(OUT), 'tex_small.bin'), 'wb').write(bytes(blob))
    json.dump(index, open(os.path.join(os.path.dirname(OUT), 'tex_small.json'), 'w'))
    import collections
    print(len(info), collections.Counter(CLASSES[v[0]] for v in info.values()).most_common())


if __name__ == '__main__':
    main()
