import os
import sys
import io
import time
import json
from PIL import Image

sys.path.append(r"C:\Silkroad\Silkroad\tools\map_export")
from pk2 import PK2Archive

def main():
    pk2_path = r"C:\Silkroad\Silkroad_V2\extracted\client\Media.pk2"
    out_dir = r"C:\Silkroad\Silkroad_V3\MINIMAP"
    world_out = os.path.join(out_dir, "world")
    dungeon_out = os.path.join(out_dir, "dungeon")
    ui_out = os.path.join(out_dir, "ui")

    for d in (world_out, dungeon_out, ui_out):
        os.makedirs(d, exist_ok=True)

    print(f"Scanning Media.pk2 for minimaps...")
    t0 = time.time()
    a = PK2Archive(pk2_path).scan()

    all_minimaps = [f for f in a.files.keys() if ('minimap' in f or 'interface/minimap' in f) and f.endswith('.ddj')]
    print(f"Found {len(all_minimaps)} minimap DDJ files. Converting to JPG/PNG...")

    converted_world = 0
    converted_dungeon = 0
    converted_ui = 0
    failed = 0

    world_index = {}
    dungeon_index = {}

    for i, path in enumerate(all_minimaps):
        try:
            raw = a.read(path)
            if raw[:8] == b"JMXVDDJ ":
                raw = raw[20:]
            im = Image.open(io.BytesIO(raw))

            fname = os.path.basename(path)
            base_name, _ = os.path.splitext(fname)

            if path.startswith("minimap/"):
                # format: minimap/{x}x{z}.ddj
                parts = base_name.split("x")
                if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                    rx, rz = int(parts[0]), int(parts[1])
                    key = f"{rz}_{rx}"
                    dst = os.path.join(world_out, f"{key}.jpg")
                    im.convert("RGB").save(dst, quality=85)
                    world_index[key] = f"MINIMAP/world/{key}.jpg"
                    converted_world += 1
                else:
                    dst = os.path.join(world_out, f"{base_name}.jpg")
                    im.convert("RGB").save(dst, quality=85)
                    converted_world += 1

            elif "minimap_d" in path:
                # Dungeon minimap
                # Keep subfolder structure or flatten
                sub = os.path.dirname(path).replace("minimap_d/", "").replace("minimap_d", "").strip("/\\")
                target_sub = os.path.join(dungeon_out, sub) if sub else dungeon_out
                os.makedirs(target_sub, exist_ok=True)
                dst = os.path.join(target_sub, f"{base_name}.jpg")
                im.convert("RGB").save(dst, quality=85)
                rel_url = f"MINIMAP/dungeon/{sub}/{base_name}.jpg" if sub else f"MINIMAP/dungeon/{base_name}.jpg"
                dungeon_index[f"{sub}/{base_name}" if sub else base_name] = rel_url
                converted_dungeon += 1

            else:
                # UI icons/compass
                dst = os.path.join(ui_out, f"{base_name}.png")
                im.save(dst, "PNG")
                converted_ui += 1

        except Exception as e:
            failed += 1

        if (i + 1) % 1500 == 0:
            print(f"  Processed {i+1}/{len(all_minimaps)} ({time.time()-t0:.1f}s)...")

    # Write catalog
    with open(os.path.join(out_dir, "minimap_index.json"), "w", encoding="utf-8") as f:
        json.dump({
            "totalWorld": converted_world,
            "totalDungeon": converted_dungeon,
            "totalUI": converted_ui,
            "world": world_index,
            "dungeon": dungeon_index
        }, f, indent=2)

    print(f"\n[SUCCESS] Completed Minimap extraction in {time.time()-t0:.1f}s:")
    print(f"  World tiles: {converted_world}")
    print(f"  Dungeon tiles: {converted_dungeon}")
    print(f"  UI assets: {converted_ui}")
    print(f"  Failed: {failed}")

if __name__ == "__main__":
    main()
