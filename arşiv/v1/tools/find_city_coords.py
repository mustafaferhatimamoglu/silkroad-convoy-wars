import glob, json
from collections import Counter

models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))

cities = {
    'jangan': ['jangan'],
    'donwhang': ['dunhuang', 'donwhang'],
    'hotan': ['hotan', 'hetian'],
    'samarkand': ['samarkand', 'centralasia'],
    'constantinople': ['constantinople', 'euro_easteuro'],
    'alexandria': ['alexandria', 'egypt'],
    'roc': ['roc', 'mtrok']
}

city_mids = {c: set() for c in cities}
for mid, m in models.items():
    p = m.get('path', '').lower()
    for c, keys in cities.items():
        if any(k in p for k in keys):
            city_mids[c].add(int(mid))

for c, mids in city_mids.items():
    counts = Counter()
    for f in glob.glob('C:/Silkroad/Silkroad_V3/MAP/objects/*.json'):
        if 'models' in f: continue
        base = f.replace('\\', '/').split('/')[-1].replace('.json', '')
        try:
            data = json.load(open(f, encoding='utf-8'))
            n = sum(1 for o in data.get('objects', []) if o[0] in mids)
            if n > 10:
                counts[base] = n
        except: pass
    top = counts.most_common(3)
    print(f"City '{c}': top regions: {top}")
