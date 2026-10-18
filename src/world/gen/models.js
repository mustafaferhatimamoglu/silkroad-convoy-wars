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

/** Sabit kose rengi (doku carpani). */
function tone(geo, rgb) {
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(rgb, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
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
  willow(rnd) {
    // kisa kalin govde, yukari acilan dallar; dal ucundan sarkan seyrek perde (govde gorunur kalir)
    const h = 1.9 + rnd() * 0.6;
    const t = trunk(h, 0.36, 0.24, 0.6, rnd, 7);
    const [tx, ty, tz] = t.top;
    const R = 2.8 + rnd() * 0.8;
    const wood = [t.geo];
    const crown = [], hang = [];
    const tips = [];
    const nb = 5 + Math.floor(rnd() * 2);
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * TAU + rnd() * 0.5, L = 2.6 + rnd() * 1.2, tilt = 0.55 + rnd() * 0.35;
      const g = new THREE.CylinderGeometry(0.06, 0.17, L, 5, 1, true);
      g.translate(0, L / 2, 0);
      placed(g, tx, ty - 0.15, tz, 0, -a, -tilt);
      wood.push(g);
      tips.push([tx + Math.cos(a) * Math.sin(tilt) * L, ty - 0.15 + Math.cos(tilt) * L, tz + Math.sin(a) * Math.sin(tilt) * L]);
    }
    for (const p of tips) crown.push(cards(p[0], p[1] + 0.2, p[2], R * 0.75, R * 0.45, 2, rnd, 1.0));
    // perde: her dal ucundan 3-4 kart, ucun cevresinde, asagi sarkar
    for (const p of tips) {
      const n = 5 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const a = rnd() * TAU, r = 0.3 + rnd() * 1.3;
        const top = p[1] + 0.2 + rnd() * 0.3, len = top - (1.4 + rnd() * 1.0), w = 0.7 + rnd() * 0.5;
        const g = new THREE.PlaneGeometry(w, len);
        placed(g, p[0] + Math.cos(a) * r, top - len / 2, p[2] + Math.sin(a) * r, 0, Math.PI / 2 - a + (rnd() - 0.5) * 0.8, 0);
        hang.push(g);
      }
    }
    return [part(tone(mergeGeos(wood), [0.55, 0.47, 0.42]), 'build/bark'), part(mergeGeos([...crown, ...hang]), 'build/leaf_willow', { alpha: true, collide: false })];
  },
  dead(rnd) {
    // yapraksiz kuru agac: govde + yukari acilan catal dallar
    const h = 2.5 + rnd() * 2.5;
    const t = trunk(h, 0.26, 0.14, 0.5, rnd, 6);
    const wood = [t.geo];
    const [tx, ty, tz] = t.top;
    const n = 4 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + rnd() * 0.6, L = 1.2 + rnd() * 1.8;
      const y0 = ty - rnd() * h * 0.45;
      const g = new THREE.CylinderGeometry(0.03, 0.11, L, 4, 1, true);
      g.translate(0, L / 2, 0);
      placed(g, tx, y0, tz, 0, -a, -(0.45 + rnd() * 0.6));
      wood.push(g);
      const g2 = new THREE.CylinderGeometry(0.02, 0.05, L * 0.6, 4, 1, true);
      g2.translate(0, L * 0.3, 0);
      const bx = tx + Math.cos(a) * Math.sin(0.7) * L * 0.6, by = y0 + Math.cos(0.7) * L * 0.6, bz = tz + Math.sin(a) * Math.sin(0.7) * L * 0.6;
      placed(g2, bx, by, bz, 0, -a - 0.8, -0.3);
      wood.push(g2);
    }
    return [part(mergeGeos(wood), 'build/bark')];
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

