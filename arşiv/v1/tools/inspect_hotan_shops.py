import json

# Armor Shop (515), Weapon Shop (516), Luxury Shop (518), General Shop (454)
for mid in [515, 516, 518, 454, 514]:
    m = json.load(open(f'C:/Silkroad/Silkroad_V3/MODELS/models/{mid}.json'))
    print(f"=== Model {mid}: {m.get('name')} ===")
    for mesh in m['meshes']:
        if any(k in mesh['geom'].lower() for k in ['wall', 'door', 'enter', 'stair', 'statue', 'pillar']):
            g = json.load(open('C:/Silkroad/Silkroad_V3/' + mesh['geom']))
            pos = g['data']['attributes']['position']['array']
            xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
            print(f"  {mesh['geom'].split('/')[-1]}: X[{min(xs):.1f}, {max(xs):.1f}] Y[{min(ys):.1f}, {max(ys):.1f}] Z[{min(zs):.1f}, {max(zs):.1f}]")
