import json, os

for mid in [70, 71, 72, 73, 74, 75]:
    m_path = f'C:/Silkroad/Silkroad_V3/MODELS/models/{mid}.json'
    if not os.path.exists(m_path):
        print(f"{mid}: missing json")
        continue
    data = json.load(open(m_path, encoding='utf-8'))
    print(f"{mid}: {data.get('name')}")
    for mesh in data.get('meshes', []):
        g_path = 'C:/Silkroad/Silkroad_V3/' + mesh['geom']
        t_path = 'C:/Silkroad/Silkroad_V3/' + mesh.get('texture', '')
        print(f"   geom: {os.path.exists(g_path)} {mesh['geom']}")
        print(f"   tex:  {os.path.exists(t_path)} {mesh.get('texture')}")
