import glob, json

for f in glob.glob('C:/Silkroad/Silkroad_V3/MODELS/models/*.json'):
    try:
        data = json.load(open(f, encoding='utf-8'))
        p = data.get('path', '').lower()
        name = data.get('name', '').lower()
        if any(w in p for w in ['statue', 'sculp', 'pedestal', 'monument', 'god', 'ruin']) or any(w in name for w in ['statue', 'sculp', 'pedestal', 'monument']):
            # check meshes
            for m in data.get('meshes', []):
                t = m.get('texture', '')
                if 'leaf' in t.lower() or 'ivy' in t.lower() or 'tree' in t.lower() or 'grs' in t.lower() or 'branch' in t.lower():
                    print(f"MATCH: id={data.get('id')} name={name} path={p} mesh={m}")
    except: pass
