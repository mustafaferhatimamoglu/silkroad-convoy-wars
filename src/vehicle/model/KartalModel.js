import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loft, sweep, roundRectProfile, lathe, smooth, lerp, canvasTexture, normalMapFromHeight, mergeInto } from './carkit.js';
import { buildEngineBay } from './engineBay.js';

// Tofas Kartal (Fiat 131 Panorama tabanli station) prosedurel modeli.
// Model "zemin uzayinda" kurulur: y=0 zemin, -z ileri (on), +x sag. Olculer metre.
//   variant 'kartal80': 4 yuvarlak far, tam genislik izgara, krom tampon + kaucuk uclar, krom cam citalari
//   variant 'kartal90': dikdortgen farlar, siyah plastik tampon ve yan citalar
// Disari verilenler: root (Group), wheels (4 Group, fizik konumlandirir), lights (far/stop),
// steeringWheel, gauges (kokpit gostergeleri), setPaint(), setLights().

export const PAINTS = {
  lacivert: { name: 'Lacivert', color: '#14254d' },
  beyaz: { name: 'Beyaz', color: '#e8e5da' },
  kirmizi: { name: 'Kırmızı', color: '#8c1515' },
  bej: { name: 'Bej', color: '#c8b388' },
  yesil: { name: 'Çağla Yeşili', color: '#55703a' },
  gumus: { name: 'Gümüş', color: '#a7abb0', metal: 0.6 },
  siyah: { name: 'Siyah', color: '#0c0d0f' },
  hardal: { name: 'Hardal', color: '#b07a1c' },
};

// ---------------------------------------------------------------- olculer
const ZF = -2.06, ZR = 2.06;          // sac gövde uclari
export const AXF = -1.33, AXR = 1.16; // akslar (zemin uzayi)
const WR = 0.287;                     // teker yaricapi
const W = 0.815;                      // yari genislik
const ARCH_R = 0.362, ARCH_CY = 0.285, WELL = 0.27;
const ZWS0 = -0.62, ZWS1 = -0.17, ZRF = 1.97, ZTG = 2.045;
const ROOF = 1.375;
export const CG_Z = -0.184;           // kutle merkezinin zemin uzayi z'si (fizik ile ayni)
// menteseli parcalar (dikis cizgileriyle ayni sinirlar): kapilar, kaput, bagaj kapagi
const DOORS = [{ z0: -0.69, z1: 0.44 }, { z0: 0.44, z1: 1.255 }];
const DOOR_Y0 = 0.345;
const HOOD_Z0 = ZF + 0.02, HOOD_Z1 = ZWS0 - 0.04;
const TG_X = 0.69, TG_Y0 = 0.36;
const hoodX = (z) => halfW(z) - 0.075;
/** Bir yuz merkezinin ait oldugu kapi (yan yuzler icin). */
function doorAt(c) {
  if (c.y < DOOR_Y0) return null;
  for (let k = 0; k < DOORS.length; k++) if (c.z > DOORS[k].z0 && c.z < DOORS[k].z1) return `door${k * 2 + (c.x > 0 ? 1 : 0)}`;
  return null;
}

function yTop(z) {
  if (z < ZWS0) { const t = (z - ZF) / (ZWS0 - ZF); return 0.79 + 0.098 * Math.sin((t * Math.PI) / 2); }
  const t = (z - ZWS0) / (ZR - ZWS0);
  return 0.9 + 0.035 * t;
}
function yBot(z) {
  if (z < ZF + 0.28) return lerp(0.37, 0.295, smooth((z - ZF) / 0.28));
  if (z > ZR - 0.32) return lerp(0.295, 0.35, smooth((z - (ZR - 0.32)) / 0.32));
  return 0.295;
}
function halfW(z) {
  const rzF = 0.24, rxF = 0.07, rzR = 0.16, rxR = 0.05;
  if (z < ZF + rzF) { const u = (ZF + rzF - z) / rzF; return W - rxF + rxF * Math.sqrt(Math.max(0, 1 - u * u)); }
  if (z > ZR - rzR) { const u = (z - (ZR - rzR)) / rzR; return W - rxR + rxR * Math.sqrt(Math.max(0, 1 - u * u)); }
  return W;
}
function hoodCrown(z) { return z < ZWS0 ? 0.018 : 0.0; }
function yRoof(z) {
  if (z <= ZWS0) return yTop(z);
  if (z < ZWS1) { const t = (z - ZWS0) / (ZWS1 - ZWS0); return lerp(yTop(ZWS0), ROOF, t) + 0.02 * Math.sin(t * Math.PI); }
  if (z < ZRF) { const t = (z - ZWS1) / (ZRF - ZWS1); return ROOF + 0.01 * Math.sin(t * Math.PI) - 0.012 * t; }
  const t = Math.min(1, (z - ZRF) / (ZTG - ZRF));
  return lerp(ROOF - 0.012, yTop(ZTG) + 0.004, smooth(t));
}
function archTop(z) {
  let best = -Infinity;
  for (const ax of [AXF, AXR]) {
    const dz = z - ax;
    if (Math.abs(dz) < ARCH_R) best = Math.max(best, ARCH_CY + Math.sqrt(ARCH_R * ARCH_R - dz * dz));
  }
  return best;
}

// ---------------------------------------------------------------- malzemeler
function makeMaterials(paintId) {
  const p = PAINTS[paintId] || PAINTS.lacivert;
  const m = {};
  m.paint = new THREE.MeshPhysicalMaterial({
    color: p.color, metalness: p.metal || 0.0, roughness: p.metal ? 0.4 : 0.36,
    clearcoat: 0.85, clearcoatRoughness: 0.11, envMapIntensity: 1.0,
  });
  // kir: zemin renginde, alttan yukari azalan, gurultulu toz tabakasi; cilayi matlastirir
  const dirt = { uDirt: { value: 0 }, uDirtColor: { value: new THREE.Color(0.62, 0.52, 0.38) } };
  m.dirt = dirt;
  m.paint.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, dirt);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGround;
uniform float uDirt;
uniform vec3 uDirtColor;
float dHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float dNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dHash(i), dHash(i + vec2(1, 0)), u.x), mix(dHash(i + vec2(0, 1)), dHash(i + vec2(1, 1)), u.x), u.y); }
float dirtMask() {
  float h = smoothstep(1.05, 0.28, vGround.y);
  float n = dNoise(vGround.xz * 9.0 + vGround.y * 3.0) * 0.6 + dNoise(vGround.zy * 23.0) * 0.4;
  return clamp(uDirt * (h * 1.3 + 0.12) * (0.55 + 0.7 * n), 0.0, 0.92);
}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat dm = dirtMask();\ndiffuseColor.rgb = mix(diffuseColor.rgb, uDirtColor, dm);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, dm);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - dm * 0.95;\n#endif');
  };
  m.paint.customProgramCacheKey = () => 'kartal-paint-dirt';
  m.chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, metalness: 1.0, roughness: 0.07, envMapIntensity: 1.4 });
  m.blackPlastic = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.72, metalness: 0.0 });
  m.rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.85 });
  m.well = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
  m.under = new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.95 });
  m.glass = new THREE.MeshPhysicalMaterial({
    color: 0x0b1416, metalness: 0.0, roughness: 0.02, transparent: true, opacity: 0.42,
    envMapIntensity: 2.0, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.0,
  });
  m.liner = new THREE.MeshStandardMaterial({ color: 0xb9b09c, roughness: 1.0 });
  m.interior = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.8 });
  m.seat = new THREE.MeshStandardMaterial({ color: 0x3d2c22, roughness: 0.9 });
  m.dash = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.7 });
  // kabin ortam golgesi: kapali kabine gokyuzu isigi (IBL) az ulasir; dogrudan gunes
  // golge haritasiyla zaten kesilir. Bu olmadan tavan dosemesi camlardan bembeyaz gorunur.
  const cabinAO = { value: 0.3 };
  for (const k of ['liner', 'interior', 'seat', 'dash']) {
    m[k].onBeforeCompile = (shader) => {
      shader.uniforms.uCabinAO = cabinAO;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uCabinAO;')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= uCabinAO;\nreflectedLight.indirectSpecular *= uCabinAO;');
    };
    m[k].customProgramCacheKey = () => 'kartal-cabin';
  }
  // 90'lar on maskesi, izgara, amblem, jant kapagi
  m.bucket = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.85, side: THREE.BackSide });
  m.grilleFrame = new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.55 });
  m.emblem = new THREE.MeshPhysicalMaterial({ color: 0x1f56b8, metalness: 0.3, roughness: 0.25, clearcoat: 1 });
  m.hubcap = new THREE.MeshStandardMaterial({ color: 0xb4b8bc, metalness: 0.35, roughness: 0.32 });
  m.slot = new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.9 });
  m.sigRefl = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.22, side: THREE.DoubleSide });
  m.mirror = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.03 });
  m.steel = new THREE.MeshStandardMaterial({ color: 0x9a9c9e, metalness: 0.6, roughness: 0.45 });
  m.drum = new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.5, roughness: 0.7 });
  m.headLens = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.55,
    emissive: 0xfff2d8, emissiveIntensity: 0, clearcoat: 1, envMapIntensity: 1.5, side: THREE.DoubleSide,
  });
  m.reflector = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.18, emissive: 0xfff3dc, emissiveIntensity: 0, side: THREE.DoubleSide });
  m.tail = new THREE.MeshPhysicalMaterial({ color: 0x8a0a0a, roughness: 0.25, emissive: 0xff1508, emissiveIntensity: 0.25, clearcoat: 1 });
  m.amber = new THREE.MeshPhysicalMaterial({ color: 0xc66a00, roughness: 0.25, emissive: 0xff8a00, emissiveIntensity: 0.0, clearcoat: 1 });
  m.reverse = new THREE.MeshPhysicalMaterial({ color: 0xdedede, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.0, clearcoat: 1 });
  return m;
}

