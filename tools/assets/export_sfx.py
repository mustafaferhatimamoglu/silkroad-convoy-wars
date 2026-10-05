"""
Silkroad ses efektlerini (Data.pk2 prim/snd, mono 22 kHz WAV) oyuna kopyalar.

  python tools/assets/export_sfx.py

Cikti (assets/sfx/):
  *.wav        secilmis sesler
  index.json   { "named": {ad: dosya}, "steps": {zemin: {run: [...], walk: [...]}},
                 "voice": {"m": {...}, "w": {...}}, "chars": {model anahtari: {die|hurt|shout|idle: [...]}} }
Karakter/canavar sesleri model adina gore otomatik eslenir (or. mob_china_bandit -> cm_bandit_*).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from export_chars import open_pk2, ROOT  # noqa: E402

OUT = os.path.join(ROOT, "assets", "sfx")
SND = "prim/snd/"

NAMED = {
    "gold": "ui/itgold.wav", "levelup": "ui/itlevelup.wav", "potion": "ui/itpotiondrink.wav", "alarm": "ui/alarm_sound.wav",
    "error": "ui/error.wav", "pickup": "ui/itpickup.wav", "gate": "ui/gatein.wav", "quest": "ui/itquest.wav",
    "spearSwing1": "player/batspearswing1.wav", "spearSwing2": "player/batspearswing2.wav",
    "spearHit1": "player/batspearhit1a.wav", "spearHit2": "player/batspearhit2a.wav", "spearHit3": "player/batspearhit1b.wav",
    "punchSwing": "player/batpunchswing.wav", "punchHit": "player/batpunchhit1a.wav", "crit": "player/batcrihit.wav",
    "swordSwing": "common/swordswing4.wav", "bowShot": "common/batbowswing3.wav", "thud": "common/bigmonster_thud.wav",
}
# Kendi sesi olmayan modeller icin benzer modelin sesleri
ALIAS = {"mob_oasis_blackrobber": "bandit", "mob_oasis_blackrobberarcher": "banditar", "mob_china_banditarcher": "banditar"}
SURFACES = ["grass", "gravel", "ground", "hground", "hwood", "mud", "snow", "water", "sand"]


def classify(name):
    n = name.lower()
    if re.search(r"die|death", n): return "die"
    if re.search(r"moan|damage|hurt", n): return "hurt"
    if re.search(r"shout|attack|swing", n): return "shout"
    if re.search(r"stand|idle", n): return "idle"
    return None


def main():
    data = open_pk2("Data")
    os.makedirs(OUT, exist_ok=True)
    files = sorted(p for p in data.files if p.startswith(SND) and p.endswith(".wav"))
    base = {os.path.basename(p)[:-4]: p for p in files}
    copied = set()

    def take(path):
        name = path[len(SND):].replace("/", "_")
        if name not in copied:
            with open(os.path.join(OUT, name), "wb") as f:
                f.write(data.read(path))
            copied.add(name)
        return name

    index = {"named": {}, "steps": {}, "voice": {}, "chars": {}}
    for k, rel in NAMED.items():
        if SND + rel in data.files:
            index["named"][k] = take(SND + rel)
    for s in SURFACES:
        e = {}
        for kind in ("run", "walk"):
            p = base.get(f"mv{kind}{s}")
            if p:
                e[kind] = take(p)
        if e:
            index["steps"][s] = e
    # oyuncu sesleri: erkek/kadin, "at" ses tipi
    for g in ("m", "f"):
        v = {}
        for cat, pat in (("hurt", rf"^vc{g}_at_moan\d_[a-d]$"), ("die", rf"^vc{g}_at_die_[a-d]$"), ("shout", rf"^vc{g}_at_shout\d_[a-d]$")):
            v[cat] = [take(base[n]) for n in sorted(base) if re.match(pat, n)][:4]
        index["voice"]["w" if g == "f" else "m"] = v
    # karakter / canavar / binek sesleri model adina gore
    chars = json.load(open(os.path.join(ROOT, "assets", "chars", "index.json"), encoding="utf-8"))
    names = sorted(base)
    for key in chars:
        if not (key.startswith("mob_") or key.startswith("cos_")):
            continue
        token = ALIAS.get(key) or key.split("_")[-1]
        if key.startswith("cos_t_"):
            token = re.sub(r"\d+$", "", token)          # t_horse1 -> horse
        found = []
        # once tam ad (kisa olsa da: gyo), sonra en az 4 harfli onekler
        for n in [len(token)] + list(range(len(token) - 1, 3, -1)):
            pre = token[:n]
            rx = re.compile(rf"(^|_){re.escape(pre)}(_|$)")
            found = [x for x in names if rx.search(x) and not x.startswith("mv")]
            if found:
                break
        cats = {}
        for x in found:
            c = classify(x)
            if c and len(cats.setdefault(c, [])) < 3:
                cats[c].append(take(base[x]))
        if cats:
            index["chars"][key] = cats
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, indent=1)
    size = sum(os.path.getsize(os.path.join(OUT, n)) for n in copied)
    print(f"{len(copied)} ses ({size // 1024} KB); {len(index['chars'])} karakter/canavar sesli; adimlar: {sorted(index['steps'])}")


if __name__ == "__main__":
    main()
