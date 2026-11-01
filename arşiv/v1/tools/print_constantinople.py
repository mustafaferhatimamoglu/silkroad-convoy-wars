import json

data = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/128_20.json', encoding='utf-8'))
models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))

found = set()
for obj in data.get('objects', []):
    mid = str(obj[0])
    if mid not in found:
        found.add(mid)
        p = models.get(mid, {}).get('path', 'unknown')
        try:
            print(f"mid={mid:<4} path={p}")
        except:
            print(f"mid={mid:<4} path=(non-ascii)")
