import asyncio
import json
import urllib.request
import websockets
import os

CDP_HTTP = 'http://localhost:9333'

async def get_ws_url():
    req = urllib.request.urlopen(f'{CDP_HTTP}/json')
    tabs = json.loads(req.read().decode('utf-8'))
    for tab in tabs:
        if 'viewer.html' in tab.get('url', ''):
            return tab['webSocketDebuggerUrl']
    for tab in tabs:
        if tab.get('type') == 'page':
            return tab['webSocketDebuggerUrl']
    raise RuntimeError('No active page found')

async def main():
    ws_url = await get_ws_url()
    async with websockets.connect(ws_url, max_size=50*1024*1024) as ws:
        msg_id = 0
        async def call(method, params=None):
            nonlocal msg_id
            msg_id += 1
            await ws.send(json.dumps({'id': msg_id, 'method': method, 'params': params or {}}))
            while True:
                raw = await ws.recv()
                data = json.loads(raw)
                if data.get('id') == msg_id:
                    return data.get('result', {})

        print('Reloading page...')
        await call('Page.reload', {'ignoreCache': True})
        await asyncio.sleep(3.5)

        # 1. Hotan meydanina git ve Kartal Modunu ac
        init_res = await call('Runtime.evaluate', {
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
        print('Init:', init_res)
        await asyncio.sleep(3)

        # 2. Ralliyi Baslat
        race_res = await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    document.getElementById('btn-start-race').click();
                    const v = window.vehicle;
                    return JSON.stringify({
                        isCarMode: window.isCarMode,
                        pos: v ? v.position : null,
                        yaw: v ? v.yaw : null,
                        speed: v ? v.speedKmh : null,
                        health: v ? v.health : null,
                        sound: v ? v.soundEnabled : null
                    });
                })()
            '''
        })
        print('Race Start Status:', race_res.get('result', {}).get('value'))
        await asyncio.sleep(1)

        # 3. Direksiyon Testi: 1 saniye Gaz + D (Saga)
        print('Testing Steering: Throttle + Right (D)...')
        await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    window.keys['KeyW'] = true;
                    window.keys['KeyD'] = true;
                    window.keys['KeyA'] = false;
                })()
            '''
        })
        await asyncio.sleep(1.2)

        steer_right_res = await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    const v = window.vehicle;
                    return JSON.stringify({
                        yaw: v ? v.yaw : null,
                        steerAngle: v ? v.steeringAngle : null,
                        pos: v ? v.position : null,
                        speed: v ? v.speedKmh : null
                    });
                })()
            '''
        })
        print('After Steer Right:', steer_right_res.get('result', {}).get('value'))

        # 4. Direksiyon Testi: 1.2 saniye Gaz + A (Sola)
        print('Testing Steering: Throttle + Left (A)...')
        await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    window.keys['KeyW'] = true;
                    window.keys['KeyD'] = false;
                    window.keys['KeyA'] = true;
                })()
            '''
        })
        await asyncio.sleep(1.2)

        steer_left_res = await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    const v = window.vehicle;
                    return JSON.stringify({
                        yaw: v ? v.yaw : null,
                        steerAngle: v ? v.steeringAngle : null,
                        pos: v ? v.position : null,
                        speed: v ? v.speedKmh : null
                    });
                })()
            '''
        })
        print('After Steer Left:', steer_left_res.get('result', {}).get('value'))

        # Tusu birak
        await call('Runtime.evaluate', {
            'expression': '''
                (function() {
                    window.keys['KeyW'] = true;
                    window.keys['KeyA'] = false;
                    window.keys['KeyD'] = false;
                })()
            '''
        })
        await asyncio.sleep(1.5)

        # 5. Ekran goruntusu al
        shot = await call('Page.captureScreenshot', {'format': 'png'})
        import base64
        out_path = r'C:\Silkroad\Silkroad_V3\kartal_hotan_rally.png'
        with open(out_path, 'wb') as f:
            f.write(base64.b64decode(shot['data']))
        print(f'Screenshot saved to {out_path}')

if __name__ == '__main__':
    asyncio.run(main())
