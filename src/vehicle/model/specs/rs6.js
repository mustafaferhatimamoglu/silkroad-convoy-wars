import * as THREE from 'three';
import { mesh, box, shapeFrom, extrudeFront, textTexture, honeycombTexture, lerp, smooth } from '../CarModel.js';
import { sweep, mergeInto } from '../carkit.js';

// Audi RS 6 Avant (C8, 2020). Olculer: uzunluk 4.995, genislik 1.951, yukseklik 1.46,
// dingil mesafesi 2.929 m; 285/30 R22. Alcak ve genis station: dort camurlukta "quattro"
// siskinligi, petek desenli tek parca izgara, ince keskin farlar, iri yan hava girisleri,
// uzun tavan, egimli D diregi, cam arka spoyler, difuzor ve iki oval egzoz ucu.

const ZF = -2.27, ZN = -2.19, ZWS0 = -0.62, ZWS1 = 0.4, ZROOF1 = 2.06, ZGH1 = 2.6, ZEND = 2.72;
const AXF = -1.29, AXR = 1.639;
const HW = 0.93;
const COWL = 0.98, HOOD_F = 0.77, BELT = 1.0, ROOF = 1.455;
const RZ = 0.32, RX = 0.13, RZB = 0.22, RXB = 0.09;

function halfW(z) {
  if (z < ZN + RZ) { const u = Math.min(1, (ZN + RZ - z) / RZ); return HW - RX + RX * Math.sqrt(Math.max(0, 1 - u * u)); }
  if (z > ZEND - RZB) { const u = Math.min(1, (z - (ZEND - RZB)) / RZB); return HW - RXB + RXB * Math.sqrt(Math.max(0, 1 - u * u)); }
  return HW;
}
function zOutline(x) {
  const ax = Math.abs(x);
  if (ax <= HW - RX) return ZN;
  const v = Math.min(1, (ax - (HW - RX)) / RX);
  return ZN + RZ - RZ * Math.sqrt(Math.max(0, 1 - v * v));
}
function zOutlineRear(x) {
  const ax = Math.abs(x);
  if (ax <= HW - RXB) return ZEND;
  const v = Math.min(1, (ax - (HW - RXB)) / RXB);
  return ZEND - RZB + RZB * Math.sqrt(Math.max(0, 1 - v * v));
}
function yTop(z) {
  if (z < ZWS0) {
    const t = (z - ZN) / (ZWS0 - ZN);
    return lerp(HOOD_F, COWL, Math.pow(Math.max(0, t), 0.75)) - 0.05 * (1 - smooth((z - ZN) / 0.14));
  }
  return lerp(COWL, BELT, smooth((z - ZWS0) / 0.5)) + 0.025 * smooth((z - 0.4) / 2.0);
}
function yBot(z) { return z < AXF - 0.3 ? 0.3 : 0.2; }
// camurluk siskinlikleri (quattro blister) belin altinda kalir
function bulge(z) { return 0.042 * Math.exp(-(((z - AXF) / 0.62) ** 4)) + 0.048 * Math.exp(-(((z - AXR) / 0.6) ** 4)); }
function sideShape(y, z) {
  const fade = 1 - smooth((y - 0.74) / 0.2);
  return bulge(z) * fade - 0.03 * smooth((y - 0.86) / 0.14) + 0.006 * Math.exp(-((y - 0.84) ** 2) / 0.0006);
}
function crown(x, z, ax) {
  if (z > ZWS0) return 0;
  const u = x / Math.max(ax, 0.01);
  return 0.03 * (1 - u * u) + 0.012 * smooth((0.36 - Math.abs(x)) / 0.1);
}
function yRoof(z) {
  if (z <= ZWS0) return yTop(z);
  if (z < ZWS1) { const t = (z - ZWS0) / (ZWS1 - ZWS0); return lerp(yTop(ZWS0), ROOF - 0.005, Math.pow(t, 0.8)) + 0.03 * Math.sin(t * Math.PI); }
  if (z < ZROOF1) { const t = (z - ZWS1) / (ZROOF1 - ZWS1); return ROOF - 0.005 + 0.01 * Math.sin(t * Math.PI) - 0.02 * t; }
  const t = Math.min(1, (z - ZROOF1) / (ZGH1 - ZROOF1));
  return lerp(ROOF - 0.025, yTop(ZGH1) + 0.002, Math.pow(t, 1.25));
}

