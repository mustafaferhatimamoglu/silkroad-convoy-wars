import json
data = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/98_168.json', encoding='utf-8'))
models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))
for obj in sorted(data.get('objects', []), key=lambda o: (o[3], o[1])):
    if obj[3] < 900:
        mid = str(obj[0])
        p = models.get(mid, {}).get('path', 'unknown')
        uid = obj[5] if len(obj)>5 else '?'
        print(f"uid={uid:<6} mid={mid:<4} pos=({obj[1]:6.1f}, {obj[2]:5.1f}, {obj[3]:6.1f}) yaw={obj[4]:.4f} path={p}")
