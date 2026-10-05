"""
Silkroad karakter / NPC / binek / canavar kaynaklarini web bicimine donusturur.

  python tools/assets/export_chars.py                 # varsayilan liste (sehir NPC'leri, oyuncu, kervan, haydutlar)
  python tools/assets/export_chars.py res/mob/china/bandit.bsr ...

Cikti (assets/chars/):
  index.json          kaynak anahtari -> dosya + ozet (kemik/mesh/animasyon sayisi, boy)
  <anahtar>.json      iskelet (yerel bag pozu), mesh tanimlari, malzemeler, animasyonlar
  <anahtar>.bin       ikili veri: konum/normal/uv/kemik indeks+agirlik/indeks, animasyon anahtarlari
  tex/*.png|jpg       dokular (paylasimli)

Donusum: Silkroad z ekseni aynalanir (x, y, -z), dortluler (-x, -y, z, w), ucgen sirasi
ters cevrilir; birim desimetreden metreye (x0.1). Ayni malzemeyi kullanan mesh parcalari
tek geometride birlestirilir (oyuncu karakteri 9 parca -> 2-3 cizim cagrisi).
"""
import io
import json
import os
import pickle
import re
import struct
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pk2 import PK2Archive  # noqa: E402
import jmx  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CLIENT = r"C:\Silkroad\SRO_Client"
OUT = os.path.join(ROOT, "assets", "chars")
CACHE = os.path.join(os.path.dirname(__file__), ".cache")
SCALE = 0.1


def open_pk2(name):
    os.makedirs(CACHE, exist_ok=True)
    a = PK2Archive(os.path.join(CLIENT, name + ".pk2"))
    cache = os.path.join(CACHE, name + ".idx.pkl")
    if os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(a.path):
        a.files, a.dirs = pickle.load(open(cache, "rb"))
    else:
        a.scan()
        pickle.dump((a.files, a.dirs), open(cache, "wb"))
    return a


# ---------------------------------------------------------------- animasyon secimi
# anahtar -> ad kaliplari (oncelik sirasiyla). Ad = .ban dosya adi (uzantisiz, kucuk harf).
GENERIC = [
    ("idle", [r"(^|_)stand0?1$", r"(^|_)stand$", r"_basic$", r"standcity$", r"(^|_)wait$", r"stand"]),
    ("idle2", [r"(^|_)stand0?2$", r"_time$"]),
    ("walk", [r"(^|_)walk0?1?$", r"walkforward$", r"walk"]),
    ("run", [r"(^|_)run0?1?$", r"runforward$", r"(^|_)run"]),
    ("attack1", [r"attack0?1$"]),
    ("attack2", [r"attack0?2$"]),
    ("attack3", [r"attack0?3$"]),
    ("hit", [r"damage0?1$", r"benormalhit$"]),
    ("hit2", [r"damage0?2$"]),
    ("die", [r"(^|_)die$", r"diehardhit$"]),
    ("dead", [r"die_loop$", r"diehardhit_loop$"]),
    ("down", [r"(^|_)down$"]),
    ("wakeup", [r"wakeup$", r"down_up$"]),
]
# Oyuncu karakteri (cinli/avrupali erkek-kadin): dovus, yuruyus, araba, selam, oturma
PLAYER = {
    "idle": [r"_standcity$", r"_standcity02$"],
    "idleBattle": [r"_standbattle$"],
    "walk": [r"_walkforward$"],
    "run": [r"_runforward$"],
    "walkBack": [r"_walkbackward$"],
    "punchL": [r"_handstraightl$"],
    "punchR": [r"_handstraightr$"],
    "hookL": [r"_handhookl$"],
    "hit": [r"_benormalhit$"],
    "hitHard": [r"_behardhit$"],
    "die": [r"_diehardhit$"],
    "dead": [r"_diehardhit_loop$"],
    "sit": [r"_sitground$"],
    "sitStand": [r"_sitstand$"],
    "pickup": [r"_pickup$"],
    "greet": [r"_emot_act_greeting$"],
    "joy": [r"_emot_act_joy$"],
    "cartIdle": [r"^cart_stand01$"],
    "cartWalk": [r"^cart_walk$"],
    "swordIdle": [r"^sword_stand$", r"^blade_stand$"],
    "swordRun": [r"^sword_run", r"^blade_run"],
    "swordAttack1": [r"skill_ch_sword_base_a$", r"skill_ch_blade_base_a$", r"sword_attack"],
    "swordAttack2": [r"skill_ch_sword_base_b$", r"skill_ch_blade_base_b$"],
    "swordAttack3": [r"skill_ch_sword_base_c$", r"skill_ch_blade_base_c$"],
    "spearIdle": [r"^spear_stand$"],
    "spearWalk": [r"^spear_walk_fighter$", r"^spear_walk"],
    "spearRun": [r"^spear_run_fighter$", r"^spear_run"],
    "spearAttack1": [r"skill_ch_spear_base_a$"],
    "spearAttack2": [r"skill_ch_spear_base_b$"],
    "spearAttack3": [r"skill_ch_spear_base_c$"],
    "bowIdle": [r"^bow_stand$"],
    "bowRun": [r"^bow_run"],
    "bowShoot": [r"skill_ch_bow_normal$", r"skill_ch_bow_shoot$"],
}


