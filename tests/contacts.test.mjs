// Araclar arasi carpisma (src/vehicle/physics/CarContacts.js) testleri.
//   node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleSim } from '../src/vehicle/physics/VehicleSim.js';
import { collideCars } from '../src/vehicle/physics/CarContacts.js';
import { flatGround } from '../src/vehicle/physics/FlatGround.js';
import { KARTAL_RALLY, F150 } from '../src/vehicle/presets.js';

const DT = 1 / 240;

function car(P, x, z, yaw = 0) {
  const s = new VehicleSim(P);
  s.reset(x, P.cgHeight + 0.06, z, yaw);
  return s;
}

/** Yalniz temas: zeminsiz, yercekimsiz govdeler. */
function bodyOnly(sims, steps) {
  for (let k = 0; k < steps; k++) {
    for (let i = 0; i < sims.length; i++) for (let j = i + 1; j < sims.length; j++) collideCars(sims[i], sims[j]);
    for (const s of sims) s.body.integratePositions(DT);
  }
}

const momentum = (sims) => sims.reduce((a, s) => a + s.body.mass * s.body.vel.z, 0);

test('kafa kafaya: momentum korunur, araclar ic ice gecmez ve geri seker', () => {
  const A = car(KARTAL_RALLY, 0, -6), B = car(F150, 0, 6, Math.PI);
  A.body.vel.set(0, 0, 10); B.body.vel.set(0, 0, -10);
  const p0 = momentum([A, B]);
  bodyOnly([A, B], 240);
  const p1 = momentum([A, B]);
  assert.ok(Math.abs(p1 - p0) < Math.abs(p0) * 0.02 + 50, `momentum ${p0.toFixed(0)} -> ${p1.toFixed(0)}`);
  // agir F-150 hafif Kartal'i geri iter
  assert.ok(A.body.vel.z < 0, `Kartal geri gitmeli: ${A.body.vel.z.toFixed(2)}`);
  const gap = B.body.pos.z - A.body.pos.z;
  assert.ok(gap > 4.0, `araclar ayrik kalmali (merkezler arasi ${gap.toFixed(2)} m)`);
  assert.ok(A.impacts.length && B.impacts.length, 'iki araca da carpisma olayi yazilir');
  assert.ok(A.impacts[0].speed > 15, `carpisma hizi ~20 m/s: ${A.impacts[0].speed.toFixed(1)}`);
});

test('tek tarafli (uzak oyuncu vekili): yalniz yerel arac etkilenir', () => {
  const A = car(KARTAL_RALLY, 0, -6), B = car(KARTAL_RALLY, 0, 6, Math.PI);
  A.body.vel.set(0, 0, 8); B.body.vel.set(0, 0, -8);
  for (let k = 0; k < 240; k++) {
    collideCars(A, B, { oneSided: true });
    A.body.integratePositions(DT); B.body.integratePositions(DT);
  }
  assert.equal(B.body.vel.z, -8, 'vekil arac hizini korur');
  assert.ok(A.body.vel.z < -2, `yerel arac geri sekti: ${A.body.vel.z.toFixed(2)}`);
});

test('PIT manevrasi: arka camurluga yandan dokunan arac hedefi dondurur', () => {
  const g = flatGround();
  // hedef (A) -z yonunde 20 m/s; saldiran (B) solunda, on tamponu A'nin arka tekeri hizasinda
  const A = car(KARTAL_RALLY, 0, 0), B = car(KARTAL_RALLY, -1.8, 2.6);
  for (const s of [A, B]) { s.body.vel.set(0, 0, -20); for (const w of s.wheels) w.omega = 20 / w.radius; s.gear = 4; }
  const cruise = { accel: 0.45, decel: 0, steer: 0, handbrake: 0 };
  let t = 0;
  for (let k = 0; k < 240 * 3; k++, t += DT) {
    const hit = t > 0.3 && t < 0.95;
    A.step(DT, cruise, g);
    B.step(DT, hit ? { accel: 0.8, decel: 0, steer: 0.65, handbrake: 0 } : cruise, g);
    collideCars(A, B);
  }
  const yawA = Math.abs(A.yaw) * 180 / Math.PI, yawB = Math.abs(B.yaw) * 180 / Math.PI;
  assert.ok(yawA > 60, `hedef savrulmali: sapma ${yawA.toFixed(0)} derece`);
  assert.ok(yawB < 45, `saldiran yolunda kalmali: sapma ${yawB.toFixed(0)} derece`);
});