/** Ev / Konak: govde + giris portali/avlu revagi + cati; kultur ve boyuta gore. */
function house(culture, rnd, w, d, floors) {
  const C = CULTURE[culture] || CULTURE.desert;
  const H = 3.2 * floors;
  const parts = [];
  const body = box(w, H, d);
  parts.push(part(body, C.house, { uvScale: 3 }));

  // Kapi girintisi ve rustik pencere cerceveleri (bina cephesine gomulu, disari tasma yapmaz)
  const entryW = Math.min(2.0, w * 0.35);
  const trim = [];
  trim.push(box(entryW, 2.3, 0.15, 0, 0, d / 2 + 0.02));
  for (let f = 0; f < floors; f++) {
    for (const sx of [-w / 3, w / 3]) {
      trim.push(box(0.85, 1.15, 0.12, sx, 1.1 + f * 3.2, d / 2 + 0.02));
      trim.push(box(0.85, 1.15, 0.12, sx, 1.1 + f * 3.2, -d / 2 - 0.02));
    }
  }
  parts.push(part(mergeGeos(trim), C.trim, { collide: false, uvScale: 1.5 }));

  // Hotan / Col / Misir mimarisine ozgu ahsap tavan mertekleri (vigas)
  if (culture === 'desert' || culture === 'egypt') {
    const beams = [];
    for (let x = -w / 2 + 0.8; x <= w / 2 - 0.8; x += 1.4) {
      beams.push(box(0.18, 0.18, d + 0.3, x, H - 0.35, 0));
    }
    if (beams.length) parts.push(part(mergeGeos(beams), 'build/wood_planks', { uvScale: 1.2, collide: false }));
  }

  if (C.roofKind === 'flat') {
    const p = [box(w + 0.3, 0.5, d + 0.3, 0, H, 0)];
    // korkuluk (parapet)
    p.push(box(w, 0.75, 0.35, 0, H + 0.5, d / 2), box(w, 0.75, 0.35, 0, H + 0.5, -d / 2), box(0.35, 0.75, d, w / 2, H + 0.5, 0), box(0.35, 0.75, d, -w / 2, H + 0.5, 0));
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

/**
 * Sehir kapisi: L toplam genislik (iki burc + aciklik), T derinlik, H yukseklik. Aciklik arac
 * gecer (en az 4 m genis, 4.2 m serbest yukseklik).
 */
function gate(culture, L = 28, T = 7, H = 13) {
  const C = CULTURE[culture];
  const pw = Math.min(6, Math.max(1.2, L * 0.22));
  const W = Math.max(4, L - pw * 2);
  const clear = Math.min(8.5, Math.max(4.2, H * 0.62));
  const g = [box(pw, H, T, -W / 2 - pw / 2, 0, 0), box(pw, H, T, W / 2 + pw / 2, 0, 0), box(W + pw * 2, Math.max(0.6, H - clear), T, 0, clear, 0)];
  const parts = [part(mergeGeos(g), C.wall, { uvScale: 3 })];
  if (culture === 'china') {
    const rf = hipRoof(W + pw * 2 + 2, T + 3, Math.min(4, H * 0.3), 1.4, 0.6); rf.translate(0, H, 0);
    parts.push(part(rf, C.roof, { uvScale: 2.5 }));
    const cols = [];
    for (const sx of [-1, 1]) cols.push(box(0.6, clear, 0.6, sx * (W / 2 - 0.5), 0, T / 2 + 0.4));
    parts.push(part(mergeGeos(cols), C.trim, { uvScale: 1.5, collide: false }));
  }
  return parts;
}

import { massFeatures, archKind, buildingModel, spireModel, wallModel } from './arch.js';

const MASS = { data: null, avg: {}, info: new Map() };

/** Yapinin mimari turu (bir kez hesaplanir): 'rock' | 'pitched' | 'flat' | 'dome' | 'spire' | 'wall' | null. */
export function archInfo(mi, name, culture) {
  const key = `${mi}:${culture}`;
  if (name) { if (!MASS.names) MASS.names = {}; MASS.names[mi] = String(name).toLowerCase(); }
  let r = MASS.info.get(key);
  if (r !== undefined) return r.kind;
  const M = MASS.data && MASS.data.models[mi];
  const f = M ? massFeatures(M, MASS.data.palette) : null;
  r = { f, kind: f ? archKind(f, String(name).toLowerCase(), culture) : null };
  MASS.info.set(key, r);
  return r.kind;
}

function archModel(mi, culture, kind) {
  const r = MASS.info.get(`${mi}:${culture}`);
  const f = r && r.f;
  let parts = null;
  if (f) {
    if (kind === 'spire') parts = spireModel(f, culture, MASS.avg);
    else if (kind === 'wall') parts = wallModel(f, culture, MASS.avg);
    else parts = buildingModel(f, culture, kind, MASS.avg);
  }
  return parts && parts.length ? parts : massModel(mi, culture);
}
/** data: { classes, palette: [[tur, r, g, b]], models: { mi: {...} } }; avg: doku ortalama renkleri. */
export function setMassing(data, avg = {}, names = null) {
  CACHE.clear();
  MASS.data = data;
  MASS.avg = avg;
  if (names) {
    if (!MASS.names) MASS.names = {};
    if (Array.isArray(names)) names.forEach((nm, idx) => { if (nm) MASS.names[idx] = String(nm).toLowerCase(); });
    else Object.assign(MASS.names, names);
  }
}

// malzeme turu -> bizim dokumuzun gri tonlu kopyasi (desen dokudan, renk orijinal ortalamadan)
function massTex(cls, culture) {
  const C = CULTURE[culture] || CULTURE.desert;
  const g = (k) => `gray/${k.replace('/', '_')}`;
  switch (cls) {
    case 'stone': return g(culture === 'china' || culture === 'byzantine' ? 'build/stone_wall' : 'build/sandstone_blocks');
    case 'brick': return g('build/brick_red');
    case 'wood': return g('build/wood_planks');
    case 'roof': return g(C.roofKind === 'flat' || C.roofKind === 'dome' ? 'build/plaster_white' : 'build/roof_red');
    case 'metal': return g('build/plaster_white');
    case 'grass': return g('terrain/grass');
    case 'paving': return g('terrain/paving');
    case 'marble': return g('build/marble');
    case 'cloth': return g('build/canvas');
    default: return g(C.house);
  }
}
const lin = (c) => Math.pow(c / 255, 2.2);
const STEP_CLS = new Set(['stone', 'paving', 'marble', 'wood', 'brick']);
function nrmOf(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/**
 * Siluetten yapi (world/massing): model-yerel izgarada her hucre [alt, ust] dolu aralik. Ust
 * yuzeyler kose yuksekliklerinden yumusatilir (kubbe ve cati egimli, S esiginden buyuk farklarda
 * dik duvar); kemer/gecit altlari acik kalir. Her yuz orijinal malzeme turune gore bizim dokumuzla,
 * orijinal ortalama renge boyanarak cizilir (kose rengi = hedef renk / dokunun ortalamasi).
 */
function massModel(mi, culture) {
  const D = MASS.data, M = D && D.models[mi];
  if (!M) return [];
  const { res, x0, z0, nx, nz } = M;
  const rock = culture === 'rock' || culture === 'redrock';
  const steps = culture.endsWith('+steps'), soft = culture.endsWith('+soft'), wallOnly = culture.endsWith('+wall');
  if (steps || soft || wallOnly) culture = culture.slice(0, culture.lastIndexOf('+'));
  const NONE = -32768, S = rock || soft ? 3.5 : steps ? 0.08 : Math.max(1.25, res * 1.05);
  const n = nx * nz;
  const b = new Float32Array(n), t = new Float32Array(n), has = new Uint8Array(n), archFloor = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    if (M.top[k] === NONE) continue;
    const lo = M.low[k] === 32767 ? null : M.low[k] / 10;
    t[k] = M.top[k] / 10;
    // Kemer/gecit: aciklik en az 3.0 m temiz yukseklik olmali; rampa ve setlerdeki kucuk farklar basamak ve yol olarak kalir
    b[k] = lo !== null && lo > 2.6 && (t[k] - lo) >= 3.0 ? lo : -3;
    has[k] = 1;
  }
  const modelName = (MASS.names && MASS.names[mi]) || (M && M.name ? String(M.name).toLowerCase() : '');
  // Kale kapilarinda kemer altini ac: Hotan kalesi vb. kapilarinda gecit tavanini 43.5m'ye kaldirarak arac gecisini sagla
  if (mi === 1105 || /oas_hot_c1_castle/i.test(modelName)) {
    for (const [i0, i1, j0, j1] of [[81, 89, 128, 136], [81, 89, 10, 18], [138, 148, 68, 76], [20, 34, 73, 81]]) {
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * nx + i;
          if (has[k] && t[k] > 25) {
            t[k] = Math.max(t[k], 44.0);
            b[k] = 43.5;
          }
        }
      }
    }
  }
  // Jangan Saray Kapisi (1367 cj_jang_gate_dragon, 1368 cj_jang_gate) ve Guney Sur Kapisi (1302 cj_s): kemer altini ac
  if (mi === 1367 || mi === 1368 || /cj_jang_gate/i.test(modelName)) {
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const xVal = x0 + i * res;
        if (Math.abs(xVal) < 4.5 && has[k] && t[k] > 3.0) {
          b[k] = Math.max(b[k], 7.5);
        }
      }
    }
  }
  if (mi === 1302 || /^cj_s$/i.test(modelName)) {
    for (let j = 0; j < nz; j++) {
      for (let i = 141; i <= 148; i++) {
        const k = j * nx + i;
        if (has[k] && t[k] > 15) {
          b[k] = Math.max(b[k], 14.0);
        }
      }
    }
  }
  // Iskenderiye sur kapilari (854 alex_castlewall_01, 1004 alex_castlewall): kemer altini ve esik basamaklarini ac
  if (mi === 854 || /alex_castlewall_01/i.test(modelName)) {
    for (const [i0, i1, j0, j1] of [[93, 109, 0, 13], [93, 109, 76, 88], [0, 14, 76, 88]]) {
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * nx + i;
          if (!has[k]) continue;
          if (t[k] > 20) {
            t[k] = Math.max(t[k], 46.0);
            b[k] = 45.0;
          } else {
            has[k] = 0;
            t[k] = NONE;
          }
        }
      }
    }
  }
  if (mi === 1004 || /^alex_castlewall$/i.test(modelName)) {
    for (const [i0, i1, j0, j1] of [[52, 68, 283, 294], [52, 68, 325, 336]]) {
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * nx + i;
          if (!has[k]) continue;
          if (t[k] > 20) {
            t[k] = Math.max(t[k], 46.0);
            b[k] = 45.0;
          } else {
            has[k] = 0;
            t[k] = NONE;
          }
        }
      }
    }
  }
  // siluetin icindeki kuleler (minare, burc, pagoda): kale suru ve buyuk komplekslerde (1105 vb.)
  // rastgele minare/sutun basmasini onle; yalnizca gercek kule, cami, kilise veya pagodalarda kule ara
  const isGiantWall = Math.max(nx, nz) * res > 140 || /castle|wall|rampart|_sung/i.test(modelName);
  const isNormalBuilding = /house|shop|armo|weapon|etc|luxury|market|stall|inn|tavern|bank|stable|res\b|bldg|plaza|court/i.test(modelName);
  const isLegitTower = /tower|spire|minaret|pagoda|camii|mosque|church|temple|monastery/i.test(modelName);
  const towers = rock || steps || soft || isGiantWall || isNormalBuilding || !isLegitTower ? [] : findTowers(M, t, has);
  // meydan mozaigi (col/Fars/Misir): alcak, genis, duz zemin modeli
  let maxTop = 0;
  for (let k = 0; k < n; k++) if (has[k] && t[k] > maxTop) maxTop = t[k];
  const plaza = !rock && !steps && (culture === 'desert' || culture === 'persian' || culture === 'egypt') && maxTop < 2.5 && Math.max(nx, nz) * res >= 18;
  for (const T of towers) for (const c of T.cells) { t[c] = T.base; if (b[c] > T.base - 0.3) b[c] = -3; }
  // kose yukseklikleri: kosedeki hucre ustleri S esigiyle gruplanir, her grup kendi ortalamasini alir
  const corner = new Float32Array(n * 4);       // hucre basina koseler: 0 (i,j) 1 (i+1,j) 2 (i+1,j+1) 3 (i,j+1)
  // kiremit cati hucreleri: dik egim de basamak degil egik yuzey (bilesik modellerdeki catilar)
  const roofCell = new Uint8Array(n);
  if (!rock && !steps) {
    const RC = D.classes.indexOf('roof');
    for (let k = 0; k < n; k++) if (has[k] && D.palette[M.tm[k]] && D.palette[M.tm[k]][0] === RC) roofCell[k] = 1;
  }
  for (let cj = 0; cj <= nz; cj++) {
    for (let ci = 0; ci <= nx; ci++) {
      const cells = [];
      for (const [di, dj, slot] of [[-1, -1, 2], [0, -1, 3], [-1, 0, 1], [0, 0, 0]]) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const k = j * nx + i;
        if (has[k]) cells.push([t[k], k, slot]);
      }
      if (!cells.length) continue;
      cells.sort((p, q) => p[0] - q[0]);
      let g0 = 0;
      for (let g = 1; g <= cells.length; g++) {
        const SS = g < cells.length && roofCell[cells[g][1]] && roofCell[cells[g - 1][1]] ? Math.max(S, 2.6 * res) : S;
        if (g === cells.length || cells[g][0] - cells[g - 1][0] > SS) {
          let sum = 0;
          for (let x = g0; x < g; x++) sum += cells[x][0];
          const avg = sum / (g - g0);
          for (let x = g0; x < g; x++) corner[cells[x][1] * 4 + cells[x][2]] = avg;
          g0 = g;
        }
      }
    }
  }
  const pal = D.palette, classes = D.classes;
  const buckets = new Map();
  const bucket = (tex) => { let B = buckets.get(tex); if (!B) buckets.set(tex, (B = { pos: [], col: [], uv: [] })); return B; };
  // yan yuz renkleri modelin sinif ortalamasina cekilir (pencere/kapi lekeleri dikey serit yapmasin)
  const clsAvg = new Map();
  for (let k = 0; k < n; k++) {
    if (!has[k]) continue;
    const p = pal[M.sm[k]];
    if (!p) continue;
    let A = clsAvg.get(p[0]);
    if (!A) clsAvg.set(p[0], (A = [0, 0, 0, 0]));
    A[0] += lin(p[1]); A[1] += lin(p[2]); A[2] += lin(p[3]); A[3]++;
  }
  const tint = (pi, tex, side = false) => {
    const p = pal[pi] || [0, 200, 190, 170];
    const a = MASS.avg[tex] || [180, 180, 180];
    const A = side && clsAvg.get(p[0]);
    return [0, 1, 2].map((c) => {
      let v = lin(p[c + 1]);
      if (A) v = v * 0.3 + (A[c] / A[3]) * 0.7;
      return Math.min(3, Math.max(0.05, v / Math.max(0.02, lin(a[c]))));
    });
  };
  // pencereler (alfa testli kartlar): kultur turune gore
  const winTex = culture === 'china' ? 'build/win_china' : culture === 'byzantine' ? 'build/win_euro' : 'build/win_arch';
  const WIN = { pos: [], col: [], uv: [] };
  const WALLCLS = new Set(['plaster', 'stone', 'brick', 'marble', 'wood']);
  // cephe kusaklari: duz damli dis duvarin ust kenarinda kornis, dibinde koyu kaide bandi
  const quadOut = (B, a, b, c, d, nrm, col) => {
    const nn = nrmOf(a, b, c);
    const P = nn[0] * nrm[0] + nn[1] * nrm[1] + nn[2] * nrm[2] >= 0 ? [a, b, c, d] : [b, a, d, c];
    const uv = (q) => [(q[0] + q[2]) / 3, q[1] / 3];
    tri(B, [P[0], P[1], P[2]], col, [uv(P[0]), uv(P[1]), uv(P[2])]);
    tri(B, [P[0], P[2], P[3]], col, [uv(P[0]), uv(P[2]), uv(P[3])]);
  };
  const addTrim = (B, sc, p0, p1, lo, h0, h1, out) => {
    if (rock || steps || soft) return;
    const base = Math.max(lo, 0), top = Math.min(h0, h1);
    if (top - base < 2.6) return;
    const tx = (p1[0] - p0[0]) / res, tz = (p1[1] - p0[1]) / res, nx = out[0], nz = out[1];
    const at = (p, along, off, y) => [p[0] + tx * along + nx * off, y, p[1] + tz * along + nz * off];
    const up = [0, 1, 0], dn = [0, -1, 0], fw = [nx, 0, nz];
    if (Math.abs(h0 - h1) < 0.15) {
      const o = 0.22, y0 = top - 0.42, y1 = top - 0.04;
      const cc = [Math.min(3, sc[0] * 1.2), Math.min(3, sc[1] * 1.2), Math.min(3, sc[2] * 1.2)];
      quadOut(B, at(p0, -o, o, y0), at(p1, o, o, y0), at(p1, o, o, y1), at(p0, -o, o, y1), fw, cc);
      quadOut(B, at(p0, -o, 0, y1), at(p1, o, 0, y1), at(p1, o, o, y1), at(p0, -o, o, y1), up, cc);
      quadOut(B, at(p0, -o, 0, y0), at(p1, o, 0, y0), at(p1, o, o, y0), at(p0, -o, o, y0), dn, [cc[0] * 0.6, cc[1] * 0.6, cc[2] * 0.6]);
    }
    const o2 = 0.08, b1 = base + 0.65;
    const pc = [sc[0] * 0.68, sc[1] * 0.68, sc[2] * 0.66];
    quadOut(B, at(p0, -o2, o2, base - 1), at(p1, o2, o2, base - 1), at(p1, o2, o2, b1), at(p0, -o2, o2, b1), fw, pc);
    quadOut(B, at(p0, -o2, 0, b1), at(p1, o2, 0, b1), at(p1, o2, o2, b1), at(p0, -o2, o2, b1), up, pc);
  };
  const addWin = (p0, p1, lo, hi, out, idx) => {
    if (rock || steps || soft || wallOnly || idx % (res > 1 ? 2 : 3) !== 1) return;
    const base = Math.max(lo, 0), top = hi;
    if (top - base < 3.2) return;
    const mx = (p0[0] + p1[0]) / 2 + out[0] * 0.05, mz = (p0[1] + p1[1]) / 2 + out[1] * 0.05;
    const tx = (p1[0] - p0[0]) / res, tz = (p1[1] - p0[1]) / res;
    const ww = Math.min(1.1, res * 0.85) / 2, wh = culture === 'china' ? 1.1 : 1.7;
    for (let yb = base + 1.1; yb + wh <= top - 0.7; yb += 3.3) {
      const a = [mx - tx * ww, yb, mz - tz * ww], b = [mx + tx * ww, yb, mz + tz * ww], c = [b[0], yb + wh, b[2]], d = [a[0], yb + wh, a[2]];
      const nn = nrmOf(a, b, c);
      const P = nn[0] * out[0] + nn[2] * out[1] >= 0 ? [a, b, c, a, c, d] : [b, a, d, b, d, c];
      const U = nn[0] * out[0] + nn[2] * out[1] >= 0 ? [[0, 1], [1, 1], [1, 0], [0, 1], [1, 0], [0, 0]] : [[1, 1], [0, 1], [0, 0], [1, 1], [0, 0], [1, 0]];
      for (let q = 0; q < 6; q++) { WIN.pos.push(P[q][0], P[q][1], P[q][2]); WIN.col.push(1, 1, 1); WIN.uv.push(U[q][0], U[q][1]); }
    }
  };
  const tri = (B, P, col, uvs) => { for (let v = 0; v < 3; v++) { B.pos.push(P[v][0], P[v][1], P[v][2]); B.col.push(col[0], col[1], col[2]); B.uv.push(uvs[v][0], uvs[v][1]); } };
  const X = (i) => x0 + i * res, Z = (j) => z0 + j * res;
  const topUV = (p) => [p[0] / 3, p[2] / 3];
  const mosUV = (p) => [p[0] / 8, p[2] / 8];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!has[k]) continue;
      const xa = X(i), xb = X(i + 1), za = Z(j), zb = Z(j + 1);
      const c0 = corner[k * 4], c1 = corner[k * 4 + 1], c2 = corner[k * 4 + 2], c3 = corner[k * 4 + 3];
      // ust yuz
      const tp = pal[M.tm[k]] || [0];
      // meydan / avlu dosemesi (col, Fars): desenli mozaik
      const flatTop = Math.max(c0, c1, c2, c3) - Math.min(c0, c1, c2, c3) < 0.1;
      const mos = classes[tp[0]] !== 'grass' && ((plaza && t[k] < 1.6) || (flatTop && (culture === 'desert' || culture === 'persian') && !rock && !steps && !soft && (classes[tp[0]] === 'paving' || classes[tp[0]] === 'marble')));
      const ttex = rock ? `gray/terrain_${culture}` : mos ? 'build/mosaic_floor' : t[k] < 1.4 && classes[tp[0]] !== 'grass' ? 'gray/terrain_paving' : massTex(classes[tp[0]], culture);
      const tc = mos ? [0.95, 0.95, 0.95] : tint(M.tm[k], ttex);
      const TB = bucket(ttex);
      const A = [xa, c0, za], Bp = [xb, c1, za], Cp = [xb, c2, zb], Dp = [xa, c3, zb];
      // egimli tas/doseme hucresi: rampa yerine basamak (orijinal merdivenler 1 m izgarada rampaya doner)
      const gx = (c1 + c2 - c0 - c3) / 2, gz = (c2 + c3 - c0 - c1) / 2, tw = Math.abs(c0 + c2 - c1 - c3);
      const tcls = classes[tp[0]];
      const g = Math.max(Math.abs(gx), Math.abs(gz));
      if (!rock && STEP_CLS.has(tcls) && g > 0.3 * res && g < 1.6 * res && tw < 0.25 * g + 0.1 && Math.min(Math.abs(gx), Math.abs(gz)) < g * 0.35) {
        const ax = Math.abs(gx) >= Math.abs(gz);
        const lo = ax ? (gx > 0 ? (c0 + c3) / 2 : (c1 + c2) / 2) : (gz > 0 ? (c0 + c1) / 2 : (c2 + c3) / 2);
        const nS = Math.max(1, Math.round(g / 0.3)), dh = g / nS;
        // u: egim boyunca 0 (alt kenar) -> res (ust kenar); w: yanal
        const pt = (u, w, y) => (ax ? [gx > 0 ? xa + u : xb - u, y, za + w] : [xa + w, y, gz > 0 ? za + u : zb - u]);
        const up = ax ? [-Math.sign(gx), 0, 0] : [0, 0, -Math.sign(gz)];
        for (let q = 0; q < nS; q++) {
          const u0 = (q / nS) * res, u1 = ((q + 1) / nS) * res, y0 = lo + q * dh, y1 = y0 + dh;
          const r0 = pt(u0, 0, y0), r1 = pt(u0, res, y0), r2 = pt(u0, res, y1), r3 = pt(u0, 0, y1);
          const ru = (pp) => [(pp[0] + pp[2]) / 3, pp[1] / 3];
          const rc = [tc[0] * 0.72, tc[1] * 0.72, tc[2] * 0.72];
          const rn = nrmOf(r0, r1, r2);
          if (rn[0] * up[0] + rn[2] * up[2] >= 0) { tri(TB, [r0, r1, r2], rc, [ru(r0), ru(r1), ru(r2)]); tri(TB, [r0, r2, r3], rc, [ru(r0), ru(r2), ru(r3)]); }
          else { tri(TB, [r1, r0, r3], rc, [ru(r1), ru(r0), ru(r3)]); tri(TB, [r1, r3, r2], rc, [ru(r1), ru(r3), ru(r2)]); }
          const t0 = pt(u0, 0, y1), t1 = pt(u1, 0, y1), t2 = pt(u1, res, y1), t3 = pt(u0, res, y1);
          const tn = nrmOf(t0, t1, t2);
          if (tn[1] >= 0) { tri(TB, [t0, t1, t2], tc, [topUV(t0), topUV(t1), topUV(t2)]); tri(TB, [t0, t2, t3], tc, [topUV(t0), topUV(t2), topUV(t3)]); }
          else { tri(TB, [t1, t0, t3], tc, [topUV(t1), topUV(t0), topUV(t3)]); tri(TB, [t1, t3, t2], tc, [topUV(t1), topUV(t3), topUV(t2)]); }
        }
      } else {
        const U = mos ? mosUV : topUV;
        tri(TB, [Dp, Cp, Bp], tc, [U(Dp), U(Cp), U(Bp)]);
        tri(TB, [Dp, Bp, A], tc, [U(Dp), U(Bp), U(A)]);
      }
      // yan yuzler: komsu bu kenarda daha alcaksa (ya da yoksa) aradaki duvar; kemer altlari
      const sp = pal[M.sm[k]] || [0];
      const stex = rock ? `gray/terrain_${culture}` : massTex(classes[sp[0]], culture);
      const sc = tint(M.sm[k], stex, true);
      const wallOk = WALLCLS.has(classes[sp[0]]);
      const SB = bucket(stex);
      // [komsu i, j, kenar p0, p1, bizim kose h0, h1, komsunun ayni koseleri s0, s1]
      const edges = [
        [i + 1, j, [xb, zb], [xb, za], c2, c1, 3, 0],
        [i - 1, j, [xa, za], [xa, zb], c0, c3, 1, 2],
        [i, j + 1, [xa, zb], [xb, zb], c3, c2, 0, 1],
        [i, j - 1, [xb, za], [xa, za], c1, c0, 2, 3],
      ];
      for (const [ni, nj, p0, p1, h0, h1, s0, s1] of edges) {
        const inside = ni >= 0 && nj >= 0 && ni < nx && nj < nz && has[nj * nx + ni];
        let lo0 = b[k], lo1 = b[k];
        if (inside) {
          const nk = nj * nx + ni;
          const n0 = corner[nk * 4 + s0], n1 = corner[nk * 4 + s1];
          if (n0 >= h0 - 0.02 && n1 >= h1 - 0.02) lo0 = lo1 = null;
          else { lo0 = Math.max(b[k], Math.min(h0, n0)); lo1 = Math.max(b[k], Math.min(h1, n1)); }
          if (b[nk] > b[k] + 0.05) {
            const y1 = Math.min(b[nk], Math.min(h0, h1));
            const q0 = [p0[0], b[k], p0[1]], q1 = [p1[0], b[k], p1[1]], q2 = [p1[0], y1, p1[1]], q3 = [p0[0], y1, p0[1]];
            tri(SB, [q0, q1, q2], sc, [[0, b[k] / 3], [res / 3, b[k] / 3], [res / 3, y1 / 3]]);
            tri(SB, [q0, q2, q3], sc, [[0, b[k] / 3], [res / 3, y1 / 3], [0, y1 / 3]]);
          }
        }
        if (lo0 === null) continue;
        if (h0 - lo0 < 0.03 && h1 - lo1 < 0.03) continue;
        if (wallOk && !inside) {
          addWin(p0, p1, Math.max(lo0, lo1), Math.min(h0, h1), [ni - i, nj - j], ni !== i ? j : i);
          addTrim(SB, sc, p0, p1, Math.max(lo0, lo1), h0, h1, [ni - i, nj - j]);
        }
        const u0 = (p0[0] + p0[1]) / 3, u1 = u0 + res / 3;
        const q0 = [p0[0], lo0, p0[1]], q1 = [p1[0], lo1, p1[1]], q2 = [p1[0], h1, p1[1]], q3 = [p0[0], h0, p0[1]];
        tri(SB, [q0, q1, q2], sc, [[u0, lo0 / 3], [u1, lo1 / 3], [u1, h1 / 3]]);
        tri(SB, [q0, q2, q3], sc, [[u0, lo0 / 3], [u1, h1 / 3], [u0, h0 / 3]]);
      }
      if (b[k] > 0) {
        const q = [[xa, b[k], za], [xb, b[k], za], [xb, b[k], zb], [xa, b[k], zb]];
        tri(SB, [q[0], q[1], q[2]], sc, [topUV(q[0]), topUV(q[1]), topUV(q[2])]);
        tri(SB, [q[0], q[2], q[3]], sc, [topUV(q[0]), topUV(q[2]), topUV(q[3])]);
        if (archFloor && archFloor[k] > 0) {
          const fy = archFloor[k];
          const f0 = [xa, fy, za], f1 = [xb, fy, za], f2 = [xb, fy, zb], f3 = [xa, fy, zb];
          tri(TB, [f0, f2, f1], tc, [topUV(f0), topUV(f2), topUV(f1)]);
          tri(TB, [f0, f3, f2], tc, [topUV(f0), topUV(f3), topUV(f2)]);
        }
      }
    }
  }
  const parts = [];
  for (const T of towers) {
    // kule: kulture gore minare / pagoda / can kulesi; renk siluetin yan ve tepe rengi
    const sp = pal[M.sm[T.cells[0]]], tp = pal[M.tm[T.top]];
    const f = { box: { cx: T.cx, cz: T.cz, w: T.r * 2, d: T.r * 2 }, H: T.H - T.base + 1.5, wallCol: sp ? sp.slice(1) : null, roofCol: tp ? tp.slice(1) : null };
    for (const q of spireModel(f, culture, MASS.avg) || []) {
      q.geo.translate(0, T.base, 0);
      parts.push(q);
    }
  }
  if (WIN.pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(WIN.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(WIN.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(WIN.col, 3));
    const idx = new Uint32Array(WIN.pos.length / 3);
    for (let q = 0; q < idx.length; q++) idx[q] = q;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    parts.push({ geo: g, tex: winTex, alpha: true, collide: false });
  }
  for (const [tex, B] of buckets) {
    if (!B.pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    const idx = new Uint32Array(B.pos.length / 3);
    for (let q = 0; q < idx.length; q++) idx[q] = q;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    parts.push({ geo: g, tex, alpha: false, collide: true });
  }
  return parts;
}

/** Siluette kule bilesenleri: { cells, base, H, cx, cz, r, top } (model yerel). */
function findTowers(M, t, has) {
  const { nx, nz, res, x0, z0 } = M;
  const n = nx * nz;
  let maxT = 0;
  for (let k = 0; k < n; k++) if (has[k] && t[k] > maxT) maxT = t[k];
  if (maxT < 10) return [];
  const R = Math.max(2, Math.round(7 / res));
  const med = new Float32Array(n);
  const cand = new Uint8Array(n);
  const v = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!has[k] || t[k] < 10) continue;
    v.length = 0;
    for (let bb = -R; bb <= R; bb++) for (let a = -R; a <= R; a++) {
      if (Math.abs(a) + Math.abs(bb) < R * 0.7) continue;            // halka: cevre
      const ii = i + a, jj = j + bb;
      v.push(ii < 0 || jj < 0 || ii >= nx || jj >= nz || !has[jj * nx + ii] ? 0 : Math.max(0, t[jj * nx + ii]));
    }
    v.sort((p, q) => p - q);
    med[k] = v[v.length >> 1];
    if (t[k] - med[k] >= 7) cand[k] = 1;
  }
  const seen = new Uint8Array(n), out = [];
  for (let k = 0; k < n; k++) {
    if (!cand[k] || seen[k]) continue;
    const q = [k], cells = [];
    seen[k] = 1;
    while (q.length) {
      const c = q.pop();
      cells.push(c);
      const i = c % nx, j = (c / nx) | 0;
      for (const [a, bb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + bb;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = jj * nx + ii;
        if (cand[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk); }
      }
    }
    let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9, H = 0, top = cells[0], base = 0, sx = 0, sz = 0;
    for (const c of cells) {
      const i = c % nx, j = (c / nx) | 0;
      i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
      if (t[c] > H) { H = t[c]; top = c; }
      base += med[c]; sx += i; sz += j;
    }
    base /= cells.length;
    const comp = (list) => {
      let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9, hh = 0, tp = list[0], qx = 0, qz = 0;
      for (const c of list) {
        const i = c % nx, j = (c / nx) | 0;
        a0 = Math.min(a0, i); a1 = Math.max(a1, i); c0 = Math.min(c0, j); c1 = Math.max(c1, j);
        if (t[c] > hh) { hh = t[c]; tp = c; }
        qx += i; qz += j;
      }
      const w = (a1 - a0 + 1) * res, d = (c1 - c0 + 1) * res, area = list.length * res * res;
      if (w > 14 || d > 14 || area < 6 || area / (w * d) < 0.45) return null;
      return { cells: list, top: tp, H: hh, base, cx: x0 + (qx / list.length + 0.5) * res, cz: z0 + (qz / list.length + 0.5) * res, r: Math.max(1, Math.sqrt(area / Math.PI)) };
    };
    const one = comp(cells);
    if (one) { out.push(one); continue; }
    // birbirine bagli kuleler (kapi kemeriyle bitisik minare cifti): yuksek kisimlarina gore ayir
    if (H - base < 15) continue;
    void i0; void i1; void j0; void j1; void top; void sx; void sz;
    for (const f of [0.5, 0.65, 0.8]) {
      const thr = base + f * (H - base), inSet = new Set(cells.filter((c) => t[c] >= thr));
      const subs = [], done = new Set();
      for (const c0 of inSet) {
        if (done.has(c0)) continue;
        const qq = [c0], list = [];
        done.add(c0);
        while (qq.length) {
          const c = qq.pop();
          list.push(c);
          const i = c % nx, j = (c / nx) | 0;
          for (const [a, bb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const kk = (j + bb) * nx + (i + a);
            if (i + a < 0 || j + bb < 0 || i + a >= nx || j + bb >= nz) continue;
            if (inSet.has(kk) && !done.has(kk)) { done.add(kk); qq.push(kk); }
          }
        }
        subs.push(list);
      }
      const ok = subs.map(comp).filter(Boolean);
      if (ok.length && ok.length === subs.filter((l) => l.length * res * res >= 6).length) { out.push(...ok); break; }
    }
  }
  return out;
}

/** Duz blok (kaya kutlesi, sandik, araba, merdiven vb.): mat = rock | wood | stone | kultur. */
function blockModel(mat, w, d, h, rnd) {
  if (mat === 'rock') {
    const g = rockGeo(rnd, 1, 0.75);
    g.scale(w / 2, h / 1.3, d / 2);
    return [part(g, 'terrain/rock', { uvScale: 4 })];
  }
  const tex = mat === 'wood' ? 'build/wood_planks' : mat === 'stone' ? 'build/stone_wall' : (CULTURE[mat] || CULTURE.desert).house;
  return [part(box(w, h, d), tex, { uvScale: 2 })];
}

/** Kopru: L boy (yerel x), W genislik; ust yuzey y = 0, korkuluk, ayaklar, uclarda rampa. */
function bridge(culture, L, W) {
  const C = CULTURE[culture] || CULTURE.desert;
  const deck = box(L, 0.8, W, 0, -0.8, 0);
  const rails = [box(L, 1.0, 0.35, 0, 0, W / 2 - 0.18), box(L, 1.0, 0.35, 0, 0, -W / 2 + 0.18)];
  const piers = [];
  for (let x = -L / 2 + 4; x <= L / 2 - 4; x += Math.max(6, L / 5)) piers.push(box(1.4, 9, W * 0.8, x, -9.8, 0));
  // uclarda arazi farkini yumusatan rampalar
  const ramps = [];
  for (const sx of [-1, 1]) {
    const r = new THREE.BoxGeometry(6, 0.5, W);
    r.translate(sx * 3, -0.25, 0);
    r.rotateZ(sx * 0.2);
    r.translate(sx * L / 2, -0.05, 0);
    ramps.push(r);
  }
  return [
    part(mergeGeos([deck, ...ramps]), culture === 'china' ? 'build/wood_planks' : C.wall, { uvScale: 2 }),
    part(mergeGeos(rails), C.trim, { uvScale: 1.5 }),
    part(mergeGeos(piers), C.wall, { uvScale: 3 }),
  ];
}

/** Cadir: kare taban, piramit tavan; kumas. */
function tent(culture, w, d, h) {
  const wallH = Math.max(0.8, h * 0.4);
  const body = box(w * 0.92, wallH, d * 0.92);
  const top = new THREE.ConeGeometry(Math.hypot(w, d) / 2, h - wallH, 4, 1);
  top.rotateY(Math.PI / 4);
  top.scale(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
  top.translate(0, wallH + (h - wallH) / 2, 0);
  const tex = culture === 'desert' || culture === 'egypt' ? 'build/canvas' : 'build/canvas_red';
  return [part(mergeGeos([body, top]), tex, { uvScale: 2 })];
}

/** Cit: direkler ve iki yatay ray. */
function fence(L, h) {
  const g = [box(L, 0.12, 0.1, 0, h * 0.45, 0), box(L, 0.12, 0.1, 0, h * 0.85, 0)];
  const n = Math.max(2, Math.round(L / 2));
  for (let k = 0; k <= n; k++) g.push(box(0.14, h, 0.14, -L / 2 + (k * L) / n, 0, 0));
  return [part(mergeGeos(g), 'build/wood_planks', { uvScale: 1.5 })];
}

/** Fener / sokak lambasi. */
function lamp(culture, h) {
  if (culture === 'china') {
    // ahsap direk + kirmizi kagit fener
    const pole = new THREE.CylinderGeometry(0.1, 0.13, h, 8); pole.translate(0, h / 2, 0);
    const arm = box(0.9, 0.1, 0.1, 0.4, h - 0.3, 0);
    const lan = new THREE.SphereGeometry(0.32, 10, 8); lan.scale(1, 1.3, 1); lan.translate(0.8, h - 0.85, 0);
    const caps = [box(0.4, 0.08, 0.4, 0.8, h - 0.42, 0), box(0.4, 0.08, 0.4, 0.8, h - 1.32, 0)];
    return [part(tone(mergeGeos([pole, arm]), [0.5, 0.32, 0.25]), 'build/wood_planks', { uvScale: 1 }),
      part(tone(lan, [1.25, 0.6, 0.5]), 'build/canvas_red', { uvScale: 0.5, collide: false }),
      part(tone(mergeGeos(caps), [0.35, 0.3, 0.25]), 'build/wood_planks', { uvScale: 0.5, collide: false })];
  }
  // dokme demir direk + camli fener (Bizans/Avrupa; digerlerinde de)
  const pole = new THREE.CylinderGeometry(0.07, 0.12, h - 0.9, 8); pole.translate(0, (h - 0.9) / 2, 0);
  const base = new THREE.CylinderGeometry(0.22, 0.26, 0.6, 8); base.translate(0, 0.3, 0);
  const cage = new THREE.CylinderGeometry(0.32, 0.2, 0.75, 6); cage.translate(0, h - 0.5, 0);
  const cap = new THREE.ConeGeometry(0.38, 0.35, 6); cap.translate(0, h + 0.05, 0);
  const metal = tone(mergeGeos([pole, base, cap]), [0.22, 0.22, 0.24]);
  return [part(metal, 'build/plaster_white', { uvScale: 1 }), part(tone(cage, [1.3, 1.15, 0.8]), 'build/plaster_white', { uvScale: 1, collide: false })];
}

/** Bayrak diregi + bez. */
function flag(culture, h) {
  const C = CULTURE[culture] || CULTURE.desert;
  const pole = box(0.16, h, 0.16);
  const cloth = box(0.05, Math.min(2.6, h * 0.3), 1.8, 0, h * 0.68, 0.95);
  return [part(pole, C.trim, { uvScale: 1 }), part(cloth, 'build/canvas_red', { uvScale: 1, collide: false })];
}

/** Cin Zirhli General / Imparator Heykeli (Jangan). */
function chineseGeneralStatue(w, h, C) {
  const parts = [];
  const pW = Math.max(1.8, w * 0.85);
  // Basamakli anitsal kaide
  const base1 = box(pW * 1.15, h * 0.08, pW * 1.15, 0, 0, 0);
  const base2 = box(pW * 0.95, h * 0.16, pW * 0.95, 0, h * 0.08, 0);
  const baseCap = box(pW * 1.05, h * 0.05, pW * 1.05, 0, h * 0.24, 0);
  parts.push(part(mergeGeos([base1, base2, baseCap]), C.wall, { uvScale: 2 }));

  const fig = [];
  const y0 = h * 0.29, fH = h * 0.68, sW = w * 0.38;
  const legH = fH * 0.38;
  for (const sx of [-sW * 0.30, sW * 0.30]) {
    const leg = new THREE.CylinderGeometry(sW * 0.15, sW * 0.20, legH, 8);
    placed(leg, sx, y0 + legH / 2, 0);
    const boot = box(sW * 0.32, legH * 0.26, sW * 0.46, sx, y0, sW * 0.10);
    fig.push(leg, boot);
  }
  const torsoH = fH * 0.36;
  // Belden omuza dogru genisleyen zirh
  const torso = new THREE.CylinderGeometry(sW * 0.52, sW * 0.38, torsoH, 8);
  placed(torso, 0, y0 + legH + torsoH / 2, 0);
  const belt = box(sW * 0.98, torsoH * 0.16, sW * 0.78, 0, y0 + legH + torsoH * 0.18, 0);
  const shY = y0 + legH + torsoH * 0.88;
  for (const sx of [-sW * 0.58, sW * 0.58]) {
    const pld = new THREE.SphereGeometry(sW * 0.22, 8, 6);
    pld.scale(1.2, 0.9, 1.2);
    placed(pld, sx, shY, 0);
    const arm = new THREE.CylinderGeometry(sW * 0.13, sW * 0.15, fH * 0.34, 8);
    arm.rotateZ(sx > 0 ? 0.25 : -0.25);
    placed(arm, sx * 0.95, shY - fH * 0.17, 0);
    fig.push(pld, arm);
  }
  const headY = y0 + legH + torsoH + fH * 0.10;
  const head = new THREE.SphereGeometry(sW * 0.20, 10, 8);
  head.scale(0.9, 1.05, 0.95);
  placed(head, 0, headY, 0);
  const helmet = new THREE.ConeGeometry(sW * 0.25, fH * 0.18, 8);
  placed(helmet, 0, headY + fH * 0.10, 0);
  fig.push(torso, belt, head, helmet);

  // Kiliç: onunde vakur bir sekilde dik durur (kabzasi onde)
  const sword = [
    box(sW * 0.08, fH * 0.58, sW * 0.05, sW * 0.38, y0, sW * 0.28),
    box(sW * 0.28, sW * 0.07, sW * 0.10, sW * 0.38, y0 + fH * 0.48, sW * 0.28),
    box(sW * 0.07, fH * 0.15, sW * 0.07, sW * 0.38, y0 + fH * 0.56, sW * 0.28),
  ];
  fig.push(...sword);
  // Pelerin: arkada
  const cape = box(sW * 1.15, fH * 0.72, sW * 0.12, 0, y0 + fH * 0.36, -sW * 0.35);

  parts.push(part(tone(mergeGeos(fig), [0.88, 0.85, 0.80]), 'build/marble', { uvScale: 1.5 }));
  parts.push(part(tone(cape, [0.65, 0.24, 0.20]), 'build/canvas_red', { uvScale: 1.5, collide: false }));
  return parts;
}

/** Misir Heykeli: Sfenks ya da Tahtta Firavun (Iskenderiye). */
function egyptianStatue(w, h, C) {
  const parts = [];
  const pW = Math.max(1.8, w * 0.85);
  if (w > h * 0.85 || w > 5.5) {
    // Sfenks: kaide uzerinde ileriye (+z) uzanan aslan pencesi ve firavun basi
    const base = box(w * 0.95, h * 0.18, w * 1.35, 0, 0, 0);
    parts.push(part(base, 'build/sandstone_blocks', { uvScale: 2 }));
    const sph = [];
    const y0 = h * 0.18;
    // Govde: boyuna silindir, arkaya dogru uzanir
    const body = new THREE.CylinderGeometry(h * 0.32, h * 0.36, w * 0.85, 12);
    body.rotateX(Math.PI / 2);
    placed(body, 0, y0 + h * 0.28, -w * 0.08);
    const hip = new THREE.SphereGeometry(h * 0.35, 10, 8);
    hip.scale(1.1, 1.0, 1.2);
    placed(hip, 0, y0 + h * 0.30, -w * 0.48);
    // On ayaklar ileriye (+z) uzanir
    for (const sx of [-h * 0.24, h * 0.24]) {
      const paw = box(h * 0.18, h * 0.16, w * 0.48, sx, y0, w * 0.32);
      sph.push(paw);
    }
    const chest = box(h * 0.44, h * 0.38, h * 0.36, 0, y0 + h * 0.42, w * 0.18);
    // Insan basi ve firavun basligi (Nemes kulaklari ve sakali)
    const head = new THREE.SphereGeometry(h * 0.22, 12, 10);
    placed(head, 0, y0 + h * 0.68, w * 0.22);
    const nemesL = box(h * 0.11, h * 0.30, h * 0.20, -h * 0.20, y0 + h * 0.56, w * 0.20);
    const nemesR = box(h * 0.11, h * 0.30, h * 0.20, h * 0.20, y0 + h * 0.56, w * 0.20);
    const beard = box(h * 0.06, h * 0.18, h * 0.06, 0, y0 + h * 0.48, w * 0.32);
    sph.push(body, hip, chest, head, nemesL, nemesR, beard);
    // Asil col kumu ve kizil kumtasi tonu
    parts.push(part(tone(mergeGeos(sph), [0.86, 0.74, 0.56]), 'build/sandstone_blocks', { uvScale: 1.5 }));
    return parts;
  }

  // Tahtta Firavun (Enthroned Pharaoh): Abu Simbel / Luksor tarzi tahta oturmus azametli heykel
  const base = box(pW * 1.15, h * 0.10, pW * 1.35, 0, 0, 0);
  parts.push(part(base, 'build/sandstone_blocks', { uvScale: 2 }));
  const fig = [];
  const y0 = h * 0.10, fH = h * 0.85, sW = w * 0.38;
  const throneW = sW * 1.8, throneD = sW * 1.5;
  const seatH = fH * 0.38;
  // Tahtin yuksek arkaligi arkada (-z) durur
  const throneBack = box(throneW, fH * 0.95, sW * 0.28, 0, y0, -sW * 0.50);
  const throneSeat = box(throneW, seatH, throneD, 0, y0, -sW * 0.05);
  const throneSideL = box(sW * 0.22, seatH + sW * 0.25, throneD, -throneW * 0.45, y0, -sW * 0.05);
  const throneSideR = box(sW * 0.22, seatH + sW * 0.25, throneD, throneW * 0.45, y0, -sW * 0.05);

  const seatTopY = y0 + seatH;
  // Bacaklar ve dizler: tahtin onunde dik oturur (+z yonune bakar)
  for (const sx of [-sW * 0.32, sW * 0.32]) {
    // Uyluk (yatay, ileriye uzanir)
    const thigh = box(sW * 0.28, sW * 0.22, sW * 0.65, sx, seatTopY - sW * 0.11, sW * 0.25);
    // Baldirlar (dikey, asagi iner)
    const calf = box(sW * 0.26, seatH, sW * 0.28, sx, y0, sW * 0.52);
    // Ayaklar
    const foot = box(sW * 0.26, sW * 0.12, sW * 0.32, sx, y0, sW * 0.62);
    fig.push(thigh, calf, foot);
  }
  // Govde: dik ve vakur
  const torsoH = fH * 0.38;
  const torso = box(sW * 0.95, torsoH, sW * 0.50, 0, seatTopY, -sW * 0.05);
  // Kollar: eller dizlerin uzerinde durur
  for (const sx of [-sW * 0.52, sW * 0.52]) {
    const armD = box(sW * 0.16, torsoH * 0.70, sW * 0.20, sx, seatTopY + torsoH * 0.20, -sW * 0.05);
    const hand = box(sW * 0.16, sW * 0.14, sW * 0.48, sx, seatTopY, sW * 0.22);
    fig.push(armD, hand);
  }
  // Bas, Nemes basligi ve sakal
  const headY = seatTopY + torsoH + fH * 0.08;
  const head = new THREE.SphereGeometry(sW * 0.22, 12, 10);
  placed(head, 0, headY, -sW * 0.02);
  const nemesL = box(sW * 0.18, fH * 0.28, sW * 0.22, -sW * 0.26, headY - fH * 0.08, -sW * 0.02);
  const nemesR = box(sW * 0.18, fH * 0.28, sW * 0.22, sW * 0.26, headY - fH * 0.08, -sW * 0.02);
  const nemesTop = box(sW * 0.58, fH * 0.15, sW * 0.42, 0, headY + fH * 0.07, -sW * 0.02);
  const beard = box(sW * 0.10, fH * 0.18, sW * 0.10, 0, headY - fH * 0.14, sW * 0.15);
  fig.push(torso, head, nemesL, nemesR, nemesTop, beard);

  // Taht kumtasi bloklari
  const throneGeo = mergeGeos([throneBack, throneSeat, throneSideL, throneSideR]);
  parts.push(part(throneGeo, 'build/sandstone_blocks', { uvScale: 1.8 }));
  // Firavun figuru cilali koyu bazalt/granit dokusu
  const figGeo = mergeGeos(fig);
  parts.push(part(tone(figGeo, [0.34, 0.32, 0.30]), 'build/marble', { uvScale: 1.5 }));
  return parts;
}

/** Klasik Roma / Bizans Mermer Kahraman / Imparator Heykeli (Konstantiniyye, Semerkant). */
function classicalStatue(w, h, C) {
  const parts = [];
  const pW = Math.max(1.8, w * 0.85);
  const base1 = box(pW * 1.10, h * 0.09, pW * 1.10, 0, 0, 0);
  const base2 = box(pW * 0.90, h * 0.18, pW * 0.90, 0, h * 0.09, 0);
  const baseCap = box(pW * 1.02, h * 0.06, pW * 1.02, 0, h * 0.27, 0);
  parts.push(part(mergeGeos([base1, base2, baseCap]), 'build/stone_wall', { uvScale: 2 }));

  const fig = [];
  const y0 = h * 0.33, fH = h * 0.64, sW = w * 0.36;
  const legH = fH * 0.40;
  // Kontraposto durusu
  const legR = new THREE.CylinderGeometry(sW * 0.15, sW * 0.20, legH, 8);
  placed(legR, sW * 0.22, y0 + legH / 2, 0);
  const legL = new THREE.CylinderGeometry(sW * 0.15, sW * 0.18, legH * 0.96, 8);
  legL.rotateX(0.12);
  placed(legL, -sW * 0.22, y0 + legH / 2, sW * 0.10);
  const skirt = new THREE.CylinderGeometry(sW * 0.42, sW * 0.48, fH * 0.22, 8);
  placed(skirt, 0, y0 + legH * 0.8, 0);
  // Anatomik gogus ve omuzlar
  const torso = new THREE.CylinderGeometry(sW * 0.46, sW * 0.38, fH * 0.36, 8);
  placed(torso, 0, y0 + legH + fH * 0.18, 0);
  const head = new THREE.SphereGeometry(sW * 0.20, 10, 8);
  head.scale(0.92, 1.08, 0.95);
  placed(head, 0, y0 + fH * 0.90, 0);
  // Defne taci (bas uzerinde yatay halka tac)
  const crown = new THREE.TorusGeometry(sW * 0.20, sW * 0.035, 6, 16);
  crown.rotateX(Math.PI / 2);
  placed(crown, 0, y0 + fH * 0.94, 0);
  // Sag kolda mizrak (omuza bagli asagiya inen kol, elinde dik mizrak)
  const armR = new THREE.CylinderGeometry(sW * 0.11, sW * 0.14, fH * 0.36, 8);
  placed(armR, sW * 0.44, y0 + fH * 0.54, sW * 0.06, 0, 0, 0.15);
  const spear = box(sW * 0.05, fH * 1.05, sW * 0.05, sW * 0.52, y0 + fH * 0.28, sW * 0.15);
  // Sol kolda toga drapesi
  const armL = new THREE.CylinderGeometry(sW * 0.11, sW * 0.13, fH * 0.34, 8);
  placed(armL, -sW * 0.44, y0 + fH * 0.54, 0, 0, 0, -0.15);
  const drape = box(sW * 0.22, fH * 0.52, sW * 0.18, -sW * 0.48, y0 + fH * 0.32, 0);

  fig.push(legR, legL, skirt, torso, head, crown, armR, spear, armL, drape);
  const figGeo = mergeGeos(fig);
  parts.push(part(tone(figGeo, [0.95, 0.94, 0.91]), 'build/marble', { uvScale: 1.5 }));
  return parts;
}

/** Heykel: kulture gore zengin model (Cin generali, Misir sfenks/firavunu, Bizans kahramani). */
function statue(culture, w, h) {
  const C = CULTURE[culture] || CULTURE.desert;
  if (culture === 'china') return chineseGeneralStatue(w, h, C);
  if (culture === 'egypt') return egyptianStatue(w, h, C);
  return classicalStatue(w, h, C);
}

/** Misir Dikilitasi (Obelisk): kademeli kaide, keskin 4 kenarli piramidiyon, altin kaplama. */
function obelisk(culture, h = 26) {
  const base1 = box(5.4, 1.2, 5.4, 0, 0, 0);
  const base2 = box(4.4, 1.0, 4.4, 0, 1.2, 0);
  const ped = mergeGeos([base1, base2]);
  const shaftH = Math.max(8, h - 4.8);
  // Kare kesit (4 segmentli silindir, 45 derece dondurulmus)
  const shaft = new THREE.CylinderGeometry(1.15, 1.85, shaftH, 4);
  shaft.rotateY(Math.PI / 4);
  placed(shaft, 0, 2.2 + shaftH / 2, 0);
  // Piramidiyon tepelik
  const pyr = new THREE.ConeGeometry(1.63, 2.5, 4);
  pyr.rotateY(Math.PI / 4);
  placed(pyr, 0, 2.2 + shaftH + 1.25, 0);
  return [
    part(mergeGeos([ped, shaft]), 'build/sandstone_blocks', { uvScale: 2 }),
    part(tone(pyr, [1.45, 1.25, 0.45]), 'build/marble', { uvScale: 1, collide: false }),
  ];
}

/** Sehir ici havuz ve fiskiye (Semerkant, Konstantiniyye meydanlari). */
function fountain(culture, w = 9.8, h = 4.0) {
  const parts = [];
  const R = Math.max(3.2, w * 0.48);
  const rimOuter = new THREE.CylinderGeometry(R, R * 1.04, 0.75, 16);
  placed(rimOuter, 0, 0.38, 0);
  const step = new THREE.CylinderGeometry(R * 1.15, R * 1.18, 0.20, 16);
  placed(step, 0, 0.10, 0);
  parts.push(part(mergeGeos([rimOuter, step]), 'build/marble', { uvScale: 2 }));

  const waterPl = new THREE.CylinderGeometry(R * 0.86, R * 0.86, 0.06, 16);
  placed(waterPl, 0, 0.62, 0);
  const waterColor = culture === 'persian' ? [0.25, 0.75, 0.85] : [0.30, 0.70, 0.80];
  parts.push(part(tone(waterPl, waterColor), 'build/mosaic_turquoise', { uvScale: 1.5, collide: false }));

  const colBase = new THREE.CylinderGeometry(R * 0.25, R * 0.32, h * 0.35, 12);
  placed(colBase, 0, 0.35 + h * 0.175, 0);
  const bowl1 = new THREE.CylinderGeometry(R * 0.48, R * 0.20, 0.35, 16);
  placed(bowl1, 0, 0.35 + h * 0.35, 0);
  const colMid = new THREE.CylinderGeometry(R * 0.15, R * 0.22, h * 0.28, 10);
  placed(colMid, 0, 0.35 + h * 0.50, 0);
  const bowl2 = new THREE.CylinderGeometry(R * 0.26, R * 0.12, 0.25, 16);
  placed(bowl2, 0, 0.35 + h * 0.65, 0);
  const finial = new THREE.SphereGeometry(R * 0.10, 8, 8);
  placed(finial, 0, 0.35 + h * 0.82, 0);
  const fStone = mergeGeos([colBase, bowl1, colMid, bowl2, finial]);
  parts.push(part(fStone, culture === 'persian' ? 'build/mosaic_turquoise' : 'build/marble', { uvScale: 1.5 }));

  const waterSpout = new THREE.CylinderGeometry(R * 0.04, R * 0.06, h * 0.35, 8);
  placed(waterSpout, 0, 0.35 + h * 0.85 + h * 0.175, 0);
  const cascade1 = new THREE.ConeGeometry(R * 0.30, h * 0.28, 12, 1, true);
  placed(cascade1, 0, 0.35 + h * 0.50, 0);
  const cascade2 = new THREE.ConeGeometry(R * 0.52, h * 0.35, 14, 1, true);
  placed(cascade2, 0, 0.35 + h * 0.20, 0);
  const spray = mergeGeos([waterSpout, cascade1, cascade2]);
  parts.push(part(tone(spray, [0.85, 1.25, 1.45]), 'build/plaster_white', { uvScale: 1, collide: false }));
  return parts;
}

/** Selale (kayalik ve nehir dokulusu): su perdesi, kopuk tabani, islak kaya cercevesi. */
function waterfall(w = 12, h = 18) {
  const parts = [];
  const W = Math.max(5, w), H = Math.max(6, h);
  const sheets = [];
  for (const layer of [0, 0.35]) {
    const geo = new THREE.PlaneGeometry(W * (layer ? 0.92 : 1.0), H, 8, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + H / 2) / H;
      const zCurve = Math.sin(t * Math.PI) * (1.2 + layer) + (1 - t) * 1.8;
      pos.setZ(i, zCurve + layer);
    }
    geo.computeVertexNormals();
    placed(geo, 0, H / 2, 0);
    sheets.push(geo);
  }
  const apron = new THREE.CylinderGeometry(W * 0.65, W * 0.85, 0.8, 16);
  apron.scale(1, 0.4, 0.6);
  placed(apron, 0, 0.4, 1.8);
  const rocks = [];
  for (const sx of [-W / 2 - 1.2, W / 2 + 1.2]) {
    const rGeo = new THREE.IcosahedronGeometry(Math.min(5, H * 0.25), 1);
    rGeo.scale(0.8, 1.8, 1.2);
    placed(rGeo, sx, H * 0.4, 0);
    rocks.push(rGeo);
  }
  parts.push(part(tone(mergeGeos(sheets), [0.85, 1.35, 1.55]), 'build/canvas', { uvScale: 1, collide: false }));
  parts.push(part(tone(apron, [1.1, 1.4, 1.6]), 'build/plaster_white', { uvScale: 1, collide: false }));
  parts.push(part(tone(mergeGeos(rocks), [0.4, 0.42, 0.38]), 'terrain/rock', { uvScale: 2 }));
  return parts;
}

/** Bekci aslan heykeli (oturan, on pencesi top uzerinde), +z yonune bakar; boy ~2.1 m. */
function lion(rnd) {
  const g = [];
  const ell = (r, x, y, z, sx, sy, sz, w = 10, hh = 8) => { const s = new THREE.SphereGeometry(r, w, hh); s.scale(sx, sy, sz); s.translate(x, y, z); g.push(s); };
  const ped = box(1.15, 0.22, 1.75, 0, 0, 0.05);
  g.push(ped);
  ell(0.55, 0, 0.62, -0.32, 1, 0.88, 1.25);
  ell(0.52, 0, 1.10, 0.20, 0.98, 1.28, 0.88);
  ell(0.48, 0, 1.78, 0.36, 1.20, 1.08, 1.02);
  ell(0.32, 0, 1.72, 0.68, 1.02, 0.92, 1.0);
  ell(0.14, 0, 1.66, 0.94, 1.35, 0.82, 0.82);
  ell(0.12, 0, 1.52, 0.86, 1.1, 0.65, 0.95);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ell(0.13, Math.cos(a) * 0.48, 1.78 + Math.sin(a) * 0.44, 0.40 + (k % 2) * 0.08, 1, 1, 1, 6, 5);
  }
  for (const sx of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.13, 0.16, 1.0, 8);
    leg.rotateX(-0.10); leg.translate(sx * 0.26, 0.56, 0.44);
    g.push(leg);
    ell(0.18, sx * 0.26, 0.28, 0.58, 1, 0.62, 1.35);
    for (const tx of [-0.07, 0, 0.07]) ell(0.04, sx * 0.26 + tx, 0.26, 0.76, 0.7, 0.7, 1.4, 5, 4);
    ell(0.24, sx * 0.50, 0.44, -0.28, 0.62, 1.05, 1.42);
  }
  ell(0.22, 0.36, 0.34, 0.78, 1, 1, 1, 12, 10);
  const band = new THREE.TorusGeometry(0.23, 0.025, 6, 16);
  band.rotateX(0.4); placed(band, 0.36, 0.34, 0.78);
  g.push(band);
  ell(0.11, 0, 0.85, -0.88, 1, 1, 1, 6, 5);
  ell(0.14, 0, 1.10, -0.96, 1.4, 1, 1, 6, 5);
  return [part(tone(mergeGeos(g), [0.82, 0.78, 0.72]), 'build/marble', { uvScale: 1.0 })];
}

