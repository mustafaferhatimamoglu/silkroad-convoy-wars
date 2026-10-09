import { DOCKS, FERRY_ROUTES, AIR_ROUTES } from './features.js';
import { REGION_M } from './blueprint.js';

// Ulasim noktalarinin sablona yerlesimi: feribot iskeleleri (orijinal bilet NPC'sinin yanindaki
// kiyidan en yakin derin suya), gemi rotasi (16 m izgarada su uzerinden A*, kiyidan uzak durur,
// sonra duzlestirilip yumusatilir), Roc hava gemisi rampali iskeleleri (istasyon meydani duzlenir)
// ve sehir isinlanma kapilari (dogus noktasinin yakininda yapisiz, duz bir yer).
// Cikti plan.ferries / plan.airships / plan.portals / plan.pads (Transport, place, BigMap okur).

export const AIRPIER = { ramp: 16, flat: 10, H: 3.5 };   // rampa boyu, duz kisim, yukseklik (m)
const MOOR = 13.6;                                       // iskele ucundan gemi merkezine (Transport ile ayni)

const clampI = (v, a, b) => Math.max(a, Math.min(b, v));

function cell(plan, X, Z) { return [clampI(Math.round((X - plan.X0 - 8) / 16), 0, plan.hw - 1), clampI(Math.round((Z - plan.Z0 - 8) / 16), 0, plan.hh - 1)]; }
function cellPos(plan, cx, cz) { return [plan.X0 + 8 + cx * 16, plan.Z0 + 8 + cz * 16]; }

/** 16 m hucresi gemi icin yeterince derin su mu. */
function wet(plan, cx, cz) {
  if (cx < 0 || cz < 0 || cx >= plan.hw || cz >= plan.hh) return false;
  const [X, Z] = cellPos(plan, cx, cz);
  const lv = plan.waterLevel(X, Z);
  return lv !== null && plan.H[cz * plan.hw + cx] < lv - 0.8;
}

/** Iskele: kapi noktasindan en yakin derin suya (karsi kiyi yonune hafif oncelik). */
export function ferryDock(plan, p, other) {
  const s = {};
  const [pcx, pcz] = cell(plan, p.x, p.z);
  const ox = other.x - p.x, oz = other.z - p.z, oL = Math.hypot(ox, oz) || 1;
  let best = null, bs = Infinity;
  for (let dz = -20; dz <= 20; dz++) {
    for (let dx = -20; dx <= 20; dx++) {
      if (!wet(plan, pcx + dx, pcz + dz)) continue;
      const [X, Z] = cellPos(plan, pcx + dx, pcz + dz);
      const d = Math.hypot(X - p.x, Z - p.z);
      if (d < 8 || d > 320) continue;
      const cosA = ((X - p.x) * ox + (Z - p.z) * oz) / (d * oL);
      const score = d * (1.6 - cosA * 0.6);
      if (score < bs) { bs = score; best = [X, Z]; }
    }
  }
  if (!best) return null;
  const L = Math.hypot(best[0] - p.x, best[1] - p.z), ux = (best[0] - p.x) / L, uz = (best[1] - p.z) / L;
  let dry = 0;
  for (let t = 0; t < L + 80; t += 2) {
    const X = p.x + ux * t, Z = p.z + uz * t;
    const lv = plan.waterLevel(X, Z);
    plan.sample(X, Z, s);
    if (lv !== null && s.h < lv - 1.2) {
      const back = Math.max(0, dry - 6);
      const sx = p.x + ux * back, sz = p.z + uz * back;
      // iskele ucu: ilk derin noktadan 10 m acik (gemi derin suda baglanir)
      return { x0: p.x, z0: p.z, sx, sz, ex: X + ux * 10, ez: Z + uz * 10, wl: lv, ux, uz };
    }
    dry = t;
  }
  return null;
}

