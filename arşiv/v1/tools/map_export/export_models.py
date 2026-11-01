import os
import sys
import io
import time
import json
import struct
from PIL import Image

sys.path.append(r"C:\Silkroad\Silkroad\tools\map_export")
from pk2 import PK2Archive

class BMSParser:
    def __init__(self, data: bytes):
        self.d = data

    def parse(self):
        sig = self.d[:12].decode("ascii", "replace")
        if not sig.startswith("JMXVBMS"):
            return None

        v_off, skin_off, face_off = struct.unpack_from("<3I", self.d, 12)
        pos = 60
        subprim, vflag, unk2 = struct.unpack_from("<3I", self.d, pos)
        pos += 12
        n_len, = struct.unpack_from("<I", self.d, pos)
        pos += 4
        mesh_name = self.d[pos:pos+n_len].decode("latin1", "replace")
        pos += n_len
        m_len, = struct.unpack_from("<I", self.d, pos)
        pos += 4
        mtrl_name = self.d[pos:pos+m_len].decode("latin1", "replace")

        # Vertices
        pos = v_off
        v_cnt, = struct.unpack_from("<I", self.d, pos)
        pos += 4
        positions = []
        normals = []
        uvs = []
        for _ in range(v_cnt):
            px, py, pz, nx, ny, nz, u, v = struct.unpack_from("<3f3f2f", self.d, pos)
            pos += 32
            if vflag & 0x400:
                pos += 8
            if vflag & 0x800:
                pos += 36
            pos += 12
            positions.extend([round(px, 3), round(py, 3), round(-pz, 3)])
            normals.extend([round(nx, 3), round(ny, 3), round(-nz, 3)])
            uvs.extend([round(u, 4), round(1.0 - v, 4)])

        # Faces
        pos = face_off
        f_cnt, = struct.unpack_from("<I", self.d, pos)
        pos += 4
        indices = []
        for _ in range(f_cnt):
            fa, fb, fc = struct.unpack_from("<3H", self.d, pos)
            pos += 6
            indices.extend([fa, fc, fb])

        return {
            "name": mesh_name,
            "material": mtrl_name,
            "positions": positions,
            "normals": normals,
            "uvs": uvs,
            "indices": indices
        }

def parse_bmt(raw_bmt):
    pos = 12
    mtrl_cnt, = struct.unpack_from("<I", raw_bmt, pos)
    pos += 4
    materials = {}
    for _ in range(mtrl_cnt):
        name_len, = struct.unpack_from("<I", raw_bmt, pos)
        pos += 4
        name = raw_bmt[pos:pos+name_len].decode("latin1", "replace")
        pos += name_len
        diff_r, diff_g, diff_b, diff_a = struct.unpack_from("<4f", raw_bmt, pos)
        pos += 64 # 4 Color4
        unk_f0, flag = struct.unpack_from("<fI", raw_bmt, pos)
        pos += 8
        tex_len, = struct.unpack_from("<I", raw_bmt, pos)
        pos += 4
        tex_path = raw_bmt[pos:pos+tex_len].decode("latin1", "replace")
        pos += tex_len
        pos += 7 # unk_f1, b0, b1, is_abs
        materials[name] = {
            "diffuse": [round(diff_r, 2), round(diff_g, 2), round(diff_b, 2), round(diff_a, 2)],
            "texture": tex_path.replace("\\", "/").lower()
        }
    return materials

