import json

for reg in ['98_168', '97_168']:
    data = json.load(open(f'C:/Silkroad/Silkroad_V3/MAP/objects/{reg}.json'))
    models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json'))
    for obj in data['objects']:
        mid = str(obj[0])
        p = models.get(mid, {}).get('path', '')
        if any(k in p for k in ['rock', 'stone', 'hill', 'tent', 'pile', 'sand', 'clay', 'mud']):
            print(f"{reg} mid={mid} pos=({obj[1]:.1f}, {obj[2]:.1f}, {obj[3]:.1f}) path={p}")
