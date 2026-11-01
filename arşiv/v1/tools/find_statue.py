import json

models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))
for mid, m in models.items():
    p = m.get('path', '').lower()
    if 'statue' in p or 'vine' in p or 'ivy' in p or 'climb' in p:
        print(f"{mid}: {p}")
