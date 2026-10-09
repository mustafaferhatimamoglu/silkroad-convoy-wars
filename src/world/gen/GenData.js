import { BlueprintPlan, REGION_M } from './blueprint.js';
import { CITIES } from './features.js';
import { Simplex, smoothstep } from './noise.js';
import { placeRegionObjects, clampUnderStructures } from './place.js';
import { setMassing } from './models.js';
import { setPbr, nrUrl } from './build.js';
import { tracksNear, trackDist, TRACK } from './tracks.js';

// V5 dunya verisi: motorun bekledigi bolge verilerini (yukseklik, zemin dokusu, su, renk haritasi,
// objeler) orijinal haritanin kaba sablonundan (content/world, tools/gen/blueprint.py) ve kendi
// ayrinti ureticimizden aninda uretir. Koordinatlar orijinal Silkroad bolgeleriyle ayni.
//  - Bolge: 192 m, 97x97 kose (2 m hucre), yukseklik birimi = 0.1 m (motor uyumu).
//  - Doku kelimesi: alt 10 bit katman kimligi (content/textures/terrain.json), ust 3 bit olcek ussu.

export const SCALE = 0.1;
const VERTS = 97, CELLS = 96;

export class GenWorldData {
  constructor(base = 'content/') {
    this.base = base;
    this.origin = { x: 0, z: 0 };
    this.cache = new Map();
  }

  async load() {
    const r = await fetch(this.base + 'textures/terrain.json');
    this.tiles = await r.json();
    this.tileByName = Object.fromEntries(this.tiles.map((t) => [t.name, t]));
    this.plan = await BlueprintPlan.load(this.base);
    try { setPbr(await (await fetch(this.base + 'textures/pbr.json')).json()); } catch { /* normalsiz */ }
    let avg = {};
    try { avg = await (await fetch(this.base + 'textures/avg.json')).json(); } catch { /* renk tonu olmadan */ }
    setMassing(this.plan.massing, avg);
    this.plan.cities = CITIES.map((c) => ({ ...c, h: this.plan.templateH(c.x, c.z) }));
    this.n = new Simplex(this.plan.seed + 7);
    this.regions = new Map();
    const P = this.plan;
    for (let rz = P.rz0; rz <= P.rz1; rz++) {
      for (let rx = P.rx0; rx <= P.rx1; rx++) {
        if (P.hasRegion(rx, rz)) this.regions.set(this.key(rx, rz), { key: this.key(rx, rz), x: rx, z: rz, objects: true, minH: 0, maxH: 400 });
      }
    }
    return this;
  }

  key(rx, rz) { return `${rz}_${rx}`; }
  has(rx, rz) { return this.regions.has(this.key(rx, rz)); }
  info(rx, rz) { return this.regions.get(this.key(rx, rz)); }

  regionOrigin(rx, rz, target = { x: 0, z: 0 }) {
    target.x = rx * REGION_M;
    target.z = -rz * REGION_M;
    return target;
  }

  toThree(rx, rz, lx, y, lz, target) {
    const x = (rx * 1920 + lx) * SCALE, z = -(rz * 1920 + lz) * SCALE;
    if (target) { target.x = x; target.y = y * SCALE; target.z = z; return target; }
    return { x, y: y * SCALE, z };
  }

  fromThree(x, z) {
    const wx = x / SCALE, wz = -z / SCALE;
    const rx = Math.floor(wx / 1920), rz = Math.floor(wz / 1920);
    return { rx, rz, lx: wx - rx * 1920, lz: wz - rz * 1920 };
  }

  /** Katman bilgisi: flags = yuzey malzemesi (surus/ses), color = ortalama renk. */
  tile(id) {
    const t = this.tiles[id];
    return t ? { flags: t.surface, color: t.color, name: t.name } : null;
  }
  tileUrl(id) { const t = this.tiles[id]; return t ? this.base + 'textures/' + t.file : null; }
  tileNormalUrl(id) { const t = this.tiles[id]; return t ? nrUrl('terrain/' + t.name, this.base) : null; }

