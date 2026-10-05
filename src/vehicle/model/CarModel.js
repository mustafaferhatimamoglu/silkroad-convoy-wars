import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loft, lathe, mergeInto, canvasTexture, normalMapFromHeight, lerp, smooth } from './carkit.js';
import { PAINTS } from './KartalModel.js';

// Modern araclarin (pikap, SUV, station) ortak prosedurel kurucusu.
//
// Model "zemin uzayinda" kurulur: y = 0 zemin, -z ileri, +x sag; orijin kutle merkezinin zemin
// izdusumu (fizik ile ayni z). Govde Kartal'daki gibi kesit halkalarindan (loft) olusur:
//   alt govde: on yuzden kabin/arka uca kadar; camurluk yaylari, kaput tepesi, kapilar
//   ust govde (cam evi): ön cam, tavan, yan camlar ve direkler, arka cam
//   pikaplarda ayri kasa (yan duvarlar, taban, menteseli bagaj kapagi)
// Kaput, dort kapi (cam ve cerceveleriyle) ve bagaj kapagi kendi mentese noktasinda duran ayri
// gruplardir (hasar sisteminde acilir, ezilir, kopar). On/arka tasarim ve ayrintilar modele
// ozel spesifikasyon dosyalarindadir (specs/).

export function mesh(geo, mat, cast = true) {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = cast; o.receiveShadow = true;
  return o;
}
export const box = (w, h, d, r = 0.01, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);

// ---------------------------------------------------------------- malzemeler
/**
 * Kirlenebilen boya. vGround = zemin uzayi konumu (parcalarda mentese ofseti eklenir);
 * kir alttan yukari azalan gurultulu bir tabakadir ve cilayi matlastirir.
 */
function paintMaterial(p, dirt, offset) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: p.color, metalness: p.metal || 0.0, roughness: p.metal ? 0.38 : 0.32,
    clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.0,
  });
  const uOffset = { value: offset.clone() };
  mat.userData.offset = uOffset;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, dirt);
    shader.uniforms.uOffset = uOffset;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGround;\nuniform vec3 uOffset;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position + uOffset;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGround;
uniform float uDirt;
uniform vec3 uDirtColor;
float dHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float dNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dHash(i), dHash(i + vec2(1, 0)), u.x), mix(dHash(i + vec2(0, 1)), dHash(i + vec2(1, 1)), u.x), u.y); }
float dirtMask() {
  float h = smoothstep(1.2, 0.3, vGround.y);
  float n = dNoise(vGround.xz * 9.0 + vGround.y * 3.0) * 0.6 + dNoise(vGround.zy * 23.0) * 0.4;
  return clamp(uDirt * (h * 1.3 + 0.12) * (0.55 + 0.7 * n), 0.0, 0.92);
}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat dm = dirtMask();\ndiffuseColor.rgb = mix(diffuseColor.rgb, uDirtColor, dm);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, dm);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - dm * 0.95;\n#endif');
  };
  mat.customProgramCacheKey = () => 'car-paint-dirt';
  return mat;
}

export function makeMaterials(paintId) {
  const p = PAINTS[paintId] || PAINTS.beyaz;
  const m = {};
  const dirt = { uDirt: { value: 0 }, uDirtColor: { value: new THREE.Color(0.62, 0.52, 0.38) } };
  m.dirt = dirt;
  m.paint = paintMaterial(p, dirt, new THREE.Vector3());
  m.paints = [m.paint];
  /** Bir mentese parcasi icin boya kopyasi (kir deseni parca ile birlikte kalir). */
  m.paintFor = (offset) => {
    const x = paintMaterial(p, dirt, offset);
    x.color.copy(m.paint.color); x.metalness = m.paint.metalness; x.roughness = m.paint.roughness;
    m.paints.push(x);
    return x;
  };
  m.chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, metalness: 1.0, roughness: 0.07, envMapIntensity: 1.4 });
  m.darkChrome = new THREE.MeshPhysicalMaterial({ color: 0x5a5d61, metalness: 1.0, roughness: 0.18, envMapIntensity: 1.3 });
  m.satin = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.85, roughness: 0.32 });
  m.black = new THREE.MeshStandardMaterial({ color: 0x111213, roughness: 0.6 });
  m.blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x08090a, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  m.plastic = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.82 });
  m.rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.88 });
  m.seam = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 });
  m.well = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.95 });
  m.under = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.95 });
  m.frame = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.75, metalness: 0.2 });
  m.glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a1214, metalness: 0.0, roughness: 0.02, transparent: true, opacity: 0.5,
    envMapIntensity: 2.0, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.0,
  });
  m.privacy = m.glass.clone(); m.privacy.opacity = 0.82; m.privacy.color.set(0x050708);
  m.liner = new THREE.MeshStandardMaterial({ color: 0x8e8a83, roughness: 1.0 });
  m.interior = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.8 });
  m.seat = new THREE.MeshStandardMaterial({ color: 0x1f1f20, roughness: 0.92 });
  m.dash = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7 });
  const cabinAO = { value: 0.3 };
  for (const k of ['liner', 'interior', 'seat', 'dash']) {
    m[k].onBeforeCompile = (shader) => {
      shader.uniforms.uCabinAO = cabinAO;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uCabinAO;')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= uCabinAO;\nreflectedLight.indirectSpecular *= uCabinAO;');
    };
    m[k].customProgramCacheKey = () => 'car-cabin';
  }
  m.alloy = new THREE.MeshPhysicalMaterial({ color: 0xc4c7ca, metalness: 0.9, roughness: 0.28, clearcoat: 0.6 });
  m.alloyDark = new THREE.MeshPhysicalMaterial({ color: 0x3b3e42, metalness: 0.8, roughness: 0.35, clearcoat: 0.6 });
  m.brake = new THREE.MeshStandardMaterial({ color: 0x55585b, metalness: 0.7, roughness: 0.5 });
  m.mirror = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.03 });
  m.headLens = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.22, clearcoat: 1, envMapIntensity: 1.6,
    emissive: 0xfff2d8, emissiveIntensity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  m.reflector = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.2, emissive: 0xfff3dc, emissiveIntensity: 0, side: THREE.DoubleSide });
  m.lampBody = new THREE.MeshStandardMaterial({ color: 0x16181a, metalness: 0.4, roughness: 0.45 });
  m.drl = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, emissive: 0xeaf0ff, emissiveIntensity: 1.6, roughness: 0.3 });
  m.tail = new THREE.MeshPhysicalMaterial({ color: 0x7a0606, roughness: 0.2, emissive: 0xff1508, emissiveIntensity: 0.25, clearcoat: 1 });
  m.amber = new THREE.MeshPhysicalMaterial({ color: 0xc66a00, roughness: 0.25, emissive: 0xff8a00, emissiveIntensity: 0.0, clearcoat: 1 });
  m.reverse = new THREE.MeshPhysicalMaterial({ color: 0xdedede, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.0, clearcoat: 1 });
  m.plate = new THREE.MeshStandardMaterial({ map: plateTexture('34 SR 2026'), roughness: 0.5 });
  return m;
}

