import { Simplex, clamp, lerp, smoothstep } from './noise.js';

// V5 dunya plani: elle tasarlanmis yer sekilleri (sehirler, yollar, nehirler, deniz, daglar) +
// tohumlu gurultu. Tum olculer metre; X dogu, Z kuzey (Three.js'te z = -Z). Saf JS.
//
//  Batidan doguya: okyanus | Avrupa yakasi | bogaz | Konstantiniyye - Semerkant | sıradağ (gecit,
//  tunel; kuzeyde Roc Dagi) | Hotan - Donwhang | buyuk nehir (feribot) | Jangan | dogu daglari.
//  Guney-batida ic deniz; karsi kiyida Iskenderiye (gemiyle).

export const REGION_M = 192;
export const WORLD = { rx: 80, rz: 40, w: 80 * REGION_M, h: 40 * REGION_M };
export const SEA_LEVEL = 0;

// kultur: china | desert | persian | byzantine | egypt
export const CITIES = [
  { id: 'jangan', name: 'Jangan', x: 13800, z: 3900, r: 260, culture: 'china', heading: Math.PI / 2 },
  { id: 'donwhang', name: 'Donwhang', x: 10600, z: 4200, r: 200, culture: 'china', heading: Math.PI / 2 },
  { id: 'hotan', name: 'Hotan', x: 8000, z: 3500, r: 240, culture: 'desert', heading: Math.PI / 2 },
  { id: 'samarkand', name: 'Semerkant', x: 4600, z: 3900, r: 230, culture: 'persian', heading: Math.PI / 2 },
  { id: 'constantinople', name: 'Konstantiniyye', x: 1900, z: 4600, r: 260, culture: 'byzantine', heading: -Math.PI / 2 },
  { id: 'alexandria', name: 'İskenderiye', x: 2600, z: 640, r: 230, culture: 'egypt', heading: 0 },
];

// yollar: kontrol noktalari (Catmull-Rom ile yumusatilir). kind: paved | dirt. tunnel: [a, b] nokta araligi
export const ROADS = [
  { id: 'silk-east', kind: 'paved', width: 10, pts: [[13540, 3900], [13100, 3920], [12600, 3950], [12160, 3950]] },
  { id: 'silk-donwhang', kind: 'paved', width: 10, pts: [[11980, 3950], [11500, 4050], [11050, 4170], [10800, 4200]] },
  { id: 'silk-hotan', kind: 'paved', width: 10, pts: [[10400, 4200], [9900, 4060], [9300, 3800], [8700, 3600], [8240, 3500]] },
  // Hotan - Semerkant: acik dag gecidi (virajli)
  { id: 'pass', kind: 'paved', width: 9, pts: [[7760, 3500], [7300, 3550], [7060, 3570], [6820, 3430], [6700, 3420], [6660, 3520], [6820, 3640], [6760, 3720], [6600, 3700], [6420, 3700], [6200, 3780], [5950, 3760], [5500, 3850], [4830, 3900]] },
  // Hotan - Semerkant: tunel (dogrudan)
  { id: 'tunnel', kind: 'paved', width: 9, tunnel: [3, 4], pts: [[7300, 3550], [7120, 3420], [6980, 3330], [6820, 3320], [5980, 3330], [5800, 3420], [5650, 3600], [5500, 3850]] },
  { id: 'silk-west', kind: 'paved', width: 10, pts: [[4370, 3900], [3900, 4050], [3300, 4300], [2700, 4500], [2160, 4600]] },
  { id: 'port', kind: 'paved', width: 9, pts: [[1900, 4340], [1980, 3800], [2150, 3200], [2300, 2560]] },
  { id: 'alex-port', kind: 'paved', width: 9, pts: [[2700, 1120], [2650, 980], [2600, 870]] },
  { id: 'roc', kind: 'dirt', width: 7, pts: [[8000, 3740], [7850, 4300], [7400, 4950], [7050, 5550], [6900, 5800]] },
  { id: 'strait-west', kind: 'dirt', width: 7, pts: [[1120, 4700], [900, 5200], [700, 5900], [800, 6600]] },
  { id: 'strait-east', kind: 'paved', width: 9, pts: [[1640, 4620], [1560, 4670], [1480, 4700]] },
];

