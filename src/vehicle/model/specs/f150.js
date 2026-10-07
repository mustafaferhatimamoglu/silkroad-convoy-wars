import * as THREE from 'three';
import { mesh, box, shapeFrom, extrudeFront, textTexture, honeycombTexture, lerp, smooth } from '../CarModel.js';
import { sweep, mergeInto } from '../carkit.js';

// Ford F-150 (14. nesil, 2021) SuperCrew 5.5 ft kasa 4x4. Olculer: uzunluk 5.89, genislik 2.03,
// yukseklik 1.96, dingil mesafesi 3.683 m; 275/65 R18. Uzun ve yuksek burun, duz kaput ve
// ortada yukselen kubbe, iki yatay krom cubuklu dikdortgen izgara, C bicimli LED farlar.

const ZF = -2.58, ZN = -2.48, ZWS0 = -1.12, ZWS1 = -0.4, ZROOF1 = 1.18, ZEND = 1.36;
const AXF = -1.62, AXR = 2.063;
const HW = 1.0;
const COWL = 1.36, HOOD_F = 1.25, BELT = 1.45, ROOF = 1.96;
const RZ = 0.18, RX = 0.06;

function halfW(z) {
  if (z < ZN + RZ) { const u = Math.min(1, (ZN + RZ - z) / RZ); return HW - RX + RX * Math.sqrt(Math.max(0, 1 - u * u)); }
  return HW;
}
function zOutline(x) {
  const ax = Math.abs(x);
  if (ax <= HW - RX) return ZN;
  const v = Math.min(1, (ax - (HW - RX)) / RX);
  return ZN + RZ - RZ * Math.sqrt(Math.max(0, 1 - v * v));
}
function yTop(z) {
  if (z < ZWS0) {
    const t = (z - ZN) / (ZWS0 - ZN);
    return lerp(HOOD_F, COWL, Math.pow(Math.max(0, t), 0.9)) - 0.03 * (1 - smooth((z - ZN) / 0.08));
  }
  return lerp(COWL, BELT, smooth((z - ZWS0) / 0.42)) + 0.01 * smooth((z - ZWS0 - 0.4) / 1.8);
}
function yBot(z) { return z < AXF ? 0.72 : 0.55; }
function sideShape(y) {
  return -0.022 * smooth((y - 1.24) / 0.22) + 0.007 * Math.exp(-((y - 1.07) ** 2) / 0.0008);
}
function crown(x, z, ax) {
  if (z > ZWS0) return 0;
  const u = x / Math.max(ax, 0.01);
  return 0.012 * (1 - u * u) + 0.026 * smooth((0.45 - Math.abs(x)) / 0.06);
}
function yRoof(z) {
  if (z <= ZWS0) return yTop(z);
  if (z < ZWS1) { const t = (z - ZWS0) / (ZWS1 - ZWS0); return lerp(yTop(ZWS0), ROOF - 0.01, Math.pow(t, 0.9)) + 0.018 * Math.sin(t * Math.PI); }
  if (z < ZROOF1) { const t = (z - ZWS1) / (ZROOF1 - ZWS1); return ROOF - 0.01 + 0.01 * Math.sin(t * Math.PI); }
  const t = Math.min(1, (z - ZROOF1) / (ZEND - ZROOF1));
  return lerp(ROOF - 0.01, yTop(ZEND) + 0.002, Math.pow(t, 1.5));
}