export function plateTexture(text) {
  return canvasTexture(256, 56, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1440a8'; ctx.fillRect(0, 0, 26, h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.fillText('TR', 13, h - 9);
    ctx.fillStyle = '#111'; ctx.font = 'bold 34px Arial'; ctx.textBaseline = 'middle'; ctx.fillText(text, 141, h / 2 + 2);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
}

/** Yazi/rozet dokusu (alfa). */
export function textTexture(text, { w = 512, h = 96, font = 'bold 64px Arial', color = '#e9e9e9', spacing = 0 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (spacing) { try { ctx.letterSpacing = `${spacing}px`; } catch (e) { /* eski tarayici */ } }
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

/** Petek/kafes izgara dokusu (alfa testli). */
export function honeycombTexture({ cell = 18, line = 4, color = '#2b2c2e', w = 512, h = 256 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = line;
    const r = cell / 2, dx = r * Math.sqrt(3);
    for (let row = -1, y = 0; y < h + cell; row++, y += r * 1.5) {
      for (let x = (row & 1) * dx / 2 - dx; x < w + dx; x += dx) {
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; const px = x + r * Math.cos(a), py = y + r * Math.sin(a); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
    }
  }, { repeat: true });
}

// ---------------------------------------------------------------- yardimcilar
/** (x, y) noktalarindan THREE.Shape. */
export function shapeFrom(pts, holes = []) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return sh;
}
/** Seklin one bakan (-z) kabartmasi: on yuz z0'da, depth kadar govdeye (+z) dogru. */
export function extrudeFront(shape, z0, depth, bevel = 0.006) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, z0 + bevel);
  return g;
}
/** Teker yayi egrisi (supergelips) boyunca noktalar: yay disina offset kadar. */
export function archPath(S, ax, offset, x, n = 28) {
  const pts = [];
  const R = S.archR + offset;
  for (let k = 0; k <= n; k++) {
    const t = -1 + (2 * k) / n;
    const y = S.archCY + R * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), S.archP)), 1 / S.archP);
    pts.push(new THREE.Vector3(x, y, ax + t * R));
  }
  return pts;
}
export { lerp, smooth };

function stations(a, b, step, extra = []) {
  const s = new Set();
  for (let z = a; z <= b + 1e-6; z += step) s.add(+z.toFixed(4));
  s.add(+b.toFixed(4));
  for (const e of extra) if (e >= a && e <= b) s.add(+e.toFixed(4));
  return [...s].sort((x, y) => x - y);
}

function archTop(S, z, axles) {
  let best = -Infinity;
  for (const ax of axles) {
    const dz = Math.abs(z - ax);
    if (dz < S.archR) best = Math.max(best, S.archCY + S.archR * Math.pow(1 - Math.pow(dz / S.archR, S.archP), 1 / S.archP));
  }
  return best;
}

/** Ust yuzey noktalari: omuzdan ortaya; ozel x degerleri (kaput kenari dikisi) eklenir. */
function topXs(ax, specials) {
  const xs = new Set();
  for (let k = 0; k <= 9; k++) xs.add(+(ax * (1 - k / 9)).toFixed(4));
  for (const s of specials) if (s > 0.01 && s < ax - 0.01) xs.add(+s.toFixed(4));
  return [...xs].sort((a, b) => b - a);
}

// ---------------------------------------------------------------- alt govde
function lowerSection(S, z, axles) {
  const a = S.halfW(z), yt = S.yTop(z), yb = S.yBot(z);
  const rt = S.rt, rb = S.rb, WELL = S.well;
  const half = [];
  for (let k = 0; k <= 3; k++) half.push({ x: ((a - rb) * k) / 3, y: yb, part: 'bottom' });
  for (let k = 1; k <= 4; k++) { const an = -Math.PI / 2 + (k / 4) * (Math.PI / 2); half.push({ x: a - rb + rb * Math.cos(an), y: yb + rb + rb * Math.sin(an), part: 'bcorner' }); }
  const at = archTop(S, z, axles);
  const inArch = at > yb + rb + 0.002;
  const ySplit = inArch ? Math.min(at, yt - rt - 0.05) : lerp(yb + rb, yt - rt, 0.4);
  const sideX = (y) => a + S.sideShape(y, z);
  if (inArch) {
    for (const p of half) if (p.part === 'bcorner' || (p.part === 'bottom' && p.x > a - WELL)) { p.x = Math.min(p.x, a - WELL); p.inner = true; }
  }
  // kapi alt dikisi icin sabit yukseklikler
  const lowYs = [];
  for (let k = 1; k <= 8; k++) lowYs.push(lerp(yb + rb, ySplit, k / 8));
  const upYs = [];
  for (let k = 0; k <= 9; k++) upYs.push(lerp(ySplit, yt - rt, k / 9));
  const db = S.doorBottom;
  if (!inArch && db > yb + rb + 0.02 && db < yt - rt - 0.02) {
    const arr = db < ySplit ? lowYs : upYs;
    arr.push(db - 0.006, db + 0.006);
    arr.sort((p, q) => p - q);
  }
  for (const y of lowYs) half.push({ x: inArch ? a - WELL : sideX(y), y, part: 'side', inner: inArch });
  upYs.forEach((y, k) => half.push({ x: sideX(y), y: k === 0 && inArch ? ySplit + 0.0005 : y, part: 'side' }));
  const ax = sideX(yt - rt) - rt;
  for (let k = 1; k <= 5; k++) { const an = (k / 5) * (Math.PI / 2); half.push({ x: ax + rt * Math.cos(an), y: yt - rt + rt * Math.sin(an), part: 'tcorner' }); }
  const xs = topXs(ax, S.hoodHalf ? [S.hoodHalf - 0.006, S.hoodHalf + 0.006] : []);
  for (const x of xs.slice(1)) half.push({ x, y: yt + S.crown(x, z, ax), part: 'top' });
  const ring = [];
  for (const p of half) ring.push({ ...p, side: 1 });
  for (let k = half.length - 2; k >= 1; k--) { const p = half[k]; ring.push({ ...p, x: -p.x, side: -1 }); }
  return ring.map((p) => Object.assign(new THREE.Vector3(p.x, p.y, z), { part: p.part, inner: !!p.inner }));
}

// ---------------------------------------------------------------- cam evi
function greenSection(S, z) {
  const yb = S.yTop(z);
  const yr = Math.max(S.yRoof(z), yb + 0.0005);
  const wB = S.halfW(z) + S.sideShape(yb, z) - S.glassInset, wT = S.roofW(z);
  const rc = Math.min(S.roofR, (yr - yb) * 0.45);
  const yWT = yr - S.winTopDrop;
  const ys = [yb, yb + 0.02, yb + 0.034];
  for (let k = 1; k <= 7; k++) ys.push(lerp(yb + 0.034, yWT - 0.012, k / 8));
  ys.push(yWT - 0.012, yWT, lerp(yWT, yr - rc, 0.5), yr - rc);
  for (let k = 1; k < ys.length; k++) ys[k] = Math.min(Math.max(ys[k], ys[k - 1]), yr - rc);
  const half = [];
  const xAt = (y) => lerp(wB, wT, (y - yb) / Math.max(yr - rc - yb, 1e-4));
  for (const y of ys) half.push({ x: xAt(y), y });
  const cx = wT - rc;
  for (let k = 1; k <= 5; k++) { const an = (k / 5) * (Math.PI / 2); half.push({ x: cx + rc * Math.cos(an), y: yr - rc + rc * Math.sin(an) }); }
  for (let k = 1; k <= 9; k++) { const x = cx * (1 - k / 9); half.push({ x, y: yr + S.roofCrown * (1 - (x / Math.max(cx, 0.01)) ** 2) }); }
  const ring = [];
  for (const p of half) ring.push(new THREE.Vector3(p.x, p.y, z));
  for (let k = half.length - 2; k >= 0; k--) { const p = half[k]; ring.push(new THREE.Vector3(-p.x, p.y, z)); }
  return { ring, yb, yr, yWT, wT, rc };
}

