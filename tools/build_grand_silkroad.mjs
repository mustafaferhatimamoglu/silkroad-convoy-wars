import fs from 'node:fs';
import { loadGenWorld } from './inspect_cities.mjs';
import { CityPathfinder } from './find_city_route.mjs';

const g = await loadGenWorld();

console.log('Generating Grand Silk Road collision-free paths across all 6 cities...');

/**
 * Check if the straight line chord from a to b is 100% free of bumper collisions
 * at every 0.5m step along the chord.
 */
function isChordClear(pf, a, b) {
  const dx0 = b.x - a.x, dz0 = b.z - a.z;
  const dist = Math.hypot(dx0, dz0);
  if (dist < 1e-4) return true;
  const dx = dx0 / dist, dz = dz0 / dist;
  const rightX = -dz, rightZ = dx;
  const steps = Math.max(1, Math.ceil(dist / 0.5));
  let prevY = pf.getGround(a.x, a.z);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = a.x + dx0 * t;
    const z = a.z + dz0 * t;
    const groundY = pf.getGround(x, z, prevY);
    if (s > 0) {
      const stepD = dist / steps;
      if (Math.abs(groundY - prevY) / Math.max(0.1, stepD) > 0.55) return false;
    }
    prevY = groundY;
    if (pf.bvh) {
      for (const lat of [-0.90, 0, 0.90]) {
        const bx = x + rightX * lat;
        const bz = z + rightZ * lat;
        const by = groundY + 0.55;
        pf.probeRay.origin.set(bx - dx * 0.4, by, bz - dz * 0.4);
        pf.probeRay.direction.set(dx, 0, dz);
        const hit = pf.bvh.raycastFirst(pf.probeRay, 2, 0, 1.25); // 2 = THREE.DoubleSide
        if (hit && Math.abs(hit.face.normal.y) < 0.6) return false;
      }
    }
  }
  return true;
}

/**
 * Decimate a grid path to ~5m spacing while guaranteeing every straight chord
 * is 100% collision-free at 0.5m resolution.
 */
function smoothAndResample(pf, rawPath, maxStepM = 5.5) {
  const pts = rawPath.map(([rx, rz]) => ({ x: rx * 192, z: -rz * 192 }));
  if (pts.length <= 2) return rawPath;

  // Optional gentle smoothing only when both incoming and outgoing chords remain 100% clear
  for (let iter = 0; iter < 4; iter++) {
    for (let i = 1; i < pts.length - 1; i++) {
      const cand = {
        x: 0.25 * pts[i - 1].x + 0.5 * pts[i].x + 0.25 * pts[i + 1].x,
        z: 0.25 * pts[i - 1].z + 0.5 * pts[i].z + 0.25 * pts[i + 1].z,
      };
      if (isChordClear(pf, pts[i - 1], cand) && isChordClear(pf, cand, pts[i + 1])) {
        pts[i] = cand;
      }
    }
  }

  // Greedy chord decimation up to maxStepM
  const kept = [pts[0]];
  let lastIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[lastIdx].x, pts[i].z - pts[lastIdx].z);
    const canSkipPrev = i < pts.length - 1 && d <= maxStepM && isChordClear(pf, pts[lastIdx], pts[i]);
    if (!canSkipPrev) {
      if (i - 1 > lastIdx) {
        kept.push(pts[i - 1]);
        lastIdx = i - 1;
      }
      if (i === pts.length - 1) {
        kept.push(pts[i]);
        lastIdx = i;
      }
    }
  }
  if (kept[kept.length - 1] !== pts[pts.length - 1]) kept.push(pts[pts.length - 1]);

  return kept.map(p => [+(p.x / 192).toFixed(4), +(-p.z / 192).toFixed(4)]);
}

function buildCitySegment(pf, wps, cityName) {
  const raw = [];
  for (let i = 0; i < wps.length - 1; i++) {
    const p = pf.findPath(wps[i], wps[i + 1], 1.5);
    if (!p) throw new Error(`${cityName} path failed at segment ${i} (${wps[i][2]} -> ${wps[i + 1][2]})`);
    raw.push(...(i === 0 ? p : p.slice(1)));
  }
  return smoothAndResample(pf, raw, 5.5);
}

// 1. CONSTANTINOPLE
console.log('1. Constantinople...');
const constKeys = [];
for (let rz = 104; rz <= 107; rz++) {
  for (let rx = 76; rx <= 80; rx++) {
    if (g.has(rx, rz)) constKeys.push(g.key(rx, rz));
  }
}
const constPf = new CityPathfinder(g, constKeys);
const constWps = [
  [79.50, 105.33, null],
  [79.00, 105.30, 'Mese Doğu Caddesi'],
  [78.50, 105.30, 'Bizans Dikilitaşı ve Revakları'],
  [78.00, 105.30, 'Teodosius Forumu'],
  [77.636, 105.777, 'Konstantiniyye Büyük Sur Kapısı'],
  [77.338, 105.773, 'Batı Kapısı Kemeri (İskenderiye Geçidi)'],
];
const constPath = buildCitySegment(constPf, constWps, 'Constantinople');
console.log(`  Constantinople path: ${constPath.length} nodes`);

