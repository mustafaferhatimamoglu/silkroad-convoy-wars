import os, sys, glob, time, json, struct
import numpy as np
from PIL import Image

sys.path.append(r"C:\Silkroad\Silkroad\tools\map_export")
from convert_map import parse_tile2d, load_texture, parse_m, CELL_SIZE, M_FILE_SIZE

RAW = r"C:\Silkroad\Silkroad_V2\extracted\Map_raw"
OUT = r"C:\Silkroad\Silkroad_V3\MAP"
RES = 512
SMALL = 32
PERIOD = 4
CELLS = 96

print(f"Preparing 512x512 Colormap Baker (SMALL={SMALL})...")
t0 = time.time()
tiles = parse_tile2d(RAW)
T = max(tiles) + 1
stack = np.full((T, SMALL, SMALL, 3), 128, np.float32)

for idx, info in sorted(tiles.items()):
    src = os.path.join(RAW, "tile2d", info["file"])
    if not os.path.exists(src):
        alt = os.path.splitext(src)[0] + ".tga"
        src = alt if os.path.exists(alt) else None
    if src:
        im = load_texture(src)
        small = np.asarray(im.resize((SMALL, SMALL), Image.BOX), np.float32)
        stack[idx] = small

print(f"Loaded {len(tiles)} textures into stack in {time.time()-t0:.2f}s")

# Precompute 512x512 sampling grid
n = RES
c = (np.arange(n) + 0.5) / n * CELLS
cz = c[::-1][:, None] * np.ones((1, n))
cx = np.ones((n, 1)) * c[None, :]
i0 = np.clip(np.floor(cz).astype(int), 0, CELLS - 1)
j0 = np.clip(np.floor(cx).astype(int), 0, CELLS - 1)
fz, fx = (cz - i0)[..., None], (cx - j0)[..., None]
idx_grid = [(i0, j0, (1 - fz) * (1 - fx)), (i0, j0 + 1, (1 - fz) * fx),
            (i0 + 1, j0, fz * (1 - fx)), (i0 + 1, j0 + 1, fz * fx)]
tu = ((cx / PERIOD) % 1.0 * SMALL).astype(int) % SMALL
tv = ((cz / PERIOD) % 1.0 * SMALL).astype(int) % SMALL

def bake_512(tex):
    ti = np.minimum(tex & 0x3FF, stack.shape[0] - 1)
    out = 0.0
    for i, j, w in idx_grid:
        out = out + stack[ti[i, j], tv, tu] * w
    return np.clip(out, 0, 255).astype(np.uint8)

# Target regions: core cities
target_ranges = [
    (162, 172, 94, 102),  # Jangan & Palace
    (153, 163, 95, 103),  # Donwhang
    (132, 142, 87, 95),   # Hotan
    (103, 112, 103, 111), # Samarkand
    (74, 83, 102, 110),   # Constantinople
    (48, 57, 86, 94),     # Alexandria
    (107, 116, 83, 90)    # Roc Mountain
]

baked = 0
for x0, x1, z0, z1 in target_ranges:
    for rz in range(z0, z1 + 1):
        for rx in range(x0, x1 + 1):
            m_path = os.path.join(RAW, str(rz), f"{rx}.m")
            if os.path.exists(m_path) and os.path.getsize(m_path) == M_FILE_SIZE:
                key = f"{rz}_{rx}"
                t = parse_m(m_path)
                cmap = bake_512(t["tex"])
                out_path = os.path.join(OUT, "colormaps", f"{key}.jpg")
                Image.fromarray(cmap).save(out_path, quality=90)
                baked += 1

print(f"[SUCCESS] Re-baked {baked} high-res 512x512 colormaps in {time.time()-t0:.1f}s!")