// ---------------------------------------------------------------- ana sinif
export class CarModel {
  /**
   * spec: specs/ altindaki bir arac tanimi (olculer, profil fonksiyonlari, on/arka kurucular).
   */
  constructor(spec, { paint = 'beyaz' } = {}) {
    const S = (this.spec = spec);
    this.variant = S.id;
    this.root = new THREE.Group();
    this.root.name = S.name;
    this.body = new THREE.Group();
    this.root.add(this.body);
    const m = (this.mats = makeMaterials(paint));
    if (S.materials) S.materials(m);
    this.headLamps = [];
    this.tails = { tail: [m.tail], amber: [m.amber], reverse: [m.reverse] };
    this.parts = {};
    const ctx = { S, m, body: this.body, model: this, lamps: this.headLamps, tails: this.tails, add: (o) => this.body.add(o) };

    this._buildShell(ctx);
    if (S.bed) this._buildBed(ctx);
    if (S.front) S.front(ctx);
    if (S.rear) S.rear(ctx);
    if (S.details) S.details(ctx);
    this._buildUnder(ctx);
    const parts = this._buildInterior(ctx);
    this.steeringWheel = parts.steeringWheel;
    this.gauges = parts.gauges;
    // tekerlekler (fizik konumlandirir)
    const tires = tireTexture(S.tread || 'at');
    this.wheels = [];
    for (const s of [-1, 1, -1, 1]) {
      const w = buildWheel(S, m, s, tires);
      this.root.add(w.group);
      this.wheels.push(w);
    }
    // far spotlari
    this.spots = [];
    for (const s of [-1, 1]) {
      const sp = new THREE.SpotLight(0xf2f6ff, 0, 80, 0.45, 0.5, 1.5);
      sp.position.set(s * S.spot.x, S.spot.y, S.zF + 0.1);
      sp.target.position.set(s * (S.spot.x + 0.25), 0.0, S.zF - 25);
      sp.castShadow = false;
      this.body.add(sp, sp.target);
      this.spots.push(sp);
    }
    this.cam = S.cam;
    this.optimize();
    this.prepareDamage();
  }

  /** Bir parca grubu (kapi, kaput...) olustur; geometriler mentese noktasina gore yerlesir. */
  part(name, pivot, info = {}) {
    let p = this.parts[name];
    if (!p) {
      const g = new THREE.Group();
      g.name = name;
      g.position.copy(pivot);
      g.userData.part = name;
      this.body.add(g);
      p = this.parts[name] = { name, group: g, pivot: pivot.clone(), ...info };
    }
    return p;
  }

  /** Geometriyi (zemin uzayinda) bir parcaya ekle. */
  addToPart(name, geo, mat, cast = true) {
    const p = this.parts[name];
    if (mat === this.mats.paint) mat = p.paint || (p.paint = this.mats.paintFor(p.pivot));
    const g = geo.clone();
    g.translate(-p.pivot.x, -p.pivot.y, -p.pivot.z);
    const o = mesh(g, mat, cast);
    p.group.add(o);
    return o;
  }

  _partPivots(S) {
    const pv = {};
    // kaput: arka kenar (on cam dibi) menteseli, yatay eksen
    pv.hood = { pivot: new THREE.Vector3(0, S.yTop(S.zWS0 - 0.04) + 0.01, S.zWS0 - 0.04), axis: 'x', open: -1 };
    // kapilar: on kenar menteseli, dikey eksen
    S.doors.forEach((d, k) => {
      for (const side of [-1, 1]) {
        const idx = k * 2 + (side > 0 ? 1 : 0);
        const x = side * (S.halfW(d.z0) + S.sideShape(S.yTop(d.z0) - 0.2, d.z0) - 0.01);
        pv[`door${idx}`] = { pivot: new THREE.Vector3(x, (S.doorBottom + S.yTop(d.z0)) / 2, d.z0), axis: 'y', open: side };
      }
    });
    return pv;
  }