// ---------------------------------------------------------------- govde
function lowerSection(z, variant) {
  const a = halfW(z), yt = yTop(z), yb = yBot(z);
  const rt = 0.05, rb = 0.085;
  const half = [];
  for (let k = 0; k <= 3; k++) half.push({ x: ((a - rb) * k) / 3, y: yb, part: 'bottom' });
  for (let k = 1; k <= 4; k++) { const an = -Math.PI / 2 + (k / 4) * (Math.PI / 2); half.push({ x: a - rb + rb * Math.cos(an), y: yb + rb + rb * Math.sin(an), part: 'bcorner' }); }
  // Yan yuzey iki bantta: [alt bant 8 nokta | ust bant 8 nokta]. Camurluk yayi bolgesinde
  // bantlar yay yuksekliginde ayrilir ve alt bant ice (teker yuvasi) cekilir. Ayrim hep
  // ayni indekste oldugu icin yay kenari kesitler arasinda atlamaz -> keskin, temiz dudak.
  const at = archTop(z);
  const inArch = at > yb + rb + 0.002;
  const ySplit = inArch ? Math.min(at, yt - rt - 0.05) : lerp(yb + rb, yt - rt, 0.42);
  const sideX = (t) => a + 0.008 * Math.sin(Math.PI * t) - 0.01 * t;
  const tOf = (y) => (y - (yb + rb)) / Math.max(yt - rt - (yb + rb), 1e-4);
  if (inArch) {
    for (const p of half) if (p.part === 'bcorner' || (p.part === 'bottom' && p.x > a - WELL)) { p.x = Math.min(p.x, a - WELL); p.inner = true; }
  }
  for (let k = 1; k <= 8; k++) {
    const y = lerp(yb + rb, ySplit, k / 8);
    half.push({ x: inArch ? a - WELL : sideX(tOf(y)), y, part: 'side', inner: inArch });
  }
  for (let k = 0; k <= 7; k++) {
    const y = lerp(ySplit, yt - rt, k / 7);
    half.push({ x: sideX(tOf(y)), y: k === 0 && inArch ? ySplit + 0.0005 : y, part: 'side' });
  }
  const ax = a - 0.01 - rt;
  for (let k = 1; k <= 5; k++) { const an = (k / 5) * (Math.PI / 2); half.push({ x: ax + rt * Math.cos(an), y: yt - rt + rt * Math.sin(an), part: 'tcorner' }); }
  const crown = hoodCrown(z);
  const hx = hoodX(z);
  const xs = [];
  for (let k = 1; k <= 6; k++) xs.push(ax * (1 - k / 6));
  // kaput kenari (dikis) her kesitte ayni indekste: en yakin noktayi kenara tasi
  let best = 0;
  for (let k = 1; k < xs.length; k++) if (Math.abs(xs[k] - hx) < Math.abs(xs[best] - hx)) best = k;
  if (hx > 0.05 && hx < ax - 0.01) xs[best] = hx;
  xs.sort((p, q) => q - p);
  for (const x of xs) half.push({ x, y: yt + crown * (1 - (x / a) ** 2), part: 'top' });
  // tam halka: alt merkez -> sag -> ust merkez -> sol -> (alt merkeze kapanir)
  const ring = [];
  for (const p of half) ring.push({ ...p, side: 1 });
  for (let k = half.length - 2; k >= 1; k--) { const p = half[k]; ring.push({ ...p, x: -p.x, side: -1 }); }
  return ring.map((p) => Object.assign(new THREE.Vector3(p.x, p.y, z), { part: p.part, inner: !!p.inner, side: p.side }));
}

function greenSection(z) {
  const yb = yTop(z);
  const yr = Math.max(yRoof(z), yb + 0.0005);
  const wB = halfW(z) - 0.028, wT = wB - 0.112;
  const rc = Math.min(0.045, (yr - yb) * 0.45);
  const yWT = yr - 0.055;
  const ys = [yb, yb + 0.022, yb + 0.034];
  for (let k = 1; k <= 6; k++) ys.push(lerp(yb + 0.034, yWT - 0.012, k / 7));
  ys.push(yWT - 0.012, yWT, yr - rc);
  for (let k = 1; k < ys.length; k++) ys[k] = Math.min(Math.max(ys[k], ys[k - 1]), yr - rc);
  const half = [];
  const xAt = (y) => lerp(wB, wT, (y - yb) / Math.max(yr - rc - yb, 1e-4));
  for (const y of ys) half.push({ x: xAt(y), y, part: 'side' });
  const cx = wT - rc;
  for (let k = 1; k <= 5; k++) { const an = (k / 5) * (Math.PI / 2); half.push({ x: cx + rc * Math.cos(an), y: yr - rc + rc * Math.sin(an), part: 'corner' }); }
  for (let k = 1; k <= 8; k++) { const x = cx * (1 - k / 8); half.push({ x, y: yr + 0.014 * (1 - (x / Math.max(cx, 0.01)) ** 2), part: 'top' }); }
  const ring = [];
  for (const p of half) ring.push(new THREE.Vector3(p.x, p.y, z));
  for (let k = half.length - 2; k >= 0; k--) { const p = half[k]; ring.push(new THREE.Vector3(-p.x, p.y, z)); }
  return { ring, yb, yr, yWT, wT, rc };
}

function stations(a, b, step, extra = []) {
  const s = new Set();
  for (let z = a; z <= b + 1e-6; z += step) s.add(+z.toFixed(4));
  s.add(b);
  for (const e of extra) if (e >= a && e <= b) s.add(+e.toFixed(4));
  return [...s].sort((x, y) => x - y);
}

// pencere acikliklari (z araliklari) ve bolme citalari
const OPEN = [
  { z0: ZWS0 + 0.1, z1: 0.392, split: -0.355 }, // on kapi (on kelebek cam citasi 80'de)
  { z0: 0.472, z1: 1.232, split: 1.075 },       // arka kapi (sabit cam bolmesi)
  { z0: 1.298, z1: 1.912, split: null },        // arka yan cam
];

