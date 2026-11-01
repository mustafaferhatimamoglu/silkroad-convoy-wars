"""
Silkroad Map.pk2 (ham cikti) -> oyunda kullanilabilir MAP klasoru donusturucu.

Kullanim:
    python convert_map.py [--raw RAW_DIR] [--out OUT_DIR] [--colormap 256]

Uretilen yapi (detaylar icin OUT_DIR/README.md):
    MAP/world.json                 genel manifest (bolgeler, olcekler, binary yerlesimi)
    MAP/regions/{z}_{x}.bin        bolge arazi verisi (yukseklik, doku indexi, su ...)
    MAP/colormaps/{z}_{x}.jpg      bolge icin onceden "bake" edilmis zemin rengi
    MAP/objects/{z}_{x}.json       bolgedeki obje (bina, agac ...) yerlesimleri
    MAP/objects/models.json        obje model indexi -> Data.pk2 icindeki model yolu
    MAP/textures/tile2d/*.jpg      orijinal zemin dokulari
    MAP/textures/tiles.json        doku indexi -> dosya, bolge, ortalama renk
    MAP/preview/*.jpg/png          tum dunya onizleme ve yukseklik haritasi
"""
import argparse
import glob
import io
import json
import os
import re
import struct
import time

import numpy as np
from PIL import Image

# ----------------------------------------------------------------- sabitler
REGION_SIZE = 1920.0          # bir bolgenin kenar uzunlugu (oyun birimi)
BLOCKS = 6                    # bolge basina 6x6 blok
BLOCK_VERTS = 17              # blok basina 17x17 vertex
CELLS = BLOCKS * (BLOCK_VERTS - 1)   # 96 hucre
VERTS = CELLS + 1             # 97 vertex
CELL_SIZE = REGION_SIZE / CELLS      # 20 birim
M_FILE_SIZE = 92712

VERT_DT = np.dtype([("h", "<f4"), ("tex", "<u2"), ("light", "u1")])
BLOCK_DT = np.dtype([
    ("flag", "<u4"), ("env", "<u2"),
    ("v", VERT_DT, (BLOCK_VERTS, BLOCK_VERTS)),
    ("wtype", "u1"), ("wwave", "u1"), ("wh", "<f4"),
    ("cell", "<u2", (16, 16)),
    ("hmax", "<f4"), ("hmin", "<f4"), ("res", "u1", 20),
])
assert 12 + 36 * BLOCK_DT.itemsize == M_FILE_SIZE

# ---- .bin yerlesimi (little-endian). JS tarafi world.json'daki binLayout'u kullanir.
N_V = VERTS * VERTS
N_C = CELLS * CELLS
BIN_LAYOUT = {}
_off = 32
for _name, _type, _count in [("height", "float32", N_V), ("texture", "uint16", N_V), ("light", "uint8", N_V),
                             ("cellFlags", "uint16", N_C), ("waterType", "uint8", 36), ("waterHeight", "float32", 36)]:
    _size = {"float32": 4, "uint16": 2, "uint8": 1}[_type]
    _off = (_off + _size - 1) // _size * _size   # hizalama
    BIN_LAYOUT[_name] = {"offset": _off, "type": _type, "count": _count}
    _off += _size * _count
BIN_SIZE = (_off + 3) // 4 * 4


# ----------------------------------------------------------------- yardimcilar
def read_ifo_lines(path):
    with open(path, "rb") as f:
        lines = f.read().decode("cp949", "replace").splitlines()
    return lines[0].strip(), lines[2:]


def parse_tile2d(raw):
    _, lines = read_ifo_lines(os.path.join(raw, "tile2d.ifo"))
    tiles = {}
    for ln in lines:
        m = re.match(r'\s*(\d+)\s+(0x[0-9a-fA-F]+)\s+"([^"]*)"\s+"([^"]*)"', ln)
        if m:
            tiles[int(m.group(1))] = {"flags": int(m.group(2), 16), "area": m.group(3), "file": m.group(4)}
    return tiles


def parse_object_ifo(raw):
    _, lines = read_ifo_lines(os.path.join(raw, "object.ifo"))
    models = {}
    for ln in lines:
        m = re.match(r'\s*(\d+)\s+(0x[0-9a-fA-F]+)\s+"([^"]*)"', ln)
        if m:
            models[int(m.group(1))] = {"flags": int(m.group(2), 16), "path": m.group(3).replace("\\", "/")}
    return models


def load_texture(path):
    data = open(path, "rb").read()
    if data[:8] == b"JMXVDDJ ":
        data = data[20:]
    im = Image.open(io.BytesIO(data))
    im.load()
    return im.convert("RGB")


