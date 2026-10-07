import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { WorldData, SCALE, VERTS, CELLS, REGION_M, CELL_M } from './WorldData.js';
import { TextureArrayPool } from './TextureArrayPool.js';
import { TerrainMaterials, buildTerrainGeometry, refreshEdgeNormals, buildIndexTexture, sampleHeight } from './Terrain.js';
import { ObjectLibrary, ObjectMaterials, buildRegionObjects } from './Objects.js';
import { WaterSystem } from './Water.js';

// Dunya akis yoneticisi.
//  - Yakin halka (nearRadius): tam cozunurluklu arazi + orijinal doku karisimi + objeler + su + carpisma.
//  - Uzak halka (farRadius): 25x25 kafesli dusuk detay arazi, sadece renk haritasi (ufuk/daglar).
// Tum meshler bolge-yerel koordinatlarda kurulur ve bolge kosesine konumlanir; boylece
// sehirler arasi binlerce metrede bile float hassasiyeti kaybolmaz.

const LOD_STEP = 4;

export class World {
  constructor(renderer, scene, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.opts = Object.assign({
      nearRadius: 2, farRadius: 5, objects: true, water: true,
      tileSize: 512, tileCapacity: 120, objTexSize: 256, objTexCapacity: 640,
      shadows: true, buildBudgetMs: 10,
    }, opts);
    this.data = new WorldData('assets/');
    this.regions = new Map();
    this.bvhRegions = [];   // obje carpisma agaci hazir bolgeler
    this.group = new THREE.Group(); this.group.name = 'World';
    this.terrainGroup = new THREE.Group();
    this.objectGroup = new THREE.Group();
    this.waterGroup = new THREE.Group();
    this.group.add(this.terrainGroup, this.objectGroup, this.waterGroup);
    scene.add(this.group);
    this.binCache = new Map();
    this.colormapCache = new Map();
    this.jobs = [];          // insa isleri (oncelik sirali)
    this.focus = new THREE.Vector3();
    this.focusRegion = { rx: 0, rz: 0 };
    this.stats = { near: 0, far: 0, pendingNear: 0, objects: 0 };
  }

  async init() {
    await this.data.load();
    const o = this.opts;
    this.tilePool = new TextureArrayPool(this.renderer, { size: o.tileSize, capacity: o.tileCapacity, name: 'zemin' });
    this.objPool = new TextureArrayPool(this.renderer, { size: o.objTexSize, capacity: o.objTexCapacity, anisotropy: 4, name: 'obje' });
    this.terrainMats = new TerrainMaterials(this.tilePool);
    this.tilePool.onSlotFilled = (slot, key) => {
      const t = this.data.tile(key);
      if (t && t.color) {
        const [r, g, b] = t.color.map((c) => Math.pow(c / 255, 2.2));
        this.terrainMats.setLayerLuminance(slot, 0.2126 * r + 0.7152 * g + 0.0722 * b);
      }
    };
    this.objectLib = new ObjectLibrary(this.data, this.objPool);
    this.objectMats = new ObjectMaterials(this.objPool);
    this.water = new WaterSystem();
    return this;
  }

  // ------------------------------------------------------------------ koordinatlar
  toThree(rx, rz, lx, y, lz, t) { return this.data.toThree(rx, rz, lx, y, lz, t); }
  fromThree(x, z) { return this.data.fromThree(x, z); }

  /** Bir bolgenin merkezinin Three.js konumu (yukseklik bilinmiyorsa info ortalamasi). */
  regionCenter(rx, rz) {
    const info = this.data.info(rx, rz);
    const p = this.toThree(rx, rz, 960, 0, 960, new THREE.Vector3());
    const h = this.heightAt(p.x, p.z);
    p.y = h !== null ? h : info ? ((info.minH + info.maxH) / 2) * SCALE : 0;
    return p;
  }

