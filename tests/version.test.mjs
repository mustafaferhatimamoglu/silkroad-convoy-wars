// Istemci ve sunucu surumu birebir ayni olmali (sunucu farkli surumu reddeder; tools/bump.py
// ikisini birlikte yukseltir). Sunucu adresi cozumlemesi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION, serverUrls } from '../src/version.js';

test('istemci ve sunucu surumu ayni', () => {
  const py = fs.readFileSync(new URL('../server/server.py', import.meta.url), 'utf8');
  const m = py.match(/^VERSION = "(\d+\.\d+\.\d+)"/m);
  assert.ok(m, 'server.py VERSION yok');
  assert.equal(m[1], VERSION);
  assert.match(VERSION, /^5\.\d+\.\d+$/);
});

test('sunucu adresi cozumlemesi', () => {
  assert.deepEqual(serverUrls('https://abc-def.trycloudflare.com/'), { http: 'https://abc-def.trycloudflare.com', ws: 'wss://abc-def.trycloudflare.com/ws' });
  assert.deepEqual(serverUrls('abc-def.trycloudflare.com'), { http: 'https://abc-def.trycloudflare.com', ws: 'wss://abc-def.trycloudflare.com/ws' });
  assert.deepEqual(serverUrls('192.168.1.5:5070'), { http: 'http://192.168.1.5:5070', ws: 'ws://192.168.1.5:5070/ws' });
  assert.deepEqual(serverUrls('localhost:5070'), { http: 'http://localhost:5070', ws: 'ws://localhost:5070/ws' });
  assert.deepEqual(serverUrls('ws://10.0.0.2:5070/ws'), { http: 'http://10.0.0.2:5070', ws: 'ws://10.0.0.2:5070/ws' });
});
