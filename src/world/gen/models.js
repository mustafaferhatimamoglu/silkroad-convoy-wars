import * as THREE from 'three';
import { mulberry } from './noise.js';

// V5 obje modelleri: kodla uretilen geometri (agac, kaya, sur, kule, kapi, ev, simge yapilar).
// Her model parca listesi dondurur: { geo, tex, alpha, collide }. Dokular content/textures/ altindan
// (tex anahtari: 'build/bark', 'terrain/rock' ...). Yapi yuzeylerinde UV kutu izdusumuyle dunya
// olcegindedir (doku her ~2-4 m'de bir tekrar eder, buyuk duvarda gerilmez).

const TAU = Math.PI * 2;

/** Kutu izdusumu UV: baskin normal eksenine gore diger iki koordinat / olcek. */
export function boxUV(geo, scale = 3) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function part(geo, tex, { alpha = false, collide = true, uvScale = 0 } = {}) {
  if (!geo.index) geo = mergeIndexed(geo);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (uvScale) boxUV(geo, uvScale);
  return { geo, tex, alpha, collide };
}

function mergeIndexed(geo) {
  const n = geo.attributes.position.count;
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
function placed(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  E.set(rx, ry, rz);
  Q.setFromEuler(E);
  M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz));
  return geo.applyMatrix4(M);
}

// ------------------------------------------------------------------ bitkiler

/** Capraz yaprak kartlari: (cx,cy,cz) merkezli, w genis h yuksek, n adet duzlem. */
function cards(cx, cy, cz, w, h, n, rnd, tilt = 0) {
  const geos = [];
  for (let k = 0; k < n; k++) {
    const g = new THREE.PlaneGeometry(w, h);
    placed(g, cx, cy, cz, (rnd() - 0.5) * tilt, (k / n) * Math.PI + rnd() * 0.4, (rnd() - 0.5) * tilt);
    geos.push(g);
  }
  return mergeGeos(geos);
}

function mergeGeos(geos) {
  let vc = 0, ic = 0;
  for (const g of geos) { if (!g.index) mergeIndexed(g); vc += g.attributes.position.count; ic += g.index.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of geos) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    const I = g.index.array;
    for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo;
    vo += c; io += I.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function trunk(h, r0, r1, bend, rnd, segs = 6) {
  // egik gövde: ust uste kesik koniler
  const geos = [];
  let x = 0, z = 0, y = 0;
  const dir = rnd() * TAU;
  const n = Math.max(2, Math.round(h / 1.6));
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const seg = h / n;
    const g = new THREE.CylinderGeometry(r0 + (r1 - r0) * t1, r0 + (r1 - r0) * t0, seg, segs, 1, true);
    const dx = Math.cos(dir) * bend * (t1 * t1 - t0 * t0), dz = Math.sin(dir) * bend * (t1 * t1 - t0 * t0);
    const tiltX = Math.atan2(dz, seg), tiltZ = -Math.atan2(dx, seg);
    placed(g, x + dx / 2, y + seg / 2, z + dz / 2, tiltX, 0, tiltZ);
    geos.push(g);
    x += dx; z += dz; y += seg;
  }
  const geo = mergeGeos(geos);
  // kabuk dokusu: cevre boyunca u, yukseklik boyunca v
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.atan2(p.getZ(i), p.getX(i)) / TAU + 0.5) * 2, p.getY(i) / 2.5);
  return { geo, top: [x, y, z] };
}

