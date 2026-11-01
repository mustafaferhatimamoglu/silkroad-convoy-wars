import os
import sys
import json
import struct
import numpy as np
from PIL import Image

sys.path.append(r"C:\Silkroad\Silkroad\tools\map_export")
from convert_map import (
    BLOCKS, BLOCK_VERTS, CELLS, VERTS, CELL_SIZE,
    BIN_LAYOUT, BIN_SIZE, Baker, load_texture
)

DUNG_VERT_DT = np.dtype([
    ("h", "<f4"),
    ("tex1", "<u2"),
    ("tex2", "u1"),
    ("color", "<u4"),
])
DUNG_BLOCK_DT = np.dtype([
    ("flag", "<u4"),
    ("env", "<u2"),
    ("v", DUNG_VERT_DT, (17, 17)),
    ("wtype", "u1"),
    ("wwave", "u1"),
    ("wh", "<f4"),
    ("cell", "<u2", (16, 16)),
    ("hmax", "<f4"),
    ("hmin", "<f4"),
    ("res", "u1", 70),
])

def write_bin(path, rx, rz, t):
    buf = bytearray(BIN_SIZE)
    struct.pack_into("<4sHHBBHff", buf, 0, b"SRMP", 1, (rz << 8) | rx, rx, rz, VERTS,
                     float(t["h"].min()), float(t["h"].max()))
    arrays = {
        "height": t["h"], "texture": t["tex"], "light": t["light"],
        "cellFlags": t["cell"], "waterType": t["wtype"], "waterHeight": t["wh"]
    }
    for name, spec in BIN_LAYOUT.items():
        a = np.ascontiguousarray(arrays[name], dtype=spec["type"]).tobytes()
        buf[spec["offset"]:spec["offset"] + len(a)] = a
    with open(path, "wb") as f:
        f.write(buf)

def parse_dung_m(path):
    with open(path, "rb") as f:
        data = f.read()
    b = np.frombuffer(data[12:12 + 36 * 3781], DUNG_BLOCK_DT, 36).reshape(BLOCKS, BLOCKS)
    h = np.zeros((VERTS, VERTS), np.float32)
    tex = np.zeros((VERTS, VERTS), np.uint16)
    light = np.full((VERTS, VERTS), 128, np.uint8)
    cell = np.zeros((CELLS, CELLS), np.uint16)
    for bz in range(BLOCKS):
        for bx in range(BLOCKS):
            blk = b[bz, bx]
            z0, x0 = bz * 16, bx * 16
            h[z0:z0 + 17, x0:x0 + 17] = blk["v"]["h"]
            # tex2 is texture index, tex1 is upper 6-bit scale if any
            tex[z0:z0 + 17, x0:x0 + 17] = blk["v"]["tex2"].astype(np.uint16)
            cell[z0:z0 + 16, x0:x0 + 16] = blk["cell"]
    return {
        "h": h, "tex": tex, "light": light, "cell": cell,
        "wtype": b["wtype"].ravel().copy(), "wh": b["wh"].ravel().astype(np.float32),
        "env": int(np.bincount(b["env"].ravel()).argmax()),
    }

def main():
    raw_dir = r"C:\Silkroad\Silkroad_V2\extracted\Map_raw"
    out_dir = r"C:\Silkroad\Silkroad_V3\MAP"
    world_path = os.path.join(out_dir, "world.json")

    with open(world_path, "r", encoding="utf-8") as f:
        world = json.load(f)

    # Prepare texture stack
    tiles_json_path = os.path.join(out_dir, "textures", "tiles.json")
    with open(tiles_json_path, "r", encoding="utf-8") as f:
        tiles_data = json.load(f)
    
    max_idx = max(int(k) for k in tiles_data.keys())
    SMALL = 16
    stack = np.full((max_idx + 1, SMALL, SMALL, 3), 128, np.float32)
    for k, v in tiles_data.items():
        idx = int(k)
        if v["file"]:
            fpath = os.path.join(out_dir, v["file"])
            if os.path.exists(fpath):
                im = Image.open(fpath).convert("RGB")
                stack[idx] = np.asarray(im.resize((SMALL, SMALL), Image.BOX), np.float32)

    baker = Baker(stack, world.get("colormapSize", 256))

    missing_files = [
        ("0/0.m", 0, 0),
        ("0/1.m", 1, 0),
        ("0/2.m", 2, 0),
        ("1/0.m", 0, 1),
        ("1/1.m", 1, 1),
    ]

    new_regions = []
    for rel_path, rx, rz in missing_files:
        src = os.path.join(raw_dir, rel_path.replace("/", os.sep))
        key = f"{rz}_{rx}"
        print(f"Processing missing region {key} ({rel_path})...")
        t = parse_dung_m(src)
        
        # Write binary
        bin_path = os.path.join(out_dir, "regions", f"{key}.bin")
        write_bin(bin_path, rx, rz, t)

        # Bake colormap
        cmap = baker.bake(t["tex"])
        cmap_path = os.path.join(out_dir, "colormaps", f"{key}.jpg")
        Image.fromarray(cmap).save(cmap_path, quality=85)

        # Write empty objects
        obj_path = os.path.join(out_dir, "objects", f"{key}.json")
        with open(obj_path, "w") as f:
            json.dump({"region": (rz << 8) | rx, "fields": ["model", "x", "y", "z", "yaw", "uid", "static"], "objects": []}, f)

        water = [round(float(w), 2) for w, ty in zip(t["wh"], t["wtype"]) if ty != 255]
        reg_info = {
            "id": (rz << 8) | rx, "x": rx, "z": rz, "key": key,
            "minH": round(float(t["h"].min()), 2), "maxH": round(float(t["h"].max()), 2),
            "env": t["env"], "water": max(water) if water else None,
            "objects": 0, "isDungeon": True
        }
        new_regions.append(reg_info)

    # Add to world.json
    existing_ids = {r["id"] for r in world["regions"]}
    added = 0
    for r in new_regions:
        if r["id"] not in existing_ids:
            world["regions"].append(r)
            added += 1

    world["regions"].sort(key=lambda r: (r["z"], r["x"]))
    with open(world_path, "w", encoding="utf-8") as f:
        json.dump(world, f, separators=(",", ":"))

    print(f"[SUCCESS] Added {added} missing regions to world.json! Total regions now: {len(world['regions'])}")

if __name__ == "__main__":
    main()