  _buildShell(ctx) {
    const { S, m } = ctx;
    const pv = this._partPivots(S);
    for (const [name, v] of Object.entries(pv)) this.part(name, v.pivot, { axis: v.axis, open: v.open });
    const axles = S.axles;
    // ----- alt govde
    const arch = [];
    for (const ax of axles) for (let k = -S.archR; k <= S.archR + 1e-6; k += 0.025) arch.push(ax + k);
    const seams = [];
    for (const d of S.doors) seams.push(d.z0 - 0.006, d.z0 + 0.006, d.z1 - 0.006, d.z1 + 0.006);
    const zs = stations(S.zN, S.zEnd, 0.06, [...arch, ...axles.flatMap((a) => [a - S.archR, a + S.archR]), S.zWS0, S.zWS0 - 0.012,
      S.hoodZ0, S.hoodZ0 + 0.012, ...seams, S.zN + 0.012, S.zN + 0.04, S.zN + 0.1, S.zEnd - 0.012, S.zEnd - 0.04, S.zEnd - 0.1]);
    const secs = zs.map((z) => lowerSection(S, z, axles));
    const doorOf = (c) => {
      if (c.y < S.doorBottom - 0.007 || c.z < S.zWS0 - 0.1) return null;
      for (let k = 0; k < S.doors.length; k++) {
        const d = S.doors[k];
        if (c.z > d.z0 - 0.007 && c.z < d.z1 + 0.007) {
          if (Math.abs(c.z - d.z0) < 0.0065 || Math.abs(c.z - d.z1) < 0.0065 || Math.abs(c.y - S.doorBottom) < 0.0065) return 'seam';
          return `door${k * 2 + (c.x > 0 ? 1 : 0)}`;
        }
      }
      return null;
    };
    const nrm = new THREE.Vector3(), q1 = new THREE.Vector3(), q2 = new THREE.Vector3();
    const lower = loft(secs, {
      closedRing: true,
      capStart: 'paint', capEnd: S.bed ? 'paint' : null,
      classify: (i, j, c, a, b, cc, d) => {
        if (a.inner || b.inner || cc.inner || d.inner) return 'well';
        if (a.part === 'bottom' && b.part === 'bottom') return 'under';
        const top = a.part === 'top' && b.part === 'top';
        if (top) {
          if (c.z > S.zWS0 - 0.005) return (!S.bed && c.z > S.zGH1 - 0.004) ? 'hatch' : null;
          const ax = Math.abs(c.x);
          if (c.z > S.hoodZ0 && c.z < S.zWS0 - 0.012) {
            if (S.hoodHalf && Math.abs(ax - S.hoodHalf) < 0.0065) return 'seam';
            if (!S.hoodHalf || ax < S.hoodHalf) return 'hood';
          }
          if (Math.abs(c.z - S.hoodZ0 - 0.006) < 0.0065 && (!S.hoodHalf || ax < S.hoodHalf)) return 'seam';
          return 'paint';
        }
        const dn = doorOf(c);
        if (dn) return dn;
        if (!S.bed && S.hatchZ && c.z > S.hatchZ && c.y > S.hatchY) {
          q1.subVectors(cc, a); q2.subVectors(b, d);
          nrm.crossVectors(q1, q2).normalize();
          if (Math.abs(nrm.z) > 0.5) return 'hatch';
        }
        return 'paint';
      },
    });
    // ----- cam evi
    const wins = S.windows;
    const gz = stations(S.zWS0, S.zGH1, 0.025, [S.zWS0 + 0.04, S.zWS1 - 0.025, S.zWS1, S.zRoof1, S.zRoof1 + 0.01,
      ...wins.flatMap((w) => [w.z0, w.z0 + 0.012, w.z1 - 0.012, w.z1]), ...seams]);
    const gsec = gz.map((z) => greenSection(S, z));
    const tmpN = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const classifyGreen = (i, j, c, a, b, cc, d) => {
      e1.subVectors(cc, a); e2.subVectors(b, d);
      tmpN.crossVectors(e1, e2).normalize();
      const g = gsec[i];
      const z = c.z, y = c.y, ax = Math.abs(c.x);
      const nx = Math.abs(tmpN.x), ny = Math.abs(tmpN.y), nz = Math.abs(tmpN.z);
      const sideIdx = c.x > 0 ? 1 : 0;
      // on cam
      if (z < S.zWS1 && ny > 0.3 && nx < 0.55) {
        if (z < S.zWS0 + 0.04) return 'cowl';
        if (ax > g.wT - g.rc - 0.02 || z > S.zWS1 - 0.025) return S.aPillar || 'trim';
        return 'glass';
      }
      // arka cam (pikap kabin arkasi / SUV bagaj cami)
      if (z > S.zRoof1 && nz > 0.4 && nx < 0.6) {
        // (arka yuzun yuksekligi bolumden bolume duser: tavan yuksekligine gore olc)
        const inGlass = ax < g.wT - S.rearGlassInset && y > g.yb + S.rearGlassBottom && y < S.yRoof(S.zRoof1) - (S.rearGlassTop ?? 0.07);
        const pre = S.bed ? '' : 'hatch:';
        return pre + (inGlass ? (S.bed ? 'glass' : 'privacy') : (S.bed ? 'paint' : 'paint'));
      }
      if (nx > 0.45) {
        if (y > g.yWT + 0.002) return 'paint';
        for (const w of wins) {
          if (z < w.z0 || z > w.z1) continue;
          const band = y < g.yb + 0.034 || y > g.yWT - 0.012 || z < w.z0 + 0.012 || z > w.z1 - 0.012;
          const name = y < g.yb + 0.02 ? 'paint' : band ? 'trim' : (w.privacy ? 'privacy' : 'glass');
          if (w.door !== undefined && w.door !== null) return `door${w.door * 2 + sideIdx}:${name}`;
          return name;
        }
        // kapi cercevesinin pencere disi kisimlari
        for (let k = 0; k < S.doors.length; k++) {
          const d = S.doors[k];
          if (z > d.z0 && z < d.z1) return `door${k * 2 + sideIdx}:${y < g.yb + 0.02 ? 'paint' : S.pillar || 'trim'}`;
        }
        if (S.pillarBlack && S.pillarBlack.some(([z0, z1]) => z > z0 && z < z1)) return 'trim';
        return 'paint';
      }
      return 'paint';
    };
    const green = loft(gsec.map((g) => g.ring), { closedRing: false, classify: classifyGreen, capEnd: S.bed ? 'paint' : null });
    // ic kaplama (tavan dosemesi)
    const inset = gsec.map((g) => {
      const r = g.ring, out = [];
      for (let j = 0; j < r.length; j++) {
        const p0 = r[Math.max(0, j - 1)], p1 = r[Math.min(r.length - 1, j + 1)];
        const tx = p1.x - p0.x, ty = p1.y - p0.y, l = Math.hypot(tx, ty) || 1;
        out.push(new THREE.Vector3(r[j].x - (ty / l) * 0.014, r[j].y + (tx / l) * 0.014, r[j].z));
      }
      return out;
    });
    const liner = loft(inset, {
      closedRing: false, flip: true,
      classify: (i, j) => {
        const R = gsec[i].ring, R2 = gsec[i + 1].ring;
        const a = R[j], b = R[j + 1], cc = R2[j + 1], d = R2[j];
        const c = new THREE.Vector3().copy(a).add(b).add(cc).add(d).multiplyScalar(0.25);
        const k = classifyGreen(i, j, c, a, b, cc, d);
        return k.endsWith('glass') || k.endsWith('privacy') ? null : 'liner';
      },
    });
    const matOf = (k) => ({
      paint: m.paint, well: m.well, under: m.under, glass: m.glass, privacy: m.privacy, trim: m[S.trimMat || 'blackGloss'],
      cowl: m.plastic, seam: m.seam, liner: m.liner, hood: m.paint, hatch: m.paint, black: m.black, chrome: m.chrome,
    }[k] || m[k] || m.paint);
    const place = (name, geo) => {
      // "door0:glass" -> parca door0, malzeme glass; "hood"/"hatch" -> boya
      let partName = null, matName = name;
      if (name.includes(':')) [partName, matName] = name.split(':');
      else if (/^door\d$/.test(name) || name === 'hood' || name === 'hatch') { partName = name; matName = 'paint'; }
      const mat = matOf(matName);
      const cast = matName !== 'glass' && matName !== 'privacy' && matName !== 'liner';
      if (partName) {
        if (!this.parts[partName]) {
          // bagaj kapagi (SUV/station): ust kenardan menteseli
          this.part(partName, new THREE.Vector3(0, S.yRoof(S.zRoof1) - 0.02, S.zRoof1 + 0.02), { axis: 'x', open: 1 });
        }
        const o = this.addToPart(partName, geo, mat, cast);
        if (matName === 'glass' || matName === 'privacy') o.renderOrder = 5;
        return;
      }
      const o = mesh(geo, mat, cast);
      if (matName === 'glass' || matName === 'privacy') o.renderOrder = 5;
      this.body.add(o);
    };
    for (const [k, geo] of lower) place(k, geo);
    if (!S.bed) {
      const ring = secs[secs.length - 1].map((p) => [p.x, p.y]);
      const clip = (poly, keepAbove, h) => {
        const out = [];
        for (let k = 0; k < poly.length; k++) {
          const A = poly[k], Bp = poly[(k + 1) % poly.length];
          const ina = keepAbove ? A[1] >= h : A[1] <= h, inb = keepAbove ? Bp[1] >= h : Bp[1] <= h;
          if (ina) out.push(A);
          if (ina !== inb) { const t = (h - A[1]) / (Bp[1] - A[1]); out.push([A[0] + (Bp[0] - A[0]) * t, h]); }
        }
        return out;
      };
      for (const [above, name] of [[true, 'hatch'], [false, 'paint']]) {
        const poly = clip(ring, above, S.hatchY);
        if (poly.length < 3) continue;
        const g = new THREE.ShapeGeometry(shapeFrom(poly));
        g.translate(0, 0, S.zEnd);
        const geo = mergeInto([g]);
        place(name, geo);
      }
    }
    for (const [k, geo] of green) place(k, geo);
    for (const [k, geo] of liner) place(k, geo);
    // kapi ic panelleri (kapi acilinca gorunur) ve cam evi arkasi kapagi
    for (let k = 0; k < S.doors.length; k++) {
      const d = S.doors[k];
      for (const side of [-1, 1]) {
        const idx = k * 2 + (side > 0 ? 1 : 0);
        const zc = (d.z0 + d.z1) / 2, len = d.z1 - d.z0 - 0.02;
        const yTopD = S.yTop(zc) - 0.01, h = yTopD - S.doorBottom - 0.04;
        const x = side * (S.halfW(zc) + S.sideShape(S.yTop(zc) - 0.2, zc) - 0.07);
        const g = box(0.05, h, len, 0.02).translate(x, S.doorBottom + 0.03 + h / 2, zc);
        this.addToPart(`door${idx}`, g, m.interior, false);
      }
    }
    ctx.gsec = gsec;
  }

