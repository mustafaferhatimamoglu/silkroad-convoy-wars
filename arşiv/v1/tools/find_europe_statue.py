import json
models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))
for mid, m in models.items():
    p = m.get('path', '').lower()
    if 'europe' in p and ('sculp' in p or 'statue' in p or 'fountain' in p or 'monument' in p or 'art' in p or 'bldg' in p):
        print(f"{mid}: {p}")