def main():
    data_pk2_path = r"C:\Silkroad\Silkroad_V2\extracted\client\Data.pk2"
    map_dir = r"C:\Silkroad\Silkroad_V3\MAP"
    out_dir = r"C:\Silkroad\Silkroad_V3\MODELS"
    geom_dir = os.path.join(out_dir, "geometry")
    tex_dir = os.path.join(out_dir, "textures")
    model_dir = os.path.join(out_dir, "models")

    for d in (geom_dir, tex_dir, model_dir):
        os.makedirs(d, exist_ok=True)

    print(f"Loading models from models.json...")
    t0 = time.time()
    models_file = os.path.join(map_dir, "objects", "models.json")
    with open(models_file, "r", encoding="utf-8") as f:
        models_catalog = json.load(f)

    print(f"Scanning Data.pk2...")
    a = PK2Archive(data_pk2_path).scan()

    total_models = len(models_catalog)
    print(f"Found {total_models} models in catalog. Starting export...")

    cached_textures = {}
    cached_geoms = {}
    exported_models_index = {}

    converted_models = 0
    converted_meshes = 0
    converted_textures = 0

    for i, (mid, info) in enumerate(models_catalog.items()):
        bsr_rel = info["path"].lower().replace("\\", "/")
        if bsr_rel not in a.files:
            continue

        try:
            raw_bsr = a.read(bsr_rel)
            (m_off, mesh_off, skel_off, ani_off, pmg_off, pag_off, mod_off, col_off,
             pm_flag, mod_flag, int2, int3, int4) = struct.unpack_from("<13I", raw_bsr, 12)

            # 1. Parse BMT materials
            bmt_materials = {}
            pos = m_off
            mtrl_cnt, = struct.unpack_from("<I", raw_bsr, pos)
            pos += 4
            for _ in range(mtrl_cnt):
                m_id, = struct.unpack_from("<I", raw_bsr, pos)
                pos += 4
                s_len, = struct.unpack_from("<I", raw_bsr, pos)
                pos += 4
                bmt_path = raw_bsr[pos:pos+s_len].decode("latin1", "replace").lower().replace("\\", "/")
                pos += s_len
                if bmt_path in a.files:
                    try:
                        raw_bmt = a.read(bmt_path)
                        parsed_mtrls = parse_bmt(raw_bmt)
                        bmt_dir = os.path.dirname(bmt_path)
                        for m_name, m_info in parsed_mtrls.items():
                            t_file = m_info["texture"]
                            if t_file:
                                t_fname = os.path.basename(t_file)
                                # Look for texture next to BMT or in root
                                cand1 = os.path.join(bmt_dir, t_fname).replace("\\", "/")
                                cand2 = t_file
                                cand3 = os.path.join("res", t_file).replace("\\", "/")
                                final_cand = cand1 if cand1 in a.files else (cand2 if cand2 in a.files else (cand3 if cand3 in a.files else None))
                                if final_cand and final_cand not in cached_textures:
                                    try:
                                        t_raw = a.read(final_cand)
                                        if t_raw[:8] == b"JMXVDDJ ":
                                            t_raw = t_raw[20:]
                                        im = Image.open(io.BytesIO(t_raw))
                                        has_a = "A" in im.mode and min(im.split()[-1].getextrema()) < 250
                                        if has_a:
                                            base_tname = os.path.splitext(t_fname)[0] + ".png"
                                            t_dst = os.path.join(tex_dir, base_tname)
                                            if not os.path.exists(t_dst):
                                                im.save(t_dst, compress_level=1)
                                                converted_textures += 1
                                        else:
                                            base_tname = os.path.splitext(t_fname)[0] + ".jpg"
                                            t_dst = os.path.join(tex_dir, base_tname)
                                            if not os.path.exists(t_dst):
                                                im.convert("RGB").save(t_dst, quality=85)
                                                converted_textures += 1
                                        cached_textures[final_cand] = {
                                            "webTexture": f"MODELS/textures/{base_tname}",
                                            "hasAlpha": has_a
                                        }
                                    except:
                                        pass
                                if final_cand in cached_textures:
                                    m_info["webTexture"] = cached_textures[final_cand]["webTexture"]
                                    m_info["hasAlpha"] = cached_textures[final_cand]["hasAlpha"]
                        bmt_materials.update(parsed_mtrls)
                    except:
                        pass

            # 2. Parse BMS meshes
            pos = mesh_off
            mesh_cnt, = struct.unpack_from("<I", raw_bsr, pos)
            pos += 4
            model_mesh_entries = []

            for _ in range(mesh_cnt):
                s_len, = struct.unpack_from("<I", raw_bsr, pos)
                pos += 4
                m_path = raw_bsr[pos:pos+s_len].decode("latin1", "replace").lower().replace("\\", "/")
                pos += s_len
                if pm_flag & 1:
                    pos += 4

                if m_path not in a.files:
                    continue

                if m_path not in cached_geoms:
                    try:
                        raw_bms = a.read(m_path)
                        parsed_mesh = BMSParser(raw_bms).parse()
                        if parsed_mesh and parsed_mesh["indices"]:
                            clean_mesh_id = os.path.splitext(os.path.basename(m_path))[0]
                            # Handle name collisions with hash
                            geom_filename = f"{clean_mesh_id}.json"
                            geom_dst = os.path.join(geom_dir, geom_filename)
                            
                            three_geom = {
                                "metadata": {"version": 4.5, "type": "BufferGeometry", "generator": "SilkroadModelExporter"},
                                "data": {
                                    "attributes": {
                                        "position": {"itemSize": 3, "type": "Float32Array", "array": parsed_mesh["positions"]},
                                        "normal": {"itemSize": 3, "type": "Float32Array", "array": parsed_mesh["normals"]},
                                        "uv": {"itemSize": 2, "type": "Float32Array", "array": parsed_mesh["uvs"]}
                                    },
                                    "index": {"type": "Uint16Array", "array": parsed_mesh["indices"]}
                                }
                            }
                            with open(geom_dst, "w") as gw:
                                json.dump(three_geom, gw, separators=(",", ":"))

                            cached_geoms[m_path] = {
                                "file": f"MODELS/geometry/{geom_filename}",
                                "material": parsed_mesh["material"]
                            }
                            converted_meshes += 1
                    except:
                        pass

                if m_path in cached_geoms:
                    g_info = cached_geoms[m_path]
                    m_mtrl = bmt_materials.get(g_info["material"], {})
                    model_mesh_entries.append({
                        "geom": g_info["file"],
                        "texture": m_mtrl.get("webTexture", None),
                        "color": m_mtrl.get("diffuse", [0.8, 0.8, 0.8, 1.0]),
                        "alpha": m_mtrl.get("hasAlpha", False)
                    })

            if model_mesh_entries:
                model_entry = {
                    "id": int(mid),
                    "name": os.path.splitext(os.path.basename(bsr_rel))[0],
                    "path": bsr_rel,
                    "meshes": model_mesh_entries
                }
                out_m_file = os.path.join(model_dir, f"{mid}.json")
                with open(out_m_file, "w") as mw:
                    json.dump(model_entry, mw, separators=(",", ":"))

                exported_models_index[str(mid)] = {
                    "name": model_entry["name"],
                    "file": f"MODELS/models/{mid}.json",
                    "meshCount": len(model_mesh_entries)
                }
                converted_models += 1

        except Exception as e:
            pass

        if (i + 1) % 1000 == 0:
            print(f"  Processed {i+1}/{total_models} models ({time.time()-t0:.1f}s)...")

    # Save index
    index_file = os.path.join(out_dir, "models_index.json")
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump({
            "totalExported": converted_models,
            "totalMeshes": converted_meshes,
            "totalTextures": converted_textures,
            "models": exported_models_index
        }, f, indent=2)

    print(f"\n[SUCCESS] Completed 3D Model export in {time.time()-t0:.1f}s:")
    print(f"  Converted models: {converted_models}")
    print(f"  Converted meshes: {converted_meshes}")
    print(f"  Converted textures: {converted_textures}")
    print(f"  Index saved to {index_file}")

if __name__ == "__main__":
    main()