  // ---------------------------------------------------------------- pikap kasasi
  _buildBed(ctx) {
    const { S, m } = ctx;
    const B = S.bed;
    const z0 = B.z0, z1 = B.z1;
    const axles = S.axles;
    const halfW = (z) => S.bedHalfW ? S.bedHalfW(z) : S.halfW(z);
    // dis yan duvarlar (sag ve sol ayri loft; arka teker yayi kesik)
    const zs = stations(z0, z1, 0.05, [...(() => { const a = []; for (const ax of axles) for (let k = -S.archR; k <= S.archR + 1e-6; k += 0.025) a.push(ax + k); return a; })(), z0 + 0.012, z1 - 0.012]);
    for (const side of [-1, 1]) {
      const secs = zs.map((z) => {
        const a = halfW(z);
        const pts = [];
        const yb = B.bottom, yt = B.rail;
        const at = archTop(S, z, axles);
        const inArch = at > yb + 0.02;
        const yS = inArch ? Math.min(at, yt - 0.08) : yb;
        // alt kenar ici -> dis alt -> dis yan (yay) -> omuz -> ray ustu -> ic duvar ust
        pts.push({ x: a - 0.06, y: yb, part: 'under' });
        const y0 = inArch ? yS : yb + 0.03;
        if (inArch) { pts.push({ x: a - S.well, y: yb, part: 'well' }); pts.push({ x: a - S.well, y: yS - 0.001, part: 'well' }); pts.push({ x: a + S.sideShape(yS, z), y: yS, part: 'side' }); }
        else { pts.push({ x: a - 0.03, y: yb, part: 'under' }); pts.push({ x: a - 0.006, y: yb + 0.008, part: 'side' }); pts.push({ x: a + S.sideShape(y0, z), y: y0, part: 'side' }); }
        for (let k = 1; k <= 8; k++) { const y = lerp(y0, yt - 0.035, k / 8); pts.push({ x: a + S.sideShape(y, z), y, part: 'side' }); }
        for (let k = 1; k <= 3; k++) { const an = (k / 3) * (Math.PI / 2); pts.push({ x: a - 0.035 + 0.035 * Math.cos(an), y: yt - 0.035 + 0.035 * Math.sin(an), part: 'side' }); }
        pts.push({ x: a - B.wall + 0.01, y: yt, part: 'rail' });
        pts.push({ x: a - B.wall, y: yt - 0.01, part: 'rail' });
        pts.push({ x: a - B.wall, y: B.floor, part: 'inner' });
        return pts.map((p) => Object.assign(new THREE.Vector3(side * p.x, p.y, z), { part: p.part }));
      });
      const res = loft(secs, {
        closedRing: false, flip: side < 0,
        capStart: 'paint', capEnd: 'paint',
        classify: (i, j, c, a, b) => {
          if (a.part === 'well' || b.part === 'well') return 'well';
          if (a.part === 'under') return 'under';
          if (a.part === 'inner' || b.part === 'inner') return 'bedInner';
          if (a.part === 'rail' && b.part === 'rail') return B.railMat || 'paint';
          return 'paint';
        },
      });
      for (const [k, geo] of res) {
        const mat = { well: m.well, under: m.under, bedInner: m[B.innerMat || 'paint'], paint: m.paint, black: m.black, plastic: m.plastic }[k] || m.paint;
        this.body.add(mesh(geo, mat));
      }
    }
    // taban (kaplama nervurlu), on duvar, alt yuz
    const w = 2 * (halfW((z0 + z1) / 2) - B.wall);
    const len = z1 - z0 - 0.08;
    const floorMat = m[B.floorMat || 'plastic'];
    const floor = mesh(box(w, 0.03, len, 0.005).translate(0, B.floor - 0.015, (z0 + z1) / 2 + 0.01), floorMat);
    this.body.add(floor);
    const ribs = [];
    for (let k = -6; k <= 6; k++) ribs.push(box(0.04, 0.012, len - 0.06, 0.004).translate(k * (w / 14), B.floor + 0.004, (z0 + z1) / 2 + 0.02));
    this.body.add(mesh(mergeInto(ribs), floorMat, false));
    const front = box(w + 0.02, B.rail - B.floor, 0.05, 0.01).translate(0, (B.rail + B.floor) / 2, z0 + 0.025);
    this.body.add(mesh(front, m[B.innerMat || 'paint']));
    const frontOuter = box(w + 0.1, B.rail - B.bottom, 0.02, 0.008).translate(0, (B.rail + B.bottom) / 2, z0 + 0.005);
    this.body.add(mesh(frontOuter, m.paint));
    const under = box(w, 0.04, len, 0.01).translate(0, B.bottom + 0.02, (z0 + z1) / 2);
    this.body.add(mesh(under, m.under, false));
    // bagaj kapagi: alt kenardan menteseli
    const tg = this.part('tailgate', new THREE.Vector3(0, B.tgBottom, z1 - B.tgDepth / 2), { axis: 'x', open: 1 });
    void tg;
    const tw = w + 2 * B.wall - 0.03;
    const tgGeo = box(tw, B.rail - B.tgBottom - 0.008, B.tgDepth, 0.025, 3).translate(0, (B.rail + B.tgBottom) / 2, z1 - B.tgDepth / 2);
    this.addToPart('tailgate', tgGeo, m.paint);
    const tgIn = box(tw - 0.08, B.rail - B.tgBottom - 0.08, 0.01, 0.004).translate(0, (B.rail + B.tgBottom) / 2, z1 - B.tgDepth - 0.002);
    this.addToPart('tailgate', tgIn, m[B.innerMat || 'plastic'], false);
    ctx.bed = { w, z0, z1, tw };
  }