def parse_m(path):
    data = open(path, "rb").read()
    b = np.frombuffer(data, BLOCK_DT, 36, 12).reshape(BLOCKS, BLOCKS)   # [bz][bx]
    h = np.zeros((VERTS, VERTS), np.float32)
    tex = np.zeros((VERTS, VERTS), np.uint16)
    light = np.zeros((VERTS, VERTS), np.uint8)
    cell = np.zeros((CELLS, CELLS), np.uint16)
    for bz in range(BLOCKS):
        for bx in range(BLOCKS):
            blk = b[bz, bx]
            z0, x0 = bz * 16, bx * 16
            h[z0:z0 + 17, x0:x0 + 17] = blk["v"]["h"]
            tex[z0:z0 + 17, x0:x0 + 17] = blk["v"]["tex"]
            light[z0:z0 + 17, x0:x0 + 17] = blk["v"]["light"]
            cell[z0:z0 + 16, x0:x0 + 16] = blk["cell"]
    return {
        "h": h, "tex": tex, "light": light, "cell": cell,
        "wtype": b["wtype"].ravel().copy(), "wh": b["wh"].ravel().astype(np.float32),
        "env": int(np.bincount(b["env"].ravel()).argmax()),
    }


def write_bin(path, rx, rz, t):
    buf = bytearray(BIN_SIZE)
    struct.pack_into("<4sHHBBHff", buf, 0, b"SRMP", 1, (rz << 8) | rx, rx, rz, VERTS,
                     float(t["h"].min()), float(t["h"].max()))
    arrays = {"height": t["h"], "texture": t["tex"], "light": t["light"], "cellFlags": t["cell"],
              "waterType": t["wtype"], "waterHeight": t["wh"]}
    for name, spec in BIN_LAYOUT.items():
        a = np.ascontiguousarray(arrays[name], dtype=spec["type"]).tobytes()
        buf[spec["offset"]:spec["offset"] + len(a)] = a
    with open(path, "wb") as f:
        f.write(buf)


class Baker:
    """Vertex doku indexlerinden bolge basina renk haritasi (colormap) uretir."""

    def __init__(self, tile_stack, size, period_cells=4.0):
        self.stack = tile_stack                    # (T, S, S, 3) float32
        self.S = tile_stack.shape[1]
        n = size
        c = (np.arange(n) + 0.5) / n * CELLS       # hucre koordinati
        cz = c[::-1][:, None] * np.ones((1, n))    # goruntu satiri 0 = kuzey (z max)
        cx = np.ones((n, 1)) * c[None, :]
        i0 = np.clip(np.floor(cz).astype(int), 0, CELLS - 1)
        j0 = np.clip(np.floor(cx).astype(int), 0, CELLS - 1)
        fz, fx = (cz - i0)[..., None], (cx - j0)[..., None]
        self.idx = [(i0, j0, (1 - fz) * (1 - fx)), (i0, j0 + 1, (1 - fz) * fx),
                    (i0 + 1, j0, fz * (1 - fx)), (i0 + 1, j0 + 1, fz * fx)]
        S = self.S
        self.tu = ((cx / period_cells) % 1.0 * S).astype(int) % S
        self.tv = ((cz / period_cells) % 1.0 * S).astype(int) % S

    def bake(self, tex):
        ti = np.minimum(tex & 0x3FF, self.stack.shape[0] - 1)
        out = 0.0
        for i, j, w in self.idx:
            out = out + self.stack[ti[i, j], self.tv, self.tu] * w
        return np.clip(out, 0, 255).astype(np.uint8)


def hillshade(h, cell):
    gz, gx = np.gradient(h.astype(np.float32), cell)
    nx, nz, ny = -gx, gz, np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    lx, ly, lz = -0.5, 0.7, 0.5
    ll = np.sqrt(lx * lx + ly * ly + lz * lz)
    return np.clip((nx * lx + ny * ly + nz * lz) / (ln * ll), 0.25, 1.0)


# ----------------------------------------------------------------- objeler
def parse_o2(path):
    data = open(path, "rb").read()
    off = 12
    out = []
    for _ in range(144):
        n, = struct.unpack_from("<H", data, off)
        off += 2
        for _ in range(n):
            mid, x, y, z, static, yaw, uid, unk, rid = struct.unpack_from("<I3fHfIHH", data, off)
            off += 30
            out.append((rid, uid, mid, x, y, z, yaw, static, unk))
    return out


