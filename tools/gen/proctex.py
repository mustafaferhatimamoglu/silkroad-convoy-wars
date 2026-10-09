"""Prosedurel yapi dokulari (tamamen bizim, lisans serbest): Cin kafes kapisi, boyali konsol bandi
(dougong), fars kemerli pencere paneli. Renk + normal/puruzluluk (_nr.webp) uretir, pbr.json ve
avg.json'a ekler.

  python -I tools/gen/proctex.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TEX = os.path.join(ROOT, 'content', 'textures')
SIZE = 512
rng = np.random.default_rng(7)


def grain(h, w, scale=1.0, streak=True):
    """Ahsap/boya dokusu: ince yatay lifler + leke."""
    n = rng.normal(0, 1, (h, w)).astype(np.float32)
    img = Image.fromarray(((n * 40 + 128).clip(0, 255)).astype(np.uint8))
    if streak:
        img = img.resize((max(1, w // 24), h), Image.BILINEAR).resize((w, h), Image.BICUBIC)
    else:
        img = img.filter(ImageFilter.GaussianBlur(2))
    return (np.asarray(img, np.float32) - 128) / 128 * scale


def save(key, col, height, rough):
    """col: HxWx3 float 0-255, height: HxW 0-1, rough: HxW 0-1 -> jpg + _nr.webp."""
    c = Image.fromarray(col.clip(0, 255).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS)
    out = os.path.join(TEX, key + '.jpg')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    c.save(out, quality=90)
    hh = np.asarray(Image.fromarray((height * 255).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
    gy, gx = np.gradient(hh * 6.0)
    nz = np.ones_like(gx)
    L = np.sqrt(gx * gx + gy * gy + nz * nz)
    # OpenGL normal: y yukari (goruntu satiri asagi artar -> -gy)
    n = np.stack([-gx / L, gy / L, nz / L], -1)
    nimg = ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)
    r = Image.fromarray((rough * 255).clip(0, 255).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS)
    Image.merge('RGBA', (*Image.fromarray(nimg).split(), r)).save(os.path.join(TEX, key + '_nr.webp'), quality=90, method=4)
    return [int(v) for v in np.asarray(c, np.float32).reshape(-1, 3).mean(0)]


def rect(a, x0, y0, x1, y1, v):
    H, W = a.shape[:2]
    a[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = v


def lattice():
    """Bir aciklik (bay): iki kanatli kafes kapi. Ust %60 kafes (kagit arkasi), orta kusak,
    alt dolu pano; kirmizi lake cerceve. Satir 0 = ust."""
    H = W = 1024
    col = np.zeros((H, W, 3), np.float32)
    hgt = np.zeros((H, W), np.float32)
    rgh = np.full((H, W), 0.85, np.float32)
    red = np.array([150, 38, 28], np.float32)
    paper = np.array([196, 168, 120], np.float32)
    dark = np.array([52, 30, 22], np.float32)
    col[:] = paper
    hgt[:] = 0.05
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W], np.float32)[:, None, None]
    # kagit: ic aydinlatma gibi hafif koyulasan kenarlar
    col *= (0.82 + 0.18 * np.sin(np.pi * ((xx * 2) % 1))[..., None])
    # kafes cubuklari (ust bolge): 14x18 izgara + capraz kose susleri
    lat = ((xx * 2 * 7) % 1 < 0.16) | ((yy / 0.6 * 11) % 1 < 0.14)
    top = yy < 0.6
    m = lat & top
    col[m] = red * 0.82
    hgt[m] = 0.55
    rgh[m] = 0.5
    # alt pano (dolu, ic cerceveli)
    bot = yy >= 0.66
    col[bot] = red * 0.9
    hgt[bot] = 0.45
    rgh[bot] = 0.45
    for lx in (0.0, 0.5):
        inner = bot & (xx > lx + 0.09) & (xx < lx + 0.41) & (yy > 0.71) & (yy < 0.93)
        edge = inner & ~((xx > lx + 0.105) & (xx < lx + 0.395) & (yy > 0.72) & (yy < 0.92))
        col[inner] = red * 0.75
        hgt[inner] = 0.35
        col[edge] = [196, 150, 60]
        hgt[edge] = 0.6
    # orta kusak ve cerceveler
    frame = (yy < 0.035) | (yy > 0.965) | (xx < 0.04) | (xx > 0.96) | ((xx > 0.48) & (xx < 0.52)) | ((yy > 0.6) & (yy < 0.66))
    col[frame] = red
    hgt[frame] = 1.0
    rgh[frame] = 0.4
    # kanat arasi derin cizgi
    gap = (xx > 0.497) & (xx < 0.503)
    col[gap] = dark
    hgt[gap] = 0.0
    g = grain(H, W, 1.0)
    col *= (1 + g[..., None] * 0.08)
    return save('build/lattice', col, hgt, rgh)


def dougong():
    """Sacak alti boyali konsol bandi: ust kiris (mavi-yesil desenli), konsol takimlari (yesil/mavi,
    altin kenar), alt kiris (mavi, ortada altin kartus). Yatay tekrar: 4 takim/doku."""
    H, W = 256, 1024
    col = np.zeros((H, W, 3), np.float32)
    hgt = np.zeros((H, W), np.float32)
    rgh = np.full((H, W), 0.55, np.float32)
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W], np.float32)[:, None, None]
    redbg = np.array([110, 32, 26], np.float32)
    green = np.array([46, 112, 92], np.float32)
    blue = np.array([42, 76, 132], np.float32)
    gold = np.array([206, 160, 66], np.float32)
    col[:] = redbg * 0.55
    hgt[:] = 0.1
    # ust kiris
    t = yy < 0.2
    col[t] = green
    hgt[t] = 0.6
    # konsol takimlari: her takim 1/4 genislik; basamakli trapezler
    u = (xx * 4) % 1
    for k, (y0, y1, half) in enumerate([(0.2, 0.32, 0.36), (0.32, 0.44, 0.28), (0.44, 0.56, 0.2), (0.56, 0.66, 0.12)]):
        m = (yy >= y0) & (yy < y1) & (np.abs(u - 0.5) < half)
        col[m] = blue if k % 2 == 0 else green
        hgt[m] = 0.9 - k * 0.08
        e = m & ((np.abs(u - 0.5) > half - 0.018) | (yy < y0 + 0.012))
        col[e] = gold
    # alt kiris
    b = yy >= 0.7
    col[b] = blue
    hgt[b] = 0.7
    # kiris uclarinda yesil kademeler, ortada altin kartus
    uu = (xx * 2) % 1
    zig = b & ((np.abs(uu - 0.5) > 0.3) & ((np.abs(uu - 0.5) * 6 + yy * 3) % 1 < 0.5))
    col[zig] = green
    cart = b & (np.abs(uu - 0.5) < 0.16) & (yy > 0.76) & (yy < 0.94)
    col[cart] = gold * 0.9
    hgt[cart] = 0.85
    for y in (0.0, 0.2, 0.7, 0.99):
        ln = (np.abs(yy - y) < 0.012)
        col[ln] = gold
        hgt[ln] = 1.0
    g = grain(H, W, 1.0, streak=False)
    col *= (1 + g[..., None] * 0.07)
    return save('build/dougong', col, hgt, rgh)


def arch_window():
    """Fars/Bizans: sivri kemerli pencere paneli (bir aciklik). Mavi cini cerceve, koyu ic."""
    H = W = 512
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W], np.float32)[:, None, None]
    col = np.zeros((H, W, 3), np.float32)
    hgt = np.zeros((H, W), np.float32)
    rgh = np.full((H, W), 0.8, np.float32)
    plaster = np.array([214, 196, 160], np.float32)
    col[:] = plaster
    hgt[:] = 0.8
    # sivri kemer: x ekseninde yari genislik 0.28; govde y 0.35..0.92, kemer 0.12..0.35
    cx = 0.5
    dx = np.abs(xx - cx)
    body = (dx < 0.28) & (yy > 0.33) & (yy < 0.9)
    # sivri kemer: iki daire yayinin kesisimi
    r = 0.42
    archm = (yy <= 0.33) & (yy > 0.06) & (((xx - (cx - 0.28 + r)) ** 2 + (yy - 0.33) ** 2) < r * r) & (((xx - (cx + 0.28 - r)) ** 2 + (yy - 0.33) ** 2) < r * r)
    hole = body | archm
    # cini cerceve: deligin biraz disi
    frame = np.zeros_like(hole)
    for s in range(1, 18):
        frame |= np.roll(hole, s, 0) | np.roll(hole, -s, 0) | np.roll(hole, s, 1) | np.roll(hole, -s, 1)
    frame &= ~hole
    col[frame] = [40, 104, 150]
    hgt[frame] = 1.0
    rgh[frame] = 0.3
    tile = frame & (((xx * 40).astype(int) + (yy * 40).astype(int)) % 2 == 0)
    col[tile] = [210, 196, 150]
    col[hole] = [34, 30, 28]
    hgt[hole] = 0.0
    # ahsap kafes (mashrabiya)
    lat = hole & (((xx * 26) % 1 < 0.18) | ((yy * 26) % 1 < 0.18))
    col[lat] = [96, 66, 40]
    hgt[lat] = 0.4
    g = grain(H, W, 1.0, streak=False)
    col *= (1 + g[..., None] * 0.06)
    return save('build/arch_window', col, hgt, rgh)


def willow():
    """Sogut sarkan dallari: ince egri dallar boyunca dar yapraklar (RGBA, ust kenardan asagi)."""
    import math
    from PIL import ImageDraw
    W2 = 1024
    img = Image.new('RGBA', (W2, W2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(11)
    for k in range(40):
        x = r.uniform(20, W2 - 20)
        y0 = r.uniform(0, W2 * 0.3)
        L = (W2 - y0) * r.uniform(0.55, 1.0)
        sway = r.uniform(-60, 60)
        base = np.array([r.uniform(78, 112), r.uniform(118, 150), r.uniform(72, 98)])
        prev = None
        n = int(L / 12)
        for i in range(n):
            t = i / n
            px = x + sway * t * t + 6 * math.sin(t * 9 + k)
            py = y0 + t * L
            if prev is not None:
                d.line([prev, (px, py)], fill=(92, 80, 52, 255), width=2)
            prev = (px, py)
            for side in (-1, 1):
                ang = side * r.uniform(0.45, 0.95)
                ll = r.uniform(20, 34) * (1 - 0.3 * t)
                ex, ey = px + math.sin(ang) * ll, py + math.cos(ang) * ll
                sh = r.uniform(0.75, 1.15) * (1.08 - 0.25 * t)
                c = tuple(int(v) for v in np.clip(base * sh, 0, 255)) + (255,)
                d.line([(px, py), (ex, ey)], fill=c, width=int(r.integers(5, 9)))
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(img).copy()
    a[..., 3] = np.where(a[..., 3] > 110, 255, 0)
    out = Image.fromarray(a)
    out.save(os.path.join(TEX, 'build', 'leaf_willow.png'), optimize=True)
    m = a[..., 3] > 0
    return [int(v) for v in a[..., :3][m].mean(0)]


def _rgba_save(key, col, alpha):
    a = np.dstack([col.clip(0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(a, 'RGBA').resize((SIZE, SIZE), Image.LANCZOS)
    arr = np.asarray(img).copy()
    arr[..., 3] = np.where(arr[..., 3] > 127, 255, 0)
    Image.fromarray(arr, 'RGBA').save(os.path.join(TEX, key + '.png'), optimize=True)
    m = arr[..., 3] > 0
    return [int(v) for v in arr[..., :3][m].mean(0)]


def win_euro():
    """Avrupa penceresi (tek pencere, dikdortgen): tas pervaz, koyu cam, beyaz kayit, alt denizlik."""
    H, W = 768, 512
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W], np.float32)[:, None, None]
    col = np.zeros((H, W, 3), np.float32)
    al = np.ones((H, W), np.float32)
    stone = np.array([214, 204, 184], np.float32)
    col[:] = stone
    glass = (xx > 0.14) & (xx < 0.86) & (yy > 0.12) & (yy < 0.84)
    col[glass] = [44, 52, 60]
    # cam yansimasi
    refl = glass & ((xx - yy * 0.5) % 0.5 < 0.08)
    col[refl] = [86, 98, 110]
    mull = glass & ((np.abs(xx - 0.5) < 0.025) | (np.abs(yy - 0.42) < 0.02))
    col[mull] = [232, 228, 218]
    sill = (yy > 0.86) & (yy < 0.94)
    col[sill] = stone * 0.82
    keyst = (yy < 0.1) & (np.abs(xx - 0.5) < 0.08)
    col[keyst] = stone * 0.88
    al[(yy > 0.94) & ((xx < 0.04) | (xx > 0.96))] = 0
    al[yy > 0.96] = 0
    n = rng.normal(0, 1, (H, W)).astype(np.float32)
    col *= (1 + n[..., None] * 0.03)
    return _rgba_save('build/win_euro', col, al)


def win_arch():
    """Sivri kemerli pencere (Fars/Arap/Misir): cini cerceve, ahsap kafes; kemer disi saydam."""
    H, W = 768, 512
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W], np.float32)[:, None, None]
    col = np.zeros((H, W, 3), np.float32)
    cx = 0.5
    r = 0.62
    outer = ((((xx - (cx - 0.5 + r)) ** 2 + ((yy - 0.36) * 0.66) ** 2) < r * r) & (((xx - (cx + 0.5 - r)) ** 2 + ((yy - 0.36) * 0.66) ** 2) < r * r)) | (yy >= 0.36)
    inner = ((((xx - (cx - 0.36 + r * 0.8)) ** 2 + ((yy - 0.4) * 0.66) ** 2) < (r * 0.8) ** 2) & (((xx - (cx + 0.36 - r * 0.8)) ** 2 + ((yy - 0.4) * 0.66) ** 2) < (r * 0.8) ** 2)) | (yy >= 0.4)
    inner &= (np.abs(xx - cx) < 0.36) & (yy < 0.92)
    outer &= (np.abs(xx - cx) < 0.5)
    col[:] = [42, 104, 150]
    tile = outer & ~inner & (((xx * 24).astype(int) + (yy * 36).astype(int)) % 2 == 0)
    col[tile] = [214, 196, 150]
    col[inner] = [30, 26, 24]
    lat = inner & (((xx * 18) % 1 < 0.2) | ((yy * 26) % 1 < 0.2))
    col[lat] = [110, 76, 46]
    sill = (yy > 0.92)
    col[sill & outer] = [190, 172, 140]
    return _rgba_save('build/win_arch', col, outer.astype(np.float32))


def win_china():
    """Cin penceresi: kirmizi cerceve, kare kafes, kagit arkasi."""
    H, W = 512, 512
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W], np.float32)[:, None, None]
    col = np.zeros((H, W, 3), np.float32)
    col[:] = [196, 168, 120]
    lat = ((xx * 9) % 1 < 0.16) | ((yy * 9) % 1 < 0.16)
    col[lat] = [120, 34, 26]
    frame = (xx < 0.08) | (xx > 0.92) | (yy < 0.08) | (yy > 0.92)
    col[frame] = [150, 40, 30]
    edge = (xx < 0.02) | (xx > 0.98) | (yy < 0.02) | (yy > 0.98)
    col[edge] = [200, 150, 60]
    return _rgba_save('build/win_china', col, np.ones((H, W), np.float32))


def main():
    avg_p, pbr_p = os.path.join(TEX, 'avg.json'), os.path.join(TEX, 'pbr.json')
    avg = json.load(open(avg_p))
    pbr = json.load(open(pbr_p))
    avg['build/leaf_willow'] = willow()
    avg['build/win_euro'] = win_euro()
    avg['build/win_arch'] = win_arch()
    avg['build/win_china'] = win_china()
    for key, fn in (('build/lattice', lattice), ('build/dougong', dougong), ('build/arch_window', arch_window)):
        avg[key] = fn()
        pbr[key] = True
        print(key, avg[key])
    json.dump(pbr, open(pbr_p, 'w'), indent=0)
    json.dump(avg, open(avg_p, 'w'), indent=0)


if __name__ == '__main__':
    main()
