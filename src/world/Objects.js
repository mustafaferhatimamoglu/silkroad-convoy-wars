import * as THREE from 'three';
import { SCALE } from './WorldData.js';

// Harita objeleri (binalar, agaclar, kayalar...). Bir bolgedeki tum objeler tek bir
// geometride birlestirilir; dokular ortak bir doku dizisinden katman indeksiyle okunur.
// Sonuc: bolge basina 2 cizim cagrisi (opak + alfa testli) ve bir carpisma geometrisi.

const SEASONAL_PATH = /(?:res|compound\/struct)\/etc\/(?:summer_event|obt|halloween|x_mas|newyearday)|^(?:sum_event|halloween|x_mas|obt_event)/i;
const SEASONAL_NAME = /^(?:sum_event|obt_event|halloween_|x_mas_|newyearday_)/i;
const EFFECT_PATH = /\.cpd|compound\/particle|flame_|light_|hide_light|cobweb|pha_touch|waterfall|particle|flame|light/i;
const EFFECT_NAME = /waterfall|particle|flame|light/i;

function limit(n) {
  let active = 0;
  const q = [];
  const next = () => {
    if (active >= n || !q.length) return;
    active++;
    const { fn, res, rej } = q.shift();
    fn().then(res, rej).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); });
}

export class ObjectLibrary {
  constructor(data, pool, { seasonal = false } = {}) {
    this.data = data;
    this.pool = pool;
    this.seasonal = seasonal;
    this.base = data.base + 'models/';
    this.defs = new Map();
    this.geoms = new Map();
    this.skipCache = new Map();
    this.loader = new THREE.BufferGeometryLoader();
    this.fetchLimit = limit(12);
  }

  skip(mid) {
    let s = this.skipCache.get(mid);
    if (s !== undefined) return s;
    const info = this.data.objModels[mid];
    const path = (info && info.path) || '';
    const idx = this.data.modelIndex[mid];
    const name = (idx && idx.name) || '';
    s = !idx
      || (!this.seasonal && (SEASONAL_PATH.test(path) || SEASONAL_NAME.test(name)))
      || EFFECT_PATH.test(path) || EFFECT_NAME.test(name);
    this.skipCache.set(mid, s);
    return s;
  }

  def(mid) {
    let p = this.defs.get(mid);
    if (!p) {
      p = this.fetchLimit(() => fetch(`${this.base}models/${mid}.json`).then((r) => (r.ok ? r.json() : null)))
        .catch(() => null);
      this.defs.set(mid, p);
    }
    return p;
  }

