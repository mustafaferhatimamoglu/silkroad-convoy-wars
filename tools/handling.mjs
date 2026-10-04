// Yol tutus olcumu: sabit hizdan tam direksiyon; kararli yanal ivme ve tepki suresi.
//   node tools/handling.mjs [hiz_kmh] [yuzey]
import { VehicleSim } from '../src/vehicle/physics/VehicleSim.js';
import { KARTAL } from '../src/vehicle/presets.js';
import { flatGround } from '../src/vehicle/physics/FlatGround.js';

const DT = 1 / 240;
const target = Number(process.argv[2] || 60);
const g = flatGround({ surface: Number(process.argv[3] || 3) });
const car = new VehicleSim(KARTAL);
car.reset(0, 0.56, 0, 0);
const kmh = () => car.forwardSpeed * 3.6;
let t = 0;
const step = (c) => { car.step(DT, c, g); t += DT; };
for (let i = 0; i < 240 * 60 && kmh() < target; i++) step({ accel: 1 });
// hizi tut
for (let i = 0; i < 240; i++) step({ accel: kmh() < target ? 0.6 : 0.15 });
const t0 = t;
let peak = 0, t63 = null, last = 0;
for (let i = 0; i < 240 * 4; i++) {
  step({ accel: kmh() < target ? 0.5 : 0.2, steer: Number(process.env.STEER || 1) });
  const lat = (car.body.vel.length() * Math.abs(car.body.angVel.y)) / 9.81;
  peak = Math.max(peak, lat);
  last = lat;
  if (i % (process.env.FINE ? 12 : 48) === 0 && (!process.env.FINE || i < 480)) console.log(`t=${(t - t0).toFixed(2)} v=${kmh().toFixed(0)} lat=${lat.toFixed(2)}g yaw=${car.body.angVel.y.toFixed(2)} steer=${(car.steer * 57.3).toFixed(1)}deg aF=${(car.wheels[0].slipAngle * 57.3).toFixed(1)} aR=${(car.wheels[2].slipAngle * 57.3).toFixed(1)}`);
}
for (let i = 0; i < 240 * 2; i++) { step({ accel: 0.4 }); }
console.log(`hedef ${target} km/s: tepe ${peak.toFixed(2)}g, son ${last.toFixed(2)}g`);
