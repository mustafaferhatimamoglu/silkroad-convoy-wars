// Dunya planinin ustten gorunumu (gelistirme icin): yukseklik golgeli biyom renkleri, su, yollar.
//   node tools/gen/worldmap.mjs <cikti.rgb> [metre/piksel=16]
// Cikti ham RGB (genislik x yukseklik x 3); boyut stdout'a yazilir (Python ile PNG'ye cevrilir).
import fs from 'node:fs';
import { WorldPlan, WORLD } from '../../src/world/gen/plan.js';

const out = process.argv[2] || 'worldmap.rgb';
const mpp = Number(process.argv[3] || 16);
const W = Math.floor(WORLD.w / mpp), H = Math.floor(WORLD.h / mpp);
const t0 = Date.now();
const plan = new WorldPlan();
const t1 = Date.now();
const hs = new Float32Array(W * H);
const buf = Buffer.alloc(W * H * 3);
const s = {};
for (let py = 0; py < H; py++) {
  const z = WORLD.h - (py + 0.5) * mpp;
  for (let px = 0; px < W; px++) {
    const x = (px + 0.5) * mpp;
    plan.sample(x, z, s);
    hs[py * W + px] = s.h;
  }
}
const t2 = Date.now();
for (let py = 0; py < H; py++) {
  const z = WORLD.h - (py + 0.5) * mpp;
  for (let px = 0; px < W; px++) {
    const x = (px + 0.5) * mpp;
    const h = hs[py * W + px];
    const hx = hs[py * W + Math.min(W - 1, px + 1)] - hs[py * W + Math.max(0, px - 1)];
    const hz = hs[Math.max(0, py - 1) * W + px] - hs[Math.min(H - 1, py + 1) * W + px];
    const shade = Math.max(0.45, Math.min(1.35, 1 + (-hx * 0.7 + hz * 0.7) / (2 * mpp) * 2.2));
    const b = plan.biome(x, z);
    let r = 120, g = 110, bl = 80;
    const mix = (c, w) => { r += (c[0] - r) * w; g += (c[1] - g) * w; bl += (c[2] - bl) * w; };
    mix([150, 136, 80], b.steppe);
    mix([80, 112, 46], b.grass);
    mix([52, 84, 40], b.forest * 0.7);
    mix([214, 186, 136], b.sand);
    mix([170, 92, 56], b.mesa * 0.5);
    if (h > 230) mix([130, 126, 118], Math.min(1, (h - 230) / 60));
    if (h > 330) mix([235, 238, 244], Math.min(1, (h - 330) / 40));
    r *= shade; g *= shade; bl *= shade;
    const wl = plan.waterLevel(x, z);
    if (wl !== null && h < wl) { const d = Math.min(1, (wl - h) / 12); r = 40 - d * 20; g = 100 - d * 40; bl = 150 - d * 30; }
    plan.sample(x, z, s);
    if (s.road > 0.3) { r = s.roadKind === 'paved' ? 70 : 150; g = s.roadKind === 'paved' ? 64 : 120; bl = s.roadKind === 'paved' ? 58 : 80; }
    if (s.tunnel) { r = 230; g = 60; bl = 200; }
    const c = plan.cityAt(x, z);
    if (c) { r = r * 0.6 + 180 * 0.4; g = g * 0.6 + 170 * 0.4; bl = bl * 0.6 + 150 * 0.4; }
    const k = (py * W + px) * 3;
    buf[k] = Math.max(0, Math.min(255, r)); buf[k + 1] = Math.max(0, Math.min(255, g)); buf[k + 2] = Math.max(0, Math.min(255, bl));
  }
}
fs.writeFileSync(out, buf);
let lo = Infinity, hi = -Infinity;
for (const v of hs) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
console.log(JSON.stringify({ w: W, h: H, planMs: t1 - t0, sampleUs: ((t2 - t1) * 1000 / (W * H)).toFixed(1), minH: lo.toFixed(1), maxH: hi.toFixed(1),
  cities: plan.cities.map((c) => `${c.id}:${c.h.toFixed(0)}`).join(' ') }));
