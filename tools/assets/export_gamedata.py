"""
Silkroad metin verilerinden (Media.pk2 / textdata) oyun verisi uretir.

  python tools/assets/export_gamedata.py

Cikti (assets/data/):
  chars.json     karakter tanimlari: kod -> ad (TR/EN), rol, model anahtari, seviye, can, savunma, tecrube
  spawns.json    bolge ("rz_rx") -> [[tanim indeksi, x, y, z], ...]  (NPC ve canavar dogma noktalari,
                 bolge-yerel Silkroad birimleri)
  goods.json     ticaret mallari: kod, EN ad, ikon
Ikonlar: assets/icons/<ad>.png
"""
import io
import json
import os
import re
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from export_chars import open_pk2, key_of, ROOT  # noqa: E402
import jmx  # noqa: E402

OUT = os.path.join(ROOT, "assets", "data")
ICONS = os.path.join(ROOT, "assets", "icons")
TD = "server_dep/silkroad/textdata/"

ROLE_RULES = [
    (r"_SPECIAL$", "special"), (r"_HORSE$", "stable"), (r"_POTION$", "potion"), (r"_SMITH$", "smith"),
    (r"_ARMOR$", "armor"), (r"_ACCESSORY$", "accessory"), (r"_WAREHOUSE", "warehouse"), (r"_SOLDIER", "guard"),
    (r"_COMMERCE1$", "merchant"), (r"_COMMERCE2$", "smuggler"), (r"_(DOCTOR|DESIGNER)$", "traderGuild"),
    (r"_GENARAL_SW$|_MINISTER$", "hunterGuild"), (r"_FERRY$", "ferry"), (r"_GUILD$", "guild"),
]


def role_of(code):
    if code.startswith("MOB_"):
        return "mob"
    if code.startswith("COS_"):
        return "cos"
    for rx, role in ROLE_RULES:
        if re.search(rx, code):
            return role
    return "npc"


def main():
    media = open_pk2("Media")
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ICONS, exist_ok=True)

    def lines(path):
        raw = media.read(path)
        t = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8", "replace")
        for ln in t.splitlines():
            if ln.strip() and not ln.startswith("//"):
                yield ln.split("\t")

    files = sorted(media.files)
    names = {}
    for p in files:
        if p.startswith(TD + "textdata_object") or p.startswith(TD + "textdata_equip"):
            for r in lines(p):
                if len(r) > 13 and r[0] == "1":
                    en = r[9] if r[9] not in ("", "0") else ""
                    tr = r[13] if r[13] not in ("", "0") else ""
                    names.setdefault(r[2], (tr or en, en))
    # NPC konusmalari: npcchat (kod -> konusma kimlikleri) + textquest_speech&name (kimlik -> metin)
    speech = {}
    for p in files:
        if p.startswith(TD + "textquest_speech"):
            for r in lines(p):
                if len(r) > 13 and r[0] == "1":
                    tr = r[13] if r[13] not in ("", "0") else ""
                    en = r[9] if r[9] not in ("", "0") else ""
                    if tr or en:
                        speech[r[2]] = tr or en
    talk = {}
    for r in lines(TD + "npcchat.txt"):
        if len(r) >= 3 and r[0] == "1":
            t = [speech[s_] for s_ in r[2:4] if s_ in speech]
            if t:
                talk[r[1]] = t
    defs = {}
    for p in files:
        if p.startswith(TD + "characterdata_"):
            for r in lines(p):
                if len(r) < 80 or r[0] != "1":
                    continue
                code, model = r[2], r[52]
                nm = names.get(r[5], ("", ""))

                def num(i):
                    try:
                        return int(float(r[i]))
                    except (ValueError, IndexError):
                        return 0
                defs[int(r[1])] = {
                    "code": code, "name": nm[0], "en": nm[1], "role": role_of(code),
                    "model": key_of("res/" + jmx.norm_path(model)) if model not in ("xxx", "") else None,
                    "lvl": num(57), "hp": num(59), "pd": num(71), "md": num(72), "exp": num(79),
                    "speed": [num(46), num(47)],
                }
                if code in talk:
                    defs[int(r[1])]["talk"] = talk[code]
    # dogma noktalari
    used, spawns = {}, {}
    for r in lines(TD + "npcpos.txt"):
        if len(r) < 5:
            continue
        cid = int(float(r[0]))
        d = defs.get(cid)
        if not d or not d["model"] or any(k in d["code"] for k in ("EVENT", "GACHA", "COS_P_", "CARNIVAL")):
            continue
        reg = int(float(r[1]))
        if reg & 0x8000:            # zindan (dungeon) bolgeleri
            continue
        if cid not in used:
            used[cid] = len(used)
        key = f"{reg >> 8}_{reg & 255}"
        spawns.setdefault(key, []).append([used[cid], round(float(r[2]), 1), round(float(r[3]), 2), round(float(r[4]), 1)])
    table = [None] * len(used)
    for cid, i in used.items():
        table[i] = dict(defs[cid], id=cid)
    with open(os.path.join(OUT, "chars.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(table, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "spawns.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(spawns, f, separators=(",", ":"))
    n_npc = sum(1 for d in table if d["role"] not in ("mob", "cos"))
    print(f"{len(table)} tanim ({n_npc} NPC), {sum(len(v) for v in spawns.values())} dogma noktasi, {len(spawns)} bolge")

    # ticaret mallari + ikonlar
    goods = []
    for code, (tr, en) in sorted(names.items()):
        m = re.match(r"SN_ITEM_ETC_TRADE_([A-Z]{2})_(\d\d)$", code)
        if not m or not en:
            continue
        reg, num = m.group(1).lower(), m.group(2)
        icon = f"item/etc/trade_{reg}_{num}.ddj"
        out_icon = None
        for cand in (icon, "icon/" + icon):
            if cand in media.files:
                try:
                    im = Image.open(io.BytesIO(jmx.ddj_to_dds(media.read(cand))))
                    name = f"trade_{reg}_{num}.png"
                    im.convert("RGBA").save(os.path.join(ICONS, name))
                    out_icon = "icons/" + name
                except Exception as e:
                    print("  ! ikon", cand, e)
                break
        goods.append({"code": f"{m.group(1)}_{num}", "en": en, "icon": out_icon})
    with open(os.path.join(OUT, "goods.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(goods, f, ensure_ascii=False, indent=1)
    print(len(goods), "ticaret mali,", sum(1 for g in goods if g["icon"]), "ikon")


if __name__ == "__main__":
    main()
