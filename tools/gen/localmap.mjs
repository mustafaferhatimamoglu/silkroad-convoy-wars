// Yerel harita (etap tasarimi icin): bir bolge araliginin ustten gorunumu + bolge izgarasi.
//   node tools/gen/localmap.mjs <cikti.rgb> rx0 rx1 rz0 rz1 [metre/piksel=4]
import fs from 'node:fs';
import { WorldPlan } from '../../src/world/gen/plan.js';

const [out, rx0, rx1, rz0, rz1, mppA] = process.argv.slice(2);
const mpp = Number(mppA || 4);
const X0 = Number(rx0) * 192, X1 = Number(rx1) * 192, Z0 = Number(rz0) * 192, Z1 = Number(rz1) * 192;
const W = Math.floor((X1 - X0) / mpp), H = Math.floor((Z1 - Z0) / mpp);
const plan = new WorldPlan();
const hs = new Float32Array(W * H), s = {};
for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { plan.sample(X0 + (px + 0.5) * mpp, Z1 - (py + 0.5) * mpp, s); hs[py * W + px] = s.h; }
const buf = Buffer.alloc(W * H * 3);
for (let py = 0; py < H; py++) {
  const z = Z1 - (py + 0.5) * mpp;
  for (let px = 0; px < W; px++) {
    const x = X0 + (px + 0.5) * mpp, h = hs[py * W + px];
    const hx = hs[py * W + Math.min(W - 1, px + 1)] - hs[py * W + Math.max(0, px - 1)];
    const hz = hs[Math.max(0, py - 1) * W + px] - hs[Math.min(H - 1, py + 1) * W + px];
    const slope = Math.hypot(hx, hz) / (2 * mpp);
    const shade = Math.max(0.45, Math.min(1.4, 1 + (-hx + hz) / (2 * mpp) * 1.6));
    const b = plan.biome(x, z);
    let r = 124, g = 112, bl = 82;
    const mix = (c, w) => { r += (c[0] - r) * w; g += (c[1] - g) * w; bl += (c[2] - bl) * w; };
    mix([156, 140, 84], b.steppe); mix([84, 116, 52], b.grass); mix([56, 88, 44], b.forest * 0.6); mix([214, 188, 140], b.sand); mix([172, 96, 58], b.mesa * 0.4);
    if (slope > 0.6) mix([150, 60, 60], 0.6);                 // surulemez egim kirmizi
    r *= shade; g *= shade; bl *= shade;
    const wl = plan.waterLevel(x, z);
    if (wl !== null && h < wl) { r = 40; g = 90; bl = 150; }
    plan.sample(x, z, s);
    if (s.road > 0.3) { r = 60; g = 50; bl = 40; }
    if (plan.cityAt(x, z)) { r = r * 0.5 + 100; g = g * 0.5 + 95; bl = bl * 0.5 + 80; }
    // bolge izgarasi
    if (Math.abs(((x / 192) % 1)) < mpp / 192 || Math.abs(((z / 192) % 1)) < mpp / 192) { r = 255; g = 255; bl = 255; }
    const k = (py * W + px) * 3;
    buf[k] = Math.max(0, Math.min(255, r)); buf[k + 1] = Math.max(0, Math.min(255, g)); buf[k + 2] = Math.max(0, Math.min(255, bl));
  }
}
fs.writeFileSync(out, buf);
console.log(JSON.stringify({ w: W, h: H }));