function materials(m) {
  m.red = new THREE.MeshStandardMaterial({ color: 0xb01515, roughness: 0.4, metalness: 0.2 });
  m.alu = new THREE.MeshStandardMaterial({ color: 0xb9bcbf, metalness: 0.9, roughness: 0.38 });
}

function front(ctx) {
  const { m, add, lamps } = ctx;
  const outlinePath = (y, inset, x0, x1, n = 36) => {
    const pts = [];
    for (let k = 0; k <= n; k++) { const x = lerp(x0, x1, k / n); pts.push(new THREE.Vector3(x, y, zOutline(x) - inset)); }
    return pts;
  };
  // on tampon govdesi (govde renkli), alt splitter (parlak siyah)
  const bump = [{ x: -0.12, y: -0.16 }, { x: 0.03, y: -0.16 }, { x: 0.07, y: -0.12 }, { x: 0.08, y: 0.0 }, { x: 0.07, y: 0.12 }, { x: 0.03, y: 0.16 }, { x: -0.12, y: 0.16 }];
  add(mesh(sweep(outlinePath(0.45, 0.0, -0.965, 0.965), bump), m.paint));
  add(mesh(sweep(outlinePath(0.215, 0.0, -0.9, 0.9), [{ x: -0.15, y: -0.016 }, { x: 0.06, y: -0.016 }, { x: 0.068, y: 0.0 }, { x: 0.056, y: 0.018 }, { x: -0.15, y: 0.018 }]), m.blackGloss));
  // tek parca izgara: parlak siyah cerceve, 3B petek
  const Zg = ZN - 0.085;
  const outer = [[-0.41, 0.765], [0.41, 0.765], [0.5, 0.67], [0.53, 0.5], [0.47, 0.33], [-0.47, 0.33], [-0.53, 0.5], [-0.5, 0.67]];
  const inner = [[-0.38, 0.735], [0.38, 0.735], [0.465, 0.66], [0.495, 0.5], [0.445, 0.36], [-0.445, 0.36], [-0.495, 0.5], [-0.465, 0.66]];
  add(mesh(extrudeFront(shapeFrom(outer, [inner]), Zg, 0.09, 0.008), m.blackGloss));
  const hc = honeycombTexture({ cell: 30, line: 7, color: '#0d0e10' });
  hc.repeat.set(2.2, 4.4);
  const hcMat = new THREE.MeshStandardMaterial({ map: hc, alphaTest: 0.4, roughness: 0.25, metalness: 0.2, side: THREE.DoubleSide });
  const insert = new THREE.ShapeGeometry(shapeFrom(inner)); insert.translate(0, 0, Zg + 0.03);
  add(mesh(insert, hcMat, false));
  const back = new THREE.ShapeGeometry(shapeFrom(inner)); back.translate(0, 0, Zg + 0.085); add(mesh(back, m.seam, false));
  // dort halka (krom) ve RS 6 rozeti
  const rings = [];
  for (let k = 0; k < 4; k++) { const t = new THREE.TorusGeometry(0.042, 0.0075, 8, 32); t.translate((k - 1.5) * 0.062, 0.68, 0); rings.push(t); }
  const rg = mergeInto(rings); rg.translate(0, 0, Zg - 0.012); add(mesh(rg, m.chrome, false));
  const badge = new THREE.PlaneGeometry(0.11, 0.035); badge.rotateY(Math.PI); badge.translate(-0.33, 0.43, Zg - 0.012);
  const bm = mesh(badge, new THREE.MeshStandardMaterial({ map: textTexture('RS 6', { w: 256, h: 80, font: 'italic bold 60px Arial', color: '#e8e8e8' }), transparent: true, alphaTest: 0.3 }), false);
  bm.userData.keep = true; add(bm);
  // iri yan hava girisleri (petek + yatay bicak)
  for (const s of [-1, 1]) {
    const o = [[0.56, 0.58], [0.86, 0.61], [0.88, 0.33], [0.6, 0.29]].map(([x, y]) => [s * x, y]);
    const i = [[0.58, 0.56], [0.84, 0.585], [0.86, 0.35], [0.615, 0.315]].map(([x, y]) => [s * x, y]);
    if (s < 0) { o.reverse(); i.reverse(); }
    const zi = zOutline(s * 0.74) - 0.1;
    // tamponun onunde parlak siyah cerceve, icte petek ve koyu fon
    add(mesh(extrudeFront(shapeFrom(o, [i]), zi, 0.06, 0.006), m.blackGloss, false));
    const ins = new THREE.ShapeGeometry(shapeFrom(i)); ins.translate(0, 0, zi + 0.012); add(mesh(ins, hcMat, false));
    const bk = new THREE.ShapeGeometry(shapeFrom(i)); bk.translate(0, 0, zi + 0.05); add(mesh(bk, m.seam, false));
    add(mesh(box(0.27, 0.016, 0.03, 0.006).translate(s * 0.73, 0.46, zi + 0.005), m.alu, false));
  }
  // farlar: ince, keskin; alt kenarda bolumlu LED imza
  for (const s of [-1, 1]) {
    const path = [];
    for (let k = 0; k <= 24; k++) { const x = s * lerp(0.475, 0.9, k / 24); path.push(new THREE.Vector3(x, lerp(0.735, 0.775, k / 24), zOutline(x) - 0.01)); }
    if (s < 0) path.reverse();
    const sc = (t) => (s > 0 ? lerp(0.7, 1.0, t) : lerp(1.0, 0.7, t));
    add(mesh(sweep(path, [{ x: -0.08, y: -0.045 }, { x: 0.004, y: -0.045 }, { x: 0.004, y: 0.045 }, { x: -0.08, y: 0.045 }], { scale: sc }), m.reflector, false));
    add(mesh(sweep(path, [{ x: 0.0, y: 0.04 }, { x: 0.018, y: 0.04 }, { x: 0.018, y: 0.052 }, { x: 0.0, y: 0.052 }], { scale: sc }), m.blackGloss, false));
    const lensMat = m.headLens.clone();
    const lm = mesh(sweep(path, [{ x: 0.0, y: -0.048 }, { x: 0.016, y: -0.03 }, { x: 0.019, y: 0.0 }, { x: 0.016, y: 0.035 }, { x: 0.0, y: 0.05 }], { scale: sc, caps: false, closed: false }), lensMat, false);
    lm.renderOrder = 6; add(lm);
    for (let k = 0; k < 6; k++) {
      const x = s * lerp(0.53, 0.84, k / 5);
      add(mesh(box(0.045, 0.012, 0.008, 0.003).translate(x, lerp(0.712, 0.735, k / 5), zOutline(x) - 0.012), m.drl, false));
    }
    for (const px of [0.6, 0.7, 0.8]) {
      const x = s * px;
      const pr = mesh(new THREE.SphereGeometry(0.018, 14, 10), m.blackGloss, false); pr.position.set(x, 0.76, zOutline(x) - 0.004); add(pr);
    }
    lamps.push({ lens: lensMat, x: s * 0.7, opacity: lensMat.opacity });
  }
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.11), m.plate, false);
  plate.rotation.y = Math.PI; plate.position.set(0, 0.42, Zg - 0.03); add(plate);
}