// feribotlar: iki kiyidaki iskele (yolun bittigi yer -> suya dogru), sure (sn). Iskele ucunda durup
// G ile binilir; arac guverteyle karsiya gecer.
// a/b: karadaki yaklasik baslangic (yol ucu); kiyi ve iskele ucu plan kurulurken bulunur.
export const FERRIES = [
  { id: 'huang', name: 'Büyük Nehir Feribotu', a: { x: 12160, z: 3950 }, b: { x: 11980, z: 3950 }, time: 26 },
  { id: 'strait', name: 'Boğaz Feribotu', a: { x: 1480, z: 4700 }, b: { x: 1120, z: 4700 }, time: 32 },
  { id: 'sea', name: 'İskenderiye Gemisi', a: { x: 2300, z: 2560 }, b: { x: 2700, z: 1120 }, time: 55 },
];

// nehirler: kaynaktan agiza. width: yatak genisligi, depth: kiyiya gore su derinligi
export const RIVERS = [
  { id: 'huang', width: 110, depth: 4, pts: [[12100, 7700], [11950, 6500], [12200, 5200], [12050, 3950], [12250, 2600], [12000, 1200], [12150, -50]] },
  { id: 'zeravshan', width: 46, depth: 2.5, pts: [[6000, 3000], [5600, 3250], [5000, 3420], [4500, 3480], [4100, 3100], [3900, 2420]] },
  { id: 'nile', width: 70, depth: 3, pts: [[3400, -50], [3250, 300], [3050, 700], [2950, 1100]] },
];

export const LAKES = [
  { id: 'hotan-oasis', x: 8260, z: 3290, r: 95 },
  { id: 'crescent', x: 10420, z: 4530, r: 62 },
  { id: 'jangan-lake', x: 14320, z: 4560, r: 150 },
];

// daglar: sirt cizgisi, yukseklik, yari genislik
const RANGES = [
  { pts: [[6300, -100], [6220, 1600], [6450, 3000], [6380, 3700], [6300, 4500], [6500, 6000], [6350, 7800]], h: 430, w: 1150 },
  { pts: [[5600, 600], [5750, 1900], [5500, 2700]], h: 170, w: 520 },
  { pts: [[7200, 4700], [7500, 5600], [7350, 6900]], h: 190, w: 560 },
  { pts: [[-100, 7650], [4000, 7480], [8000, 7560], [12000, 7460], [15500, 7620]], h: 230, w: 520 },
  { pts: [[15250, -100], [15100, 3000], [15260, 7800]], h: 260, w: 480 },
  { pts: [[6700, 120], [10000, 260], [15400, 150]], h: 190, w: 420 },
];
const PEAKS = [{ x: 6450, z: 6250, h: 520, r: 700 }];   // Roc Dagi
// gecit vadileri: dag yuksekligi bu cizgiler boyunca azalir (yol dogal bir vadiden kivrilarak tirmanir)
const VALLEYS = [
  { pts: [[7500, 3540], [7060, 3570], [6820, 3430], [6660, 3520], [6760, 3720], [6420, 3700], [6200, 3780], [5700, 3820]], k: 0.84, r0: 90, r1: 560 },
  { pts: [[7900, 4100], [7400, 4950], [7050, 5550], [6900, 5800]], k: 0.7, r0: 60, r1: 420 },
];

// deniz: bati okyanusu + guney-bati ic deniz + bogaz
const BASIN = { x: 3100, z: 1700, rx: 3300, rz: 690 };
const STRAIT = [[1350, 7800], [1300, 5200], [1380, 3300], [1250, 2150]];
const STRAIT_W = 210;

// kultur bolgeleri: [x0, x1] arasi biyom agirliklari (gurultuyle karisir)
// sand: kum colu, steppe: kuru bozkir, grass: yesil, forest: orman, mesa: kizil kaya
const BIOMES = [
  { x: 0, sand: 0, steppe: 0.2, grass: 0.7, forest: 0.6, mesa: 0 },
  { x: 3000, sand: 0, steppe: 0.4, grass: 0.6, forest: 0.25, mesa: 0 },
  { x: 5400, sand: 0.05, steppe: 0.6, grass: 0.4, forest: 0.15, mesa: 0 },
  { x: 7300, sand: 0.85, steppe: 0.2, grass: 0, forest: 0, mesa: 0 },
  { x: 9300, sand: 0.5, steppe: 0.5, grass: 0, forest: 0, mesa: 0.6 },
  { x: 11500, sand: 0.15, steppe: 0.6, grass: 0.2, forest: 0.05, mesa: 0.3 },
  { x: 12600, sand: 0, steppe: 0.15, grass: 0.85, forest: 0.4, mesa: 0 },
  { x: 15400, sand: 0, steppe: 0.2, grass: 0.8, forest: 0.6, mesa: 0 },
];

