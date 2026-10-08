"""Ralli etabi araclari: arazi taramasi -> rota planlama -> ince engel koridoru -> pilot notlari
-> oyun verisi (src/data/rally.js) -> otomatik pilotla deneme.

Tarama/koridor/notlar/surus adimlari oyunu tarayicida calistirir: oyun sunucusu (python server.py,
5070) ve test kosum takimi (node tools/devharness.mjs, 9400) acik olmali. Adresler SRO_GAME ve
SRO_HARNESS ortam degiskenleriyle degistirilebilir. Ara ciktilar tools/rally/work/<etap>/ altinda
(git disi): tarama bloklari, grid.npz, extra_obs.json, route.json, profile.json, notes.json, map.png.

  python tools/rally/rally.py scan hotan        arazi taramasi (bounds icindeki bolgeler, 4 m izgara)
  python tools/rally/rally.py reach hotan       ilk ara noktadan araçla ulasilabilen alan -> reach.png
  python tools/rally/rally.py plan hotan        A* + duzeltme -> route.json, map.png
  python tools/rally/rally.py emit              src/data/rally.js (rotasi olan tum etaplar)
  python tools/rally/rally.py corridor hotan    rota koridorunda ince engel taramasi -> extra_obs.json
  python tools/rally/rally.py notes hotan       oyun ici yukseklik profili + pilot notlari
  python tools/rally/rally.py line hotan        botlarin hizli cizgisi (viraj ici, kestirmeler) + koridor genisligi
  python tools/rally/rally.py build hotan       plan/emit/koridor (engel kalmayana dek) + notlar + emit
  python tools/rally/rally.py drive hotan kartal80 ralli [--lat 4.2] [--brk 4.5]   otomatik pilot turu

Etap tanimi tools/rally/stages/<id>.json: ad, aciklama, sehir, bounds [rx0, rx1, rz0, rz1] ve ara
noktalar [rx, rz, ad|null] (ilki baslangic; adi olanlar kontrol noktasi, sonuncusu finis).
Istege bagli avoid [[rx, rz, yaricap m, not], ...]: rotanin ve hizli cizginin girmeyecegi alanlar.
Koordinatlar kesirli bolge koordinati (bolge = 192 m; rx dogu, rz kuzey).
"""
import argparse
import base64
import glob
import heapq
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(TOOLS))
WORK = os.path.join(TOOLS, 'work')
OUT = os.path.join(ROOT, 'src', 'data', 'rally.js')
ASSETS = os.path.join(ROOT, 'assets')
HARNESS = os.environ.get('SRO_HARNESS', 'http://127.0.0.1:9400')
GAME = os.environ.get('SRO_GAME', 'http://localhost:5070')
ORIGIN = (168, 97)   # Jangan bolgesi = Three.js orijini; x = (rx - 168) * 192, z = -(rz - 97) * 192
CELL = 4.0           # izgara hucresi (m); bolge basina 48 hucre


# ---------------------------------------------------------------- etap / dosyalar

def load_stage(sid):
    st = json.load(open(os.path.join(TOOLS, 'stages', f'{sid}.json'), encoding='utf-8'))
    st['dir'] = os.path.join(WORK, sid)
    os.makedirs(os.path.join(st['dir'], 'scan'), exist_ok=True)
    return st


def wpath(st, name):
    return os.path.join(st['dir'], name)


def three_to_region(x, z):
    return ORIGIN[0] + x / 192, ORIGIN[1] - z / 192


# ---------------------------------------------------------------- tarayici (devharness)

def ev(js, timeout=1800):
    req = urllib.request.Request(f'{HARNESS}/eval', data=js.encode('utf-8'), method='POST')
    r = json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8'))
    if 'error' in r:
        raise RuntimeError(r['error'])
    return r.get('value')


def nav(url):
    urllib.request.urlopen(f'{HARNESS}/nav?url={urllib.parse.quote(url, safe="")}', timeout=60).read()


def script(name, **subs):
    s = open(os.path.join(TOOLS, 'browser', name), encoding='utf-8').read()
    for k, v in subs.items():
        s = s.replace(f'__{k}__', str(v))
    return s


def wait_for(cond_js, secs=180):
    t0 = time.time()
    while time.time() - t0 < secs:
        try:
            if ev(cond_js, 30):
                return True
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('oyun hazir olmadi: ' + cond_js)


def ensure_game(st):
    nav(f'{GAME}/?mode=drive&city={st.get("city", "jangan")}')
    time.sleep(2)
    wait_for("!!(window.game && window.app && app.mode && app.mode.constructor.name === 'DriveMode')")


# ---------------------------------------------------------------- izgara

class Grid:
    """Tarama bloklarindan birlesik izgara: h (dm), s (egim derece), f (bayrak), m (zemin)."""

    def __init__(self, st):
        self.RX0, self.RX1, self.RZ0, self.RZ1 = st['bounds']
        npz = wpath(st, 'grid.npz')
        if os.path.exists(npz):
            d = np.load(npz)
            self.h, self.s, self.f, self.m = d['h'], d['s'], d['f'], d['m']
        else:
            self._merge(st)
            np.savez_compressed(npz, h=self.h, s=self.s, f=self.f, m=self.m)

    def _merge(self, st):
        W, H = (self.RX1 - self.RX0 + 1) * 48, (self.RZ1 - self.RZ0 + 1) * 48
        self.h = np.full((H, W), -32768, np.int16)
        self.s = np.zeros((H, W), np.uint8)
        self.f = np.full((H, W), 128, np.uint8)
        self.m = np.zeros((H, W), np.uint8)
        for fn in glob.glob(wpath(st, os.path.join('scan', 'b_*.json'))):
            v = json.load(open(fn))
            v = v.get('value', v)
            n = v['n']
            arr = lambda key, dt: np.frombuffer(base64.b64decode(v[key]), dt).reshape(n, n)
            bh, bs, bf, bm = arr('h', np.int16), arr('s', np.uint8), arr('f', np.uint8), arr('m', np.uint8)
            gx0, gz0 = (v['rx'] - 1 - self.RX0) * 48, (v['rz'] - 1 - self.RZ0) * 48
            for j in range(n):
                gz = gz0 + j
                if not 0 <= gz < H:
                    continue
                xs = slice(max(0, gx0), min(W, gx0 + n))
                if xs.start >= xs.stop:
                    continue
                bi = slice(xs.start - gx0, xs.stop - gx0)
                self.h[gz, xs], self.s[gz, xs], self.f[gz, xs], self.m[gz, xs] = bh[j, bi], bs[j, bi], bf[j, bi], bm[j, bi]

    def to_grid(self, rx, rz):
        return (rx - self.RX0) * 48, (rz - self.RZ0) * 48

    def to_region(self, gx, gz):
        return self.RX0 + gx / 48, self.RZ0 + gz / 48


