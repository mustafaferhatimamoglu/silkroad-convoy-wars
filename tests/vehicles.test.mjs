// Kartal Ralli, Toyota Hilux ve Ford F-150 fizik testleri + bordur/basamak tirmanma.
//   node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleSim } from '../src/vehicle/physics/VehicleSim.js';
import { KARTAL, KARTAL_RALLY, HILUX, F150, RS6, TANK } from '../src/vehicle/presets.js';

const DT = 1 / 240;
const UP = { x: 0, y: 1, z: 0 };

/** Duz zemin (y = 0). surface: tiles.json bayragi. */
function flat(surface = 3) {
  const contacts = [];
  return {
    height() { return 0; },
    raycast(o, d, far) {
      if (d.y >= -1e-6) return null;
      const t = -o.y / d.y;
      if (t < 0 || t > far) return null;
      return { distance: t, point: { x: o.x + d.x * t, y: 0, z: o.z + d.z * t }, normal: UP, surface, object: false };
    },
    sphereContacts(p, r) {
      contacts.length = 0;
      if (p.y < r) contacts.push({ depth: r - p.y, normal: UP, point: { x: p.x, y: 0, z: p.z }, object: false });
      return contacts;
    },
  };
}

/**
 * Basamak: z < zs bolgesi h kadar yuksek (arac -z yonune gider). Dikey yuz z = zs'de +z'ye bakar.
 * Isin ve kure temaslari analitik (alt duzlem, ust duzlem, yuz, kenar).
 */
function step(h, zs = -12) {
  const contacts = [];
  return {
    height(x, z) { return z < zs ? h : 0; },
    raycast(o, d, far) {
      let best = null;
      const consider = (t, point, normal) => { if (t >= 0 && t <= far && (!best || t < best.distance)) best = { distance: t, point, normal, surface: 3, object: false }; };
      if (d.y < -1e-6) {
        const t0 = -o.y / d.y, z0 = o.z + d.z * t0;
        if (z0 >= zs) consider(t0, { x: o.x + d.x * t0, y: 0, z: z0 }, UP);
        const t1 = (h - o.y) / d.y, z1 = o.z + d.z * t1;
        if (z1 < zs) consider(t1, { x: o.x + d.x * t1, y: h, z: z1 }, UP);
      }
      if (Math.abs(d.z) > 1e-6) {
        const tf = (zs - o.z) / d.z, yf = o.y + d.y * tf;
        if (d.z < 0 && yf >= 0 && yf <= h) consider(tf, { x: o.x + d.x * tf, y: yf, z: zs }, { x: 0, y: 0, z: 1 });
      }
      return best;
    },
    sphereContacts(p, r) {
      contacts.length = 0;
      const add = (depth, n, point) => { if (depth > 0) contacts.push({ depth, normal: n, point, object: true }); };
      if (p.z >= zs) {
        add(r - p.y, UP, { x: p.x, y: 0, z: p.z });
        if (p.y <= h) add(r - (p.z - zs), { x: 0, y: 0, z: 1 }, { x: p.x, y: p.y, z: zs });
        else {
          const dy = p.y - h, dz = p.z - zs, dd = Math.hypot(dy, dz);
          if (dd < r && dd > 1e-6) add(r - dd, { x: 0, y: dy / dd, z: dz / dd }, { x: p.x, y: h, z: zs });
        }
      } else add(r - (p.y - h), UP, { x: p.x, y: h, z: p.z });
      return contacts;
    },
  };
}

function makeCar(P, ground, opts = {}) {
  const car = new VehicleSim(P);
  car.reset(0, P.cgHeight + 0.02, 0, 0);
  if (P.equipment && P.equipment.tcs === false) car.assists.tcs = false;
  if (opts.manual) car.autoShift = false;
  return car;
}
function run(car, ground, seconds, controls, each) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    const c = typeof controls === 'function' ? controls(i * DT, car) : controls;
    car.step(DT, c, ground);
    if (each && each(i * DT, car) === false) return i * DT;
  }
  return seconds;
}
const kmh = (car) => car.forwardSpeed * 3.6;
const finite = (car) => [car.body.pos.x, car.body.pos.y, car.body.pos.z, car.body.vel.x, car.body.angVel.y].every(Number.isFinite);

const CARS = { 'Kartal Ralli': KARTAL_RALLY, Hilux: HILUX, 'F-150': F150, 'RS 6': RS6, Tank: TANK };
// [0-100 alt, ust], [son hiz alt, ust]. Tork uretici verisinin %40 ustunde (presets.js POWER);
// hiz sinirli araclar (F-150, RS 6, Tank) ayni son hizda kalir.
const PERF = { 'Kartal Ralli': [[6.5, 10.5], [170, 205]], Hilux: [[5.5, 9], [190, 230]], 'F-150': [[3.5, 6], [160, 175]], 'RS 6': [[2.6, 4.2], [250, 285]], Tank: [[3.8, 6.5], [150, 175]] };

