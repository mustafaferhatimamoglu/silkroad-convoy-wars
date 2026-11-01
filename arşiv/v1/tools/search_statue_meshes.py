import glob, json

for f in glob.glob('C:/Silkroad/Silkroad_V3/MODELS/models/*.json'):
    try:
        data = json.load(open(f, encoding='utf-8'))
        meshes = data.get('meshes', [])
        # Look for model with multiple meshes where one texture has 'stone' or 'statue' or 'marble'
        texs = [m.get('texture', '').lower() for m in meshes]
        geoms = [m.get('geom', '').lower() for m in meshes]
        all_s = ' '.join(texs + geoms)
        if any(k in all_s for k in ['statue', 'sculp', 'pedestal']) or ('ped' in all_s and 'dan' in all_s):
            print(f"id={data.get('id')} name={data.get('name')} path={data.get('path')}")
            for m in meshes:
                print(f"   geom={m.get('geom')} tex={m.get('texture')} alpha={m.get('alpha')}")
    except: pass
