// Yapi siluet sablonu (yalnizca bu bilgisayarda; kaynak V4'un donusturdugu modeller, git disi).
// Her yapi modeli icin model-yerel 1 m (buyuklerde 2 m) izgarada KABA siluet: hucrenin ust
// yuksekligi ve kati govdenin alt yuksekligi (kemer/kapi alti acik kalsin). Oyun bu siluetten kendi
// geometrisini ve malzemelerini kurar; orijinal model/doku pakete girmez.
//
//   node tools/gen/massing.mjs        -> content/world/massing.dat (gzip JSON)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..');
const MODELS = process.env.SRO_MODELS || 'C:/Silkroad/Silkroad_V4/assets/models';
const OUT = path.join(ROOT, 'content', 'world');

const TEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'gen', 'out', 'tex_info.json'), 'utf8'));
// ucgen rengi: dokunun 32x32 kucuk kopyasinda UV agirlik merkezindeki renk (tools/gen/texinfo.py)
const SMALL = fs.readFileSync(path.join(ROOT, 'tools', 'gen', 'out', 'tex_small.bin'));
const SMALLIDX = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'gen', 'out', 'tex_small.json'), 'utf8'));
function sampleTex(name, u, v) {
  const o = SMALLIDX[name];
  if (o === undefined) return null;
  const fx = ((u % 1) + 1) % 1, fy = ((v % 1) + 1) % 1;
  // 3x3 komsu ortalamasi (dikis/desen gurultusu azalsin)
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = (Math.floor(fx * 32) + dx + 32) % 32, y = (Math.floor(fy * 32) + dy + 32) % 32;
    const p = o * 3072 + (y * 32 + x) * 3;
    r += SMALL[p]; g += SMALL[p + 1]; b += SMALL[p + 2]; n++;
  }
  return [r / n, g / n, b / n];
}
// malzeme paleti: [tur, r, g, b] (renk 8'lik adimla) -> indeks
const PAL = [], PALIDX = new Map();
function palIndex(info) {
  const key = `${info[0]},${info[1] >> 3},${info[2] >> 3},${info[3] >> 3}`;
  let i = PALIDX.get(key);
  if (i === undefined) { i = PAL.length; PAL.push([info[0], (info[1] >> 3) * 8 + 4, (info[2] >> 3) * 8 + 4, (info[3] >> 3) * 8 + 4]); PALIDX.set(key, i); }
  return i;
}
const bp = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(OUT, 'objects.dat'))).toString('utf8'));
const NATURE = new Set(['grass', 'bush', 'palm', 'pine', 'bamboo', 'willow', 'tree', 'rock']);
const paths = JSON.parse(fs.readFileSync('C:/Silkroad/Silkroad_V4/assets/map/objects/models.json', 'utf8'));
// sablon model indeksi -> orijinal model kimligi (ad ile)
const byName = new Map();
for (const [id, v] of Object.entries(paths)) byName.set(path.basename(v.path).replace(/\.bsr$/i, '').toLowerCase(), id);

function loadGeom(mid) {
  const p = path.join(MODELS, 'models', `${mid}.json`);
  if (!fs.existsSync(p)) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  const tris = [];
  for (const m of d.meshes || []) {
    const gp = path.join(MODELS, 'geometry', path.basename(m.geom));
    if (!fs.existsSync(gp)) continue;
    let g;
    try { g = JSON.parse(fs.readFileSync(gp, 'utf8')); } catch { continue; }   // bozuk dosya
    const P = g.data.attributes.position.array;
    const I = g.data.index ? g.data.index.array : null;
    const n = I ? I.length : P.length / 3;
    const alpha = !!m.alpha || /\.png$/i.test(m.texture || '');
    const tname = path.basename(m.texture || '').toLowerCase();
    const ti = TEX.tex[tname] || [0, 200, 190, 170];
    const U = g.data.attributes.uv ? g.data.attributes.uv.array : null;
    for (let k = 0; k + 2 < n; k += 3) {
      const a = I ? I[k] : k, b = I ? I[k + 1] : k + 1, c = I ? I[k + 2] : k + 2;
      const uv = U ? [U[a * 2], U[a * 2 + 1], U[b * 2], U[b * 2 + 1], U[c * 2], U[c * 2 + 1]] : null;
      tris.push([P[a * 3] * 0.1, P[a * 3 + 1] * 0.1, P[a * 3 + 2] * 0.1, P[b * 3] * 0.1, P[b * 3 + 1] * 0.1, P[b * 3 + 2] * 0.1, P[c * 3] * 0.1, P[c * 3 + 1] * 0.1, P[c * 3 + 2] * 0.1, alpha, { tname, cls: ti[0], base: ti, uv }]);
    }
  }
  return tris;
}