function rear(ctx) {
  const { m, add, model } = ctx;
  const outlinePath = (y, x0, x1, n = 30) => {
    const pts = [];
    for (let k = 0; k <= n; k++) { const x = lerp(x0, x1, k / n); pts.push(new THREE.Vector3(x, y, zOutlineRear(x))); }
    return pts;
  };
  // arka tampon (govde renkli) + difuzor (parlak siyah) + iki oval egzoz
  add(mesh(sweep(outlinePath(0.43, -0.955, 0.955), [{ x: -0.12, y: -0.15 }, { x: 0.02, y: -0.15 }, { x: 0.055, y: -0.1 }, { x: 0.06, y: 0.05 }, { x: 0.04, y: 0.15 }, { x: -0.12, y: 0.15 }]), m.paint));
  add(mesh(box(1.5, 0.15, 0.14, 0.03).translate(0, 0.25, ZEND - 0.0), m.blackGloss));
  for (let k = -3; k <= 3; k++) add(mesh(box(0.012, 0.12, 0.1, 0.004).translate(k * 0.13, 0.25, ZEND + 0.03), m.blackGloss, false));
  // stoplar: kapak ustunde ic kisim (bagaj kapagi ile acilir), govdede dis kisim; aralarinda siyah serit
  for (const s of [-1, 1]) {
    add(mesh(box(0.2, 0.075, 0.12, 0.02).translate(s * 0.85, 0.955, ZEND - 0.07), m.tail, false));
    model.addToPart('hatch', box(0.26, 0.07, 0.03, 0.01).translate(s * 0.62, 0.955, ZEND + 0.002), m.tail, false);
    add(mesh(box(0.08, 0.02, 0.122, 0.006).translate(s * 0.86, 0.93, ZEND - 0.07), m.reverse, false));
  }
  model.addToPart('hatch', box(0.98, 0.03, 0.02, 0.008).translate(0, 0.955, ZEND + 0.004), m.blackGloss, false);
  // dort halka, RS 6 yazisi, plaka
  const rings = [];
  for (let k = 0; k < 4; k++) { const t = new THREE.TorusGeometry(0.036, 0.0065, 8, 28); t.translate((k - 1.5) * 0.053, 0.86, 0); rings.push(t); }
  const rg = mergeInto(rings); rg.translate(0, 0, ZEND + 0.012); model.addToPart('hatch', rg, m.chrome, false);
  const badge = new THREE.PlaneGeometry(0.12, 0.038); badge.translate(0.6, 0.86, ZEND + 0.006);
  const b = model.addToPart('hatch', badge, new THREE.MeshStandardMaterial({ map: textTexture('RS 6', { w: 256, h: 80, font: 'italic bold 60px Arial', color: '#e2e2e2' }), transparent: true, alphaTest: 0.3 }), false);
  b.userData.keep = true;
  model.addToPart('hatch', box(0.56, 0.13, 0.02, 0.01).translate(0, 0.68, ZEND + 0.0), m.seam, false);
  const plate = new THREE.PlaneGeometry(0.52, 0.11); plate.translate(0, 0.68, ZEND + 0.012);
  const pl = model.addToPart('hatch', plate, m.plate, false); pl.userData.keep = true;
  // tavan spoyleri
  model.addToPart('hatch', box(1.2, 0.035, 0.24, 0.015).translate(0, yRoof(ZROOF1) - 0.005, ZROOF1 + 0.06), m.paint);
}

