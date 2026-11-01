import os
import sys
import io
import time
import json
from PIL import Image

sys.path.append(r"C:\Silkroad\Silkroad\tools\map_export")
from pk2 import PK2Archive

def main():
    data_pk2_path = r"C:\Silkroad\Silkroad_V2\extracted\client\Data.pk2"
    models_dir = r"C:\Silkroad\Silkroad_V3\MODELS\models"
    tex_dir = r"C:\Silkroad\Silkroad_V3\MODELS\textures"
    index_path = r"C:\Silkroad\Silkroad_V3\MODELS\models_index.json"

    print("Opening Data.pk2...")
    t0 = time.time()
    a = PK2Archive(data_pk2_path).scan()
    print(f"Scanned {len(a.files)} files in {time.time()-t0:.2f}s")

    # Index DDJ files by basename lowercase
    ddj_map = {}
    for f in a.files:
        if f.endswith(".ddj"):
            base = os.path.splitext(os.path.basename(f))[0].lower()
            if base not in ddj_map:
                ddj_map[base] = f

    print(f"Indexed {len(ddj_map)} unique DDJ basenames.")

    # Process all model JSONs
    model_files = [os.path.join(models_dir, f) for f in os.listdir(models_dir) if f.endswith(".json")]
    print(f"Processing {len(model_files)} model files...")

    converted_pngs = 0
    updated_models = 0
    cached_alpha = {} # base_name -> bool

    for i, m_path in enumerate(model_files):
        with open(m_path, "r", encoding="utf-8") as f:
            m_data = json.load(f)

        modified = False
        for mesh in m_data.get("meshes", []):
            t_rel = mesh.get("texture")
            if not t_rel:
                continue

            base_name = os.path.splitext(os.path.basename(t_rel))[0].lower()

            if base_name in cached_alpha:
                has_a = cached_alpha[base_name]
            else:
                has_a = False
                if base_name in ddj_map:
                    try:
                        raw = a.read(ddj_map[base_name])[20:]
                        im = Image.open(io.BytesIO(raw))
                        if "A" in im.mode and min(im.split()[-1].getextrema()) < 250:
                            has_a = True
                            png_name = base_name + ".png"
                            png_path = os.path.join(tex_dir, png_name)
                            if not os.path.exists(png_path):
                                im.save(png_path, compress_level=1)
                                converted_pngs += 1
                    except Exception as e:
                        pass
                cached_alpha[base_name] = has_a

            if has_a:
                new_tex = f"MODELS/textures/{base_name}.png"
                if mesh.get("texture") != new_tex or not mesh.get("alpha"):
                    mesh["texture"] = new_tex
                    mesh["alpha"] = True
                    modified = True

        if modified:
            with open(m_path, "w", encoding="utf-8") as f:
                json.dump(m_data, f, separators=(",", ":"))
            updated_models += 1

        if (i + 1) % 1000 == 0:
            print(f"  Processed {i+1}/{len(model_files)} models ({time.time()-t0:.1f}s)...")

    # Update models_index.json
    with open(index_path, "r", encoding="utf-8") as f:
        idx_data = json.load(f)

    idx_data["totalAlphaTextures"] = converted_pngs
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(idx_data, f, indent=2)

    print(f"\n[SUCCESS] Completed in {time.time()-t0:.1f}s:")
    print(f"  Exported PNG alpha textures: {converted_pngs}")
    print(f"  Updated models with alpha: {updated_models}")

if __name__ == "__main__":
    main()