  // ------------------------------------------------------------------ akis
  update(focus, dt) {
    if (!Number.isFinite(focus.x) || !Number.isFinite(focus.z)) return;
    this.focus.copy(focus);
    const p = this.fromThree(focus.x, focus.z);
    this.focusRegion.rx = p.rx; this.focusRegion.rz = p.rz;
    const { nearRadius: N, farRadius: F } = this.opts;

    // istenen durumlar
    const want = new Map();
    for (let dz = -F; dz <= F; dz++) {
      for (let dx = -F; dx <= F; dx++) {
        const rx = p.rx + dx, rz = p.rz + dz;
        const key = this.data.key(rx, rz);
        if (!this.data.regions.has(key)) continue;
        // yakin halka: chebyshev mesafesi <= N ; uzak: dairesel F
        const cheb = Math.max(Math.abs(dx), Math.abs(dz));
        const d2 = dx * dx + dz * dz;
        if (cheb <= N) want.set(key, 'near');
        else if (d2 <= (F + 0.5) * (F + 0.5)) want.set(key, 'far');
      }
    }
    // yeni/degisen bolgeler
    for (const [key, lod] of want) {
      let r = this.regions.get(key);
      if (!r) {
        const info = this.data.regions.get(key);
        r = { key, rx: info.x, rz: info.z, info, lod: null, target: lod, near: null, far: null, building: false, gen: 0 };
        r.origin = this.data.regionOrigin(info.x, info.z, { x: 0, z: 0 });
        this.regions.set(key, r);
      }
      r.target = lod;
    }
    // istenmeyenler
    for (const [key, r] of this.regions) {
      if (!want.has(key)) r.target = null;
    }
    // is kuyrugu: yakin bolgeler once, mesafeye gore
    this.jobs.length = 0;
    for (const r of this.regions.values()) {
      if (r.building) continue;
      if (r.target !== r.lod || (r.target === 'near' && r.near && !r.near.objectsDone && !r.near.objectsBuilding)) {
        const dx = r.rx - p.rx, dz = r.rz - p.rz;
        let pri = dx * dx + dz * dz;
        if (r.target !== 'near') pri += 100;
        if (r.target === null) pri = -1; // bosaltma hemen
        this.jobs.push({ r, pri });
      }
    }
    this.jobs.sort((a, b) => a.pri - b.pri);
    const t0 = performance.now();
    let started = 0;
    for (const job of this.jobs) {
      if (performance.now() - t0 > this.opts.buildBudgetMs && started > 0) break;
      this._process(job.r);
      started++;
    }

    // dokulari GPU'ya aktar
    this.tilePool.flush(6);
    this.objPool.flush(12);
    this.water.update(dt);

    let near = 0, far = 0, pend = 0;
    for (const r of this.regions.values()) {
      if (r.lod === 'near') near++; else if (r.lod === 'far') far++;
      if (r.target === 'near' && (r.lod !== 'near' || (this.opts.objects && r.near && !r.near.objectsDone))) pend++;
    }
    this.stats.near = near; this.stats.far = far; this.stats.pendingNear = pend;
  }

