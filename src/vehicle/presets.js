// Arac parametreleri. Degerler Tofas Kartal (Fiat 131 Panorama tabanli, 1.6 OHC,
// arkadan itis, 5 ileri) icin gercekci olacak sekilde secildi.
// Govde ekseni: +x sag, +y yukari, -z ileri; konumlar kutle merkezine gore (metre).

export const KARTAL = {
  id: 'kartal',
  name: 'Tofaş Kartal 1.6',
  mass: 1150,                       // kg (surucu dahil)
  inertia: { x: 1750, y: 1950, z: 420 }, // yunuslama, sapma, yuvarlanma (kg m^2)
  // kutle merkezi yerden yuksekligi (statik konumda)
  cgHeight: 0.52,
  dims: { length: 4.26, width: 1.65, height: 1.43, wheelbase: 2.49, trackF: 1.37, trackR: 1.31 },
  // agirlik dagilimi on %54 -> on aks kutle merkezinin 1.146 m onunde
  axleFront: -1.146,
  axleRear: 1.344,

  wheel: { radius: 0.287, width: 0.165, mass: 18, inertia: 1.15 },
  suspension: {
    // rest = yay serbest boyu; travel = en fazla sikisma (statik ~0.14 m)
    front: { rest: 0.30, travel: 0.24, k: 21500, bump: 1650, rebound: 2600, arb: 14000 },
    rear: { rest: 0.30, travel: 0.24, k: 18500, bump: 1500, rebound: 2300, arb: 5500 },
    mountY: -0.075,                 // suspansiyon ust baglantisinin CG'ye gore yuksekligi
  },
  tire: {
    mu: 0.9,                        // kuru tas/asfalt tepe surtunmesi (80'ler radyal lastik)
    slideRatio: 0.82,               // kayarken kalan surtunme orani
    peakSlip: 0.11,                 // tepe kayma acisi (rad, ~6.3 derece)
    peakRatio: 0.10,                // tepe boyuna kayma orani
    loadSens: 0.08,                 // yuk duyarliligi
    rolling: 0.012,
  },
  engine: {
    sound: 'kartal',                // motor sesi profili (src/audio/engine-worklet.js)
    idle: 850, redline: 6200, limiter: 6350,
    inertia: 0.16,
    // tork egrisi (rpm, Nm) - 1585 cc ~75 BG
    torque: [[0, 70], [800, 88], [1500, 104], [2500, 118], [3000, 124], [3800, 123], [4500, 116], [5400, 102], [6000, 90], [6400, 76], [7000, 50]],
    brakeTorque: 0.16,              // gazsizken motor freni (tam torkun orani)
  },
  gearbox: {
    ratios: [-3.244, 0, 3.612, 2.045, 1.357, 1.0, 0.865], // R, N, 1..5
    final: 3.909,
    efficiency: 0.9,
    shiftTime: 0.28,
    clutchTorque: 320,
  },
  diff: { lsd: 25 },               // hafif viskoz kilitlemeli (Nm / rad/s)
  brakes: { front: 1350, rear: 650, handbrake: 1900, abs: true },
  // fabrika donanimi: ayarlardaki surus yardimlari yalnizca aracta var olani acar.
  // Kartal'da cekis kontrolu (gaz kesme) yoktu; patinaj surucunun ayagindadir.
  equipment: { tcs: false },
  steering: { maxAngle: 0.62, speedReduce: 0.62, rate: 2.3, returnRate: 3.4, ackermann: 0.95 },
  aero: { cdA: 0.84, rho: 1.2 },
  // carpisma kureleri (govde ekseni, CG'ye gore)
  // govde: on tampon z=-1.95, arka tampon z=+2.31 (CG'ye gore), taban ~0.2 m, tavan ~1.43 m (yerden)
  // Tampon kureleri gercek tampon alt kenarina (~27 cm) oturur: yaklasma acisi ~23 derece.
  // (Eski 0.27 m yaricapli kureler alt kenari 18 cm'ye indiriyor, her bordure takiliyordu.)
  colliders: [
    // on tampon koseleri ve ortasi
    { p: [-0.56, -0.04, -1.74], r: 0.21 }, { p: [0.56, -0.04, -1.74], r: 0.21 }, { p: [0, -0.04, -1.75], r: 0.21 },
    // motor karteri / on travers (en alcak nokta ~16 cm)
    { p: [0, -0.30, -1.2], r: 0.06 },
    // arka tampon
    { p: [-0.55, 0.0, 2.1], r: 0.21 }, { p: [0.55, 0.0, 2.1], r: 0.21 }, { p: [0, 0.0, 2.11], r: 0.2 },
    // arka sabit aks diferansiyeli
    { p: [0, -0.29, 1.344], r: 0.065 },
    // yan govde (kapilar)
    { p: [-0.5, -0.02, -0.8], r: 0.32 }, { p: [0.5, -0.02, -0.8], r: 0.32 },
    { p: [-0.5, -0.02, 0.3], r: 0.32 }, { p: [0.5, -0.02, 0.3], r: 0.32 },
    { p: [-0.5, -0.02, 1.35], r: 0.32 }, { p: [0.5, -0.02, 1.35], r: 0.32 },
    // tavan koseleri (takla)
    { p: [-0.5, 0.7, -0.05], r: 0.2 }, { p: [0.5, 0.7, -0.05], r: 0.2 },
    { p: [-0.5, 0.7, 1.85], r: 0.2 }, { p: [0.5, 0.7, 1.85], r: 0.2 },
    // alt govde (karin)
    { p: [0, -0.21, -0.5], r: 0.13 }, { p: [0, -0.21, 0.7], r: 0.13 },
  ],
  maxHealth: 100,
};