/** Su uzerinden A* (8 komsu); kiyiya yakin hucreler pahali. Donus: hucre listesi ya da null. */
export function waterPath(plan, a, b) {
  const [ax, az] = cell(plan, a[0], a[1]), [bx, bz] = cell(plan, b[0], b[1]);
  const M = 260;
  const x0 = Math.max(0, Math.min(ax, bx) - M), x1 = Math.min(plan.hw - 1, Math.max(ax, bx) + M);
  const z0 = Math.max(0, Math.min(az, bz) - M), z1 = Math.min(plan.hh - 1, Math.max(az, bz) + M);
  const W = x1 - x0 + 1, Hh = z1 - z0 + 1;
  const idx = (x, z) => (z - z0) * W + (x - x0);
  const g = new Float32Array(W * Hh).fill(Infinity);
  const from = new Int32Array(W * Hh).fill(-1);
  const closed = new Uint8Array(W * Hh);
  const wetC = new Int8Array(W * Hh).fill(-1);
  const isWet = (x, z) => { const k = idx(x, z); if (wetC[k] < 0) wetC[k] = wet(plan, x, z) ? 1 : 0; return wetC[k] === 1; };
  const near = (x, z) => {
    let n = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, zz = z + dz;
      if (xx < x0 || zz < z0 || xx > x1 || zz > z1 || !isWet(xx, zz)) n++;
    }
    return n;
  };
  // ikili yigin
  const heap = [], hf = [];
  const push = (k, f) => {
    heap.push(k); hf.push(f);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0];
    const lk = heap.pop(), lf = hf.pop();
    if (heap.length) {
      heap[0] = lk; hf[0] = lf;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && hf[l] < hf[m]) m = l;
        if (r < heap.length && hf[r] < hf[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m;
      }
    }
    return top;
  };
  const hdist = (x, z) => Math.hypot(x - bx, z - bz);
  const s0 = idx(ax, az);
  g[s0] = 0;
  push(s0, hdist(ax, az));
  const goal = idx(bx, bz);
  let steps = 0;
  while (heap.length && steps++ < 2500000) {
    const k = pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === goal) break;
    const x = (k % W) + x0, z = ((k / W) | 0) + z0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const xx = x + dx, zz = z + dz;
      if (xx < x0 || zz < z0 || xx > x1 || zz > z1) continue;
      const kk = idx(xx, zz);
      // hedefin 3 hucre cevresi her zaman gecilir (iskele ucu sig olabilir)
      const nearGoal = Math.abs(xx - bx) <= 3 && Math.abs(zz - bz) <= 3;
      if (!nearGoal && !isWet(xx, zz)) continue;
      const c = (dx && dz ? 1.414 : 1) * (1 + near(xx, zz) * 0.08);
      const ng = g[k] + c;
      if (ng < g[kk]) { g[kk] = ng; from[kk] = k; push(kk, ng + hdist(xx, zz)); }
    }
  }
  if (!Number.isFinite(g[goal])) return null;
  const out = [];
  for (let k = goal; k >= 0; k = from[k]) out.push([(k % W) + x0, ((k / W) | 0) + z0]);
  return out.reverse();
}

/** Iki nokta arasi duz cizgi su uzerinde mi (8 m adim). */
function clearLine(plan, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let t = 8; t < L - 8; t += 8) {
    const X = a[0] + (b[0] - a[0]) * t / L, Z = a[1] + (b[1] - a[1]) * t / L;
    const [cx, cz] = cell(plan, X, Z);
    if (!wet(plan, cx, cz)) return false;
  }
  return true;
}

/** Rota: A* hucreleri -> gorus hattiyla seyreltme -> Catmull-Rom (~20 m) + su seviyesi. */
function shipRoute(plan, a, b) {
  let pts;
  if (clearLine(plan, a, b)) pts = [a, b];
  else {
    const cells = waterPath(plan, a, b);
    if (!cells) return null;
    const P = [a, ...cells.slice(1, -1).map(([cx, cz]) => cellPos(plan, cx, cz)), b];
    pts = [P[0]];
    let i = 0;
    while (i < P.length - 1) {
      let j = P.length - 1;
      while (j > i + 1 && !clearLine(plan, P[i], P[j])) j--;
      pts.push(P[j]);
      i = j;
    }
  }
  // yumusatma
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 20));
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      const f = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      dense.push([f(0), f(1)]);
    }
  }
  dense.push(pts[pts.length - 1]);
  // su seviyesi (yumusak): seviyesi olmayan noktada son bilinen
  let last = plan.waterLevel(a[0], a[1]) ?? 0;
  const lv = dense.map(([X, Z]) => { const v = plan.waterLevel(X, Z); if (v !== null) last = v; return last; });
  const sm = lv.map((_, i) => { let s = 0, n = 0; for (let k = Math.max(0, i - 6); k <= Math.min(lv.length - 1, i + 6); k++) { s += lv[k]; n++; } return s / n; });
  sm[0] = lv[0]; sm[sm.length - 1] = lv[lv.length - 1];
  let L = 0;
  const out = dense.map(([X, Z], i) => { if (i) L += Math.hypot(X - dense[i - 1][0], Z - dense[i - 1][1]); return [X, Z, sm[i], L]; });
  return { pts: out, length: L };
}

/** Kararmali hat: A iskelesinden 200 m aciga, (atlama) B'nin 200 m acigindan iskeleye. */
function openSea(a, b, ma, mb) {
  const P = [[ma[0], ma[1], a.wl], [ma[0] + a.ux * 200, ma[1] + a.uz * 200, a.wl], [mb[0] + b.ux * 200, mb[1] + b.uz * 200, b.wl], [mb[0], mb[1], b.wl]];
  let L = 0;
  const pts = P.map((p, i) => { if (i) L += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]); return [p[0], p[1], p[2], L]; });
  return { pts, length: L };
}

