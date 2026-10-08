import { WorldPlan, WORLD, REGION_M } from './plan.js';
import { Simplex, hash2, smoothstep } from './noise.js';
import { placeRegionObjects } from './place.js';

// V5 dunya verisi: motorun bekledigi bolge verilerini (yukseklik, zemin dokusu, su, renk haritasi,
// objeler) dunya planindan aninda uretir. Eski WorldData (Silkroad dosyalari) ile ayni arayuz.
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
    this.plan = new WorldPlan();
    this.n = new Simplex(this.plan.seed + 7);
    this.regions = new Map();
    for (let rz = 0; rz < WORLD.rz; rz++) {
      for (let rx = 0; rx < WORLD.rx; rx++) {
        this.regions.set(this.key(rx, rz), { key: this.key(rx, rz), x: rx, z: rz, objects: true, minH: 0, maxH: 400 });
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
    const s = {};
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < VERTS; i++) {
      for (let j = 0; j < VERTS; j++) {
        plan.sample(x0 + j * 2, z0 + i * 2, s);
        const k = i * VERTS + j;
        heights[k] = s.h * 10;
        roads[k] = s.road;
        kinds[k] = s.roadKind === 'paved' ? 1 : s.roadKind === 'dirt' ? 2 : 0;
        if (s.h < minH) minH = s.h;
        if (s.h > maxH) maxH = s.h;
      }
    }
    // su: 6x6 blok (32 m), blok merkezindeki seviye; bloktaki bir kose altta kaliyorsa su var
    const waterType = new Uint8Array(36).fill(255);
    const waterHeight = new Float32Array(36);
    const wl = new Float32Array(VERTS * VERTS).fill(-1e9);
    for (let bz = 0; bz < 6; bz++) {
      for (let bx = 0; bx < 6; bx++) {
        const lvl = plan.waterLevel(x0 + bx * 32 + 16, z0 + bz * 32 + 16);
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
      paving: word('paving'), farmland: word('farmland'), road: word('road'),
    };
    const texture = new Uint16Array(VERTS * VERTS);
    const H = (i, j) => heights[Math.min(CELLS, Math.max(0, i)) * VERTS + Math.min(CELLS, Math.max(0, j))] * 0.1;
    const n = this.n;
    for (let i = 0; i < VERTS; i++) {
      for (let j = 0; j < VERTS; j++) {
        const k = i * VERTS + j, x = x0 + j * 2, z = z0 + i * 2;
        const h = heights[k] * 0.1;
        const gx = (H(i, j + 1) - H(i, j - 1)) / 4, gz = (H(i + 1, j) - H(i - 1, j)) / 4;
        const slope = Math.sqrt(gx * gx + gz * gz);
        const jit = n.noise(x / 9, z / 9) * 0.5 + n.noise(x / 37, z / 37) * 0.5;   // gecis kenari titresimi
        let w;
        const city = plan.cityAt(x, z);
        if (heights[k] < wl[k] - 2) w = h < 1 ? W.sand : W.mud;
        else if (roads[k] > 0.45 - jit * 0.08) w = kinds[k] === 1 ? (city ? W.paving : W.cobble) : W.road;
        else if (city) {
          const d = Math.hypot(x - city.x, z - city.z) / city.r;
          w = d < 0.3 ? W.paving : d < 0.92 ? (jit > 0.15 ? W.cobble : W.dirt) : W.dirt;
        } else {
          const bio = plan.biome(x, z);
          const snowline = 330 + n.noise(x / 300, z / 300) * 45;
          if (h > snowline && slope < 0.9) w = W.snow;
          else if (slope > 0.85 - jit * 0.1) w = bio.mesa > 0.25 || bio.sand > 0.5 ? W.redrock : W.rock;
          else if (h > 250 + jit * 30) w = slope > 0.4 ? W.rock : W.gravel;
          else if (h < 3.2 && plan.seaDepth(x, z) > -120) w = W.sand;   // plaj
          else if (wl[k] > -1e8 && heights[k] < wl[k] + 15) w = W.mud;    // su kiyisi
          else {
            // biyom agirliklari + gurultu: en yuksek skor
            const fn = n.noise(x / 140, z / 140);
            const sc = [
              [W.sand, bio.sand + jit * 0.25],
              [W.steppe, bio.steppe + fn * 0.2],
              [W.grass, bio.grass + bio.forest * 0.3 - fn * 0.15],
              [W.dirt, 0.18 + (slope > 0.35 ? 0.4 : 0) + n.noise(x / 60, z / 60) * 0.12],
              [W.redrock, bio.mesa * (slope > 0.5 ? 1.2 : 0.2)],
            ];
            // ekin tarlalari: yesil bolgede sehir cevresi
            if (bio.grass > 0.5 && bio.wet > 0.2 && hash2(Math.floor(x / 60), Math.floor(z / 60), 3) < 0.45) sc.push([W.farmland, 1.2]);
            let best = sc[0];
            for (const c of sc) if (c[1] > best[1]) best = c;
            w = best[0];
          }
        }
        texture[k] = w;
      }
    }
    // renk haritasi (uzak gorunus): 128x128, katman ortalama rengi x egim golgesi
    const colormap = new Uint8Array(128 * 128 * 4);
    for (let v = 0; v < 128; v++) {
      for (let u = 0; u < 128; u++) {
        const i = Math.min(CELLS, Math.round((v * CELLS) / 127)), j = Math.min(CELLS, Math.round((u * CELLS) / 127));
        const t = this.tiles[texture[i * VERTS + j] & 0x3ff];
        const gx = (H(i, j + 1) - H(i, j - 1)) / 4, gz = (H(i + 1, j) - H(i - 1, j)) / 4;
        const shade = Math.max(0.55, Math.min(1.25, 1 - gx * 0.55 + gz * 0.45));
        const o = (v * 128 + u) * 4;
        let c = t.color;
        if (heights[i * VERTS + j] < wl[i * VERTS + j]) c = [38, 84, 104];
        colormap[o] = Math.min(255, c[0] * shade); colormap[o + 1] = Math.min(255, c[1] * shade); colormap[o + 2] = Math.min(255, c[2] * shade); colormap[o + 3] = 255;
      }
    }
    return { heights, texture, waterType, waterHeight, colormap, roads, minH, maxH, objects: null };
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