for (const [name, P] of Object.entries(CARS)) {
  test(`${name}: duz zeminde oturur, tum tekerler yerde`, () => {
    const g = flat();
    const car = makeCar(P, g);
    run(car, g, 4, {});
    assert.ok(finite(car));
    assert.ok(car.body.vel.length() < 0.03, `hiz ${car.body.vel.length()}`);
    const h = car.body.pos.y;
    assert.ok(Math.abs(h - P.cgHeight) < 0.06, `CG yuksekligi ${h.toFixed(3)} (beklenen ${P.cgHeight})`);
    for (const w of car.wheels) assert.ok(w.contact, w.name + ' temas');
  });

  test(`${name}: hizlanma ve son hiz gercekci`, () => {
    const g = flat();
    const car = makeCar(P, g);
    run(car, g, 1, {});
    let t100 = null;
    const gears = new Set();
    run(car, g, 70, { accel: 1 }, (t, c) => { gears.add(c.gearLabel); if (t100 === null && kmh(c) >= 100) t100 = t; });
    const vmax = kmh(car);
    console.log(`   ${name} 0-100: ${t100 && t100.toFixed(1)} s, son hiz ${vmax.toFixed(0)} km/s, vitesler ${[...gears].join(',')}`);
    const [[a, b], [c, d]] = PERF[name];
    assert.ok(t100 !== null && t100 > a && t100 < b, `0-100 ${t100}`);
    assert.ok(vmax > c && vmax < d, `son hiz ${vmax}`);
    assert.ok(gears.has('5'), '5. vitese cikmali');
  });

  test(`${name}: 100 km/s hafif gazda en ust vitese yakin seyreder`, () => {
    const g = flat();
    const car = makeCar(P, g);
    run(car, g, 40, { accel: 1 }, (t, c) => kmh(c) < 100);
    run(car, g, 8, (t, c) => ({ accel: kmh(c) < 100 ? 0.3 : 0.12 }));
    console.log(`   ${name}: 100 km/s seyirde vites ${car.gearLabel}/${car.maxGear}, ${car.rpm.toFixed(0)} d/dk`);
    assert.ok(Number(car.gearLabel) >= car.maxGear - 1, `vites ${car.gearLabel}`);
  });

  test(`${name}: 60 km/s tam direksiyonda devrilmez`, () => {
    const g = flat();
    const car = makeCar(P, g);
    run(car, g, 30, (t, c) => ({ accel: kmh(c) < 60 ? 1 : 0.25 }), (t, c) => kmh(c) < 60);
    let minUp = 1, maxLat = 0;
    run(car, g, 6, { accel: 0.45, steer: 1 }, (t, c) => {
      const q = c.body.q;
      minUp = Math.min(minUp, 1 - 2 * (q.x * q.x + q.z * q.z));
      maxLat = Math.max(maxLat, (c.body.vel.length() * Math.abs(c.body.angVel.y)) / 9.81);
    });
    console.log(`   ${name}: yanal ${maxLat.toFixed(2)} g, en dusuk dikey ${minUp.toFixed(2)}`);
    assert.ok(finite(car));
    assert.ok(minUp > 0.85, 'devrilmemeli');
    assert.ok(maxLat > 0.4, `yanal ivme ${maxLat}`);
  });
}

test('pikaplar 4x4 ile kumda rahat kalkar (arka itisli Kartal Ralli\'den hizli)', () => {
  const res = {};
  for (const [name, P] of Object.entries(CARS)) {
    const g = flat(1);
    const car = makeCar(P, g);
    run(car, g, 1, {});
    res[name] = run(car, g, 20, { accel: 1 }, (t, c) => kmh(c) < 60);
  }
  console.log(`   kumda 0-60: ${Object.entries(res).map(([k, v]) => `${k} ${v.toFixed(1)} s`).join(', ')}`);
  assert.ok(res.Hilux < 8 && res['F-150'] < 7 && res.Tank < 7, 'arazi araclari kumda kalkmali');
});

/** Bordur/basamak: yavas yaklasip tum tekerlerin ust seviyeye cikmasi. */
function climb(P, h, seconds = 14) {
  const g = step(h);
  const car = makeCar(P, g);
  run(car, g, 1, {});
  let up = false, maxDmg = 0;
  run(car, g, seconds, (t, c) => ({ accel: kmh(c) < 7 ? 0.5 : 0.05 }), (t, c) => {
    maxDmg = Math.max(maxDmg, P.maxHealth - c.health);
    if (c.wheels.every((w) => w.contact && w.point.y > h - 0.02)) { up = true; return false; }
    return true;
  });
  return { up, car, dmg: maxDmg };
}

test('lastik profili: Kartal 15 cm bordure tirmanir, tampon takilmaz', () => {
  const { up, car, dmg } = climb(KARTAL, 0.15);
  console.log(`   Kartal 15 cm: ${up ? 'cikti' : 'cikamadi'}, z=${car.body.pos.z.toFixed(2)}, hasar ${dmg.toFixed(1)}`);
  assert.ok(finite(car));
  assert.ok(up, 'bordure cikmali');
});

test('lastik profili: Kartal Ralli 18 cm, pikaplar 25 cm basamaga tirmanir', () => {
  for (const [P, h] of [[KARTAL_RALLY, 0.18], [HILUX, 0.25], [F150, 0.25], [TANK, 0.35]]) {
    const { up, car } = climb(P, h);
    console.log(`   ${P.name} ${h * 100} cm: ${up ? 'cikti' : 'cikamadi'}, z=${car.body.pos.z.toFixed(2)}`);
    assert.ok(finite(car));
    assert.ok(up, `${P.name} ${h} m basamaga cikmali`);
  }
});

test('Kartal Ralli stok Kartal\'dan en az 5 cm yuksek oturur', () => {
  const low = (P) => {
    const g = flat();
    const car = makeCar(P, g);
    run(car, g, 3, {});
    // govdenin en alcak carpisma noktasinin yerden yuksekligi
    return Math.min(...P.colliders.map((c) => car.body.pos.y + c.p[1] - c.r));
  };
  const a = low(KARTAL), b = low(KARTAL_RALLY);
  console.log(`   en alcak nokta: stok ${(a * 100).toFixed(1)} cm, ralli ${(b * 100).toFixed(1)} cm`);
  assert.ok(b - a > 0.05, `fark ${b - a}`);
});
