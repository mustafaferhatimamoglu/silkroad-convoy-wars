import * as THREE from 'three';
import { mesh, box, shapeFrom, extrudeFront, archPath, textTexture, honeycombTexture, lerp, smooth } from '../CarModel.js';
import { sweep, mergeInto } from '../carkit.js';

// Rezvani Tank (2021, 4 kapi; Jeep Wrangler JL sasisi). Olculer: uzunluk ~4.98, genislik 2.16
// (camurluk kaslariyla), yukseklik 1.98, dingil mesafesi 3.01 m; 37 inc arazi lastigi.
// Askeri cizgiler: duz yuzeyler, pahli omuzlar, dik on cam, ince yatay LED far bandi, iri siyah
// tampon (entegre LED bar, ceki kancalari), dev kosegen camurluk kaslari, kaya korumalari.

const ZF = -2.45, ZN = -2.3, ZWS0 = -0.88, ZWS1 = -0.47, ZROOF1 = 2.16, ZGH1 = 2.28, ZEND = 2.42;
const AXF = -1.355, AXR = 1.655;
const HW = 0.99;
const COWL = 1.3, HOOD_F = 1.2, BELT = 1.45, ROOF = 1.97;
const RZ = 0.12, RX = 0.05;

function halfW(z) {
  if (z < ZN + RZ) { const u = Math.min(1, (ZN + RZ - z) / RZ); return HW - RX + RX * Math.sqrt(Math.max(0, 1 - u * u)); }
  if (z > ZEND - 0.08) { const u = Math.min(1, (z - (ZEND - 0.08)) / 0.08); return HW - 0.03 + 0.03 * Math.sqrt(Math.max(0, 1 - u * u)); }
  return HW;
}
function zOutline(x) {
  const ax = Math.abs(x);
  if (ax <= HW - RX) return ZN;
  const v = Math.min(1, (ax - (HW - RX)) / RX);
  return ZN + RZ - RZ * Math.sqrt(Math.max(0, 1 - v * v));
}
function yTop(z) {
  if (z < ZWS0) { const t = (z - ZN) / (ZWS0 - ZN); return lerp(HOOD_F, COWL, Math.pow(Math.max(0, t), 0.9)) - 0.025 * (1 - smooth((z - ZN) / 0.06)); }
  return lerp(COWL, BELT, smooth((z - ZWS0) / 0.3));
}
function yBot(z) { return z < AXF ? 0.86 : 0.64; }
// pahli omuz: belin altinda duz, uste dogru keskin iceri egim
function sideShape(y) { return -0.075 * smooth((y - 1.22) / 0.12) + 0.004 * smooth((y - 0.8) / 0.05); }
function crown(x, z, ax) {
  if (z > ZWS0) return 0;
  // kaput: ortada pahli yukselen kubbe
  return 0.045 * smooth((0.5 - Math.abs(x)) / 0.08) + 0.006 * (1 - (x / Math.max(ax, 0.01)) ** 2);
}
function yRoof(z) {
  if (z <= ZWS0) return yTop(z);
  if (z < ZWS1) { const t = (z - ZWS0) / (ZWS1 - ZWS0); return lerp(yTop(ZWS0), ROOF, t); }
  if (z < ZROOF1) return ROOF + 0.004 * Math.sin(((z - ZWS1) / (ZROOF1 - ZWS1)) * Math.PI);
  const t = Math.min(1, (z - ZROOF1) / (ZGH1 - ZROOF1));
  return lerp(ROOF, yTop(ZGH1) + 0.002, Math.pow(t, 1.2));
}

function materials(m) {
  m.red = new THREE.MeshStandardMaterial({ color: 0xc0201a, roughness: 0.45, metalness: 0.2 });
  m.texBlack = new THREE.MeshStandardMaterial({ color: 0x0f1011, roughness: 0.92 });
}