def dilate(mask, it=1):
    out = mask.copy()
    for _ in range(it):
        g = out.copy()
        g[1:, :] |= out[:-1, :]; g[:-1, :] |= out[1:, :]
        g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]
        out = g
    return out


# ---------------------------------------------------------------- tarama

def cmd_scan(st):
    ensure_game(st)
    RX0, RX1, RZ0, RZ1 = st['bounds']
    for rx in range(RX0 + 1, RX1 + 1, 3):
        for rz in range(RZ0 + 1, RZ1 + 1, 3):
            t0 = time.time()
            v = ev(script('scan.js', RX=rx, RZ=rz))
            json.dump(v, open(wpath(st, os.path.join('scan', f'b_{rx}_{rz}.json')), 'w'))
            print(f'blok {rx},{rz}: engel {v["blocked"]}, su {v["water"]}, bilinmeyen {v["unknown"]} ({time.time() - t0:.0f} sn)')
    if os.path.exists(wpath(st, 'grid.npz')):
        os.remove(wpath(st, 'grid.npz'))
    Grid(st)
    print('izgara yazildi')


# ---------------------------------------------------------------- planlama

def astar(g, blocked, near_pen, a, b, road=0.8, rough=None, step=0.42, scost=(8, 0.06)):
    h, s, m = g.h, g.s, g.m
    H, W = h.shape
    sx, sz = int(round(a[0])), int(round(a[1]))
    gx, gz = int(round(b[0])), int(round(b[1]))
    dist = np.full((H, W), np.inf)
    prev = -np.ones((H, W), np.int64)
    dist[sz, sx] = 0
    pq = [(0.0, sz, sx)]
    nbr = [(-1, -1, 1.414), (-1, 0, 1), (-1, 1, 1.414), (0, -1, 1), (0, 1, 1), (1, -1, 1.414), (1, 0, 1), (1, 1, 1.414)]
    while pq:
        dcur, z, x = heapq.heappop(pq)
        if (z, x) == (gz, gx):
            break
        if dcur > dist[z, x] + 1e-9:
            continue
        for dz, dx, ln in nbr:
            nz, nx = z + dz, x + dx
            if nz < 0 or nz >= H or nx < 0 or nx >= W or blocked[nz, nx]:
                continue
            if dz and dx and (blocked[z, nx] or blocked[nz, x]):
                continue
            # basamak: komsu hucre yukseklik farki -> egim (varsayilan en fazla ~23 derece)
            if abs(int(h[nz, nx]) - int(h[z, x])) / 10.0 / (ln * CELL) > step:
                continue
            c = 1.0 + max(0, int(s[nz, nx]) - scost[0]) * scost[1] + near_pen[nz, nx]
            if rough is not None:
                c += rough[nz, nx]                                  # tumsek/set (sicrama) cezasi
            sf = m[nz, nx]
            c *= road if sf == 0 else (1.15 if sf == 1 else 1.0)   # toprak yol tercih, kum biraz pahali
            nd = dcur + ln * c
            if nd < dist[nz, nx]:
                dist[nz, nx] = nd
                prev[nz, nx] = z * W + x
                heapq.heappush(pq, (nd, nz, nx))
    if not np.isfinite(dist[gz, gx]):
        return None
    path, k = [], gz * W + gx
    while k >= 0:
        z, x = divmod(int(k), W)
        path.append((x, z))
        if (x, z) == (sx, sz):
            break
        k = prev[z, x]
    return path[::-1]


def line_free(free, a, b):
    (x0, z0), (x1, z1) = a, b
    n = max(1, int(math.hypot(x1 - x0, z1 - z0) * CELL))
    for k in range(n + 1):
        t = k / n
        if not free[int(round(z0 + (z1 - z0) * t)), int(round(x0 + (x1 - x0) * t))]:
            return False
    return True


