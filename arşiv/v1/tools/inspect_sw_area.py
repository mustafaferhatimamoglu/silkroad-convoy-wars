import json

data = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/98_168.json'))
models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json'))

for obj in sorted(data['objects'], key=lambda o: (o[3], o[1])):
    x, y, z = obj[1], obj[2], obj[3]
    if 0 <= x <= 450 and 100 <= z <= 750:
        mid = str(obj[0])
        p = models.get(mid, {}).get('path', 'unknown')
        uid = obj[5] if len(obj)>5 else '?'
        print(f"mid={mid:<4} pos=({x:6.1f}, {y:5.1f}, {z:6.1f}) yaw={obj[4]:.4f} uid={uid} path={p}")