function front(ctx) {
  const { m, add, lamps } = ctx;
  // iri siyah tampon (ceki noktali), altinda celik karter korumasi
  const zb = ZF + 0.02;
  add(mesh(box(2.02, 0.32, 0.26, 0.04, 3).translate(0, 0.78, zb + 0.13), m.texBlack));
  for (const s of [-1, 1]) {
    const wing = mesh(box(0.34, 0.26, 0.3, 0.04, 3), m.texBlack); wing.position.set(s * 0.88, 0.8, zb + 0.24); wing.rotation.y = s * 0.45; add(wing);
  }
  add(mesh(box(1.1, 0.05, 0.4, 0.015).translate(0, 0.6, zb + 0.32), m.satin));
  // tampona gomulu LED bar ve iki kirmizi ceki kelepcesi
  add(mesh(box(0.92, 0.07, 0.04, 0.012).translate(0, 0.82, zb - 0.005), m.lampBody, false));
  add(mesh(box(0.88, 0.035, 0.012, 0.006).translate(0, 0.82, zb - 0.026), m.drl, false));
  for (const s of [-1, 1]) {
    const sh = mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 16), m.red, false);
    sh.position.set(s * 0.6, 0.7, zb - 0.02); sh.rotation.y = Math.PI / 2; add(sh);
  }
  // on yuz: ince yatay siyah bant; dis uclarda dikdortgen LED farlar, ust kenarda LED cizgi
  const Zf = ZN - 0.02;
  add(mesh(box(1.86, 0.2, 0.05, 0.02).translate(0, 1.08, Zf + 0.02), m.blackGloss, false));
  const hc = honeycombTexture({ cell: 18, line: 5, color: '#151617' });
  hc.repeat.set(2, 4);
  const grill = new THREE.PlaneGeometry(0.82, 0.13); grill.rotateY(Math.PI); grill.translate(0, 1.08, Zf - 0.006);
  add(mesh(grill, new THREE.MeshStandardMaterial({ map: hc, alphaTest: 0.4, roughness: 0.5, side: THREE.DoubleSide }), false));
  for (const s of [-1, 1]) {
    const xc = s * 0.72;
    add(mesh(box(0.32, 0.13, 0.04, 0.012).translate(xc, 1.08, Zf - 0.01), m.reflector, false));
    for (const px of [0.62, 0.72, 0.82]) {
      const pr = mesh(new THREE.SphereGeometry(0.026, 14, 10), m.blackGloss, false); pr.position.set(s * px, 1.075, Zf - 0.03); add(pr);
    }
    add(mesh(box(0.34, 0.014, 0.012, 0.004).translate(xc, 1.163, Zf - 0.034), m.drl, false));
    const lensMat = m.headLens.clone();
    const lens = mesh(box(0.33, 0.14, 0.01, 0.005), lensMat, false); lens.position.set(xc, 1.08, Zf - 0.036); lens.renderOrder = 6; add(lens);
    lamps.push({ lens: lensMat, x: xc, opacity: lensMat.opacity });
  }
  const badge = new THREE.PlaneGeometry(0.4, 0.06); badge.rotateY(Math.PI); badge.translate(0, 1.08, Zf - 0.03);
  const bm = mesh(badge, new THREE.MeshStandardMaterial({ map: textTexture('REZVANI', { w: 512, h: 80, font: 'bold 58px Arial', color: '#d6d6d6', spacing: 10 }), transparent: true, alphaTest: 0.3 }), false);
  bm.userData.keep = true; add(bm);
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.11), m.plate, false);
  plate.rotation.y = Math.PI; plate.position.set(0, 0.72, zb - 0.002); add(plate);
}

function rear(ctx) {
  const { m, add, model } = ctx;
  // agir arka tampon + ceki demiri
  add(mesh(box(1.96, 0.26, 0.24, 0.04, 3).translate(0, 0.78, ZEND + 0.1), m.texBlack));
  add(mesh(box(0.1, 0.1, 0.25, 0.015).translate(0, 0.66, ZEND + 0.3), m.frame, false));
  // dikey dikdortgen LED stoplar (kosede), kapakta yatay LED serit
  for (const s of [-1, 1]) {
    add(mesh(box(0.14, 0.3, 0.06, 0.015).translate(s * (HW - 0.1), 1.2, ZEND + 0.01), m.tail, false));
    add(mesh(box(0.14, 0.06, 0.062, 0.01).translate(s * (HW - 0.1), 1.03, ZEND + 0.01), m.reverse, false));
  }
  model.addToPart('hatch', box(1.2, 0.02, 0.02, 0.006).translate(0, 1.38, ZEND + 0.006), m.tail, false);
  const txt = new THREE.PlaneGeometry(0.6, 0.1); txt.translate(0, 1.18, ZEND + 0.004);
  const t = model.addToPart('hatch', txt, new THREE.MeshStandardMaterial({ map: textTexture('TANK', { font: 'bold 70px Arial', color: '#bfc3c7', spacing: 18 }), transparent: true, alphaTest: 0.3, metalness: 0.5, roughness: 0.4 }), false);
  t.userData.keep = true;
  model.addToPart('hatch', box(0.56, 0.13, 0.02, 0.01).translate(0, 0.98, ZEND + 0.0), m.seam, false);
  const plate = new THREE.PlaneGeometry(0.52, 0.11); plate.translate(0, 0.98, ZEND + 0.012);
  const pl = model.addToPart('hatch', plate, m.plate, false); pl.userData.keep = true;
}