function buildBody(m, variant) {
  const out = [];
  const is80 = variant === 'kartal80';
  // ----- alt govde
  const archZ = [];
  for (const ax of [AXF, AXR]) for (let k = -ARCH_R; k <= ARCH_R + 1e-6; k += 0.02) archZ.push(ax + k);
  const zs = stations(ZF, ZR, 0.06, [...archZ, AXF - ARCH_R, AXF + ARCH_R, AXR - ARCH_R, AXR + ARCH_R, ZWS0, ZF + 0.01, ZF + 0.04, ZF + 0.1, ZR - 0.01, ZR - 0.04, ZR - 0.1,
    HOOD_Z0, HOOD_Z1, ...DOORS.flatMap((d) => [d.z0, d.z1])]);
  const secs = zs.map((z) => lowerSection(z, variant));
  const lower = loft(secs, {
    closedRing: true,
    capStart: is80 ? 'paint' : null, capEnd: null,
    classify: (i, j, c, a, b, cc, d) => {
      if (a.inner || b.inner || cc.inner || d.inner) return 'well';
      if (a.part === 'bottom' && b.part === 'bottom') return 'under';
      if (a.part === 'top' && b.part === 'top' && c.z > ZWS0 - 0.005) return null; // kabin/bagaj ust yuzu yok
      if (a.part === 'top' && b.part === 'top' && c.z > HOOD_Z0 && c.z < HOOD_Z1 && Math.abs(c.x) < hoodX(c.z)) return 'paint@hood';
      if ((a.part === 'side' || a.part === 'tcorner') && !a.inner) {
        const dn = doorAt(c);
        if (dn) return `paint@${dn}`;
      }
      // bagaj kapagi: arka yuzde dikis cizgileri arasi
      if (c.z > ZR - 0.06 && Math.abs(c.x) < TG_X && c.y > TG_Y0) return 'paint@hatch';
      return 'paint';
    },
  });
  // ----- kabin (camlar, direkler, tavan)
  const gz = stations(ZWS0, ZTG, 0.025, [
    ZWS0 + 0.035, ZWS1 - 0.02, ZWS1, ZRF, ZRF + 0.01, ZRF + 0.03,
    ...OPEN.flatMap((o) => [o.z0, o.z0 + 0.012, o.z1 - 0.012, o.z1, ...(o.split ? [o.split - 0.009, o.split + 0.009] : [])]),
    ...DOORS.flatMap((d) => [d.z0, d.z1]),
  ]);
  const gsec = gz.map((z) => greenSection(z));
  const tmpN = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const trimName = is80 ? 'chrome' : 'black';
  const classifyGreen = (i, j, c, a, b, cc, d) => {
      e1.subVectors(cc, a); e2.subVectors(b, d);
      tmpN.crossVectors(e1, e2).normalize();
      const g = gsec[i];
      const z = c.z, y = c.y, ax = Math.abs(c.x);
      const nx = Math.abs(tmpN.x), ny = Math.abs(tmpN.y), nz = Math.abs(tmpN.z);
      // on cam
      if (z < ZWS1 && ny > 0.35 && nx < 0.5) {
        if (z < ZWS0 + 0.035 || z > ZWS1 - 0.02 || ax > g.wT - g.rc - 0.015) return z < ZWS0 + 0.035 ? 'black' : trimName;
        return 'glass';
      }
      // arka (bagaj) cami: bagaj kapagiyla birlikte acilir
      if (z > ZRF && nz > 0.45 && nx < 0.5) {
        if (ax > g.wT - g.rc - 0.03) return 'paint';
        if (z < ZRF + 0.012 || y < g.yb + 0.03) return `${trimName}@hatch`;
        return 'glass@hatch';
      }
      if (nx > 0.5) {
        // yan camlar (kapi camlari ve cerceveleri kapiyla birlikte)
        const dn = doorAt(c);
        const tag = (k) => (dn ? `${k}@${dn}` : k);
        if (y > g.yWT) return 'paint';
        if (y < g.yb + 0.022) return tag('paint');
        const band = y < g.yb + 0.034 || y > g.yWT - 0.012;
        for (const o of OPEN) {
          if (z < o.z0 || z > o.z1) continue;
          if (band || z < o.z0 + 0.012 || z > o.z1 - 0.012) return tag(trimName);
          if (o.split && Math.abs(z - o.split) < 0.009 && (is80 || o.split > 0)) return tag(trimName);
          return tag('glass');
        }
        return tag('paint');
      }
      return 'paint';
  };
  const green = loft(gsec.map((g) => g.ring), { closedRing: false, classify: classifyGreen });
  // ic kaplama (tavan dosemesi + direk kaplamalari): dis kabugun iceri otelenmis, ice bakan kopyasi
  const inset = gsec.map((g) => {
    const r = g.ring, out2 = [];
    for (let j = 0; j < r.length; j++) {
      const p0 = r[Math.max(0, j - 1)], p1 = r[Math.min(r.length - 1, j + 1)];
      const tx = p1.x - p0.x, ty = p1.y - p0.y, l = Math.hypot(tx, ty) || 1;
      out2.push(new THREE.Vector3(r[j].x - (ty / l) * 0.012, r[j].y + (tx / l) * 0.012, r[j].z));
    }
    return out2;
  });
  const liner = loft(inset, {
    closedRing: false, flip: true,
    classify: (i, j) => {
      const R = gsec[i].ring, R2 = gsec[i + 1].ring;
      const a = R[j], b = R[j + 1], cc = R2[j + 1], d = R2[j];
      const c = new THREE.Vector3().copy(a).add(b).add(cc).add(d).multiplyScalar(0.25);
      return classifyGreen(i, j, c, a, b, cc, d).startsWith('glass') ? null : 'liner';
    },
  });
  for (const [k, geo] of lower) out.push([k, geo]);
  // arka yuz: bagaj kapagi bolgesi (dikisler arasi) kapaga, kalan cerceve govdeye
  {
    const ring = secs[secs.length - 1].map((q) => new THREE.Vector2(q.x, q.y));
    const ys = ring.map((q) => q.y), yMax = Math.max(...ys);
    const hatchPoly = [new THREE.Vector2(-TG_X, TG_Y0), new THREE.Vector2(TG_X, TG_Y0), new THREE.Vector2(TG_X, yMax + 0.01), new THREE.Vector2(-TG_X, yMax + 0.01)];
    // kapak: halka ile dikdortgenin kesisimi (Sutherland-Hodgman, dort yarim duzlem)
    let poly = ring.slice();
    const clip = (pl, inside, cut) => {
      const out2 = [];
      for (let k = 0; k < pl.length; k++) {
        const A = pl[k], B = pl[(k + 1) % pl.length];
        const ia = inside(A), ib = inside(B);
        if (ia) out2.push(A);
        if (ia !== ib) out2.push(cut(A, B));
      }
      return out2;
    };
    const atX = (X) => (A, B) => new THREE.Vector2(X, A.y + ((B.y - A.y) * (X - A.x)) / (B.x - A.x));
    const atY = (Y) => (A, B) => new THREE.Vector2(A.x + ((B.x - A.x) * (Y - A.y)) / (B.y - A.y), Y);
    poly = clip(poly, (q) => q.x <= TG_X, atX(TG_X));
    poly = clip(poly, (q) => q.x >= -TG_X, atX(-TG_X));
    poly = clip(poly, (q) => q.y >= TG_Y0, atY(TG_Y0));
    const hatchCap = new THREE.ShapeGeometry(new THREE.Shape(poly));
    hatchCap.translate(0, 0, ZR);
    out.push(['paint@hatch', hatchCap]);
    const shape = new THREE.Shape(ring);
    shape.holes.push(new THREE.Path(poly.slice().reverse()));
    const bodyCap = new THREE.ShapeGeometry(shape);
    bodyCap.translate(0, 0, ZR);
    out.push(['paint', bodyCap]);
    void hatchPoly;
  }
  for (const [k, geo] of green) out.push([k.startsWith('black') ? k.replace(/^black/, 'blackTrim') : k, geo]);
  for (const [k, geo] of liner) out.push([k, geo]);
  if (!is80) out.push(['paint', frontCapWithOpening(secs[0])]);
  return out;
}

// 90'lar on yuzu: far + izgara bandi govdede bir aciklik; arkasinda siyah "kova" ve icinde
// derinligi olan reflektorlu farlar durur (orijinaldeki gibi kaput kenari farlarin ustune tasar).
export const FRONT90 = { hx: 0.672, y0: 0.522, y1: 0.715, depth: 0.1 };

function frontCapWithOpening(ring) {
  const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, p.y)));
  const { hx, y0, y1 } = FRONT90, r = 0.018;
  const hole = new THREE.Path();
  hole.moveTo(-hx + r, y0);
  hole.lineTo(hx - r, y0); hole.quadraticCurveTo(hx, y0, hx, y0 + r);
  hole.lineTo(hx, y1 - r); hole.quadraticCurveTo(hx, y1, hx - r, y1);
  hole.lineTo(-hx + r, y1); hole.quadraticCurveTo(-hx, y1, -hx, y1 - r);
  hole.lineTo(-hx, y0 + r); hole.quadraticCurveTo(-hx, y0, -hx + r, y0);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 3);
  geo.deleteAttribute('uv');
  geo.rotateY(Math.PI);           // simetrik: x aynasi sorun degil, normal -z (one)
  geo.translate(0, 0, ring[0].z);
  return geo;
}

// ---------------------------------------------------------------- ayrintilar
function sidePoint(z, y, off = 0) {
  // alt govde yan yuzeyinde (sag taraf) yaklasik x
  const a = halfW(z), yt = yTop(z), yb = yBot(z);
  const t = Math.min(1, Math.max(0, (y - (yb + 0.085)) / Math.max(yt - 0.05 - (yb + 0.085), 0.01)));
  return a + 0.008 * Math.sin(Math.PI * t) - 0.01 * t + off;
}

function seamStrip(points, width = 0.0035) {
  // yuzeye yakin ince koyu cizgi (kapi araliklari)
  const prof = [{ x: -width / 2, y: -0.0007 }, { x: width / 2, y: -0.0007 }, { x: width / 2, y: 0.0007 }, { x: -width / 2, y: 0.0007 }];
  return sweep(points, prof, { up: new THREE.Vector3(1, 0, 0), caps: false });
}