/** Zemin malzemesi -> lastik surtunmesi ve yuvarlanma direnci carpanlari (tiles.json flags). */
export const SURFACES = {
  0: { name: 'Toprak', mu: 0.78, rolling: 2.0, dust: [0.55, 0.45, 0.33], dustAmt: 0.7 },
  1: { name: 'Kum', mu: 0.66, rolling: 4.5, dust: [0.78, 0.68, 0.52], dustAmt: 1.0 },
  3: { name: 'Taş', mu: 1.0, rolling: 1.0, dust: [0.6, 0.6, 0.6], dustAmt: 0.0 },
  6: { name: 'Çamur', mu: 0.55, rolling: 5.0, dust: [0.35, 0.3, 0.22], dustAmt: 0.5 },
  7: { name: 'Islak', mu: 0.52, rolling: 3.0, dust: [0.5, 0.55, 0.6], dustAmt: 0.3 },
  9: { name: 'Kar', mu: 0.42, rolling: 3.0, dust: [0.95, 0.96, 1.0], dustAmt: 0.8 },
  10: { name: 'Çimen', mu: 0.72, rolling: 2.6, dust: [0.42, 0.48, 0.28], dustAmt: 0.35 },
  11: { name: 'Çimen', mu: 0.72, rolling: 2.6, dust: [0.42, 0.48, 0.28], dustAmt: 0.35 },
  12: { name: 'Çimen', mu: 0.72, rolling: 2.6, dust: [0.42, 0.48, 0.28], dustAmt: 0.35 },
  100: { name: 'Kaldırım', mu: 1.0, rolling: 1.0, dust: [0.6, 0.6, 0.6], dustAmt: 0.0 },
};
export const surfaceInfo = (flag) => SURFACES[flag] || SURFACES[0];

/** Bir on ayari derin kopyalayip degistirir (diziler oldugu gibi degisir). */
function derive(base, over) {
  const out = structuredClone(base);
  const merge = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v);
      else a[k] = v;
    }
  };
  merge(out, over);
  return out;
}