def pick_anims(paths, player=False):
    names = [(os.path.splitext(os.path.basename(p))[0], p) for p in paths]
    out = {}
    rules = PLAYER.items() if player else GENERIC
    for key, pats in rules:
        for pat in pats:
            rx = re.compile(pat)
            hit = next((p for n, p in names if rx.search(n)), None)
            if hit:
                out[key] = hit
                break
    if not player and "idle" not in out and names:
        out["idle"] = names[0][1]   # tek animasyonlu NPC'ler: animasyon NPC'nin kendi adini tasir
    return out


# ---------------------------------------------------------------- doku
class TextureStore:
    def __init__(self, pk2, out_dir):
        self.pk2 = pk2
        self.dir = os.path.join(out_dir, "tex")
        os.makedirs(self.dir, exist_ok=True)
        self.done = {}

    def resolve(self, bmt_path, tex):
        base = os.path.basename(tex)
        for c in (os.path.dirname(bmt_path) + "/" + base, tex, "res/" + tex, "prim/mtrl/" + base):
            c = jmx.norm_path(c)
            if c in self.pk2.files:
                return c
        return None

    def get(self, src):
        """PK2 doku yolu -> {'file': 'tex/x.jpg', 'alpha': bool} (onbellekli)."""
        if src in self.done:
            return self.done[src]
        res = None
        try:
            im = Image.open(io.BytesIO(jmx.ddj_to_dds(self.pk2.read(src))))
            im.load()
            alpha = "A" in im.getbands() and im.getchannel("A").getextrema()[0] < 250
            stem = os.path.splitext(os.path.basename(src))[0]
            if alpha:
                name = stem + ".png"
                dst = os.path.join(self.dir, name)
                if not os.path.exists(dst):
                    im.convert("RGBA").save(dst, optimize=False, compress_level=6)
            else:
                name = stem + ".jpg"
                dst = os.path.join(self.dir, name)
                if not os.path.exists(dst):
                    im.convert("RGB").save(dst, quality=88)
            res = {"file": "tex/" + name, "alpha": bool(alpha), "size": im.size}
        except Exception as e:  # bozuk/eksik doku: duz renk kullanilir
            print("   ! doku okunamadi", src, e)
        self.done[src] = res
        return res


# ---------------------------------------------------------------- donusumler
def mq(q):
    return (-q[0], -q[1], q[2], q[3])


def mt(t):
    return (t[0] * SCALE, t[1] * SCALE, -t[2] * SCALE)


class Bin:
    def __init__(self):
        self.buf = bytearray()

    def add(self, fmt, values):
        while len(self.buf) % 4:
            self.buf.append(0)
        off = len(self.buf)
        self.buf += struct.pack(f"<{len(values)}{fmt}", *values)
        return off


# Kiyafet yuvasi -> ortulen govde parcalari (dosya adinda gecen parca adi)
SLOT_COVERS = {"ba": ("torso_upper", "torso_lower"), "la": ("pelvis", "thigh"), "sa": ("arm_upper",),
               "aa": ("arm_lower",), "fa": ("calf",), "ha": ("hair",)}

# Oyuncu gorunumleri: govde kaynagi + kiyafet seti + tuccar sancagi (meslek isareti)
OUTFITS = {
    "player_ch_m": ("res/char/china/chinaman_merchant.bsr",
                    [f"res/item/china/man_item/clothes_03_{s}.bsr" for s in ("ba", "la", "sa", "aa", "fa")] + ["res/item/china/man_item/trader_02.bsr"]),
    "player_ch_w": ("res/char/china/chinawoman_merchant.bsr",
                    [f"res/item/china/woman_item/clothes_03_{s}.bsr" for s in ("ba", "la", "sa", "aa", "fa")] + ["res/item/china/woman_item/trader_02.bsr"]),
    "player_eu_m": ("res/char/europe/europeman_merchant.bsr",
                    [f"res/item/europe/man_item/clothes_03_{s}.bsr" for s in ("ba", "la", "sa", "aa", "fa")]),
    "player_eu_w": ("res/char/europe/europewoman_merchant.bsr",
                    [f"res/item/europe/woman_item/clothes_03_{s}.bsr" for s in ("ba", "la", "sa", "aa", "fa")]),
}