function buildSeams(variant) {
  const geos = [];
  const tagged = [];
  const vLine = (z, y0, y1, side) => {
    const pts = [];
    for (let k = 0; k <= 12; k++) { const y = lerp(y0, y1, k / 12); pts.push(new THREE.Vector3(side * sidePoint(z, y, 0.0012), y, z)); }
    return seamStrip(pts);
  };
  for (const s of [-1, 1]) {
    const dF = `door${s > 0 ? 1 : 0}`, dR = `door${s > 0 ? 3 : 2}`;
    tagged.push([dF, vLine(-0.69, 0.33, yTop(-0.69) - 0.02, s)]);       // on kapi on kenari
    tagged.push([dF, vLine(0.44, 0.26, yTop(0.44) - 0.01, s)]);         // B
    tagged.push([dR, vLine(1.255, archTop(1.255) + 0.02, yTop(1.255) - 0.01, s)]); // arka kapi arka kenari
    // kapi alt kenari (esik ustu): her kapinin kendi parcasi
    for (const [name, z0, z1] of [[dF, -0.69, 0.44], [dR, 0.44, 0.78]]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) { const z = lerp(z0, z1, k / 12); pts.push(new THREE.Vector3(s * sidePoint(z, 0.345, 0.0012), 0.345, z)); }
      tagged.push([name, seamStrip(pts)]);
    }
    // kaput kenari (camurluk ustu)
    const hp = [];
    for (let k = 0; k <= 20; k++) { const z = lerp(ZF + 0.02, ZWS0 - 0.03, k / 20); const x = halfW(z) - 0.075; hp.push(new THREE.Vector3(s * x, yTop(z) + hoodCrown(z) * (1 - (x / halfW(z)) ** 2) + 0.0012, z)); }
    tagged.push(['hood', sweep(hp, [{ x: -0.002, y: -0.0006 }, { x: 0.002, y: -0.0006 }, { x: 0.002, y: 0.0006 }, { x: -0.002, y: 0.0006 }], { caps: false })]);
    // bagaj kapagi yan kenari (arka panel)
    const tp = [];
    for (let k = 0; k <= 10; k++) { const y = lerp(0.36, yTop(ZR) - 0.01, k / 10); tp.push(new THREE.Vector3(s * 0.69, y, ZR + 0.0015)); }
    tagged.push(['hatch', sweep(tp, [{ x: -0.002, y: -0.0006 }, { x: 0.002, y: -0.0006 }, { x: 0.002, y: 0.0006 }, { x: -0.002, y: 0.0006 }], { up: new THREE.Vector3(0, 0, 1), caps: false })]);
  }
  // kaput arka (cowl) cizgisi
  const cp = [];
  for (let k = 0; k <= 16; k++) { const x = lerp(-0.73, 0.73, k / 16); cp.push(new THREE.Vector3(x, yTop(ZWS0 - 0.04) + 0.0015, ZWS0 - 0.04)); }
  tagged.push(['hood', sweep(cp, [{ x: -0.002, y: -0.0006 }, { x: 0.002, y: -0.0006 }, { x: 0.002, y: 0.0006 }, { x: -0.002, y: 0.0006 }], { caps: false })]);
  void geos;
  return tagged;
}

function plateTexture(text) {
  return canvasTexture(512, 112, (ctx, w, h) => {
    ctx.fillStyle = '#f4f2ea'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#121212';
    ctx.font = 'bold 74px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

function grilleTexture() {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2.2;
    for (let y = 6; y < h; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 1.4;
    for (let x = 4; x < w; x += 9) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  }, { srgb: true });
}

function badgeTexture(text) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e6e6e6';
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

function lensTexture() {
  // far camindaki prizmatik dokular
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d8dde0'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(90,100,110,0.35)';
    for (let y = 0; y < h; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });
}

function tailTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let x = 0; x < w; x += 5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  });
}

function mesh(geo, mat, cast = true) {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = cast; o.receiveShadow = true;
  return o;
}

function meshTexture() {
  // 90'lar izgara petek agi (alfa testli)
  return canvasTexture(256, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#3a3b3d'; ctx.lineWidth = 3.2;
    for (let k = -h; k < w + h; k += 14) {
      ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + h * 0.6, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k, h); ctx.lineTo(k + h * 0.6, 0); ctx.stroke();
    }
  });
}

function rectLensTexture() {
  // dikdortgen far cami: dikey prizma oluklari, yatay bolmeler, altta buzlu bant
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e4e9ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    for (let x = 0; x < w; x += 7) ctx.fillRect(x, 0, 2, h);
    ctx.fillStyle = '#aab3bb';
    for (let y = 10; y < h; y += 18) ctx.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 1, h);
  });
}

/** One (-z) bakan icbukey reflektor: kenarlar z=0, merkez +depth (govde icine). */
function dishGeometry(w, h, depth, sx = 14, sy = 8) {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2);
    p.setZ(i, -depth * (1 - u * u) * (1 - v * v));
  }
  g.rotateY(Math.PI);
  g.computeVertexNormals();
  return g;
}

/** One dogru hafif bombeli far cami. */
function lensGeometry(w, h, bulge) {
  const g = new THREE.PlaneGeometry(w, h, 10, 5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2);
    p.setZ(i, bulge * (1 - 0.8 * u * u) * (1 - 0.8 * v * v));
  }
  g.rotateY(Math.PI);
  g.computeVertexNormals();
  return g;
}

/** 90'lar on yuzu (1994 Kartal SL fotograflarina gore). */
function buildFront90(m, g, lamps) {
  const { hx, y0, y1, depth } = FRONT90;
  const yc = (y0 + y1) / 2, hh = y1 - y0;
  // aciklik arkasindaki koyu kova (ic yuzleri gorunur)
  const bucket = mesh(new THREE.BoxGeometry(hx * 2, hh, depth), m.bucket, false);
  bucket.position.set(0, yc, ZF + depth / 2);
  g.add(bucket);
  const zL = ZF + 0.006;                  // cam duzlemi (kaput kenarindan 6 mm iceride)
  const lh = hh - 0.014, ly = yc;
  for (const s of [-1, 1]) {
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: rectLensTexture(), transparent: true, opacity: 0.26, roughness: 0.04,
      clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, emissive: 0xfff2d8, emissiveIntensity: 0, depthWrite: false,
    });
    // ana far
    const mx = s * 0.4115, mw = 0.307;
    const refl = mesh(dishGeometry(mw - 0.006, lh - 0.006, 0.058), m.reflector, false);
    refl.position.set(mx, ly, zL + 0.012); g.add(refl);
    const bulb = mesh(new THREE.SphereGeometry(0.013, 12, 8), m.chrome, false);
    bulb.position.set(mx, ly, zL + 0.046); g.add(bulb);
    const shield = mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.012, 14), m.chrome, false);
    shield.rotation.x = Math.PI / 2; shield.position.set(mx, ly, zL + 0.03); g.add(shield);
    // kose sinyali: seffaf cam arkasinda turuncu ampul
    const ix = s * 0.6215, iw = 0.093;
    const sr = mesh(dishGeometry(iw - 0.006, lh - 0.006, 0.035), m.sigRefl, false);
    sr.position.set(ix, ly, zL + 0.012); g.add(sr);
    const ab = mesh(new THREE.SphereGeometry(0.017, 12, 8), m.amber, false);
    ab.position.set(ix, ly - 0.01, zL + 0.032); g.add(ab);
    // iki cam tek cizim cagrisinda
    const lg1 = lensGeometry(mw, lh, 0.005).translate(mx, ly, zL);
    const lg2 = lensGeometry(iw, lh, 0.004).translate(ix, ly, zL);
    const lens = mesh(mergeInto([lg1, lg2]), lensMat, false);
    lens.renderOrder = 6;
    g.add(lens);
    lamps.push({ lens: lensMat, refl: m.reflector, x: mx, opacity: lensMat.opacity });
  }
  // izgara: cerceve + iki petek ag + orta dikme ve mavi T amblemi
  const gw = 0.496, gh = hh - 0.026;
  const zg = ZF + 0.002;
  const bar = (w, h, d, x, y, z, mat = m.grilleFrame) => { const o = mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h) * 0.3), mat, false); o.position.set(x, y, z); g.add(o); };
  bar(gw, 0.016, 0.03, 0, yc + gh / 2 - 0.008, zg);
  bar(gw, 0.016, 0.03, 0, yc - gh / 2 + 0.008, zg);
  for (const s of [-1, 1]) bar(0.016, gh, 0.03, s * (gw / 2 - 0.008), yc, zg);
  bar(0.05, gh, 0.034, 0, yc, zg - 0.002);
  const meshMat = new THREE.MeshStandardMaterial({ map: meshTexture(), alphaTest: 0.45, roughness: 0.6, side: THREE.DoubleSide });
  const mg = [-1, 1].map((s) => { const p = new THREE.PlaneGeometry(0.2, gh - 0.02); p.rotateY(Math.PI); p.translate(s * 0.1225, yc, ZF + 0.016); return p; });
  g.add(mesh(mergeInto(mg), meshMat, false));
  bar(0.052, 0.011, 0.008, 0, yc + 0.016, zg - 0.022, m.emblem);
  bar(0.013, 0.04, 0.008, 0, yc - 0.004, zg - 0.022, m.emblem);
}