  /** Bolge verisi (onbellekli): { heights, texture, waterType, waterHeight, colormap } */
  region(key) {
    let d = this.cache.get(key);
    if (d) return d;
    const info = this.regions.get(key);
    d = this._generate(info.x, info.z);
    info.minH = d.minH; info.maxH = d.maxH;
    this.cache.set(key, d);
    if (this.cache.size > 160) {
      for (const k of this.cache.keys()) { this.cache.delete(k); if (this.cache.size <= 120) break; }
    }
    return d;
  }

  /** Bolgenin objeleri: [{ m: model, v: cesit, x, y, z (bolge-yerel m), yaw, s: olcek }] */
  objects(key) {
    const info = this.regions.get(key);
    const d = this.region(key);
    if (!d.objects) d.objects = placeRegionObjects(this, info.x, info.z, d);
    return d.objects;
  }

  _generate(rx, rz) {
    const plan = this.plan;
    const x0 = rx * REGION_M, z0 = rz * REGION_M;
    const heights = new Float32Array(VERTS * VERTS);
    const roads = new Float32Array(VERTS * VERTS);
    const kinds = new Uint8Array(VERTS * VERTS);
    let holes = null;                          // tunel agzi: bu koselere degen ucgenler cizilmez
    const s = {};
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < VERTS; i++) {
      for (let j = 0; j < VERTS; j++) {
        plan.sample(x0 + j * 2, z0 + i * 2, s);
        const k = i * VERTS + j;
        heights[k] = s.h * 10;
        roads[k] = s.road;
        kinds[k] = s.roadKind === 'paved' ? 1 : s.roadKind === 'dirt' ? 2 : 0;
        if (s.hole) (holes || (holes = new Uint8Array(VERTS * VERTS)))[k] = 1;
        if (s.h < minH) minH = s.h;
        if (s.h > maxH) maxH = s.h;
      }
    }
    clampUnderStructures(plan, rx, rz, heights);
    minH = Infinity; maxH = -Infinity;
    for (let k = 0; k < heights.length; k++) { const h = heights[k] * 0.1; if (h < minH) minH = h; if (h > maxH) maxH = h; }
    // su: 6x6 blok (32 m), blok merkezindeki seviye; bloktaki bir kose altta kaliyorsa su var
    const waterType = new Uint8Array(36).fill(255);
    const waterHeight = new Float32Array(36);
    const wl = new Float32Array(VERTS * VERTS).fill(-1e9);
    for (let bz = 0; bz < 6; bz++) {
      for (let bx = 0; bx < 6; bx++) {
        const lvl = plan.waterLevel(x0 + bx * 32 + 16, z0 + bz * 32 + 16);   // sablon blogu
        if (lvl === null) continue;
        let under = false;
        for (let i = bz * 16; i <= bz * 16 + 16 && !under; i++) for (let j = bx * 16; j <= bx * 16 + 16; j++) if (heights[i * VERTS + j] < lvl * 10) { under = true; break; }
        if (!under) continue;
        const k = bz * 6 + bx;
        waterType[k] = 0;
        waterHeight[k] = lvl * 10 + 0.2;
        for (let i = bz * 16; i <= bz * 16 + 16; i++) for (let j = bx * 16; j <= bx * 16 + 16; j++) wl[i * VERTS + j] = Math.max(wl[i * VERTS + j], lvl * 10);
      }
    }
    // zemin dokusu
    const T = this.tileByName;
    const word = (name) => { const t = T[name]; return t.id | (t.scale << 13); };
    const W = {
      sand: word('sand'), dirt: word('dirt'), gravel: word('gravel'), grass: word('grass'), steppe: word('steppe'),
      rock: word('rock'), redrock: word('redrock'), snow: word('snow'), mud: word('mud'), cobble: word('cobble'),
      paving: word('paving'), farmland: word('farmland'), road: word('road'), slab: word('slab'), slabDark: word('slab_dark'),
    };
    const texture = new Uint16Array(VERTS * VERTS);
    const H = (i, j) => heights[Math.min(CELLS, Math.max(0, i)) * VERTS + Math.min(CELLS, Math.max(0, j))] * 0.1;
    const n = this.n;
    const track = tracksNear(rx, rz, 'path');      // ralli parkuru: toprak serit
    const CW = plan.classes.map((c) => W[c === 'forest' ? 'grass' : c === 'void' ? 'rock' : c] ?? W.dirt);
    // Cin sehirlerinde avlu/yol dosemesi kare tas levha
    let near = null, nd = Infinity;
    for (const c of plan.cities) { const dd = Math.hypot(x0 + 96 - c.x, z0 + 96 - c.z); if (dd < nd) { nd = dd; near = c; } }
    const slabs = near && near.culture === 'china' && nd < 2200;
    const sandy = plan.cls.sand, rockC = plan.cls.rock, redC = plan.cls.redrock, pave = plan.cls.paving, cob = plan.cls.cobble, snowC = plan.cls.snow;
    for (let i = 0; i < VERTS; i++) {
      for (let j = 0; j < VERTS; j++) {
        const k = i * VERTS + j, x = x0 + j * 2, z = z0 + i * 2;
        const h = heights[k] * 0.1;
        const gx = (H(i, j + 1) - H(i, j - 1)) / 4, gz = (H(i + 1, j) - H(i - 1, j)) / 4;
        const slope = Math.sqrt(gx * gx + gz * gz);
        const jit = n.noise(x / 9, z / 9) * 0.5 + n.noise(x / 37, z / 37) * 0.5;   // gecis kenari titresimi
        const c = plan.groundAt(x, z, 3.5);
        let w = CW[c];
        if (heights[k] < wl[k] - 2) w = c === sandy ? W.sand : W.mud;
        else if (c === pave || c === cob) w = slabs ? (c === pave ? W.slab : W.slabDark) : CW[c];
        else if (track.length && trackDist(x, z, track) < TRACK.paint + jit * 0.9) w = c === sandy ? W.gravel : W.dirt;
        else if (slope > 0.78 - jit * 0.12 && c !== snowC) w = c === redC || c === sandy ? W.redrock : W.rock;
        else if (slope > 0.5 - jit * 0.1 && (c === rockC || c === redC)) w = CW[c];
        else if (slope > 0.55 - jit * 0.1 && c !== snowC) w = jit > 0 ? W.gravel : W.dirt;
        texture[k] = w;
      }
    }
    // renk duzeltmesi: orijinal zeminin 16 m ortalama rengi / bizim karolarin ayni hucredeki
    // ortalamasi (dogrusal). Yerel karo farklari (cimen/yol) korunur, genel palet orijinale yaklasir.
    const lin = (c) => Math.pow(c / 255, 2.2), srgb = (v) => Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2) * 255;
    const tileLin = (w) => { const t = this.tiles[w & 0x3ff]; return t ? t.color.map(lin) : [0.2, 0.2, 0.2]; };
    const classLin = plan.classes.map((c, i) => tileLin(slabs && i === pave ? W.slab : slabs && i === cob ? W.slabDark : CW[i]));
    const gx0 = Math.floor((x0 - plan.X0) / 16), gz0 = Math.floor((z0 - plan.Z0) / 16);
    const cell = new Map();
    const corrCell = (cx, cz) => {
      const key = cx * 4096 + cz;
      let r = cell.get(key);
      if (r) return r;
      const o = plan.colorCell(cx + plan.rx0 * 12, cz + plan.rz0 * 12);
      if (!o) r = [1, 1, 1];
      else {
        const s3 = [0, 0, 0];
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const ggx = Math.min(plan.gw - 1, Math.max(0, cx * 2 + b)), ggz = Math.min(plan.gh - 1, Math.max(0, cz * 2 + a));
          const L = classLin[plan.ground[ggz * plan.gw + ggx]];
          s3[0] += L[0] / 4; s3[1] += L[1] / 4; s3[2] += L[2] / 4;
        }
        r = o.map((c, i) => Math.min(2.5, Math.max(0.35, lin(c) / Math.max(0.004, s3[i]))));
      }
      cell.set(key, r);
      return r;
    };
    const corrAt = (lx, lz, out) => {
      const fx = lx / 16 - 0.5, fz = lz / 16 - 0.5;
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
      const a = corrCell(gx0 + ix, gz0 + iz), b = corrCell(gx0 + ix + 1, gz0 + iz), c = corrCell(gx0 + ix, gz0 + iz + 1), e = corrCell(gx0 + ix + 1, gz0 + iz + 1);
      for (let q = 0; q < 3; q++) out[q] = (a[q] * (1 - tx) + b[q] * tx) * (1 - tz) + (c[q] * (1 - tx) + e[q] * tx) * tz;
      return out;
    };
    // renk haritasi (uzak gorunus): 128x128, duzeltilmis karo rengi x egim golgesi; corrmap: duzeltme / 2.5
    const colormap = new Uint8Array(128 * 128 * 4);
    const corrmap = new Uint8Array(128 * 128 * 4);
    const cr = [1, 1, 1];
    for (let v = 0; v < 128; v++) {
      for (let u = 0; u < 128; u++) {
        const i = Math.min(CELLS, Math.round((v * CELLS) / 127)), j = Math.min(CELLS, Math.round((u * CELLS) / 127));
        const gx = (H(i, j + 1) - H(i, j - 1)) / 4, gz = (H(i + 1, j) - H(i - 1, j)) / 4;
        const shade = Math.max(0.55, Math.min(1.25, 1 - gx * 0.55 + gz * 0.45));
        const o = (v * 128 + u) * 4;
        corrAt((u * 192) / 127, (v * 192) / 127, cr);
        corrmap[o] = Math.round((cr[0] / 2.5) * 255); corrmap[o + 1] = Math.round((cr[1] / 2.5) * 255); corrmap[o + 2] = Math.round((cr[2] / 2.5) * 255); corrmap[o + 3] = 255;
        let c;
        if (heights[i * VERTS + j] < wl[i * VERTS + j]) c = [38, 84, 104];
        else { const L = tileLin(texture[i * VERTS + j]); c = [srgb(L[0] * cr[0]), srgb(L[1] * cr[1]), srgb(L[2] * cr[2])]; }
        colormap[o] = Math.min(255, c[0] * shade); colormap[o + 1] = Math.min(255, c[1] * shade); colormap[o + 2] = Math.min(255, c[2] * shade); colormap[o + 3] = 255;
      }
    }
    return { heights, texture, waterType, waterHeight, colormap, corrmap, roads, holes, minH, maxH, objects: null };
  }

  /** Mini harita karosu (tarayicida): bolgenin renk haritasi, kuzey yukarida. */
  minimapTile(key) {
    const [rz, rx] = key.split('_').map(Number);
    const t = document.createElement('canvas');
    t.width = t.height = 128;
    t.complete = true;
    if (!this.has(rx, rz)) { t.failed = true; return t; }
    const cm = this.region(key).colormap;
    const ctx = t.getContext('2d');
    const img = ctx.createImageData(128, 128);
    for (let v = 0; v < 128; v++) img.data.set(cm.subarray(v * 512, v * 512 + 512), (127 - v) * 512);
    ctx.putImageData(img, 0, 0);
    t.naturalWidth = 128;
    return t;
  }

  /** Bir noktanin su seviyesi (m) ya da null (fizik: suya dusme, kurtarma). */
  waterLevel(x, z) { return this.plan.waterLevel(x, z); }
}

export { smoothstep };
