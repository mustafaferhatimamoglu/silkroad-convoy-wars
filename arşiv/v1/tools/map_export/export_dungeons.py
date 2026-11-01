import os
import sys
import json
import struct

sys.path.append(r"C:\Silkroad\Silkroad\tools\map_export")
from pk2 import PK2Archive

class BSReader:
    def __init__(self, data: bytes):
        self.b = data
        self.pos = 0

    def read_bytes(self, n):
        res = self.b[self.pos:self.pos+n]
        self.pos += n
        return res

    def read_u8(self):
        v = self.b[self.pos]
        self.pos += 1
        return v

    def read_u16(self):
        v, = struct.unpack_from("<H", self.b, self.pos)
        self.pos += 2
        return v

    def read_i16(self):
        v, = struct.unpack_from("<h", self.b, self.pos)
        self.pos += 2
        return v

    def read_u32(self):
        v, = struct.unpack_from("<I", self.b, self.pos)
        self.pos += 4
        return v

    def read_i32(self):
        v, = struct.unpack_from("<i", self.b, self.pos)
        self.pos += 4
        return v

    def read_f32(self):
        v, = struct.unpack_from("<f", self.b, self.pos)
        self.pos += 4
        return v

    def read_vec3(self):
        x, y, z = struct.unpack_from("<3f", self.b, self.pos)
        self.pos += 12
        return (round(x, 3), round(y, 3), round(z, 3))

    def read_bbox(self):
        return (self.read_vec3(), self.read_vec3())

    def read_string(self):
        length = self.read_i32()
        if length <= 0:
            return ""
        raw = self.read_bytes(length)
        return raw.decode("cp949", "replace")

    def skip(self, n):
        self.pos += n

def parse_dof(data: bytes):
    r = BSReader(data)
    sig = r.read_bytes(12).decode("ascii", "replace")
    if sig != "JMXVDOF 0101":
        raise ValueError(f"Unknown signature {sig}")
    
    r.skip(16)
    file_offset_labels = r.read_u32()
    r.skip(12)

    g_type = r.read_i16()
    g_cat = r.read_i16()
    g_name = r.read_string()
    int01 = r.read_i32()
    int02 = r.read_i32()

    region_id = r.read_u16()
    box1 = r.read_bbox()
    box2 = r.read_bbox()

    block_count = r.read_i32()
    blocks = []
    for _ in range(block_count):
        b_path = r.read_string().replace("\\", "/")
        b_name = r.read_string()
        unk_u01 = r.read_u32()
        pos = r.read_vec3()
        yaw = round(r.read_f32(), 5)
        is_entrance = r.read_u32()
        col_box = r.read_bbox()
        unk_u02 = r.read_u32()

        # FogParam
        fog_col = r.read_u32()
        near_p = round(r.read_f32(), 1)
        far_p = round(r.read_f32(), 1)
        fog_int = round(r.read_f32(), 2)
        has_height_fog = r.read_u8()
        if has_height_fog == 1:
            r.skip(16)

        unk_byte01 = r.read_u8()
        if unk_byte01 == 2:
            r.read_vec3()
            r.read_vec3()
            r.read_u32()

        unk_string = r.read_string()
        room_idx = r.read_u32()
        floor_idx = r.read_u32()

        c_count = r.read_i32()
        r.skip(c_count * 4)
        v_count = r.read_i32()
        r.skip(v_count * 4)

        obj_count = r.read_i32()
        dw_col = r.read_u32()
        objects = []
        for _ in range(obj_count):
            o_path = r.read_string().replace("\\", "/")
            o_name = r.read_string()
            o_pos = r.read_vec3()
            o_rot = r.read_vec3()
            o_scale = r.read_vec3()
            flag = r.read_u32()
            unk_u01 = r.read_u32()
            rad_sqrt = r.read_f32()
            water_col = r.read_u32() if (flag & 4) != 0 else 0
            objects.append({
                "path": o_path, "name": o_name,
                "pos": o_pos, "rot": o_rot, "scale": o_scale
            })

        light_count = r.read_i32()
        lights = []
        for _ in range(light_count):
            l_name = r.read_string()
            l_pos = r.read_vec3()
            r.skip(12 * 3 + 12)
            lights.append({"name": l_name, "pos": l_pos})

        blocks.append({
            "path": b_path, "name": b_name,
            "pos": pos, "yaw": yaw,
            "room": room_idx, "floor": floor_idx,
            "isEntrance": is_entrance,
            "objects": objects, "lights": lights
        })

    # Read RoomNames and FloorNames if available
    room_names = []
    floor_names = []
    if file_offset_labels != 0 and r.pos < len(r.b):
        try:
            r_cnt = r.read_i32()
            for _ in range(r_cnt):
                room_names.append(r.read_string())
            f_cnt = r.read_i32()
            for _ in range(f_cnt):
                floor_names.append(r.read_string())
        except:
            pass

    return {
        "regionId": region_id,
        "name": g_name,
        "box": box1,
        "blocks": blocks,
        "roomNames": room_names,
        "floorNames": floor_names
    }

