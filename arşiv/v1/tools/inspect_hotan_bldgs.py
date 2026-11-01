import json

data = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/92_135.json'))
models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json'))

for obj in sorted(data['objects'], key=lambda o: (o[3], o[1])):
    mid = str(obj[0])
    p = models.get(mid, {}).get('path', 'unknown')
    if 'bldg' in p or 'cast' in p or 'wall' in p or 'gate' in p or 'str' in p:
        print(f"mid={mid:<4} pos=({obj[1]:6.1f}, {obj[2]:5.1f}, {obj[3]:6.1f}) yaw={obj[4]:.4f} deg={obj[4]*180/3.14159:.1f} path={p}")
