import os
import sys
import json
import time

sys.path.append(r"C:\Silkroad\Silkroad\tools\map_export")
from pk2 import PK2Archive

def main():
    pk2_path = r"C:\Silkroad\Silkroad_V2\extracted\client\Music.pk2"
    out_dir = r"C:\Silkroad\Silkroad_V3\MUSIC"
    os.makedirs(out_dir, exist_ok=True)

    print(f"Extracting Music.pk2 to {out_dir}...")
    t0 = time.time()
    a = PK2Archive(pk2_path).scan()

    music_catalog = []
    
    # Area mapping
    area_names = {
        "jangan_town": "Jangan Town",
        "jangan_field": "Jangan Outskirts / Bicheon Plain",
        "donwhang_town": "Donwhang City",
        "donwhang_field": "Donwhang Field / Oasis",
        "donwhang_dungeon": "Donwhang Stone Cave Dungeon",
        "hotan_field": "Hotan Field / Tarim Basin",
        "karakoram_field": "Karakoram Icefield",
        "taklamakan_field": "Taklamakan Desert",
        "asiaminor_field": "Asia Minor",
        "centralasia_field": "Central Asia (Samarkand Outskirts)",
        "centralasia_town": "Samarkand Town",
        "easterneurope_town": "Constantinople",
        "easterneurope_field": "East Europe Plain",
        "egypt_town_alexandria1": "Alexandria Harbor",
        "egypt_town_alexandria2": "Alexandria City",
        "egypt_field_delta": "Delta Field",
        "egypt_field_kingsvalley": "Valley of Kings",
        "egypt_field_stormdesert": "Storm and Cloud Desert",
        "egypt_dungeon_temple": "Pharaoh Temple Dungeon",
        "egypt_dungeon_pharaoh": "Pharaoh Tomb Dungeon",
        "jinsi_dungeon": "Qin-Shi Emperor Tomb Dungeon",
        "mtrok_field": "Roc Mountain",
        "roc_battle": "Roc Boss Battle",
        "roc_entrance": "Gate to Roc Mountain",
        "roc_bgm_total": "Roc Peak Theme",
        "fortress_war": "Fortress Siege War",
        "ARABIA_TOWN": "Baghdad City",
        "ARABIA_FIELD": "Arabian Coast",
        "ARABIA_DESERT": "Arabian Desert",
        "ARABIA_DUNGEON": "Arabian Underground Dungeon",
        "ARABIA_THIEF_BOSS": "Arabian Thief Boss Battle",
        "jupiter_field": "Temple of Jupiter",
        "jupiter_a": "Jupiter Hall",
        "jupiter_a_boss": "Jupiter Boss Encounter",
        "forgotten_flame": "Flame Mountain",
        "forgotten_ghost": "Ghost Ship / Wreckage",
        "forgotten_togui": "Togui Village",
        "battlearena_1": "Battle Arena PVP",
        "maintheme_cut": "Main Title Theme",
        "shiningstar": "Silkroad Theme Song (Shining Star)",
        "arabia_login": "Arabia Login Screen",
        "event_festival": "Silkroad Festival Event",
        "event_ghost": "Halloween Event",
        "event_carol_01": "Winter Carol 1",
        "event_carol_02": "Winter Carol 2",
        "event_carol_03": "Winter Carol 3",
        "event_carol_04": "Winter Carol 4",
    }

    for name_lower, entry in sorted(a.files.items()):
        raw = a.read(entry)
        fname = os.path.basename(entry.path)
        dst = os.path.join(out_dir, fname)
        with open(dst, "wb") as w:
            w.write(raw)
        
        base_id = os.path.splitext(fname)[0]
        title = area_names.get(base_id, area_names.get(base_id.lower(), base_id))
        music_catalog.append({
            "id": base_id,
            "title": title,
            "filename": fname,
            "size": len(raw),
            "url": f"MUSIC/{fname}"
        })
        print(f"  [EXTRACTED] {fname} ({len(raw)//1024} KB) - {title}")

    # Write music_index.json
    index_path = os.path.join(out_dir, "music_index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(music_catalog, f, indent=2)

    print(f"\n[SUCCESS] Extracted all {len(music_catalog)} soundtracks to {out_dir} ({time.time()-t0:.1f}s)")
    print(f"Generated {index_path}")

if __name__ == "__main__":
    main()