const TREES = {
  palm(rnd) {
    const h = 6 + rnd() * 6;
    const t = trunk(h, 0.26, 0.19, 1.2 + rnd() * 1.8, rnd, 7);
    const fronds = [];
    const n = 9 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const L = 3.2 + rnd() * 1.4;
      const g = new THREE.PlaneGeometry(1.1, L, 1, 4);
      // kemer: uca dogru asagi kivrilan yaprak
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = (p.getY(i) + L / 2) / L;
        p.setXYZ(i, p.getX(i) * (1 - v * 0.4), v * L * 0.85, -v * v * L * 0.55);
      }
      g.computeVertexNormals();
      placed(g, t.top[0], t.top[1] - 0.1, t.top[2], 0.35 + rnd() * 0.5, (k / n) * TAU + rnd() * 0.3, 0);
      fronds.push(g);
    }
    return [part(t.geo, 'build/bark_palm'), part(mergeGeos(fronds), 'build/leaf_palm', { alpha: true, collide: false })];
  },
  broad(rnd) {
    const h = 3 + rnd() * 2.5;
    const t = trunk(h, 0.32, 0.2, 0.6, rnd, 6);
    const crown = [];
    const R = 2.4 + rnd() * 1.6;
    for (let k = 0; k < 7; k++) {
      const a = rnd() * TAU, r = rnd() * R * 0.6;
      crown.push(cards(t.top[0] + Math.cos(a) * r, t.top[1] + 0.6 + rnd() * R * 0.8, t.top[2] + Math.sin(a) * r, R * 1.2, R * 1.0, 3, rnd, 0.4));
    }
    return [part(t.geo, 'build/bark'), part(mergeGeos(crown), 'build/leaf_broad', { alpha: true, collide: false })];
  },
  cypress(rnd) {
    const h = 7 + rnd() * 5;
    const t = trunk(1.2, 0.2, 0.16, 0.05, rnd, 5);
    const crown = [];
    for (let k = 0; k < 6; k++) {
      const y = 0.8 + (k / 6) * h * 0.85;
      const w = 1.5 * Math.sin(Math.PI * (0.15 + 0.85 * (1 - k / 6)));
      crown.push(cards(0, y + 1.0, 0, w * 1.4, h * 0.32, 3, rnd, 0.1));
    }
    return [part(t.geo, 'build/bark'), part(mergeGeos(crown), 'build/leaf_broad', { alpha: true, collide: false })];
  },
  pine(rnd) {
    const h = 9 + rnd() * 7;
    const t = trunk(h * 0.9, 0.3, 0.1, 0.2, rnd, 6);
    const tiers = [];
    const n = 5;
    for (let k = 0; k < n; k++) {
      const y = h * (0.28 + 0.66 * (k / n));
      const w = (h * 0.42) * (1 - k / (n + 0.6));
      tiers.push(cards(0, y, 0, w * 2, w * 1.25, 3, rnd, 0.15));
    }
    return [part(t.geo, 'build/bark'), part(mergeGeos(tiers), 'build/leaf_pine', { alpha: true, collide: false })];
  },
  bush(rnd) {
    const R = 0.8 + rnd() * 0.9;
    return [part(cards(0, R * 0.45, 0, R * 2, R * 1.1, 3, rnd, 0.3), 'build/leaf_broad', { alpha: true, collide: false })];
  },
  tuft(rnd) {
    const R = 0.5 + rnd() * 0.4;
    return [part(cards(0, R * 0.5, 0, R * 2, R, 3, rnd, 0.2), 'build/grass_tuft', { alpha: true, collide: false })];
  },
};

// ------------------------------------------------------------------ kayalar

function rockGeo(rnd, size, flat = 0.7) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const ph = [rnd() * 10, rnd() * 10, rnd() * 10];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + 0.22 * Math.sin(x * 3.1 + ph[0]) * Math.sin(y * 2.7 + ph[1]) + 0.16 * Math.sin(z * 3.7 + ph[2] + x);
    x *= d * size; y *= d * size * flat; z *= d * size * (0.8 + rnd() * 0.0);
    p.setXYZ(i, x, Math.max(y, -size * 0.35), z);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ yapilar

const CULTURE = {
  china: { wall: 'build/stone_wall', house: 'build/plaster_white', roof: 'build/roof_green', trim: 'build/wood_lacquer', roofKind: 'hip' },
  desert: { wall: 'build/plaster_adobe', house: 'build/plaster_adobe', roof: 'build/plaster_ochre', trim: 'build/wood_planks', roofKind: 'flat' },
  persian: { wall: 'build/sandstone_blocks', house: 'build/plaster_ochre', roof: 'build/mosaic_turquoise', trim: 'build/brick_red', roofKind: 'dome' },
  byzantine: { wall: 'build/stone_wall', house: 'build/plaster_white', roof: 'build/roof_red', trim: 'build/marble', roofKind: 'gable' },
  egypt: { wall: 'build/sandstone_blocks', house: 'build/plaster_adobe', roof: 'build/plaster_adobe', trim: 'build/sandstone_blocks', roofKind: 'flat' },
};