function details(ctx) {
  const { S, m, add, model } = ctx;
  for (const s of [-1, 1]) {
    const name = s < 0 ? 'door0' : 'door1';
    const hz = -0.38, hy = 1.06;
    model.addToPart(name, box(0.075, 0.13, 0.23, 0.04, 3).translate(s * 1.03, hy, hz), m.alu);
    model.addToPart(name, box(0.06, 0.03, 0.09, 0.012).translate(s * 0.96, hy - 0.04, hz - 0.03), m.blackGloss, false);
    const glass = new THREE.PlaneGeometry(0.2, 0.1); glass.rotateY(s < 0 ? -0.15 : 0.15); glass.translate(s * 1.03, hy, hz + 0.116);
    model.addToPart(name, glass, m.mirror, false);
  }
  S.doors.forEach((d, k) => {
    for (const s of [-1, 1]) {
      const idx = k * 2 + (s > 0 ? 1 : 0);
      model.addToPart(`door${idx}`, box(0.02, 0.03, 0.15, 0.012).translate(s * (HW + 0.006), 0.9, d.z1 - 0.14), m.paint, false);
    }
  });
  // yan marspiyel (parlak siyah), tavan raylari
  for (const s of [-1, 1]) {
    add(mesh(box(0.06, 0.06, 2.0, 0.02).translate(s * (HW - 0.0), 0.23, 0.18), m.blackGloss));
    add(mesh(box(0.04, 0.03, 1.75, 0.012).translate(s * 0.6, ROOF - 0.0, 1.05), m.blackGloss));
    for (const z of [0.25, 1.85]) add(mesh(box(0.04, 0.05, 0.09, 0.01).translate(s * 0.6, ROOF - 0.03, z), m.blackGloss, false));
  }
  add(mesh(box(0.055, 0.055, 0.15, 0.024).translate(0, ROOF + 0.015, 1.95), m.blackGloss, false));
}

