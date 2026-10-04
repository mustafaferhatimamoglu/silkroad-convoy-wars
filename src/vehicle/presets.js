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
  steering: { maxAngle: 0.62, speedReduce: 0.62, rate: 2.3, returnRate: 3.4, ackermann: 0.95 },
  aero: { cdA: 0.84, rho: 1.2 },
  // carpisma kureleri (govde ekseni, CG'ye gore)
  // govde: on tampon z=-1.95, arka tampon z=+2.31 (CG'ye gore), taban ~0.2 m, tavan ~1.43 m (yerden)
  colliders: [
    // on tampon koseleri ve ortasi
    { p: [-0.56, -0.07, -1.68], r: 0.27 }, { p: [0.56, -0.07, -1.68], r: 0.27 }, { p: [0, -0.07, -1.7], r: 0.26 },
    // arka tampon
    { p: [-0.55, -0.04, 2.05], r: 0.26 }, { p: [0.55, -0.04, 2.05], r: 0.26 }, { p: [0, -0.04, 2.07], r: 0.25 },
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