/** Park ve bahce banki: ergonomik 5 citali oturak, 4 citali arkalik, dokme demir kivrimli ayaklar ve kolcaklar. */
function bench(L = 2.2, culture = 'common') {
  const wood = [], iron = [];
  const W = Math.max(1.4, L);
  for (let k = 0; k < 5; k++) {
    const z = -0.20 + k * 0.095;
    const y = 0.44 - Math.max(0, -z - 0.12) * 0.25;
    wood.push(box(W, 0.038, 0.075, 0, y, z));
  }
  for (let k = 0; k < 4; k++) {
    const y = 0.58 + k * 0.105;
    const z = 0.22 + k * 0.035;
    const thick = k === 3 ? 0.045 : 0.032;
    const depth = k === 3 ? 0.085 : 0.07;
    wood.push(box(W, depth, thick, 0, y, z));
  }
  const legs = [-W / 2 + 0.12, W / 2 - 0.12];
  if (W >= 2.4) legs.push(0);
  for (const sx of legs) {
    const fLeg = box(0.06, 0.44, 0.07, sx, 0, -0.18);
    const bLeg = box(0.06, 0.44, 0.07, sx, 0, 0.18);
    const seatRail = box(0.06, 0.05, 0.46, sx, 0.40, 0);
    const backRail = box(0.06, 0.48, 0.05, sx, 0.45, 0.26);
    const armPost = box(0.05, 0.20, 0.05, sx, 0.44, -0.16);
    const armTop = box(0.06, 0.04, 0.40, sx, 0.63, 0.02);
    const armScroll = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8);
    armScroll.rotateZ(Math.PI / 2);
    placed(armScroll, sx, 0.62, -0.18);
    iron.push(fLeg, bLeg, seatRail, backRail, armPost, armTop, armScroll);
  }
  const stretch = new THREE.CylinderGeometry(0.022, 0.022, W - 0.2, 6);
  stretch.rotateZ(Math.PI / 2);
  placed(stretch, 0, 0.14, 0);
  iron.push(stretch);

  const woodTone = culture === 'persian' || culture === 'china' ? [0.72, 0.48, 0.32] : [0.62, 0.44, 0.30];
  const ironTone = culture === 'byzantine' ? [0.18, 0.20, 0.22] : [0.16, 0.16, 0.17];
  return [
    part(tone(mergeGeos(wood), woodTone), 'build/wood_planks', { uvScale: 1.2 }),
    part(tone(mergeGeos(iron), ironTone), 'build/stone_wall', { uvScale: 1 }),
  ];
}

