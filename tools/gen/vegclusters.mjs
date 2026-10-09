// Bitki kumeleri (yalnizca bu bilgisayarda; kaynak V4'un donusturdugu modeller, git disi).
// Orijinal agac modellerinin cogu tek agac degil, bir sira/koru (ornegin 90 m'lik sogut sirasi).
// Her buyuk bitki modeli icin model-yerel KABA agac listesi cikarilir: govde tabani (x, z),
// boy ve tac yaricapi. Oyun bu konumlara kendi agac modellerini koyar.
//
//   node tools/gen/vegclusters.mjs        -> content/world/vegclusters.dat (gzip JSON)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..');
const MODELS = process.env.SRO_MODELS || 'C:/Silkroad/Silkroad_V4/assets/models';
const OUT = path.join(ROOT, 'content', 'world');
const bp = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(OUT, 'objects.dat'))).toString('utf8'));
const paths = JSON.parse(fs.readFileSync('C:/Silkroad/Silkroad_V4/assets/map/objects/models.json', 'utf8'));
const byName = new Map();
for (const [id, v] of Object.entries(paths)) byName.set(path.basename(v.path).replace(/\.bsr$/i, '').toLowerCase(), id);
const TREEK = new Set(['tree', 'willow', 'pine', 'palm', 'bamboo', 'bush']);

function loadVerts(mid) {
  const p = path.join(MODELS, 'models', `${mid}.json`);
  if (!fs.existsSync(p)) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  const wood = [], leaf = [];
  for (const m of d.meshes || []) {
    const gp = path.join(MODELS, 'geometry', path.basename(m.geom));
    if (!fs.existsSync(gp)) continue;
    let g;
    try { g = JSON.parse(fs.readFileSync(gp, 'utf8')); } catch { continue; }
    const P = g.data.attributes.position.array;
    const alpha = !!m.alpha || /\.png$/i.test(m.texture || '');
    const dst = alpha ? leaf : wood;
    for (let k = 0; k + 2 < P.length; k += 3) dst.push([P[k] * 0.1, P[k + 1] * 0.1, P[k + 2] * 0.1]);
  }
  return { wood, leaf };
}

/** Yatay kumeleme (acgozlu): r yaricap icindeki noktalar bir kumeye. */
function cluster(pts, r) {
  const out = [];
  for (const p of pts) {
    let best = null, bd = r;
    for (const c of out) { const d = Math.hypot(p[0] - c.x, p[2] - c.z); if (d < bd) { bd = d; best = c; } }
    if (best) { best.sx += p[0]; best.sz += p[2]; best.n++; best.x = best.sx / best.n; best.z = best.sz / best.n; }
    else out.push({ x: p[0], z: p[2], sx: p[0], sz: p[2], n: 1 });
  }
  return out;
}

const res = {};
let nModels = 0, nTrees = 0;
for (const [mi, m] of bp.models.entries()) {
  const kind = bp.kinds[m[0]];
  if (!TREEK.has(kind)) continue;
  const w = m[5] - m[2], d = m[7] - m[4];
  if (Math.max(w, d) < 9) continue;
  const id = byName.get(String(m[8]).toLowerCase());
  if (id === undefined) continue;
  const v = loadVerts(id);
  if (!v || (!v.wood.length && !v.leaf.length)) continue;
  const all = v.wood.concat(v.leaf);
  const minY = Math.min(...all.map((p) => p[1]));
  // govde tabani: ahsap koseler yere yakin; ahsap yoksa yapraklarin alt kismi
  const src = v.wood.length ? v.wood : v.leaf;
  const low = src.filter((p) => p[1] < minY + (v.wood.length ? 1.2 : 2.5));
  let bases = cluster(low, 5).filter((c) => c.n >= 2);
  if (!bases.length) continue;
  // dev agaclarin yayilan kokleri tek govde: boya gore yakin tabanlari birlestir
  const tops = (bs) => bs.map((c) => { let h = 0; for (const p of all) if (Math.hypot(p[0] - c.x, p[2] - c.z) < 6) h = Math.max(h, p[1] - minY); return h; });
  for (let merged = true; merged && bases.length > 1;) {
    merged = false;
    const hs = tops(bases);
    outer: for (let i = 0; i < bases.length; i++) for (let j = i + 1; j < bases.length; j++) {
      if (Math.hypot(bases[i].x - bases[j].x, bases[i].z - bases[j].z) < Math.max(5, 0.2 * Math.max(hs[i], hs[j]))) {
        const a = bases[i], b = bases[j], n = a.n + b.n;
        bases[i] = { x: (a.x * a.n + b.x * b.n) / n, z: (a.z * a.n + b.z * b.n) / n, n };
        bases.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  // her yaprak/ahsap kosesi en yakin tabana: boy (en yuksek) ve tac yaricapi (yatay %90)
  const acc = bases.map(() => ({ h: 0, ds: [] }));
  for (const p of all) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < bases.length; i++) { const dd = Math.hypot(p[0] - bases[i].x, p[2] - bases[i].z); if (dd < bd) { bd = dd; bi = i; } }
    acc[bi].h = Math.max(acc[bi].h, p[1] - minY);
    acc[bi].ds.push(bd);
  }
  const trees = [];
  bases.forEach((c, i) => {
    const ds = acc[i].ds.sort((a, b) => a - b);
    const r = ds.length ? ds[Math.floor(ds.length * 0.9)] : 2;
    trees.push([Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10, Math.round(acc[i].h * 10) / 10, Math.round(r * 10) / 10]);
  });
  res[mi] = trees;
  nModels++; nTrees += trees.length;
  if (/willow03|tre_tree02$|pine07_04|maple03_big$/.test(m[8])) console.log(m[8], trees.length, JSON.stringify(trees.slice(0, 6)));
}
fs.writeFileSync(path.join(OUT, 'vegclusters.dat'), zlib.gzipSync(JSON.stringify(res)));
console.log('modeller', nModels, 'agaclar', nTrees);