def nearest_bone(bones, p):
    """Bag pozunda p noktasina (Silkroad uzayi) en yakin govde kemigi (parmak/uc kemikleri haric)."""
    best, bi = 1e18, 0
    for i, b in enumerate(bones):
        n = b["name"]
        if "Nub" in n or "Finger" in n or "Toe" in n:
            continue
        d = sum((b["tw"][k] - p[k]) ** 2 for k in range(3))
        if d < best:
            best, bi = d, i
    return bi


def hide_covered(data_pk2, base_meshes, item_meshes, reach=0.6, need=0.7):
    """
    Kiyafetin ortlugu govde parcalarini cikarir. Her govde tepe noktasindan normali yonunde
    isin atilir; isin `reach` (Silkroad birimi, 0.6 = 6 cm) icinde bir kiyafet ucgenine
    carpiyorsa nokta ortulu sayilir. Noktalarin `need` orani ortuluyse parca gizlenir.
    (Basit "yuva -> parca" kurali her sette tutmuyor: dizde biten etek + bilek cizmesinde
    baldir acikta kalmali.) Yuz hicbir zaman gizlenmez.
    """
    import numpy as np
    tris = []
    for path, _ in item_meshes:
        if path not in data_pk2.files:
            continue
        m = jmx.parse_bms(data_pk2.read(path))
        P = np.array(m["pos"], dtype=np.float64).reshape(-1, 3)
        I = np.array(m["idx"], dtype=np.int64).reshape(-1, 3)
        tris.append(P[I])
    if not tris:
        return base_meshes
    T = np.concatenate(tris)                        # (M, 3, 3)
    v0, e1, e2 = T[:, 0], T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]
    keep = []
    for path, flag in base_meshes:
        name = os.path.basename(path)
        if "face" in name or path not in data_pk2.files:
            keep.append((path, flag))
            continue
        m = jmx.parse_bms(data_pk2.read(path))
        O = np.array(m["pos"], dtype=np.float64).reshape(-1, 3)
        D = np.array(m["nrm"], dtype=np.float64).reshape(-1, 3)
        D /= np.maximum(np.linalg.norm(D, axis=1, keepdims=True), 1e-9)
        O = O - D * 0.05                            # yuzeyin hemen icinden baslat
        covered = 0
        for k in range(0, len(O), 256):             # Moller-Trumbore, toplu
            o, d = O[k:k + 256, None, :], D[k:k + 256, None, :]
            pv = np.cross(d, e2[None])
            det = np.einsum("nmk,nmk->nm", np.broadcast_to(e1[None], pv.shape), pv)
            ok = np.abs(det) > 1e-9
            inv = np.where(ok, 1.0 / np.where(ok, det, 1.0), 0.0)
            tv = o - v0[None]
            u = np.einsum("nmk,nmk->nm", tv, pv) * inv
            qv = np.cross(tv, np.broadcast_to(e1[None], tv.shape))
            v = np.einsum("nmk,nmk->nm", d, qv) * inv
            t = np.einsum("nmk,nmk->nm", np.broadcast_to(e2[None], qv.shape), qv) * inv
            hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0) & (t < reach + 0.05)
            covered += int(hit.any(axis=1).sum())
        frac = covered / max(1, len(O))
        if frac < need:
            keep.append((path, flag))
        print(f"      govde {name}: %{frac * 100:.0f} ortulu -> {'gizli' if frac >= need else 'gorunur'}")
    return keep


