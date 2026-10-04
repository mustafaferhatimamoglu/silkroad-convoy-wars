// Arac fizigi testleri:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleSim } from '../src/vehicle/physics/VehicleSim.js';
import { KARTAL } from '../src/vehicle/presets.js';

const DT = 1 / 240;

/** Duzlem zemin: n.p = c (n birim normal). surface: tiles.json bayragi. */
function planeGround({ slopeDeg = 0, surface = 3 } = {}) {
  const a = (slopeDeg * Math.PI) / 180;
  // -z yonunde (ileri) yukselen rampa: y = tan(a) * (-z)
  const n = { x: 0, y: Math.cos(a), z: Math.sin(a) };
  const c = 0;
  const contacts = [];
  return {
    height(x, z) { return Math.tan(a) * -z; },
    raycast(o, d, far) {
      const denom = n.x * d.x + n.y * d.y + n.z * d.z;
      if (denom >= -1e-6) return null;
      const t = (c - (n.x * o.x + n.y * o.y + n.z * o.z)) / denom;
      if (t < 0 || t > far) return null;
      return { distance: t, point: { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t }, normal: n, surface, object: false };
    },
    sphereContacts(p, r) {
      contacts.length = 0;
      const dist = n.x * p.x + n.y * p.y + n.z * p.z - c;
      if (dist < r) contacts.push({ depth: r - dist, normal: n, point: { x: p.x - n.x * dist, y: p.y - n.y * dist, z: p.z - n.z * dist }, object: false });
      return contacts;
    },
  };
}

