import json

for reg in ['106_78', '105_78', '105_79', '106_79']:
    data = json.load(open(f'C:/Silkroad/Silkroad_V3/MAP/objects/{reg}.json', encoding='utf-8'))
    models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))
    for obj in data.get('objects', []):
        mid = str(obj[0])
        p = models.get(mid, {}).get('path', '')
        if any(w in p.lower() for w in ['statue', 'sculp', 'monu', 'fount', 'art', 'atena', 'nike', 'apollo']):
            print(f"Region {reg}: mid={mid} path={p} pos={obj[1:4]}")