def catmull(pts, step=1.0):
    """Merkezcil Catmull-Rom; step hucre cinsinden ornek araligi."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = [np.array(q, float) for q in P[i - 1:i + 3]]
        tj = lambda ti, a, b: ti + max(1e-6, np.linalg.norm(b - a) ** 0.5)
        t0 = 0.0; t1 = tj(t0, p0, p1); t2 = tj(t1, p1, p2); t3 = tj(t2, p2, p3)
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for k in range(n):
            t = t1 + (t2 - t1) * k / n
            A1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            A2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            A3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2
            B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3
            C = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2
            out.append((float(C[0]), float(C[1])))
    out.append(tuple(map(float, pts[-1])))
    return out


MAXCUT = 15   # en uzun kestirme ~60 m (firketeler yuvarlanir ama kaybolmaz)


def refine(path, free):
    """Gorus hatti sadelestirme + spline; spline serbest hucrelerden cikarsa A* noktasini geri ekle."""
    idx, i = [0], 0
    while i < len(path) - 1:
        j = min(len(path) - 1, i + MAXCUT)
        while j > i + 1 and not line_free(free, path[i], path[j]):
            j -= 1
        idx.append(j)
        i = j
    for _ in range(8):
        sp = catmull([path[k] for k in idx], 0.5)
        bad = next((q for q in sp if not free[int(round(q[1])), int(round(q[0]))]), None)
        if bad is None:
            return sp
        best = min(range(len(path)), key=lambda k: (path[k][0] - bad[0]) ** 2 + (path[k][1] - bad[1]) ** 2)
        if best in idx:
            break
        idx = sorted(idx + [best])
    return catmull([path[k] for k in idx], 0.5)


def chaikin(path, it=1):
    """Chaikin kose kirpma, ardindan ~8 m (2 hucre) aralikla yeniden ornekleme."""
    pts = [tuple(map(float, p)) for p in path]
    for _ in range(it):
        out = [pts[0]]
        for i in range(len(pts) - 1):
            (x0, z0), (x1, z1) = pts[i], pts[i + 1]
            out.append((0.75 * x0 + 0.25 * x1, 0.75 * z0 + 0.25 * z1))
            out.append((0.25 * x0 + 0.75 * x1, 0.25 * z0 + 0.75 * z1))
        out.append(pts[-1])
        pts = out
    res, acc = [pts[0]], 0.0
    for i in range(1, len(pts)):
        acc += math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        if acc >= 2.0:
            res.append(pts[i]); acc = 0.0
    if res[-1] != pts[-1]:
        res.append(pts[-1])
    return res


def load_blocked(st, g):
    """Gecilmez hucreler (su, engel, bilinmeyen, >= 24 derece) + ince engeller (kesin konumlariyla)."""
    f, s = g.f, g.s
    blocked = ((f & 2) > 0) | ((f & 1) > 0) | ((f & 128) > 0) | (s >= 24)
    extra = []
    ep = wpath(st, 'extra_obs.json')
    if os.path.exists(ep):
        for x, z in json.load(open(ep)):
            gx, gz = g.to_grid(*three_to_region(x, z))
            extra.append((gx, gz))
            ix, iz = int(round(gx)), int(round(gz))
            if 0 <= iz < blocked.shape[0] and 0 <= ix < blocked.shape[1]:
                blocked[iz, ix] = True
    # etap tanimi 'avoid': [rx, rz, yaricap m, not] - elle isaretlenen kacinilacak alanlar (4 m izgaranin
    # yumusattigi dik kaya etegi ya da yan egim gibi; yaris denemesinde takla/takilma yeri cikan noktalar)
    H, W = blocked.shape
    for ax, az, rad, *_ in st.get('avoid', []):
        cx, cz = g.to_grid(ax, az)
        rc = rad / CELL
        for z in range(max(0, int(cz - rc) - 1), min(H, int(cz + rc) + 2)):
            for x in range(max(0, int(cx - rc) - 1), min(W, int(cx + rc) + 2)):
                if (x - cx) ** 2 + (z - cz) ** 2 <= rc * rc:
                    blocked[z, x] = True
    return blocked, extra


def cmd_plan(st, quiet=False):
    g = Grid(st)
    s = g.s
    blocked, extra = load_blocked(st, g)
    # etap ayari maxslope: bu egimden dik hucreler rota icin gecilmez (arkadan itisli arac cimende
    # ~15 dereceden dik yokusu yavas girince cikamaz; yaris rotalari yumusak olmali)
    max_slope = st.get('maxslope', 24)
    step = math.tan(math.radians(min(23, max_slope)))
    if max_slope < 24:
        blocked = blocked | (g.s >= max_slope)
    hard = dilate(blocked & ~((g.f & 1) > 0), 1)
    blocked2 = blocked | hard
    # engele yakinlik cezasi: 2 ve 3 hucre uzakliktaki hucreler pahali
    d2 = dilate(blocked, 2) & ~hard
    d3 = dilate(blocked, 3) & ~dilate(blocked, 2)
    near_pen = d2 * 1.0 + d3 * 0.4
    # ara noktalari baslangictan ulasilabilen en yakin hucreye kaydir (en fazla 14 hucre = 56 m)
    w0 = st['waypoints'][0]
    # ulasilabilirlik: baslangicin en yakin serbest hucresinden (ince engel baslangici kapatmasin)
    sx, sz = (int(round(v)) for v in g.to_grid(w0[0], w0[1]))
    cand = [(abs(dx) + abs(dz), sx + dx, sz + dz) for dz in range(-6, 7) for dx in range(-6, 7)
            if 0 <= sz + dz < blocked2.shape[0] and 0 <= sx + dx < blocked2.shape[1] and not blocked2[sz + dz, sx + dx]]
    _, fx, fz = min(cand)
    reach = reachable(g, blocked2, (fx, fz), step)
    wps = []
    for w in st['waypoints']:
        gx, gz = g.to_grid(w[0], w[1])
        gx, gz = int(round(gx)), int(round(gz))
        best = None
        for r in range(0, 15):
            for dz in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if max(abs(dx), abs(dz)) != r:
                        continue
                    z, x = gz + dz, gx + dx
                    if 0 <= z < blocked2.shape[0] and 0 <= x < blocked2.shape[1] and not blocked2[z, x] and (reach[z, x] or w is w0):
                        d = math.hypot(dx, dz)
                        if best is None or d < best[0]:
                            best = (d, x, z)
            if best:
                break
        if not best:
            raise RuntimeError(f'serbest hucre yok: {w}')
        if best[0] > 0 and not quiet:
            print(f'  kaydirildi {w[2] or ""} {best[0] * CELL:.0f} m')
        wps.append((*g.to_region(best[1], best[2]), w[2]))
    # etap ayarlari: road = toprak yol maliyet carpani (kucuk: yolu sikica izle, tarlalar kestirme
    # olur), smooth = tumsek cezasi (yukseklik alaninin Laplasyeni, m basina)
    road = st.get('road', 0.8)
    rough = None
    if st.get('smooth'):
        hm = g.h.astype(np.float32) / 10
        lap = np.zeros_like(hm)
        lap[1:-1, 1:-1] = np.abs(hm[2:, 1:-1] + hm[:-2, 1:-1] + hm[1:-1, 2:] + hm[1:-1, :-2] - 4 * hm[1:-1, 1:-1])
        rough = np.clip(lap - 0.15, 0, 3) * st['smooth']
    full, seg_len = [], []
    for i in range(len(wps) - 1):
        path = astar(g, blocked2, near_pen, g.to_grid(*wps[i][:2]), g.to_grid(*wps[i + 1][:2]), road, rough, step,
                     (10, st['slopecost']) if st.get('slopecost') else (8, 0.06))
        if path is None:
            raise RuntimeError(f'yol yok: {wps[i]} -> {wps[i + 1]}')
        seg_len.append(len(path) * CELL)
        full.extend(path if not full else path[1:])
    # serbest koridor: engel/sudan en az 3 hucre (12 m) uzak, egim < 16 derece; A* hucreleri hep serbest
    free = ~dilate(blocked, 3) & (s < 16)
    for x, z in full:
        free[z, x] = True
    pts = [list(q) for q in chaikin(refine(full, free), 1)]
    # elastik bant: kirik/zikzaklari gider; nokta ancak engelden >= 1 hucre uzak bir yere kayar
    free1 = ~dilate(blocked, 1) & (s < 20)
    for _ in range(60):
        for i in range(1, len(pts) - 1):
            tx = 0.5 * (pts[i - 1][0] + pts[i + 1][0]); tz = 0.5 * (pts[i - 1][1] + pts[i + 1][1])
            nx = pts[i][0] + 0.5 * (tx - pts[i][0]); nz = pts[i][1] + 0.5 * (tz - pts[i][1])
            if free1[int(round(nz)), int(round(nx))] or not free1[int(round(pts[i][1])), int(round(pts[i][0]))]:
                pts[i][0], pts[i][1] = nx, nz
    # engel itme: yol noktasi engele 7 m'den yakinsa uzaga it; dar yerde iki yandan itme dengelenir
    PR = 1.75
    bz, bx = np.nonzero(blocked)
    bpts = np.concatenate([np.stack([bx, bz], 1).astype(float), np.array(extra, float).reshape(-1, 2)])
    for _ in range(40):
        disp = np.zeros((len(pts), 2))
        for i in range(1, len(pts) - 1):
            q = np.array(pts[i])
            near = bpts[(np.abs(bpts[:, 0] - q[0]) < PR + 1) & (np.abs(bpts[:, 1] - q[1]) < PR + 1)]
            for o in near:
                dv = q - o; dd = math.hypot(*dv)
                if 1e-6 < dd < PR:
                    disp[i] += dv / dd * (PR - dd) * 0.3
        disp[1:-1] = 0.25 * disp[:-2] + 0.5 * disp[1:-1] + 0.25 * disp[2:]
        moved = 0
        for i in range(1, len(pts) - 1):
            if abs(disp[i][0]) + abs(disp[i][1]) < 1e-4:
                continue
            nx, nz = pts[i][0] + disp[i][0], pts[i][1] + disp[i][1]
            if not blocked[int(round(nz)), int(round(nx))]:
                pts[i][0], pts[i][1] = nx, nz
                moved += 1
        if not moved:
            break
    total = sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts))) * CELL
    route = {'path': [g.to_region(x, z) for x, z in pts], 'cps': [w for w in wps if w[2]], 'length_m': total}
    json.dump(route, open(wpath(st, 'route.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'rota: {total:.0f} m, {len(pts)} nokta; bolumler {[round(x) for x in seg_len]}')
    render(st, g, route)
    return route


def gate_indices(st, path, cps):
    """Kontrol kapilarinin yol indeksleri (emit ile ayni kural)."""
    out = []
    for x, z, name in cps:
        out.append(min(range(len(path)), key=lambda i: (path[i][0] - x) ** 2 + (path[i][1] - z) ** 2))
    out = [i for i in out if i > 0]
    if st['waypoints'][-1][2]:
        out[-1] = len(path) - 1
    return out


def thin_raster(blocked, extra, radius):
    """Ince engelleri (kesirli hucre konumu) verilen yaricapla izgaraya bas."""
    m = blocked.copy()
    H, W = m.shape
    r = int(math.ceil(radius))
    for gx, gz in extra:
        for dz in range(-r, r + 1):
            for dx in range(-r, r + 1):
                x, z = int(round(gx)) + dx, int(round(gz)) + dz
                if 0 <= z < H and 0 <= x < W and (x - gx) ** 2 + (z - gz) ** 2 <= radius * radius:
                    m[z, x] = True
    return m


def cmd_line(st):
    """Botlarin hizli cizgisi: rota, kapilardan (5 m icinde) gecmek sartiyla gergin ip gibi cekilir;
    viraj icleri ve acik arazideki kestirmeler boyle cikar. Engellerden en az ~6 m, egim < 12 derece."""
    g = Grid(st)
    blocked, extra = load_blocked(st, g)
    r = json.load(open(wpath(st, 'route.json'), encoding='utf-8'))
    P = [list(g.to_grid(x, z)) for x, z in r['path']]
    gates = gate_indices(st, r['path'], r['cps'])
    fin = gates[-1]
    P = P[:fin + 1]                       # cizgi finis kapisinda biter (sonrasi rota)
    n = len(P)
    # hizli cizgi: yamac kesmesin (arkadan itisli arac cimende 12 dereceden diki zor tirmanir)
    free = ~thin_raster(dilate(blocked, 1), extra, 1.5) & (g.s < 12)
    H, W = free.shape

    def ok(x, z):
        ix, iz = int(round(x)), int(round(z))
        return 0 <= iz < H and 0 <= ix < W and free[iz, ix]

    def seg_ok(a, b):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        k = max(1, int(L * 2))
        for q in range(k + 1):
            t = q / k
            if not ok(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t):
                return False
        return True

    # gergin ip: her kosedan, siradaki kapiyi atlamadan, dumduz ve engelsiz gidilebilen en uzak
    # rota noktasina baglan (en kisa yol yaklasimi: viraj icleri ve acik arazide kestirmeler)
    gate_set = sorted(i for i in gates if i < n)
    verts, i = [0], 0
    MAXJ = 70                              # en uzun duz parca ~560 m
    while i < n - 1:
        nxt = next((gi for gi in gate_set if gi > i), n - 1)
        j = min(n - 1, i + MAXJ, nxt)
        while j > i + 1 and not seg_ok(P[i], P[j]):
            j -= 1
        verts.append(j)
        i = j
    V = [list(P[k]) for k in verts]
    gi_v = {k: verts.index(gi) for k, gi in enumerate(gate_set) if gi in verts}
    # kapi koseleri: kapi merkezinden en fazla 5 m oynayabilir; komsu koselerin dogrusuna yaklas
    for _ in range(6):
        for gk, vi in gi_v.items():
            if vi <= 0 or vi >= len(V) - 1:
                continue
            cx, cz = P[gate_set[gk]]
            ax, az = V[vi - 1]; bx, bz = V[vi + 1]
            dx, dz = bx - ax, bz - az
            L2 = dx * dx + dz * dz or 1
            t = max(0.0, min(1.0, ((cx - ax) * dx + (cz - az) * dz) / L2))
            px, pz = ax + dx * t, az + dz * t
            d = math.hypot(px - cx, pz - cz)
            if d > 1.25:
                px, pz = cx + (px - cx) * 1.25 / d, cz + (pz - cz) * 1.25 / d
            if ok(px, pz) and seg_ok(V[vi - 1], (px, pz)) and seg_ok((px, pz), V[vi + 1]):
                V[vi] = [px, pz]
    # koseleri yumusat (Chaikin), serbest alandan cikmayacak kadar
    for _ in range(3):
        out = [V[0]]
        for k in range(len(V) - 1):
            a0, a1 = V[k], V[k + 1]
            q = [0.75 * a0[0] + 0.25 * a1[0], 0.75 * a0[1] + 0.25 * a1[1]]
            r_ = [0.25 * a0[0] + 0.75 * a1[0], 0.25 * a0[1] + 0.75 * a1[1]]
            out.append(q if ok(*q) else a0)
            out.append(r_ if ok(*r_) else a1)
        out.append(V[-1])
        cand = [out[0]] + [p_ for p_ in out[1:] if p_ != out[0]]
        if all(seg_ok(cand[k], cand[k + 1]) for k in range(len(cand) - 1)):
            V = cand
    # yogun ornekle (1 hucre) sonra seyrelt
    P = []
    for k in range(len(V) - 1):
        a0, a1 = V[k], V[k + 1]
        L = math.hypot(a1[0] - a0[0], a1[1] - a0[1])
        m = max(1, int(L))
        for q in range(m):
            t = q / m
            P.append([a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t])
    P.append(V[-1])
    n = len(P)
    it = len(verts)
    # ~8 m aralikla yeniden ornekle
    out, acc = [tuple(P[0])], 0.0
    for i in range(1, n):
        acc += math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])
        if acc >= 2.0 or i == n - 1:
            out.append(tuple(P[i])); acc = 0.0
    L_line = sum(math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]) for i in range(1, len(out))) * CELL
    L_route = sum(math.hypot(r['path'][i][0] - r['path'][i - 1][0], r['path'][i][1] - r['path'][i - 1][1]) for i in range(1, fin + 1)) * 192
    line = [g.to_region(x, z) for x, z in out]
    json.dump(line, open(wpath(st, 'line.json'), 'w'))
    print(f'hizli cizgi: {L_line:.0f} m (rota finise kadar {L_route:.0f} m, {100 * (1 - L_line / L_route):.1f}% kisa), {len(line)} nokta, {it} kose')
    cmd_widths(st, g, blocked, extra, r)
    return line


def cmd_widths(st, g, blocked, extra, r):
    """Rota koridoru: her yol noktasinda sola/saga engele, suya, dik yamaca kadar serbest mesafe (m, en fazla 15)."""
    wall = thin_raster(blocked | (g.s >= 20), extra, 1.0)
    H, W = wall.shape
    P = [g.to_grid(x, z) for x, z in r['path']]
    n = len(P)
    wl, wr = [], []
    for i in range(n):
        a, b = P[max(0, i - 1)], P[min(n - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        tl = math.hypot(tx, tz) or 1
        tx, tz = tx / tl, tz / tl
        res = []
        for nx, nz in ((-tz, tx), (tz, -tx)):           # sol, sag (izgara: x dogu, z kuzey)
            k = 0.25
            while k <= 3.75:
                x, z = int(round(P[i][0] + nx * k)), int(round(P[i][1] + nz * k))
                if not (0 <= z < H and 0 <= x < W) or wall[z, x]:
                    break
                k += 0.25
            res.append(max(1, int(round((k - 0.25) * CELL))))
        wl.append(res[0]); wr.append(res[1])
    json.dump({'wl': wl, 'wr': wr}, open(wpath(st, 'widths.json'), 'w'))
    narrow = sum(1 for a, b in zip(wl, wr) if a + b < 10)
    print(f'koridor genisligi: ortalama {sum(wl) / n + sum(wr) / n:.1f} m, 10 m altinda {narrow} nokta')


def reachable(g, blocked2, start, step=0.42):
    """Baslangic hucresinden arac kurallariyla (A* ile ayni: engel, basamak egimi) ulasilabilen hucreler."""
    H, W = g.h.shape
    seen = np.zeros((H, W), bool)
    sx, sz = int(round(start[0])), int(round(start[1]))
    stack = [(sz, sx)]
    seen[sz, sx] = True
    h = g.h
    while stack:
        z, x = stack.pop()
        for dz, dx, ln in ((-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)):
            nz, nx = z + dz, x + dx
            if nz < 0 or nz >= H or nx < 0 or nx >= W or seen[nz, nx] or blocked2[nz, nx]:
                continue
            if dz and dx and (blocked2[z, nx] or blocked2[nz, x]):
                continue
            if abs(int(h[nz, nx]) - int(h[z, x])) / 10.0 / (ln * CELL) > step:
                continue
            seen[nz, nx] = True
            stack.append((nz, nx))
    return seen


def cmd_reach(st):
    """Ilk ara noktadan ulasilabilen alan haritasi (ulasilamayan yerler karartilir): work/<id>/reach.png"""
    from PIL import Image
    g = Grid(st)
    blocked, extra = load_blocked(st, g)
    max_slope = st.get('maxslope', 24)
    step = math.tan(math.radians(min(23, max_slope)))
    if max_slope < 24:
        blocked = blocked | (g.s >= max_slope)
    blocked2 = blocked | dilate(blocked & ~((g.f & 1) > 0), 1)
    w0 = st['waypoints'][0]
    sx, sz = (int(round(v)) for v in g.to_grid(w0[0], w0[1]))
    cand = [(abs(dx) + abs(dz), sx + dx, sz + dz) for dz in range(-6, 7) for dx in range(-6, 7)
            if 0 <= sz + dz < blocked2.shape[0] and 0 <= sx + dx < blocked2.shape[1] and not blocked2[sz + dz, sx + dx]]
    seen = reachable(g, blocked2, min(cand)[1:], step)
    render(st, g, None)
    im = np.asarray(Image.open(wpath(st, 'map.png')).convert('RGB')).astype(np.float32)
    S = im.shape[0] // seen.shape[0]
    mask = np.repeat(np.repeat(~seen[::-1], S, 0), S, 1)
    im[mask] *= 0.35
    img = Image.fromarray(im.clip(0, 255).astype(np.uint8))
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    px = 48 * S
    for k, w in enumerate(st['waypoints']):
        X, Y = (w[0] - g.RX0) * px, (g.RZ1 + 1 - w[1]) * px
        ok = seen[int(round((w[1] - g.RZ0) * 48)), int(round((w[0] - g.RX0) * 48))]
        d.ellipse([X - 6, Y - 6, X + 6, Y + 6], outline=(0, 255, 0) if ok else (255, 0, 0), width=3)
        d.text((X + 8, Y - 6), f'{k} {w[2] or ""}', fill=(255, 255, 255))
    img.save(wpath(st, 'reach.png'))
    print(f"ulasilabilir hucre: {seen.sum()} / {seen.size}; ara noktalar: {[(k, bool(seen[int(round((w[1] - g.RZ0) * 48)), int(round((w[0] - g.RX0) * 48))])) for k, w in enumerate(st['waypoints'])]}")


def render(st, g, route=None, SCALE=2):
    """Renk haritasi uzerine egim/su/engel boyamasi, 5 m es yukselti, rota ve kontrol noktalari."""
    from PIL import Image, ImageDraw
    h, s, f = g.h, g.s, g.f
    px = 48 * SCALE
    bg = Image.new('RGB', (h.shape[1] * SCALE, h.shape[0] * SCALE))
    for rz in range(g.RZ0, g.RZ1 + 1):
        for rx in range(g.RX0, g.RX1 + 1):
            fn = os.path.join(ASSETS, 'map', 'colormaps', f'{rz}_{rx}.jpg')
            if os.path.exists(fn):
                bg.paste(Image.open(fn).convert('RGB').resize((px, px), Image.LANCZOS), ((rx - g.RX0) * px, (g.RZ1 - rz) * px))
    a = np.asarray(bg).astype(np.float32)
    up = lambda arr: np.repeat(np.repeat(arr[::-1], SCALE, 0), SCALE, 1)
    F, S = up(f), up(s)

    def tint(mask, col, k):
        a[mask] = a[mask] * (1 - k) + np.array(col, np.float32) * k
    tint((S >= 18) & (S < 28), (255, 170, 0), 0.45)
    tint(S >= 28, (200, 60, 0), 0.6)
    tint((F & 1) > 0, (40, 90, 255), 0.65)
    tint((F & 4) > 0, (170, 60, 220), 0.35)
    tint((F & 2) > 0, (255, 0, 0), 0.85)
    tint((F & 128) > 0, (0, 0, 0), 0.9)
    lev = np.floor(up(h).astype(np.float32) / 10 / 5)
    edge = np.zeros(lev.shape, bool)
    edge[:, 1:] |= lev[:, 1:] != lev[:, :-1]
    edge[1:, :] |= lev[1:, :] != lev[:-1, :]
    a[edge] = a[edge] * 0.4 + 255 * 0.6
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for rx in range(g.RX0, g.RX1 + 2):
        X = (rx - g.RX0) * px
        d.line([(X, 0), (X, img.size[1])], fill=(0, 0, 0), width=1)
        if rx <= g.RX1:
            d.text((X + 3, 3), str(rx), fill=(255, 255, 255))
    for rz in range(g.RZ0, g.RZ1 + 2):
        Y = (g.RZ1 - rz + 1) * px
        d.line([(0, Y), (img.size[0], Y)], fill=(0, 0, 0), width=1)
        if rz >= g.RZ0:
            d.text((3, Y - px + 14), str(rz), fill=(255, 255, 0))
    if route:
        d.line([((x - g.RX0) * px, (g.RZ1 + 1 - z) * px) for x, z in route['path']], fill=(0, 255, 255), width=3)
        for k, (x, z, name) in enumerate(route['cps']):
            X, Y = (x - g.RX0) * px, (g.RZ1 + 1 - z) * px
            d.ellipse([X - 7, Y - 7, X + 7, Y + 7], outline=(255, 255, 0), width=3)
            d.text((X + 9, Y - 6), f'{k + 1} {name}', fill=(255, 255, 0))
    img.save(wpath(st, 'map.png'))


# ---------------------------------------------------------------- oyun verisi

def cmd_emit():
    js = ['// Ralli etaplari - tools/rally/rally.py ile uretildi (elle duzenlemeyin; etap tanimi',
          '// tools/rally/stages/<id>.json). Rota, oyunun carpisma sistemiyle taranan surulebilirlik',
          '// haritasinda planlandi; yol [rx, rz] kesirli bolge koordinatlari (bolge = 192 m),',
          '// kontrol noktalari yol indeksi. Pilot notlari: k = L/R viraj (g: 1 keskin .. 6 hafif,',
          '// 0 firkete; e: viraj sonu; long: uzun), C tumsek, J sicrama, D cukur; vmax: sicratan basamakta',
          '// guvenli hiz (km/s, botlar bu noktaya en fazla bu hizla varir).',
          'export const RALLY_STAGES = {']
    ORDER = ['jangan', 'donwhang', 'hotan', 'samarkand', 'constantinople', 'alexandria']   # oyundaki sehir sirasi
    files = glob.glob(os.path.join(TOOLS, 'stages', '*.json'))
    key = lambda f: (ORDER.index(os.path.splitext(os.path.basename(f))[0]) if os.path.splitext(os.path.basename(f))[0] in ORDER else 99, f)
    for fn in sorted(files, key=key):
        st = load_stage(os.path.splitext(os.path.basename(fn))[0])
        if not os.path.exists(wpath(st, 'route.json')):
            continue
        r = json.load(open(wpath(st, 'route.json'), encoding='utf-8'))
        path = r['path']
        cps = []
        for x, z, name in r['cps']:
            bi = min(range(len(path)), key=lambda i: (path[i][0] - x) ** 2 + (path[i][1] - z) ** 2)
            cps.append({'name': name, 'i': bi})
        cps = [c for c in cps if c['i'] > 0]   # ilk ara nokta baslangic, kapi degil
        # son kontrol noktasi = finis; etap tanimi finisten sonra adsiz ara nokta(lar)la bitiyorsa
        # rota orada devam eder (finis sonrasi guvenli durma / kacis yolu)
        if st['waypoints'][-1][2]:
            cps[-1]['i'] = len(path) - 1
        js.append(f"  {st['id']}: {{")
        js.append(f"    name: {json.dumps(st['name'], ensure_ascii=False)},")
        js.append(f"    desc: {json.dumps(st['desc'], ensure_ascii=False)},")
        js.append(f"    length: {round(r['length_m'])},")
        js.append('    path: [')
        line = '      '
        for x, z in path:
            item = f'[{x:.4f}, {z:.4f}], '
            if len(line) + len(item) > 110:
                js.append(line.rstrip())
                line = '      '
            line += item
        js.append(line.rstrip())
        js.append('    ],')
        js.append('    cps: [')
        for c in cps:
            js.append(f"      {{ name: {json.dumps(c['name'], ensure_ascii=False)}, i: {c['i']} }},")
        js.append('    ],')
        wf = wpath(st, 'widths.json')
        if os.path.exists(wf):
            w = json.load(open(wf))
            if len(w['wl']) == len(path):
                js.append(f"    wl: [{', '.join(map(str, w['wl']))}],")
                js.append(f"    wr: [{', '.join(map(str, w['wr']))}],")
        lf = wpath(st, 'line.json')
        if os.path.exists(lf):
            js.append('    line: [')
            ln = '      '
            for x, z in json.load(open(lf)):
                item = f'[{x:.4f}, {z:.4f}], '
                if len(ln) + len(item) > 110:
                    js.append(ln.rstrip())
                    ln = '      '
                ln += item
            js.append(ln.rstrip())
            js.append('    ],')
        nf = wpath(st, 'notes.json')
        if os.path.exists(nf):
            js.append('    notes: [')
            for q in json.load(open(nf, encoding='utf-8')):
                if q['k'] in 'LR':
                    js.append(f"      {{ i: {q['i']}, e: {q['e']}, k: '{q['k']}', g: {q['g']}{', long: true' if q['long'] else ''} }},")
                else:
                    js.append(f"      {{ i: {q['i']}, k: '{q['k']}'{', vmax: ' + str(q['vmax']) if q.get('vmax') else ''} }},")
            js.append('    ],')
        js.append('  },')
        print(f"etap {st['id']}: {len(path)} nokta, {round(r['length_m'])} m, kapilar {[c['name'] for c in cps]}")
    js.append('};')
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(js) + '\n')
    print('yazildi', OUT)


# ---------------------------------------------------------------- ince engel koridoru

def cmd_corridor(st, width=12, key='path'):
    ensure_game(st)
    obs = json.loads(ev(script('corridor.js', STAGE=st['id'], W=width, KEY=key)))
    ep = wpath(st, 'extra_obs.json')
    cur = set(map(tuple, json.load(open(ep)))) if os.path.exists(ep) else set()
    n0 = len(cur)
    near = {}
    for i, _s, lat, x, z in obs:
        cur.add((round(x), round(z)))
        if i not in near or abs(lat) < abs(near[i]):
            near[i] = lat
    json.dump(sorted(cur), open(ep, 'w'))
    close = sorted((i, l) for i, l in near.items() if abs(l) <= 4)
    print(f'koridor ({key}): {len(obs)} engel ornegi, ince engel {n0} -> {len(cur)}; 4 m icinde: {close}')
    return close, len(cur) - n0


# ---------------------------------------------------------------- pilot notlari

def turn_notes(P):
    """P: [(x, z)] metre (x dogu, z kuzey). Isaretli egrilik (+ sol); 32 m'lik pencerede."""
    n = len(P)
    seg = [math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) for i in range(n - 1)]
    cum = [0.0]
    for s in seg:
        cum.append(cum[-1] + s)
    head = lambda i: math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0])
    wrap = lambda a: math.atan2(math.sin(a), math.cos(a))
    k = [0.0] * n
    for i in range(2, n - 2):
        a, b, c = P[i - 2], P[i], P[i + 2]
        da = wrap(math.atan2(c[1] - b[1], c[0] - b[0]) - math.atan2(b[1] - a[1], b[0] - a[0]))
        k[i] = da / max(1.0, math.hypot(c[0] - a[0], c[1] - a[1]) / 2)
    notes, i = [], 0
    while i < n:
        if abs(k[i]) < 1 / 180:
            i += 1
            continue
        sgn = 1 if k[i] > 0 else -1
        j = i
        while j + 1 < n and k[j + 1] * sgn > 1 / 260:
            j += 1
        tot = abs(math.degrees(sum(wrap(head(q) - head(q - 1)) for q in range(max(1, i), min(n - 1, j + 1)))))
        R = 1 / max(abs(k[q]) for q in range(i, j + 1))
        length = cum[j] - cum[i]
        if tot >= 22:
            g = 0 if tot >= 120 and R < 30 else (1 if R < 20 else 2 if R < 35 else 3 if R < 55 else 4 if R < 80 else 5 if R < 120 else 6)
            notes.append({'i': i, 'e': j, 'k': 'L' if sgn > 0 else 'R', 'g': g,
                          'long': bool((tot >= 85 and g != 0) or length > 90), 'R': round(R), 'deg': round(tot)})
        i = j + 1
    return notes