# ----------------------------------------------------------------- ana akis
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=r"C:\Silkroad\Silkroad_V2\extracted\Map_raw")
    ap.add_argument("--out", default=r"C:\Silkroad\Silkroad\silkroad_3d\MAP")
    ap.add_argument("--colormap", type=int, default=256, help="bolge basina colormap cozunurlugu")
    ap.add_argument("--preview", type=int, default=16, help="onizlemede bolge basina piksel")
    ap.add_argument("--origin", default="168,97", help="Three.js orijini olacak bolge x,z (varsayilan Jangan)")
    args = ap.parse_args()

    raw, out = args.raw, args.out
    t0 = time.time()
    for d in ("regions", "colormaps", "objects", "textures/tile2d", "preview"):
        os.makedirs(os.path.join(out, d), exist_ok=True)

    # ---- 1) dokular
    print("[1/4] Zemin dokulari donusturuluyor...")
    tiles = parse_tile2d(raw)
    T = max(tiles) + 1
    SMALL = 16
    stack = np.full((T, SMALL, SMALL, 3), 128, np.float32)
    tiles_json = {}
    for idx, info in sorted(tiles.items()):
        src = os.path.join(raw, "tile2d", info["file"])
        if not os.path.exists(src):
            alt = os.path.splitext(src)[0] + ".tga"
            src = alt if os.path.exists(alt) else None
        entry = {"area": info["area"], "flags": info["flags"], "source": info["file"], "file": None, "color": [128, 128, 128]}
        if src:
            name = os.path.splitext(os.path.basename(src))[0] + ".jpg"
            dst = os.path.join(out, "textures", "tile2d", name)
            im = load_texture(src)
            if not os.path.exists(dst):
                im.save(dst, quality=88)
            small = np.asarray(im.resize((SMALL, SMALL), Image.BOX), np.float32)
            stack[idx] = small
            entry["file"] = "textures/tile2d/" + name
            entry["color"] = [int(v) for v in small.reshape(-1, 3).mean(0)]
        tiles_json[str(idx)] = entry
    with open(os.path.join(out, "textures", "tiles.json"), "w", encoding="utf-8") as f:
        json.dump(tiles_json, f, indent=0)
    print(f"      {len(tiles)} doku ({sum(1 for e in tiles_json.values() if e['file'])} dosya) {time.time() - t0:.0f}s")

    # ---- 2) arazi
    print("[2/4] Arazi bolgeleri donusturuluyor...")
    baker = Baker(stack, args.colormap)
    regions = []
    preview_tiles = {}
    m_files = [p for p in glob.glob(os.path.join(raw, "*", "*.m")) if os.path.getsize(p) == M_FILE_SIZE]
    for k, p in enumerate(sorted(m_files)):
        rz = int(os.path.basename(os.path.dirname(p)))
        rx = int(os.path.splitext(os.path.basename(p))[0])
        key = f"{rz}_{rx}"
        t = parse_m(p)
        write_bin(os.path.join(out, "regions", key + ".bin"), rx, rz, t)
        cmap = baker.bake(t["tex"])
        Image.fromarray(cmap).save(os.path.join(out, "colormaps", key + ".jpg"), quality=85)
        water = [round(float(w), 2) for w, ty in zip(t["wh"], t["wtype"]) if ty != 255]
        regions.append({
            "id": (rz << 8) | rx, "x": rx, "z": rz, "key": key,
            "minH": round(float(t["h"].min()), 2), "maxH": round(float(t["h"].max()), 2),
            "env": t["env"], "water": max(water) if water else None,
        })
        # onizleme icin kucuk karo
        P = args.preview
        hs = np.asarray(Image.fromarray(hillshade(t["h"], CELL_SIZE)[::-1].astype(np.float32)).resize((P, P), Image.BILINEAR))
        col = np.asarray(Image.fromarray(cmap).resize((P, P), Image.BOX), np.float32) * hs[..., None]
        hsmall = np.asarray(Image.fromarray(t["h"][::-1]).resize((P, P), Image.BILINEAR))
        preview_tiles[(rx, rz)] = (col.astype(np.uint8), hsmall)
        if k % 500 == 0:
            print(f"      {k}/{len(m_files)}  {time.time() - t0:.0f}s")

    # ---- 3) objeler
    print("[3/4] Obje yerlesimleri cikartiliyor...")
    models = parse_object_ifo(raw)
    objs = {}
    for p in glob.glob(os.path.join(raw, "*", "*.o2")):
        for rid, uid, mid, x, y, z, yaw, static, unk in parse_o2(p):
            objs[(rid, uid)] = (mid, x, y, z, yaw, static)
    by_region = {}
    for (rid, uid), (mid, x, y, z, yaw, static) in objs.items():
        by_region.setdefault(rid, []).append([mid, round(x, 3), round(y, 3), round(z, 3), round(yaw, 5), uid, static])
    region_ids = {r["id"] for r in regions}
    for rid, lst in by_region.items():
        lst.sort(key=lambda o: o[5])
        with open(os.path.join(out, "objects", f"{rid >> 8}_{rid & 0xFF}.json"), "w") as f:
            json.dump({"region": rid, "fields": ["model", "x", "y", "z", "yaw", "uid", "static"], "objects": lst},
                      f, separators=(",", ":"))
    for r in regions:
        r["objects"] = len(by_region.get(r["id"], []))
    used = {o[0] for lst in by_region.values() for o in lst}
    with open(os.path.join(out, "objects", "models.json"), "w", encoding="utf-8") as f:
        json.dump({str(k): v for k, v in sorted(models.items())}, f, indent=0)
    print(f"      {len(objs)} obje, {len(by_region)} bolge, {len(used)} farkli model "
          f"({len(set(by_region) - region_ids)} bolgede arazi yok)")

    # ---- 4) onizleme + manifest
    print("[4/4] Onizleme ve manifest yaziliyor...")
    xs = [r["x"] for r in regions]
    zs = [r["z"] for r in regions]
    minx, maxx, minz, maxz = min(xs), max(xs), min(zs), max(zs)
    P = args.preview
    W, H = (maxx - minx + 1) * P, (maxz - minz + 1) * P
    col_img = np.zeros((H, W, 3), np.uint8)
    h_img = np.full((H, W), np.nan, np.float32)
    for (rx, rz), (col, hs) in preview_tiles.items():
        px, py = (rx - minx) * P, (maxz - rz) * P
        col_img[py:py + P, px:px + P] = col
        h_img[py:py + P, px:px + P] = hs
    Image.fromarray(col_img).save(os.path.join(out, "preview", "world_color.jpg"), quality=90)
    hmin, hmax = np.nanmin(h_img), np.nanmax(h_img)
    h16 = np.nan_to_num((h_img - hmin) / (hmax - hmin) * 65535, nan=0).astype(np.uint16)
    Image.fromarray(h16).save(os.path.join(out, "preview", "world_height16.png"))
    occ = np.zeros((maxz - minz + 1, maxx - minx + 1), np.uint8)
    for r in regions:
        occ[maxz - r["z"], r["x"] - minx] = 255
    Image.fromarray(occ).resize((occ.shape[1] * 4, occ.shape[0] * 4), Image.NEAREST).save(
        os.path.join(out, "preview", "region_mask.png"))

    ox, oz = (int(v) for v in args.origin.split(","))
    world = {
        "format": "silkroad-map", "version": 1,
        "source": "Map.pk2 (Silkroad Online)",
        "coordinateSystem": {
            "note": "Silkroad: sol el, Y yukari. Dunya X = x*regionSize + localX, Dunya Z = z*regionSize + localZ. "
                    "Three.js icin Z eksenini ters cevirin (threeZ = -worldZ), obje yaw icin rotation.y = -yaw.",
            "regionSize": REGION_SIZE, "cellSize": CELL_SIZE, "vertsPerSide": VERTS, "cellsPerSide": CELLS,
            "suggestedOrigin": {"x": ox, "z": oz, "name": "Jangan" if (ox, oz) == (168, 97) else ""},
        },
        "bounds": {"minX": minx, "maxX": maxx, "minZ": minz, "maxZ": maxz,
                   "minH": round(float(min(r["minH"] for r in regions)), 2),
                   "maxH": round(float(max(r["maxH"] for r in regions)), 2)},
        "preview": {"pixelsPerRegion": P, "heightRange": [float(hmin), float(hmax)],
                    "color": "preview/world_color.jpg", "height16": "preview/world_height16.png"},
        "binLayout": {"size": BIN_SIZE, "header": "char[4] 'SRMP', u16 version, u16 regionId, u8 x, u8 z, u16 verts, f32 minH, f32 maxH",
                      "fields": BIN_LAYOUT,
                      "notes": {"height": "97x97 satir-major [z][x], z=0 guney kenari",
                                "texture": "alt 10 bit = tiles.json indexi, ust 6 bit = doku olcegi",
                                "waterType": "6x6 blok, 255 = su yok"}},
        "paths": {"region": "regions/{key}.bin", "colormap": "colormaps/{key}.jpg", "objects": "objects/{key}.json",
                  "models": "objects/models.json", "tiles": "textures/tiles.json"},
        "colormapSize": args.colormap,
        "regions": regions,
    }
    with open(os.path.join(out, "world.json"), "w", encoding="utf-8") as f:
        json.dump(world, f, separators=(",", ":"))
    print(f"Tamamlandi: {len(regions)} bolge, {time.time() - t0:.0f}s -> {out}")


if __name__ == "__main__":
    main()