function buildFront(m, variant, g) {
  const is80 = variant === 'kartal80';
  const zFace = ZF - 0.004;
  const lamps = [];
  if (is80) {
    // izgara paneli + krom cercevesi
    const grilleMat = new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.6, metalness: 0.2 });
    const gw = 1.46, gh = 0.26, gy = 0.6;
    const grille = mesh(new RoundedBoxGeometry(gw, gh, 0.03, 2, 0.01), grilleMat, false);
    grille.position.set(0, gy, zFace - 0.006);
    g.add(grille);
    const frame = sweep([new THREE.Vector3(-0.74, gy + gh / 2 + 0.008, zFace - 0.022), new THREE.Vector3(0.74, gy + gh / 2 + 0.008, zFace - 0.022)], roundRectProfile(0.012, 0.012, 0.004), { up: new THREE.Vector3(0, 0, -1) });
    g.add(mesh(frame, m.chrome, false));
  } else {
    buildFront90(m, g, lamps);
  }
  // farlar
  const addRound = (x, y, r) => {
    const lg = new THREE.Group();
    const bezel = lathe([[r + 0.012, -0.004], [r + 0.014, 0.012], [r + 0.006, 0.02], [r - 0.002, 0.014]], 40, 'z');
    lg.add(mesh(bezel, m.chrome, false));
    const refl = lathe([[0.001, -0.05], [r * 0.4, -0.045], [r * 0.85, -0.02], [r, 0.0]], 32, 'z');
    lg.add(mesh(refl, m.reflector, false));
    const lensMat = m.headLens.clone(); lensMat.map = lensTexture();
    const lens = lathe([[0.0005, 0.021], [r * 0.6, 0.019], [r * 0.95, 0.012], [r + 0.002, 0.004]], 40, 'z');
    lg.add(mesh(lens, lensMat, false));
    lens.userData.lens = true; lamps.push({ lens: lensMat, refl: m.reflector, x, opacity: lensMat.opacity });
    lg.rotation.y = Math.PI; // +z eksenli lathe -> one (-z) baksin
    lg.position.set(x, y, zFace - 0.012);
    g.add(lg);
  };
  if (is80) {
    for (const s of [-1, 1]) { addRound(s * 0.615, 0.6, 0.082); addRound(s * 0.44, 0.6, 0.07); }
    const emb = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 6), m.chrome, false);
    emb.rotation.x = Math.PI / 2; emb.position.set(0, 0.6, zFace - 0.026);
    g.add(emb);
  }
  // tampon
  const bumperPath = (zb, y, tail = 0.30) => {
    const pts = [];
    pts.push(new THREE.Vector3(-0.84, y, zb + tail));
    for (let k = 0; k <= 8; k++) { const an = Math.PI - (k / 8) * (Math.PI / 2); pts.push(new THREE.Vector3(-0.66 + 0.18 * Math.cos(an), y, zb + 0.18 - 0.18 * Math.sin(an))); }
    for (let k = 1; k < 10; k++) pts.push(new THREE.Vector3(lerp(-0.66, 0.66, k / 10), y, zb - 0.004 * Math.sin((k / 10) * Math.PI)));
    for (let k = 0; k <= 8; k++) { const an = Math.PI / 2 - (k / 8) * (Math.PI / 2); pts.push(new THREE.Vector3(0.66 + 0.18 * Math.cos(an), y, zb + 0.18 - 0.18 * Math.sin(an))); }
    pts.push(new THREE.Vector3(0.84, y, zb + tail));
    return pts;
  };
  if (is80) {
    const bar = sweep(bumperPath(ZF - 0.05, 0.43), [{ x: -0.025, y: -0.05 }, { x: 0.02, y: -0.056 }, { x: 0.032, y: -0.02 }, { x: 0.034, y: 0.03 }, { x: 0.02, y: 0.055 }, { x: -0.025, y: 0.05 }]);
    g.add(mesh(bar, m.chrome));
    // kaucuk uclar ve tampon babalari
    for (const s of [-1, 1]) {
      const cap = mesh(new RoundedBoxGeometry(0.1, 0.12, 0.26, 2, 0.03), m.rubber);
      cap.position.set(s * 0.79, 0.43, ZF + 0.06); g.add(cap);
      const ov = mesh(new RoundedBoxGeometry(0.06, 0.14, 0.05, 2, 0.02), m.rubber);
      ov.position.set(s * 0.33, 0.43, ZF - 0.09); g.add(ov);
      // alt sinyal lambalari
      const sig = mesh(new RoundedBoxGeometry(0.15, 0.045, 0.03, 2, 0.008), m.amber, false);
      sig.position.set(s * 0.6, 0.355, ZF - 0.04); g.add(sig);
    }
  } else {
    // buyuk, yanlara (camurluk yayina kadar) sarilan siyah plastik tampon; sinyaller farda
    const bar = sweep(bumperPath(ZF - 0.045, 0.4, 0.36), [{ x: -0.03, y: -0.11 }, { x: 0.03, y: -0.115 }, { x: 0.046, y: -0.06 }, { x: 0.05, y: 0.06 }, { x: 0.034, y: 0.1 }, { x: -0.03, y: 0.098 }]);
    g.add(mesh(bar, m.blackPlastic));
    // alt hava girisi
    const slot = mesh(new RoundedBoxGeometry(0.56, 0.038, 0.006, 2, 0.003), m.slot, false);
    slot.position.set(0, 0.317, ZF - 0.085); g.add(slot);
    const slat = mesh(new RoundedBoxGeometry(0.54, 0.007, 0.008, 1, 0.002), m.blackPlastic, false);
    slat.position.set(0, 0.317, ZF - 0.088); g.add(slat);
  }
  // plaka
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.114), new THREE.MeshStandardMaterial({ map: plateTexture('34 TK 1980'), roughness: 0.5 }), false);
  // tampon yuzunun (orta bombe dahil) 4 mm onunde
  plate.rotation.y = Math.PI; plate.position.set(0, is80 ? 0.43 : 0.41, ZF - (is80 ? 0.092 : 0.103));
  g.add(plate);
  return lamps;
}

function buildRear(m, variant, g) {
  const is80 = variant === 'kartal80';
  const zFace = ZR + 0.004;
  const tails = { tail: [], amber: [], reverse: [] };
  for (const s of [-1, 1]) {
    const grp = new THREE.Group();
    const tex = tailTexture();
    const segs = [['amber', 0.82, 0.07], ['tail', 0.69, 0.15], ['reverse', 0.585, 0.055]];
    for (const [kind, y, h] of segs) {
      const mat = m[kind === 'tail' ? 'tail' : kind].clone();
      mat.map = tex;
      const lamp = mesh(new RoundedBoxGeometry(0.13, h, 0.03, 2, 0.008), mat, false);
      lamp.position.set(0, y, 0);
      grp.add(lamp);
      tails[kind].push(mat);
    }
    const housing = mesh(new RoundedBoxGeometry(0.145, 0.32, 0.026, 2, 0.01), m.blackPlastic, false);
    housing.position.set(0, 0.72, -0.012); grp.add(housing);
    grp.position.set(s * 0.715, 0, zFace);
    g.add(grp);
  }
  // plaka + isigi
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.114), new THREE.MeshStandardMaterial({ map: plateTexture('34 TK 1980'), roughness: 0.5 }), false);
  plate.position.set(0, 0.64, zFace + 0.003);
  g.add(plate);
  const plateLamp = mesh(new RoundedBoxGeometry(0.2, 0.035, 0.04, 2, 0.01), is80 ? m.chrome : m.blackPlastic, false);
  plateLamp.position.set(0, 0.72, zFace + 0.012); g.add(plateLamp);
  // bagaj kolu
  const handle = mesh(new RoundedBoxGeometry(0.16, 0.03, 0.03, 2, 0.01), m.chrome, false);
  handle.position.set(0, 0.79, zFace + 0.01); g.add(handle);
  // yazilar
  const badgeMat = (t) => new THREE.MeshStandardMaterial({ map: badgeTexture(t), transparent: true, metalness: 1, roughness: 0.2, color: 0xffffff });
  const b1 = mesh(new THREE.PlaneGeometry(0.2, 0.05), badgeMat('TOFAŞ'), false); b1.position.set(-0.4, 0.86, zFace + 0.003); g.add(b1);
  const b2 = mesh(new THREE.PlaneGeometry(0.22, 0.055), badgeMat('KARTAL'), false); b2.position.set(0.4, 0.86, zFace + 0.003); g.add(b2);
  // tampon
  const pts = [];
  pts.push(new THREE.Vector3(-0.84, 0.0, ZR - 0.3));
  for (let k = 0; k <= 8; k++) { const an = Math.PI + (k / 8) * (Math.PI / 2); pts.push(new THREE.Vector3(-0.68 + 0.16 * Math.cos(an), 0, ZR - 0.16 - 0.16 * Math.sin(an))); }
  for (let k = 1; k < 10; k++) pts.push(new THREE.Vector3(lerp(-0.68, 0.68, k / 10), 0, ZR + 0.004 * Math.sin((k / 10) * Math.PI)));
  for (let k = 0; k <= 8; k++) { const an = -Math.PI / 2 + (k / 8) * (Math.PI / 2); pts.push(new THREE.Vector3(0.68 + 0.16 * Math.cos(an), 0, ZR - 0.16 - 0.16 * Math.sin(an))); }
  pts.push(new THREE.Vector3(0.84, 0, ZR - 0.3));
  const y = is80 ? 0.42 : 0.4;
  for (const p of pts) { p.z += 0.05; p.y = y; }
  if (is80) {
    g.add(mesh(sweep(pts, [{ x: -0.025, y: -0.05 }, { x: 0.02, y: -0.056 }, { x: 0.032, y: -0.02 }, { x: 0.034, y: 0.03 }, { x: 0.02, y: 0.055 }, { x: -0.025, y: 0.05 }].map((q) => ({ x: -q.x, y: q.y }))), m.chrome));
    for (const s of [-1, 1]) {
      const cap = mesh(new RoundedBoxGeometry(0.075, 0.105, 0.17, 2, 0.03), m.rubber);
      cap.position.set(s * 0.8, y, ZR - 0.07); g.add(cap);
    }
  } else {
    g.add(mesh(sweep(pts, [{ x: -0.03, y: -0.085 }, { x: 0.025, y: -0.09 }, { x: 0.04, y: -0.04 }, { x: 0.042, y: 0.05 }, { x: 0.02, y: 0.08 }, { x: -0.03, y: 0.075 }].map((q) => ({ x: -q.x, y: q.y }))), m.blackPlastic));
  }
  // egzoz
  const ex = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 12, 1, true), m.drum);
  ex.rotation.x = Math.PI / 2; ex.position.set(0.45, 0.24, ZR + 0.01); g.add(ex);
  return tails;
}