  // ---------------------------------------------------------------- alt takim
  _buildUnder(ctx) {
    const { S, m } = ctx;
    const U = S.under;
    const parts = [];
    // sasi kirisleri
    for (const s of [-1, 1]) parts.push(box(0.07, 0.17, U.frameZ1 - U.frameZ0, 0.01).translate(s * U.frameX, U.frameY, (U.frameZ0 + U.frameZ1) / 2));
    for (const z of U.cross) parts.push(box(U.frameX * 2, 0.07, 0.07, 0.01).translate(0, U.frameY - 0.03, z));
    // arka aks + diferansiyel
    const axR = S.axles[1];
    parts.push(new THREE.CylinderGeometry(0.045, 0.045, S.trackR - 0.25, 12).rotateZ(Math.PI / 2).translate(0, S.wr, axR));
    parts.push(new THREE.SphereGeometry(0.15, 16, 12).scale(1, 0.95, 1.1).translate(0, S.wr, axR + 0.02));
    // on diferansiyel ve salincaklar
    const axF = S.axles[0];
    parts.push(box(0.32, 0.22, 0.3, 0.05).translate(0, S.wr + 0.02, axF + 0.05));
    for (const s of [-1, 1]) parts.push(box(S.trackF / 2 - 0.2, 0.05, 0.12, 0.02).translate(s * (S.trackF / 4 + 0.05), S.wr - 0.05, axF));
    // yakit deposu, motor alti
    parts.push(box(0.55, 0.22, 0.75, 0.04).translate(U.tankX, U.frameY - 0.02, U.tankZ));
    parts.push(box(0.6, 0.35, 0.7, 0.06).translate(0, U.engineY, axF - 0.05));
    this.body.add(mesh(mergeInto(parts), m.frame, true));
    if (U.spare) {
      const spare = mesh(new THREE.CylinderGeometry(S.wr * 0.97, S.wr * 0.97, S.tireW * 0.92, 28), m.rubber, false);
      spare.position.set(0, U.spare.y, U.spare.z);
      this.body.add(spare);
    }
    // egzoz ucu
    if (U.exhaust) {
      for (const e of U.exhaust) {
        const tip = mesh(lathe([[e.r * 0.82, -0.08], [e.r, -0.07], [e.r, 0.06], [e.r * 0.92, 0.07], [e.r * 0.8, 0.02]], 20, 'z'), m[e.mat || 'satin'], false);
        tip.position.set(e.x, e.y, e.z);
        if (e.oval) tip.scale.set(e.oval, 1, 1);
        if (e.down) tip.rotation.x = -0.35;
        this.body.add(tip);
        const pipe = mesh(new THREE.CylinderGeometry(e.r * 0.8, e.r * 0.8, e.len || 1.2, 12), m.frame, false);
        pipe.rotation.x = Math.PI / 2; pipe.position.set(e.x * 0.85, e.y + 0.02, e.z - (e.len || 1.2) / 2 - 0.05);
        this.body.add(pipe);
      }
    }
  }

