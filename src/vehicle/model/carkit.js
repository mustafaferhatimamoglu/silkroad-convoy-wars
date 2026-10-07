import * as THREE from 'three';

// Prosedurel arac modelleme yardimcilari.
//  - loft(): ayni nokta sayili kesit halkalarindan yuzey; her yuz bir malzeme grubuna atanir,
//    normaller grup icinde yumusatilir (gruplar arasi sert kenar: camur yayi, cam fitili...).
//  - sweep(): bir profili 3B yol boyunca suruklemek (tampon, cita, ray).
//  - lathe(): eksen etrafinda dondurulmus profil (teker, far, jant).

/**
 * sections: Array<Array<THREE.Vector3>> (her kesit ayni uzunlukta)
 * opts.closedRing: kesit halkasi kapali mi
 * opts.classify(i, j, centroid, a, b, c, d) -> grup adi | null (null = yuz uretme)
 * opts.capStart / capEnd: ilk/son kesiti kapat (fan) -> grup adi
 * Donus: Map<grup, BufferGeometry>
 */
export function loft(sections, opts = {}) {
  const { closedRing = true, classify = () => 'main', capStart = null, capEnd = null, flip = false } = opts;
  const S = sections.length, M = sections[0].length;
  const groups = new Map();
  const getG = (name) => {
    let g = groups.get(name);
    if (!g) { g = { pos: [], map: new Map(), idx: [] }; groups.set(name, g); }
    return g;
  };
  const vid = (g, i, j, p) => {
    const key = i * 100000 + j;
    let v = g.map.get(key);
    if (v === undefined) { v = g.pos.length / 3; g.pos.push(p.x, p.y, p.z); g.map.set(key, v); }
    return v;
  };
  const cen = new THREE.Vector3();
  const segs = closedRing ? M : M - 1;
  for (let i = 0; i < S - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % M;
      const a = sections[i][j], b = sections[i][j2], c = sections[i + 1][j2], d = sections[i + 1][j];
      cen.copy(a).add(b).add(c).add(d).multiplyScalar(0.25);
      const name = classify(i, j, cen, a, b, c, d);
      if (!name) continue;
      const g = getG(name);
      const ia = vid(g, i, j, a), ib = vid(g, i, j2, b), ic = vid(g, i + 1, j2, c), id = vid(g, i + 1, j, d);
      if (flip) g.idx.push(ia, ic, ib, ia, id, ic); else g.idx.push(ia, ib, ic, ia, ic, id);
    }
  }
  const centroid = (ring) => { const c = new THREE.Vector3(); for (const p of ring) c.add(p); return c.multiplyScalar(1 / ring.length); };
  const cap = (i, name, outward) => {
    if (!name) return;
    const g = getG(name);
    const ring = sections[i];
    const c = centroid(ring);
    // fan yonunu, kapagin disa (outward) bakacagi sekilde sec
    const n = new THREE.Vector3();
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j], b = ring[(j + 1) % ring.length];
      n.x += (a.y - c.y) * (b.z - c.z) - (a.z - c.z) * (b.y - c.y);
      n.y += (a.z - c.z) * (b.x - c.x) - (a.x - c.x) * (b.z - c.z);
      n.z += (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
    }
    const reverse = n.dot(outward) < 0;
    const ci = g.pos.length / 3;
    g.pos.push(c.x, c.y, c.z);
    const base = g.pos.length / 3;
    for (const p of ring) g.pos.push(p.x, p.y, p.z);
    for (let j = 0; j < ring.length - (closedRing ? 0 : 1); j++) {
      const j2 = (j + 1) % ring.length;
      if (reverse) g.idx.push(ci, base + j2, base + j); else g.idx.push(ci, base + j, base + j2);
    }
  };
  if (capStart) cap(0, capStart, centroid(sections[0]).sub(centroid(sections[1])));
  if (capEnd) cap(S - 1, capEnd, centroid(sections[S - 1]).sub(centroid(sections[S - 2])));

  const out = new Map();
  for (const [name, g] of groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setIndex(g.idx);
    geo.computeVertexNormals();
    out.set(name, geo);
  }
  return out;
}

/**
 * Profili yol boyunca surukler. path: Vector3[]; profile: [{x, y}] (yol yerel duzleminde:
 * x = yolun sagi (yatay), y = yukari). Profil kapali kabul edilir.
 */
export function sweep(path, profile, { up = new THREE.Vector3(0, 1, 0), closed = true, caps = true, scale = null } = {}) {
  const sections = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
    T.subVectors(next, prev).normalize();
    N.crossVectors(up, T);
    if (N.lengthSq() < 1e-8) N.set(1, 0, 0);
    N.normalize();
    B.crossVectors(T, N).normalize();
    const s = scale ? scale(i / (path.length - 1)) : 1;
    sections.push(profile.map((q) => new THREE.Vector3().copy(p).addScaledVector(N, q.x * s).addScaledVector(B, q.y * s)));
  }
  const res = loft(sections, { closedRing: closed, capStart: caps ? 'main' : null, capEnd: caps ? 'main' : null });
  return res.get('main');
}

/** Yuvarlatilmis dikdortgen profil (merkez 0,0). */
export function roundRectProfile(w, h, r, segs = 3) {
  const pts = [];
  const hw = w / 2, hh = h / 2;
  r = Math.min(r, hw, hh);
  const corners = [[hw - r, hh - r, 0], [-hw + r, hh - r, Math.PI / 2], [-hw + r, -hh + r, Math.PI], [hw - r, -hh + r, Math.PI * 1.5]];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= segs; k++) {
      const a = a0 + (k / segs) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  }
  return pts;
}

/** Lathe: profil (r, y) noktalarini y ekseni etrafinda dondur, sonra eksen yonune cevir. */
export function lathe(profile, segments = 32, axis = 'y') {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  const geo = new THREE.LatheGeometry(pts, segments);
  if (axis === 'x') geo.rotateZ(-Math.PI / 2);
  else if (axis === 'z') geo.rotateX(Math.PI / 2);
  return geo;
}

export const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

/** Basit tuval dokusu olusturucu. */
export function canvasTexture(w, h, draw, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/** Yukseklik tuvalinden normal haritasi (lastik dis deseni vb.). */
export function normalMapFromHeight(w, h, heightFn, strength = 2) {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = heightFn(x / w, y / h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = data[y * w + ((x - 1 + w) % w)], r = data[y * w + ((x + 1) % w)];
      const d = data[((y - 1 + h) % h) * w + x], u = data[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      img.data[i] = (nx / len * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Geometri gruplarini birlestir (ayni malzeme icin). */
export function mergeInto(list) {
  const geos = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  if (!geos.length) return null;
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  const hasUv = geos.every((g) => g.attributes.uv);
  const uv = hasUv ? new Float32Array(count * 2) : null;
  let o = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