function details(ctx) {
  const { S, m, add, model } = ctx;
  for (const s of [-1, 1]) {
    const name = s < 0 ? 'door0' : 'door1';
    const hz = -0.62, hy = 1.55;
    model.addToPart(name, box(0.09, 0.2, 0.26, 0.025, 3).translate(s * 1.1, hy, hz), m.texBlack);
    model.addToPart(name, box(0.08, 0.04, 0.11, 0.012).translate(s * 1.02, hy - 0.07, hz - 0.03), m.texBlack, false);
    const glass = new THREE.PlaneGeometry(0.24, 0.17); glass.rotateY(s < 0 ? -0.1 : 0.1); glass.translate(s * 1.1, hy, hz + 0.132);
    model.addToPart(name, glass, m.mirror, false);
  }
  S.doors.forEach((d, k) => {
    for (const s of [-1, 1]) {
      const idx = k * 2 + (s > 0 ? 1 : 0);
      model.addToPart(`door${idx}`, box(0.03, 0.045, 0.16, 0.01).translate(s * (HW + 0.01), 1.24, d.z1 - 0.14), m.texBlack, false);
    }
  });
  // dev kosegen camurluk kaslari (on ve arka)
  for (const s of [-1, 1]) {
    for (const ax of S.axles) {
      const path = archPath(S, ax, 0.01, s * (HW + 0.004), 20);
      const prof = s > 0
        ? [{ x: -0.13, y: -0.01 }, { x: 0.004, y: -0.01 }, { x: 0.004, y: 0.075 }, { x: -0.13, y: 0.09 }]
        : [{ x: -0.004, y: -0.01 }, { x: 0.13, y: -0.01 }, { x: 0.13, y: 0.09 }, { x: -0.004, y: 0.075 }];
      add(mesh(sweep(path, prof, { up: new THREE.Vector3(s, 0, 0) }), m.texBlack));
    }
    // kaya korumasi (esik boyunca boru)
    const rail = mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.0, 12), m.texBlack);
    rail.rotation.x = Math.PI / 2; rail.position.set(s * (HW - 0.02), 0.6, 0.15); add(rail);
  }
  // kaputta iki siyah hava kanali, tavanda LED bar
  for (const s of [-1, 1]) model.addToPart('hood', box(0.22, 0.02, 0.36, 0.008).translate(s * 0.62, yTop(-1.55) + 0.012, -1.55), m.texBlack, false);
  add(mesh(box(1.3, 0.08, 0.1, 0.02).translate(0, ROOF + 0.06, ZWS1 + 0.06), m.lampBody));
  add(mesh(box(1.26, 0.04, 0.012, 0.006).translate(0, ROOF + 0.06, ZWS1 + 0.005), m.drl, false));
  for (const s of [-1, 1]) add(mesh(box(0.05, 0.08, 0.06, 0.01).translate(s * 0.55, ROOF + 0.02, ZWS1 + 0.08), m.texBlack, false));
}

export const TANK_SPEC = {
  id: 'tank', name: 'Rezvani Tank',
  zF: ZF, zN: ZN, hoodZ0: ZN + 0.03, zWS0: ZWS0, zWS1: ZWS1, zRoof1: ZROOF1, zGH1: ZGH1, zEnd: ZEND,
  axles: [AXF, AXR], wr: 0.47, tireW: 0.32, trackF: 1.83, trackR: 1.83,
  archR: 0.58, archCY: 0.52, archP: 4.0, well: 0.32,
  rt: 0.02, rb: 0.03,
  hoodHalf: 0.88,
  halfW, yTop, yBot, sideShape, crown, yRoof,
  roofW: () => 0.86, roofR: 0.03, roofCrown: 0.008, glassInset: 0.04, winTopDrop: 0.08,
  rearGlassInset: 0.24, rearGlassBottom: 0.1, rearGlassTop: 0.1,
  doorBottom: 0.7,
  doors: [{ z0: -0.78, z1: 0.25 }, { z0: 0.31, z1: 1.25 }],
  windows: [{ z0: -0.76, z1: 0.22, door: 0 }, { z0: 0.34, z1: 1.2, door: 1, privacy: true }, { z0: 1.32, z1: 2.1, privacy: true }],
  pillarBlack: [[0.25, 0.31], [1.2, 1.32]],
  aPillar: 'paint', pillar: 'texBlack', trimMat: 'texBlack',
  hatchZ: 2.3, hatchY: 0.78,
  under: {
    frameX: 0.5, frameY: 0.66, frameZ0: -2.2, frameZ1: 2.3, cross: [-1.9, -0.6, 0.6, 1.9],
    tankX: 0, tankZ: 2.0, engineY: 0.8, spare: null,
    exhaust: [{ x: -0.55, y: 0.62, z: 2.3, r: 0.045, len: 2.2 }, { x: 0.55, y: 0.62, z: 2.3, r: 0.045, len: 2.2 }],
  },
  interior: {
    floorY: 0.86, cabZ1: 2.0, dashDepth: 0.42, dashH: 0.3, screen: { w: 0.22, h: 0.13, y: 0.04 },
    driverX: -0.42, maxSpeed: 260, maxRpm: 7000, wheelR: 0.19, seatX: 0.42, seatY: 1.0, seatZ: -0.05, rearSeatZ: 0.92,
  },
  wheel: { rimR: 0.216, spokes: 8, spokeW: 0.05, spokeDepth: 0.04, split: false, lugs: 5, mat: 'alloyDark', caliper: 'red', shoulder: 0.07 },
  tread: 'mt',
  spot: { x: 0.72, y: 1.08 },
  cam: { hood: [0, 0.5, -1.2], cockpit: [-0.42, 0.78, -0.12], chase: 1.25 },
  materials, front, rear, details,
};