def vertical_notes(prof):
    """1 m'lik yukseklik profilinden tumsek (C), sicrama (J), cukur (D)."""
    H = np.array(prof['H'], float) / 100
    I = np.array(prof['I'])
    bad = H < -900
    if bad.any():
        H[bad] = np.interp(np.nonzero(bad)[0], np.nonzero(~bad)[0], H[~bad])
    Hs = np.convolve(np.pad(H, 2, mode='edge'), np.ones(5) / 5, mode='valid')
    n, B = len(Hs), 5
    K = np.zeros(n)
    K[B:n - B] = (Hs[2 * B:] - 2 * Hs[B:n - B] + Hs[:n - 2 * B]) / (B * B)
    feats = []
    for s in range(8, n - 16):
        kv = K[s]
        g1 = math.degrees(math.atan((Hs[s] - Hs[s - 8]) / 8))
        g2 = math.degrees(math.atan((Hs[s + 8] - Hs[s]) / 8))
        if kv < 0 and kv == K[max(0, s - 6):s + 7].min():
            vl = math.sqrt(9.81 / -kv) * 3.6   # bu hizin ustunde araba havalanir (km/s)
            if vl < 90 and Hs[s] - Hs[min(n - 1, s + 14)] > 1.4:
                feats.append((s, 'J', vl))
            elif vl < 75 and g1 - g2 >= 5:
                feats.append((s, 'C', vl))
        elif kv > 0.04 and kv == K[max(0, s - 6):s + 7].max() and g2 - g1 >= 8:
            feats.append((s, 'D', kv))
    pri, out = {'J': 0, 'C': 1, 'D': 2}, []
    for ft in feats:   # 30 m icindekiler birlesir: sicrama > tumsek > cukur
        if out and ft[0] - out[-1][0] < 30:
            if pri[ft[1]] < pri[out[-1][1]]:
                out[-1] = ft
            continue
        out.append(ft)
    notes = [{'i': int(I[s]), 'k': k, 'v': round(v, 2), 's': s} for s, k, v in out]
    # sicratan basamak (teras kenari): 3 m once/sonra egim farki; 5 m'lik egrilikte kaybolur ama arac
    # tek tarafindan firlatilip havada devrilir. Guvenli hiz deneyle: Semerkant'ta 10.5 derecelik
    # basamak 60 km/s'te sorunsuz, 70'te sinirda, 80'de takla -> vmax = 3.1 / fark (m/s).
    # Obje ustu (kopru) gecisleri sayilmaz.
    S = np.array(prof.get('S', [0] * len(H)))
    kicks = []
    for s in range(3, len(H) - 3):
        if (S[s - 3:s + 4] == 99).any():
            continue
        d = math.atan((H[s] - H[s - 3]) / 3) - math.atan((H[s + 3] - H[s]) / 3)
        if d >= math.radians(8):
            kicks.append((d, s))
    picked = []
    for d, s in sorted(kicks, reverse=True):
        if all(abs(s - p) > 20 for _, p in picked):
            picked.append((d, s))
    for d, s in picked:
        vmax = round(3.6 * 3.1 / d)
        near = [q for q in notes if abs(q['s'] - s) <= 15]
        if near:
            near[0]['vmax'] = min(vmax, near[0].get('vmax', 999))
        else:
            notes.append({'i': int(I[s]), 'k': 'C', 'v': round(vmax, 2), 's': s, 'vmax': vmax})
    notes.sort(key=lambda q: q['s'])
    for q in notes:
        del q['s']
    return notes