// ------------------------------------------------------------------ geometri yardimcilari

function catmull(pts, step = 4) {
  // kontrol noktalarindan yaklasik esit aralikli yogun nokta dizisi
  const out = [];
  const P = (i) => pts[clamp(i, 0, pts.length - 1)];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), i + t]);
    }
  }
  const last = pts[pts.length - 1];
  out.push([last[0], last[1], pts.length - 1]);
  return out;
}

function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L = dx * dx + dz * dz;
  const t = L > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / L, 0, 1) : 0;
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return { d: Math.sqrt(qx * qx + qz * qz), t };
}

function distPolyline(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = distSeg(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (r.d < best) best = r.d;
  }
  return best;
}

/** Yogun cizgi + izgara dizini: (x,z) icin en yakin parca ve uzerindeki parametre. */
class Polyline {
  constructor(dense, reach) {
    this.p = dense;                        // [[x, z, u], ...]
    this.reach = reach;
    this.cum = new Float32Array(dense.length);
    for (let i = 1; i < dense.length; i++) this.cum[i] = this.cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    this.cell = 64;
    this.grid = new Map();
    for (let i = 0; i < dense.length - 1; i++) {
      const [ax, az] = dense[i], [bx, bz] = dense[i + 1];
      const x0 = Math.floor((Math.min(ax, bx) - reach) / this.cell), x1 = Math.floor((Math.max(ax, bx) + reach) / this.cell);
      const z0 = Math.floor((Math.min(az, bz) - reach) / this.cell), z1 = Math.floor((Math.max(az, bz) + reach) / this.cell);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
        const k = gx * 100003 + gz;
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, (a = []));
        a.push(i);
      }
    }
  }

  /** {d, i, t, s} ya da null (reach disi). */
  nearest(x, z) {
    const a = this.grid.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    if (!a) return null;
    let best = null;
    for (const i of a) {
      const r = distSeg(x, z, this.p[i][0], this.p[i][1], this.p[i + 1][0], this.p[i + 1][1]);
      if (!best || r.d < best.d) best = { d: r.d, i, t: r.t };
    }
    if (!best || best.d > this.reach) return null;
    best.s = this.cum[best.i] + (this.cum[best.i + 1] - this.cum[best.i]) * best.t;
    // cizginin ucunu gecen mesafe (yolun etkisi ucta soner)
    best.past = 0;
    const last = this.p.length - 2;
    if ((best.i === 0 && best.t === 0) || (best.i === last && best.t === 1)) {
      const k = best.i === 0 && best.t === 0 ? 0 : last + 1;
      const o = k === 0 ? 1 : last;
      const ax = this.p[k][0] - this.p[o][0], az = this.p[k][1] - this.p[o][1], L = Math.hypot(ax, az) || 1;
      best.past = Math.max(0, ((x - this.p[k][0]) * ax + (z - this.p[k][1]) * az) / L);
    }
    return best;
  }
}

// ------------------------------------------------------------------ plan

