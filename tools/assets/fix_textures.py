"""
Obje modellerinin eksik dokularini PK2'den tamamlar.

Eski model aktariminda (Pillow) DXT2 bicimli (on-carpilmis alfa DXT3) dokular okunamamis ve
model tanimlari var olmayan .jpg'lere isaret ediyordu (or. c_swamp_tree02). Bu arac eksik
dokulari bulur, DXT2 baslik kodunu DXT3 yapip cozer, alfa varsa .png yazar ve tanimi gunceller.

  python tools/assets/fix_textures.py
"""
import glob
import io
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from export_chars import open_pk2, ROOT  # noqa: E402
import jmx  # noqa: E402

MODELS = os.path.join(ROOT, "assets", "models")


def decode(raw):
    dds = bytearray(jmx.ddj_to_dds(raw))
    head = bytes(dds[:128])
    if b"DXT2" in head:
        i = head.index(b"DXT2")
        dds[i:i + 4] = b"DXT3"
    elif b"DXT4" in head:
        i = head.index(b"DXT4")
        dds[i:i + 4] = b"DXT5"
    im = Image.open(io.BytesIO(bytes(dds)))
    im.load()
    return im


def main():
    data = open_pk2("Data")
    by_name = {}
    for p in data.files:
        if p.endswith(".ddj"):
            by_name.setdefault(os.path.splitext(os.path.basename(p))[0], p)
    fixed, defs = {}, 0
    for f in glob.glob(os.path.join(MODELS, "models", "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        changed = False
        for m in d.get("meshes", []):
            t = m.get("texture")
            if not t:
                continue
            path = os.path.join(MODELS, t[len("MODELS/"):])
            if os.path.exists(path):
                continue
            stem = os.path.splitext(os.path.basename(t))[0]
            if stem not in fixed:
                src = by_name.get(stem)
                fixed[stem] = None
                if src:
                    try:
                        im = decode(data.read(src))
                        alpha = "A" in im.getbands() and im.getchannel("A").getextrema()[0] < 250
                        name = stem + (".png" if alpha else ".jpg")
                        dst = os.path.join(MODELS, "textures", name)
                        (im.convert("RGBA").save(dst) if alpha else im.convert("RGB").save(dst, quality=85))
                        fixed[stem] = "MODELS/textures/" + name
                        print("doku:", src, "->", name)
                    except Exception as e:
                        print("  ! cozulemedi", src, e)
            if fixed[stem] and fixed[stem] != t:
                m["texture"] = fixed[stem]
                changed = True
        if changed:
            defs += 1
            with open(f, "w", encoding="utf-8", newline="\n") as w:
                json.dump(d, w, ensure_ascii=False)
    print(len([v for v in fixed.values() if v]), "doku tamamlandi,", defs, "model tanimi guncellendi")


if __name__ == "__main__":
    main()
