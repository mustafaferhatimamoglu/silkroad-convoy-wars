import { RALLY_STAGES } from '../../data/rally.js';
import { REGION_M } from './blueprint.js';

// Ralli parkurlari dunyada: etap yolu (ve botlarin cizgisi) boyunca agac/kaya temizlenmis toprak
// serit. Gercek ralli etaplari gibi orman ve tarla icinden acilmis bir yol; serbest suruste de
// gorunur. Etaplar tools/rally ile bitki ortusu olmadan taranip planlanir (?noveg=1), parkur
// sonra burada acilir.

export const TRACK = { paint: 3.4, clear: 7.5 };   // m: toprak boyasi yari genisligi, temizlik yaricapi

let INDEX = null;
let HEIGHTS = {};   // etap -> yol noktasi basina orijinal yol yuksekligi (content/world/trackh.json)

/** Parkur yukseklik profilleri (dizin kurulmadan once verilmeli). */
export function setTrackHeights(h) { HEIGHTS = h || {}; INDEX = null; }

/**
 * Bolge anahtari -> o bolgeye yakin parcalar [ax, az, bx, bz] (metre, X dogu Z kuzey):
 * path (etap yolu: toprak boya) ve all (yol + bot cizgisi: agac/kaya temizligi).
 */
function index() {
  if (INDEX) return INDEX;
  INDEX = { path: new Map(), all: new Map() };
  const M = TRACK.clear + 4;
  const add = (pts, maps, hs = null) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0] * REGION_M, az = pts[i][1] * REGION_M, bx = pts[i + 1][0] * REGION_M, bz = pts[i + 1][1] * REGION_M;
      const ha = hs ? hs[i] : null, hb = hs ? hs[i + 1] : null;
      const rx0 = Math.floor((Math.min(ax, bx) - M) / REGION_M), rx1 = Math.floor((Math.max(ax, bx) + M) / REGION_M);
      const rz0 = Math.floor((Math.min(az, bz) - M) / REGION_M), rz1 = Math.floor((Math.max(az, bz) + M) / REGION_M);
      for (let rx = rx0; rx <= rx1; rx++) for (let rz = rz0; rz <= rz1; rz++) {
        const k = `${rx},${rz}`;
        for (const map of maps) {
          let a = map.get(k);
          if (!a) map.set(k, (a = []));
          a.push([ax, az, bx, bz, ha, hb]);
        }
      }
    }
  };
  for (const [id, st] of Object.entries(RALLY_STAGES)) {
    const hs = HEIGHTS[id] && HEIGHTS[id].length === st.path.length ? HEIGHTS[id] : null;
    add(st.path, [INDEX.path, INDEX.all], hs);
    if (st.line) add(st.line, [INDEX.all]);
  }
  return INDEX;
}

/** Bolgeye yakin parkur parcalari (bos dizi: parkur yok). kind: 'path' | 'all'. */
export function tracksNear(rx, rz, kind = 'all') { return index()[kind].get(`${rx},${rz}`) || []; }

/** En yakin parkur parcasi: { d, h } (h: profil yuksekligi ya da null). */
export function trackNearest(x, z, segs, out = {}) {
  let best = Infinity, bh = null;
  for (const [ax, az, bx, bz, ha, hb] of segs) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const ex = ax + dx * t - x, ez = az + dz * t - z;
    const d = ex * ex + ez * ez;
    if (d < best) { best = d; bh = ha === null || ha === undefined ? null : ha + (hb - ha) * t; }
  }
  out.d = Math.sqrt(best); out.h = bh;
  return out;
}

/** (x, z) noktasinin parkur parcalarina en kisa uzakligi (m). */
export function trackDist(x, z, segs) {
  let best = Infinity;
  for (const [ax, az, bx, bz] of segs) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const ex = ax + dx * t - x, ez = az + dz * t - z;
    const d = ex * ex + ez * ez;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
