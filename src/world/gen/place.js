import { hash2 } from './noise.js';
import { REGION_M } from './plan.js';
import { cityLayout } from './city.js';

// Bolge objeleri: bitki ortusu ve kayalar (8 m izgarada tekrarlanabilir dagitim) + bolgeye dusen
// sehir parcalari. Cikti bolge-yerel Three.js koordinatlarinda: x dogu, z = -kuzey, y metre;
// yaw Three.js Y donusu; s olcek.

const VERTS = 97;
const CELL = 8;

export function placeRegionObjects(data, rx, rz, d) {
  const plan = data.plan;
  const x0 = rx * REGION_M, z0 = rz * REGION_M;
  const out = [];
  const H = (lx, lz) => {
    // bolge yerel metre -> arazi yuksekligi (iki dogrusal)
    const fx = Math.min(Math.max(lx / 2, 0), 95.999), fz = Math.min(Math.max(lz / 2, 0), 95.999);
    const j = Math.floor(fx), i = Math.floor(fz), tx = fx - j, tz = fz - i;
    const h = d.heights;
    const a = h[i * VERTS + j], b = h[i * VERTS + j + 1], c = h[(i + 1) * VERTS + j], e = h[(i + 1) * VERTS + j + 1];
    return ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz) * 0.1;
  };
  const roadAt = (lx, lz) => {
    const j = Math.round(lx / 2), i = Math.round(lz / 2);
    let m = 0;
    for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && ii < VERTS && jj >= 0 && jj < VERTS) m = Math.max(m, d.roads[ii * VERTS + jj]);
    }
    return m;
  };
  const push = (m, lx, lz, yaw, s = 1, sink = 0.15) => out.push({ m, x: lx, y: H(lx, lz) - sink, z: -lz, yaw, s });

  // ---- sehir parcalari (merkezi bu bolgede olanlar)
  for (const c of plan.cities) {
    if (c.x + c.r + 40 < x0 || c.x - c.r - 40 > x0 + REGION_M || c.z + c.r + 40 < z0 || c.z - c.r - 40 > z0 + REGION_M) continue;
    const L = cityLayout(plan, c);
    for (const it of L.items) {
      const lx = it.x - x0, lz = it.z - z0;
      if (lx < 0 || lx >= REGION_M || lz < 0 || lz >= REGION_M) continue;
      push(it.m, lx, lz, it.yaw, 1, it.m.startsWith('wall') || it.m.startsWith('gate') || it.m.startsWith('tower') ? 1.0 : 0.4);
    }
  }

  // ---- isinlanma kapilari
  for (const g of plan.portals) {
    const lx = g.x - x0, lz = g.z - z0;
    if (lx < 0 || lx >= REGION_M || lz < 0 || lz >= REGION_M) continue;
    push(`portal:${g.culture}`, lx, lz, g.yaw, 1, 0.3);
  }

  // ---- feribot iskeleleri (kiyidan iskele ucuna, guverte su seviyesinin 1.2 m ustunde)
  for (const f of plan.ferries) {
    for (const dk of [f.a, f.b]) {
      const lx = dk.sx - x0, lz = dk.sz - z0;
      if (lx < 0 || lx >= REGION_M || lz < 0 || lz >= REGION_M) continue;
      const L = Math.round(Math.hypot(dk.ex - dk.sx, dk.ez - dk.sz) + 2);
      out.push({ m: `pier:${L}`, x: lx, y: dk.wl + 1.2, z: -lz, yaw: Math.atan2(dk.ez - dk.sz, dk.ex - dk.sx), s: 1 });
    }
  }

  // ---- bitki ortusu ve kayalar
  const n = REGION_M / CELL;
  for (let ci = 0; ci < n; ci++) {
    for (let cj = 0; cj < n; cj++) {
      const gx = rx * n + cj, gz = rz * n + ci;
      const r1 = hash2(gx, gz, 11), r2 = hash2(gx, gz, 12), r3 = hash2(gx, gz, 13), r4 = hash2(gx, gz, 14);
      const lx = cj * CELL + r1 * CELL, lz = ci * CELL + r2 * CELL;
      const X = x0 + lx, Z = z0 + lz;
      // sehir ici ve cevresi (sur disi 25 m) bos
      let inCity = false;
      for (const c of plan.cities) if (Math.hypot(X - c.x, Z - c.z) < c.r + 25) { inCity = true; break; }
      if (inCity) continue;
      const h = H(lx, lz);
      const wl = plan.waterLevel(X, Z);
      if (wl !== null && h < wl + 0.6) continue;
      if (roadAt(lx, lz) > 0.02) continue;
      const gxh = H(lx + 2, lz) - H(lx - 2, lz), gzh = H(lx, lz + 2) - H(lx, lz - 2);
      const slope = Math.hypot(gxh, gzh) / 4;
      const bio = plan.biome(X, Z);
      const yaw = r3 * Math.PI * 2;
      // agaclar
      const pTree = bio.forest * 0.5 + bio.grass * 0.05 + bio.wet * 0.22 + (h > 110 && h < 300 ? 0.12 : 0);
      if (slope < 0.75 && r4 < pTree) {
        let kind;
        const desertish = bio.sand > 0.25 || (Z < 1250 && X < 6200);
        if (h > 130) kind = 'pine';
        else if (desertish) kind = bio.wet > 0.15 ? 'palm' : (r3 < 0.5 ? 'bush' : null);
        else if (X < 6000 && hash2(gx, gz, 15) < 0.35) kind = 'cypress';
        else kind = X > 12500 && hash2(gx, gz, 16) < 0.3 ? 'pine' : 'broad';
        if (kind) { push(`${kind}:${Math.floor(hash2(gx, gz, 17) * 6)}`, lx, lz, yaw, 0.8 + hash2(gx, gz, 18) * 0.5); continue; }
      }
      // kayalar
      const pRock = slope > 0.4 ? 0.1 : h > 160 ? 0.05 : bio.mesa > 0.3 ? 0.03 : bio.sand > 0.5 ? 0.004 : 0.008;
      if (hash2(gx, gz, 19) < pRock) {
        const size = 0.6 + hash2(gx, gz, 20) * (slope > 0.4 ? 2.6 : 1.4);
        const red = bio.mesa > 0.25 || bio.sand > 0.5 ? ':red' : '';
        push(`rock:${Math.floor(hash2(gx, gz, 21) * 5)}:${size.toFixed(1)}:0.65${red}`, lx, lz, yaw, 1, size * 0.25);
        continue;
      }
      // calilar ve ot tutamlari
      const pBush = bio.steppe * 0.08 + bio.grass * 0.06 + bio.forest * 0.08;
      if (slope < 0.6 && hash2(gx, gz, 22) < pBush) { push(`bush:${Math.floor(hash2(gx, gz, 23) * 4)}`, lx, lz, yaw, 0.8 + r1 * 0.5); continue; }
      const pTuft = bio.grass * 0.35 + bio.steppe * 0.2;
      if (slope < 0.5 && hash2(gx, gz, 24) < pTuft) push(`tuft:${Math.floor(hash2(gx, gz, 25) * 4)}`, lx, lz, yaw, 0.8 + r2 * 0.6, 0.05);
    }
  }
  return out;
}
