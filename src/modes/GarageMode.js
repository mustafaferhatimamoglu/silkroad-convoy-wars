import * as THREE from 'three';
import { Vehicle } from '../vehicle/Vehicle.js';
import { flatGround } from '../vehicle/physics/FlatGround.js';

// Garaj: araci duz bir zeminde inceleme (renk/varyant secimi, dondurulebilir kamera).
// Ayni zamanda arac modelini gelistirirken ekran goruntusu almak icin kullanilir.

export class GarageMode {
  constructor(app, { variant = 'kartal80', paint = 'lacivert', at = null } = {}) {
    this.app = app;
    this.focus = new THREE.Vector3();
    this.yaw = 0.6; this.pitch = 0.12; this.dist = 6.5;
    this.variant = variant; this.paint = paint;
    this.at = at;
  }

  enter() {
    const app = this.app;
    this.vehicle = new Vehicle(app, { variant: this.variant, paint: this.paint });
    // fizik icin sanal duz zemin (dunya varsa onun ustunde)
    this.vehicle.ground = null;
    const base = this.at ? this.at.y : 0;
    this.vehicle.flatGround = flatGround({ baseY: base });
    const x = this.at ? this.at.x : 0, z = this.at ? this.at.z : 0;
    this.vehicle.sim.reset(x, base + this.vehicle.params.cgHeight + 0.02, z, 0);
    this.focus.set(x, base + 0.7, z);
  }

  update(dt) {
    const { input, camera } = this.app;
    if (input.mouse.buttons & 3) {
      this.yaw -= input.mouse.dx * 0.005;
      this.pitch = THREE.MathUtils.clamp(this.pitch + input.mouse.dy * 0.004, -0.15, 1.3);
    } else if (!this.freeze) this.yaw += dt * 0.08;
    if (input.mouse.wheel) this.dist = THREE.MathUtils.clamp(this.dist * (input.mouse.wheel > 0 ? 1.1 : 0.9), 2.5, 20);
    const v = this.vehicle;
    v.update(dt, {});
    v.updateGauges(dt);
    const c = this.focus;
    camera.position.set(c.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, c.y + Math.sin(this.pitch) * this.dist, c.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    camera.lookAt(c);
  }

  dispose() { this.vehicle.dispose(); }
}
