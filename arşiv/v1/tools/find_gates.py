import json
import math

models = json.load(open('C:/Silkroad/Silkroad_V3/MAP/objects/models.json', encoding='utf-8'))

# Find gate models
gate_mids = {}
for mid, m in models.items():
    p = m.get('path', '').lower()
    if 'door' in p or 'gate' in p or 'enter' in p:
        gate_mids[int(mid)] = p

print("Found gate models:", len(gate_mids))
for mid, p in list(gate_mids.items())[:20]:
    print(f"  {mid}: {p}")
