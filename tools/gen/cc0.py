"""CC0 malzemelerden oyun dokulari (ambientCG, Poly Haven - CC0, ticari kullanim serbest).

Indirilen 2K zip'lerden (renk, normal GL, puruzluluk, ortam gölgesi, saydamlik):
  content/textures/<anahtar>.jpg        renk (AO islenmis), 1024 px
  content/textures/<anahtar>_nr.webp    normal (RGB) + puruzluluk (A), 1024 px
  content/textures/<anahtar>.png        yapraklar: renk + saydamlik
Kultur turevleri (kerpic, okra siva, yesil sirli kiremit, lake ahsap, mozaik...) renk tonlamasiyla.
Ardindan: content/textures/terrain.json, pbr.json (normali olan anahtarlar), gray/* (siluet
yapilari icin gri tonlu kopyalar) ve avg.json (ortalama renkler).

  python -I tools/gen/cc0.py <indirme klasoru> [--hdri <dosya.hdr>]
"""
import io
import json
import os
import sys
import zipfile

from PIL import Image, ImageChops, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, 'content', 'textures')
SIZE = 1024

# anahtar -> (kaynak, renk tonu (r,g,b) ya da None, ton gucu)
MAP = {
    # zemin
    'terrain/sand': ('Ground096B', None, 0),
    'terrain/dirt': ('Ground109', None, 0),
    'terrain/gravel': ('Gravel040', None, 0),
    'terrain/grass': ('Grass004', None, 0),
    'terrain/steppe': ('Grass004', (176, 160, 96), 0.75),
    'terrain/rock': ('Rock030', None, 0),
    'terrain/redrock': ('Rock029', None, 0),
    'terrain/snow': ('Snow010A', None, 0),
    'terrain/mud': ('Ground036', None, 0),
    'terrain/cobble': ('PavingStones141', None, 0),
    'terrain/paving': ('PavingStones128', None, 0),
    'terrain/farmland': ('Ground037', None, 0),
    'terrain/road': ('Ground102', None, 0),
    # yapi
    'build/plaster_white': ('Plaster003', (226, 222, 210), 0.7),
    'build/plaster_adobe': ('Plaster003', (206, 168, 122), 0.85),
    'build/plaster_ochre': ('Plaster003', (204, 156, 92), 0.85),
    'build/sandstone_blocks': ('Bricks083', None, 0),
    'build/stone_wall': ('Bricks066', None, 0),
    'build/brick_red': ('Bricks102', None, 0),
    'build/marble': ('Travertine009', None, 0),
    'build/roof_red': ('RoofingTiles013A', None, 0),
    'build/roof_grey': ('RoofingTiles015A', None, 0),
    'build/roof_green': ('RoofingTiles015A', (74, 118, 104), 0.8),
    'build/wood_planks': ('Planks037A', None, 0),
    'build/wood_lacquer': ('Planks037A', (150, 44, 34), 0.8),
    'build/mosaic_blue': ('Tiles131', (52, 92, 170), 0.7),
    'build/mosaic_turquoise': ('Tiles131', (60, 160, 160), 0.7),
    'build/copper_patina': ('Travertine009', (92, 150, 130), 0.85),
    'build/bark': ('Bark012', None, 0),
    'build/bark_palm': ('Bark012', (150, 124, 92), 0.6),
}
LEAVES = {'build/leaf_broad': 'LeafSet024', 'build/leaf_pine': 'LeafSet019'}
# zemin karolari: id sirasi eski terrain.json ile ayni (GenData adla esler), yuzey bayragi, olcek ussu
TERRAIN = [('sand', 1, 1), ('dirt', 0, 1), ('gravel', 0, 1), ('grass', 10, 1), ('steppe', 10, 1), ('rock', 3, 2), ('redrock', 3, 2),
           ('snow', 9, 1), ('mud', 6, 1), ('cobble', 100, 1), ('paving', 100, 1), ('farmland', 0, 1), ('road', 0, 1)]


