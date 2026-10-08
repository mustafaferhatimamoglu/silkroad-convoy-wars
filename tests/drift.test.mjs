// El freni / drift / karsi direksiyon / gaz tepkisi: duz zeminde fizik senaryolari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VehicleSim } from '../src/vehicle/physics/VehicleSim.js';
import { KARTAL_RALLY, RS6, HILUX } from '../src/vehicle/presets.js';

const DT = 1 / 240;
const UP = { x: 0, y: 1, z: 0 };
const flat = () => ({
  raycast(o, d, far) {
    if (d.y >= 0) return null;
    const t = -o.y / d.y;
    if (t < 0 || t > far) return null;
    return { distance: t, point: { x: o.x + d.x * t, y: 0, z: o.z + d.z * t }, normal: UP, surface: 3, object: false };
  },
  sphereContacts(p, r) { return p.y < r ? [{ depth: r - p.y, normal: UP, point: { x: p.x, y: 0, z: p.z }, object: false }] : []; },
});

function car(P) {
  const c = new VehicleSim(P);
  c.reset(0, P.cgHeight + 0.02, 0, 0);
  if (P.equipment && P.equipment.tcs === false) c.assists.tcs = false;
  return c;
}
function run(c, g, sec, ctl, each) {
  const n = Math.round(sec / DT);
  for (let i = 0; i < n; i++) {
    c.step(DT, typeof ctl === 'function' ? ctl(i * DT, c) : ctl, g);
    if (each && each(i * DT, c) === false) return i * DT;
  }
  return sec;
}
const kmh = (c) => c.forwardSpeed * 3.6;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (r) => (r * 180) / Math.PI;
/** govdeye gore kayma acisi (derece, + : hiz govdenin sagina) */
function beta(c) {
  const { vel } = c.body, y = c.yaw;
  const fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
  return deg(Math.atan2(vel.x * rx + vel.z * rz, vel.x * fx + vel.z * fz));
}
function cruise(P, speed) {
  const g = flat(), c = car(P);
  run(c, g, 1, {});
  run(c, g, 40, (t, s) => ({ accel: kmh(s) < speed ? 1 : 0.3 }), (t, s) => kmh(s) < speed);
  return { c, g };
}

for (const [name, P] of Object.entries({ 'Kartal Ralli': KARTAL_RALLY, 'RS 6': RS6, Hilux: HILUX })) {
  test(`${name}: el freni + direksiyon araci savurur (60 km/s)`, () => {
    const { c, g } = cruise(P, 60);
    const y0 = c.yaw;
    let maxBeta = 0;
    run(c, g, 0.7, { steer: -1, handbrake: 1 }, (t, s) => { maxBeta = Math.max(maxBeta, Math.abs(beta(s))); });
    run(c, g, 0.6, { steer: -1 }, (t, s) => { maxBeta = Math.max(maxBeta, Math.abs(beta(s))); });
    const turned = Math.abs(deg(wrap(c.yaw - y0)));
    console.log(`   ${name}: el freni donusu ${turned.toFixed(0)} derece, en buyuk kayma ${maxBeta.toFixed(0)} derece`);
    assert.ok(turned > 55, `donus ${turned}`);
    assert.ok(maxBeta > 20, `kayma ${maxBeta}`);
  });
}

test('Kartal Ralli: el freni driftinden karsi direksiyonla cikilir (savrulup donmez)', () => {
  const { c, g } = cruise(KARTAL_RALLY, 70);
  run(c, g, 0.45, { steer: -1, handbrake: 1 });
  let spun = false, maxBeta = 0, endBeta = 0;
  // karsi direksiyon: kayma acisi kadar ters tus, yari gaz
  run(c, g, 3, (t, s) => {
    const b = beta(s);
    return { accel: 0.5, steer: Math.abs(b) > 4 ? Math.sign(b) : 0 };
  }, (t, s) => { const b = Math.abs(beta(s)); maxBeta = Math.max(maxBeta, b); if (b > 100) spun = true; endBeta = b; });
  console.log(`   karsi direksiyon: en buyuk kayma ${maxBeta.toFixed(0)}, son ${endBeta.toFixed(0)} derece, hiz ${kmh(c).toFixed(0)} km/s`);
  assert.ok(!spun, 'donmemeli');
  assert.ok(endBeta < 12, `toparlanmali (${endBeta})`);
});

test('Kartal Ralli: tus birakilinca kaster tekerleri kayma yonune ceker', () => {
  const { c, g } = cruise(KARTAL_RALLY, 70);
  run(c, g, 0.45, { steer: -1, handbrake: 1 });
  let same = 0, n = 0;
  run(c, g, 0.5, { accel: 0.3 }, (t, s) => { n++; if (Math.sign(s.steer) === Math.sign(beta(s)) && Math.abs(s.steer) > 0.05) same++; });
  console.log(`   kaster: ${((same / n) * 100).toFixed(0)}% karede tekerler kayma yonunde`);
  assert.ok(same / n > 0.6);
});

test('gaz tepkisi: seyirden tam gaza 0.2 sn icinde guclu ivme (vitesler tek tek inmez)', () => {
  for (const [name, P, speed] of [['Kartal Ralli', KARTAL_RALLY, 40], ['Kartal Ralli', KARTAL_RALLY, 80], ['RS 6', RS6, 60], ['Hilux', HILUX, 60]]) {
    const { c, g } = cruise(P, speed);
    run(c, g, 2, (t, s) => ({ accel: kmh(s) < speed ? 0.25 : 0.1 }));
    let t03 = null;
    run(c, g, 1, { accel: 1 }, (t, s) => {
      const v = s.forwardSpeed;
      if (s._pv !== undefined && t03 === null && (v - s._pv) / DT / 9.81 > 0.3) t03 = t;
      s._pv = v;
    });
    console.log(`   ${name} ${speed} km/s: 0.3 g ivmeye ${t03 === null ? '>1' : t03.toFixed(2)} sn`);
    assert.ok(t03 !== null && t03 < 0.2, `${name} ${speed}: ${t03}`);
  }
});

test('sert tek teker inisi (yan yatik, 8-10 m/s dusus) takla attirmaz', () => {
  for (const [name, P] of [['Kartal Ralli', KARTAL_RALLY], ['RS 6', RS6], ['Hilux', HILUX]]) {
    for (const [roll, pitch, vy] of [[0.25, 0.1, -8], [0.35, -0.15, -9], [0.3, 0, -10]]) {
      const g = flat(), c = car(P);
      c.reset(0, P.cgHeight + 3, 0, 0);
      const q = c.body.q, cr = Math.cos(roll / 2), sr = Math.sin(roll / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      q.x = sp * cr; q.y = 0; q.z = cp * sr; q.w = cp * cr;
      const n = Math.hypot(q.x, q.y, q.z, q.w); q.x /= n; q.z /= n; q.w /= n;
      c.body.vel.set(0, vy, -18);
      for (const w of c.wheels) w.omega = 18 / w.radius;
      let minUp = 1;
      run(c, g, 3, { accel: 0.5 }, (t, s) => { const qq = s.body.q; minUp = Math.min(minUp, 1 - 2 * (qq.x * qq.x + qq.z * qq.z)); });
      assert.ok(minUp > 0.5, `${name} yatis ${roll} dusus ${vy}: devrildi (dikey ${minUp.toFixed(2)})`);
    }
  }
});