/**
 * Ucgenleri izgaraya: ust (max y), alt (zemin olmayan en dusuk y), zemin. Renk her ornek noktasinda
 * yuzeyin doku koordinatindan okunur: ust yuz rengi en yuksek ornegin rengi, yan yuz rengi dikey
 * orneklerin ortalamasi, turu dikey orneklerde cogunluk.
 */
function rasterize(tris, bb, res) {
  const [x0, , z0, x1, , z1] = bb;
  const nx = Math.max(1, Math.ceil((x1 - x0) / res)), nz = Math.max(1, Math.ceil((z1 - z0) / res));
  const N = nx * nz, NC = TEX.classes.length;
  const top = new Float32Array(N).fill(-1e9), low = new Float32Array(N).fill(1e9), floor = new Float32Array(N).fill(-1e9);
  const topCol = new Float32Array(N * 3), topCls = new Int16Array(N);
  const sideSum = new Float32Array(N * 3), sideN = new Float32Array(N), sideCls = new Uint16Array(N * NC);
  let cur = null, curVert = false;
  const put = (x, z, y, isFloor, u, v) => {
    const i = Math.floor((x - x0) / res), j = Math.floor((z - z0) / res);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return;
    const k = j * nx + i;
    const col = (cur.uv && sampleTex(cur.tname, u, v)) || [cur.base[1], cur.base[2], cur.base[3]];
    if (y > top[k]) { top[k] = y; topCol[k * 3] = col[0]; topCol[k * 3 + 1] = col[1]; topCol[k * 3 + 2] = col[2]; topCls[k] = cur.cls; }
    if (curVert) { sideSum[k * 3] += col[0]; sideSum[k * 3 + 1] += col[1]; sideSum[k * 3 + 2] += col[2]; sideN[k]++; sideCls[k * NC + cur.cls]++; }
    if (isFloor) { if (y > floor[k]) floor[k] = y; } else if (y < low[k]) low[k] = y;
  };
  for (const t of tris) {
    if (t[9]) continue;                       // saydam dokulu (yaprak, oymali kafes): siluete girmez
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t;
    cur = t[10];
    const uv = cur.uv || [0, 0, 0, 0, 0, 0];
    // normal: yukari bakan, tabana yakin yuzey "zemin" (gecit alti yolu) sayilir
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
    const L = Math.hypot(nX, nY, nZ) || 1;
    const up = Math.abs(nY / L);
    const isFloor = up > 0.8 && Math.max(ay, by, cy) < 0.9;
    curVert = up < 0.5;
    // kenarlar ve dikey yuzler: ucgen icinde 0.4 hucre adimli barisentrik ornekleme (dikey yuzler
    // izgarada alan kaplamaz, bu yuzden duzlemde degil ucgenin kendisinde orneklenir)
    const e1 = Math.hypot(ux, uy, uz), e2 = Math.hypot(vx, vy, vz);
    const steps = curVert ? Math.max(1, Math.ceil(Math.max(e1, e2) / (res * 0.4))) : Math.max(1, Math.ceil(Math.max(e1, e2) / (res * 0.8)));
    for (let p = 0; p <= steps; p++) {
      for (let q = 0; q <= steps - p; q++) {
        if (!curVert && p > 0 && q > 0 && p + q < steps) continue;      // yatay ucgenin icini asagidaki tarama kapsar
        const f = p / steps, g = q / steps, w = 1 - f - g;
        put(ax * w + bx * f + cx * g, az * w + bz * f + cz * g, ay * w + by * f + cy * g, isFloor,
          uv[0] * w + uv[2] * f + uv[4] * g, uv[1] * w + uv[3] * f + uv[5] * g);
      }
    }
    if (curVert) continue;
    // ic: hucre merkezlerinde barisentrik
    const mnx = Math.min(ax, bx, cx), mxx = Math.max(ax, bx, cx), mnz = Math.min(az, bz, cz), mxz = Math.max(az, bz, cz);
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-9) continue;
    for (let i = Math.floor((mnx - x0) / res); i <= Math.floor((mxx - x0) / res); i++) {
      for (let j = Math.floor((mnz - z0) / res); j <= Math.floor((mxz - z0) / res); j++) {
        const px = x0 + (i + 0.5) * res, pz = z0 + (j + 0.5) * res;
        const w1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den;
        const w2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den;
        const w3 = 1 - w1 - w2;
        if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
        put(px, pz, w1 * ay + w2 * by + w3 * cy, isFloor, w1 * uv[0] + w2 * uv[2] + w3 * uv[4], w1 * uv[1] + w2 * uv[3] + w3 * uv[5]);
      }
    }
  }
  // renk yumusatma: ayni turdeki 4 komsuyla yarim yarima (damali desen gurultusu kalksin)
  const blur = (col, cls, ok) => {
    const outc = Float32Array.from(col);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!ok(k)) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = jj * nx + ii;
        if (!ok(kk) || cls(kk) !== cls(k)) continue;
        r += col[kk * 3]; g += col[kk * 3 + 1]; b += col[kk * 3 + 2]; n++;
      }
      if (n) { outc[k * 3] = col[k * 3] * 0.5 + (r / n) * 0.5; outc[k * 3 + 1] = col[k * 3 + 1] * 0.5 + (g / n) * 0.5; outc[k * 3 + 2] = col[k * 3 + 2] * 0.5 + (b / n) * 0.5; }
    }
    col.set(outc);
  };
  blur(topCol, (k) => topCls[k], (k) => top[k] > -1e8);
  const sideCol = new Float32Array(N * 3);
  const sideBest = new Int16Array(N);
  for (let k = 0; k < N; k++) {
    if (!sideN[k]) continue;
    for (let c = 0; c < 3; c++) sideCol[k * 3 + c] = sideSum[k * 3 + c] / sideN[k];
    let bc = 0;
    for (let c = 1; c < NC; c++) if (sideCls[k * NC + c] > sideCls[k * NC + bc]) bc = c;
    sideBest[k] = bc;
  }
  blur(sideCol, (k) => sideBest[k], (k) => sideN[k] > 0);
  const topMat = new Int32Array(N), sideMat = new Int32Array(N);
  for (let k = 0; k < N; k++) {
    if (top[k] < -1e8) continue;
    topMat[k] = palIndex([topCls[k], topCol[k * 3] | 0, topCol[k * 3 + 1] | 0, topCol[k * 3 + 2] | 0]);
    if (sideN[k] > 0) sideMat[k] = palIndex([sideBest[k], sideCol[k * 3] | 0, sideCol[k * 3 + 1] | 0, sideCol[k * 3 + 2] | 0]);
    else sideMat[k] = topMat[k];
  }
  return { nx, nz, top, low, floor, topMat, sideMat };
}

