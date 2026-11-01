import json

for mid in [88, 89]:
    m = json.load(open(f'C:/Silkroad/Silkroad_V3/MODELS/models/{mid}.json', encoding='utf-8'))
    for mesh in m['meshes']:
        g = json.load(open('C:/Silkroad/Silkroad_V3/' + mesh['geom'], encoding='utf-8'))
        pos = g['data']['attributes']['position']['array']
        xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
        print(f"mid={mid} {mesh['geom']}: X[{min(xs):.1f}, {max(xs):.1f}] Y[{min(ys):.1f}, {max(ys):.1f}] Z[{min(zs):.1f}, {max(zs):.1f}]")
