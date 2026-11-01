import glob, json

models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json'))

# Search for red building in Jangan
red_bldgs = {}
for mid, m in models.items():
    p = m.get('path', '').lower()
    if 'jangan' in p and ('buil' in p or 'house' in p or 'guard' in p or 'store' in p or 'gate' in p or 'tower' in p):
        red_bldgs[int(mid)] = p

print("Found Jangan buildings:", len(red_bldgs))

# Check placements in 97_168, 98_168, 96_168, 97_167
for reg in ['97_168', '98_168', '96_168', '97_167', '97_169']:
    try:
        data = json.load(open(f'C:/Silkroad/Silkroad_V3/MAP/objects/{reg}.json'))
        for obj in data.get('objects', []):
            mid = obj[0]
            if mid in red_bldgs:
                p = red_bldgs[mid]
                if any(k in p for k in ['guard', 'buil', 'gate', 'enter']):
                    print(f"Region {reg}: mid={mid} path={p} pos=({obj[1]:.1f}, {obj[2]:.1f}, {obj[3]:.1f}) yaw={obj[4]:.4f}")
    except: pass
