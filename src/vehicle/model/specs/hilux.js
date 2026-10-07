import * as THREE from 'three';
import { mesh, box, shapeFrom, extrudeFront, archPath, textTexture, honeycombTexture, lerp, smooth } from '../CarModel.js';
import { sweep, lathe, mergeInto } from '../carkit.js';

// Toyota Hilux (8. nesil, 2021 makyaji) cift kabin 4x4. Olculer uretici verisinden:
// uzunluk 5.325, genislik 1.855, yukseklik 1.815, dingil mesafesi 3.085 m; 265/65 R17.
// Zemin uzayi: y yukari, -z ileri, orijin kutle merkezinin altinda (fizik ile ayni z).

const ZF = -2.27, ZN = -2.17, ZWS0 = -0.95, ZWS1 = -0.24, ZROOF1 = 1.04, ZEND = 1.22;
const AXF = -1.33, AXR = 1.755;
const HW = 0.915;
const COWL = 1.115, HOOD_F = 0.985, BELT = 1.285, ROOF = 1.8;
const RZ = 0.3, RX = 0.11;   // burun kose yuvarlakligi (plan)

function halfW(z) {
  if (z < ZN + RZ) { const u = Math.min(1, (ZN + RZ - z) / RZ); return HW - RX + RX * Math.sqrt(Math.max(0, 1 - u * u)); }
  return HW;
}
/** Plan gorunusunde on hat: x'teki govde on yuzunun z'si. */
function zOutline(x) {
  const ax = Math.abs(x);
  if (ax <= HW - RX) return ZN;
  const v = Math.min(1, (ax - (HW - RX)) / RX);
  return ZN + RZ - RZ * Math.sqrt(Math.max(0, 1 - v * v));
}
function yTop(z) {
  if (z < ZWS0) {
    const t = (z - ZN) / (ZWS0 - ZN);
    return lerp(HOOD_F, COWL, Math.pow(Math.max(0, t), 0.85)) - 0.045 * (1 - smooth((z - ZN) / 0.11));
  }
  return lerp(COWL, BELT, smooth((z - ZWS0) / 0.38)) + 0.012 * smooth((z - ZWS0 - 0.4) / 1.6);
}
function yBot(z) { return z < AXF ? 0.74 : 0.53; }
function sideShape(y) {
  return -0.03 * smooth((y - 1.02) / 0.26) + 0.008 * Math.exp(-((y - 0.97) ** 2) / 0.002);
}
function crown(x, z, ax) {
  if (z > ZWS0) return 0;
  const u = x / Math.max(ax, 0.01);
  return 0.028 * (1 - u * u) + 0.01 * smooth((0.32 - Math.abs(x)) / 0.1);
}
function yRoof(z) {
  if (z <= ZWS0) return yTop(z);
  if (z < ZWS1) { const t = (z - ZWS0) / (ZWS1 - ZWS0); return lerp(yTop(ZWS0), ROOF - 0.01, Math.pow(t, 0.92)) + 0.02 * Math.sin(t * Math.PI); }
  if (z < ZROOF1) { const t = (z - ZWS1) / (ZROOF1 - ZWS1); return ROOF - 0.01 + 0.012 * Math.sin(t * Math.PI); }
  const t = Math.min(1, (z - ZROOF1) / (ZEND - ZROOF1));
  return lerp(ROOF - 0.01, yTop(ZEND) + 0.002, Math.pow(t, 1.5));
}

