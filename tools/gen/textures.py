"""Oyunun kendi dokulari (V5): zemin ve yapi dokulari, tamamen gurultu/geometri tabanli uretim.

  python tools/gen/textures.py            hepsini uret -> content/textures/
  python tools/gen/textures.py sand rock  yalniz adi gecenleri

Her doku kendini tekrar eder (kenarlari dikissiz): gurultu FFT ile periyodik uretilir, Voronoi
hucreleri 3x3 sarmalanmis noktalardan hesaplanir. Tohum sabit: ayni komut ayni dokuyu verir.
Cikti: content/textures/terrain/*.jpg + terrain.json (katman listesi), content/textures/build/*.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'content', 'textures')
N = 512


# ------------------------------------------------------------------ temel araclar

def rng(seed):
    return np.random.default_rng(seed)


def fbm(seed, beta=2.2, n=N, lo=1.0, hi=None, aniso=(1.0, 1.0)):
    """Periyodik gauss gurultusu (guc spektrumu ~ 1/f^beta), [0,1]. lo/hi: frekans bandi (devir/doku)."""
    r = rng(seed)
    w = r.standard_normal((n, n))
    F = np.fft.fft2(w)
    fy = np.fft.fftfreq(n)[:, None] * n * aniso[0]
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    amp = f ** (-beta / 2)
    amp[f < lo] = 0
    if hi:
        amp *= np.exp(-((f / hi) ** 4))
    out = np.real(np.fft.ifft2(F * amp))
    out -= out.min()
    out /= max(out.max(), 1e-9)
    return out


def voronoi(seed, cells, jitter=0.9, n=N):
    """Periyodik Voronoi: (F1, F2, hucre kimligi). cells: bir kenardaki hucre sayisi."""
    r = rng(seed)
    pts = (np.arange(cells)[:, None, None] * 0 + 0.5 + (r.random((cells, cells, 2)) - 0.5) * jitter)
    cs = n / cells
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    gy, gx = np.floor(ys / cs).astype(int), np.floor(xs / cs).astype(int)
    best1 = np.full((n, n), 1e9, np.float32)
    best2 = np.full((n, n), 1e9, np.float32)
    ident = np.zeros((n, n), np.int32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cy, cx = gy + dy, gx + dx
            wy, wx = cy % cells, cx % cells
            p = pts[wy, wx]
            py = (cy + p[..., 0]) * cs
            px = (cx + p[..., 1]) * cs
            d = np.sqrt((ys - py) ** 2 + (xs - px) ** 2)
            closer = d < best1
            best2 = np.where(closer, best1, np.minimum(best2, d))
            ident = np.where(closer, wy * cells + wx, ident)
            best1 = np.where(closer, d, best1)
    return best1 / cs, best2 / cs, ident


def blur(a, k=1):
    """Periyodik kutu bulaniklik (k piksel)."""
    out = a.copy()
    for _ in range(k):
        out = (out + np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 5
    return out


def grad(stops, t):
    """Renk gecisi: stops [(t, (r,g,b)), ...] -> (n,n,3) float 0..1."""
    t = np.clip(t, 0, 1)
    ts = np.array([s[0] for s in stops])
    cs = np.array([s[1] for s in stops], dtype=np.float64) / 255.0
    out = np.zeros(t.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(t, ts, cs[:, c])
    return out


def relief(h, strength=2.0, light=(-0.6, -0.7)):
    """Yukseklik alanindan hafif golgelendirme carpani (doku icine gomulu kabartma)."""
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    d = -(gx * light[0] + gy * light[1]) * strength * N / 64
    return np.clip(1.0 + d, 0.55, 1.45)


def grain(seed, amt=0.06):
    return 1.0 + (rng(seed).random((N, N)) - 0.5) * 2 * amt


def save(img, path, quality=90):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    a = np.clip(img, 0, 1)
    if a.ndim == 3 and a.shape[2] == 4:
        Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'RGBA').save(path, optimize=True)
    else:
        Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'RGB').save(path, quality=quality, optimize=True)


# ------------------------------------------------------------------ zemin

def t_sand(s):
    base = fbm(s, 2.4, lo=1)
    warp = fbm(s + 1, 2.8, lo=1) * 6.0
    ys, xs = np.mgrid[0:N, 0:N] / N
    rip = np.sin(2 * np.pi * (xs * 13 + ys * 5) + warp)          # dalga sirtlari (periyodik: tam sayi devir)
    h = base * 0.6 + rip * 0.06 + fbm(s + 2, 1.2, lo=40) * 0.08
    c = grad([(0, (176, 146, 102)), (0.45, (205, 176, 128)), (0.8, (221, 196, 151)), (1, (232, 211, 170))], base * 0.7 + 0.15 + rip * 0.05)
    return c * relief(h, 1.2)[..., None] * grain(s + 3, 0.05)[..., None]


def t_dirt(s):
    base = fbm(s, 2.2, lo=1)
    f1, f2, ident = voronoi(s + 1, 40, 0.85)
    stones = np.clip(1 - f1 / 0.32, 0, 1) ** 0.6 * (rng(s + 2).random(1600)[ident] < 0.35)
    h = base * 0.5 + stones * 0.35 + fbm(s + 3, 1.0, lo=50) * 0.1
    c = grad([(0, (92, 70, 48)), (0.5, (126, 98, 68)), (1, (152, 122, 88))], base)
    sc = grad([(0, (110, 100, 90)), (1, (160, 150, 136))], rng(s + 4).random(1600)[ident])
    c = c * (1 - stones[..., None] * 0.8) + sc * stones[..., None] * 0.8
    return c * relief(h, 1.6)[..., None] * grain(s + 5, 0.07)[..., None]


def t_gravel(s):
    f1, f2, ident = voronoi(s, 64, 0.95)
    stone = np.clip(1 - f1 / 0.55, 0, 1) ** 0.5
    edge = np.clip((f2 - f1) / 0.12, 0, 1)
    tone = rng(s + 1).random(64 * 64)[ident]
    base = fbm(s + 2, 2.0, lo=1)
    h = stone * edge * 0.8 + base * 0.2
    c = grad([(0, (96, 88, 78)), (0.5, (138, 128, 114)), (1, (176, 166, 150))], tone * 0.7 + base * 0.3)
    c *= (0.55 + 0.45 * edge)[..., None]
    return c * relief(h, 1.4)[..., None] * grain(s + 3, 0.05)[..., None]


def t_grass(s):
    base = fbm(s, 2.3, lo=1)
    patches = fbm(s + 1, 3.0, lo=1)
    blades = fbm(s + 2, 1.4, lo=30, aniso=(0.35, 1.0))            # dikine uzamis ince cizgiler
    t = base * 0.5 + blades * 0.5
    c = grad([(0, (44, 70, 26)), (0.45, (72, 104, 38)), (0.75, (98, 128, 52)), (1, (130, 150, 70))], t)
    dry = np.clip((patches - 0.62) * 4, 0, 1)
    cd = grad([(0, (120, 112, 64)), (1, (160, 146, 90))], blades)
    c = c * (1 - dry[..., None] * 0.6) + cd * dry[..., None] * 0.6
    return c * relief(blades * 0.6 + base * 0.4, 1.0)[..., None] * grain(s + 3, 0.05)[..., None]


def t_steppe(s):
    base = fbm(s, 2.3, lo=1)
    blades = fbm(s + 1, 1.3, lo=30, aniso=(0.3, 1.0))
    bare = np.clip((fbm(s + 2, 2.8, lo=1) - 0.55) * 3, 0, 1)
    c = grad([(0, (112, 104, 56)), (0.5, (148, 136, 76)), (1, (182, 166, 104))], base * 0.5 + blades * 0.5)
    cb = grad([(0, (130, 106, 76)), (1, (166, 140, 104))], base)
    c = c * (1 - bare[..., None]) + cb * bare[..., None]
    return c * relief(blades * 0.5 + base * 0.5, 1.0)[..., None] * grain(s + 3, 0.05)[..., None]


def t_rock(s):
    base = fbm(s, 2.0, lo=1)
    ridge = 1 - np.abs(fbm(s + 1, 2.2, lo=2) * 2 - 1)
    f1, f2, _ = voronoi(s + 2, 10, 0.9)
    cracks = np.clip((f2 - f1) / 0.05, 0, 1)
    h = base * 0.5 + ridge * 0.4 + cracks * 0.1
    c = grad([(0, (70, 68, 64)), (0.5, (112, 108, 100)), (1, (150, 146, 136))], base * 0.6 + ridge * 0.4)
    c *= (0.6 + 0.4 * cracks)[..., None]
    return c * relief(h, 2.2)[..., None] * grain(s + 3, 0.06)[..., None]


def t_redrock(s):
    ys, xs = np.mgrid[0:N, 0:N] / N
    warp = fbm(s, 2.6, lo=1) * 0.6
    strata = np.sin(2 * np.pi * (ys * 9 + warp))                  # yatay katmanlar (ucurumda yandan gorunur)
    base = fbm(s + 1, 2.0, lo=1)
    ridge = 1 - np.abs(fbm(s + 2, 2.2, lo=2) * 2 - 1)
    h = base * 0.4 + ridge * 0.3 + strata * 0.15
    c = grad([(0, (118, 56, 34)), (0.5, (164, 88, 52)), (1, (204, 134, 88))], base * 0.5 + strata * 0.2 + 0.25)
    return c * relief(h, 2.0)[..., None] * grain(s + 3, 0.06)[..., None]


def t_snow(s):
    base = fbm(s, 2.4, lo=1)
    c = grad([(0, (196, 206, 220)), (0.6, (230, 236, 244)), (1, (248, 250, 252))], base)
    return c * relief(base * 0.7 + fbm(s + 1, 1.2, lo=30) * 0.3, 1.0)[..., None] * grain(s + 2, 0.025)[..., None]


def t_mud(s):
    base = fbm(s, 2.3, lo=1)
    wet = np.clip((fbm(s + 1, 2.8, lo=1) - 0.5) * 3, 0, 1)
    c = grad([(0, (52, 40, 28)), (0.5, (78, 60, 42)), (1, (104, 82, 58))], base)
    c *= (1 - 0.35 * wet)[..., None]
    return c * relief(base, 1.2)[..., None] * grain(s + 2, 0.05)[..., None]


def t_cobble(s):
    f1, f2, ident = voronoi(s, 32, 0.75)
    edge = np.clip((f2 - f1) / 0.16, 0, 1)
    dome = np.clip(1 - f1 / 0.62, 0, 1) ** 0.5
    tone = rng(s + 1).random(32 * 32)[ident]
    h = dome * edge
    c = grad([(0, (98, 92, 84)), (0.5, (134, 126, 114)), (1, (168, 160, 146))], tone * 0.8 + fbm(s + 2, 2.0) * 0.2)
    mortar = np.array([74, 68, 60]) / 255
    c = c * edge[..., None] + mortar * (1 - edge[..., None])
    return c * relief(h, 2.2)[..., None] * grain(s + 3, 0.05)[..., None]


def t_paving(s):
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float32)
    rows = 16
    rh = N / rows
    row = np.floor(ys / rh).astype(int)
    off = (rng(s).random(rows) * N)[row]
    cols = 10
    cw = N / cols
    xx = (xs + off) % N
    col = np.floor(xx / cw).astype(int)
    fx = (xx % cw) / cw
    fy = (ys % rh) / rh
    edge = np.clip(np.minimum.reduce([fx, 1 - fx, fy * 1.6, (1 - fy) * 1.6]) / 0.06, 0, 1)
    tone = rng(s + 1).random(rows * cols)[(row * cols + col) % (rows * cols)]
    base = fbm(s + 2, 2.2, lo=1)
    c = grad([(0, (150, 138, 118)), (0.5, (182, 170, 148)), (1, (206, 196, 176))], tone * 0.5 + base * 0.5)
    c = c * edge[..., None] + np.array([92, 84, 72]) / 255 * (1 - edge[..., None])
    return c * relief(edge * 0.7 + base * 0.3, 1.4)[..., None] * grain(s + 3, 0.04)[..., None]


def t_farmland(s):
    ys, xs = np.mgrid[0:N, 0:N] / N
    rows = np.sin(2 * np.pi * xs * 24) * 0.5 + 0.5
    base = fbm(s, 2.2, lo=1)
    crop = fbm(s + 1, 1.2, lo=40)
    c_soil = grad([(0, (86, 66, 44)), (1, (120, 94, 64))], base)
    c_crop = grad([(0, (66, 98, 34)), (1, (118, 146, 60))], crop)
    m = np.clip((rows - 0.35) * 3, 0, 1)
    c = c_soil * (1 - m[..., None]) + c_crop * m[..., None]
    return c * relief(rows * 0.5 + crop * 0.3, 1.2)[..., None] * grain(s + 2, 0.05)[..., None]


def t_road(s):
    """Sikistirilmis toprak yol: ince cakil + koyu lekeler."""
    base = fbm(s, 2.2, lo=1)
    f1, f2, ident = voronoi(s + 1, 80, 0.95)
    peb = np.clip(1 - f1 / 0.4, 0, 1) * (rng(s + 2).random(6400)[ident] < 0.5)
    c = grad([(0, (118, 100, 76)), (0.5, (146, 126, 98)), (1, (170, 150, 120))], base)
    c *= (1 - 0.2 * peb)[..., None]
    stain = np.clip((fbm(s + 3, 2.8, lo=1) - 0.6) * 3, 0, 1)
    c *= (1 - 0.25 * stain)[..., None]
    return c * relief(base * 0.6 + peb * 0.4, 1.2)[..., None] * grain(s + 4, 0.05)[..., None]


# id: (ad, fonksiyon, yuzey bayragi, tekrar ussu: tekrar = 4*2^u hucre = 8*2^u m)
TERRAIN = [
    ('sand', t_sand, 1, 1),
    ('dirt', t_dirt, 0, 0),
    ('gravel', t_gravel, 0, 0),
    ('grass', t_grass, 10, 0),
    ('steppe', t_steppe, 10, 1),
    ('rock', t_rock, 3, 1),
    ('redrock', t_redrock, 3, 1),
    ('snow', t_snow, 9, 1),
    ('mud', t_mud, 6, 0),
    ('cobble', t_cobble, 100, 0),
    ('paving', t_paving, 100, 0),
    ('farmland', t_farmland, 0, 1),
    ('road', t_road, 0, 0),
]


# ------------------------------------------------------------------ yapilar

def b_plaster(s, tint=(206, 184, 150)):
    base = fbm(s, 2.4, lo=1)
    stains = np.clip((fbm(s + 1, 3.0, lo=1) - 0.55) * 2.5, 0, 1)
    c = np.array(tint) / 255 * (0.88 + 0.16 * base)[..., None]
    c *= (1 - 0.18 * stains)[..., None]
    return c * relief(base, 0.8)[..., None] * grain(s + 2, 0.03)[..., None]


def b_blocks(s, rows, cols, tint, mortar, jitter=0.12):
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float32)
    rh = N / rows
    row = np.floor(ys / rh).astype(int)
    off = np.where(row % 2 == 0, 0, N / cols / 2)
    xx = (xs + off) % N
    cw = N / cols
    col = np.floor(xx / cw).astype(int)
    fx, fy = (xx % cw) / cw, (ys % rh) / rh
    edge = np.clip(np.minimum.reduce([fx, 1 - fx, fy * rh / cw * 1.0, (1 - fy) * rh / cw]) / 0.05, 0, 1)
    tone = rng(s).random(rows * cols)[(row * cols + col) % (rows * cols)]
    base = fbm(s + 1, 2.2, lo=1)
    c = np.array(tint) / 255 * (1 - jitter + 2 * jitter * tone)[..., None] * (0.9 + 0.2 * base)[..., None]
    c = c * edge[..., None] + np.array(mortar) / 255 * (1 - edge[..., None])
    return c * relief(edge * 0.6 + base * 0.4, 1.2)[..., None] * grain(s + 2, 0.04)[..., None]


def b_rooftiles(s, tint, rows=16):
    ys, xs = np.mgrid[0:N, 0:N] / N
    ridge = np.abs(np.sin(np.pi * xs * 24))                      # yarim silindir kiremitler
    course = (ys * rows) % 1.0
    shade = 0.65 + 0.35 * ridge * (0.7 + 0.3 * course)
    base = fbm(s, 2.2, lo=1)
    c = np.array(tint) / 255 * shade[..., None] * (0.9 + 0.2 * base)[..., None]
    c *= np.where(course < 0.06, 0.6, 1.0)[..., None]
    return c * grain(s + 1, 0.03)[..., None]


def b_wood(s, tint=(120, 84, 52), boards=8):
    ys, xs = np.mgrid[0:N, 0:N] / N
    board = np.floor(xs * boards)
    grain_ = fbm(s, 1.6, lo=2, aniso=(0.08, 1.0))
    tone = rng(s + 1).random(boards)[board.astype(int) % boards]
    c = np.array(tint) / 255 * (0.8 + 0.25 * grain_ + 0.15 * tone)[..., None]
    gap = ((xs * boards) % 1.0 < 0.03)
    c *= np.where(gap, 0.45, 1.0)[..., None]
    return c * grain(s + 2, 0.03)[..., None]


def b_mosaic(s, a=(32, 84, 150), b=(230, 226, 210), cells=32):
    ys, xs = np.mgrid[0:N, 0:N] / N
    u, v = xs * cells % 1.0, ys * cells % 1.0
    star = np.abs(u - 0.5) + np.abs(v - 0.5) < 0.32
    ring = np.hypot(u - 0.5, v - 0.5) < 0.18
    m = np.where(star ^ ring, 1.0, 0.0)
    base = fbm(s, 2.0, lo=1)
    c = np.array(a) / 255 * (1 - m)[..., None] + np.array(b) / 255 * m[..., None]
    c *= (0.9 + 0.15 * base)[..., None]
    edge = np.minimum.reduce([u, 1 - u, v, 1 - v]) < 0.04
    c *= np.where(edge, 0.7, 1.0)[..., None]
    return c * grain(s + 1, 0.03)[..., None]


def b_copper(s):
    base = fbm(s, 2.4, lo=1)
    streak = fbm(s + 1, 1.6, lo=4, aniso=(1.0, 0.15))
    c = grad([(0, (58, 112, 96)), (0.5, (88, 150, 128)), (1, (130, 178, 156))], base * 0.6 + streak * 0.4)
    return c * grain(s + 2, 0.03)[..., None]


def b_canvas(s, tint=(214, 200, 168)):
    ys, xs = np.mgrid[0:N, 0:N] / N
    weave = (np.sin(2 * np.pi * xs * 128) * np.sin(2 * np.pi * ys * 128)) * 0.04
    base = fbm(s, 2.4, lo=1)
    stripes = (np.floor(xs * 8) % 2) * 0.12
    c = np.array(tint) / 255 * (0.9 + 0.12 * base + weave - stripes)[..., None]
    return c * grain(s + 1, 0.02)[..., None]


def b_bark(s, tint=(92, 72, 52)):
    ys, xs = np.mgrid[0:N, 0:N] / N
    fib = fbm(s, 1.8, lo=3, aniso=(0.06, 1.0))
    rings = (np.sin(2 * np.pi * ys * 18 + fbm(s + 1, 2.5) * 4) * 0.5 + 0.5)
    c = np.array(tint) / 255 * (0.65 + 0.35 * fib + 0.1 * rings)[..., None]
    return c * relief(fib, 1.8)[..., None] * grain(s + 2, 0.05)[..., None]


def leaf_card(s, kind):
    """Alfa kanalli yaprak kartlari (RGBA)."""
    ys, xs = np.mgrid[0:N, 0:N] / N
    r = rng(s)
    alpha = np.zeros((N, N))
    col = np.zeros((N, N, 3))
    if kind == 'palm':
        # orta damar boyunca iki yana inen yapraklar (kart -x..x, y kok->uc)
        mid = np.abs(xs - 0.5)
        y = ys
        width = 0.46 * np.sin(np.pi * np.clip(y, 0, 1)) ** 0.6
        leaflet = (np.sin(2 * np.pi * (y * 26 + mid * 3.2)) * 0.5 + 0.5) > 0.28
        alpha = ((mid < width) & leaflet) | (mid < 0.012)
        t = fbm(s, 2.0) * 0.5 + y * 0.3
        col = grad([(0, (46, 78, 30)), (0.6, (84, 120, 44)), (1, (124, 140, 62))], t)
    elif kind == 'leaves':
        f1, f2, ident = voronoi(s, 14, 0.9)
        blob = np.hypot(xs - 0.5, ys - 0.5) < 0.47 + (fbm(s + 1, 2.5) - 0.5) * 0.2
        leaf = (f1 < 0.42) & (r.random(196)[ident] < 0.85)
        alpha = blob & leaf
        col = grad([(0, (36, 66, 24)), (0.5, (62, 98, 36)), (1, (104, 134, 56))], r.random(196)[ident] * 0.6 + (1 - f1) * 0.4)
    elif kind == 'pine':
        mid = np.abs(xs - 0.5)
        y = ys
        needles = (np.sin(2 * np.pi * (y * 40 + mid * 9)) * 0.5 + 0.5) > 0.35
        alpha = ((mid < 0.48 * (1 - y * 0.85)) & needles) | (mid < 0.01)
        col = grad([(0, (24, 46, 30)), (1, (60, 92, 52))], fbm(s, 2.0) * 0.6 + (1 - y) * 0.4)
    elif kind == 'grass':
        alpha = np.zeros((N, N), bool)
        for k in range(70):
            x0 = r.random()
            h = 0.4 + r.random() * 0.6
            lean = (r.random() - 0.5) * 0.25
            w = 0.006 + r.random() * 0.008
            t = np.clip((1 - ys) / h, 0, 1)
            xc = x0 + lean * t * t
            alpha |= (np.abs(xs - xc) < w * (1 - t)) & (ys > 1 - h)
        col = grad([(0, (52, 80, 30)), (1, (130, 150, 66))], 1 - ys)
    rgb = col * grain(s + 9, 0.04)[..., None]
    a = alpha.astype(np.float64)
    # alfa kenarina tasan rengi koru (mip seviyelerinde koyu hale olmasin)
    return np.concatenate([rgb, a[..., None]], axis=2)


BUILD = {
    'plaster_adobe': lambda: b_plaster(101, (204, 176, 132)),
    'plaster_white': lambda: b_plaster(102, (228, 222, 206)),
    'plaster_ochre': lambda: b_plaster(103, (196, 150, 96)),
    'sandstone_blocks': lambda: b_blocks(104, 12, 6, (200, 170, 122), (150, 126, 90)),
    'stone_wall': lambda: b_blocks(105, 10, 5, (150, 142, 128), (96, 90, 82), 0.18),
    'brick_red': lambda: b_blocks(106, 32, 8, (150, 74, 52), (170, 160, 140), 0.1),
    'marble': lambda: b_blocks(107, 6, 3, (226, 222, 214), (190, 186, 178), 0.05),
    'roof_green': lambda: b_rooftiles(108, (54, 112, 84)),
    'roof_red': lambda: b_rooftiles(109, (150, 70, 46)),
    'roof_grey': lambda: b_rooftiles(110, (88, 90, 96)),
    'wood_planks': lambda: b_wood(111),
    'wood_lacquer': lambda: b_wood(112, (120, 30, 26), 4),
    'mosaic_blue': lambda: b_mosaic(113),
    'mosaic_turquoise': lambda: b_mosaic(114, (40, 140, 150), (240, 230, 200)),
    'copper_patina': lambda: b_copper(115),
    'canvas': lambda: b_canvas(116),
    'canvas_red': lambda: b_canvas(117, (170, 60, 50)),
    'bark': lambda: b_bark(118),
    'bark_palm': lambda: b_bark(119, (120, 100, 72)),
}
FOLIAGE = {'leaf_palm': 'palm', 'leaf_broad': 'leaves', 'leaf_pine': 'pine', 'grass_tuft': 'grass'}


def main():
    only = set(sys.argv[1:])
    meta = []
    for i, (name, fn, surface, scale) in enumerate(TERRAIN):
        meta.append({'id': i, 'name': name, 'file': f'terrain/{name}.jpg', 'surface': surface, 'scale': scale})
        if only and name not in only:
            continue
        img = fn(1000 + i * 17)
        save(img, os.path.join(OUT, 'terrain', f'{name}.jpg'))
        avg = (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round().astype(int).tolist()
        meta[-1]['color'] = avg
        print('zemin', name, avg)
    if not only:
        old = {}
    else:
        p = os.path.join(OUT, 'terrain.json')
        old = {m['name']: m for m in json.load(open(p))} if os.path.exists(p) else {}
    for m in meta:
        if 'color' not in m and m['name'] in old:
            m['color'] = old[m['name']].get('color')
    json.dump(meta, open(os.path.join(OUT, 'terrain.json'), 'w'), indent=1)
    for name, fn in BUILD.items():
        if only and name not in only:
            continue
        save(fn(), os.path.join(OUT, 'build', f'{name}.jpg'))
        print('yapi', name)
    for name, kind in FOLIAGE.items():
        if only and name not in only:
            continue
        save(leaf_card(200 + len(name), kind), os.path.join(OUT, 'build', f'{name}.png'))
        print('yaprak', name)


if __name__ == '__main__':
    main()