const out = {};
let done = 0, cells = 0;
for (let mi = 0; mi < bp.models.length; mi++) {
  const m = bp.models[mi];
  const kind = bp.kinds[m[0]];
  if (NATURE.has(kind)) continue;
  const [x0, y0, z0, x1, y1, z1] = m.slice(2, 8);
  const w = x1 - x0, d = z1 - z0, h = y1 - y0;
  if (Math.max(w, d) < 2.6 || h < 1.6) continue;              // kucuk esya: blok yeter
  const mid = byName.get(m[8].toLowerCase());
  if (!mid) continue;
  const tris = loadGeom(mid);
  if (!tris || !tris.length) continue;
  const res = Math.max(w, d) > 90 ? 2 : 1;
  const r = rasterize(tris, [x0, y0, z0, x1, y1, z1], res);
  const enc = (a, none) => Array.from(a, (v) => (v < -1e8 || v > 1e8 ? none : Math.round(v * 10)));
  out[mi] = { res, x0: +x0.toFixed(2), z0: +z0.toFixed(2), nx: r.nx, nz: r.nz, top: enc(r.top, -32768), low: enc(r.low, 32767), floor: enc(r.floor, -32768),
    tm: Array.from(r.topMat, (v) => Math.max(0, v)), sm: Array.from(r.sideMat, (v) => Math.max(0, v)) };
  done++; cells += r.nx * r.nz;
}
const raw = Buffer.from(JSON.stringify({ classes: TEX.classes, palette: PAL, models: out }));
fs.writeFileSync(path.join(OUT, 'massing.dat'), zlib.gzipSync(raw, { level: 9 }));
console.log(`siluet: ${done} model, ${cells} hucre, ${(fs.statSync(path.join(OUT, 'massing.dat')).size / 1024).toFixed(0)} KB`);
