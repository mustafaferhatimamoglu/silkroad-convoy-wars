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

        # Raycast and check plaza & castle positions
        ray_res = await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    const plazaObj = window.scene.getObjectByName('model_685_oas_hot_plaza01');
                    const castleObj = window.scene.getObjectByName('model_681_oas_hot_c1_castle');
                    
                    const pPos = new THREE.Vector3();
                    if (plazaObj) plazaObj.getWorldPosition(pPos);
                    
                    const cPos = new THREE.Vector3();
                    if (castleObj) castleObj.getWorldPosition(cPos);

                    // Kamerayi amaca uygun ayarla
                    const mode = "''' + (sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else 'plaza') + '''";
                    if (mode === 'plaza' && plazaObj) {
                        // Hotan meydani ve mermer kaplama temiz sinematik aci (palmiye engelsiz)
                        window.controls.target.set(pPos.x, pPos.y + 8, pPos.z);
                        window.camera.position.set(pPos.x - 15, pPos.y + 45, pPos.z + 65);
                        window.controls.update();
                    } else if (mode === 'ground_close' && plazaObj) {
                        // Zemin mikro dokusuna cok yakindan bakis (detail texture)
                        window.controls.target.set(pPos.x + 35, pPos.y + 10, pPos.z + 30);
                        window.camera.position.set(pPos.x + 30, pPos.y + 15, pPos.z + 42);
                        window.controls.update();
                    } else if (mode === 'jangan_ground') {
                        // Jangan meydan & zemin mikro dokusu
                        const t = window.controls.target;
                        window.camera.position.set(t.x - 30, t.y + 14, t.z + 35);
                        window.controls.update();
                    }

                    return JSON.stringify({
                        plazaFound: !!plazaObj,
                        plazaWorldPos: plazaObj ? pPos : null,
                        castleFound: !!castleObj,
                        castleWorldPos: castleObj ? cPos : null,
                        cameraPos: window.camera.position,
                        target: window.controls.target
                    });
                })()
            '''
        })
        print('SCENE & CAMERA STATUS:', ray_res, flush=True)

        # Wait a moment for controls/camera to settle and render
        await asyncio.sleep(2)

        shot = await call('Page.captureScreenshot', {'format': 'png'})
        out_name = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else 'screenshot.png'
        out_path = os.path.join(r'C:\Silkroad\Silkroad_V3', out_name)
        with open(out_path, 'wb') as f:
            f.write(base64.b64decode(shot['result']['data']))
        print(f'Saved {out_path}', flush=True)

try:
    asyncio.run(run())
finally:
    proc.terminate()