// Ralli hazirligi: yukseltilmis uzun yollu suspansiyon (+6 cm), cift Weber + kam (~130 BG),
// yakin oranli sanziman ve kisa son dislisi, plakali kilitli diferansiyel, cakil lastigi,
// karter korumasi, hidrolik el freni. Govde ayni; tum carpisma kureleri suspansiyonla yukselir.
export const KARTAL_RALLY = derive(KARTAL, {
  id: 'kartal_ralli',
  name: 'Tofaş Kartal Ralli',
  mass: 1090,
  inertia: { x: 1650, y: 1850, z: 400 },
  cgHeight: 0.58,
  suspension: {
    front: { rest: 0.335, travel: 0.30, k: 25000, bump: 2100, rebound: 3300, arb: 16000 },
    rear: { rest: 0.335, travel: 0.30, k: 21000, bump: 1900, rebound: 2900, arb: 7000 },
  },
  tire: { mu: 0.86, slideRatio: 0.8, peakSlip: 0.13, peakRatio: 0.12, loadSens: 0.08, rolling: 0.013, loose: 0.32 },
  engine: {
    sound: 'kartal', idle: 950, redline: 7200, limiter: 7400, inertia: 0.12,
    torque: [[0, 80], [1000, 100], [2000, 118], [3000, 132], [4000, 145], [5000, 152], [5800, 150], [6500, 142], [7000, 130], [7400, 112], [8000, 70]],
    brakeTorque: 0.18,
  },
  gearbox: {
    ratios: [-3.244, 0, 3.25, 2.12, 1.55, 1.21, 1.0], final: 4.3, efficiency: 0.9, shiftTime: 0.22, clutchTorque: 360,
    shiftUp: [3000, 6800], shiftDown: [1600, 3200], launch: 3200,
  },
  diff: { lsd: 110 },
  brakes: { front: 1550, rear: 780, handbrake: 2600, abs: true },
  steering: { maxAngle: 0.64, rate: 2.6 },
  maxHealth: 120,
});
// karter korumasi: en alcak nokta biraz yukari ve daha genis
KARTAL_RALLY.colliders = KARTAL.colliders.map((c) => (c.p[1] < -0.25 && c.p[2] < -1 ? { p: [0, -0.27, -1.2], r: 0.07 } : c));

// Toyota Hilux 2.8 D-4D (8. nesil, cift kabin 4x4, 6 ileri otomatik). Uretici verisi:
// 204 PS / 500 Nm (1600-2800), 2180 kg (surucu dahil), dingil mesafesi 3.085 m, yerden
// yukseklik 28.6 cm, yaklasma 29 / uzaklasma 26 / rampa 25 derece, 265/65 R17 lastik.
export const HILUX = {
  id: 'hilux',
  name: 'Toyota Hilux 2.8',
  mass: 2180,
  inertia: { x: 4700, y: 5000, z: 1150 },
  cgHeight: 0.8,
  dims: { length: 5.33, width: 1.855, height: 1.815, wheelbase: 3.085, trackF: 1.54, trackR: 1.55 },
  axleFront: -1.33,
  axleRear: 1.755,
  wheel: { radius: 0.385, width: 0.265, mass: 34, inertia: 2.9 },
  suspension: {
    front: { rest: 0.345, travel: 0.25, k: 56000, bump: 3600, rebound: 5600, arb: 22000 },
    rear: { rest: 0.345, travel: 0.29, k: 43000, bump: 2800, rebound: 4300, arb: 6000 },
    mountY: -0.18,
  },
  tire: { mu: 0.86, slideRatio: 0.8, peakSlip: 0.12, peakRatio: 0.11, loadSens: 0.1, rolling: 0.014, loose: 0.3 },
  engine: {
    sound: 'hilux', idle: 750, redline: 3900, limiter: 4150, inertia: 0.24,
    torque: [[0, 180], [700, 230], [1000, 300], [1300, 420], [1600, 500], [2800, 500], [3200, 465], [3600, 400], [4000, 300], [4400, 150]],
    brakeTorque: 0.1,
  },
  gearbox: {
    ratios: [-3.732, 0, 3.6, 2.09, 1.488, 1.0, 0.687, 0.58], final: 3.909, efficiency: 0.86, shiftTime: 0.2, clutchTorque: 1200,
    shiftUp: [1500, 3600], shiftDown: [1000, 1700], launch: 1100,
  },
  drive: 'awd',
  diff: { front: 0.45, center: 350, lsd: 140, lsdFront: 70 },
  brakes: { front: 2800, rear: 1500, handbrake: 2600, abs: true },
  steering: { maxAngle: 0.58, speedReduce: 0.6, rate: 2.0, returnRate: 3.0, ackermann: 0.95 },
  aero: { cdA: 1.3, rho: 1.2 },
  colliders: [
    // on tampon (alt kenar ~46 cm): yaklasma ~30 derece
    { p: [-0.66, -0.08, -2.05], r: 0.26 }, { p: [0.66, -0.08, -2.05], r: 0.26 }, { p: [0, -0.08, -2.08], r: 0.26 },
    { p: [-0.6, 0.35, -1.9], r: 0.15 }, { p: [0.6, 0.35, -1.9], r: 0.15 },
    // on diferansiyel, sasi ortasi (rampa ~25 derece), arka diferansiyel (22 cm)
    { p: [0, -0.45, -1.25], r: 0.08 }, { p: [0, -0.4, 0.2], r: 0.1 }, { p: [0, -0.5, 1.755], r: 0.08 },
    // arka tampon / kasa sonu: uzaklasma ~26 derece
    { p: [-0.62, 0.0, 2.92], r: 0.22 }, { p: [0.62, 0.0, 2.92], r: 0.22 },
    // yanlar: kabin ve kasa
    { p: [-0.66, 0.05, -1.5], r: 0.3 }, { p: [0.66, 0.05, -1.5], r: 0.3 },
    { p: [-0.66, 0.05, -0.6], r: 0.3 }, { p: [0.66, 0.05, -0.6], r: 0.3 },
    { p: [-0.66, 0.05, 0.3], r: 0.3 }, { p: [0.66, 0.05, 0.3], r: 0.3 },
    { p: [-0.68, 0.1, 1.2], r: 0.3 }, { p: [0.68, 0.1, 1.2], r: 0.3 },
    { p: [-0.68, 0.1, 2.2], r: 0.3 }, { p: [0.68, 0.1, 2.2], r: 0.3 },
    // tavan ve kasa ust kenari (takla)
    { p: [-0.55, 0.92, -0.75], r: 0.12 }, { p: [0.55, 0.92, -0.75], r: 0.12 },
    { p: [-0.55, 0.92, 0.35], r: 0.12 }, { p: [0.55, 0.92, 0.35], r: 0.12 },
    { p: [-0.7, 0.32, 1.3], r: 0.12 }, { p: [0.7, 0.32, 1.3], r: 0.12 },
    { p: [-0.7, 0.32, 2.75], r: 0.12 }, { p: [0.7, 0.32, 2.75], r: 0.12 },
  ],
  maxHealth: 170,
};