function buildSideDetails(m, variant, g) {
  const is80 = variant === 'kartal80';
  for (const s of [-1, 1]) {
    // yan cita
    const y = is80 ? 0.795 : 0.52;
    const pts = [];
    for (let k = 0; k <= 30; k++) {
      const z = lerp(AXF + ARCH_R + 0.02, AXR - ARCH_R - 0.02 + (is80 ? 0 : 0), k / 30);
      pts.push(new THREE.Vector3(s * sidePoint(z, y, 0.004), y, z));
    }
    const prof = is80 ? roundRectProfile(0.012, 0.008, 0.003) : roundRectProfile(0.045, 0.016, 0.006);
    g.add(mesh(sweep(pts, prof, { up: new THREE.Vector3(1, 0, 0) }), is80 ? m.chrome : m.blackPlastic));
    // kapi kollari
    for (const z of [0.31, 1.13]) {
      const h = mesh(new RoundedBoxGeometry(0.13, 0.026, 0.03, 2, 0.01), is80 ? m.chrome : m.blackPlastic, false);
      h.position.set(s * (sidePoint(z, 0.835, 0.012)), 0.835, z);
      g.add(h);
    }
    // ayna
    const mirror = new THREE.Group();
    const arm = mesh(new RoundedBoxGeometry(0.03, 0.03, 0.08, 2, 0.01), is80 ? m.chrome : m.blackPlastic, false);
    arm.position.set(0, 0, 0.0); mirror.add(arm);
    if (is80) {
      const head = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), m.chrome, false);
      head.rotation.x = Math.PI / 2; head.position.set(s * 0.04, 0.04, -0.03); mirror.add(head);
      const gl = mesh(new THREE.CircleGeometry(0.052, 24), m.mirror, false);
      gl.position.set(s * 0.04, 0.04, -0.0145); mirror.add(gl);
    } else {
      const head = mesh(new RoundedBoxGeometry(0.14, 0.09, 0.05, 2, 0.015), m.blackPlastic, false);
      head.position.set(s * 0.07, 0.04, -0.01); mirror.add(head);
      const gl = mesh(new THREE.PlaneGeometry(0.122, 0.074), m.mirror, false);
      gl.position.set(s * 0.07, 0.04, 0.0155); mirror.add(gl);
    }
    mirror.position.set(s * (halfW(-0.45) + 0.0), yTop(-0.45) + 0.06, -0.45);
    g.add(mirror);
    // ust bagaj rayi
    const rail = [];
    for (let k = 0; k <= 16; k++) { const z = lerp(0.05, 1.9, k / 16); rail.push(new THREE.Vector3(s * 0.58, yRoof(z) + 0.035, z)); }
    g.add(mesh(sweep(rail, roundRectProfile(0.022, 0.018, 0.006)), is80 ? m.chrome : m.blackPlastic));
    for (const z of [0.07, 1.88]) {
      const foot = mesh(new RoundedBoxGeometry(0.04, 0.045, 0.06, 2, 0.01), m.blackPlastic, false);
      foot.position.set(s * 0.58, yRoof(z) + 0.02, z); g.add(foot);
    }
  }
  if (!is80) {
    // marspiyel: iki camurluk arasinda, alt govde kosesine sarilan siyah plastik esik kaplamasi
    const cx = W - 0.085, cy = 0.295 + 0.085, R = 0.085;
    const prof = [];
    for (let k = 0; k <= 6; k++) { const an = -1.3 + (1.3 * k) / 6; prof.push({ x: cx + (R + 0.012) * Math.cos(an), y: cy + (R + 0.012) * Math.sin(an) }); }
    prof.push({ x: cx + R + 0.012, y: cy + 0.024 }, { x: cx + R - 0.004, y: cy + 0.024 });
    for (let k = 6; k >= 0; k--) { const an = -1.3 + (1.3 * k) / 6; prof.push({ x: cx + (R - 0.004) * Math.cos(an), y: cy + (R - 0.004) * Math.sin(an) }); }
    const z0 = AXF + ARCH_R + 0.012, z1 = AXR - ARCH_R - 0.012;
    for (const s of [-1, 1]) {
      const path = [];
      for (let k = 0; k <= 12; k++) path.push(new THREE.Vector3(0, 0, s > 0 ? lerp(z0, z1, k / 12) : lerp(z1, z0, k / 12)));
      g.add(mesh(sweep(path, prof), m.blackPlastic));
    }
  }
  // pacaliklar (camurluk tozluklari) - her tekerin arkasinda
  for (const s of [-1, 1]) {
    for (const az of [AXF, AXR]) {
      const flap = mesh(new RoundedBoxGeometry(0.2, 0.24, 0.012, 1, 0.004), m.rubber, true);
      const z = az + ARCH_R * 0.72;
      flap.position.set(s * (halfW(z) - 0.11), 0.24, z + 0.02);
      flap.rotation.x = 0.05;
      g.add(flap);
    }
  }
  // depo kapagi (sag arka)
  const cap = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 24), m.paint, false);
  cap.rotation.z = Math.PI / 2; cap.position.set(sidePoint(1.62, 0.8, 0.003), 0.8, 1.62); g.add(cap);
  // silecekler
  for (const x of [-0.42, 0.12]) {
    const wiper = mesh(new RoundedBoxGeometry(0.46, 0.012, 0.018, 1, 0.004), m.rubber, false);
    wiper.position.set(x + 0.17, yTop(ZWS0) + 0.035, ZWS0 + 0.05); wiper.rotation.set(-0.85, 0, 0.12); g.add(wiper);
  }
  // anten
  const ant = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.8, 6), m.chrome, false);
  ant.position.set(-0.72, yTop(-0.9) + 0.4, -0.9); ant.rotation.x = 0.12; g.add(ant);
}

// ---------------------------------------------------------------- ic mekan
function gaugeTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (speed = 0, rpm = 900, fuel = 0.75, temp = 0.5) => {
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, 512, 256);
    const dial = (cx, val, max, step, label) => {
      ctx.save(); ctx.translate(cx, 128);
      ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.arc(0, 0, 112, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7d7d7d'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let v = 0; v <= max; v += step) {
        const a = Math.PI * 0.75 + (v / max) * Math.PI * 1.5;
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 92, Math.sin(a) * 92); ctx.lineTo(Math.cos(a) * 106, Math.sin(a) * 106); ctx.stroke();
        ctx.fillText(String(label ? v / 1000 : v), Math.cos(a) * 74, Math.sin(a) * 74);
      }
      const a = Math.PI * 0.75 + (Math.min(val, max) / max) * Math.PI * 1.5;
      ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 96, Math.sin(a) * 96); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    dial(128, speed, 180, 20, false);
    dial(384, rpm, 7000, 1000, true);
    tex.needsUpdate = true;
  };
  draw();
  return { tex, draw };
}