function box(w, h, d, x = 0, y = 0, z = 0) { return placed(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z); }

/** Kirma (dort yanli) cati, Cin tarzi kalkik sacakli. */
function hipRoof(w, d, h, over = 0.9, lift = 0.5) {
  const W = w / 2 + over, D = d / 2 + over;
  const ridge = Math.max(0, W - D);
  const pos = [], idx = [];
  const v = (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; };
  const a = v(-W, lift, -D), b = v(W, lift, -D), c = v(W, lift, D), e = v(-W, lift, D);   // sacak koseleri (kalkik)
  const f = v(-ridge, h, 0), g = v(ridge, h, 0);
  // koseler kalkik: sacak ortasi alcak
  const ma = v(0, 0, -D), mc = v(0, 0, D), mb = v(W, 0, 0), me = v(-W, 0, 0);
  idx.push(a, ma, f, ma, g, f, ma, b, g);         // on
  idx.push(c, mc, g, mc, f, g, mc, e, f);         // arka
  idx.push(b, mb, g, mb, c, g);                   // sag
  idx.push(e, me, f, me, a, f);                   // sol
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const ng = geo.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

function gableRoof(w, d, h, over = 0.6) {
  const W = w / 2 + over, D = d / 2 + over;
  const shape = new THREE.Shape([new THREE.Vector2(-W, 0), new THREE.Vector2(W, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: D * 2, bevelEnabled: false });
  g.translate(0, 0, -D);
  return g;
}

function dome(r, h, segs = 14) {
  const g = new THREE.SphereGeometry(r, segs, Math.ceil(segs / 2), 0, TAU, 0, Math.PI / 2);
  g.scale(1, h / r, 1);
  return g;
}

/** Ev: govde + cati; kultur ve boyuta gore. */
function house(culture, rnd, w, d, floors) {
  const C = CULTURE[culture];
  const H = 3.2 * floors;
  const parts = [];
  const body = box(w, H, d);
  parts.push(part(body, C.house, { uvScale: 3 }));
  // kapi/pencere izlenimi: koyu girintiler (cerceve)
  const trim = [];
  trim.push(box(1.4, 2.3, 0.25, 0, 0, d / 2 + 0.05));
  for (let f = 0; f < floors; f++) for (const sx of [-w / 3, w / 3]) trim.push(box(0.9, 1.1, 0.2, sx, 1.2 + f * 3.2, d / 2 + 0.05));
  parts.push(part(mergeGeos(trim), C.trim, { collide: false, uvScale: 1.5 }));
  if (C.roofKind === 'flat') {
    const p = [box(w + 0.3, 0.5, d + 0.3, 0, H, 0)];
    // korkuluk
    p.push(box(w, 0.7, 0.3, 0, H + 0.5, d / 2), box(w, 0.7, 0.3, 0, H + 0.5, -d / 2), box(0.3, 0.7, d, w / 2, H + 0.5, 0), box(0.3, 0.7, d, -w / 2, H + 0.5, 0));
    parts.push(part(mergeGeos(p), C.roof, { uvScale: 3 }));
  } else if (C.roofKind === 'hip') {
    const r = hipRoof(w, d, Math.min(w, d) * 0.45, 1.0, 0.45);
    r.translate(0, H, 0);
    parts.push(part(r, C.roof, { uvScale: 2.5 }));
  } else if (C.roofKind === 'gable') {
    const r = gableRoof(w, d, Math.min(w, d) * 0.35);
    r.translate(0, H, 0);
    parts.push(part(r, C.roof, { uvScale: 2.5 }));
  } else if (C.roofKind === 'dome') {
    parts.push(part(box(w + 0.2, 0.4, d + 0.2, 0, H, 0), C.house, { uvScale: 3 }));
    if (rnd() < 0.5) { const dm = dome(Math.min(w, d) * 0.32, Math.min(w, d) * 0.3); dm.translate(0, H + 0.4, 0); parts.push(part(dm, C.roof, { uvScale: 1.5 })); }
  }
  return parts;
}

/** Sur parcasi (L uzunluk, -x..+x), ust kenarda mazgallar. */
function wallSeg(culture, L, H = 9, T = 3.2) {
  const C = CULTURE[culture];
  const g = [box(L, H, T)];
  const n = Math.max(2, Math.floor(L / 2.6));
  for (let k = 0; k < n; k++) g.push(box(1.3, 1.1, T * 0.35, -L / 2 + (k + 0.5) * (L / n), H, T * 0.32), box(1.3, 1.1, T * 0.35, -L / 2 + (k + 0.5) * (L / n), H, -T * 0.32));
  return [part(mergeGeos(g), C.wall, { uvScale: 3 })];
}

function tower(culture, r = 4, H = 13) {
  const C = CULTURE[culture];
  const g = new THREE.CylinderGeometry(r, r * 1.1, H, 14);
  g.translate(0, H / 2, 0);
  const parts = [part(g, C.wall, { uvScale: 3 })];
  if (culture === 'china') {
    const rf = hipRoof(r * 2, r * 2, r * 0.9, 1.2, 0.5); rf.translate(0, H, 0);
    parts.push(part(rf, C.roof, { uvScale: 2.5 }));
  } else if (culture === 'persian' || culture === 'byzantine') {
    const dm = dome(r * 0.95, r * 0.8); dm.translate(0, H, 0);
    parts.push(part(dm, culture === 'persian' ? C.roof : 'build/copper_patina', { uvScale: 2 }));
  } else {
    const cr = [];
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; cr.push(box(1.1, 1.2, 1.1, Math.cos(a) * r * 0.92, H, Math.sin(a) * r * 0.92)); }
    parts.push(part(mergeGeos(cr), C.wall, { uvScale: 3 }));
  }
  return parts;
}

/** Sehir kapisi: W genis aciklik (arac gecer, 8 m serbest yukseklik), iki burc + ust kemer. */
function gate(culture, W = 16, T = 7) {
  const C = CULTURE[culture];
  const H = 13, clear = 8.5;
  const g = [box(6, H, T, -W / 2 - 3, 0, 0), box(6, H, T, W / 2 + 3, 0, 0), box(W + 12, H - clear, T, 0, clear, 0)];
  const parts = [part(mergeGeos(g), C.wall, { uvScale: 3 })];
  if (culture === 'china') {
    const rf = hipRoof(W + 14, T + 3, 4, 1.4, 0.6); rf.translate(0, H, 0);
    parts.push(part(rf, C.roof, { uvScale: 2.5 }));
    const cols = [];
    for (const sx of [-1, 1]) cols.push(box(0.6, clear, 0.6, sx * (W / 2 - 0.5), 0, T / 2 + 0.4));
    parts.push(part(mergeGeos(cols), C.trim, { uvScale: 1.5, collide: false }));
  }
  return parts;
}

/** Sehir simge yapisi (meydan ortasi). */
function landmark(culture, rnd) {
  const C = CULTURE[culture];
  const parts = [];
  if (culture === 'china') {
    // 5 katli pagoda
    let y = 0;
    for (let k = 0; k < 5; k++) {
      const w = 14 - k * 2.2, h = 5 - k * 0.3;
      parts.push(part(box(w, h, w, 0, y, 0), C.house, { uvScale: 3 }));
      const rf = hipRoof(w, w, 2.4, 1.8, 0.8); rf.translate(0, y + h, 0);
      parts.push(part(rf, C.roof, { uvScale: 2.5 }));
      y += h + 1.4;
    }
    const sp = new THREE.ConeGeometry(0.6, 6, 8); sp.translate(0, y + 3, 0);
    parts.push(part(sp, 'build/copper_patina', { uvScale: 2 }));
  } else if (culture === 'desert') {
    // kale (ic kale): yuksek govde + kose kuleleri
    parts.push(part(box(30, 16, 30), C.wall, { uvScale: 3 }));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const p of tower('desert', 4.5, 21)) { p.geo.translate(sx * 15, 0, sz * 15); parts.push(p); }
    parts.push(part(box(34, 0.6, 34, 0, 16, 0), C.roof, { uvScale: 3 }));
  } else if (culture === 'persian') {
    parts.push(part(box(34, 14, 26), C.house, { uvScale: 3 }));
    const dm = dome(10, 11, 20); dm.translate(0, 14, 0);
    parts.push(part(dm, 'build/mosaic_blue', { uvScale: 2 }));
    for (const sx of [-1, 1]) {
      const mi = new THREE.CylinderGeometry(1.6, 1.9, 30, 12); mi.translate(sx * 20, 15, 10);
      parts.push(part(mi, 'build/mosaic_turquoise', { uvScale: 2 }));
    }
    parts.push(part(box(14, 18, 4, 0, 0, 14), 'build/mosaic_blue', { uvScale: 2 }));   // eyvan cephesi
  } else if (culture === 'byzantine') {
    parts.push(part(box(40, 16, 40), C.house, { uvScale: 3 }));
    const dm = dome(15, 12, 24); dm.translate(0, 16, 0);
    parts.push(part(dm, 'build/copper_patina', { uvScale: 2 }));
    for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const d2 = dome(6, 5); d2.translate(sx * 17, 16, sz * 17); parts.push(part(d2, 'build/copper_patina', { uvScale: 2 })); }
  } else {
    // Iskenderiye: fener kulesi + dikilitas
    parts.push(part(box(22, 14, 22), C.wall, { uvScale: 3 }));
    const t2 = new THREE.CylinderGeometry(5, 7.5, 26, 8); t2.translate(0, 27, 0);
    parts.push(part(t2, C.wall, { uvScale: 3 }));
    const t3 = new THREE.CylinderGeometry(3, 3.5, 9, 12); t3.translate(0, 44.5, 0);
    parts.push(part(t3, 'build/marble', { uvScale: 2 }));
    const ob = new THREE.CylinderGeometry(0.6, 1.2, 18, 4); ob.rotateY(Math.PI / 4); ob.translate(26, 9, 0);
    parts.push(part(ob, 'build/sandstone_blocks', { uvScale: 2 }));
  }
  void rnd;
  return parts;
}