// Ford F-150 5.0 V8 (14. nesil SuperCrew 5.5 ft kasa 4x4, 10 ileri otomatik). Uretici verisi:
// 400 HP / 556 Nm (4250), 2350 kg, dingil mesafesi 3.683 m, yerden yukseklik 23.9 cm,
// yaklasma 24 / uzaklasma 26 / rampa 21 derece, 275/65 R18 lastik.
export const F150 = {
  id: 'f150',
  name: 'Ford F-150 5.0 V8',
  mass: 2350,
  inertia: { x: 6100, y: 6500, z: 1400 },
  cgHeight: 0.84,
  dims: { length: 5.89, width: 2.03, height: 1.96, wheelbase: 3.683, trackF: 1.73, trackR: 1.73 },
  axleFront: -1.62,
  axleRear: 2.063,
  wheel: { radius: 0.408, width: 0.275, mass: 37, inertia: 3.4 },
  suspension: {
    front: { rest: 0.35, travel: 0.24, k: 60000, bump: 3900, rebound: 6000, arb: 26000 },
    rear: { rest: 0.35, travel: 0.28, k: 46000, bump: 3000, rebound: 4600, arb: 9000 },
    mountY: -0.19,
  },
  tire: { mu: 0.88, slideRatio: 0.8, peakSlip: 0.12, peakRatio: 0.11, loadSens: 0.1, rolling: 0.013, loose: 0.25 },
  engine: {
    sound: 'f150', idle: 650, redline: 6600, limiter: 6900, inertia: 0.2, vmax: 172,
    torque: [[0, 300], [800, 380], [1500, 430], [2500, 490], [3500, 530], [4250, 556], [5000, 545], [5750, 510], [6250, 475], [6600, 440], [7000, 380], [7500, 250]],
    brakeTorque: 0.14,
  },
  gearbox: {
    ratios: [-4.866, 0, 4.696, 2.985, 2.146, 1.769, 1.52, 1.275, 1.0, 0.854, 0.689, 0.636], final: 3.55, efficiency: 0.86,
    shiftTime: 0.14, clutchTorque: 1500, shiftUp: [1400, 6200], shiftDown: [900, 3000], launch: 1500,
  },
  drive: 'awd',
  diff: { front: 0.42, center: 300, lsd: 160, lsdFront: 60 },
  brakes: { front: 3000, rear: 1700, handbrake: 2600, abs: true },
  steering: { maxAngle: 0.56, speedReduce: 0.6, rate: 2.0, returnRate: 3.0, ackermann: 0.95 },
  aero: { cdA: 1.6, rho: 1.2 },
  colliders: [
    // on tampon + hava baraji (alt kenar ~36 cm): yaklasma ~25 derece
    { p: [-0.75, -0.08, -2.35], r: 0.27 }, { p: [0.75, -0.08, -2.35], r: 0.27 }, { p: [0, -0.28, -2.3], r: 0.2 },
    { p: [-0.68, 0.38, -2.25], r: 0.16 }, { p: [0.68, 0.38, -2.25], r: 0.16 },
    // on diferansiyel, sasi ortasi (rampa ~21 derece), arka diferansiyel
    { p: [0, -0.47, -1.5], r: 0.09 }, { p: [0, -0.43, 0.22], r: 0.1 }, { p: [0, -0.5, 2.063], r: 0.09 },
    // arka tampon: uzaklasma ~26 derece
    { p: [-0.7, -0.02, 3.15], r: 0.24 }, { p: [0.7, -0.02, 3.15], r: 0.24 },
    // yanlar
    { p: [-0.75, 0.08, -1.9], r: 0.32 }, { p: [0.75, 0.08, -1.9], r: 0.32 },
    { p: [-0.75, 0.08, -0.9], r: 0.32 }, { p: [0.75, 0.08, -0.9], r: 0.32 },
    { p: [-0.75, 0.08, 0.2], r: 0.32 }, { p: [0.75, 0.08, 0.2], r: 0.32 },
    { p: [-0.77, 0.12, 1.3], r: 0.32 }, { p: [0.77, 0.12, 1.3], r: 0.32 },
    { p: [-0.77, 0.12, 2.4], r: 0.32 }, { p: [0.77, 0.12, 2.4], r: 0.32 },
    // tavan ve kasa ust kenari
    { p: [-0.62, 1.0, -0.9], r: 0.12 }, { p: [0.62, 1.0, -0.9], r: 0.12 },
    { p: [-0.62, 1.0, 0.35], r: 0.12 }, { p: [0.62, 1.0, 0.35], r: 0.12 },
    { p: [-0.78, 0.36, 1.35], r: 0.12 }, { p: [0.78, 0.36, 1.35], r: 0.12 },
    { p: [-0.78, 0.36, 3.05], r: 0.12 }, { p: [0.78, 0.36, 3.05], r: 0.12 },
  ],
  maxHealth: 190,
};

