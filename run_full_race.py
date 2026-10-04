import subprocess
import time
import json
import urllib.request
import asyncio
import websockets
import base64
import os
import sys

import sys
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

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
    for attempt in range(25):
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

    print('Connecting to CDP:', ws_url, flush=True)
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
                    continue
                if r.get('id') == m_id:
                    return r

        print('Reloading page fresh...', flush=True)
        await call('Page.reload', {'ignoreCache': True})
        await asyncio.sleep(4)

        # 1. Hotan'a git ve Yarışı Başlat
        print('Starting Race from Hotan Castle...', flush=True)
        start_res = await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    const sel = document.getElementById('sel-city');
                    if (sel) {
                        sel.value = '135,92';
                        sel.dispatchEvent(new Event('change'));
                    }
                    return 'Teleported to Hotan';
                })()
            '''
        })
        await asyncio.sleep(3)

        race_start = await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    document.getElementById('btn-start-race').click();
                    const v = window.vehicle;
                    const cp = window.checkpoints;
                    return JSON.stringify({
                        isRacing: window.isRacing,
                        checkpointsCount: cp ? cp.length : 0,
                        startPos: v ? v.position : null,
                        health: v ? v.health : 0
                    });
                })()
            '''
        })
        print('RACE START DATA:', race_start.get('result', {}).get('result', {}).get('value'), flush=True)

        # 2. Checkpoint'leri tek tek sür ve tamamla
        # Toplam 9 checkpoint var:
        # Hotan -> Kuzey Kapı -> Vaha -> Karakoram -> Kanyon Köprüsü -> Taklamakan -> Niya -> Tapınak Köprüsü -> Lord Yarkan Tapınağı
        
        checkpoint_names = [
            'Hotan Meydani & Saray Kapisi',
            'Hotan Kuzey Kale Kapisi & Kopru',
            'Hotan Vaha Cikisi & Palmiyeler',
            'Karakoram Dag Gecidi & Kanyon',
            'Karakoram Kanyon Koprusu',
            'Taklamakan Col Girisi & Kumullari',
            'Niya Kalintilari Harabeleri',
            'Taklamakan Tapinak Onu Koprusu',
            'Lord Yarkan Tapinagi (BITIS)'
        ]

        total_cps = len(checkpoint_names)
        print(f'Beginning Full Race Simulation ({total_cps} Checkpoints)...', flush=True)

        for cp_idx in range(total_cps):
            name = checkpoint_names[cp_idx]
            print(f'\n>>> Advancing towards Checkpoint {cp_idx+1}/{total_cps}: {name}...', flush=True)

            step_res = await call('Runtime.evaluate', {
                'expression': f'''
                    (function() {{
                        const cp = window.checkpoints[{cp_idx}];
                        const cpPos = window.map.toThree(cp.rx, cp.rz, cp.lx || 960, 0, cp.lz || 960);
                        const v = window.vehicle;
                        
                        // Checkpoint yuksekligini arazi ve kopruye gore belirle
                        const h = v.getSurfaceHeightAt(cpPos.x, cpPos.z, cpPos.y);
                        cpPos.y = h + 0.35;
                        
                        // Araci tam checkpoint noktasina getir
                        v.position.copy(cpPos);
                        v.velocity.set(0, 0, -15);
                        v.yaw = 0;
                        v.speedKmh = 60;
                        v.rpm = 3200;
                        v.gear = 3;
                        v.health = Math.max(90, v.health);

                        // Harita akisini guncelle
                        window.map.update(v.position);

                        return JSON.stringify({{
                            target: cp.name,
                            pos: v.position,
                            groundHeight: h,
                            currentCheckpointIdx: window.currentCheckpointIdx
                        }});
                    }})()
                '''
            })
            print(f'Positioned at Checkpoint {cp_idx+1}:', step_res.get('result', {}).get('result', {}).get('value'), flush=True)

            # Checkpoint temasini render dongusunun yakalamasi icin bekle
            await asyncio.sleep(2.0)

            # Checkpoint ulasildi kontrolu
            chk_status = await call('Runtime.evaluate', {
                'expression': '''
                    (function() {
                        const statusText = document.getElementById('race-status').textContent;
                        const distText = document.getElementById('race-dist').textContent;
                        const timeText = document.getElementById('race-time').textContent;
                        const v = window.vehicle;
                        return JSON.stringify({
                            status: statusText,
                            dist: distText,
                            time: timeText,
                            idx: window.currentCheckpointIdx,
                            speed: v ? Math.round(v.speedKmh) : 0,
                            health: v ? v.health : 0,
                            pos: v ? v.position : null
                        });
                    })()
                '''
            })
            val = chk_status.get('result', {}).get('result', {}).get('value')
            print(f'Status at CP {cp_idx+1}:', val, flush=True)

            # Kritik asamalarin screenshot'ini kaydet
            if cp_idx in [1, 4, 6, 8]:
                shot = await call('Page.captureScreenshot', {'format': 'png'})
                filename = f'race_stage_cp{cp_idx+1}.png'
                filepath = os.path.join(r'C:\Silkroad\Silkroad_V3', filename)
                with open(filepath, 'wb') as f:
                    f.write(base64.b64decode(shot['result']['data']))
                print(f'Saved milestone screenshot: {filepath}', flush=True)

        # 3. Son Kontrol ve Bitis Dogrulamasi
        print('\n=== FINAL RACE STATUS CHECK ===', flush=True)
        final_check = await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    const statusText = document.getElementById('race-status').textContent;
                    const v = window.vehicle;
                    return JSON.stringify({
                        statusText: statusText,
                        isRacing: window.isRacing,
                        finalPos: v ? v.position : null,
                        finalHealth: v ? v.health : 0,
                        speed: v ? v.speedKmh : 0
                    });
                })()
            '''
        })
        print('FINAL RESULT:', final_check.get('result', {}).get('result', {}).get('value'), flush=True)

        # Son ekran görüntüsünü kaydet
        shot = await call('Page.captureScreenshot', {'format': 'png'})
        final_out = r'C:\Silkroad\Silkroad_V3\race_finished_lord_yarkan.png'
        with open(final_out, 'wb') as f:
            f.write(base64.b64decode(shot['result']['data']))
        print(f'Final Race Finished Screenshot saved to {final_out}', flush=True)

    try:
        proc.terminate()
    except Exception:
        pass

if __name__ == '__main__':
    asyncio.run(run())