def export_resource(data_pk2, tex, bsr_path, key, player=False, max_anims=None, items=None):
    bsr = jmx.parse_bsr(data_pk2.read(bsr_path))
    if not bsr["skeleton"] or bsr["skeleton"] not in data_pk2.files:
        print("   ! iskelet yok:", bsr_path, bsr["skeleton"])
        return None
    bones = jmx.parse_bsk(data_pk2.read(bsr["skeleton"]))
    bindex = {b["name"]: i for i, b in enumerate(bones)}
    # kiyafet parcalari: malzeme ve mesh listesine eklenir, iskelete kemik adiyla baglanir
    item_meshes = []
    item_mats = []
    for it in items or []:
        if it not in data_pk2.files:
            print("   ! kiyafet yok", it)
            continue
        ib = jmx.parse_bsr(data_pk2.read(it))
        item_mats += ib["materials"]
        item_meshes += ib["meshes"]
    # malzemeler
    mats = {}
    for _, bmt_path in bsr["materials"] + item_mats:
        if bmt_path not in data_pk2.files:
            continue
        try:
            for name, m in jmx.parse_bmt(data_pk2.read(bmt_path)).items():
                src = tex.resolve(bmt_path, m["texture"]) if m["texture"] else None
                mats.setdefault(name, {"diffuse": m["diffuse"], "src": src, "flag": m["flag"]})
        except Exception as e:
            print("   ! BMT okunamadi", bmt_path, e)
    # mesh secimi: "default" mesh grubu varsa onu kullan
    meshes = bsr["meshes"]
    if bsr["meshGroups"]:
        g = next((g for g in bsr["meshGroups"] if g[0].lower() == "default"), bsr["meshGroups"][0])
        if g[1] and all(i < len(meshes) for i in g[1]):
            meshes = [meshes[i] for i in g[1]]
    if item_meshes:
        meshes = hide_covered(data_pk2, meshes, item_meshes) + item_meshes
    # malzemeye gore birlestir
    groups = {}
    for path, _flag in meshes:
        if path not in data_pk2.files:
            print("   ! mesh yok", path)
            continue
        m = jmx.parse_bms(data_pk2.read(path))
        missing = {k for k, n in enumerate(m["bones"]) if n not in bindex}
        bad = set()
        g = groups.setdefault(m["material"], {"pos": [], "nrm": [], "uv": [], "si": [], "sw": [], "idx": []})
        base = len(g["pos"]) // 3
        nv = len(m["pos"]) // 3
        for i in range(nv):
            x, y, z = m["pos"][i * 3:i * 3 + 3]
            g["pos"] += [x * SCALE, y * SCALE, -z * SCALE]
            nx, ny, nz = m["nrm"][i * 3:i * 3 + 3]
            g["nrm"] += [nx, ny, -nz]
            u, v = m["uv"][i * 2:i * 2 + 2]
            g["uv"] += [u, v]
            if m["skin"]:
                b0, w0, b1, w1 = m["skin"][i]
                if b0 in missing or b1 in missing:
                    # kiyafetin kendi iskeletine (karakterde olmayan) bagli sus: noktalari kendi
                    # cercevesinde tanimli (ayak hizasinda) -> bu ucgenler atilir
                    bad.add(i)
                i0 = bindex.get(m["bones"][b0], 0) if b0 != 0xFF and b0 < len(m["bones"]) else 0
                i1 = bindex.get(m["bones"][b1], 0) if b1 != 0xFF and b1 < len(m["bones"]) else 0
                fw0 = w0 / 65535.0 if b0 != 0xFF else 0.0
                fw1 = w1 / 65535.0 if b1 != 0xFF else 0.0
                s = fw0 + fw1
                if s <= 1e-6:
                    fw0, fw1, s = 1.0, 0.0, 1.0
                g["si"] += [i0, i1, 0, 0]
                g["sw"] += [fw0 / s, fw1 / s, 0.0, 0.0]
            else:
                g["si"] += [0, 0, 0, 0]
                g["sw"] += [1.0, 0.0, 0.0, 0.0]
        idx = m["idx"]
        for k in range(0, len(idx), 3):
            if bad and (idx[k] in bad or idx[k + 1] in bad or idx[k + 2] in bad):
                continue
            g["idx"] += [base + idx[k], base + idx[k + 2], base + idx[k + 1]]
    if not groups:
        return None
    b = Bin()
    out_meshes, out_mats = [], []
    ymin, ymax = 1e9, -1e9
    for mname, g in groups.items():
        info = mats.get(mname) or next(iter(mats.values()), None) or {"diffuse": (1, 1, 1, 1), "src": None, "flag": 0}
        t = tex.get(info["src"]) if info["src"] else None
        # BMT bayragi 0x1: alfa testi + cift yuz (sac, yele, pelerin, sancak). Govde dokularinin
        # alfa kanali saydamlik degil (parlaklik maskesi): bayraksiz malzemede alfa kullanilmaz.
        cut = bool(info.get("flag", 0) & 1)
        out_mats.append({"n": mname, "tex": t["file"] if t else None, "alpha": bool(t and t["alpha"] and cut),
                         "twoSided": cut, "color": [round(c, 3) for c in info["diffuse"][:3]]})
        nv = len(g["pos"]) // 3
        ys = g["pos"][1::3]
        ymin, ymax = min(ymin, min(ys)), max(ymax, max(ys))
        big = nv > 65535
        out_meshes.append({
            "mat": len(out_mats) - 1, "v": nv, "i": len(g["idx"]),
            "pos": b.add("f", g["pos"]), "nrm": b.add("f", g["nrm"]), "uv": b.add("f", g["uv"]),
            "si": b.add("H", g["si"]), "sw": b.add("f", g["sw"]),
            "idx": b.add("I" if big else "H", g["idx"]), "idx32": big,
        })
    # iskelet (yerel bag pozu)
    out_bones = []
    for bn in bones:
        out_bones.append({"n": bn["name"], "p": bindex.get(bn["parent"], -1),
                          "t": [round(v, 5) for v in mt(bn["t"])], "q": [round(v, 6) for v in mq(bn["q"])]})
    # animasyonlar
    chosen = pick_anims(bsr["anims"], player)
    if max_anims:
        chosen = dict(list(chosen.items())[:max_anims])
    out_anims = {}
    for akey, apath in chosen.items():
        if apath not in data_pk2.files:
            continue
        try:
            an = jmx.parse_ban(data_pk2.read(apath))
        except Exception as e:
            print("   ! BAN okunamadi", apath, e)
            continue
        times = [t / 1000.0 for t in an["times"]]
        if not times:
            continue
        tracks = []
        for bone, keys in an["tracks"]:
            bi = bindex.get(bone)
            if bi is None or len(keys) != len(times):
                continue
            qs, ts = [], []
            for q, t in keys:
                qs += mq(q)
                ts += mt(t)
            tracks.append({"b": bi, "q": b.add("f", qs), "t": b.add("f", ts)})
        out_anims[akey] = {"src": os.path.basename(apath), "dur": an["duration"] / 1000.0, "loop": bool(an["looped"]),
                           "n": len(times), "times": b.add("f", times), "tracks": tracks}
    meta = {"key": key, "src": bsr_path, "name": bsr["name"], "height": round(ymax - ymin, 3),
            "bones": out_bones, "meshes": out_meshes, "materials": out_mats, "anims": out_anims}
    with open(os.path.join(OUT, key + ".bin"), "wb") as f:
        f.write(b.buf)
    with open(os.path.join(OUT, key + ".json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    import hashlib
    ver = hashlib.md5(bytes(b.buf) + json.dumps(meta, sort_keys=True).encode()).hexdigest()[:10]
    return {"file": key + ".json", "v": ver, "bones": len(out_bones), "meshes": len(out_meshes),
            "anims": sorted(out_anims), "height": meta["height"], "bytes": len(b.buf)}


def key_of(bsr_path):
    return re.sub(r"[^a-z0-9_]+", "_", os.path.splitext(bsr_path[4:] if bsr_path.startswith("res/") else bsr_path)[0])


DEFAULT = [
    # oyuncu gorunumleri
    "res/char/china/chinaman_merchant.bsr", "res/char/china/chinaman_warrior.bsr", "res/char/china/chinaman_adventurer.bsr",
    "res/char/china/chinawoman_merchant.bsr", "res/char/china/chinawoman_warrior.bsr",
    "res/char/europe/europeman_merchant.bsr", "res/char/europe/europewoman_merchant.bsr",
    # kervan binekleri ve muhafizlar
    "res/cos/t_horse1.bsr", "res/cos/t_horse2.bsr", "res/cos/t_camel1.bsr", "res/cos/t_camel2.bsr", "res/cos/t_donkey.bsr",
    "res/cos/t_buffalo.bsr", "res/cos/ch_guard_spear.bsr", "res/cos/ch_guard_bow.bsr", "res/cos/eu_guard_spear.bsr",
    "res/cos/is_guard_blade.bsr",
    # yol haydutlari
    "res/mob/china/bandit.bsr", "res/mob/china/banditarcher.bsr", "res/mob/oasis/blackrobber.bsr", "res/mob/oasis/blackrobberarcher.bsr",
]


def city_npc_resources():
    """npcpos.txt + characterdata: 6 sehrin cevresindeki NPC modelleri (etkinlik NPC'leri haric)."""
    media = open_pk2("Media")
    td = "server_dep/silkroad/textdata/"

    def lines(path):
        raw = media.read(path)
        t = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8", "replace")
        for ln in t.splitlines():
            if ln.strip() and not ln.startswith("//"):
                yield ln.split("\t")

    chars = {}
    for p in media.files:
        if p.startswith(td + "characterdata_"):
            for r in lines(p):
                if len(r) > 52 and r[0] == "1":
                    chars[int(r[1])] = (r[2], r[52])
    cities = [(168, 97), (153, 102), (135, 92), (108, 106), (79, 105), (48, 90)]
    res = set()
    for r in lines(td + "npcpos.txt"):
        if len(r) < 5:
            continue
        reg = int(float(r[1]))
        rx, rz = reg & 255, reg >> 8
        if not any(abs(rx - cx) <= 2 and abs(rz - cz) <= 2 for cx, cz in cities):
            continue
        c = chars.get(int(float(r[0])))
        if not c or not c[0].startswith("NPC_") or "EVENT" in c[0] or "GACHA" in c[0] or c[1] in ("xxx", ""):
            continue
        res.add("res/" + jmx.norm_path(c[1]))
    return sorted(res)


ROUTE = [(168, 97), (153, 102), (135, 92), (108, 106), (79, 105), (48, 90)]   # Jangan -> ... -> Iskenderiye


def corridor_mob_resources(data_pk2, width=3):
    """assets/data (export_gamedata.py) uzerinden: Ipek Yolu koridorunda dogan canavarlarin modelleri."""
    import math
    dpath = os.path.join(ROOT, "assets", "data")
    table = json.load(open(os.path.join(dpath, "chars.json"), encoding="utf-8"))
    spawns = json.load(open(os.path.join(dpath, "spawns.json"), encoding="utf-8"))

    def dseg(p, a, b):
        dx, dz = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)))
        return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz))
    want = set()
    for k, v in spawns.items():
        rz, rx = map(int, k.split("_"))
        if min(dseg((rx, rz), ROUTE[i], ROUTE[i + 1]) for i in range(len(ROUTE) - 1)) > width:
            continue
        for e in v:
            d = table[e[0]]
            if d["role"] == "mob" and d["model"]:
                want.add(d["model"])
    by_key = {key_of(p): p for p in data_pk2.files if p.startswith("res/mob/") and p.endswith(".bsr")}
    return sorted(by_key[k] for k in want if k in by_key)


