import { hash2 } from './noise.js';
import { REGION_M } from './blueprint.js';
import { tunnelItems } from './tunnel.js';
import { tracksNear, trackDist, TRACK } from './tracks.js';
import { archInfo } from './models.js';
import { AIRPIER } from './docks.js';

// Bolge objeleri: orijinal haritanin sablonundaki nesne yerlesimi (tur + konum + yon + sinir
// kutusu) bizim modellerimize cevrilir: agac boyu, sur uzunlugu/yuksekligi, ev tabani ve kati,
// kapi acikligi, kopru boyu korunur; geometri ve dokular bizim. Cikti bolge-yerel Three.js
// koordinatlarinda: x dogu, z = -kuzey, y metre; yaw Three.js Y donusu; s olcek.

const VERTS = 97;
const q = (v, step = 0.5) => Math.max(step, Math.round(v / step) * step);

/** Sablon modelinin bizim turumuz; adlardan ince ayar. */
function refine(kind, name, w, d, h) {
  const n = name.toLowerCase();
  if (/smoke|_fx|effect|particle|fire-|_fire|brazier|water_|waterfall|shadow/.test(n)) return 'skip';
  if (kind === 'house' || kind === 'prop') {
    if (/petra|canyon|rocky|_rock|cliff|crag/.test(n)) return 'rockmass';
    if (/tree|palm/.test(n)) return 'tree';
    if (/flower|plant|weed|grass|pot\d|_pot/.test(n)) return 'grass';
    if (/bush|hedge/.test(n)) return 'bush';
    if (/tent|yurt|ger\d/.test(n)) return 'tent';
    if (/wagon|cart/.test(n)) return 'cart';
    if (/stall|shop|booth/.test(n) && Math.max(w, d) < 6) return 'stall';
    if (h < 0.4 || Math.max(w, d) < 0.6) return 'skip';
    if (Math.max(w, d) < 2.6 || h < 1.6) return 'prop';
  }
  return kind;
}

// agac modellerimizin olcek 1'deki yaklasik boyu (m)
const TREE_H = { palm: 9.5, pine: 12, cypress: 10, broad: 8, willow: 5.6, dead: 5 };
const BUILDING = new Set(['house', 'wall', 'tower', 'gate', 'bridge', 'stair']);
const VEG = new Set(['grass', 'bush', 'tree', 'palm', 'pine', 'willow', 'bamboo', 'rock']);