// ---------------------------------------------------------------- on yuz
// 2021 Hilux: ortayi kaplayan buyuk trapez izgara (kalin krom cerceve, iki yatay cubuk,
// koyu petek), ince LED farlar izgaranin ust koselerinden camurluga sarar; govde renkli
// tampon yalnizca koselerde; altta siyah tampon, sis farlari, gumus karter korumasi.
function front(ctx) {
  const { m, add, lamps } = ctx;
  const outlinePath = (y, inset, x0, x1, n = 24) => {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const x = lerp(x0, x1, k / n);
      pts.push(new THREE.Vector3(x, y, zOutline(x) - inset));
    }
    return pts;
  };
  // alt tampon (siyah dokulu plastik), tam genislik
  const lowerProf = [{ x: -0.1, y: -0.075 }, { x: 0.035, y: -0.075 }, { x: 0.08, y: -0.05 }, { x: 0.09, y: 0.0 }, { x: 0.075, y: 0.06 }, { x: 0.035, y: 0.08 }, { x: -0.1, y: 0.08 }];
  add(mesh(sweep(outlinePath(0.515, 0.0, -0.93, 0.93, 40), lowerProf), m.plastic));
  // govde renkli ust tampon: yalnizca koseler (orta izgaraya ait)
  const upperProf = [{ x: -0.1, y: -0.12 }, { x: 0.04, y: -0.12 }, { x: 0.07, y: -0.08 }, { x: 0.078, y: 0.0 }, { x: 0.06, y: 0.08 }, { x: 0.02, y: 0.12 }, { x: -0.1, y: 0.12 }];
  for (const s of [-1, 1]) {
    const pth = s > 0 ? outlinePath(0.715, 0.0, 0.6, 0.935) : outlinePath(0.715, 0.0, -0.935, -0.6);
    add(mesh(sweep(pth, upperProf), m.paint));
  }
  // gumus karter korumasi
  add(mesh(extrudeFront(shapeFrom([[-0.4, 0.43], [0.4, 0.43], [0.34, 0.49], [-0.34, 0.49]]), ZF - 0.02, 0.06, 0.004), m.satin));
  // sis farlari: siyah girintide yuvarlak far
  for (const s of [-1, 1]) {
    const fx = s * 0.775;
    const fz = zOutline(fx) - 0.075;
    const rec = mesh(box(0.15, 0.1, 0.05, 0.03), m.black, false);
    rec.position.set(fx, 0.565, fz + 0.02); add(rec);
    const fogR = mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 20), m.reflector, false);
    fogR.rotation.x = Math.PI / 2; fogR.position.set(fx, 0.565, fz - 0.006); add(fogR);
    const fog = mesh(new THREE.CircleGeometry(0.036, 20), m.headLens, false);
    fog.rotation.y = Math.PI; fog.position.set(fx, 0.565, fz - 0.017); add(fog);
    // ince krom C vurgusu (ic tarafta)
    add(mesh(box(0.012, 0.11, 0.012, 0.004).translate(fx - s * 0.085, 0.565, fz - 0.005), m.chrome, false));
  }
  // izgara: kalin krom cerceve, ici koyu petek + iki yatay cubuk
  const Zg = ZN - 0.075;
  const outer = [[-0.505, 0.985], [0.505, 0.985], [0.645, 0.76], [0.55, 0.49], [-0.55, 0.49], [-0.645, 0.76]];
  const inner = [[-0.455, 0.94], [0.455, 0.94], [0.585, 0.76], [0.505, 0.535], [-0.505, 0.535], [-0.585, 0.76]];
  add(mesh(extrudeFront(shapeFrom(outer, [inner]), Zg, 0.08, 0.01), m.chrome));
  const hc = honeycombTexture({ cell: 20, line: 5, color: '#26282b' });
  hc.repeat.set(2.6, 5.2);
  const insert = new THREE.ShapeGeometry(shapeFrom(inner));
  insert.translate(0, 0, Zg + 0.035);
  add(mesh(insert, new THREE.MeshStandardMaterial({ map: hc, alphaTest: 0.4, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide }), false));
  const back = new THREE.ShapeGeometry(shapeFrom(inner));
  back.translate(0, 0, Zg + 0.075);
  add(mesh(back, m.seam, false));
  for (const [y, hw] of [[0.86, 0.52], [0.66, 0.54]]) add(mesh(box(hw * 2, 0.035, 0.03, 0.012).translate(0, y, Zg + 0.012), m.darkChrome, false));
  // Toyota amblemi (uc elips)
  const logo = [];
  const ell = (rx, ry, t, y) => { const gg = new THREE.TorusGeometry(1, t, 6, 40); gg.scale(rx, ry, 0.05); gg.translate(0, y, 0); logo.push(gg); };
  ell(0.09, 0.06, 0.08, 0);
  ell(0.048, 0.028, 0.11, 0.013);
  ell(0.024, 0.05, 0.11, -0.008);
  const lg = mergeInto(logo);
  lg.translate(0, 0.86, Zg - 0.012);
  add(mesh(lg, m.chrome, false));
  // farlar
  for (const s of [-1, 1]) {
    const path = [];
    for (let k = 0; k <= 22; k++) {
      const x = s * lerp(0.5, 0.905, k / 22);
      path.push(new THREE.Vector3(x, lerp(0.935, 0.962, k / 22), zOutline(x) - 0.014));
    }
    if (s < 0) path.reverse();
    const sc = (t) => (s > 0 ? lerp(0.82, 1.0, t) : lerp(1.0, 0.82, t));
    const housing = [{ x: -0.08, y: -0.05 }, { x: 0.004, y: -0.05 }, { x: 0.004, y: 0.05 }, { x: -0.08, y: 0.05 }];
    add(mesh(sweep(path, housing, { scale: sc }), m.reflector, false));
    const rim = [{ x: 0.0, y: -0.056 }, { x: 0.02, y: -0.056 }, { x: 0.02, y: -0.05 }, { x: 0.0, y: -0.05 }];
    add(mesh(sweep(path, rim, { scale: sc }), m.lampBody, false));
    const rimT = [{ x: 0.0, y: 0.05 }, { x: 0.02, y: 0.05 }, { x: 0.02, y: 0.056 }, { x: 0.0, y: 0.056 }];
    add(mesh(sweep(path, rimT, { scale: sc }), m.lampBody, false));
    const lensMat = m.headLens.clone();
    const lens = [{ x: 0.0, y: -0.052 }, { x: 0.017, y: -0.036 }, { x: 0.021, y: 0.0 }, { x: 0.017, y: 0.036 }, { x: 0.0, y: 0.052 }];
    const lm = mesh(sweep(path, lens, { scale: sc, caps: false, closed: false }), lensMat, false);
    lm.renderOrder = 6; add(lm);
    // alt kenarda LED gunduz farı, icte iki projektor
    const drl = [{ x: 0.006, y: -0.045 }, { x: 0.013, y: -0.042 }, { x: 0.013, y: -0.033 }, { x: 0.006, y: -0.035 }];
    add(mesh(sweep(path, drl, { scale: sc }), m.drl, false));
    for (const px of [0.6, 0.72]) {
      const x = s * px;
      const pr = mesh(new THREE.SphereGeometry(0.026, 18, 12), m.blackGloss, false);
      pr.position.set(x, 0.955, zOutline(x) - 0.006); add(pr);
      const ring = mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 20), m.chrome, false);
      ring.position.set(x, 0.955, zOutline(x) - 0.012); add(ring);
    }
    lamps.push({ lens: lensMat, x: s * 0.7, opacity: lensMat.opacity });
  }
  // plaka
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.11), m.plate, false);
  plate.rotation.y = Math.PI; plate.position.set(0, 0.55, Zg - 0.016); add(plate);
}

