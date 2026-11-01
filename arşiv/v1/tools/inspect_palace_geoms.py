import json

for mid in [70, 72, 74, 75, 66, 67, 68, 69, 71, 73]:
    try:
        data = json.load(open(f'C:/Silkroad/Silkroad_V3/MODELS/models/{mid}.json', encoding='utf-8'))
        print(f"=== Model {mid}: {data.get('name')} ===")
        for m in data.get('meshes', []):
            geom_path = m.get('geom', '').replace('MODELS/', 'C:/Silkroad/Silkroad_V3/MODELS/')
            gdata = json.load(open(geom_path, encoding='utf-8'))
            attrs = gdata.get('data', {}).get('attributes', {})
            pos = attrs.get('position', {}).get('array', [])
            if pos:
                xs = pos[0::3]
                ys = pos[1::3]
                zs = pos[2::3]
                print(f"  mesh {geom_path.split('/')[-1]}: X[{min(xs):.1f}, {max(xs):.1f}] Y[{min(ys):.1f}, {max(ys):.1f}] Z[{min(zs):.1f}, {max(zs):.1f}]")
    except Exception as e:
        print(f"Error loading {mid}: {e}")
