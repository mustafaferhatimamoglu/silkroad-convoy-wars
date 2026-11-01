import json

for fname in ['cj_pal_center_stair01.json', 'cj_pal_center_stair01_1.json']:
    g = json.load(open('C:/Silkroad/Silkroad_V3/MODELS/geometry/' + fname))
    pos = g['data']['attributes']['position']['array']
    uvs = g['data']['attributes']['uv']['array']
    print(f"=== {fname} ===")
    print(f"  Vert count: {len(pos)//3}")
    xs = pos[0::3]; ys = pos[1::3]; zs = pos[2::3]
    print(f"  X: [{min(xs):.1f}, {max(xs):.1f}], Y: [{min(ys):.1f}, {max(ys):.1f}], Z: [{min(zs):.1f}, {max(zs):.1f}]")
    u_vals = uvs[0::2]; v_vals = uvs[1::2]
    print(f"  U: [{min(u_vals):.3f}, {max(u_vals):.3f}], V: [{min(v_vals):.3f}, {max(v_vals):.3f}]")
