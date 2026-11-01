import json
data = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/106_78.json', encoding='utf-8'))
models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))
mids = set(o[0] for o in data.get('objects', []))
for mid in sorted(mids):
    p = models.get(str(mid), {}).get('path', '')
    print(f"mid={mid:<4}: {p}")