/** Pazar tezgahi: tahta masa + bez gölgelik. */
function stall(culture, w, d) {
  const g = [box(w, 0.9, d * 0.6, 0, 0, -d * 0.1)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.push(box(0.1, 2.2, 0.1, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1)));
  const roof = box(w + 0.2, 0.08, d + 0.2, 0, 2.2, 0);
  return [part(mergeGeos(g), 'build/wood_planks', { uvScale: 1.5 }), part(roof, culture === 'desert' || culture === 'egypt' ? 'build/canvas' : 'build/canvas_red', { uvScale: 1.5, collide: false })];
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

/**
 * Hava gemisi iskelesi: yerel +X boyunca rampa (0 -> R, -H'den 0'a) + duz kisim (R -> R + F, y = 0),
 * kazik ayaklar, korkuluklar. Ust yuzey y = 0'da biter (gemi guvertesiyle ayni seviye).
 */
function airPier(R, F, H) {
  const ang = Math.atan2(H, R), len = Math.hypot(R, H);
  const ramp = new THREE.BoxGeometry(len, 0.5, 10);
  ramp.translate(len / 2, -0.25, 0);
  ramp.rotateZ(ang);
  ramp.translate(0, -H, 0);
  const deck = box(F, 0.6, 10, R + F / 2, -0.6, 0);
  const legs = [];
  for (let x = 3; x < R + F; x += 4) {
    const top = x < R ? -H + (x / R) * H - 0.4 : -0.6;
    const hgt = top + H + 1.5;
    if (hgt < 0.4) continue;
    for (const z of [-4.4, 4.4]) { const p = new THREE.CylinderGeometry(0.3, 0.35, hgt, 8); p.translate(x, top - hgt / 2, z); legs.push(p); }
  }
  const rails = [box(F, 1.0, 0.18, R + F / 2, 0, -4.9), box(F, 1.0, 0.18, R + F / 2, 0, 4.9)];
  for (const z of [-4.9, 4.9]) {
    const r = new THREE.BoxGeometry(len, 0.18, 0.18);
    r.translate(len / 2, 0, 0); r.rotateZ(ang); r.translate(0, -H + 1.0, z);
    rails.push(r);
  }
  // istasyon direkleri ve bayraklar
  const poles = [box(0.4, 9, 0.4, R + F - 0.5, 0, -5.4), box(0.4, 9, 0.4, R + F - 0.5, 0, 5.4)];
  const flags = [box(0.05, 1.4, 2.2, R + F - 0.5, 7.2, -6.6), box(0.05, 1.4, 2.2, R + F - 0.5, 7.2, 6.6)];
  return [
    part(mergeGeos([ramp, deck]), 'build/wood_planks', { uvScale: 2 }),
    part(mergeGeos(legs), 'build/bark', { uvScale: 2 }),
    part(mergeGeos([...rails, ...poles]), 'build/wood_lacquer', { uvScale: 2 }),
    part(mergeGeos(flags), 'build/canvas_red', { uvScale: 2, collide: false }),
  ];
}

/**
 * Roc hava gemisi govdesi: yerel +X burun, guverte ustu y = 0, 26 x 10 m guverte. Govde sigdir
 * (havada); iki direkli kosum cercevesi ve kuslara giden halatlar. Kuslar (kanat cirpar) ayri.
 */
export const ROC_SLOTS = [[3, 17, -6.5], [3, 17, 6.5]];   // kus govdelerinin yeri (gemi yerel)
function airship() {
  const L = 26, W = 10;
  const hull = new THREE.BoxGeometry(L, 1.8, W, 8, 1, 1);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const bottom = y < 0, endK = Math.abs(x) / (L / 2);
    // sivri burun/kic, alt kenarlar dar, uclar yukari kivrik
    p.setXYZ(i, x, y + (bottom ? endK * endK * 0.9 : endK * endK * 0.6), z * (bottom ? 0.55 : 1) * (1 - endK * endK * 0.45));
  }
  hull.computeVertexNormals();
  hull.translate(0, -1.0, 0);
  const deck = box(L - 2, 0.25, W - 1.4, 0, -0.25, 0);
  const prow = new THREE.ConeGeometry(0.5, 4, 6); prow.rotateZ(-Math.PI / 2.6); prow.translate(L / 2 + 0.6, 1.2, 0);
  const stern = box(0.6, 3.2, 0.6, -L / 2 + 0.6, 0, 0);
  const rails = [box(L - 8, 1.0, 0.22, 0, 0, W / 2 - 0.3), box(L - 8, 1.0, 0.22, 0, 0, -W / 2 + 0.3)];
  // kosum cercevesi: iki yan direk + ust kiris
  const frame = [box(0.5, 9, 0.5, 3, 0, -W / 2 + 0.2), box(0.5, 9, 0.5, 3, 0, W / 2 - 0.2), box(0.6, 0.6, W + 1, 3, 9, 0)];
  // halatlar: guverte koselerinden ve cerceveden kuslara
  const ropes = [];
  const rope = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    const g = new THREE.CylinderGeometry(0.07, 0.07, len, 4);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    g.applyQuaternion(q);
    g.translate(a[0], a[1], a[2]);
    ropes.push(g);
  };
  for (const [bx, by, bz] of ROC_SLOTS) {
    const s = Math.sign(bz);
    rope([-10, 0.5, s * (W / 2 - 0.4)], [bx - 1, by - 1.6, bz]);
    rope([10, 0.5, s * (W / 2 - 0.4)], [bx + 1, by - 1.6, bz]);
    rope([3, 9.3, s * (W / 2)], [bx, by - 1.6, bz]);
  }
  const sail = box(0.1, 4, W - 3, -8, 3.5, 0);
  const mast = new THREE.CylinderGeometry(0.18, 0.24, 8, 6); mast.translate(-8, 4, 0);
  return [
    part(hull, 'build/wood_lacquer', { uvScale: 2.5, collide: false }),
    part(deck, 'build/wood_planks', { uvScale: 2, collide: false }),
    part(mergeGeos([...rails, ...frame, stern]), 'build/wood_planks', { uvScale: 2, collide: false }),
    part(mergeGeos([prow, mast]), 'build/bark', { uvScale: 2, collide: false }),
    part(mergeGeos(ropes), 'build/canvas', { uvScale: 1, collide: false }),
    part(sail, 'build/canvas_red', { uvScale: 2, collide: false }),
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
  else if (culture === 'egypt') {
    // gok kuresi (armiller): kapinin ustunde capraz uc halka + ortada kure
    const rings = [];
    for (const [rx, rz] of [[Math.PI / 2, 0], [Math.PI / 2, Math.PI / 2], [0.4, 0.9]]) {
      const t = new THREE.TorusGeometry(5.2, 0.3, 8, 40); t.rotateX(rx); t.rotateZ(rz); t.translate(0, 16, 0); rings.push(t);
    }
    const core = new THREE.SphereGeometry(1.2, 14, 10); core.translate(0, 16, 0);
    parts.push(part(tone(mergeGeos(rings), [0.62, 0.48, 0.26]), 'build/marble', { uvScale: 1, collide: false }));
    parts.push(part(core, 'build/marble', { uvScale: 1, collide: false }));
  } else if (culture === 'byzantine') {
    // Atlas'in yer kuresi: lentonun ustunde kure + meridyen halkasi
    const globe = new THREE.SphereGeometry(2.2, 18, 12); globe.translate(0, 12.6, 0);
    const mer = new THREE.TorusGeometry(2.45, 0.12, 6, 32); mer.translate(0, 12.6, 0);
    parts.push(part(tone(globe, [0.55, 0.85, 0.95]), 'build/marble', { uvScale: 1, collide: false }));
    parts.push(part(tone(mer, [0.8, 0.65, 0.3]), 'build/copper_patina', { uvScale: 1, collide: false }));
  }
  return parts;
}