// ------------------------------------------------------------------ ulasim

/** Iskele: yerel +X boyunca L m (0..L), 10 m genis, ust yuzey y = 0; kazik ve korkuluk. */
function pier(L) {
  const deck = box(L, 0.6, 10, L / 2, -0.6, 0);
  const piles = [];
  for (let x = 2; x < L; x += 5) for (const z of [-4.4, 4.4]) { const p = new THREE.CylinderGeometry(0.28, 0.32, 9, 8); p.translate(x, -4.8, z); piles.push(p); }
  const rails = [box(L, 0.9, 0.18, L / 2, 0, -4.9), box(L, 0.9, 0.18, L / 2, 0, 4.9)];
  const posts = [];
  for (let x = 1; x < L; x += 3) for (const z of [-4.9, 4.9]) posts.push(box(0.2, 1.0, 0.2, x, 0, z));
  return [
    part(deck, 'build/wood_planks', { uvScale: 2 }),
    part(mergeGeos(piles), 'build/bark', { uvScale: 2 }),
    part(mergeGeos([...rails, ...posts]), 'build/wood_planks', { uvScale: 2, collide: true }),
  ];
}

/** Feribot (arac gemisi): yerel +X burun, guverte ustu y = 0, 26 x 10 m. */
function ferryBoat() {
  const L = 26, W = 10;
  const hull = new THREE.BoxGeometry(L, 2.6, W);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    // alt kenarlari daralt, burun ve kici yukari kivir
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const bottom = y < 0;
    const endK = Math.abs(x) / (L / 2);
    p.setXYZ(i, x * (bottom ? 0.86 : 1), y + (bottom ? endK * endK * 1.0 : 0), z * (bottom ? 0.7 : 1));
  }
  hull.computeVertexNormals();
  hull.translate(0, -1.6, 0);
  const deck = box(L - 1, 0.3, W - 1, 0, -0.3, 0);
  const rails = [];
  // cift uclu arac gemisi: guverte iki uctan da acik, kabin yan tarafta
  const cabin = box(7, 3.2, 1.6, 0, 0, -W / 2 + 1.1);
  const roof = box(7.6, 0.3, 2.2, 0, 3.2, -W / 2 + 1.1);
  const mast = new THREE.CylinderGeometry(0.15, 0.2, 7, 6); mast.translate(0, 6.5, -W / 2 + 1.1);
  const ramp = box(0.3, 0.3, W - 2, L / 2 - 0.2, -0.1, 0);
  rails.length = 0;
  rails.push(box(L - 10, 1.0, 0.25, 0, 0, W / 2 - 0.3));
  return [
    part(hull, 'build/wood_lacquer', { uvScale: 2.5, collide: false }),
    part(mergeGeos([deck, ramp]), 'build/wood_planks', { uvScale: 2, collide: false }),
    part(mergeGeos([...rails, roof]), 'build/wood_planks', { uvScale: 2, collide: false }),
    part(cabin, 'build/plaster_white', { uvScale: 2, collide: false }),
    part(mast, 'build/bark', { uvScale: 2, collide: false }),
  ];
}