// Audi RS 6 Avant (C8). 4.0 TFSI V8 cift turbo 600 PS / 800 Nm (2050-4500), 8 ileri tiptronic,
// quattro (40/60, spor diferansiyel), havali suspansiyon. 2150 kg, dingil mesafesi 2.929 m,
// 285/30 R22. 0-100 ~3.6 s; hiz siniri (Dynamic) 280 km/s.
export const RS6 = {
  id: 'rs6',
  name: 'Audi RS 6 Avant',
  mass: 2150,
  inertia: { x: 3600, y: 3900, z: 760 },
  cgHeight: 0.52,
  dims: { length: 4.995, width: 1.951, height: 1.46, wheelbase: 2.929, trackF: 1.668, trackR: 1.651 },
  axleFront: -1.29,
  axleRear: 1.639,
  wheel: { radius: 0.365, width: 0.285, mass: 30, inertia: 2.2 },
  suspension: {
    front: { rest: 0.26, travel: 0.2, k: 60800, bump: 3800, rebound: 5800, arb: 30000, mountY: 0.008 },
    rear: { rest: 0.26, travel: 0.2, k: 54000, bump: 3200, rebound: 4800, arb: 22000, mountY: 0.019 },
    mountY: 0.01,
  },
  tire: { mu: 1.05, slideRatio: 0.85, peakSlip: 0.1, peakRatio: 0.09, loadSens: 0.1, rolling: 0.011, loose: 0, sink: 3 },
  engine: {
    sound: 'rs6', idle: 700, redline: 6800, limiter: 7000, inertia: 0.18, vmax: 280,
    torque: [[0, 400], [1000, 600], [2050, 800], [4500, 800], [5000, 765], [6000, 700], [6600, 640], [7000, 560], [7400, 400]],
    brakeTorque: 0.15,
  },
  gearbox: {
    ratios: [-3.317, 0, 5.0, 3.2, 2.143, 1.72, 1.314, 1.0, 0.822, 0.64], final: 3.204, efficiency: 0.88,
    shiftTime: 0.1, clutchTorque: 1400, shiftUp: [1600, 6600], shiftDown: [1000, 3200], launch: 2500,
  },
  drive: 'awd',
  diff: { front: 0.4, center: 250, lsd: 220, lsdFront: 40 },
  brakes: { front: 3800, rear: 2000, handbrake: 2200, abs: true },
  steering: { maxAngle: 0.55, speedReduce: 0.6, rate: 2.6, returnRate: 3.6, ackermann: 0.95 },
  aero: { cdA: 0.75, rho: 1.2 },
  colliders: [
    // on tampon / splitter (alt kenar ~14 cm)
    { p: [-0.7, -0.18, -2.06], r: 0.21 }, { p: [0.7, -0.18, -2.06], r: 0.21 }, { p: [0, -0.15, -2.06], r: 0.21 },
    { p: [-0.6, 0.35, -1.7], r: 0.12 }, { p: [0.6, 0.35, -1.7], r: 0.12 },
    // taban
    { p: [0, -0.3, -0.6], r: 0.09 }, { p: [0, -0.3, 0.6], r: 0.09 }, { p: [0, -0.27, 1.64], r: 0.1 },
    // arka tampon
    { p: [-0.7, -0.1, 2.5], r: 0.22 }, { p: [0.7, -0.1, 2.5], r: 0.22 },
    // yanlar
    { p: [-0.74, 0.0, -1.3], r: 0.24 }, { p: [0.74, 0.0, -1.3], r: 0.24 },
    { p: [-0.74, 0.0, -0.3], r: 0.24 }, { p: [0.74, 0.0, -0.3], r: 0.24 },
    { p: [-0.74, 0.0, 0.7], r: 0.24 }, { p: [0.74, 0.0, 0.7], r: 0.24 },
    { p: [-0.74, 0.0, 1.7], r: 0.24 }, { p: [0.74, 0.0, 1.7], r: 0.24 },
    // tavan
    { p: [-0.55, 0.85, 0.0], r: 0.08 }, { p: [0.55, 0.85, 0.0], r: 0.08 },
    { p: [-0.55, 0.85, 1.4], r: 0.08 }, { p: [0.55, 0.85, 1.4], r: 0.08 },
    { p: [-0.5, 0.8, 2.1], r: 0.08 }, { p: [0.5, 0.8, 2.1], r: 0.08 },
  ],
  maxHealth: 140,
};

