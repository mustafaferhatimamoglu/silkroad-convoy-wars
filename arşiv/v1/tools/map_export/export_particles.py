import os
import sys
import io
import time
import json
from PIL import Image

sys.path.append(r"C:\Silkroad\Silkroad\tools\map_export")
from pk2 import PK2Archive

def main():
    pk2_path = r"C:\Silkroad\Silkroad_V2\extracted\client\Particles.pk2"
    out_dir = r"C:\Silkroad\Silkroad_V3\PARTICLES"
    os.makedirs(out_dir, exist_ok=True)

    print(f"Scanning Particles.pk2...")
    t0 = time.time()
    a = PK2Archive(pk2_path).scan()

    total = len(a.files)
    print(f"Found {total} particle files. Extracting and converting...")

    efp_count = 0
    ddj_count = 0
    mesh_count = 0
    other_count = 0

    effects_list = []

    for i, (path, entry) in enumerate(sorted(a.files.items())):
        try:
            raw = a.read(entry)
            rel_path = entry.path.replace("\\", "/")
            ext = os.path.splitext(rel_path)[1].lower()

            if ext == ".ddj":
                # Convert texture to PNG
                if raw[:8] == b"JMXVDDJ ":
                    dds_data = raw[20:]
                else:
                    dds_data = raw
                try:
                    im = Image.open(io.BytesIO(dds_data))
                    out_rel = os.path.splitext(rel_path)[0] + ".png"
                    dst = os.path.join(out_dir, *out_rel.split("/"))
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    im.save(dst, "PNG")
                    ddj_count += 1
                except:
                    # save raw
                    dst = os.path.join(out_dir, *rel_path.split("/"))
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    with open(dst, "wb") as f:
                        f.write(raw)
            else:
                # Save raw effect/mesh/animation file
                dst = os.path.join(out_dir, *rel_path.split("/"))
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, "wb") as f:
                    f.write(raw)

                if ext == ".efp":
                    efp_count += 1
                    effects_list.append(rel_path)
                elif ext in (".bms", ".ban", ".bsk"):
                    mesh_count += 1
                else:
                    other_count += 1

        except Exception as e:
            pass

        if (i + 1) % 1500 == 0:
            print(f"  Processed {i+1}/{total} ({time.time()-t0:.1f}s)...")

    # Catalog
    catalog = {
        "totalFiles": total,
        "effectsCount": efp_count,
        "texturesCount": ddj_count,
        "meshCount": mesh_count,
        "effects": sorted(effects_list)
    }
    with open(os.path.join(out_dir, "particles_index.json"), "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    print(f"\n[SUCCESS] Completed Particles extraction in {time.time()-t0:.1f}s:")
    print(f"  Effects (.efp): {efp_count}")
    print(f"  Textures converted to PNG: {ddj_count}")
    print(f"  Meshes & Animations: {mesh_count}")
    print(f"  Catalog saved to particles_index.json")

if __name__ == "__main__":
    main()