// 2. ALEXANDRIA
console.log('2. Alexandria...');
const alexKeys = [];
for (let rz = 88; rz <= 92; rz++) {
  for (let rx = 47; rx <= 52; rx++) {
    if (g.has(rx, rz)) alexKeys.push(g.key(rx, rz));
  }
}
const alexPf = new CityPathfinder(g, alexKeys);
const alexWps = [
  [51.50, 90.50, null],
  [51.00, 89.60, 'Zeytinlik ve Vaha Kavşağı'],
  [50.00, 89.30, 'Nil Bağ Evleri'],
  [49.20, 88.50, 'İskenderiye Güney Yaklaşımı'],
  [48.35, 89.20, 'İskenderiye Güney Kapısı'],
  [48.35, 89.80, 'Firavun Caddesi ve Sfenksler'],
  [48.32, 90.50, 'İskenderiye Saray Meydanı (Semerkant Geçidi)'],
];
const alexPath = buildCitySegment(alexPf, alexWps, 'Alexandria');
console.log(`  Alexandria path: ${alexPath.length} nodes`);

// 3. SAMARKAND
console.log('3. Samarkand...');
const samKeys = [];
for (let rz = 104; rz <= 108; rz++) {
  for (let rx = 105; rx <= 111; rx++) {
    if (g.has(rx, rz)) recPush(samKeys, rx, rz);
  }
}
function recPush(arr, rx, rz) { arr.push(g.key(rx, rz)); }
const samPf = new CityPathfinder(g, samKeys);
const samWps = [
  [106.33, 105.04, null],
  [107.01, 105.00, 'Batı Giriş Takı'],
  [107.82, 105.11, 'Uluğ Bey Caddesi'],
  [108.14, 105.63, 'Registan Meydanı ve Çeşmeler'],
  [108.50, 106.00, 'Semerkant Kapalıçarşı Meydanı'],
  [108.90, 106.34, 'İpek Yolu Kervansaray Yolu'],
  [109.38, 106.92, 'Semerkant Doğu Kapısı'],
  [110.20, 107.03, 'Semerkant Dağ Geçidi (Hotan Geçidi)'],
];
const samPath = buildCitySegment(samPf, samWps, 'Samarkand');
console.log(`  Samarkand path: ${samPath.length} nodes`);

// 4. HOTAN
console.log('4. Hotan...');
const hotanKeys = [];
for (let rz = 91; rz <= 94; rz++) {
  for (let rx = 134; rx <= 137; rx++) {
    if (g.has(rx, rz)) hotanKeys.push(g.key(rx, rz));
  }
}
const hotanPf = new CityPathfinder(g, hotanKeys);
const hotanWps = [
  [134.70, 92.28, null],
  [134.98, 92.28, 'Hotan Kalesi Batı Giriş Kemeri'],
  [135.589, 92.25, 'Hotan Kalesi İçi Avlusu ve Saray Meydanı'],
  [135.584, 92.85, 'Hotan Kuzey Kapısı (Donwhang Geçidi)'],
];
const hotanPath = buildCitySegment(hotanPf, hotanWps, 'Hotan');
console.log(`  Hotan path: ${hotanPath.length} nodes`);

// 5. DONWHANG
console.log('5. Donwhang...');
const donwhangKeys = [];
for (let rz = 101; rz <= 105; rz++) {
  for (let rx = 150; rx <= 154; rx++) {
    if (g.has(rx, rz)) donwhangKeys.push(g.key(rx, rz));
  }
}
const donwhangPf = new CityPathfinder(g, donwhangKeys);
const donwhangWps = [
  [151.20, 103.00, null],
  [152.20, 103.00, 'Donwhang Kanyon Yolu'],
  [152.80, 103.10, 'Donwhang Vaha Girişi'],
  [153.48, 103.20, 'Donwhang Pagodalar Meydanı'],
  [153.48, 102.60, 'Donwhang Ana Caddesi'],
  [153.19, 102.15, 'Donwhang Güney Kapısı (Jangan Geçidi)'],
];
const donwhangPath = buildCitySegment(donwhangPf, donwhangWps, 'Donwhang');
console.log(`  Donwhang path: ${donwhangPath.length} nodes`);