  // ---------------------------------------------------------------- ic mekan
  _buildInterior(ctx) {
    const { S, m } = ctx;
    const I = S.interior;
    const g = this.body;
    const parts = {};
    const belt = S.yTop(S.zWS0 + 0.5);
    const floorY = I.floorY;
    const w = 2 * (S.halfW(0) - 0.12);
    g.add(mesh(box(w, 0.02, I.cabZ1 - S.zWS0, 0.005).translate(0, floorY, (S.zWS0 + I.cabZ1) / 2), m.interior, false));
    // torpido: on camin altinda kalan kama (yan profil on cam egimini 4 cm asagidan izler)
    const dz0 = S.zWS0 + 0.04, dz1 = S.zWS0 + I.dashDepth;
    const prof = [];
    for (let k = 0; k <= 8; k++) {
      const z = lerp(dz0, dz1, k / 8);
      prof.push([z, Math.min(S.yRoof(z) - 0.045, belt + 0.06)]);
    }
    prof.push([dz1 + 0.04, belt + 0.02], [dz1 + 0.06, belt - 0.12], [dz1 - 0.06, belt - I.dashH], [dz0, S.yTop(S.zWS0) - 0.12]);
    const dashShape = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y)));
    const dashGeo = new THREE.ExtrudeGeometry(dashShape, { depth: w, bevelEnabled: false });
    // sekil duzlemi (z, y), kabartma x boyunca: (z_s, y, d) -> (x = w/2 - d, y, z = z_s)
    dashGeo.rotateY(-Math.PI / 2);
    dashGeo.translate(w / 2, 0, 0);
    dashGeo.computeVertexNormals();
    g.add(mesh(dashGeo, m.dash, false));
    const dashZ = (dz0 + dz1) / 2;
    // orta konsol
    g.add(mesh(box(0.26, belt - floorY - 0.25, 0.9, 0.04).translate(0, floorY + (belt - floorY - 0.25) / 2, dashZ + 0.45), m.dash, false));
    // ekran
    if (I.screen) {
      const scr = mesh(box(I.screen.w, I.screen.h, 0.02, 0.005), new THREE.MeshStandardMaterial({ color: 0x050607, emissive: 0x0d2233, emissiveIntensity: 0.6, roughness: 0.2 }), false);
      scr.position.set(0, belt + I.screen.y, S.zWS0 + I.dashDepth * 0.55);
      scr.rotation.x = -0.25;
      g.add(scr);
    }
    // gosterge paneli (surucu onu)
    const dx = I.driverX;
    const gauges = gaugeTexture(I.maxSpeed || 220, I.maxRpm || 7000);
    const gp = mesh(new THREE.PlaneGeometry(0.3, 0.13), new THREE.MeshBasicMaterial({ map: gauges.tex, toneMapped: false }), false);
    gp.position.set(dx, belt + 0.02, S.zWS0 + I.dashDepth + 0.025);
    gp.rotation.set(-0.3, 0, 0);
    g.add(gp);
    g.add(mesh(box(0.36, 0.05, 0.16, 0.02).translate(dx, belt + 0.1, S.zWS0 + I.dashDepth - 0.03), m.dash, false));
    parts.gauges = gauges;
    // direksiyon
    const sw = new THREE.Group();
    sw.add(mesh(new THREE.TorusGeometry(I.wheelR || 0.19, 0.017, 10, 40), m.rubber, false));
    for (const a of [0, Math.PI, -Math.PI / 2]) {
      const sp = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.014), m.dash, false);
      sp.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0); sp.rotation.z = a; sw.add(sp);
    }
    const hub = mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.05, 18), m.dash, false); hub.rotation.x = Math.PI / 2; sw.add(hub);
    const holder = new THREE.Group();
    holder.add(sw);
    holder.position.set(dx, belt - 0.1, S.zWS0 + I.dashDepth + 0.17);
    holder.rotation.x = -0.4;
    g.add(holder);
    parts.steeringWheel = sw;
    // koltuklar
    for (const x of [-I.seatX, I.seatX]) {
      g.add(mesh(box(0.52, 0.14, 0.52, 0.05, 3).translate(x, I.seatY, I.seatZ), m.seat, false));
      const back = mesh(box(0.52, 0.66, 0.13, 0.05, 3), m.seat, false);
      back.position.set(x, I.seatY + 0.38, I.seatZ + 0.3); back.rotation.x = 0.18; g.add(back);
      const head = mesh(box(0.27, 0.18, 0.1, 0.04), m.seat, false);
      head.position.set(x, I.seatY + 0.8, I.seatZ + 0.37); head.rotation.x = 0.18; g.add(head);
    }
    if (I.rearSeatZ) {
      g.add(mesh(box(w - 0.12, 0.14, 0.5, 0.05, 3).translate(0, I.seatY, I.rearSeatZ), m.seat, false));
      const bb = mesh(box(w - 0.12, 0.62, 0.13, 0.05, 3), m.seat, false);
      bb.position.set(0, I.seatY + 0.36, I.rearSeatZ + 0.28); bb.rotation.x = 0.12; g.add(bb);
    }
    // ic dikiz aynasi
    const rvg = new THREE.Group();
    rvg.add(mesh(box(0.24, 0.07, 0.03, 0.012), m.dash, false));
    const rglass = mesh(new THREE.PlaneGeometry(0.22, 0.055), m.mirror, false);
    rglass.position.z = 0.016; rvg.add(rglass);
    rvg.position.set(0, S.yRoof(S.zWS1 + 0.1) - 0.11, S.zWS1 + 0.1); rvg.rotation.set(0.12, -0.38, 0, 'YXZ');
    g.add(rvg);
    return parts;
  }

  /**
   * Dokusuz ve hareketsiz parcalari malzemeye gore tek geometride birlestirir. Menteseli parcalar
   * (kaput, kapilar, bagaj kapagi), direksiyon ve dokulu parcalar ayri kalir.
   */
  optimize() {
    const body = this.body;
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    const keep = new Set();
    if (this.steeringWheel) this.steeringWheel.traverse((o) => keep.add(o));
    for (const p of Object.values(this.parts)) p.group.traverse((o) => keep.add(o));
    const buckets = new Map();
    const remove = [];
    body.traverse((o) => {
      if (!o.isMesh || keep.has(o) || o.material.map || o.userData.keep) return;
      const g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      let b = buckets.get(o.material);
      if (!b) { b = { list: [], cast: false, order: 0 }; buckets.set(o.material, b); }
      b.list.push(g);
      b.cast = b.cast || o.castShadow;
      b.order = Math.max(b.order, o.renderOrder);
      remove.push(o);
    });
    for (const o of remove) o.parent.remove(o);
    for (const [mat, b] of buckets) {
      const geo = mergeInto(b.list);
      if (!geo) continue;
      geo.computeBoundingSphere();
      const o = mesh(geo, mat, b.cast);
      o.renderOrder = b.order;
      body.add(o);
    }
    // parcalarin icindeki ayni malzemeli geometrileri de birlestir
    for (const p of Object.values(this.parts)) {
      const pb = new Map();
      const rem = [];
      p.group.updateMatrixWorld(true);
      const pinv = new THREE.Matrix4().copy(p.group.matrixWorld).invert();
      p.group.traverse((o) => {
        if (!o.isMesh || o.material.map || o.userData.keep) return;
        const g = o.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(pinv, o.matrixWorld));
        let b = pb.get(o.material);
        if (!b) { b = { list: [], cast: false, order: 0 }; pb.set(o.material, b); }
        b.list.push(g); b.cast = b.cast || o.castShadow; b.order = Math.max(b.order, o.renderOrder);
        rem.push(o);
      });
      for (const o of rem) o.parent.remove(o);
      for (const [mat, b] of pb) {
        const geo = mergeInto(b.list);
        if (!geo) continue;
        geo.computeBoundingSphere();
        const o = mesh(geo, mat, b.cast);
        o.renderOrder = b.order;
        p.group.add(o);
      }
    }
  }

  /** Hasar icin geometrilerin orijinal konum/normallerini sakla (govde + parcalar). */
  prepareDamage() {
    this.deformables = [];
    const collect = (root, part) => {
      for (const o of root.children) {
        if (!o.isMesh || o.material.map || o.geometry.index) continue;
        const g = o.geometry;
        this.deformables.push({ mesh: o, part, orig: g.attributes.position.array.slice(), origN: g.attributes.normal.array.slice() });
      }
    };
    collect(this.body, null);
    for (const p of Object.values(this.parts)) collect(p.group, p);
    this.broken = { L: false, R: false, glass: false };
  }

  /**
   * Bir noktada ice gocertme. p ve dir govde (zemin) uzayinda; parcalar kendi yerel uzaylarina
   * cevrilir (acik kapi da dogru yerinden ezilir).
   */
  deform(p, dir, amount, radius) {
    if (!this.deformables) this.prepareDamage();
    const r2 = radius * radius, maxDisp = 0.22;
    const lp = new THREE.Vector3(), ld = new THREE.Vector3(), q = new THREE.Quaternion();
    const hash = (x, y, z) => { const h = Math.sin(Math.round(x * 40) * 12.9898 + Math.round(y * 40) * 78.233 + Math.round(z * 40) * 37.719) * 43758.5453; return h - Math.floor(h); };
    for (const d of this.deformables) {
      lp.copy(p); ld.copy(dir);
      if (d.part) {
        const gp = d.part.group;
        lp.sub(gp.position);
        q.copy(gp.quaternion).invert();
        lp.applyQuaternion(q); ld.applyQuaternion(q);
      }
      const g = d.mesh.geometry;
      const bs = g.boundingSphere;
      if (bs && bs.center.distanceTo(lp) > bs.radius + radius) continue;
      const a = g.attributes.position.array, o = d.orig, n = g.attributes.normal.array;
      const tris = new Set();
      for (let i = 0; i < a.length; i += 3) {
        const dx = a[i] - lp.x, dy = a[i + 1] - lp.y, dz = a[i + 2] - lp.z;
        const qq = dx * dx + dy * dy + dz * dz;
        if (qq > r2) continue;
        const f = 1 - Math.sqrt(qq) / radius;
        const k = amount * f * f * (0.7 + 0.6 * hash(o[i], o[i + 1], o[i + 2]));
        let x = a[i] + ld.x * k, y = a[i + 1] + ld.y * k, z = a[i + 2] + ld.z * k;
        const ox = x - o[i], oy = y - o[i + 1], oz = z - o[i + 2];
        const ol = Math.hypot(ox, oy, oz);
        if (ol > maxDisp) { const s = maxDisp / ol; x = o[i] + ox * s; y = o[i + 1] + oy * s; z = o[i + 2] + oz * s; }
        a[i] = x; a[i + 1] = y; a[i + 2] = z;
        tris.add(Math.floor(i / 9));
      }
      if (!tris.size) continue;
      for (const t of tris) {
        const b = t * 9;
        const ux = a[b + 3] - a[b], uy = a[b + 4] - a[b + 1], uz = a[b + 5] - a[b + 2];
        const vx = a[b + 6] - a[b], vy = a[b + 7] - a[b + 1], vz = a[b + 8] - a[b + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        if (nx * n[b] + ny * n[b + 1] + nz * n[b + 2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
        for (let k = 0; k < 3; k++) { n[b + k * 3] = nx; n[b + k * 3 + 1] = ny; n[b + k * 3 + 2] = nz; }
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.normal.needsUpdate = true;
    }
  }

  breakHeadlight(side) {
    if (!this.broken || this.broken[side]) return;
    this.broken[side] = true;
    for (const l of this.headLamps) {
      if ((side === 'L' && l.x < 0) || (side === 'R' && l.x > 0)) { l.lens.color.set(0x6b6b6b); l.lens.opacity = 0.85; l.dead = true; }
    }
  }

  crackGlass() {
    if (!this.broken || this.broken.glass) return;
    this.broken.glass = true;
    const g = this.mats.glass;
    g.roughness = 0.38; g.opacity = 0.7; g.color.set(0x8c9599); g.clearcoatRoughness = 0.4;
  }

  repair() {
    if (this.deformables) {
      for (const d of this.deformables) {
        const g = d.mesh.geometry;
        g.attributes.position.array.set(d.orig);
        g.attributes.normal.array.set(d.origN);
        g.attributes.position.needsUpdate = true;
        g.attributes.normal.needsUpdate = true;
      }
    }
    for (const l of this.headLamps) { l.lens.color.set(0xffffff); l.lens.opacity = l.opacity ?? 0.22; l.dead = false; }
    const g = this.mats.glass;
    g.roughness = 0.02; g.opacity = 0.5; g.color.set(0x0a1214); g.clearcoatRoughness = 0;
    this.broken = { L: false, R: false, glass: false };
    this.mats.dirt.uDirt.value = 0;
    if (this.onRepair) this.onRepair();
  }

  setDirt(v, color) {
    this.mats.dirt.uDirt.value = v;
    if (color) this.mats.dirt.uDirtColor.value.setRGB(color[0], color[1], color[2]);
  }

  reflectiveMaterials() {
    const M = this.mats;
    const set = new Set([...M.paints, M.chrome, M.darkChrome, M.glass, M.privacy, M.reflector, M.alloy, M.blackGloss, M.mirror, M.satin]);
    for (const l of this.headLamps) set.add(l.lens);
    for (const k of ['tail', 'amber', 'reverse']) for (const x of this.tails[k]) set.add(x);
    return [...set];
  }

  /** Zemin uzayini fizik govde uzayina hizalar (CG orijin). */
  alignToPhysics(cgHeight) {
    this.body.position.set(0, -cgHeight, 0);
  }

  setPaint(id) {
    const p = PAINTS[id];
    if (!p) return;
    for (const mat of this.mats.paints) {
      mat.color.set(p.color);
      mat.metalness = p.metal || 0;
      mat.roughness = p.metal ? 0.38 : 0.32;
    }
  }

  setLights({ head = false, brake = 0, reverse = false, tail = false } = {}) {
    for (const l of this.headLamps) l.lens.emissiveIntensity = head && !l.dead ? 2.4 : 0;
    this.mats.reflector.emissiveIntensity = head ? 1.6 : 0;
    this.spots[0].intensity = head && !(this.broken && this.broken.L) ? 75 : 0;
    this.spots[1].intensity = head && !(this.broken && this.broken.R) ? 75 : 0;
    const tailI = (tail || head ? 0.9 : 0.15) + brake * 3.2;
    for (const t of this.tails.tail) t.emissiveIntensity = tailI;
    for (const t of this.tails.reverse) t.emissiveIntensity = reverse ? 2.2 : 0;
  }
}

// ---------------------------------------------------------------- gostergeler
function gaugeTexture(maxSpeed, maxRpm) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 220;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (speed = 0, rpm = 800) => {
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#050608'; ctx.fillRect(0, 0, 512, 220);
    const dial = (cx, val, max, step, div) => {
      ctx.save(); ctx.translate(cx, 112);
      ctx.strokeStyle = '#2a3440'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 98, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d8e2ec'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let v = 0; v <= max; v += step) {
        const a = Math.PI * 0.75 + (v / max) * Math.PI * 1.5;
        ctx.strokeStyle = '#9fb4c8'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 82, Math.sin(a) * 82); ctx.lineTo(Math.cos(a) * 94, Math.sin(a) * 94); ctx.stroke();
        ctx.fillText(String(v / div), Math.cos(a) * 66, Math.sin(a) * 66);
      }
      const a = Math.PI * 0.75 + (Math.min(val, max) / max) * Math.PI * 1.5;
      ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 88, Math.sin(a) * 88); ctx.stroke();
      ctx.restore();
    };
    dial(128, speed, maxSpeed, 20, 1);
    dial(384, rpm, maxRpm, 1000, 1000);
    tex.needsUpdate = true;
  };
  draw();
  return { tex, draw };
}