export const RS6_SPEC = {
  id: 'rs6', name: 'Audi RS 6 Avant',
  zF: ZF, zN: ZN, hoodZ0: ZN + 0.03, zWS0: ZWS0, zWS1: ZWS1, zRoof1: ZROOF1, zGH1: ZGH1, zEnd: ZEND,
  axles: [AXF, AXR], wr: 0.365, tireW: 0.285, trackF: 1.668, trackR: 1.651,
  archR: 0.395, archCY: 0.37, archP: 2.0, well: 0.24,
  rt: 0.05, rb: 0.05,
  hoodHalf: 0.78,
  halfW, yTop, yBot, sideShape, crown, yRoof,
  roofW: () => 0.71, roofR: 0.075, roofCrown: 0.025, glassInset: 0.04, winTopDrop: 0.06,
  rearGlassInset: 0.14, rearGlassBottom: 0.07, rearGlassTop: 0.12,
  doorBottom: 0.3,
  doors: [{ z0: -0.55, z1: 0.47 }, { z0: 0.53, z1: 1.38 }],
  windows: [{ z0: -0.53, z1: 0.44, door: 0 }, { z0: 0.56, z1: 1.3, door: 1, privacy: true }, { z0: 1.42, z1: 2.08, privacy: true }],
  pillarBlack: [[0.47, 0.53], [1.3, 1.42]],
  aPillar: 'paint', pillar: 'blackGloss', trimMat: 'blackGloss',
  hatchZ: 2.5, hatchY: 0.62,
  under: {
    frameX: 0.45, frameY: 0.24, frameZ0: -1.7, frameZ1: 2.3, cross: [-1.3, 0.0, 1.6],
    tankX: 0, tankZ: 1.2, engineY: 0.36, spare: null,
    exhaust: [{ x: -0.62, y: 0.29, z: 2.72, r: 0.05, len: 0.9, mat: 'darkChrome', oval: 1.5 }, { x: 0.62, y: 0.29, z: 2.72, r: 0.05, len: 0.9, mat: 'darkChrome', oval: 1.5 }],
  },
  interior: {
    floorY: 0.33, cabZ1: 1.6, dashDepth: 0.62, dashH: 0.24, screen: { w: 0.26, h: 0.12, y: 0.0 },
    driverX: -0.37, maxSpeed: 320, maxRpm: 8000, wheelR: 0.18, seatX: 0.37, seatY: 0.42, seatZ: 0.18, rearSeatZ: 1.15,
  },
  wheel: { rimR: 0.279, spokes: 5, spokeW: 0.04, spokeDepth: 0.04, split: true, lugs: 5, mat: 'alloyDark', caliper: 'red', shoulder: 0.02 },
  tread: 'road',
  spot: { x: 0.68, y: 0.75 },
  cam: { hood: [0, 0.5, -0.75], cockpit: [-0.37, 0.63, 0.12], chase: 1.0 },
  materials, front, rear, details,
};