export function placeRegionObjects(data, rx, rz, d) {
  const plan = data.plan;
  const x0 = rx * REGION_M, z0 = rz * REGION_M;
  const out = [];
  const H = (lx, lz) => {
    const fx = Math.min(Math.max(lx / 2, 0), 95.999), fz = Math.min(Math.max(lz / 2, 0), 95.999);
    const j = Math.floor(fx), i = Math.floor(fz), tx = fx - j, tz = fz - i;
    const h = d.heights;
    const a = h[i * VERTS + j], b = h[i * VERTS + j + 1], c = h[(i + 1) * VERTS + j], e = h[(i + 1) * VERTS + j + 1];
    return ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz) * 0.1;
  };
  const track = tracksNear(rx, rz, 'all');
  const noVeg = !!globalThis.__sroNoVeg;
  const K = plan.objKinds, M = plan.objModels;
  for (const [mi, X, Z, Y, yaw] of plan.objectsIn(rx, rz)) {
    const m = M[mi];
    const culture = m[1] === 'common' || m[1] === 'ruin' ? cityCulture(plan, X, Z) : m[1];
    const bx0 = m[2], by0 = m[3], bz0 = m[4], bx1 = m[5], by1 = m[6], bz1 = m[7];
    const w = bx1 - bx0, dd = bz1 - bz0;
    const h = by1 - Math.max(by0, -2);
    const kind = refine(K[m[0]], m[8], w, dd, h);
    if (kind === 'skip') continue;
    if (VEG.has(kind) && (noVeg || (track.length && trackDist(X, Z, track) < TRACK.clear))) continue;
    // bekci aslanlar (kaide ayri nesne): bizim heykelimiz, orijinal boyda
    if (/lion\d|lion_\d|_lion0/.test(m[8]) && !/dan/.test(m[8])) {
      const ox = X - x0, oz = Z - z0;
      if (ox >= 0 && ox < REGION_M && oz >= 0 && oz < REGION_M) out.push({ m: 'lion:0', x: ox, y: Y + Math.max(0, by0), z: -oz, yaw, s: Math.max(0.5, h / 2.1) });
      continue;
    }
    // yapi siluetten: orijinal konum, yon ve yukseklik (model kendi ekseninde)
    if (!VEG.has(kind) && plan.massing.models && plan.massing.models[mi]) {
      const ox0 = X - x0, oz0 = Z - z0;
      if (ox0 < -60 || ox0 > REGION_M + 60 || oz0 < -60 || oz0 > REGION_M + 60) continue;
      // kucuk esya/ciftlik nesnesi (saman yigini, cit, araba...): yumusak siluet, mimari ve pencere yok
      const soft = !BUILDING.has(kind) || Math.max(w, dd) < 5 || h < 3;
      const ak = soft ? (archInfo(mi, m[8], culture) === 'rock' ? 'rock' : null) : archInfo(mi, m[8], culture);
      const key = soft && ak !== 'rock' ? `mass:${mi}:${culture}+soft` : ak === 'rock' ? `mass:${mi}:${culture === 'desert' || culture === 'egypt' || culture === 'persian' ? 'redrock' : 'rock'}`
        : ak === 'steps' ? `mass:${mi}:${culture}+steps` : ak ? `arch:${mi}:${culture}:${ak}` : `mass:${mi}:${culture}`;
      out.push({ m: key, x: ox0, y: Y, z: -oz0, yaw, s: 1 });
      continue;
    }
    // sinir kutusu merkezi (model yerel, Three ekseni) -> dunya: x' = c*x + s*z, z' = -s*x + c*z ; plan Z = -z
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ox = c * cx + s * cz, oz = -s * cx + c * cz;
    const lx = X + ox - x0, lz = Z - oz - z0;
    if (lx < -40 || lx > REGION_M + 40 || lz < -40 || lz > REGION_M + 40) continue;
    const gy = H(Math.min(Math.max(lx, 0), 191.9), Math.min(Math.max(lz, 0), 191.9));
    const v = Math.floor(hash2(Math.round(X * 7), Math.round(Z * 7), 31) * 6);
    const push = (key, ry = yaw, sc = 1, y = gy) => out.push({ m: key, x: lx, y, z: -lz, yaw: ry, s: sc });
    // uzun kenar yerel x olsun (sur, kapi, kopru, cit)
    const long = () => (dd > w ? { L: dd, T: w, ry: yaw + Math.PI / 2 } : { L: w, T: dd, ry: yaw });
    switch (kind) {
      case 'grass': push(`tuft:${v % 4}`, yaw, Math.min(1.8, Math.max(0.6, h / 0.7)), gy - 0.05); break;
      case 'bush': push(`bush:${v % 4}`, yaw, Math.min(2.2, Math.max(0.6, h / 1.4)), gy - 0.1); break;
      case 'palm':
      case 'pine':
      case 'bamboo':
      case 'willow':
      case 'tree': {
        const nm = m[8];
        const sp = kind === 'willow' || /willow/.test(nm) ? 'willow' : kind === 'palm' || /tropical|palm/.test(nm) ? 'palm'
          : kind === 'pine' || /kara|pine|fir|snow/.test(nm) ? 'pine' : kind === 'bamboo' || /cypress|longtree|poplar|bamboo/.test(nm) ? 'cypress'
            : /_dry|dead/.test(nm) ? 'dead' : 'broad';
        const base = TREE_H[sp];
        // orijinal model cogu zaman bir koru/sira: govde konumlari ve boylari kumeden
        const cl = plan.veg && plan.veg[mi];
        if (cl) {
          for (const [tx, tz, th] of cl) {
            const px = X + c * tx + s * tz - x0, pz = Z - (-s * tx + c * tz) - z0;
            if (px < -40 || px > REGION_M + 40 || pz < -40 || pz > REGION_M + 40) continue;
            if (track.length && trackDist(px + x0, pz + z0, track) < TRACK.clear + th * 0.06) continue;   // ralli parkuru acik
            const ty = H(Math.min(Math.max(px, 0), 191.9), Math.min(Math.max(pz, 0), 191.9));
            const vv = Math.floor(hash2(Math.round(px * 7 + X), Math.round(pz * 7 + Z), 37) * 6);
            if (th < 1.6) { out.push({ m: `tuft:${vv % 4}`, x: px, y: ty - 0.05, z: -pz, yaw: yaw + vv, s: Math.max(0.6, th / 0.7) }); continue; }
            if (th < 3.2) { out.push({ m: `bush:${vv % 4}`, x: px, y: ty - 0.1, z: -pz, yaw: yaw + vv, s: Math.max(0.6, th / 1.6) }); continue; }
            out.push({ m: `${sp}:${vv}`, x: px, y: ty - 0.15, z: -pz, yaw: yaw + vv * 1.1, s: Math.min(16, Math.max(0.35, th / base)) });
          }
          break;
        }
        if (h < 1.6) { push(`tuft:${v % 4}`, yaw, Math.max(0.6, h / 0.7), gy - 0.05); break; }
        if (h < 3.2) { push(`bush:${v % 4}`, yaw, Math.max(0.6, h / 1.6), gy - 0.1); break; }
        push(`${sp}:${v}`, yaw, Math.min(16, Math.max(0.35, h / base)), gy - 0.15);
        break;
      }
      case 'rock': {
        const size = q(Math.max(0.4, Math.max(w, dd, h) * 0.5), 0.2);
        push(`rock:${v % 5}:${size.toFixed(1)}:0.65${culture === 'desert' || culture === 'egypt' ? ':red' : ''}`, yaw, 1, gy - size * 0.25);
        break;
      }
      case 'rockmass': push(`block:rock:${q(w, 1)}:${q(dd, 1)}:${q(h, 1)}`, yaw, 1, gy - 1.5); break;
      case 'wall': {
        const { L, T, ry } = long();
        push(`wall:${culture}:${q(L, 1)}:${q(Math.max(2, h), 1)}:${q(Math.min(Math.max(T, 0.6), 6), 0.5)}`, ry, 1, gy - 0.6);
        break;
      }
      case 'gate': {
        const { L, T, ry } = long();
        if (L < 6 || h < 4) { push(`block:${culture}:${q(w, 0.5)}:${q(dd, 0.5)}:${q(h, 0.5)}`, yaw, 1, gy - 0.3); break; }
        push(`gate:${culture}:${q(L, 1)}:${q(Math.max(3, T), 1)}:${q(h, 1)}`, ry, 1, gy - 0.6);
        break;
      }
      case 'tower': push(`tower:${culture}:${q(Math.max(1.5, Math.min(w, dd) / 2), 0.5)}:${q(Math.max(4, h), 1)}`, yaw, 1, gy - 0.6); break;
      case 'house': {
        const floors = Math.max(1, Math.min(6, Math.round((h * 0.72) / 3.2)));
        push(`house:${culture}:${v}:${q(w, 1)}:${q(dd, 1)}:${floors}`, yaw, 1, gy - 0.4);
        break;
      }
      case 'bridge': {
        // kopru yuksekligi orijinalden (nehri asar); guverte ust yuzeyi kutunun ust kenarina yakin
        const { L, T, ry } = long();
        push(`bridge:${culture}:${q(L, 1)}:${q(Math.max(3, T), 1)}`, ry, 1, Y + by1 - 1.0);
        break;
      }
      case 'ship': push(`block:wood:${q(w, 1)}:${q(dd, 1)}:${q(Math.min(h, 8), 1)}`, yaw, 1, Y + by0); break;
      case 'tent': push(`tent:${culture}:${q(w, 0.5)}:${q(dd, 0.5)}:${q(h, 0.5)}`, yaw, 1, gy - 0.1); break;
      case 'fence': {
        const { L, ry } = long();
        push(`fence:${q(L, 0.5)}:${q(Math.min(Math.max(h, 0.8), 3), 0.5)}`, ry, 1, gy - 0.1);
        break;
      }
      case 'lamp': push(`lamp:${culture}:${q(Math.min(Math.max(h, 1.5), 8), 0.5)}`, yaw, 1, gy - 0.1); break;
      case 'flag': push(`flag:${culture}:${q(Math.min(Math.max(h, 3), 14), 1)}`, yaw, 1, gy - 0.1); break;
      case 'statue': push(`statue:${culture}:${q(Math.max(w, dd), 0.5)}:${q(h, 0.5)}`, yaw, 1, gy - 0.2); break;
      case 'stall': push(`stall:${culture}:${q(w, 0.5)}:${q(dd, 0.5)}`, yaw, 1, gy - 0.05); break;
      case 'cart': push(`block:wood:${q(w, 0.5)}:${q(dd, 0.5)}:${q(Math.min(h, 3), 0.5)}`, yaw, 1, gy - 0.05); break;
      default:
        push(`block:${kind === 'well' ? 'stone' : 'wood'}:${q(w, 0.5)}:${q(dd, 0.5)}:${q(Math.min(h, 4), 0.5)}`, yaw, 1, gy - 0.1);
    }
  }

  // isinlanma kapilari ve tunel (sablona baglandikca)
  for (const g of plan.portals) {
    const lx = g.x - x0, lz = g.z - z0;
    if (lx < 0 || lx >= REGION_M || lz < 0 || lz >= REGION_M) continue;
    out.push({ m: `portal:${g.culture}`, x: lx, y: H(lx, lz) - 0.3, z: -lz, yaw: g.yaw, s: 1 });
  }
  // feribot iskeleleri (kiyidan iskele ucuna, guverte su seviyesinin 1.2 m ustunde)
  for (const f of plan.ferries) {
    for (const dk of [f.a, f.b]) {
      const lx = dk.sx - x0, lz = dk.sz - z0;
      if (lx < 0 || lx >= REGION_M || lz < 0 || lz >= REGION_M) continue;
      const L = Math.round(Math.hypot(dk.ex - dk.sx, dk.ez - dk.sz) + 2);
      out.push({ m: `pier:${L}`, x: lx, y: dk.wl + 1.2, z: -lz, yaw: Math.atan2(dk.ez - dk.sz, dk.ex - dk.sx), s: 1 });
    }
  }
  // hava gemisi iskeleleri (rampali; ust yuzey = gemi guvertesi)
  for (const A of plan.airships || []) {
    for (const dk of [A.a, A.b]) {
      const lx = dk.sx - x0, lz = dk.sz - z0;
      if (lx < 0 || lx >= REGION_M || lz < 0 || lz >= REGION_M) continue;
      out.push({ m: `airpier:${AIRPIER.ramp}:${AIRPIER.flat}:${AIRPIER.H}`, x: lx, y: dk.wl + 1.2, z: -lz, yaw: Math.atan2(dk.uz, dk.ux), s: 1 });
    }
  }
  for (const it of tunnelItems(plan, rx, rz)) out.push(it);
  return out;
}