def main():
    data_pk2_path = r"C:\Silkroad\Silkroad_V2\extracted\client\Data.pk2"
    map_dir = r"C:\Silkroad\Silkroad_V3\MAP"
    dungeons_dir = os.path.join(map_dir, "dungeons")
    os.makedirs(dungeons_dir, exist_ok=True)

    a = PK2Archive(data_pk2_path).scan()

    # Load existing models.json
    models_path = os.path.join(map_dir, "objects", "models.json")
    with open(models_path, "r", encoding="utf-8") as f:
        models = json.load(f)

    # Invert mapping path -> id
    path_to_mid = {v["path"].lower(): int(k) for k, v in models.items()}
    next_mid = max(int(k) for k in models.keys()) + 1

    # Dungeon names mapping
    names_en = {
        "1": "Donwhang Stone Cave",
        "2": "Qin-Shi Tomb (Floor 6)",
        "3": "Qin-Shi Tomb (Floor 5)",
        "4": "Qin-Shi Tomb (Floor 4)",
        "5": "Qin-Shi Tomb (Floor 3)",
        "6": "Qin-Shi Tomb (Floor 2)",
        "7": "Qin-Shi Tomb (Floor 1)",
        "8": "Donwhang Cave Deep",
        "9": "Special Event Dungeon",
        "10": "Pharaoh Tomb (Selkis)",
        "11": "Pharaoh Tomb (Neith)",
        "12": "Pharaoh Tomb (Anubis)",
        "13": "Pharaoh Tomb (Isis)",
        "14": "Pharaoh Tomb (Haroeris)",
        "15": "Seth Temple",
        "16": "Pharaoh Main Cave",
        "17": "Fortress Dungeon",
        "18": "Flame Mountain Dungeon",
        "19": "Jupiter Temple (Di Boss)",
        "20": "Jupiter Temple (Uno Boss)",
        "21": "Jupiter Temple (Upi Boss)",
        "22": "Jupiter Hideout",
        "23": "GM Event Dungeon",
        "24": "Silkroad Prison",
        "25": "Baghdad Underground Cave",
        "26": "Boss Challenge Dungeon",
        "27": "Secret Tomb (Top Level)",
        "28": "Secret Tomb (Bottom Level)",
    }

    # BGM mapping
    music_map = {
        "1": "donwhang_dungeon.ogg",
        "2": "jinsi_dungeon.ogg",
        "3": "jinsi_dungeon.ogg",
        "4": "jinsi_dungeon.ogg",
        "5": "jinsi_dungeon.ogg",
        "6": "jinsi_dungeon.ogg",
        "7": "jinsi_dungeon.ogg",
        "8": "donwhang_dungeon.ogg",
        "9": "event_festival.ogg",
        "10": "egypt_dungeon_temple.ogg",
        "11": "egypt_dungeon_temple.ogg",
        "12": "egypt_dungeon_pharaoh.ogg",
        "13": "egypt_dungeon_pharaoh.ogg",
        "14": "egypt_dungeon_temple.ogg",
        "15": "egypt_dungeon_pharaoh.ogg",
        "16": "egypt_dungeon_temple.ogg",
        "17": "fortress_war.ogg",
        "18": "forgotten_flame.ogg",
        "19": "jupiter_a_boss.ogg",
        "20": "jupiter_a_boss.ogg",
        "21": "jupiter_a_boss.ogg",
        "22": "jupiter_a.ogg",
        "23": "event_festival.ogg",
        "24": "forgotten_ghost.ogg",
        "25": "ARABIA_DUNGEON.ogg",
        "26": "ARABIA_THIEF_BOSS.ogg",
        "27": "forgotten_togui.ogg",
        "28": "forgotten_togui.ogg",
    }

    raw_info = a.read("dungeon/dungeoninfo.txt").decode("latin1")
    dungeons_catalog = []

    for line in raw_info.splitlines():
        line = line.strip()
        if not line or line.startswith("//"):
            continue
        parts = line.split("\t")
        if len(parts) >= 3:
            d_type, d_id, dof_rel = parts[0], parts[1], parts[2].strip('"').replace("\\", "/").lower()
            if dof_rel not in a.files:
                continue

            raw_dof = a.read(dof_rel)
            dof = parse_dof(raw_dof)

            # Assign model IDs to any new models
            all_paths = set()
            for b in dof["blocks"]:
                if b["path"]:
                    all_paths.add(b["path"].lower())
                for o in b["objects"]:
                    if o["path"]:
                        all_paths.add(o["path"].lower())

            for p in all_paths:
                if p not in path_to_mid:
                    path_to_mid[p] = next_mid
                    models[str(next_mid)] = {"flags": 0, "path": p}
                    next_mid += 1

            # Prepare block object list
            dungeon_objects = []
            for b in dof["blocks"]:
                bx, by, bz = b["pos"]
                byaw = b["yaw"]
                b_mid = path_to_mid.get(b["path"].lower(), -1)
                dungeon_objects.append({
                    "model": b_mid, "path": b["path"], "name": b["name"],
                    "pos": [bx, by, bz], "yaw": byaw, "type": "room_block",
                    "room": b["room"], "floor": b["floor"]
                })
                for o in b["objects"]:
                    o_mid = path_to_mid.get(o["path"].lower(), -1)
                    dungeon_objects.append({
                        "model": o_mid, "path": o["path"], "name": o["name"],
                        "pos": o["pos"], "rot": o["rot"], "scale": o["scale"],
                        "type": "prop"
                    })

            clean_name = os.path.splitext(os.path.basename(dof_rel))[0]
            out_file = f"{d_id.zfill(2)}_{clean_name}.json"
            out_path = os.path.join(dungeons_dir, out_file)
            
            dungeon_data = {
                "id": int(d_id),
                "type": int(d_type),
                "name": names_en.get(d_id, clean_name),
                "file": dof_rel,
                "regionId": dof["regionId"],
                "bounds": dof["box"],
                "bgm": music_map.get(d_id, "maintheme_cut.ogg"),
                "rooms": dof["roomNames"],
                "floors": dof["floorNames"],
                "blockCount": len(dof["blocks"]),
                "objectCount": len(dungeon_objects),
                "objects": dungeon_objects
            }

            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(dungeon_data, f, separators=(",", ":"))

            # Also create an entry for objects/{z}_{x}.json for this region ID!
            rid = dof["regionId"]
            rz = (rid >> 8) & 0xFF
            rx = rid & 0xFF
            reg_obj_path = os.path.join(map_dir, "objects", f"{rz}_{rx}.json")
            flat_objs = []
            for idx, obj in enumerate(dungeon_objects):
                flat_objs.append([
                    obj["model"],
                    obj["pos"][0], obj["pos"][1], obj["pos"][2],
                    obj.get("yaw", 0.0),
                    idx,
                    1
                ])
            with open(reg_obj_path, "w", encoding="utf-8") as f:
                json.dump({"region": rid, "fields": ["model", "x", "y", "z", "yaw", "uid", "static"], "objects": flat_objs},
                          f, separators=(",", ":"))

            dungeons_catalog.append({
                "id": int(d_id),
                "name": names_en.get(d_id, clean_name),
                "regionId": dof["regionId"],
                "file": f"dungeons/{out_file}",
                "blocks": len(dof["blocks"]),
                "objects": len(dungeon_objects),
                "bgm": music_map.get(d_id, "maintheme_cut.ogg"),
                "bounds": dof["box"]
            })
            print(f"  [EXPORTED] Dungeon {d_id}: {names_en.get(d_id, clean_name)} -> {out_file} ({len(dungeon_objects)} objects)")

    # Save updated models.json
    with open(models_path, "w", encoding="utf-8") as f:
        json.dump(models, f, indent=0)

    # Save dungeons.json
    dungeons_catalog.sort(key=lambda d: d["id"])
    with open(os.path.join(map_dir, "dungeons.json"), "w", encoding="utf-8") as f:
        json.dump(dungeons_catalog, f, indent=2)

    print(f"\n[SUCCESS] Successfully exported all {len(dungeons_catalog)} Silkroad dungeons to {dungeons_dir}!")
    print(f"Updated models.json with all dungeon 3D assets (total models now: {len(models)})")

if __name__ == "__main__":
    main()
