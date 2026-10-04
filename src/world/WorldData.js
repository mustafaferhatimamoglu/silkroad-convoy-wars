// Silkroad dunya verisi: manifestler ve koordinat donusumleri.
//
// Koordinat sistemi (V3'te dogrulanan yerlesim korunur):
//   Silkroad dunyasi 1920x1920 birimlik bolgelere ayrilir (96x96 hucre, hucre = 20 birim).
//   Bolge anahtari "z_x"; dunya X = x*1920 + yerelX, dunya Z = z*1920 + yerelZ, Y yukari.
//   Three.js: 1 Silkroad birimi = SCALE metre, threeZ = -dunyaZ (ayna goruntusu olmasin diye).
//   Three.js (0,0,0) noktasi = origin bolgesinin (varsayilan Jangan 168,97) guney-bati kosesi.

export const SCALE = 0.1;
export const REGION_SIZE = 1920;
export const CELL_SIZE = 20;
export const VERTS = 97;
export const CELLS = 96;
export const REGION_M = REGION_SIZE * SCALE; // 192 m
export const CELL_M = CELL_SIZE * SCALE;     // 2 m

// tiles.json "flags" alani = zemin malzemesi (ses/surus icin)
export const SURFACE = {
  DIRT: 0, SAND: 1, STONE: 3, MUD: 6, WATER: 7, SNOW: 9, GRASS: 10, GRASS2: 11, GRASS3: 12,
};

export const SURFACE_NAMES = {
  0: 'Toprak', 1: 'Kum', 3: 'Taş', 6: 'Çamur', 7: 'Islak zemin', 9: 'Kar',
  10: 'Çimen', 11: 'Çimen', 12: 'Çimen', 100: 'Kaldırım',
};

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export class WorldData {
  constructor(base = 'assets/') {
    this.base = base;
    this.origin = { x: 168, z: 97 };
  }

  async load() {
    const b = this.base;
    const [world, tiles, objModels, modelIndex] = await Promise.all([
      fetchJSON(b + 'map/world.json'),
      fetchJSON(b + 'map/textures/tiles.json'),
      fetchJSON(b + 'map/objects/models.json'),
      fetchJSON(b + 'models/models_index.json'),
    ]);
    this.world = world;
    this.tiles = tiles;
    this.objModels = objModels;
    this.modelIndex = modelIndex.models || {};
    this.layout = world.binLayout.fields;
    this.regions = new Map();
    for (const r of world.regions) {
      if (!r.isDungeon) this.regions.set(r.key, r);
    }
    const o = world.coordinateSystem.suggestedOrigin;
    this.origin = { x: o.x, z: o.z };
    return this;
  }

  key(rx, rz) { return `${rz}_${rx}`; }
  has(rx, rz) { return this.regions.has(this.key(rx, rz)); }
  info(rx, rz) { return this.regions.get(this.key(rx, rz)); }

  /** Bolgenin guney-bati kosesinin Three.js konumu (x, z). */
  regionOrigin(rx, rz, target = { x: 0, z: 0 }) {
    target.x = (rx - this.origin.x) * REGION_M;
    target.z = -(rz - this.origin.z) * REGION_M;
    return target;
  }

  /** Silkroad bolge + yerel konum -> Three.js koordinati. */
  toThree(rx, rz, lx, y, lz, target) {
    const x = ((rx - this.origin.x) * REGION_SIZE + lx) * SCALE;
    const z = -((rz - this.origin.z) * REGION_SIZE + lz) * SCALE;
    if (target) { target.x = x; target.y = y * SCALE; target.z = z; return target; }
    return { x, y: y * SCALE, z };
  }

  /** Three.js x,z -> bolge + yerel Silkroad koordinati. */
  fromThree(x, z) {
    const wx = x / SCALE + this.origin.x * REGION_SIZE;
    const wz = -z / SCALE + this.origin.z * REGION_SIZE;
    const rx = Math.floor(wx / REGION_SIZE), rz = Math.floor(wz / REGION_SIZE);
    return { rx, rz, lx: wx - rx * REGION_SIZE, lz: wz - rz * REGION_SIZE };
  }

  tile(id) { return this.tiles[id]; }

  tileUrl(id) {
    const t = this.tiles[id];
    return t ? this.base + 'map/' + t.file : null;
  }

  regionUrl(key) { return this.base + 'map/' + this.world.paths.region.replace('{key}', key); }
  colormapUrl(key) { return this.base + 'map/' + this.world.paths.colormap.replace('{key}', key); }
  objectsUrl(key) { return this.base + 'map/' + this.world.paths.objects.replace('{key}', key); }
  minimapUrl(key) { return this.base + 'minimap/world/' + key + '.jpg'; }

  /** .bin bolge dosyasini typed array alanlarina ayirir. */
  parseRegion(buf) {
    const f = this.layout;
    return {
      heights: new Float32Array(buf, f.height.offset, f.height.count),
      texture: new Uint16Array(buf.slice(f.texture.offset, f.texture.offset + f.texture.count * 2)),
      waterType: new Uint8Array(buf, f.waterType.offset, f.waterType.count),
      waterHeight: new Float32Array(buf.slice(f.waterHeight.offset, f.waterHeight.offset + f.waterHeight.count * 4)),
    };
  }
}

/** Zemin dokusu kelimesini cozer: alt 10 bit doku, ust 3 bit olcek ussu (tekrar = 4 * 2^u hucre). */
export function decodeTexWord(w) {
  return { id: w & 0x3ff, scaleExp: (w >> 13) & 7 };
}
