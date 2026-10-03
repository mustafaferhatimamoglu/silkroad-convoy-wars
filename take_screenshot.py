import subprocess
import time
import json
import urllib.request
import asyncio
import websockets
import base64
import os
import sys

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
user_data = r'C:\Silkroad\Silkroad_V3\tmp_profile_cdp'
os.makedirs(user_data, exist_ok=True)

port = 9333

proc = subprocess.Popen([
    edge_path,
    '--headless',
    f'--remote-debugging-port={port}',
    '--user-data-dir=' + user_data,
    '--disable-gpu-watchdog',
    '--hide-scrollbars',
    '--window-size=1280,720',
    'http://localhost:5050/MAP/viewer.html'
])

async def run():
    ws_url = None
    for attempt in range(20):
        try:
            resp = urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=1)
            tabs = json.loads(resp.read().decode())
            for t in tabs:
                if t.get('type') == 'page' and 'viewer.html' in t.get('url', ''):
                    ws_url = t['webSocketDebuggerUrl']
                    break
            if ws_url:
                break
        except Exception:
            pass
        await asyncio.sleep(0.5)

    if not ws_url:
        print('Could not find viewer.html tab!')
        return

    print('Connecting to:', ws_url, flush=True)
    async with websockets.connect(ws_url, max_size=50*1024*1024) as ws:
        msg_id = 1
        async def call(method, params={}):
            nonlocal msg_id
            m_id = msg_id
            msg_id += 1
            await ws.send(json.dumps({'id': m_id, 'method': method, 'params': params}))
            while True:
                r = json.loads(await ws.recv())
                if 'method' in r:
                    if r['method'] == 'Runtime.exceptionThrown':
                        print('[JS EXCEPTION]', json.dumps(r['params']))
                    elif r['method'] != 'Runtime.executionContextCreated':
                        print('[CDP Event]', r['method'])
                if r.get('id') == m_id:
                    return r

        await call('Page.enable')
        await call('Console.enable')
        await call('Runtime.enable')

        # Reload fresh to bypass any cache
        await call('Page.reload', {'ignoreCache': True})

        # Wait 3 seconds for page and Three.js initialization
        await asyncio.sleep(3)

        # Teleport to city if requested
        city = sys.argv[1] if len(sys.argv) > 1 else '135,92'
        res = await call('Runtime.evaluate', {
            'expression': f'''
                (function() {{
                    const sel = document.getElementById('sel-city');
                    sel.value = '{city}';
                    sel.dispatchEvent(new Event('change'));
                    return 'Teleported to {city}';
                }})()
            '''
        })
        print('Teleport:', res, flush=True)

        # Wait 4s for assets to stream in
        await asyncio.sleep(4)

        # Raycast from castle position straight down to terrain
        ray_res = await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    const castleObj = window.scene.getObjectByName('model_681_oas_hot_c1_castle');
                    if (!castleObj) return 'Castle object not found!';
                    const cPos = new THREE.Vector3();
                    castleObj.getWorldPosition(cPos);
                    
                    const raycaster = new THREE.Raycaster();
                    raycaster.set(new THREE.Vector3(cPos.x, 600, cPos.z), new THREE.Vector3(0, -1, 0));
                    
                    const terrains = [];
                    window.scene.traverse(o => { if (o.isMesh && o.name.startsWith('terrain_')) terrains.push(o); });
                    const hits = raycaster.intersectObjects(terrains, false);
                    
                    return JSON.stringify({
                        castleWorldPos: cPos,
                        terrainsFound: terrains.length,
                        hitCount: hits.length,
                        firstHit: hits[0] ? {
                            point: hits[0].point,
                            mesh: hits[0].object.name,
                            uv: hits[0].uv
                        } : null
                    });
                })()
            '''
        })
        print('RAYCAST RESULT:', ray_res, flush=True)

        shot = await call('Page.captureScreenshot', {'format': 'png'})
        out_name = sys.argv[3] if len(sys.argv) > 3 else 'screenshot.png'
        out_path = os.path.join(r'C:\Silkroad\Silkroad_V3', out_name)
        with open(out_path, 'wb') as f:
            f.write(base64.b64decode(shot['result']['data']))
        print(f'Saved {out_path}', flush=True)

try:
    asyncio.run(run())
finally:
    proc.terminate()