export class WorldPlan {
  constructor(seed = 20261007) {
    this.seed = seed;
    this.n = new Simplex(seed);
    this.n2 = new Simplex(seed + 1);
    this.n3 = new Simplex(seed + 2);
    this.cities = CITIES.map((c) => ({ ...c }));
    for (const c of this.cities) c.h = Math.max(8, this._natural(c.x, c.z, false));
    // isinlanma kapilari: meydanin dogu kenari, gecis dogu-bati (dogu caddesi hizasinda)
    this.portals = this.cities.map((c) => ({ city: c.id, name: c.name, culture: c.culture, x: c.x + c.r * 0.24, z: c.z, yaw: 0 }));
    // nehirler: yatak boyunca su seviyesi agiza dogru hic yukselmez
    this.rivers = RIVERS.map((r) => {
      const dense = catmull(r.pts, 6);
      const line = new Polyline(dense, r.width * 0.5 + 70);
      const lvl = new Float32Array(dense.length);
      for (let i = 0; i < dense.length; i++) lvl[i] = this._natural(dense[i][0], dense[i][1], true) - r.depth - 1.0;
      for (let i = 1; i < dense.length; i++) lvl[i] = Math.min(lvl[i], lvl[i - 1]);
      for (let i = 0; i < dense.length; i++) lvl[i] = Math.max(lvl[i], SEA_LEVEL);
      return { ...r, dense, line, lvl };
    });
    for (const l of LAKES) l.level = this._natural(l.x, l.z, true) - 2.5;
    // feribot iskeleleri: karadan karsi kiyiya dogru ilerle; ilk derin su noktasi iskele ucu, ondan
    // onceki kuru nokta kiyi (yol oraya kadar uzanir)
    this.ferries = FERRIES.map((f) => ({ ...f, a: this._dock(f.a, f.b), b: this._dock(f.b, f.a) }));
    const roadDefs = ROADS.map((r) => {
      const pts = r.pts.map((p) => p.slice());
      for (const f of this.ferries) for (const d of [f.a, f.b]) {
        for (const k of [0, pts.length - 1]) if (Math.hypot(pts[k][0] - d.x0, pts[k][1] - d.z0) < 2) pts[k] = [d.sx, d.sz];
      }
      return { ...r, pts };
    });
    // yollar: dogal yukseklik boyunca, %9 egim sinirli ve yumusatilmis profil (yarma / dolgu)
    this.roads = roadDefs.map((r) => {
      const dense = catmull(r.pts, 4);
      const line = new Polyline(dense, r.width * 0.5 + 112);
      let h = Float32Array.from(dense, (p) => this._preRoad(p[0], p[1]));
      // tunel araligi: uclar arasinda dogrusal (dagin icinden)
      let ta = -1, tb = -1;
      if (r.tunnel) {
        ta = dense.findIndex((p) => p[2] >= r.tunnel[0]);
        tb = dense.findIndex((p) => p[2] >= r.tunnel[1]);
        for (let i = ta; i <= tb; i++) h[i] = lerp(h[ta], h[tb], (i - ta) / (tb - ta));
      }
      h = smooth(h, 8);
      // feribot iskelesine varan uc: su seviyesinin 1.2 m ustu (yaklasim rampasi egim sinirindan gelir)
      const pins = [];
      for (const f of this.ferries) for (const d of [f.a, f.b]) {
        for (const k of [0, dense.length - 1]) if (Math.hypot(dense[k][0] - d.sx, dense[k][1] - d.sz) < 2) { pins.push([k, d.wl + 1.2]); d.road = r.id; }
      }
      const pin = () => { for (const [k, v] of pins) h[k] = v; };
      const g = 0.09 * 4;
      for (let pass = 0; pass < 3; pass++) {
        pin();
        for (let i = 1; i < h.length; i++) h[i] = clamp(h[i], h[i - 1] - g, h[i - 1] + g);
        pin();
        for (let i = h.length - 2; i >= 0; i--) h[i] = clamp(h[i], h[i + 1] - g, h[i + 1] + g);
      }
      h = smooth(h, 3);
      pin();
      for (let i = h.length - 2; i >= 0; i--) h[i] = clamp(h[i], h[i + 1] - g, h[i + 1] + g);
      for (let i = 1; i < h.length; i++) h[i] = clamp(h[i], h[i - 1] - g, h[i - 1] + g);
      pin();
      return { ...r, dense, line, h, ta, tb };
    });
  }

  /** Iskele: p (kara) -> q yonunde kiyi (sx,sz,sh) ve iskele ucu (ex,ez); su seviyesi wl. */
  _dock(p, q) {
    const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    let dry = 0;
    for (let t = 0; t < L; t += 2) {
      const x = p.x + ux * t, z = p.z + uz * t;
      const wl = this.waterLevel(x, z);
      const h = this._riverCarve(x, z, this._natural(x, z, true));   // kirpilmamis (deniz tabani dahil)
      if (wl !== null && h < wl - 1.2) {
        const sx = p.x + ux * Math.max(0, dry - 6), sz = p.z + uz * Math.max(0, dry - 6);
        return { x0: p.x, z0: p.z, sx, sz, sh: Math.max(this._preRoad(sx, sz), wl + 0.6), ex: x + ux * 10, ez: z + uz * 10, wl, ux, uz };
      }
      dry = t;
    }
    return { x0: p.x, z0: p.z, sx: p.x, sz: p.z, sh: this._preRoad(p.x, p.z), ex: p.x + ux * 20, ez: p.z + uz * 20, wl: 0, ux, uz };
  }

  // ---------------------------------------------------------------- dogal arazi