// ---------------------------------------------------------------- arka
function rear(ctx) {
  const { m, add, model } = ctx;
  const B = ctx.S.bed;
  // stop lambalari: kasa arka koselerinde dikey uniteler
  for (const s of [-1, 1]) {
    const x = s * (HW - 0.052);
    const seg = (y0, y1, mat) => { const o = mesh(box(0.11, y1 - y0 - 0.004, 0.11, 0.015), mat, false); o.position.set(x, (y0 + y1) / 2, B.z1 - 0.05); add(o); };
    seg(1.06, 1.19, m.tail);
    seg(1.0, 1.06, m.reverse);
    seg(0.93, 1.0, m.amber);
    seg(0.84, 0.93, m.tail);
  }
  // krom basamakli arka tampon + plaka
  add(mesh(box(1.86, 0.2, 0.2, 0.035, 3).translate(0, 0.615, B.z1 + 0.09), m.chrome));
  add(mesh(box(0.7, 0.012, 0.13, 0.004).translate(0, 0.72, B.z1 + 0.08), m.rubber, false));
  add(mesh(box(0.56, 0.13, 0.02, 0.01).translate(0, 0.61, B.z1 + 0.185), m.seam, false));
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.11), m.plate, false);
  plate.position.set(0, 0.61, B.z1 + 0.197); add(plate);
  // bagaj kapagi: kabartma HILUX yazisi ve tutamak
  const txt = new THREE.PlaneGeometry(0.72, 0.135);
  txt.translate(0, 0.97, B.z1 + 0.003);
  const tm = new THREE.MeshStandardMaterial({ map: textTexture('HILUX', { font: 'bold 72px Arial', color: '#9ea2a6' }), transparent: true, alphaTest: 0.3, metalness: 0.6, roughness: 0.35 });
  const t = model.addToPart('tailgate', txt, tm, false);
  t.userData.keep = true;
  model.addToPart('tailgate', box(0.24, 0.045, 0.03, 0.01).translate(0, 1.15, B.z1 + 0.004), m.black, false);
}

