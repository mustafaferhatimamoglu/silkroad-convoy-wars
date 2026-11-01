import json
m = json.load(open('C:/Silkroad/Silkroad_V3/MODELS/models/702.json', encoding='utf-8'))
print("Model name:", m.get('name'))
for mesh in m.get('meshes', []):
    geom_rel = mesh['geom']
    g = json.load(open('C:/Silkroad/Silkroad_V3/' + geom_rel, encoding='utf-8'))
    pos = g['data']['attributes']['position']['array']
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    print(f"  {geom_rel}: X[{min(xs):.1f}, {max(xs):.1f}] Y[{min(ys):.1f}, {max(ys):.1f}] Z[{min(zs):.1f}, {max(zs):.1f}]")