function buildInterior(m, g) {
  const parts = {};
  // taban, kapi panelleri
  const floor = mesh(new THREE.BoxGeometry(1.48, 0.02, 2.62), m.interior, false); floor.position.set(0, 0.34, 0.7); g.add(floor);
  for (const s of [-1, 1]) {
    for (const d of DOORS) {
      const door = mesh(new THREE.BoxGeometry(0.02, 0.5, d.z1 - d.z0 - 0.03), m.interior, false);
      door.position.set(s * 0.74, 0.64, (d.z0 + d.z1) / 2); g.add(door);
    }
    const rearTrim = mesh(new THREE.BoxGeometry(0.02, 0.52, 0.8), m.interior, false);
    rearTrim.position.set(s * 0.74, 0.64, 1.66); g.add(rearTrim);
  }
  // torpido
  const dash = mesh(new RoundedBoxGeometry(1.5, 0.2, 0.38, 3, 0.05), m.dash, false);
  dash.position.set(0, 0.84, ZWS0 + 0.2); g.add(dash);
  // gosterge yuvasi (direksiyonun ust yarisindan gorunur) ve gunluk siperi
  const binnacle = mesh(new RoundedBoxGeometry(0.42, 0.16, 0.1, 2, 0.03), m.dash, false);
  binnacle.position.set(-0.36, 0.95, ZWS0 + 0.32); g.add(binnacle);
  const hood = mesh(new RoundedBoxGeometry(0.44, 0.035, 0.15, 2, 0.012), m.dash, false);
  hood.position.set(-0.36, 1.035, ZWS0 + 0.35); hood.rotation.x = 0.1; g.add(hood);
  // gostergeler: surucunun gozune donuk
  const gauges = gaugeTexture();
  const gp = mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: gauges.tex, toneMapped: false }), false);
  gp.position.set(-0.36, 0.95, ZWS0 + 0.415); gp.rotation.x = -0.35;
  g.add(gp);
  parts.gauges = gauges;
  // direksiyon (sol direksiyonlu)
  const sw = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(0.19, 0.016, 10, 40), m.rubber, false); sw.add(rim);
  // T kollu (3, 9 ve 6 yonu): ust yarida gostergeleri kapatan kol yok
  for (const a of [0, Math.PI, -Math.PI / 2]) {
    const sp = mesh(new THREE.BoxGeometry(0.17, 0.025, 0.012), m.dash, false);
    sp.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0); sp.rotation.z = a; sw.add(sp);
  }
  const hub = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 16), m.dash, false); hub.rotation.x = Math.PI / 2; sw.add(hub);
  const swHolder = new THREE.Group();
  swHolder.add(sw);
  swHolder.position.set(-0.36, 0.88, ZWS0 + 0.53);
  swHolder.rotation.x = -0.42;
  g.add(swHolder);
  parts.steeringWheel = sw;
  // koltuklar
  for (const x of [-0.36, 0.36]) {
    const cushion = mesh(new RoundedBoxGeometry(0.5, 0.13, 0.5, 3, 0.05), m.seat, false); cushion.position.set(x, 0.46, 0.18); g.add(cushion);
    const back = mesh(new RoundedBoxGeometry(0.5, 0.58, 0.12, 3, 0.05), m.seat, false); back.position.set(x, 0.78, 0.47); back.rotation.x = 0.16; g.add(back);
    const head = mesh(new RoundedBoxGeometry(0.26, 0.16, 0.1, 2, 0.04), m.seat, false); head.position.set(x, 1.12, 0.53); head.rotation.x = 0.16; g.add(head);
  }
  const bench = mesh(new RoundedBoxGeometry(1.36, 0.13, 0.5, 3, 0.05), m.seat, false); bench.position.set(0, 0.46, 1.05); g.add(bench);
  const bback = mesh(new RoundedBoxGeometry(1.36, 0.52, 0.12, 3, 0.05), m.seat, false); bback.position.set(0, 0.74, 1.32); bback.rotation.x = 0.14; g.add(bback);
  // vites kolu
  const lever = mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.25, 8), m.chrome, false); lever.position.set(0, 0.5, -0.12); lever.rotation.x = -0.25; g.add(lever);
  const knob = mesh(new THREE.SphereGeometry(0.025, 12, 10), m.dash, false); knob.position.set(0, 0.62, -0.15); g.add(knob);
  // dikiz aynasi
  // ic dikiz aynasi: surucu ile arka cam arasini gosterecek aciyla dondurulmus ayna yuzeyi
  const rvg = new THREE.Group();
  rvg.add(mesh(new RoundedBoxGeometry(0.19, 0.056, 0.025, 2, 0.01), m.dash, false));
  const rglass = mesh(new THREE.PlaneGeometry(0.176, 0.044), m.mirror, false);
  rglass.position.z = 0.0135; rvg.add(rglass);
  rvg.position.set(0, 1.29, ZWS1 + 0.09); rvg.rotation.set(0.15, -0.41, 0, 'YXZ');
  g.add(rvg);
  const stem = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), m.dash, false);
  stem.position.set(0, 1.335, ZWS1 + 0.075); g.add(stem);
  return parts;
}

// ---------------------------------------------------------------- tekerlekler
function tireTextures() {
  const normal = normalMapFromHeight(512, 128, (u, v) => {
    // v: profil boyunca (0..1), u: cevre boyunca
    if (v < 0.36 || v > 0.64) return 0.5 + 0.03 * Math.sin(u * 600); // yanak
    const w = (v - 0.36) / 0.28;
    let h = 1;
    for (const g of [0.25, 0.5, 0.75]) if (Math.abs(w - g) < 0.035) h = 0;   // cevresel oluklar
    const block = (u * 72) % 1;
    if (block < 0.12) h *= 0.3;                                             // enine oluklar
    if (Math.abs(((u * 144 + w * 2) % 1) - 0.5) < 0.04) h *= 0.6;           // sipe
    return h;
  }, 3.5);
  return { normal };
}

function buildWheel(m, side, tires, variant) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.92, normalMap: tires.normal, normalScale: new THREE.Vector2(0.8, 0.8) });
  const tire = lathe([
    [0.176, -0.068], [0.2, -0.079], [0.24, -0.083], [0.268, -0.079], [0.281, -0.068], [0.2865, -0.05],
    [0.287, -0.02], [0.287, 0.02], [0.2865, 0.05], [0.281, 0.068], [0.268, 0.079], [0.24, 0.083], [0.2, 0.079], [0.176, 0.068],
  ], 48, 'x');
  spin.add(mesh(tire, tireMat));
  // celik jant: dis cember + gobek diski
  const rim = lathe([[0.172, -0.072], [0.178, -0.066], [0.166, -0.06], [0.164, 0.04], [0.176, 0.05], [0.172, 0.058], [0.16, 0.055], [0.15, 0.03], [0.12, 0.022], [0.07, 0.03], [0.04, 0.032]], 40, 'x');
  spin.add(mesh(rim, m.steel));
  if (variant === 'kartal90') {
    // 90'lar: jantin tamamini orten gumus plastik kapak, cevresinde havalandirma yariklari
    const cover = lathe([[0.171, 0.046], [0.17, 0.054], [0.163, 0.06], [0.14, 0.0625], [0.1, 0.0635], [0.072, 0.067], [0.045, 0.069], [0.001, 0.0695]], 40, 'x');
    spin.add(mesh(cover, m.hubcap, false));
    const slots = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const sg = new THREE.BoxGeometry(0.004, 0.026, 0.011);
      sg.rotateX(a);
      sg.translate(0.0635, Math.cos(a) * 0.124, Math.sin(a) * 0.124);
      slots.push(sg);
    }
    const logo = new THREE.CylinderGeometry(0.024, 0.024, 0.004, 20);
    logo.rotateZ(Math.PI / 2); logo.translate(0.0705, 0, 0);
    slots.push(logo);
    spin.add(mesh(mergeInto(slots), m.slot, false));
  } else {
    // krom jant kapagi
    const cap = lathe([[0.128, 0.034], [0.124, 0.046], [0.11, 0.054], [0.08, 0.06], [0.04, 0.064], [0.001, 0.065]], 40, 'x');
    spin.add(mesh(cap, m.chrome, false));
    // bijonlar (kapak uzerinde kabartma), tek geometri
    const nuts = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const nut = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6);
      nut.rotateZ(Math.PI / 2); nut.translate(0.064, Math.cos(a) * 0.075, Math.sin(a) * 0.075);
      nuts.push(nut);
    }
    spin.add(mesh(mergeInto(nuts), m.chrome, false));
  }
  // fren kampanasi (donmez)
  const drum = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.09, 24), m.drum, false);
  drum.rotation.z = Math.PI / 2; drum.position.x = -0.03;
  g.add(drum);
  if (side < 0) g.scale.x = -1;
  return { group: g, spin };
}

// ---------------------------------------------------------------- ana sinif
export class KartalModel {
  constructor({ variant = 'kartal80', paint = 'lacivert' } = {}) {
    this.variant = variant;
    this.root = new THREE.Group();
    this.root.name = 'TofasKartal';
    this.body = new THREE.Group();     // zemin uzayi
    this.root.add(this.body);
    const m = (this.mats = makeMaterials(paint));
    this._makeParts();
    // govde ("malzeme@parca" adlari menteseli parcalara gider)
    for (const [tagged, geo] of buildBody(m, variant)) {
      const [name, part] = tagged.split('@');
      const mat = { paint: m.paint, well: m.well, under: m.under, glass: m.glass, chrome: m.chrome, blackTrim: m.rubber, black: m.rubber, liner: m.liner }[name] || m.paint;
      const o = mesh(geo, mat, name !== 'glass');
      if (name === 'glass') o.renderOrder = 5;
      (part ? this.parts[part].inner : this.body).add(o);
    }
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    for (const [part, geo] of buildSeams(variant)) (part ? this.parts[part].inner : this.body).add(mesh(geo, seamMat, false));
    this.headLamps = buildFront(m, variant, this.body);
    this.tails = buildRear(m, variant, this.body);
    buildSideDetails(m, variant, this.body);
    const parts = buildInterior(m, this.body);
    this.steeringWheel = parts.steeringWheel;
    this.gauges = parts.gauges;
    this._assignDetails();
    this.frontZ = -1.75;
    // motor bolmesi: Fiat 131 OHC sira 4 (kirmizi supap kapagi)
    this.body.add(buildEngineBay({ z0: ZF + 0.12, z1: ZWS0 - 0.06, halfW: W - 0.06, yTop: yTop(-1.4) - 0.05, yLow: 0.36, layout: 'i4', archTop: ARCH_CY + ARCH_R, accent: 0x9c1a12 }));
    // tekerlekler (fizik konumlandirir; govde-yerel)
    const tires = tireTextures();
    this.wheels = [];
    for (const s of [-1, 1, -1, 1]) {
      const w = buildWheel(m, s, tires, variant);
      this.root.add(w.group);
      this.wheels.push(w);
    }
    // farlar icin spot isiklar
    this.spots = [];
    for (const s of [-1, 1]) {
      const sp = new THREE.SpotLight(0xfff1d6, 0, 70, 0.42, 0.55, 1.6);
      const lx = variant === 'kartal80' ? 0.55 : 0.41;
      sp.position.set(s * lx, 0.6, ZF - 0.05);
      sp.target.position.set(s * (lx + 0.25), 0.0, ZF - 25);
      sp.castShadow = false;
      this.body.add(sp, sp.target);
      this.spots.push(sp);
    }
    this.optimize();
    this.prepareDamage();
  }

