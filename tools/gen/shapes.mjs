// Yapi siluetlerinin bicim ozellikleri (mimari turetme icin inceleme araci).
//   node tools/gen/shapes.mjs [--list tur]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..');
const W = path.join(ROOT, 'content', 'world');
const bp = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(W, 'objects.dat'))).toString());
const ms = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(W, 'massing.dat'))).toString());

// her model kac kez kullaniliyor
const uses = new Map();
for (const lst of Object.values(bp.regions)) for (const o of lst) uses.set(o[0], (uses.get(o[0]) || 0) + 1);

export function features(M) {
  const { nx, nz, res } = M;
  const n = nx * nz;
  const top = new Float32Array(n), mask = new Uint8Array(n);
  let cnt = 0;
  for (let k = 0; k < n; k++) {
    if (M.top[k] === -32768) continue;
    top[k] = M.top[k] / 10;
    if (top[k] > 0.6) { mask[k] = 1; cnt++; }
  }
  if (!cnt) return null;
  // kenar uzakligi (hucre): mask icinde
  const dist = new Float32Array(n).fill(1e9);
  const q = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!mask[k]) continue;
    let edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && !mask[jj * nx + ii]) edge = true; }
    if (edge) { dist[k] = 0; q.push(k); }
  }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % nx, j = (k / nx) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = jj * nx + ii;
      if (mask[kk] && dist[kk] > dist[k] + 1) { dist[kk] = dist[k] + 1; q.push(kk); }
    }
  }
  let maxD = 0; for (let k = 0; k < n; k++) if (mask[k] && dist[k] > maxD) maxD = dist[k];
  let sumE = 0, nE = 0, sumC = 0, nC = 0, mx = 0, sum = 0, sum2 = 0;
  for (let k = 0; k < n; k++) {
    if (!mask[k]) continue;
    const t = top[k];
    mx = Math.max(mx, t); sum += t; sum2 += t * t;
    if (dist[k] <= 0.5) { sumE += t; nE++; }
    if (dist[k] >= maxD * 0.6) { sumC += t; nC++; }
  }
  const mean = sum / cnt, std = Math.sqrt(Math.max(0, sum2 / cnt - mean * mean));
  const w = nx * res, d = nz * res;
  return { w, d, fill: cnt / n, H: mx, mean, std, edge: sumE / nE, center: sumC / nC, pitch: sumC / nC - sumE / nE, thick: maxD * res * 2 };
}

function classify(f) {
  if (!f) return 'empty';
  const minWD = Math.min(f.w, f.d), maxWD = Math.max(f.w, f.d);
  if (f.H > 8 && maxWD < f.H * 0.45) return 'spire';          // minare, kule, direk
  if (f.thick < 4.5 && maxWD > 8 && f.H > 2.2) return 'wall';  // ince uzun (sur, duvar, cit)
  if (f.H < 2.6 && f.fill > 0.5) return 'platform';           // teras, meydan, alcak zemin
  if (f.std < 0.8 && f.fill > 0.6) return 'flat';             // duz damli kutu
  if (f.pitch > 1.2 && f.fill > 0.55) return 'pitched';       // sirtli cati (salon, ev)
  return 'complex';
}

const stat = new Map();
const rows = [];
for (const [mi, M] of Object.entries(ms.models)) {
  const m = bp.models[mi];
  const f = features(M);
  const c = classify(f);
  const u = uses.get(Number(mi)) || 0;
  const key = `${m[1]}:${c}`;
  const s = stat.get(key) || { models: 0, uses: 0 };
  s.models++; s.uses += u; stat.set(key, s);
  rows.push({ mi, name: m[8], culture: m[1], c, u, f });
}
console.log([...stat.entries()].sort((a, b) => b[1].uses - a[1].uses).map(([k, v]) => `${k} ${v.models}m/${v.uses}u`).join('\n'));
const want = process.argv[process.argv.indexOf('--list') + 1];
if (process.argv.includes('--list')) {
  for (const r of rows.filter((x) => x.c === want).sort((a, b) => b.u - a.u).slice(0, 40)) {
    const f = r.f;
    console.log(r.u, r.culture, r.name, `${f.w.toFixed(0)}x${f.d.toFixed(0)} H${f.H.toFixed(1)} fill${f.fill.toFixed(2)} std${f.std.toFixed(1)} pitch${f.pitch.toFixed(1)} thick${f.thick.toFixed(1)}`);
  }
}
