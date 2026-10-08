import * as THREE from 'three';
import { model } from './models.js';

// Bolge objelerini birlestirir: opak + alfa testli iki render geometrisi ve carpisma geometrisi
// (yalniz collide parcalar: govde, kaya, yapi; yapraklar degil). Dokular obje doku dizisi havuzunda
// katman indeksiyle okunur (world/Objects.js ObjectMaterials ile ayni oznitelikler).

const PNG = /\/(leaf_|grass_tuft)/;
export const texUrl = (key, base = 'content/') => `${base}textures/${key}${PNG.test(key) ? '.png' : '.jpg'}`;

/** list: placeRegionObjects ciktisi. pool: TextureArrayPool. */
export async function buildGenObjects(pool, list, isCancelled, base = 'content/') {
  const parts = [];
  const texKeys = new Set();
  for (const o of list) {
    // o.parts: yere ozgu hazir geometri (or. tunel); yoksa model anahtari
    for (const p of o.parts || model(o.m)) { parts.push({ o, p }); texKeys.add(p.tex); }
  }
  const texSlot = new Map();
  await Promise.all([...texKeys].map(async (tk) => { texSlot.set(tk, await pool.acquire(tk, texUrl(tk, base))); }));
  if (isCancelled()) { for (const tk of texKeys) pool.release(tk); return null; }

  const counts = { opaque: { v: 0, i: 0 }, alpha: { v: 0, i: 0 } };
  const col = { v: 0, i: 0 };
  for (const { p } of parts) {
    const b = p.alpha ? 'alpha' : 'opaque';
    counts[b].v += p.geo.attributes.position.count; counts[b].i += p.geo.index.count;
    if (p.collide) { col.v += p.geo.attributes.position.count; col.i += p.geo.index.count; }
  }
  const out = { textures: texKeys, meshes: {}, collision: null, objectCount: list.length };
  const buffers = {};
  for (const b of ['opaque', 'alpha']) {
    const c = counts[b];
    if (!c.v) continue;
    buffers[b] = { pos: new Float32Array(c.v * 3), nor: new Float32Array(c.v * 3), uv: new Float32Array(c.v * 2), layer: new Uint16Array(c.v), idx: new Uint32Array(c.i), vo: 0, io: 0 };
  }
  const colPos = col.v ? new Float32Array(col.v * 3) : null;
  const colIdx = col.v ? new Uint32Array(col.i) : null;
  let cvo = 0, cio = 0;
  for (const { o, p } of parts) {
    const B = buffers[p.alpha ? 'alpha' : 'opaque'];
    const g = p.geo;
    const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null;
    const vc = g.attributes.position.count, base0 = B.vo;
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw), k = o.s || 1;
    const slot = texSlot.get(p.tex) ?? 0;
    for (let v = 0; v < vc; v++) {
      const x = P[v * 3] * k, y = P[v * 3 + 1] * k, z = P[v * 3 + 2] * k;
      const w = (base0 + v) * 3;
      B.pos[w] = c * x + s * z + o.x;
      B.pos[w + 1] = y + o.y;
      B.pos[w + 2] = -s * x + c * z + o.z;
      const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
      B.nor[w] = c * nx + s * nz; B.nor[w + 1] = ny; B.nor[w + 2] = -s * nx + c * nz;
      if (U) { B.uv[(base0 + v) * 2] = U[v * 2]; B.uv[(base0 + v) * 2 + 1] = U[v * 2 + 1]; }
      B.layer[base0 + v] = slot;
    }
    const I = g.index.array, ic = g.index.count;
    for (let q = 0; q < ic; q++) B.idx[B.io + q] = I[q] + base0;
    if (p.collide) {
      colPos.set(B.pos.subarray(base0 * 3, (base0 + vc) * 3), cvo * 3);
      for (let q = 0; q < ic; q++) colIdx[cio + q] = I[q] + cvo;
      cvo += vc; cio += ic;
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