  /** Odak cevresindeki yakin bolgeler hazir mi (yukleme ekrani icin). */
  readyAround(x, z, radius = 1) {
    const p = this.fromThree(x, z);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const key = this.data.key(p.rx + dx, p.rz + dz);
        if (!this.data.regions.has(key)) continue;
        const r = this.regions.get(key);
        if (!r || r.lod !== 'near') return false;
        if (this.opts.objects && r.near && !r.near.objectsDone) return false;
      }
    }
    return true;
  }

  _process(r) {
    if (r.target === null) { this._unload(r); this.regions.delete(r.key); return; }
    if (r.target === 'near' && r.lod !== 'near') { this._buildNear(r); return; }
    if (r.target === 'near' && r.lod === 'near' && r.near && !r.near.objectsDone && !r.near.objectsBuilding) {
      this._buildObjects(r); return;
    }
    if (r.target === 'far' && r.lod !== 'far') { this._buildFar(r); return; }
  }

  async _bin(key) {
    let p = this.binCache.get(key);
    if (!p) {
      p = fetch(this.data.regionUrl(key)).then((res) => res.arrayBuffer()).then((buf) => this.data.parseRegion(buf));
      this.binCache.set(key, p);
      if (this.binCache.size > 400) {
        // eski kayitlari at (aktif bolgeler tekrar yukler)
        for (const k of this.binCache.keys()) { if (!this.regions.has(k)) { this.binCache.delete(k); if (this.binCache.size <= 300) break; } }
      }
    }
    return p;
  }

  async _colormap(key) {
    let p = this.colormapCache.get(key);
    if (!p) {
      p = fetch(this.data.colormapUrl(key))
        .then((res) => res.blob())
        .then((b) => createImageBitmap(b, { resizeWidth: 128, resizeHeight: 128, imageOrientation: 'flipY', colorSpaceConversion: 'none' }))
        .then((bmp) => {
          const t = new THREE.Texture(bmp);
          t.colorSpace = THREE.SRGBColorSpace;
          t.flipY = false;
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
          t.anisotropy = 4;
          t.needsUpdate = true;
          return t;
        })
        .catch(() => null);
      this.colormapCache.set(key, p);
    }
    return p;
  }

  /** Komsu bolgelerin kenar yuksekliklerine erisim (dikissiz normaller icin). */
  _neighborHeight(r) {
    return (i, j) => {
      let rx = r.rx, rz = r.rz;
      if (j < 0) { rx--; j += CELLS; } else if (j >= VERTS) { rx++; j -= CELLS; }
      if (i < 0) { rz--; i += CELLS; } else if (i >= VERTS) { rz++; i -= CELLS; }
      const n = this.regions.get(this.data.key(rx, rz));
      const h = n && n.heights;
      if (!h || i < 0 || i >= VERTS || j < 0 || j >= VERTS) return null;
      return h[i * VERTS + j];
    };
  }

  async _buildNear(r) {
    r.building = true;
    const gen = ++r.gen;
    try {
      const bin = await this._bin(r.key);
      r.heights = bin.heights;
      r.texWords = bin.texture;
      const colormap = await this._colormap(r.key);
      // dokulari kirala
      const ids = new Set();
      for (let k = 0; k < bin.texture.length; k++) ids.add(bin.texture[k] & 0x3ff);
      const slots = new Map();
      await Promise.all([...ids].map(async (id) => {
        slots.set(id, await this.tilePool.acquire(id, this.data.tileUrl(id) || ''));
      }));
      if (gen !== r.gen || r.target !== 'near') {
        for (const id of ids) this.tilePool.release(id);
        return;
      }
      const tileFlags = (id) => { const t = this.data.tile(id); return t ? t.flags & 255 : 0; };
      const indexTex = buildIndexTexture(bin.texture, (id) => slots.get(id) ?? 0, tileFlags);
      const geo = buildTerrainGeometry(bin.heights, 1, this._neighborHeight(r));
      const cellOffset = { x: (r.rx * CELLS) % 256, y: (r.rz * CELLS) % 256 };
      const mat = this.terrainMats.createNear(indexTex, colormap, cellOffset);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(r.origin.x, 0, r.origin.z);
      mesh.receiveShadow = true;
      mesh.name = 'terrain_' + r.key;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.terrainGroup.add(mesh);

      let water = null;
      if (this.opts.water) {
        water = this.water.buildRegion(r.rx, r.rz, bin.heights, bin.waterType, bin.waterHeight);
        if (water) {
          water.position.set(r.origin.x, 0, r.origin.z);
          water.matrixAutoUpdate = false; water.updateMatrix();
          this.waterGroup.add(water);
        }
      }
      r.waterType = bin.waterType; r.waterHeight = bin.waterHeight;
      // eski uzak LOD'u kaldir
      if (r.far) this._disposeFar(r);
      r.near = { mesh, mat, indexTex, tileIds: ids, water, objectsDone: !this.opts.objects || !r.info.objects, objectsBuilding: false };
      r.lod = 'near';
      this._refreshNeighbors(r);
    } catch (e) {
      console.warn('Bolge yuklenemedi', r.key, e);
    } finally {
      r.building = false;
    }
  }

  _refreshNeighbors(r) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.regions.get(this.data.key(r.rx + dx, r.rz + dz));
      if (n && n.lod === 'near' && n.near) {
        refreshEdgeNormals(n.near.mesh.geometry, n.heights, 1, this._neighborHeight(n));
      }
    }
    if (r.near) refreshEdgeNormals(r.near.mesh.geometry, r.heights, 1, this._neighborHeight(r));
  }

  async _buildObjects(r) {
    const near = r.near;
    near.objectsBuilding = true;
    const gen = r.gen;
    const cancelled = () => gen !== r.gen || r.target !== 'near' || r.near !== near;
    try {
      const res = await fetch(this.data.objectsUrl(r.key) + '');
      const json = res.ok ? await res.json() : { objects: [] };
      const built = await buildRegionObjects(this.objectLib, json.objects || [], cancelled);
      if (!built || cancelled()) {
        if (built) for (const tk of built.textures) this.objPool.release(tk);
        return;
      }
      const group = new THREE.Group();
      group.name = 'objects_' + r.key;
      group.position.set(r.origin.x, 0, r.origin.z);
      if (built.meshes.opaque) {
        const m = new THREE.Mesh(built.meshes.opaque, this.objectMats.opaque);
        m.castShadow = this.opts.shadows; m.receiveShadow = true;
        group.add(m);
      }
      if (built.meshes.alpha) {
        const m = new THREE.Mesh(built.meshes.alpha, this.objectMats.alpha);
        m.castShadow = this.opts.shadows; m.receiveShadow = true;
        m.customDepthMaterial = this.objectMats.alphaDepth;
        group.add(m);
      }
      group.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
      group.updateMatrixWorld(true);
      this.objectGroup.add(group);
      near.objects = { group, textures: built.textures, count: built.objectCount };
      if (built.collision) {
        const t0 = performance.now();
        near.bvh = new MeshBVH(built.collision, { maxLeafSize: 12 });
        near.bvhMs = performance.now() - t0;
        // dunya XZ siniri: objeler bolge sinirini asabilir (merdiven, kopru), sorgular buna bakar
        built.collision.computeBoundingBox();
        const bb = built.collision.boundingBox;
        near.bvhBox = { x0: bb.min.x + r.origin.x, x1: bb.max.x + r.origin.x, z0: bb.min.z + r.origin.z, z1: bb.max.z + r.origin.z };
        this.bvhRegions.push(r);
      }
    } catch (e) {
      console.warn('Objeler kurulamadi', r.key, e);
    } finally {
      near.objectsBuilding = false;
      near.objectsDone = true;
    }
  }

  async _buildFar(r) {
    r.building = true;
    const gen = ++r.gen;
    try {
      const bin = await this._bin(r.key);
      const colormap = await this._colormap(r.key);
      if (gen !== r.gen || r.target !== 'far') return;
      r.heights = bin.heights; r.texWords = bin.texture;
      const geo = buildTerrainGeometry(bin.heights, LOD_STEP, this._neighborHeight(r));
      // uzak LOD icin UV (renk haritasi)
      const n = CELLS / LOD_STEP + 1;
      const uv = new Float32Array(n * n * 2);
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { uv[(a * n + b) * 2] = b / (n - 1); uv[(a * n + b) * 2 + 1] = a / (n - 1); }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      // eteklik: komsu LOD farkindan dogan bosluklari gizlemek icin kenarlari biraz indir
      const pos = geo.attributes.position.array;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        if (a === 0 || b === 0 || a === n - 1 || b === n - 1) pos[(a * n + b) * 3 + 1] -= 0.6;
      }
      const mat = this.terrainMats.createFar(colormap);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(r.origin.x, 0, r.origin.z);
      mesh.name = 'terrainFar_' + r.key;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      this.terrainGroup.add(mesh);
      if (r.near) this._disposeNear(r);
      r.far = { mesh, mat };
      r.lod = 'far';
    } catch (e) {
      console.warn('Uzak bolge yuklenemedi', r.key, e);
    } finally {
      r.building = false;
    }
  }

  _disposeNear(r) {
    const n = r.near;
    if (!n) return;
    this.terrainGroup.remove(n.mesh);
    n.mesh.geometry.dispose();
    n.mat.dispose();
    n.indexTex.dispose();
    for (const id of n.tileIds) this.tilePool.release(id);
    if (n.water) { this.waterGroup.remove(n.water); n.water.geometry.dispose(); }
    if (n.objects) {
      this.objectGroup.remove(n.objects.group);
      n.objects.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const tk of n.objects.textures) this.objPool.release(tk);
    }
    if (n.bvh) {
      n.bvh.geometry.dispose(); n.bvh = null;
      const i = this.bvhRegions.indexOf(r);
      if (i >= 0) this.bvhRegions.splice(i, 1);
    }
    r.near = null;
    if (r.lod === 'near') r.lod = null;
  }

  _disposeFar(r) {
    const f = r.far;
    if (!f) return;
    this.terrainGroup.remove(f.mesh);
    f.mesh.geometry.dispose();
    f.mat.dispose();
    r.far = null;
    if (r.lod === 'far') r.lod = null;
  }

  _unload(r) {
    r.gen++;
    this._disposeNear(r);
    this._disposeFar(r);
    r.lod = null;
  }

  // ------------------------------------------------------------------ fiziksel sorgular
  _regionAt(x, z) {
    // fizik saniyede binlerce sorgu yapar: son bolgeyi onbellekte tut, string anahtar uretme
    const q = this._q || (this._q = { r: null, p: { rx: 0, rz: 0, lx: 0, lz: 0 }, rx: NaN, rz: NaN, reg: null });
    const wx = x / SCALE + this.data.origin.x * 1920;
    const wz = -z / SCALE + this.data.origin.z * 1920;
    const rx = Math.floor(wx / 1920), rz = Math.floor(wz / 1920);
    let r;
    if (rx === q.rx && rz === q.rz && q.reg && q.reg.heights && this.regions.get(q.reg.key) === q.reg) r = q.reg;
    else {
      r = this.regions.get(this.data.key(rx, rz));
      q.rx = rx; q.rz = rz; q.reg = r || null;
    }
    if (!r || !r.heights) return null;
    q.r = r; q.p.rx = rx; q.p.rz = rz; q.p.lx = wx - rx * 1920; q.p.lz = wz - rz * 1920;
    return q;
  }

  /** Arazi yuksekligi (metre). Bolge yuklu degilse null. */
  heightAt(x, z) {
    const q = this._regionAt(x, z);
    if (!q) return null;
    return sampleHeight(q.r.heights, q.p.lx, q.p.lz) * SCALE;
  }

  /** Arazi normali (render ucgeniyle ayni). */
  normalAt(x, z, out) {
    const q = this._regionAt(x, z);
    if (!q) return out.set(0, 1, 0);
    const h = q.r.heights;
    const fx = Math.min(Math.max(q.p.lx / 20, 0), CELLS - 1e-4), fz = Math.min(Math.max(q.p.lz / 20, 0), CELLS - 1e-4);
    const j = Math.floor(fx), i = Math.floor(fz), tx = fx - j, tz = fz - i;
    const a = h[i * VERTS + j], b = h[i * VERTS + j + 1], c = h[(i + 1) * VERTS + j], d = h[(i + 1) * VERTS + j + 1];
    let dhx, dhi;
    if (tx + tz <= 1) { dhx = b - a; dhi = c - a; } else { dhx = d - c; dhi = d - b; }
    // metre cinsinden egimler: x yonu (+j), z yonu (-i)
    const sx = (dhx * SCALE) / CELL_M, si = (dhi * SCALE) / CELL_M;
    return out.set(-sx, 1, si).normalize();
  }

  /** Zemin malzemesi (tiles.json flags). En agir koseye gore. */
  surfaceAt(x, z) {
    const q = this._regionAt(x, z);
    if (!q || !q.r.texWords) return 0;
    const fx = Math.min(Math.max(q.p.lx / 20, 0), CELLS), fz = Math.min(Math.max(q.p.lz / 20, 0), CELLS);
    const j = Math.round(fx), i = Math.round(fz);
    const t = this.data.tile(q.r.texWords[i * VERTS + j] & 0x3ff);
    return t ? t.flags : 0;
  }

  /** Su yuksekligi (metre) ya da null. */
  waterAt(x, z) {
    const q = this._regionAt(x, z);
    if (!q || !q.r.waterType) return null;
    const bx = Math.min(5, Math.max(0, Math.floor(q.p.lx / 320))), bz = Math.min(5, Math.max(0, Math.floor(q.p.lz / 320)));
    const k = bz * 6 + bx;
    if (q.r.waterType[k] === 255) return null;
    return (q.r.waterHeight[k] - 0.2) * SCALE;
  }

  /** x,z cevresindeki (yaricap m) yakin bolgelerin carpisma BVH'lari. */
  /** Sorgu karesine (x+-radius, z+-radius) obje carpisma siniri degen bolgeler. Bellek ayirmaz. */
  bvhsNear(x, z, radius, out) {
    out.length = 0;
    const list = this.bvhRegions;
    for (let i = 0; i < list.length; i++) {
      const b = list[i].near.bvhBox;
      if (x + radius < b.x0 || x - radius > b.x1 || z + radius < b.z0 || z - radius > b.z1) continue;
      out.push(list[i]);
    }
    return out;
  }

  isLoadedAt(x, z) {
    const q = this._regionAt(x, z);
    return !!(q && q.r.lod === 'near');
  }

  dispose() {
    for (const r of this.regions.values()) this._unload(r);
    this.regions.clear();
    this.scene.remove(this.group);
  }
}
