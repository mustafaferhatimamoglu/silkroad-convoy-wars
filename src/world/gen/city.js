import { mulberry } from './noise.js';

// Sehir yerlesimi (dunya koordinatlarinda, metre): sur parcalari, kuleler, kapilar (yollarin girdigi
// yerlerde), meydan + simge yapi, meydandan kapilara caddeler ve aralarda evler.
// Kapilar arac gecebilecek genislikte (16 m) ve aciktir: kale icine girilebilir.

const TAU = Math.PI * 2;

/** Yollarin sehre girdigi acilar (sur cizgisini kestigi yerler). */
function gateAngles(plan, c) {
  const out = [];
  for (const r of plan.roads) {
    for (const end of [r.dense[0], r.dense[r.dense.length - 1]]) {
      const d = Math.hypot(end[0] - c.x, end[1] - c.z);
      if (d < c.r + 60 && d > c.r * 0.4) out.push(Math.atan2(end[1] - c.z, end[0] - c.x));
    }
  }
  // en az iki kapi (dogu-bati)
  if (out.length < 2) for (const a of [0, Math.PI]) if (!out.some((b) => Math.abs(angDiff(a, b)) < 0.5)) out.push(a);
  // birbirine cok yakin kapilari birlestir
  out.sort((a, b) => a - b);
  return out.filter((a, i) => i === 0 || Math.abs(angDiff(a, out[i - 1])) > 0.3);
}

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const CACHE = new Map();

/**
 * items: [{ m: model anahtari, x, z (dunya), yaw }], y sonradan araziden.
 * yaw: Three.js Y donusu; modelin +X ekseni dunyada (dogudan kuzeye dogru) yaw acisina bakar.
 */
export function cityLayout(plan, c) {
  if (CACHE.has(c.id)) return CACHE.get(c.id);
  const rnd = mulberry(Math.floor(c.x * 7 + c.z * 13));
  const items = [];
  const gates = gateAngles(plan, c);
  const R = c.r - 4;
  // sur: cokgen, kapi acikliklarinda bosluk
  const nSeg = Math.max(16, Math.round((TAU * R) / 34));
  const gateHalf = 13 / R;                                    // kapi + burclar
  for (let k = 0; k < nSeg; k++) {
    const a0 = (k / nSeg) * TAU, a1 = ((k + 1) / nSeg) * TAU;
    const x0 = c.x + Math.cos(a0) * R, z0 = c.z + Math.sin(a0) * R;
    const x1 = c.x + Math.cos(a1) * R, z1 = c.z + Math.sin(a1) * R;
    const mid = (a0 + a1) / 2;
    const L = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(z1 - z0, x1 - x0);   // modelin +X ekseni dunyada bu aciya (doguya gore, kuzeye dogru)
    const g = gates.find((ga) => Math.abs(angDiff(ga, mid)) < (L / R) / 2 + gateHalf);
    if (g === undefined) items.push({ m: `wall:${c.culture}:${Math.round(L + 1)}`, x: (x0 + x1) / 2, z: (z0 + z1) / 2, yaw });
    // kule her ikinci kosede (kapi yakininda degil)
    if (k % 2 === 0 && !gates.some((ga) => Math.abs(angDiff(ga, a0)) < gateHalf * 1.6)) items.push({ m: `tower:${c.culture}`, x: x0, z: z0, yaw: 0 });
  }
  for (const ga of gates) {
    items.push({ m: `gate:${c.culture}`, x: c.x + Math.cos(ga) * R, z: c.z + Math.sin(ga) * R, yaw: ga + Math.PI / 2, gate: true });
  }
  // meydan simgesi
  items.push({ m: `landmark:${c.culture}`, x: c.x, z: c.z, yaw: c.heading || 0, landmark: true });
  // caddeler: meydandan kapilara (genislik 16 m) + ic halka (0.62 R, 12 m)
  const streets = gates.map((ga) => ({ ax: c.x + Math.cos(ga) * c.r * 0.22, az: c.z + Math.sin(ga) * c.r * 0.22, bx: c.x + Math.cos(ga) * R, bz: c.z + Math.sin(ga) * R, w: 10 }));
  const ringR = c.r * 0.62;
  const onStreet = (x, z, pad) => {
    const d = Math.hypot(x - c.x, z - c.z);
    if (Math.abs(d - ringR) < 7 + pad) return true;
    for (const s of streets) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, L = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L));
      if (Math.hypot(s.ax + dx * t - x, s.az + dz * t - z) < s.w + pad) return true;
    }
    return false;
  };
  // evler: meydan disi, sur ici, caddeler disinda; merkeze bakar
  const houses = [];
  const plaza = c.r * 0.3;
  for (let tries = 0; tries < 900 && houses.length < 140; tries++) {
    const a = rnd() * TAU, d = plaza + 10 + rnd() * (R - plaza - 24);
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    const w = 7 + Math.floor(rnd() * 8), dd = 7 + Math.floor(rnd() * 6);
    const rad = Math.hypot(w, dd) / 2;
    if (onStreet(x, z, rad)) continue;
    if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < h.rad + rad + 2.5)) continue;
    const floors = 1 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.1 ? 1 : 0);
    const yaw = Math.atan2(c.z - z, c.x - x) + Math.PI / 2;   // on cephe (+Z) merkeze bakar
    houses.push({ x, z, rad });
    items.push({ m: `house:${c.culture}:${Math.floor(rnd() * 4)}:${w}:${dd}:${floors}`, x, z, yaw });
  }
  const out = { items, gates, streets, ringR };
  CACHE.set(c.id, out);
  return out;
}
