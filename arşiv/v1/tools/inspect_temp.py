import json

data = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/97_168.json', encoding='utf-8'))
models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))
for obj in data.get('objects', []):
    if abs(obj[1] - 942) < 100 and abs(obj[3] - 103) < 100:
        mid = str(obj[0])
        p = models.get(mid, {}).get('path', 'unknown')
        print(f"mid={mid} path={p} pos=({obj[1]:.1f}, {obj[2]:.1f}, {obj[3]:.1f}) yaw={obj[4]:.4f}")
