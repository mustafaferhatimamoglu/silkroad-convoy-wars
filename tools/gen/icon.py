"""Oyun simgesi (kendi cizimimiz): gun batiminda kum tepeleri arasinda kivrilan Ipek Yolu.

  python tools/gen/icon.py   -> content/icon.png (sekme simgesi) + tools/launcher/icon.ico (exe)
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
S = 1024


def draw():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # yuvarlak koseli zemin: gokyuzu gecisi
    sky = Image.new('RGBA', (S, S))
    sd = ImageDraw.Draw(sky)
    for y in range(S):
        k = y / S
        c = (int(52 + 180 * k), int(30 + 90 * k), int(48 + 10 * k), 255)
        sd.line([(0, y), (S, y)], fill=c)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=190, fill=255)
    im.paste(sky, (0, 0), mask)
    # gunes
    d.ellipse([560, 210, 860, 510], fill=(255, 214, 120, 255))
    # kum tepeleri (arka, on)
    def dune(base, amp, phase, col):
        pts = [(0, S)]
        for x in range(0, S + 8, 8):
            pts.append((x, base - amp * math.sin(x / S * math.pi * 1.6 + phase)))
        pts.append((S, S))
        d.polygon(pts, fill=col)
    dune(600, 70, 0.4, (176, 110, 58, 255))
    dune(700, 60, 2.2, (214, 150, 80, 255))
    dune(820, 40, 1.0, (232, 178, 104, 255))
    # yol: alttan ufka kivrilan serit
    road = []
    for i in range(0, 101):
        t = i / 100
        y = S - t * 470
        x = S * 0.42 + math.sin(t * 3.4) * 170 * (1 - t) + t * 60
        w = 150 * (1 - t) ** 1.4 + 6
        road.append((x, y, w))
    left = [(x - w, y) for x, y, w in road]
    right = [(x + w, y) for x, y, w in reversed(road)]
    d.polygon(left + right, fill=(58, 44, 34, 255))
    for i in range(0, 96, 8):
        a, b = road[i], road[i + 4]
        d.line([(a[0], a[1]), (b[0], b[1])], fill=(246, 214, 140, 255), width=max(3, int(a[2] * 0.12)))
    im = Image.composite(im, Image.new('RGBA', (S, S), (0, 0, 0, 0)), mask)
    return im


def main():
    im = draw()
    os.makedirs(os.path.join(ROOT, 'tools', 'launcher'), exist_ok=True)
    im.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, 'content', 'icon.png'))
    im.save(os.path.join(ROOT, 'tools', 'launcher', 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('content/icon.png, tools/launcher/icon.ico')


if __name__ == '__main__':
    main()
