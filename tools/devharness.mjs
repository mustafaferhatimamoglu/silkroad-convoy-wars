// Gelistirme test araci: GPU destekli basliksiz Chrome'u baslatir, CDP ile baglanir ve
// yerel bir HTTP arayuzu uzerinden komut kabul eder. Oyunu otomatik test etmek,
// tus basmak ve ekran goruntusu almak icin kullanilir.
//
//   node tools/devharness.mjs [--port 9400] [--url http://localhost:5070/]
//
// Komutlar (curl ile):
//   GET  /nav?url=...                 sayfayi ac
//   POST /eval        (govde: JS)     sayfada calistir, sonucu JSON dondur (await desteklenir)
//   GET  /shot?file=C:\..\a.jpg       ekran goruntusu (jpeg)
//   POST /keys        (govde: JSON)   [{"down":"KeyW"},{"wait":1500},{"up":"KeyW"},{"tap":"KeyC"}]
//   GET  /console?clear=1             birikmis konsol mesajlari
//   GET  /quit

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const PORT = Number(args.port || 9400);
const CDP_PORT = Number(args.cdp || 9333);
const START_URL = args.url || 'about:blank';
const W = Number(args.width || 1600), H = Number(args.height || 900);
const CHROME = args.chrome || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = args.profile || path.join(os.tmpdir(), 'sro-v4-harness-profile');

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--hide-scrollbars',
  '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--force_high_performance_gpu',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check',
  START_URL,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, msgId = 0;
const pending = new Map();
const consoleBuf = [];

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        ws.onmessage = (ev) => {
          const m = JSON.parse(ev.data);
          if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
          if (m.method === 'Runtime.consoleAPICalled') {
            const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
            consoleBuf.push(`[${m.params.type}] ${text}`);
          } else if (m.method === 'Runtime.exceptionThrown') {
            const d = m.params.exceptionDetails;
            consoleBuf.push(`[exception] ${d.text} ${d.exception ? d.exception.description : ''}`);
          } else if (m.method === 'Log.entryAdded') {
            consoleBuf.push(`[log:${m.params.entry.level}] ${m.params.entry.text}`);
          }
          if (consoleBuf.length > 500) consoleBuf.splice(0, consoleBuf.length - 500);
        };
        await call('Runtime.enable'); await call('Page.enable'); await call('Log.enable');
        return;
      }
    } catch (e) { /* bekle */ }
    await sleep(500);
  }
  throw new Error('Chrome CDP baglantisi kurulamadi');
}

function call(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res) => pending.set(id, res));
}

const KEYMAP = {
  Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9],
  ShiftLeft: ['Shift', 16], ControlLeft: ['Control', 17], ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40],
  ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39], F3: ['F3', 114],
};
function keyInfo(code) {
  if (KEYMAP[code]) return KEYMAP[code];
  if (/^Key[A-Z]$/.test(code)) return [code.slice(3).toLowerCase(), code.charCodeAt(3)];
  if (/^Digit\d$/.test(code)) return [code.slice(5), code.charCodeAt(5)];
  return [code, 0];
}
async function key(type, code) {
  const [k, vk] = keyInfo(code);
  await call('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}

async function evaluate(expr) {
  // once ifade olarak dene; soz dizimi hatasi olursa fonksiyon govdesi olarak calistir
  let r = await call('Runtime.evaluate', { expression: `(async () => (${expr}\n))()`, awaitPromise: true, returnByValue: true, timeout: 120000 });
  const ex = r.result && r.result.exceptionDetails;
  if (ex && /SyntaxError/.test(ex.exception?.description || ex.text || '')) {
    r = await call('Runtime.evaluate', { expression: `(async () => { ${expr}\n })()`, awaitPromise: true, returnByValue: true, timeout: 120000 });
  }
  const ex2 = r.result && r.result.exceptionDetails;
  if (ex2) return { error: ex2.exception?.description || ex2.text };
  return { value: r.result && r.result.result ? r.result.result.value : null };
}

function body(req) { return new Promise((res) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => res(d)); }); }

await connect();
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj, null, 1)); };
  try {
    if (u.pathname === '/nav') { await call('Page.navigate', { url: u.searchParams.get('url') }); await sleep(500); return send({ ok: true }); }
    if (u.pathname === '/eval') return send(await evaluate(await body(req)));
    if (u.pathname === '/shot') {
      const file = u.searchParams.get('file') || path.join(os.tmpdir(), 'sro-shot.jpg');
      const q = Number(u.searchParams.get('q') || 82);
      const r = await call('Page.captureScreenshot', { format: 'jpeg', quality: q });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return send({ ok: true, file });
    }
    if (u.pathname === '/keys') {
      const seq = JSON.parse(await body(req));
      for (const s of seq) {
        if (s.down) await key('keyDown', s.down);
        if (s.up) await key('keyUp', s.up);
        if (s.tap) { await key('keyDown', s.tap); await sleep(60); await key('keyUp', s.tap); }
        if (s.wait) await sleep(s.wait);
        if (s.eval) await evaluate(s.eval);
      }
      return send({ ok: true });
    }
    if (u.pathname === '/console') { const out = consoleBuf.slice(); if (u.searchParams.get('clear')) consoleBuf.length = 0; return send(out); }
    if (u.pathname === '/quit') { send({ ok: true }); chrome.kill(); process.exit(0); }
    send({ error: 'bilinmeyen komut' }, 404);
  } catch (e) { send({ error: String(e && e.stack || e) }, 500); }
}).listen(PORT, '127.0.0.1', () => console.log(`devharness hazir: http://127.0.0.1:${PORT}  (CDP ${CDP_PORT})`));

process.on('exit', () => { try { chrome.kill(); } catch (e) { /* yoksay */ } });
