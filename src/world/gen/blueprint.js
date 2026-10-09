import { Simplex, clamp, lerp, smoothstep } from './noise.js';

// Orijinal Silkroad haritasindan cikarilmis KABA sablonla dunya (tools/gen/blueprint.py):
// 16 m yukseklik, 8 m zemin sinifi, 32 m su ve nesne yerlesimi. Ayrinti (2 m arazi puruzu,
// dokular, modeller) burada ve oyunda bizim ureticilerimizle olusur. Koordinatlar orijinalle ayni:
// X dogu, Z kuzey (metre), bolge = 192 m, bolge (rx, rz) -> X = rx * 192.
// Sablonun bos (oyun alani disi) yerleri sinirdan yukselen gecilmez daglarla doldurulur.

export const REGION_M = 192;

const CLASS_DETAIL = {   // m: 2-8 m olcekli ayrinti puruzu (zemin sinifina gore)
  void: 3, sand: 0.55, dirt: 0.3, gravel: 0.35, grass: 0.28, steppe: 0.3, forest: 0.35, rock: 1.6, redrock: 1.8,
  snow: 0.7, mud: 0.15, paving: 0.0, cobble: 0.03, farmland: 0.12,
};

async function fetchGz(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  if (typeof DecompressionStream !== 'undefined') {
    const s = r.body.pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  throw new Error('DecompressionStream yok');
}

export class BlueprintPlan {
  /** base: 'content/' ; Node'da files: { name -> Uint8Array } ve meta verilebilir. */
  static async load(base = 'content/', node = null) {
    let meta, raw;
    if (node) { meta = node.meta; raw = node.files; }
    else {
      meta = await (await fetch(`${base}world/blueprint.json`)).json();
      const names = ['heights', 'ground', 'water', 'objects', 'massing', 'vegclusters', 'color'];
      const bufs = await Promise.all(names.map((n) => fetchGz(`${base}world/${n}.dat`)));
      raw = Object.fromEntries(names.map((n, i) => [n, bufs[i]]));
    }
    return new BlueprintPlan(meta, raw);
  }

  constructor(meta, raw) {
    this.meta = meta;
    this.seed = 20261008;
    this.n = new Simplex(this.seed);
    this.n2 = new Simplex(this.seed + 1);
    const M = meta;
    this.rx0 = M.rx0; this.rz0 = M.rz0; this.rx1 = M.rx1; this.rz1 = M.rz1;
    this.X0 = M.rx0 * REGION_M; this.Z0 = M.rz0 * REGION_M;
    this.classes = M.ground.classes;
    this.cls = Object.fromEntries(this.classes.map((c, i) => [c, i]));
    // yukseklik (dm int16) -> metre float; bos hucreler daga donusur
    const hw = (this.hw = M.heights.w), hh = (this.hh = M.heights.h);
    const hs = new Int16Array(raw.heights.buffer, raw.heights.byteOffset, hw * hh);
    this.ground = new Uint8Array(raw.ground.buffer, raw.ground.byteOffset, M.ground.w * M.ground.h);
    this.gw = M.ground.w; this.gh = M.ground.h;
    const ws = new Int16Array(raw.water.buffer, raw.water.byteOffset, M.water.w * M.water.h);
    this.water = ws; this.ww = M.water.w;
    this.H = new Float32Array(hw * hh);
    this.voidDist = new Uint8Array(hw * hh);     // bos hucrenin oyun alanina uzakligi (ornek), 0 = alan ici
    this._fillVoid(hs);
    this.regionHas = new Uint8Array((this.rx1 - this.rx0 + 1) * (this.rz1 - this.rz0 + 1));
    const per = REGION_M / M.heights.res;
    for (let rz = this.rz0; rz <= this.rz1; rz++) {
      for (let rx = this.rx0; rx <= this.rx1; rx++) {
        let near = false;
        for (let a = 0; a < per && !near; a++) for (let b = 0; b < per; b++) {
          const k = ((rz - this.rz0) * per + a) * hw + (rx - this.rx0) * per + b;
          if (this.voidDist[k] < 8) { near = true; break; }    // alan ya da 128 m icindeki dag
        }
        this.regionHas[(rz - this.rz0) * (this.rx1 - this.rx0 + 1) + (rx - this.rx0)] = near ? 1 : 0;
      }
    }
    // orijinal zeminin 16 m ortalama rengi (sRGB, bos hucre 0)
    this.color = raw.color && M.color ? new Uint8Array(raw.color.buffer, raw.color.byteOffset, M.color.w * M.color.h * 3) : null;
    // nesneler
    const obj = JSON.parse(new TextDecoder().decode(raw.objects));
    this.objKinds = obj.kinds;
    this.objModels = obj.models;
    this.objRegions = obj.regions;
    this.massing = raw.massing ? JSON.parse(new TextDecoder().decode(raw.massing)) : {};
    // bitki kumeleri: model -> [[x, z, boy, tac yaricapi]] (model yerel; tools/gen/vegclusters.mjs)
    this.veg = raw.vegclusters ? JSON.parse(new TextDecoder().decode(raw.vegclusters)) : {};
    // ozellikler (feribot, kapi, tunel...) sonradan baglanir
    this.cities = []; this.portals = []; this.ferries = []; this.airships = []; this.tunnels = []; this.pads = []; this.roads = [];
  }

  /** Bos hucreler: en yakin alan kenarinin yuksekliginden uzaklikla yukselen sirt. */
  _fillVoid(hs) {
    const w = this.hw, h = this.hh, H = this.H, D = this.voidDist, VOID = -32768;
    const base = new Float32Array(w * h);
    let q = [];
    for (let i = 0; i < w * h; i++) {
      if (hs[i] === VOID) { D[i] = 255; } else { D[i] = 0; H[i] = hs[i] * 0.1; base[i] = H[i]; q.push(i); }
    }
    // BFS: uzaklik (ornek) ve en yakin kenar yuksekligi (en fazla 60 ornek = 960 m)
    for (let d = 1; d < 60 && q.length; d++) {
      const nq = [];
      for (const i of q) {
        const x = i % w, z = (i / w) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, zz = z + dz;
          if (xx < 0 || zz < 0 || xx >= w || zz >= h) continue;
          const j = zz * w + xx;
          if (D[j] !== 255) continue;
          D[j] = d; base[j] = base[i]; nq.push(j);
        }
      }
      q = nq;
    }
    for (let i = 0; i < w * h; i++) {
      if (D[i] === 0) continue;
      const d = D[i] === 255 ? 60 : D[i];
      const x = i % w, z = (i / w) | 0;
      const X = this.X0 + x * 16, Z = this.Z0 + z * 16;
      // kenardan ~100 m icinde 90 m yukselen, sonra yavas tirmanan sirt + daglik gurultu
      const rise = 90 * smoothstep(0, 7, d) + d * 3.5;
      const rough = 0.6 + 0.7 * this.n.ridged(X / 420, Z / 420, 4);
      H[i] = base[i] + rise * rough;
    }
  }

  // ---------------------------------------------------------------- sorgular

  /** Bolge uretilir mi (oyun alani ya da cevresindeki dag kusagi). */
  hasRegion(rx, rz) {
    if (rx < this.rx0 || rx > this.rx1 || rz < this.rz0 || rz > this.rz1) return false;
    return this.regionHas[(rz - this.rz0) * (this.rx1 - this.rx0 + 1) + (rx - this.rx0)] === 1;
  }

  /** Sablon yuksekligi (Catmull-Rom, m) ve oyun alanina uzaklik. */
  templateH(X, Z) {
    const fx = (X - this.X0 - 8) / 16, fz = (Z - this.Z0 - 8) / 16;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const w = this.hw, h = this.hh, H = this.H;
    const at = (x, z) => H[clamp(z, 0, h - 1) * w + clamp(x, 0, w - 1)];
    const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
    const row = (z) => cr(at(ix - 1, z), at(ix, z), at(ix + 1, z), at(ix + 2, z), tx);
    return cr(row(iz - 1), row(iz), row(iz + 1), row(iz + 2), tz);
  }

  /** Orijinal 16 m hucre rengi [r,g,b] (sRGB) ya da null (bos/alan disi). cx, cz: kuresel hucre. */
  colorCell(cx, cz) {
    if (!this.color) return null;
    const x = cx - this.rx0 * 12, z = cz - this.rz0 * 12;
    if (x < 0 || z < 0 || x >= this.hw || z >= this.hh) return null;
    const k = (z * this.hw + x) * 3, C = this.color;
    if (C[k] + C[k + 1] + C[k + 2] === 0) return null;
    return [C[k], C[k + 1], C[k + 2]];
  }

  voidAt(X, Z) {
    const x = clamp(Math.round((X - this.X0 - 8) / 16), 0, this.hw - 1), z = clamp(Math.round((Z - this.Z0 - 8) / 16), 0, this.hh - 1);
    return this.voidDist[z * this.hw + x];
  }

  /** Zemin sinifi (8 m izgara, en yakin; jitter: kenar titresimi icin metre kaydirma). */
  groundAt(X, Z, jitter = 0) {
    let x = X, z = Z;
    if (jitter) { x += this.n2.noise(X / 11, Z / 11) * jitter; z += this.n2.noise(Z / 11 + 17, X / 11) * jitter; }
    const gx = Math.floor((x - this.X0) / 8), gz = Math.floor((z - this.Z0) / 8);
    if (gx < 0 || gz < 0 || gx >= this.gw || gz >= this.gh) return 0;
    return this.ground[gz * this.gw + gx];
  }

  /** Su seviyesi (m) ya da null: 32 m blok. */
  waterLevel(X, Z) {
    const bx = Math.floor((X - this.X0) / 32), bz = Math.floor((Z - this.Z0) / 32);
    if (bx < 0 || bz < 0 || bx >= this.ww || bz >= this.meta.water.h) return null;
    const v = this.water[bz * this.ww + bx];
    return v === -32768 ? null : v * 0.1;
  }

  /** Arazi yuksekligi + yol bilgisi (eski WorldPlan arayuzu). */
  sample(X, Z, out = {}) {
    let h = this.templateH(X, Z);
    const g = this.groundAt(X, Z, 3);
    const name = this.classes[g];
    // ayrinti: sinifa gore 2-8 m puruz; yamacta ve dagda kayalik sirtlar
    const amp = CLASS_DETAIL[name] ?? 0.3;
    if (amp > 0) {
      h += (this.n.fbm(X / 9, Z / 9, 3) * 0.7 + this.n2.noise(X / 3.1, Z / 3.1) * 0.3) * amp;
      if (name === 'rock' || name === 'redrock' || name === 'void' || name === 'snow') h += (this.n.ridged(X / 38, Z / 38, 3) - 0.35) * amp * 2.2;
      if (name === 'sand') {
        // kum dalgaciklari
        h += Math.sin((X * 0.8 + Z * 0.6) / 2.4 + this.n2.noise(X / 30, Z / 30) * 3) * 0.12;
      }
    }
    out.h = h;
    out.road = name === 'paving' || name === 'cobble' ? 1 : 0;
    out.roadKind = out.road ? 'paved' : null;
    out.tunnel = false; out.hole = false;
    out.ground = g;
    return out;
  }

  /** Biyom agirliklari (yerlesim/muzik icin uyumluluk): zemin sinifindan. */
  biome(X, Z) {
    const c = this.classes[this.groundAt(X, Z)];
    const o = { sand: 0, steppe: 0, grass: 0, forest: 0, mesa: 0, wet: 0 };
    if (c === 'sand') o.sand = 1;
    else if (c === 'steppe' || c === 'dirt' || c === 'gravel') o.steppe = 1;
    else if (c === 'grass' || c === 'farmland') o.grass = 1;
    else if (c === 'forest') { o.grass = 0.6; o.forest = 1; }
    else if (c === 'redrock') o.mesa = 1;
    if (this.waterLevel(X, Z) !== null) o.wet = 1;
    return o;
  }

  seaDepth() { return -1e3; }

  cityAt(X, Z) {
    for (const c of this.cities) if (Math.hypot(X - c.x, Z - c.z) < c.r) return c;
    return null;
  }

  tunnelFloor() { return null; }

  /** Bolgedeki sablon nesneleri: [model, X, Z, Y, yaw]. */
  objectsIn(rx, rz) { return this.objRegions[`${rx},${rz}`] || []; }
}

export { lerp };