// 6. JANGAN
console.log('6. Jangan...');
const janganKeys = [];
for (let rz = 95; rz <= 98; rz++) {
  for (let rx = 167; rx <= 169; rx++) {
    if (g.has(rx, rz)) janganKeys.push(g.key(rx, rz));
  }
}
const janganPf = new CityPathfinder(g, janganKeys);
const janganWps = [
  [168.505, 96.20, null],
  [168.505, 96.92, 'Jangan Büyük Güney Kapısı'],
  [168.505, 97.25, 'Çin Hanedanı Bulvarı ve Taş Heykeller'],
  [168.505, 97.44, 'Ejderha Saray Kapısı'],
  [168.505, 97.71, 'Jangan İmparatorluk Sarayı Avlusu'],
];
const janganPath = buildCitySegment(janganPf, janganWps, 'Jangan');
console.log(`  Jangan path: ${janganPath.length} nodes`);

// Assemble complete Grand Silk Road Stage definition
export const GRAND_SILKROAD_SEGMENTS = [
  { city: 'constantinople', name: 'Konstantiniyye Etabı', wps: constWps, path: constPath, pf: constPf },
  { city: 'alexandria', name: 'İskenderiye Etabı', wps: alexWps, path: alexPath, pf: alexPf },
  { city: 'samarkand', name: 'Semerkant Etabı', wps: samWps, path: samPath, pf: samPf },
  { city: 'hotan', name: 'Hotan Etabı', wps: hotanWps, path: hotanPath, pf: hotanPf },
  { city: 'donwhang', name: 'Donwhang Etabı', wps: donwhangWps, path: donwhangPath, pf: donwhangPf },
  { city: 'jangan', name: 'Jangan Etabı', wps: janganWps, path: janganPath, pf: janganPf },
];

const fullPath = [];
const fullCps = [];
const fullWl = [];
const fullWr = [];
let totalDist = 0;

for (let sIdx = 0; sIdx < GRAND_SILKROAD_SEGMENTS.length; sIdx++) {
  const seg = GRAND_SILKROAD_SEGMENTS[sIdx];
  const nextSeg = GRAND_SILKROAD_SEGMENTS[sIdx + 1] || null;
  const segStartIdx = fullPath.length;
  let prevY = null;
  for (let k = 0; k < seg.path.length; k++) {
    const pt = seg.path[k];
    if (k > 0) {
      const prev = seg.path[k - 1];
      totalDist += Math.hypot((pt[0] - prev[0]) * 192, (pt[1] - prev[1]) * 192);
    }
    fullPath.push(pt);

    // Measure left/right corridor clearance (wl, wr) within the city
    const pA = seg.path[Math.max(0, k - 1)];
    const pB = seg.path[Math.min(seg.path.length - 1, k + 1)];
    let dx = (pB[0] - pA[0]) * 192, dz = -(pB[1] - pA[1]) * 192;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    const x = pt[0] * 192, z = -pt[1] * 192;
    const gy = seg.pf.getGround(x, z, prevY);
    prevY = gy;
    let wlVal = 6.5, wrVal = 6.5;
    if (seg.pf.bvh) {
      seg.pf.probeRay.origin.set(x, gy + 0.65, z);
      seg.pf.probeRay.direction.set(dz, 0, -dx); // left
      const hitL = seg.pf.bvh.raycastFirst(seg.pf.probeRay, 2, 0, 7.5);
      if (hitL && Math.abs(hitL.face.normal.y) < 0.6) wlVal = Math.max(2.2, hitL.distance);

      seg.pf.probeRay.origin.set(x, gy + 0.65, z);
      seg.pf.probeRay.direction.set(-dz, 0, dx); // right
      const hitR = seg.pf.bvh.raycastFirst(seg.pf.probeRay, 2, 0, 7.5);
      if (hitR && Math.abs(hitR.face.normal.y) < 0.6) wrVal = Math.max(2.2, hitR.distance);
    }
    fullWl.push(+wlVal.toFixed(1));
    fullWr.push(+wrVal.toFixed(1));
  }
  const segEndIdx = fullPath.length - 1;
  if (nextSeg) {
    const np0 = nextSeg.path[0], np1 = nextSeg.path[Math.min(2, nextSeg.path.length - 1)];
    const dx = (np1[0] - np0[0]) * 192, dz = -(np1[1] - np0[1]) * 192;
    const yaw = +Math.atan2(-dx, -dz).toFixed(4);
    seg.warpTo = { rx: np0[0], rz: np0[1], yaw, toIdx: fullPath.length, city: nextSeg.city, name: nextSeg.name };
  } else {
    seg.warpTo = null;
  }

  for (let wIdx = 0; wIdx < seg.wps.length; wIdx++) {
    const wp = seg.wps[wIdx];
    if (!wp[2]) continue;
    const isLastInSeg = wIdx === seg.wps.length - 1;
    let bestIdx = isLastInSeg ? segEndIdx : segStartIdx;
    if (!isLastInSeg) {
      let bestDist = Infinity;
      for (let k = segStartIdx + 2; k < segEndIdx - 1; k++) {
        const d = Math.hypot((fullPath[k][0] - wp[0]) * 192, (fullPath[k][1] - wp[1]) * 192);
        if (d < bestDist) { bestDist = d; bestIdx = k; }
      }
    }
    fullCps.push({
      name: wp[2],
      i: bestIdx,
      ...(isLastInSeg && seg.warpTo ? { warp: seg.warpTo } : {}),
    });
  }
}

