import json

def get_positions(m_json_path):
    gdata = json.load(open(m_json_path, encoding='utf-8'))
    attrs = gdata.get('data', {}).get('attributes', {})
    pos = attrs.get('position', {}).get('array', [])
    return [(pos[i], pos[i+1], pos[i+2]) for i in range(0, len(pos), 3)]

wall_verts = get_positions('C:/Silkroad/Silkroad_V3/MODELS/geometry/cj_pal_dam_left01_wall.json')
door_verts = get_positions('C:/Silkroad/Silkroad_V3/MODELS/geometry/cj_pal_sidedoor_wall.json')

low_wall_z = sorted(list(set(round(p[2], 1) for p in wall_verts if p[1] < 40)))
print("Low wall vertices along Z:", low_wall_z)

zs = [p[2] for p in wall_verts]
print(f"Wall Z range: {min(zs)} to {max(zs)}")

door_zs = [p[2] for p in door_verts]
print(f"Door Z range: {min(door_zs)} to {max(door_zs)}")