def cmd_notes(st):
    ensure_game(st)
    prof = json.loads(ev(script('profile.js', STAGE=st['id'])))
    json.dump(prof, open(wpath(st, 'profile.json'), 'w'))
    r = json.load(open(wpath(st, 'route.json'), encoding='utf-8'))
    notes = turn_notes([(x * 192, z * 192) for x, z in r['path']]) + vertical_notes(prof)
    notes.sort(key=lambda q: (q['i'], 0 if q['k'] in 'CJD' else 1))
    json.dump(notes, open(wpath(st, 'notes.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    NAME = {'L': 'SOL', 'R': 'SAĞ', 'C': 'TÜMSEK', 'J': 'SIÇRAMA', 'D': 'ÇUKUR'}
    for q in notes:
        if q['k'] in 'LR':
            print(f"  {q['i']:4d}-{q['e']:<4d} {NAME[q['k']]} {'FİRKETE' if q['g'] == 0 else q['g']}{' uzun' if q['long'] else ''}  (R {q['R']} m, {q['deg']} derece)")
        else:
            print(f"  {q['i']:4d}      {NAME[q['k']]}{'  (en fazla ' + str(q['vmax']) + ' km/s)' if q.get('vmax') else ''}")


# ---------------------------------------------------------------- hepsi

def cmd_build(st, rounds=6):
    for it in range(rounds):
        cmd_plan(st, quiet=it > 0)
        cmd_emit()
        close, added = cmd_corridor(st)
        if not close:
            break
        print(f'tur {it + 1}: yola yakin engel var, yeniden planlaniyor')
    for it in range(4):
        cmd_line(st)
        cmd_emit()
        close, added = cmd_corridor(st, 10, 'line')
        if not close:
            break
        print(f'cizgi turu {it + 1}: ince engel var, yeniden geriliyor')
    cmd_notes(st)
    cmd_emit()


# ---------------------------------------------------------------- otomatik pilot

def cmd_drive(st, variant, prep, lat=None, brk=None, vmax=None, limit=600):
    nav(f'{GAME}/?mode=rally&stage={st["id"]}&variant={variant}&prep={prep}')
    time.sleep(2)
    pre = ''.join(f'window.{k} = {v};' for k, v in (('_apLat', lat), ('_apBrk', brk), ('_apVmax', vmax)) if v)
    print(ev(pre + '\n' + script('autopilot.js')))
    t0 = time.time()
    st_js = script('status.js')
    while time.time() - t0 < limit:
        time.sleep(10)
        s = ev(st_js)
        if isinstance(s, dict):
            print(f"  {s['sure']} sn  kapi {s['kontrol']}  {s['son'][2] if s['son'] else 0} km/s  carpma {s['carpma']}  rotaya {s['rotaya']}  takilma {s['takilma']}")
            if s['durum'] == 'done':
                break
    r = ev("JSON.stringify({ time: app.mode.time, splits: app.mode.splits, impacts: _ap.impacts, resets: _ap.resets, stuck: _ap.stuck, maxV: _ap.maxV })")
    r = json.loads(r)
    m, sec = divmod(r['time'], 60)
    print(f"sure {int(m):02d}:{sec:05.2f}  ara {[round(t, 1) for t in r['splits']]}  en yuksek {r['maxV']:.0f} km/s")
    print(f"carpma {len(r['impacts'])} {[(i['i'], i['s']) for i in r['impacts']]}  rotaya donus {r['resets']}  takilma {len(r['stuck'])}")


def main():
    ap = argparse.ArgumentParser(description='Ralli etabi araclari')
    ap.add_argument('cmd', choices=['scan', 'plan', 'emit', 'corridor', 'notes', 'line', 'build', 'drive', 'reach'])
    ap.add_argument('stage', nargs='?')
    ap.add_argument('variant', nargs='?', default='kartal80')
    ap.add_argument('prep', nargs='?', default='ralli')
    ap.add_argument('--lat', type=float)
    ap.add_argument('--brk', type=float)
    ap.add_argument('--vmax', type=float)
    a = ap.parse_args()
    if a.cmd == 'emit':
        return cmd_emit()
    if not a.stage:
        ap.error('etap kimligi gerekli (or. hotan)')
    st = load_stage(a.stage)
    {'scan': lambda: cmd_scan(st), 'plan': lambda: cmd_plan(st), 'corridor': lambda: cmd_corridor(st),
     'notes': lambda: cmd_notes(st), 'build': lambda: cmd_build(st), 'line': lambda: (cmd_line(st), cmd_emit()), 'reach': lambda: cmd_reach(st),
     'drive': lambda: cmd_drive(st, a.variant, a.prep, a.lat, a.brk, a.vmax)}[a.cmd]()


if __name__ == '__main__':
    main()