def main():
    os.makedirs(OUT, exist_ok=True)
    data = open_pk2("Data")
    tex = TextureStore(data, OUT)
    args = sys.argv[1:]
    outfits = OUTFITS if not args or "--outfits" in args else {}
    corridor = "--corridor" in args or not args
    args = [a for a in args if a not in ("--outfits", "--corridor")]
    targets = [jmx.norm_path(a) for a in args]
    if not targets and not (outfits and len(sys.argv) > 1 and not corridor):
        targets = DEFAULT + city_npc_resources()
    if corridor and os.path.exists(os.path.join(ROOT, "assets", "data", "chars.json")):
        targets += [p for p in corridor_mob_resources(data) if p not in targets]
    index_path = os.path.join(OUT, "index.json")
    index = json.load(open(index_path, encoding="utf-8")) if os.path.exists(index_path) else {}
    for i, path in enumerate(targets):
        if path not in data.files:
            print(f"[{i + 1}/{len(targets)}] YOK {path}")
            continue
        key = key_of(path)
        player = path.startswith("res/char/")
        try:
            r = export_resource(data, tex, path, key, player=player)
        except Exception as e:
            print(f"[{i + 1}/{len(targets)}] HATA {path}: {e}")
            continue
        if r:
            index[key] = r
            print(f"[{i + 1}/{len(targets)}] {key}: {r['bones']} kemik, {r['meshes']} mesh, boy {r['height']} m, "
                  f"{r['bytes'] // 1024} KB, anim {','.join(r['anims'])}")
    for key, (base, items) in outfits.items():
        try:
            r = export_resource(data, tex, base, key, player=True, items=items)
        except Exception as e:
            print(f"[kiyafet] HATA {key}: {e}")
            continue
        if r:
            index[key] = r
            print(f"[kiyafet] {key}: {r['meshes']} mesh, boy {r['height']} m, {r['bytes'] // 1024} KB")
    with open(index_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, ensure_ascii=False, indent=1, sort_keys=True)
    print(len(index), "kaynak ->", OUT)


if __name__ == "__main__":
    main()