  /** Biyom agirliklari (x boyunca kultur bolgeleri + gurultu + vaha/nehir yesili). */
  biome(x, z) {
    const jx = x + this.n2.fbm(x / 1400, z / 1400, 3) * 450;
    let i = 0;
    while (i < BIOMES.length - 2 && BIOMES[i + 1].x < jx) i++;
    const a = BIOMES[i], b = BIOMES[i + 1];
    const t = smoothstep(a.x, b.x, jx);
    const o = {};
    for (const k of ['sand', 'steppe', 'grass', 'forest', 'mesa']) o[k] = lerp(a[k], b[k], t);
    // Iskenderiye: kiyinin guneyi colllesir, Nil boyu yesil
    if (z < 1250 && x < 6200) { const k = smoothstep(1250, 900, z); o.sand = lerp(o.sand, 0.9, k); o.grass *= 1 - k; o.forest *= 1 - k; o.steppe = lerp(o.steppe, 0.2, k); }
    // vaha: goller, nehirler ve sehirler cevresi yesil
    let wet = 0;
    for (const l of LAKES) wet = Math.max(wet, 1 - smoothstep(l.r, l.r + 260, Math.hypot(x - l.x, z - l.z)));
    for (const r of this.rivers || []) { const q = r.line.nearest(x, z); if (q) wet = Math.max(wet, 1 - smoothstep(r.width * 0.5, r.width * 0.5 + 60, q.d)); }
    for (const c of this.cities || []) wet = Math.max(wet, (1 - smoothstep(c.r, c.r + 420, Math.hypot(x - c.x, z - c.z))) * 0.7);
    if (wet > 0) { o.grass = lerp(o.grass, 0.85, wet); o.sand *= 1 - wet; o.mesa *= 1 - wet; o.forest = lerp(o.forest, 0.35, wet * 0.6); }
    o.wet = wet;
    return o;
  }

  /** Denize uzaklik (pozitif = deniz icinde, metre). */
  seaDepth(x, z) {
    const wob = this.n3.fbm(x / 600, z / 600, 3) * 70;
    const ocean = 260 - x + wob;                                   // bati kiyisi
    const ex = (x - BASIN.x) / BASIN.rx, ez = (z - BASIN.z) / BASIN.rz;
    const coastWob = this.n3.fbm(x / 1700, z / 1700, 4) * 330;
    const basin = (1 - Math.sqrt(ex * ex + ez * ez)) * Math.min(BASIN.rx, BASIN.rz) + wob + coastWob;
    const strait = STRAIT_W / 2 - distPolyline(x, z, STRAIT) + wob * 0.4;
    return Math.max(ocean, basin, strait);
  }