function front(ctx) {
  const { m, add, lamps } = ctx;
  const outlinePath = (y, inset, x0, x1, n = 30) => {
    const pts = [];
    for (let k = 0; k <= n; k++) { const x = lerp(x0, x1, k / n); pts.push(new THREE.Vector3(x, y, zOutline(x) - inset)); }
    return pts;
  };
  // alt hava baraji (siyah) ve krom tampon
  add(mesh(sweep(outlinePath(0.405, 0.0, -0.98, 0.98), [{ x: -0.1, y: -0.05 }, { x: 0.05, y: -0.05 }, { x: 0.07, y: 0.0 }, { x: 0.06, y: 0.05 }, { x: -0.1, y: 0.05 }]), m.plastic));
  const bumper = [{ x: -0.1, y: -0.13 }, { x: 0.05, y: -0.13 }, { x: 0.1, y: -0.1 }, { x: 0.115, y: -0.02 }, { x: 0.11, y: 0.07 }, { x: 0.085, y: 0.12 }, { x: 0.03, y: 0.135 }, { x: -0.1, y: 0.135 }];
  add(mesh(sweep(outlinePath(0.56, 0.0, -1.015, 1.015, 40), bumper), m.chrome));
  // tampon ici siyah izgara bandi ve sis farlari
  add(mesh(box(0.9, 0.07, 0.04, 0.02).translate(0, 0.475, ZF - 0.0), m.black, false));
  for (const s of [-1, 1]) {
    const fx = s * 0.8, fz = zOutline(fx) - 0.105;
    const rec = mesh(box(0.2, 0.09, 0.04, 0.03), m.black, false); rec.position.set(fx, 0.5, fz + 0.012); add(rec);
    const fog = mesh(box(0.15, 0.045, 0.01, 0.01), m.headLens, false); fog.position.set(fx, 0.5, fz - 0.01); add(fog);
    const fr = mesh(box(0.14, 0.04, 0.01, 0.01), m.reflector, false); fr.position.set(fx, 0.5, fz - 0.004); add(fr);
  }
  // izgara: dikdortgen cerceve, koyu ag, iki kalin yatay krom cubuk, Ford ovali
  const Zg = ZN - 0.06;
  const outer = [[-0.62, 1.255], [0.62, 1.255], [0.62, 0.69], [-0.62, 0.69]];
  const inner = [[-0.585, 1.22], [0.585, 1.22], [0.585, 0.725], [-0.585, 0.725]];
  add(mesh(extrudeFront(shapeFrom(outer, [inner]), Zg, 0.07, 0.008), m.darkChrome));
  const hc = honeycombTexture({ cell: 26, line: 6, color: '#1c1d1f' });
  hc.repeat.set(2.2, 4.4);
  const insert = new THREE.ShapeGeometry(shapeFrom(inner));
  insert.translate(0, 0, Zg + 0.03);
  add(mesh(insert, new THREE.MeshStandardMaterial({ map: hc, alphaTest: 0.4, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }), false));
  const back = new THREE.ShapeGeometry(shapeFrom(inner)); back.translate(0, 0, Zg + 0.065); add(mesh(back, m.seam, false));
  for (const y of [1.075, 0.88]) add(mesh(box(1.22, 0.065, 0.05, 0.02).translate(0, y, Zg - 0.012), m.chrome, false));
  // Ford ovali (mavi, krom kenarli)
  const oval = new THREE.CircleGeometry(1, 40); oval.scale(0.12, 0.048, 1); oval.rotateY(Math.PI); oval.translate(0, 1.075, Zg - 0.04);
  add(mesh(oval, new THREE.MeshPhysicalMaterial({ color: 0x1b3f8f, metalness: 0.3, roughness: 0.2, clearcoat: 1 }), false));
  const ring = new THREE.TorusGeometry(1, 0.06, 6, 40); ring.scale(0.12, 0.048, 0.08); ring.translate(0, 1.075, Zg - 0.041);
  add(mesh(ring, m.chrome, false));
  const fordTxt = new THREE.PlaneGeometry(0.17, 0.05); fordTxt.rotateY(Math.PI); fordTxt.translate(0, 1.075, Zg - 0.042);
  const ft = mesh(fordTxt, new THREE.MeshBasicMaterial({ map: textTexture('Ford', { w: 256, h: 80, font: 'italic bold 58px Georgia', color: '#f4f4f4' }), transparent: true, alphaTest: 0.3 }), false);
  ft.userData.keep = true; add(ft);
  // farlar: dikdortgen govde, ic tarafta dikey + ust/alt yatay LED (C)
  for (const s of [-1, 1]) {
    const x0 = s * 0.625, x1 = s * 0.985;
    const xc = (x0 + x1) / 2, w = Math.abs(x1 - x0);
    const z = zOutline(xc) - 0.012;
    const hb = mesh(box(w, 0.235, 0.12, 0.02), m.lampBody, false); hb.position.set(xc, 1.135, z + 0.055); add(hb);
    const refl = mesh(box(w - 0.04, 0.19, 0.02, 0.01), m.reflector, false); refl.position.set(xc, 1.135, z - 0.004); add(refl);
    for (const px of [0.73, 0.86]) {
      const pr = mesh(new THREE.SphereGeometry(0.03, 18, 12), m.blackGloss, false); pr.position.set(s * px, 1.13, z - 0.012); add(pr);
    }
    const ix = s * 0.66;
    add(mesh(box(0.018, 0.2, 0.01, 0.004).translate(ix, 1.135, z - 0.016), m.drl, false));
    add(mesh(box(w - 0.07, 0.016, 0.01, 0.004).translate(xc + s * 0.02, 1.235, z - 0.016), m.drl, false));
    add(mesh(box(w - 0.07, 0.016, 0.01, 0.004).translate(xc + s * 0.02, 1.035, z - 0.016), m.drl, false));
    const lensMat = m.headLens.clone();
    const lens = mesh(box(w, 0.235, 0.012, 0.01), lensMat, false); lens.position.set(xc, 1.135, z - 0.024); lens.renderOrder = 6; add(lens);
    lamps.push({ lens: lensMat, x: xc, opacity: lensMat.opacity });
  }
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.11), m.plate, false);
  plate.rotation.y = Math.PI; plate.position.set(0, 0.6, ZF - 0.11); add(plate);
}