def read(z, suffix):
    for n in z.namelist():
        if n.endswith(suffix):
            return Image.open(io.BytesIO(z.read(n)))
    return None


def tint(img, color, k):
    if not color or k <= 0:
        return img
    lum = ImageOps.grayscale(img)
    m = sum(lum.resize((64, 64)).getdata()) / 4096 or 1
    ch = [lum.point(lambda v, c=c: max(0, min(255, int(v / m * c)))) for c in color]
    toned = Image.merge('RGB', ch)
    return Image.blend(img, toned, k)


def material(dl, key, src, color, k):
    z = zipfile.ZipFile(os.path.join(dl, f'{src}_2K-JPG.zip'))
    col = read(z, '_Color.jpg').convert('RGB')
    ao = read(z, '_AmbientOcclusion.jpg')
    if ao is not None:
        ao = ao.convert('L').resize(col.size)
        col = ImageChops.multiply(col, Image.merge('RGB', [ao.point(lambda v: int(255 - (255 - v) * 0.6))] * 3))
    col = tint(col, color, k).resize((SIZE, SIZE), Image.LANCZOS)
    out = os.path.join(TEX, key + '.jpg')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    col.save(out, quality=88)
    nrm = read(z, '_NormalGL.jpg').convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
    rough = read(z, '_Roughness.jpg')
    rough = rough.convert('L').resize((SIZE, SIZE), Image.LANCZOS) if rough is not None else Image.new('L', (SIZE, SIZE), 216)
    Image.merge('RGBA', (*nrm.split(), rough)).save(os.path.join(TEX, key + '_nr.webp'), quality=90, method=4)


def sprites(rgba):
    """Atlastaki ayri yapraklari (saydam olmayan bilesenler) kirp."""
    a = rgba.split()[3].point(lambda v: 255 if v > 40 else 0)
    w, h = a.size
    seen = bytearray(w * h)
    px = a.load()
    out = []
    step = 6
    for y0 in range(0, h, step):
        for x0 in range(0, w, step):
            if px[x0, y0] == 0 or seen[y0 * w + x0]:
                continue
            # kaba tasma doldurma (adimli) ile sinir kutusu
            stack = [(x0, y0)]; x1 = xa = x0; y1 = ya = y0
            while stack:
                x, y = stack.pop()
                if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x] or px[x, y] == 0:
                    continue
                seen[y * w + x] = 1
                xa, ya, x1, y1 = min(xa, x), min(ya, y), max(x1, x), max(y1, y)
                stack += [(x + step, y), (x - step, y), (x, y + step), (x, y - step)]
            if (x1 - xa) > 40 and (y1 - ya) > 40:
                out.append(rgba.crop((max(0, xa - step), max(0, ya - step), min(w, x1 + step), min(h, y1 + step))))
    return out


def leaves(dl, key, src, count, leaf_px):
    """Yaprak kumesi dokusu: atlastaki yapraklardan rastgele dondurulmus, kucultulmus, yogun bir
    kume (agac kartlari icin; tek yaprak dev gorunmesin)."""
    import random
    rnd = random.Random(7)
    z = zipfile.ZipFile(os.path.join(dl, f'{src}_2K-JPG.zip'))
    col = read(z, '_Color.jpg').convert('RGB')
    op = read(z, '_Opacity.jpg').convert('L').resize(col.size)
    atlas = Image.merge('RGBA', (*col.split(), op))
    parts = sprites(atlas)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    cx = cy = SIZE / 2
    for k in range(count):
        sp = rnd.choice(parts)
        sc = leaf_px * (0.7 + rnd.random() * 0.6) / max(sp.size)
        im = sp.resize((max(2, int(sp.size[0] * sc)), max(2, int(sp.size[1] * sc))), Image.LANCZOS).rotate(rnd.random() * 360, expand=True, resample=Image.BICUBIC)
        # dairesel kume: merkeze yogun, kenara seyrek; gölgede kalanlar koyu
        r = (rnd.random() ** 0.6) * SIZE * 0.44
        a = rnd.random() * 6.2832
        import math
        x, y = cx + math.cos(a) * r - im.size[0] / 2, cy + math.sin(a) * r - im.size[1] / 2
        shade = 0.62 + 0.38 * (1 - r / (SIZE * 0.44)) * (0.6 + 0.4 * rnd.random())
        rgb = im.convert('RGB').point(lambda v, s=shade: int(v * s))
        im = Image.merge('RGBA', (*rgb.split(), im.split()[3]))
        canvas.alpha_composite(im, (int(x), int(y)))
    canvas.save(os.path.join(TEX, key + '.png'), optimize=True)


