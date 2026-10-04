// Arac fizigi iz araci (ayar yaparken):  node tools/simtrace.mjs accel|hill|brake|corner [egim]
import { VehicleSim } from '../src/vehicle/physics/VehicleSim.js';
import { KARTAL } from '../src/vehicle/presets.js';

import { plane } from './simlib.mjs';

const DT = 1 / 240;
const mode = process.argv[2] || 'accel';
const slope = Number(process.argv[3] || (mode === 'hill' ? 12 : 0));
const g = plane(slope);
const car = new VehicleSim(KARTAL);
car.reset(0, g.height(0, 0) + 0.54, 0, 0);
for (let i = 0; i < 240; i++) car.step(DT, {}, g);

const ctl = {
  accel: () => ({ accel: 1 }),
  hill: () => ({ accel: 1 }),
  brake: (t) => (t < 12 ? { accel: 1 } : { decel: 1 }),
  corner: (t) => (t < 6 ? { accel: 1 } : { accel: 0.5, steer: 1 }),
}[mode];
let t = 0;
for (let i = 0; i < 240 * 30; i++) {
  car.step(DT, ctl(t), g);
  t += DT;
  if (i % 60 === 0) {
    const RL = car.wheels[2], FL = car.wheels[0];
    console.log(`t=${t.toFixed(2)} v=${(car.forwardSpeed * 3.6).toFixed(1)} g=${car.gearLabel} rpm=${car.rpm.toFixed(0)} cl=${car.clutch.toFixed(2)} lock=${car.locked ? 1 : 0} Te=${car.engine.torque.toFixed(0)} drv=${RL.driveTorque.toFixed(0)} slipR=${RL.slipRatio.toFixed(2)} aR=${RL.slipAngle.toFixed(3)} aF=${FL.slipAngle.toFixed(3)} tcs=${car.tcsCut.toFixed(2)} Fz=${RL.Fz.toFixed(0)}/${FL.Fz.toFixed(0)} yaw=${car.body.angVel.y.toFixed(2)}`);
  }
  if (mode === 'accel' && car.forwardSpeed * 3.6 > 101) { console.log('0-100', t.toFixed(2)); break; }
}