function rear(ctx) {
  const { m, add, model, S } = ctx;
  const B = S.bed;
  // dikey dikdortgen stoplar, C bicimli LED
  for (const s of [-1, 1]) {
    const x = s * (HW - 0.055);
    const body = mesh(box(0.11, 0.42, 0.11, 0.02), m.tail, false); body.position.set(x, 1.1, B.z1 - 0.05); add(body);
    const rev = mesh(box(0.112, 0.08, 0.112, 0.01), m.reverse, false); rev.position.set(x, 1.0, B.z1 - 0.05); add(rev);
    add(mesh(box(0.02, 0.36, 0.115, 0.006).translate(x - s * 0.035, 1.1, B.z1 - 0.05), m.tail, false));
  }
  // krom arka tampon (kose basamaklari) + plaka
  add(mesh(box(2.0, 0.24, 0.22, 0.04, 3).translate(0, 0.66, B.z1 + 0.1), m.chrome));
  for (const s of [-1, 1]) add(mesh(box(0.3, 0.014, 0.15, 0.005).translate(s * 0.82, 0.785, B.z1 + 0.1), m.rubber, false));
  add(mesh(box(0.56, 0.13, 0.02, 0.01).translate(0, 0.65, B.z1 + 0.205), m.seam, false));
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.11), m.plate, false); plate.position.set(0, 0.65, B.z1 + 0.217); add(plate);
  // bagaj kapagi: F-150 kabartma yazisi, tutamak
  const txt = new THREE.PlaneGeometry(0.85, 0.16); txt.translate(0, 1.08, B.z1 + 0.004);
  const tm = new THREE.MeshStandardMaterial({ map: textTexture('F-150', { font: 'bold 76px Arial', color: '#a9adb1' }), transparent: true, alphaTest: 0.3, metalness: 0.6, roughness: 0.35 });
  const t = model.addToPart('tailgate', txt, tm, false); t.userData.keep = true;
  model.addToPart('tailgate', box(0.26, 0.05, 0.03, 0.01).translate(0, 1.27, B.z1 + 0.004), m.black, false);
}