// ---------------------------------------------------------------- tekerlekler
function tireTexture(kind) {
  const normal = normalMapFromHeight(512, 128, (u, v) => {
    if (v < 0.3 || v > 0.7) return 0.5 + 0.02 * Math.sin(u * 700);
    const w = (v - 0.3) / 0.4;
    if (kind === 'road') {
      let h = 1;
      for (const g of [0.22, 0.42, 0.58, 0.78]) if (Math.abs(w - g) < 0.03) h = 0;
      if (Math.abs(((u * 160 + w * 3) % 1) - 0.5) < 0.05) h *= 0.55;
      return h;
    }
    // arazi (AT/MT): iri bloklar, kaydirilmis iki sira, omuz kertikleri
    const cols = kind === 'mt' ? 3 : 4;
    const row = Math.floor(w * cols);
    const uu = u * (kind === 'mt' ? 44 : 56) + (row % 2) * 0.5;
    const fu = uu - Math.floor(uu);
    const fw = w * cols - row;
    let h = fu < (kind === 'mt' ? 0.36 : 0.24) || fw < 0.12 ? 0.05 : 1;
    if (h > 0.5 && Math.abs(fu - 0.62) < 0.035) h = 0.55;   // sipe
    return h;
  }, kind === 'road' ? 3.5 : 5);
  return { normal };
}

function buildWheel(S, m, side, tires) {
  const W = S.wheel;
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const R = S.wr, hw = S.tireW / 2, rr = W.rimR;
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.93, normalMap: tires.normal, normalScale: new THREE.Vector2(1, 1) });
  const sh = W.shoulder ?? 0.03;
  const tire = lathe([
    [rr - 0.005, -hw + 0.012], [rr + 0.03, -hw], [lerp(rr, R, 0.55), -hw - 0.006], [R - sh, -hw + 0.004], [R - 0.006, -hw + sh * 0.6], [R, -hw + sh],
    [R, hw - sh], [R - 0.006, hw - sh * 0.6], [R - sh, hw - 0.004], [lerp(rr, R, 0.55), hw + 0.006], [rr + 0.03, hw], [rr - 0.005, hw - 0.012],
  ], 56, 'x');
  spin.add(mesh(tire, tireMat));
  // jant: dis cember + kollar + gobek
  const rimMat = m[W.mat || 'alloy'];
  const barrel = lathe([[rr - 0.012, -hw + 0.02], [rr + 0.004, -hw + 0.016], [rr - 0.01, -hw + 0.03], [rr - 0.012, hw - 0.03], [rr + 0.006, hw - 0.012], [rr - 0.006, hw - 0.004], [rr - 0.03, hw - 0.01]], 48, 'x');
  spin.add(mesh(barrel, rimMat));
  const face = hw - 0.025;
  const spokes = [];
  for (let k = 0; k < W.spokes; k++) {
    const a = (k / W.spokes) * Math.PI * 2;
    const sp = new THREE.BoxGeometry(W.spokeDepth || 0.03, rr - 0.07, W.spokeW || 0.05);
    sp.translate(0, (rr - 0.07) / 2 + 0.06, 0);
    sp.rotateX(a);
    sp.translate(face - 0.01, 0, 0);
    spokes.push(sp);
    if (W.split) {
      const sp2 = sp.clone(); sp2.rotateX(0.16); spokes.push(sp2);
    }
  }
  const hub = lathe([[0.075, face - 0.03], [0.072, face], [0.05, face + 0.008], [0.0, face + 0.01]], 24, 'x');
  spokes.push(hub);
  spin.add(mesh(mergeInto(spokes), rimMat, false));
  // bijonlar
  const nuts = [];
  for (let k = 0; k < (W.lugs || 6); k++) {
    const a = (k / (W.lugs || 6)) * Math.PI * 2;
    const nut = new THREE.CylinderGeometry(0.011, 0.011, 0.018, 6);
    nut.rotateZ(Math.PI / 2); nut.translate(face + 0.006, Math.cos(a) * 0.058, Math.sin(a) * 0.058);
    nuts.push(nut);
  }
  spin.add(mesh(mergeInto(nuts), m.chrome, false));
  // fren diski ve kaliper (donmez)
  const disc = mesh(new THREE.CylinderGeometry(rr - 0.05, rr - 0.05, 0.028, 32), m.brake, false);
  disc.rotation.z = Math.PI / 2; disc.position.x = 0.0;
  g.add(disc);
  const cal = mesh(box(0.06, 0.11, 0.16, 0.02), m[W.caliper || 'black'], false);
  cal.position.set(0.02, 0.0, rr - 0.08);
  g.add(cal);
  if (side < 0) g.scale.x = -1;
  return { group: g, spin };
}