// ---------------------------------------------------------------- yan ayrintilar
function details(ctx) {
  const { S, m, add, model } = ctx;
  // aynalar (on kapilarla birlikte acilir)
  for (const s of [-1, 1]) {
    const name = s < 0 ? 'door0' : 'door1';
    const hz = -0.72, hy = 1.37;
    model.addToPart(name, box(0.085, 0.19, 0.27, 0.035, 3).translate(s * 1.03, hy, hz), m.paint);
    model.addToPart(name, box(0.07, 0.04, 0.12, 0.015).translate(s * 0.95, hy - 0.05, hz - 0.03), m.black, false);
    const glass = new THREE.PlaneGeometry(0.24, 0.16);
    glass.rotateY(s < 0 ? -0.12 : 0.12);
    glass.translate(s * 1.03, hy, hz + 0.136);
    model.addToPart(name, glass, m.mirror, false);
    // sinyal (ayna kapaginda)
    model.addToPart(name, box(0.01, 0.022, 0.16, 0.005).translate(s * 1.073, hy - 0.04, hz - 0.02), m.amber, false);
  }
  // kapi kollari (krom)
  S.doors.forEach((d, k) => {
    for (const s of [-1, 1]) {
      const idx = k * 2 + (s > 0 ? 1 : 0);
      model.addToPart(`door${idx}`, box(0.03, 0.045, 0.17, 0.015).translate(s * (HW + 0.012), 1.14, d.z1 - 0.15), m.chrome, false);
    }
  });
  // camurluk kaslari (siyah plastik) - on ve arka yaylar
  for (const s of [-1, 1]) {
    for (const ax of S.axles) {
      const path = archPath(S, ax, 0.005, s * (HW + 0.004));
      const prof = s > 0
        ? [{ x: -0.06, y: -0.012 }, { x: 0.004, y: -0.012 }, { x: 0.004, y: 0.022 }, { x: -0.06, y: 0.03 }]
        : [{ x: -0.004, y: -0.012 }, { x: 0.06, y: -0.012 }, { x: 0.06, y: 0.03 }, { x: -0.004, y: 0.022 }];
      add(mesh(sweep(path, prof, { up: new THREE.Vector3(s, 0, 0) }), m.plastic));
    }
  }
  // yan basamaklar
  for (const s of [-1, 1]) {
    add(mesh(box(0.2, 0.045, 1.86, 0.02, 3).translate(s * (HW - 0.06), 0.47, 0.08), m.black));
    add(mesh(box(0.17, 0.006, 1.8, 0.002).translate(s * (HW - 0.06), 0.494, 0.08), m.satin, false));
  }
  // kopekbaligi anteni
  add(mesh(box(0.06, 0.06, 0.16, 0.025).translate(0, ROOF + 0.025, 0.95), m.blackGloss, false));
}

export const HILUX_SPEC = {
  id: 'hilux', name: 'Toyota Hilux',
  zF: ZF, zN: ZN, hoodZ0: ZN + 0.03, zWS0: ZWS0, zWS1: ZWS1, zRoof1: ZROOF1, zGH1: ZEND, zEnd: ZEND,
  axles: [AXF, AXR], wr: 0.385, tireW: 0.265, trackF: 1.54, trackR: 1.55,
  archR: 0.47, archCY: 0.4, archP: 2.3, well: 0.28,
  rt: 0.045, rb: 0.06,
  hoodHalf: 0.79,
  halfW, yTop, yBot, sideShape, crown, yRoof,
  roofW: () => 0.745, roofR: 0.055, roofCrown: 0.02, glassInset: 0.03, winTopDrop: 0.065,
  rearGlassInset: 0.17, rearGlassBottom: 0.07,
  doorBottom: 0.6,
  doors: [{ z0: -0.9, z1: 0.1 }, { z0: 0.16, z1: 0.99 }],
  windows: [{ z0: -0.88, z1: 0.07, door: 0 }, { z0: 0.19, z1: 0.96, door: 1, privacy: true }],
  pillarBlack: [[0.1, 0.16]],
  aPillar: 'paint', pillar: 'trim', trimMat: 'blackGloss',
  bed: { z0: 1.28, z1: 3.03, bottom: 0.62, rail: 1.24, floor: 0.88, wall: 0.06, tgBottom: 0.73, tgDepth: 0.06, railMat: 'black', innerMat: 'paint', floorMat: 'plastic' },
  under: {
    frameX: 0.42, frameY: 0.5, frameZ0: -2.0, frameZ1: 2.95, cross: [-1.75, -0.6, 0.6, 1.9, 2.8],
    tankX: -0.3, tankZ: 0.55, engineY: 0.62, spare: { y: 0.47, z: 2.55 },
    exhaust: [{ x: 0.62, y: 0.44, z: 2.28, r: 0.03, len: 3.6, down: true }],
  },
  interior: {
    floorY: 0.74, cabZ1: 1.18, dashDepth: 0.5, dashH: 0.26, screen: { w: 0.21, h: 0.12, y: 0.06 },
    driverX: -0.38, maxSpeed: 220, maxRpm: 6000, wheelR: 0.19, seatX: 0.37, seatY: 0.9, seatZ: -0.08, rearSeatZ: 0.72,
  },
  wheel: { rimR: 0.216, spokes: 6, spokeW: 0.045, spokeDepth: 0.03, split: true, lugs: 6, mat: 'alloy', caliper: 'black', shoulder: 0.045 },
  tread: 'at',
  spot: { x: 0.66, y: 0.95 },
  cam: { hood: [0, 0.36, -1.25], cockpit: [-0.38, 0.74, -0.12], chase: 1.15 },
  front, rear, details,
  engine: 'i4d', engineAccent: 0x2a2c30,
};