/** Tarihi Ipek Yolu kilometre kitabeleri / menzil tasi (Milestone). */
function milestone(culture = 'common', h = 1.4) {
  const C = CULTURE[culture] || CULTURE.desert;
  const base = box(0.72, 0.22, 0.72, 0, 0.11, 0);
  const shaftH = Math.max(0.6, h - 0.45);
  // Dikdortgen prizma veya silindirik kitabe govdesi
  const shaft = new THREE.CylinderGeometry(0.24, 0.28, shaftH, 8);
  placed(shaft, 0, 0.22 + shaftH / 2, 0);
  // Yuvarlatilmis kitabe basligi (kemerli baslik)
  const cap = new THREE.SphereGeometry(0.25, 8, 6);
  cap.scale(1.0, 0.65, 0.9);
  placed(cap, 0, 0.22 + shaftH, 0);
  // Kitabe yazit tableti (on cephede hafif cikinti)
  const plaque = box(0.26, shaftH * 0.55, 0.06, 0, 0.22 + shaftH * 0.52, 0.24);
  const stone = mergeGeos([base, shaft, cap]);
  return [
    part(stone, culture === 'china' ? 'build/stone_wall' : C.wall, { uvScale: 1 }),
    part(tone(plaque, [0.85, 0.78, 0.65]), 'build/marble', { uvScale: 0.6, collide: false }),
  ];
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
  else if (kind === 'wall') m = wallSeg(a[1], Number(a[2]), a[3] ? Number(a[3]) : 9, a[4] ? Number(a[4]) : 3.2);
  else if (kind === 'tower') m = tower(a[1], a[2] ? Number(a[2]) : 4, a[3] ? Number(a[3]) : 13);
  else if (kind === 'gate') m = gate(a[1], a[2] ? Number(a[2]) : 28, a[3] ? Number(a[3]) : 7, a[4] ? Number(a[4]) : 13);
  else if (kind === 'block') m = blockModel(a[1], Number(a[2]), Number(a[3]), Number(a[4]), rnd);
  else if (kind === 'mass') m = massModel(Number(a[1]), a[2]);
  else if (kind === 'arch') m = archModel(Number(a[1]), a[2], a[3]);
  else if (kind === 'bridge') m = bridge(a[1], Number(a[2]), Number(a[3]));
  else if (kind === 'tent') m = tent(a[1], Number(a[2]), Number(a[3]), Number(a[4]));
  else if (kind === 'fence') m = fence(Number(a[1]), Number(a[2]));
  else if (kind === 'lamp') m = lamp(a[1], Number(a[2]));
  else if (kind === 'flag') m = flag(a[1], Number(a[2]));
  else if (kind === 'statue') m = statue(a[1], Number(a[2]), Number(a[3]));
  else if (kind === 'lion') m = lion(rnd);
  else if (kind === 'bench') m = a[2] !== undefined ? bench(Number(a[2]), a[1]) : bench(Number(a[1]), 'common');
  else if (kind === 'fountain') m = fountain(a[1], Number(a[2]), Number(a[3]));
  else if (kind === 'waterfall') m = waterfall(Number(a[1]), Number(a[2]));
  else if (kind === 'obelisk') m = obelisk(a[1], Number(a[2]));
  else if (kind === 'stall') m = stall(a[1], Number(a[2]), Number(a[3]));
  else if (kind === 'landmark') m = landmark(a[1], rnd);
  else if (kind === 'pier') m = pier(Number(a[1]));
  else if (kind === 'ferry') m = ferryBoat();
  else if (kind === 'airship') m = airship();
  else if (kind === 'airpier') m = airPier(Number(a[1]), Number(a[2]), Number(a[3]));
  else if (kind === 'portal') m = portal(a[1]);
  else if (kind === 'milestone') m = milestone(a[1], a[2] ? Number(a[2]) : 1.4);
  else m = [];
  CACHE.set(key, m);
  return m;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
