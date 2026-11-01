import glob, json

missed = []
for f in glob.glob('C:/Silkroad/Silkroad_V3/MODELS/models/*.json'):
    try:
        data = json.load(open(f, encoding='utf-8'))
        for m in data.get('meshes', []):
            tex = m.get('texture', '')
            if not tex: continue
            is_alpha = m.get('alpha')
            tex_l = tex.lower()
            if not is_alpha and tex_l.endswith('.jpg'):
                if any(w in tex_l for w in ['leaf', 'ivy', 'branch', 'tree', 'bush', 'flower', 'vine', 'weed', 'grass', 'grs', 'flw', 'alpha', '_al']):
                    missed.append((data.get('id'), data.get('name'), tex, m.get('geom')))
    except: pass

print(f"Total potential missed alpha textures: {len(missed)}")
for item in missed[:30]:
    print(item)
