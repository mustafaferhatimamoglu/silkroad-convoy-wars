import json

data = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/98_168.json'))
models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json'))

unique_mids = set(o[0] for o in data['objects'])
print("Total unique models in 98_168:", len(unique_mids))

for mid in sorted(unique_mids):
    p = models.get(str(mid), {}).get('path', 'unknown')
    try:
        m = json.load(open(f'C:/Silkroad/Silkroad_V3/MODELS/models/{mid}.json'))
        # compute overall bounds
        all_x, all_y, all_z = [], [], []
        for mesh in m.get('meshes', []):
            g = json.load(open('C:/Silkroad/Silkroad_V3/' + mesh['geom']))
            pos = g['data']['attributes']['position']['array']
            all_x.extend(pos[0::3])
            all_y.extend(pos[1::3])
            all_z.extend(pos[2::3])
        if all_x and all_y:
            dx = max(all_x) - min(all_x)
            dy = max(all_y) - min(all_y)
            dz = max(all_z) - min(all_z)
            # Check if cone/pyramid (dx ~ dz, dy > 0, etc.) or check textures
            texs = [mesh.get('texture') for mesh in m.get('meshes', [])]
            if 'sand' in p.lower() or 'rock' in p.lower() or 'stone' in p.lower() or 'cone' in p.lower() or 'hill' in p.lower():
                print(f"mid={mid:<4} dx={dx:.1f} dy={dy:.1f} dz={dz:.1f} path={p} tex={texs}")
    except Exception as e:
        print(f"mid={mid} error: {e}")