  geom(path) {
    let p = this.geoms.get(path);
    if (!p) {
      const url = this.base + path.replace(/^MODELS\//, '');
      p = this.fetchLimit(() => fetch(url).then((r) => (r.ok ? r.json() : null)))
        .then((json) => (json ? this.loader.parse(json) : null))
        .catch(() => null);
      this.geoms.set(path, p);
    }
    return p;
  }

  textureUrl(path) { return this.base + path.replace(/^MODELS\//, ''); }
}

/** Ortak obje malzemeleri (tum bolgeler paylasir). */
export class ObjectMaterials {
  constructor(pool) {
    this.pool = pool;
    const tObj = { value: pool.texture };
    const patch = (alpha) => (shader) => {
      shader.uniforms.tObj = tObj;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float layer;\nvarying float vLayer;\nvarying vec2 vOUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayer = layer;\nvOUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray tObj;\nvarying float vLayer;\nvarying vec2 vOUv;')
        .replace('#include <map_fragment>', `
{
  vec4 texel = texture(tObj, vec3(vOUv, floor(vLayer + 0.5)));
  ${alpha ? 'if (texel.a < 0.5) discard;' : ''}
  diffuseColor.rgb *= texel.rgb;
}`);
    };
    this.opaque = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.0 });
    this.opaque.onBeforeCompile = patch(false);
    this.opaque.customProgramCacheKey = () => 'sro-obj-opaque';

    this.alpha = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    this.alpha.onBeforeCompile = patch(true);
    this.alpha.customProgramCacheKey = () => 'sro-obj-alpha';

    // Alfa testli obje golgeleri (yaprak deliklerinden isik gecsin)
    this.alphaDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    this.alphaDepth.onBeforeCompile = (shader) => {
      shader.uniforms.tObj = tObj;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float layer;\nvarying float vLayer;\nvarying vec2 vOUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayer = layer;\nvOUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray tObj;\nvarying float vLayer;\nvarying vec2 vOUv;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (texture(tObj, vec3(vOUv, floor(vLayer + 0.5))).a < 0.5) discard;');
    };
    this.alphaDepth.customProgramCacheKey = () => 'sro-obj-alpha-depth';
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

/**
 * Bir bolgenin obje listesinden birlesik render geometrileri + carpisma geometrisi kurar.
 * list: [[model, x, y, z, yaw, uid, static], ...] (bolge-yerel Silkroad birimleri)
 */
export async function buildRegionObjects(lib, list, isCancelled) {
  // 1) modeller
  const mids = new Set();
  for (const o of list) { const mid = String(o[0]); if (!lib.skip(mid)) mids.add(mid); }
  const defs = new Map();
  await Promise.all([...mids].map(async (mid) => { const d = await lib.def(mid); if (d && d.meshes) defs.set(mid, d); }));
  if (isCancelled()) return null;

  // 2) geometriler ve dokular
  const geomPaths = new Set(), texKeys = new Set();
  for (const d of defs.values()) for (const m of d.meshes) { geomPaths.add(m.geom); if (m.texture) texKeys.add(m.texture); }
  const geoms = new Map();
  await Promise.all([...geomPaths].map(async (gp) => { const g = await lib.geom(gp); if (g) geoms.set(gp, g); }));
  if (isCancelled()) return null;
  const texSlot = new Map();
  await Promise.all([...texKeys].map(async (tk) => { texSlot.set(tk, await lib.pool.acquire(tk, lib.textureUrl(tk))); }));
  if (isCancelled()) { for (const tk of texKeys) lib.pool.release(tk); return null; }

  // 3) sayim
  const parts = [];
  const counts = { opaque: { v: 0, i: 0 }, alpha: { v: 0, i: 0 } };
  for (const o of list) {
    const d = defs.get(String(o[0]));
    if (!d) continue;
    for (const m of d.meshes) {
      const g = geoms.get(m.geom);
      if (!g || !g.index || !g.attributes.position) continue;
      const alpha = !!m.alpha || (m.texture && /\.png$/i.test(m.texture));
      const slot = m.texture ? texSlot.get(m.texture) : -1;
      const bucket = alpha ? 'alpha' : 'opaque';
      counts[bucket].v += g.attributes.position.count;
      counts[bucket].i += g.index.count;
      parts.push({ o, g, slot, bucket, color: m.color });
    }
  }

  // 4) birlestirme
  const out = { textures: texKeys, meshes: {}, collision: null, objectCount: list.length };
  const buffers = {};
  for (const b of ['opaque', 'alpha']) {
    const c = counts[b];
    if (!c.v) continue;
    buffers[b] = {
      pos: new Float32Array(c.v * 3), nor: new Float32Array(c.v * 3), uv: new Float32Array(c.v * 2),
      layer: new Uint16Array(c.v), idx: c.v > 65535 ? new Uint32Array(c.i) : new Uint16Array(c.i),
      vo: 0, io: 0,
    };
  }
  // carpisma: sadece opak parcalar
  const colPos = counts.opaque.v ? new Float32Array(counts.opaque.v * 3) : null;
  const colIdx = counts.opaque.v ? new Uint32Array(counts.opaque.i) : null;

  for (const part of parts) {
    const { o, g, slot } = part;
    const B = buffers[part.bucket];
    _p.set(o[1] * SCALE, o[2] * SCALE, -o[3] * SCALE);
    _q.setFromAxisAngle(_UP, o[4]);
    _s.set(SCALE, SCALE, SCALE);
    _m.compose(_p, _q, _s);
    const e = _m.elements;
    const P = g.attributes.position.array, N = g.attributes.normal ? g.attributes.normal.array : null;
    const U = g.attributes.uv ? g.attributes.uv.array : null;
    const vc = g.attributes.position.count, base = B.vo;
    // donus matrisi (olcek sabit) -> normaller sadece dondurulur
    const c = Math.cos(o[4]), s = Math.sin(o[4]);
    for (let k = 0; k < vc; k++) {
      const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
      const w = (base + k) * 3;
      B.pos[w] = e[0] * x + e[4] * y + e[8] * z + e[12];
      B.pos[w + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      B.pos[w + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (N) {
        const nx = N[k * 3], ny = N[k * 3 + 1], nz = N[k * 3 + 2];
        B.nor[w] = c * nx + s * nz;
        B.nor[w + 1] = ny;
        B.nor[w + 2] = -s * nx + c * nz;
      } else { B.nor[w + 1] = 1; }
      if (U) { B.uv[(base + k) * 2] = U[k * 2]; B.uv[(base + k) * 2 + 1] = U[k * 2 + 1]; }
      B.layer[base + k] = slot < 0 ? 0 : slot;
    }
    const I = g.index.array, ic = g.index.count;
    for (let k = 0; k < ic; k++) B.idx[B.io + k] = I[k] + base;
    if (part.bucket === 'opaque') {
      colPos.set(B.pos.subarray(base * 3, (base + vc) * 3), base * 3);
      for (let k = 0; k < ic; k++) colIdx[B.io + k] = I[k] + base;
    }
    B.vo += vc; B.io += ic;
  }

  for (const b of Object.keys(buffers)) {
    const B = buffers[b];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(B.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(B.nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(B.uv, 2));
    geo.setAttribute('layer', new THREE.BufferAttribute(B.layer, 1));
    geo.setIndex(new THREE.BufferAttribute(B.idx, 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    out.meshes[b] = geo;
  }
  if (colPos) {
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(colPos, 3));
    cg.setIndex(new THREE.BufferAttribute(colIdx, 1));
    out.collision = cg;
  }
  return out;
}