/** Isinlanma kapisi: gecis yerel X boyunca, 10 m serbest genislik, 9 m yukseklik. */
function portal(culture) {
  const C = CULTURE[culture];
  const g = [box(2.2, 9, 2.2, 0, 0, -6.1), box(2.2, 9, 2.2, 0, 0, 6.1), box(3, 1.8, 15, 0, 9, 0)];
  const base = [box(4, 0.3, 16, 0, -0.1, 0)];
  const parts = [part(mergeGeos(g), culture === 'china' ? C.trim : C.wall, { uvScale: 2 }), part(mergeGeos(base), 'build/marble', { uvScale: 2, collide: false })];
  if (culture === 'china') { const rf = hipRoof(4, 16, 2, 1.0, 0.4); rf.translate(0, 10.8, 0); parts.push(part(rf, C.roof, { uvScale: 2 })); }
  else if (culture === 'persian') { const dm = dome(1.6, 1.6); dm.translate(0, 10.8, 0); parts.push(part(dm, 'build/mosaic_turquoise', { uvScale: 1.5 })); }
  return parts;
}

// ------------------------------------------------------------------ katalog

/**
 * Model parcalari (onbellekli): kind + cesit (+ boyut parametreleri). Ayni anahtar ayni geometri.
 * Anahtar: 'palm:3', 'rock:2:1.5', 'house:china:7:12:10:2', 'wall:china:38', 'tower:desert',
 * 'gate:persian', 'landmark:egypt'
 */
const CACHE = new Map();
export function model(key) {
  let m = CACHE.get(key);
  if (m) return m;
  const a = key.split(':');
  const kind = a[0];
  const rnd = mulberry(hashStr(key));
  if (TREES[kind]) m = TREES[kind](rnd);
  else if (kind === 'rock') m = [part(rockGeo(rnd, Number(a[2] || 1.5), Number(a[3] || 0.7)), a[4] === 'red' ? 'terrain/redrock' : 'terrain/rock', { uvScale: 2.5 })];
  else if (kind === 'house') m = house(a[1], rnd, Number(a[3]), Number(a[4]), Number(a[5]));
  else if (kind === 'wall') m = wallSeg(a[1], Number(a[2]));
  else if (kind === 'tower') m = tower(a[1]);
  else if (kind === 'gate') m = gate(a[1]);
  else if (kind === 'landmark') m = landmark(a[1], rnd);
  else if (kind === 'pier') m = pier(Number(a[1]));
  else if (kind === 'ferry') m = ferryBoat();
  else if (kind === 'portal') m = portal(a[1]);
  else m = [];
  CACHE.set(key, m);
  return m;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
