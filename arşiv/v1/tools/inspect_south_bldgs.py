import json

for mid in [61, 62, 63, 65, 75]:
    m = json.load(open(f'C:/Silkroad/Silkroad_V3/MODELS/models/{mid}.json'))
    print(f"=== Model {mid}: {m.get('name')} ===")
    for mesh in m.get('meshes', []):
        print(f"  {mesh.get('geom')}: {mesh.get('texture')}")