// Generate pilot notes within each segment (never crossing warp boundaries)
const notes = [];
let offset = 0;
for (const seg of GRAND_SILKROAD_SEGMENTS) {
  const n = seg.path.length;
  for (let k = 2; k < n - 2; k += 2) {
    const p0 = seg.path[k - 2], p1 = seg.path[k], p2 = seg.path[k + 2];
    const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    const a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const deg = Math.abs((da * 180) / Math.PI);
    if (deg > 20) {
      const dir = da > 0 ? 'L' : 'R';
      const g = deg > 75 ? 1 : deg > 52 ? 2 : deg > 35 ? 3 : deg > 25 ? 4 : 5;
      const idx = offset + k;
      if (notes.length && notes[notes.length - 1].k === dir && idx - notes[notes.length - 1].i <= 4) {
        notes[notes.length - 1].e = idx + 2;
        if (g < notes[notes.length - 1].g) notes[notes.length - 1].g = g;
      } else {
        notes.push({ i: idx, e: idx + 2, k: dir, g, ...(deg > 55 ? { long: true } : {}) });
      }
    }
  }
  offset += n;
}

export const grandSilkroadStage = {
  name: 'Büyük İpek Yolu Rallisi (6 Başkent)',
  desc: 'Konstantiniyye Ayasofya Meydanı\'ndan İskenderiye saraylarına, Semerkant Registan Meydanı\'ndan Hotan Kalesi içine, Donwhang kanyonlarından Jangan İmparatorluk Sarayı\'na uzanan kıtalararası büyük ralli.',
  length: Math.round(totalDist),
  path: fullPath,
  wl: fullWl,
  wr: fullWr,
  cps: fullCps,
  notes,
};

fs.writeFileSync('tools/rally/stages/grand_silkroad_built.json', JSON.stringify(grandSilkroadStage, null, 2), 'utf-8');

function formatStageJS(id, st) {
  const rows = (arr, perLine, fmtItem) => {
    const lines = [];
    for (let i = 0; i < arr.length; i += perLine) {
      lines.push('      ' + arr.slice(i, i + perLine).map(fmtItem).join(', ') + ',');
    }
    return lines.join('\n');
  };
  const pathStr = rows(st.path, 4, ([rx, rz]) => `[${rx.toFixed(4)}, ${rz.toFixed(4)}]`);
  const wlStr = rows(st.wl, 16, v => v.toFixed(1));
  const wrStr = rows(st.wr, 16, v => v.toFixed(1));
  const cpsStr = st.cps.map(c => `      ${JSON.stringify(c)},`).join('\n');
  const notesStr = st.notes.map(n => `      ${JSON.stringify(n)},`).join('\n');
  return `  ${id}: {\n    name: ${JSON.stringify(st.name)},\n    desc: ${JSON.stringify(st.desc)},\n    length: ${st.length},\n    path: [\n${pathStr}\n    ],\n    wl: [\n${wlStr}\n    ],\n    wr: [\n${wrStr}\n    ],\n    cps: [\n${cpsStr}\n    ],\n    notes: [\n${notesStr}\n    ],\n  },`;
}

const rallyFile = 'src/data/rally.js';
let rallySrc = fs.readFileSync(rallyFile, 'utf-8');
const block = formatStageJS('grand_silkroad', grandSilkroadStage);
if (rallySrc.includes('  grand_silkroad: {')) {
  rallySrc = rallySrc.replace(/  grand_silkroad: \{[\s\S]*?\n  \},/, block);
} else {
  rallySrc = rallySrc.replace(/\n\};\s*$/, `\n${block}\n};\n`);
}
fs.writeFileSync(rallyFile, rallySrc, 'utf-8');

console.log(`\nGrand Silk Road stage generated and written to src/data/rally.js!`);
console.log(`  Total Distance: ${(totalDist / 1000).toFixed(2)} km`);
console.log(`  Total Nodes: ${fullPath.length}`);
console.log(`  Checkpoints: ${fullCps.length}`);
console.log(`  Pilot Notes: ${notes.length}`);