// Rezvani Tank (Jeep Wrangler JL tabanli, 6.4 HEMI V8 ~500 BG / 637 Nm, 8 ileri otomatik,
// kilitli diferansiyelli 4x4, 37 inc lastik). ~2700 kg, dingil mesafesi 3.01 m,
// yerden yukseklik ~33 cm, yaklasma ~40 derece.
export const TANK = {
  id: 'tank',
  name: 'Rezvani Tank',
  mass: 2700,
  inertia: { x: 6000, y: 6400, z: 1700 },
  cgHeight: 0.98,
  dims: { length: 4.98, width: 2.16, height: 1.98, wheelbase: 3.01, trackF: 1.83, trackR: 1.83 },
  axleFront: -1.355,
  axleRear: 1.655,
  wheel: { radius: 0.47, width: 0.32, mass: 55, inertia: 6.0 },
  suspension: {
    front: { rest: 0.42, travel: 0.36, k: 62000, bump: 4000, rebound: 6500, arb: 20000 },
    rear: { rest: 0.42, travel: 0.36, k: 55000, bump: 3500, rebound: 5500, arb: 8000 },
    mountY: -0.2,
  },
  tire: { mu: 0.82, slideRatio: 0.8, peakSlip: 0.13, peakRatio: 0.12, loadSens: 0.1, rolling: 0.018, loose: 0.42 },
  engine: {
    sound: 'tank', idle: 650, redline: 6400, limiter: 6600, inertia: 0.22, vmax: 170,
    torque: [[0, 380], [1000, 480], [2000, 560], [3000, 610], [4200, 637], [5000, 620], [6000, 570], [6400, 530], [6800, 450], [7200, 300]],
    brakeTorque: 0.15,
  },
  gearbox: {
    ratios: [-3.53, 0, 4.71, 3.14, 2.11, 1.67, 1.29, 1.0, 0.84, 0.67], final: 4.1, efficiency: 0.85,
    shiftTime: 0.14, clutchTorque: 1700, shiftUp: [1500, 6000], shiftDown: [1000, 2800], launch: 1600,
  },
  drive: 'awd',
  diff: { front: 0.45, center: 400, lsd: 400, lsdFront: 300 },
  brakes: { front: 3600, rear: 2200, handbrake: 3000, abs: true },
  steering: { maxAngle: 0.55, speedReduce: 0.6, rate: 2.0, returnRate: 3.0, ackermann: 0.95 },
  aero: { cdA: 1.9, rho: 1.2 },
  colliders: [
    // on tampon: yaklasma ~37 derece
    { p: [-0.75, -0.05, -2.25], r: 0.2 }, { p: [0.75, -0.05, -2.25], r: 0.2 }, { p: [0, -0.05, -2.28], r: 0.2 },
    { p: [-0.7, 0.3, -2.1], r: 0.15 }, { p: [0.7, 0.3, -2.1], r: 0.15 },
    // sabit akslar ve karter korumasi (yerden ~30 cm)
    { p: [0, -0.62, -1.4], r: 0.07 }, { p: [0, -0.55, 0.15], r: 0.12 }, { p: [0, -0.62, 1.655], r: 0.07 },
    // arka tampon
    { p: [-0.75, -0.08, 2.25], r: 0.2 }, { p: [0.75, -0.08, 2.25], r: 0.2 },
    // yanlar
    { p: [-0.8, 0.0, -1.6], r: 0.28 }, { p: [0.8, 0.0, -1.6], r: 0.28 },
    { p: [-0.8, 0.0, -0.6], r: 0.28 }, { p: [0.8, 0.0, -0.6], r: 0.28 },
    { p: [-0.8, 0.0, 0.4], r: 0.28 }, { p: [0.8, 0.0, 0.4], r: 0.28 },
    { p: [-0.8, 0.0, 1.4], r: 0.28 }, { p: [0.8, 0.0, 1.4], r: 0.28 },
    { p: [-0.8, 0.0, 2.1], r: 0.28 }, { p: [0.8, 0.0, 2.1], r: 0.28 },
    // tavan
    { p: [-0.65, 0.9, -0.4], r: 0.1 }, { p: [0.65, 0.9, -0.4], r: 0.1 },
    { p: [-0.65, 0.9, 0.8], r: 0.1 }, { p: [0.65, 0.9, 0.8], r: 0.1 },
    { p: [-0.65, 0.9, 2.0], r: 0.1 }, { p: [0.65, 0.9, 2.0], r: 0.1 },
  ],
  maxHealth: 320,
};

/** Surum (gorunum) + hazirliga gore fizik on ayari. */
export function presetFor(variant, prep = 'ralli') {
  if (variant === 'hilux') return HILUX;
  if (variant === 'f150') return F150;
  if (variant === 'rs6') return RS6;
  if (variant === 'tank') return TANK;
  return prep === 'stok' ? KARTAL : KARTAL_RALLY;
}