function details(ctx) {
  const { S, m, add, model } = ctx;
  for (const s of [-1, 1]) {
    const name = s < 0 ? 'door0' : 'door1';
    const hz = -0.9, hy = 1.53;
    model.addToPart(name, box(0.1, 0.25, 0.32, 0.035, 3).translate(s * 1.13, hy, hz), m.black);
    model.addToPart(name, box(0.08, 0.05, 0.14, 0.015).translate(s * 1.04, hy - 0.08, hz - 0.03), m.black, false);
    const glass = new THREE.PlaneGeometry(0.28, 0.21); glass.rotateY(s < 0 ? -0.1 : 0.1); glass.translate(s * 1.13, hy, hz + 0.162);
    model.addToPart(name, glass, m.mirror, false);
    model.addToPart(name, box(0.01, 0.025, 0.2, 0.005).translate(s * 1.181, hy - 0.06, hz - 0.03), m.amber, false);
  }
  S.doors.forEach((d, k) => {
    for (const s of [-1, 1]) {
      const idx = k * 2 + (s > 0 ? 1 : 0);
      model.addToPart(`door${idx}`, box(0.03, 0.05, 0.19, 0.016).translate(s * (HW + 0.012), 1.26, d.z1 - 0.17), m.chrome, false);
    }
  });
  for (const s of [-1, 1]) {
    add(mesh(box(0.22, 0.05, 2.2, 0.02, 3).translate(s * (HW - 0.07), 0.48, -0.05), m.black));
    add(mesh(box(0.19, 0.006, 2.1, 0.002).translate(s * (HW - 0.07), 0.507, -0.05), m.satin, false));
  }
  add(mesh(box(0.06, 0.06, 0.17, 0.025).translate(0, ROOF + 0.025, 1.05), m.blackGloss, false));
  // kaputun iki yanindaki keskin kubbe kenari icin ince parlak cizgi
  for (const s of [-1, 1]) model.addToPart('hood', box(0.012, 0.006, 1.1, 0.002).translate(s * 0.45, yTop(-1.8) + 0.025, -1.8), m.paint, false);
}

export const F150_SPEC = {
  id: 'f150', name: 'Ford F-150',
  zF: ZF, zN: ZN, hoodZ0: ZN + 0.025, zWS0: ZWS0, zWS1: ZWS1, zRoof1: ZROOF1, zGH1: ZEND, zEnd: ZEND,
  axles: [AXF, AXR], wr: 0.408, tireW: 0.275, trackF: 1.73, trackR: 1.73,
  archR: 0.5, archCY: 0.43, archP: 3.0, well: 0.3,
  rt: 0.035, rb: 0.06,
  hoodHalf: 0.87,
  halfW, yTop, yBot, sideShape, crown, yRoof,
  roofW: () => 0.84, roofR: 0.06, roofCrown: 0.018, glassInset: 0.03, winTopDrop: 0.07,
  rearGlassInset: 0.2, rearGlassBottom: 0.08,
  doorBottom: 0.62,
  doors: [{ z0: -1.07, z1: 0.16 }, { z0: 0.22, z1: 1.1 }],
  windows: [{ z0: -1.05, z1: 0.13, door: 0 }, { z0: 0.25, z1: 1.07, door: 1, privacy: true }],
  pillarBlack: [[0.16, 0.22]],
  aPillar: 'paint', pillar: 'trim', trimMat: 'blackGloss',
  bed: { z0: 1.42, z1: 3.3, bottom: 0.66, rail: 1.33, floor: 0.95, wall: 0.065, tgBottom: 0.79, tgDepth: 0.065, railMat: 'paint', innerMat: 'paint', floorMat: 'plastic' },
  under: {
    frameX: 0.47, frameY: 0.55, frameZ0: -2.3, frameZ1: 3.2, cross: [-2.0, -0.8, 0.6, 2.0, 3.0],
    tankX: -0.35, tankZ: 0.5, engineY: 0.7, spare: { y: 0.5, z: 2.85 },
    exhaust: [{ x: 0.7, y: 0.47, z: 2.62, r: 0.042, len: 4.0, down: true }],
  },
  interior: {
    floorY: 0.8, cabZ1: 1.32, dashDepth: 0.55, dashH: 0.3, screen: { w: 0.3, h: 0.17, y: 0.07 },
    driverX: -0.42, maxSpeed: 240, maxRpm: 8000, wheelR: 0.2, seatX: 0.42, seatY: 0.98, seatZ: -0.22, rearSeatZ: 0.78,
  },
  wheel: { rimR: 0.229, spokes: 6, spokeW: 0.06, spokeDepth: 0.035, split: false, lugs: 6, mat: 'alloy', caliper: 'black', shoulder: 0.04 },
  tread: 'at',
  spot: { x: 0.8, y: 1.13 },
  cam: { hood: [0, 0.57, -1.5], cockpit: [-0.42, 0.86, -0.38], chase: 1.25 },
  front, rear, details,
  engine: 'v8', engineAccent: 0x1d1f22,
};