def avg_color(path):
    im = Image.open(path).convert('RGBA').resize((32, 32))
    px = [q for q in im.getdata() if q[3] > 128] or list(im.getdata())
    return [int(sum(q[i] for q in px) / len(px)) for i in range(3)]


def main():
    dl = sys.argv[1]
    pbr = {}
    for key, (src, color, k) in MAP.items():
        material(dl, key, src, color, k)
        pbr[key] = True
        print('malzeme', key)
    leaves(dl, 'build/leaf_broad', 'LeafSet024', 420, 92)
    leaves(dl, 'build/leaf_pine', 'LeafSet019', 260, 150)
    for k in ('build/leaf_broad', 'build/leaf_pine'):
        nr = os.path.join(TEX, k + '_nr.webp')
        if os.path.exists(nr):
            os.remove(nr)
    print('yaprak kumeleri')
    json.dump(pbr, open(os.path.join(TEX, 'pbr.json'), 'w'), indent=0)
    # zemin listesi
    meta = []
    for i, (name, surface, scale) in enumerate(TERRAIN):
        meta.append({'id': i, 'name': name, 'file': f'terrain/{name}.jpg', 'surface': surface, 'scale': scale,
                     'color': avg_color(os.path.join(TEX, 'terrain', name + '.jpg'))})
    json.dump(meta, open(os.path.join(TEX, 'terrain.json'), 'w'), indent=1)
    # gri tonlu kopyalar (siluet yapilari: desen dokudan, renk orijinal ortalamadan) + ortalama renkler
    avg = {}
    gdir = os.path.join(TEX, 'gray')
    os.makedirs(gdir, exist_ok=True)
    for d in ('build', 'terrain'):
        for f in sorted(os.listdir(os.path.join(TEX, d))):
            p = os.path.join(TEX, d, f)
            if not f.endswith(('.jpg', '.png')) or f.endswith('_nr.webp'):
                continue
            avg[f'{d}/{os.path.splitext(f)[0]}'] = avg_color(p)
            if not f.endswith('.jpg'):
                continue
            g = ImageOps.grayscale(Image.open(p))
            m = sum(g.resize((64, 64)).getdata()) / 4096 or 1
            g = g.point(lambda v, m=m: max(0, min(255, int(v * 158 / m))))
            name = f'{d}_{f}'
            g.convert('RGB').resize((512, 512), Image.LANCZOS).save(os.path.join(gdir, name), quality=88)
            avg[f'gray/{os.path.splitext(name)[0]}'] = avg_color(os.path.join(gdir, name))
            # gri kopyanin normali: kaynagin normali
            src_nr = os.path.join(TEX, d, os.path.splitext(f)[0] + '_nr.webp')
            if os.path.exists(src_nr):
                pbr[f'gray/{os.path.splitext(name)[0]}'] = f'{d}/{os.path.splitext(f)[0]}'
    json.dump(pbr, open(os.path.join(TEX, 'pbr.json'), 'w'), indent=0)
    json.dump(avg, open(os.path.join(TEX, 'avg.json'), 'w'), indent=0)
    if '--hdri' in sys.argv:
        import shutil
        h = sys.argv[sys.argv.index('--hdri') + 1]
        os.makedirs(os.path.join(TEX, 'sky'), exist_ok=True)
        shutil.copy(h, os.path.join(TEX, 'sky', 'sky_2k.hdr'))
    print('tamam:', len(pbr), 'normalli anahtar')


if __name__ == '__main__':
    main()