/**
 * Arazi yapilarin ustune cikmasin: 16 m'lik sablon araziyi merdiven/teras/avlu gibi yapilarin
 * icinden gecirebilir. Siluet izgarasi olan her yapinin tabaninda arazi koseleri yapinin ust
 * yuzeyinin (kemer altinda tavaninin) biraz altina indirilir. heights: 0.1 m birim, yerinde.
 */
export function clampUnderStructures(plan, rx, rz, heights) {
  const MS = plan.massing && plan.massing.models;
  if (!MS) return;
  const x0 = rx * REGION_M, z0 = rz * REGION_M, x1 = x0 + REGION_M, z1 = z0 + REGION_M;
  const K = plan.objKinds, Mo = plan.objModels;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (const [mi, X, Z, Y, yaw] of plan.objectsIn(rx + dx, rz + dz)) {
        const M = MS[mi];
        if (!M) continue;
        const m = Mo[mi];
        const kind = refine(K[m[0]], m[8], m[5] - m[2], m[7] - m[4], m[6] - Math.max(m[3], -2));
        if (kind === 'skip' || VEG.has(kind)) continue;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const R = Math.hypot(Math.max(Math.abs(M.x0), Math.abs(M.x0 + M.nx * M.res)), Math.max(Math.abs(M.z0), Math.abs(M.z0 + M.nz * M.res)));
        if (X + R < x0 || X - R > x1 || Z + R < z0 || Z - R > z1) continue;
        const j0 = Math.max(0, Math.floor((X - R - x0) / 2)), j1 = Math.min(VERTS - 1, Math.ceil((X + R - x0) / 2));
        const i0 = Math.max(0, Math.floor((Z - R - z0) / 2)), i1 = Math.min(VERTS - 1, Math.ceil((Z + R - z0) / 2));
        for (let i = i0; i <= i1; i++) {
          for (let j = j0; j <= j1; j++) {
            // dunya (plan) -> Three farki -> model yerel (yaw tersine)
            const tx = x0 + j * 2 - X, tz = -(z0 + i * 2 - Z);
            const lx = c * tx - s * tz, lz = s * tx + c * tz;
            const ci = Math.floor((lx - M.x0) / M.res), cj = Math.floor((lz - M.z0) / M.res);
            if (ci < 0 || cj < 0 || ci >= M.nx || cj >= M.nz) continue;
            const k = cj * M.nx + ci;
            if (M.top[k] === -32768) continue;
            const top = M.top[k] / 10, low = M.low[k] === 32767 ? null : M.low[k] / 10;
            const lid = low !== null && low > 2.6 && low < top - 0.3 ? low : top;
            const cap = (Y + lid - 0.12) * 10;
            const v = i * VERTS + j;
            if (heights[v] > cap) heights[v] = cap;
          }
        }
      }
    }
  }
}

function cityCulture(plan, X, Z) {
  let best = null, bd = Infinity;
  for (const c of plan.cities) { const dd = Math.hypot(X - c.x, Z - c.z); if (dd < bd) { bd = dd; best = c; } }
  return best ? best.culture : 'desert';
}