function makeCar(ground, opts = {}) {
  const car = new VehicleSim(KARTAL);
  const y = ground.height(0, 0) + KARTAL.cgHeight + 0.02;
  car.reset(0, y, 0, opts.yaw || 0);
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

test('duz zeminde kendiliginden durur ve dogru yukseklikte oturur', () => {
  const g = planeGround();
  const car = makeCar(g);
  run(car, g, 4, {});
  assert.ok(finite(car));
  assert.ok(car.body.vel.length() < 0.02, `hiz ${car.body.vel.length()}`);
  assert.ok(Math.abs(car.body.angVel.length()) < 0.02);
  const h = car.body.pos.y;
  assert.ok(h > 0.46 && h < 0.58, `CG yuksekligi ${h.toFixed(3)}`);
  for (const w of car.wheels) assert.ok(w.contact, w.name + ' temas');
});

test('0-100 km/s suresi ve son hiz gercekci (Kartal 1.6)', () => {
  const g = planeGround();
  const car = makeCar(g);
  run(car, g, 1, {});
  let t100 = null;
  const gears = new Set();
  run(car, g, 75, { accel: 1 }, (t, c) => { gears.add(c.gearLabel); if (t100 === null && kmh(c) >= 100) t100 = t; });
  const vmax = kmh(car);
  console.log(`   0-100: ${t100 && t100.toFixed(1)} s, son hiz ${vmax.toFixed(1)} km/s, vitesler ${[...gears].join(',')}, devir ${car.rpm.toFixed(0)}`);
  assert.ok(t100 !== null && t100 > 10 && t100 < 17, `0-100 ${t100}`);
  assert.ok(vmax > 145 && vmax < 175, `son hiz ${vmax}`);
  assert.ok(gears.has('5'), '5. vitese cikmali');
  assert.ok(Math.abs(car.body.pos.x) < 2, `duz gitmeli, x=${car.body.pos.x.toFixed(2)}`);
});

test('100 km/s den ABS ile fren mesafesi', () => {
  const g = planeGround();
  const car = makeCar(g);
  run(car, g, 40, { accel: 1 }, (t, c) => kmh(c) < 100);
  const z0 = car.body.pos.z;
  const v0 = kmh(car);
  run(car, g, 12, { decel: 1 }, (t, c) => c.forwardSpeed > 0.2);
  const d = Math.abs(car.body.pos.z - z0);
  console.log(`   ${v0.toFixed(0)} km/s -> 0: ${d.toFixed(1)} m`);
  assert.ok(d > 34 && d < 55, `fren mesafesi ${d}`);
  assert.ok(finite(car));
});

test('kumda yol tutus azalir (fren mesafesi uzar)', () => {
  const g = planeGround({ surface: 1 });
  const car = makeCar(g);
  run(car, g, 40, { accel: 1 }, (t, c) => kmh(c) < 70);
  const z0 = car.body.pos.z;
  run(car, g, 12, { decel: 1 }, (t, c) => c.forwardSpeed > 0.2);
  const d = Math.abs(car.body.pos.z - z0);
  console.log(`   kumda 70 km/s -> 0: ${d.toFixed(1)} m`);
  assert.ok(d > 26, `kum fren mesafesi ${d}`);
});

test('15 derece yokusta otomatik fren tutma ile kaymadan durur', () => {
  const g = planeGround({ slopeDeg: 15 });
  const car = makeCar(g);
  run(car, g, 4, {});
  const p0 = { ...car.body.pos };
  run(car, g, 4, {});
  const moved = Math.hypot(car.body.pos.x - p0.x, car.body.pos.z - p0.z);
  console.log(`   yokusta 4 s'de kayma: ${(moved * 100).toFixed(1)} cm`);
  assert.ok(moved < 0.05, `kayma ${moved}`);
});

test('yokus yukari kalkis yapabilir', () => {
  const g = planeGround({ slopeDeg: 12 });
  const car = makeCar(g);
  run(car, g, 1, { decel: 1 });
  run(car, g, 8, { accel: 1 });
  console.log(`   12 derece yokusta 8 s: ${kmh(car).toFixed(0)} km/s, yol ${(-car.body.pos.z).toFixed(1)} m`);
  assert.ok(kmh(car) > 20, 'yokusta hizlanmali');
});

test('sabit viraj: devrilmez, yanal ivme makul', () => {
  const g = planeGround();
  const car = makeCar(g);
  run(car, g, 30, (t, c) => ({ accel: kmh(c) < 60 ? 1 : 0.25 }), (t, c) => kmh(c) < 60);
  let maxLat = 0, minUp = 1;
  run(car, g, 6, (t, c) => ({ accel: 0.45, steer: 1 }), (t, c) => {
    const v = c.body.vel.length(), w = Math.abs(c.body.angVel.y);
    maxLat = Math.max(maxLat, v * w / 9.81);
    const q = c.body.q; const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    minUp = Math.min(minUp, upY);
  });
  console.log(`   en yuksek yanal ivme ${maxLat.toFixed(2)} g, en dusuk dikey ${minUp.toFixed(2)}`);
  assert.ok(finite(car));
  assert.ok(minUp > 0.85, 'devrilmemeli');
  assert.ok(maxLat > 0.5 && maxLat < 1.25, `yanal ivme ${maxLat}`);
});

test('el freni ile kaydirma: sapma hizi artar, sayisal patlama olmaz', () => {
  const g = planeGround();
  const car = makeCar(g);
  run(car, g, 30, { accel: 1 }, (t, c) => kmh(c) < 65);
  let maxYaw = 0;
  run(car, g, 2.5, (t) => ({ steer: t < 1.2 ? 0.7 : 0, handbrake: t < 0.9 ? 1 : 0 }), (t, c) => { maxYaw = Math.max(maxYaw, Math.abs(c.body.angVel.y)); });
  console.log(`   el freni ile en yuksek sapma hizi ${maxYaw.toFixed(2)} rad/s`);
  assert.ok(finite(car));
  assert.ok(maxYaw > 0.8, 'arka kaymali');
});

test('geri vites: geri tusu basili tutulunca geri gider', () => {
  const g = planeGround();
  const car = makeCar(g);
  run(car, g, 1, {});
  run(car, g, 4, { decel: 1 });
  console.log(`   geri hiz ${kmh(car).toFixed(1)} km/s, vites ${car.gearLabel}`);
  assert.equal(car.gearLabel, 'R');
  assert.ok(kmh(car) < -5, 'geri gitmeli');
});

test('duvara carpma: geri seker, hasar alir, icine girmez', () => {
  // z = -30'da duvar (normal +z)
  const base = planeGround();
  const wallZ = -30;
  const contacts = [];
  const g = {
    height: base.height,
    raycast: base.raycast,
    sphereContacts(p, r) {
      const arr = base.sphereContacts(p, r).slice();
      const dist = p.z - wallZ;
      if (dist < r) arr.push({ depth: r - dist, normal: { x: 0, y: 0, z: 1 }, point: { x: p.x, y: p.y, z: wallZ }, object: true });
      contacts.length = 0; contacts.push(...arr);
      return contacts;
    },
  };
  const car = makeCar(g);
  run(car, g, 20, { accel: 1 }, (t, c) => c.body.pos.z > -24);
  const v = kmh(car);
  run(car, g, 3, {});
  console.log(`   ${v.toFixed(0)} km/s carpma -> saglik ${car.health.toFixed(0)}, z=${car.body.pos.z.toFixed(2)}`);
  assert.ok(car.body.pos.z > wallZ + 1.6, 'duvarin icine girmemeli');
  assert.ok(car.health < 100, 'hasar almali');
  assert.ok(finite(car));
});