/** Roc iskelesi: kapidan karsi uca dogru rampali yuksek iskele; taban kapi yuksekligi. */
function airDock(plan, p, q) {
  const s = {};
  const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  plan.sample(p.x, p.z, s);
  const base = s.h, off = 6;
  const sx = p.x + ux * off, sz = p.z + uz * off;
  const len = AIRPIER.ramp + AIRPIER.flat;
  return { x0: p.x, z0: p.z, sx, sz, ex: sx + ux * len, ez: sz + uz * len, wl: base + AIRPIER.H - 1.2, ux, uz, base, air: true };
}

/** Yapi siluetinin (x,z)'deki ust yuksekligi (yerden, m) ya da 0. */
function structureAt(plan, X, Z, rad = 0) {
  const MS = plan.massing && plan.massing.models;
  if (!MS) return 0;
  const rx = Math.floor(X / REGION_M), rz = Math.floor(Z / REGION_M);
  let top = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    for (const [mi, OX, OZ, , yaw] of plan.objectsIn(rx + dx, rz + dz)) {
      const M = MS[mi];
      if (!M) continue;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      for (const [ax, az] of rad ? [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]] : [[0, 0]]) {
        const tx = X + ax - OX, tz = -(Z + az - OZ);
        const lx = c * tx - s * tz, lz = s * tx + c * tz;
        const ci = Math.floor((lx - M.x0) / M.res), cj = Math.floor((lz - M.z0) / M.res);
        if (ci < 0 || cj < 0 || ci >= M.nx || cj >= M.nz) continue;
        const v = M.top[cj * M.nx + ci];
        if (v !== -32768) top = Math.max(top, v / 10);
      }
    }
  }
  return top;
}

/** Sehir kapisi: dogus noktasi cevresinde (12..80 m) yapisiz, duz, kuru ilk yer. */
function portalSpot(plan, c) {
  const s = {};
  for (let r = 14; r <= 90; r += 8) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const X = c.x + Math.cos(a) * r, Z = c.z + Math.sin(a) * r;
      if (plan.waterLevel(X, Z) !== null && plan.sample(X, Z, s).h < plan.waterLevel(X, Z) + 0.5) continue;
      if (structureAt(plan, X, Z, 7) > 0.8) continue;
      const hs = [[0, 0], [6, 0], [-6, 0], [0, 7], [0, -7]].map(([dx, dz]) => plan.sample(X + dx, Z + dz, s).h);
      if (Math.max(...hs) - Math.min(...hs) > 1.2) continue;
      return { x: X, z: Z };
    }
  }
  return { x: c.x + 12, z: c.z };
}

export function setupTransport(plan) {
  plan.pads = [];
  plan.ferries = [];
  for (const R of FERRY_ROUTES) {
    const A = DOCKS[R.a], B = DOCKS[R.b];
    const a = ferryDock(plan, A, B), b = ferryDock(plan, B, A);
    if (!a || !b) { console.warn('[ulasim] iskele bulunamadi', R.id); continue; }
    const ma = [a.ex + a.ux * MOOR, a.ez + a.uz * MOOR], mb = [b.ex + b.ux * MOOR, b.ez + b.uz * MOOR];
    // seviyeleri farkli denizler kum setiyle ayrik: rota yalniz iki acik (kararmada gecilir)
    const route = Math.abs(a.wl - b.wl) > 1 ? null : shipRoute(plan, ma, mb);
    const fade = !route || route.length > 1500;
    const R2 = route || openSea(a, b, ma, mb);
    const time = fade ? 34 : Math.max(24, Math.min(90, 16 + R2.length / 11));
    plan.ferries.push({ id: R.id, name: R.name, a, b, path: R2.pts, length: R2.length, time, fade });
  }
  plan.airships = AIR_ROUTES.map((R) => {
    const A = DOCKS[R.a], B = DOCKS[R.b];
    const a = airDock(plan, A, B), b = airDock(plan, B, A);
    const L = Math.hypot(B.x - A.x, B.z - A.z);
    return { id: R.id, name: R.name, labels: R.labels, a, b, time: Math.max(40, Math.min(110, 20 + L / 40)) };
  });
  // istasyon meydanlari: iskele boyunca duzlenir (kapi yuksekligi)
  for (const A of plan.airships) {
    for (const d of [A.a, A.b]) {
      const len = AIRPIER.ramp + AIRPIER.flat;
      plan.pads.push({ x: d.x0 + d.ux * (len / 2 + 6), z: d.z0 + d.uz * (len / 2 + 6), r: len / 2 + 10, h: d.base });
    }
  }
  plan.portals = plan.cities.map((c) => {
    const p = portalSpot(plan, c);
    return { city: c.id, name: c.name, culture: c.culture, x: p.x, z: p.z, yaw: 0 };
  });
}