  /**
   * Dokusuz ve hareketsiz parcalari malzemeye gore tek geometride birlestirir
   * (~150 cizim cagrisi -> ~20). Direksiyon, tekerlekler ve dokulu parcalar ayri kalir.
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
      const m = mesh(geo, mat, b.cast);
      m.renderOrder = b.order;
      body.add(m);
    }
    // parca icinde ayni malzemeli dokusuz geometriler (zemin uzayinda kalir)
    for (const p of Object.values(this.parts)) {
      const pb = new Map(), rem = [];
      p.inner.updateMatrixWorld(true);
      const pinv = new THREE.Matrix4().copy(p.inner.matrixWorld).invert();
      p.inner.traverse((o) => {
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
        p.inner.add(o);
      }
    }
  }

  /** Menteseli parca gruplari: dis grup mentese noktasinda (doner), ic grup -mentese. */
  _makeParts() {
    this.parts = {};
    const mk = (name, pivot) => {
      const group = new THREE.Group(); group.name = name; group.position.copy(pivot);
      const inner = new THREE.Group(); inner.position.copy(pivot).negate();
      group.add(inner);
      this.body.add(group);
      this.parts[name] = { name, group, inner, pivot: pivot.clone() };
    };
    mk('hood', new THREE.Vector3(0, yTop(HOOD_Z1) + 0.01, HOOD_Z1));
    DOORS.forEach((d, k) => {
      for (const s of [-1, 1]) mk(`door${k * 2 + (s > 0 ? 1 : 0)}`, new THREE.Vector3(s * (halfW(d.z0) - 0.005), (DOOR_Y0 + yTop(d.z0)) / 2, d.z0));
    });
    mk('hatch', new THREE.Vector3(0, ROOF - 0.02, ZRF - 0.01));
  }

  /** Kapilara/kapaga monte ayrintilar (ayna, kol, plaka, yazilar...) konumlarina gore parcaya tasinir. */
  _assignDetails() {
    const body = this.body;
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const partSet = new Set(Object.values(this.parts).map((p) => p.group));
    for (const o of [...body.children]) {
      if (partSet.has(o) || o === this.steeringWheel) continue;
      box.setFromObject(o);
      if (box.isEmpty()) continue;
      box.applyMatrix4(inv);
      box.getCenter(c);
      const size = box.getSize(new THREE.Vector3());
      if (size.z > 1.2) continue;   // uzun citalar govdede kalir
      let target = null;
      const dn = Math.abs(c.x) > W - 0.12 ? doorAt(c) : null;
      if (dn && c.y < yTop(c.z) + 0.2) target = dn;
      else if (c.z > ZR - 0.06 && Math.abs(c.x) < TG_X - 0.02 && c.y > TG_Y0 + 0.08) target = 'hatch';
      if (target) this.parts[target].inner.attach(o);
    }
  }

  /** Hasar icin birlesik govde geometrilerinin orijinal konum/normallerini sakla. */
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
    for (const p of Object.values(this.parts)) collect(p.inner, p);
    this.broken = { L: false, R: false, glass: false };
  }

  /**
   * Govdeyi bir noktada ice gocert. p ve dir zemin (govde) uzayinda; dir = ice dogru birim vektor.
   * Goculen ucgenlerin normalleri yuzey bazinda yeniden hesaplanir (buruşuk sac gorunumu).
   */
  deform(p, dir, amount, radius) {
    if (!this.deformables) this.prepareDamage();
    const r2 = radius * radius, maxDisp = 0.2;
    const hash = (x, y, z) => {
      const h = Math.sin(Math.round(x * 40) * 12.9898 + Math.round(y * 40) * 78.233 + Math.round(z * 40) * 37.719) * 43758.5453;
      return h - Math.floor(h);
    };
    const lp = new THREE.Vector3(), ld = new THREE.Vector3(), M = new THREE.Matrix4(), N3 = new THREE.Matrix3();
    for (const d of this.deformables) {
      let P = p, D = dir;
      if (d.part) {
        if (d.part.group.parent !== this.body) continue;   // kopmus parca
        // govde -> parca geometri uzayi: (dis grup * ic grup)^-1
        M.multiplyMatrices(d.part.group.matrix, d.part.inner.matrix).invert();
        P = lp.copy(p).applyMatrix4(M);
        D = ld.copy(dir).applyMatrix3(N3.setFromMatrix4(M)).normalize();
      }
      const g = d.mesh.geometry;
      const bs = g.boundingSphere;
      if (bs && bs.center.distanceTo(P) > bs.radius + radius) continue;
      const a = g.attributes.position.array, o = d.orig, n = g.attributes.normal.array;
      const tris = new Set();
      for (let i = 0; i < a.length; i += 3) {
        const dx = a[i] - P.x, dy = a[i + 1] - P.y, dz = a[i + 2] - P.z;
        const q = dx * dx + dy * dy + dz * dz;
        if (q > r2) continue;
        const f = 1 - Math.sqrt(q) / radius;
        const k = amount * f * f * (0.7 + 0.6 * hash(o[i], o[i + 1], o[i + 2]));
        let x = a[i] + D.x * k, y = a[i + 1] + D.y * k, z = a[i + 2] + D.z * k;
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
        // orijinal normal yonunu koru (ters cevrilmis ucgen olmasin)
        if (nx * n[b] + ny * n[b + 1] + nz * n[b + 2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
        for (let k = 0; k < 3; k++) { n[b + k * 3] = nx; n[b + k * 3 + 1] = ny; n[b + k * 3 + 2] = nz; }
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.normal.needsUpdate = true;
    }
  }

  /** Bir taraftaki farlari kir (L/R). */
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
    g.roughness = 0.38; g.opacity = 0.62; g.color.set(0x8c9599); g.clearcoatRoughness = 0.4;
  }

  /** Hasari ve kiri tamamen onar. */
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
    for (const l of this.headLamps) { l.lens.color.set(0xffffff); l.lens.opacity = l.opacity ?? 0.55; l.dead = false; }
    const g = this.mats.glass;
    g.roughness = 0.02; g.opacity = 0.42; g.color.set(0x0b1416); g.clearcoatRoughness = 0;
    this.broken = { L: false, R: false, glass: false };
    this.mats.dirt.uDirt.value = 0;
  }

  setDirt(v, color) {
    this.mats.dirt.uDirt.value = v;
    if (color) this.mats.dirt.uDirtColor.value.setRGB(color[0], color[1], color[2]);
  }

  /** Dinamik yansima haritasi alacak malzemeler. */
  reflectiveMaterials() {
    const set = new Set([this.mats.paint, this.mats.chrome, this.mats.glass, this.mats.reflector, this.mats.steel, this.mats.hubcap, this.mats.sigRefl, this.mats.emblem, this.mats.mirror]);
    for (const l of this.headLamps) set.add(l.lens);
    for (const k of ['tail', 'amber', 'reverse']) for (const m of this.tails[k]) set.add(m);
    return [...set];
  }

  /** Zemin uzayini fizik govde uzayina hizalar (CG orijin). */
  alignToPhysics(cgHeight) {
    this.body.position.set(0, -cgHeight, -CG_Z);
  }

  setPaint(id) {
    const p = PAINTS[id];
    if (!p) return;
    this.mats.paint.color.set(p.color);
    this.mats.paint.metalness = p.metal || 0;
    this.mats.paint.roughness = p.metal ? 0.4 : 0.36;
  }

  setLights({ head = false, brake = 0, reverse = false, tail = false } = {}) {
    for (const l of this.headLamps) { l.lens.emissiveIntensity = head && !l.dead ? 2.2 : 0; }
    this.mats.reflector.emissiveIntensity = head ? 1.5 : 0;
    this.spots[0].intensity = head && !(this.broken && this.broken.L) ? 60 : 0;
    this.spots[1].intensity = head && !(this.broken && this.broken.R) ? 60 : 0;
    const tailI = (tail || head ? 0.9 : 0.15) + brake * 3.2;
    for (const t of this.tails.tail) t.emissiveIntensity = tailI;
    for (const t of this.tails.reverse) t.emissiveIntensity = reverse ? 2.5 : 0;
  }
}