  /** Yollar ve nehirler olmadan dogal yukseklik (m). withCities: sehir duzlukleri dahil. */
  _natural(x, z, withCities = true) {
    const n = this.n;
    const bio = this.biome(x, z);
    let h = 30 + n.fbm(x / 1600, z / 1600, 5) * 34 + n.fbm(x / 420, z / 420, 4) * 9 + n.fbm(x / 120, z / 120, 2) * 1.6;
    // kum tepeleri: ruzgar yonunde uzamis sirtlar
    if (bio.sand > 0.05) {
      const u = (x * 0.8 + z * 0.6) / 140, v = (-x * 0.6 + z * 0.8) / 520;
      const dune = this.n2.ridged(u + this.n3.noise(x / 700, z / 700) * 0.8, v, 3);
      h += dune * 14 * bio.sand * smoothstep(0.05, 0.5, bio.sand);
    }
    // kizil mesalar: basamakli yayla tepeleri (Donwhang)
    if (bio.mesa > 0.05) {
      const m = this.n3.fbm(x / 900, z / 900, 4) + this.n.noise(x / 160, z / 160) * 0.03;
      const step = smoothstep(0.30, 0.36, m) * 38 + smoothstep(0.48, 0.52, m) * 24;
      // yollarin cevresinde mesa yok (yol kayayi yarmasin)
      let nearRoad = Infinity;
      for (const r of ROADS) nearRoad = Math.min(nearRoad, distPolyline(x, z, r.pts));
      h += step * smoothstep(0.1, 0.5, bio.mesa) * smoothstep(120, 380, nearRoad);
    }
    // sira daglar
    for (const R of RANGES) {
      const d = distPolyline(x, z, R.pts);
      if (d > R.w) continue;
      const prof = Math.pow(1 - smoothstep(0, R.w, d), 1.5);
      let k = 1;
      for (const v of VALLEYS) k = Math.min(k, 1 - v.k * (1 - smoothstep(v.r0, v.r1, distPolyline(x, z, v.pts))));
      h += R.h * prof * (0.45 + 0.75 * this.n.ridged(x / 520, z / 520, 5)) * k;
    }
    for (const P of PEAKS) {
      const d = Math.hypot(x - P.x, z - P.z);
      if (d < P.r) h += P.h * Math.pow(1 - d / P.r, 1.8) * (0.7 + 0.4 * this.n2.ridged(x / 300, z / 300, 4));
    }
    // deniz: kiyida plaja iner
    const sd = this.seaDepth(x, z);
    if (sd > -160) {
      const coast = smoothstep(-160, 0, sd);
      h = lerp(h, 2.5 + Math.max(0, -sd) * 0.03, coast * 0.85);
      if (sd > 0) h = Math.min(h, 1.5 - Math.min(sd * 0.12, 22));
    }
    // goller
    for (const l of LAKES) {
      const d = Math.hypot(x - l.x, z - l.z);
      if (d < l.r + 80 && l.level !== undefined) h = lerp(h, l.level - 3 * (1 - d / (l.r + 80)), 1 - smoothstep(l.r - 10, l.r + 80, d));
    }
    if (withCities && this.cities) {
      for (const c of this.cities) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < c.r + 260) h = lerp(h, c.h, 1 - smoothstep(c.r + 30, c.r + 260, d));
      }
    }
    return h;
  }

  /** Yol profili icin dogal yukseklik (nehir oyulmus). */
  _preRoad(x, z) { return Math.max(this._riverCarve(x, z, this._natural(x, z, true)), 1.8); }

  _riverCarve(x, z, h) {
    for (const r of this.rivers) {
      const q = r.line.nearest(x, z);
      if (!q) continue;
      const lvl = lerp(r.lvl[q.i], r.lvl[q.i + 1], q.t);
      const half = r.width * 0.5;
      const bed = lvl - r.depth * (1 - smoothstep(half * 0.4, half, q.d));
      const bank = smoothstep(half, half + 60, q.d);
      h = Math.min(h, lerp(bed, Math.max(h, lvl + 0.5), bank));
    }
    return h;
  }

  /** Nihai arazi yuksekligi (m) + yol bilgisi. */
  sample(x, z, out = {}) {
    let h = this._riverCarve(x, z, this._natural(x, z, true));
    out.road = 0; out.roadKind = null; out.tunnel = false;
    for (const r of this.roads) {
      const q = r.line.nearest(x, z);
      if (!q) continue;
      const inTunnel = r.ta >= 0 && q.i >= r.ta && q.i < r.tb;
      const rh = lerp(r.h[q.i], r.h[q.i + 1], q.t);
      const half = r.width * 0.5;
      if (inTunnel) {
        // tunel: arazi degismez (dag yerinde); agiz kisminda yol yuzeyine iner
        if (q.d < half + 4 && h < rh + 2) out.tunnel = true;
        continue;
      }
      // sev genisligi yukseklik farkiyla buyur (yarma/dolgu ~35 derece): yol kenari dik kanyon olmaz
      const w = (1 - smoothstep(half, half + Math.min(14 + Math.abs(h - rh) * 1.5, 110), q.d)) * (1 - smoothstep(0, 10, q.past));
      if (w <= 0) continue;
      h = lerp(h, rh, w);
      const core = 1 - smoothstep(half - 1.5, half + 1.5, q.d);
      if (core > out.road) { out.road = core; out.roadKind = r.kind; }
    }
    out.h = h;
    return out;
  }

  /** Su seviyesi (deniz/nehir/gol) ya da null. */
  waterLevel(x, z) {
    let lvl = null;
    if (this.seaDepth(x, z) > -40) lvl = SEA_LEVEL;
    for (const r of this.rivers) {
      const q = r.line.nearest(x, z);
      if (q && q.d < r.width * 0.5 + 30) { const l = lerp(r.lvl[q.i], r.lvl[q.i + 1], q.t); lvl = lvl === null ? l : Math.max(lvl, l); }
    }
    for (const l of LAKES) if (Math.hypot(x - l.x, z - l.z) < l.r + 40) lvl = lvl === null ? l.level : Math.max(lvl, l.level);
    return lvl;
  }

  cityAt(x, z) {
    for (const c of this.cities) if (Math.hypot(x - c.x, z - c.z) < c.r) return c;
    return null;
  }
}

function smooth(a, r) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < a.length) { s += a[j]; n++; } }
    out[i] = s / n;
  }
  return out;
}
