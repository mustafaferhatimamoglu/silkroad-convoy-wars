import * as THREE from 'three';
import { Vehicle } from '../vehicle/Vehicle.js';
import { flatGround } from '../vehicle/physics/FlatGround.js';

// Garaj / ana menu arka plani: park halindeki arac etrafinda donen kamera.
// cinematic: yavas otomatik donus (ana menu); setGarageView(true): yakin inceleme.

export class GarageMode {
  constructor(app, { variant = 'kartal80', paint = 'lacivert', at = null, cinematic = false, yaw = 0 } = {}) {
    this.app = app;
    this.focus = new THREE.Vector3();
    this.cinematic = cinematic;
    this.yaw = cinematic ? 0.9 : 0.6; this.pitch = cinematic ? 0.07 : 0.12; this.dist = cinematic ? 7.8 : 6.5;
    this.target = { pitch: this.pitch, dist: this.dist };
    this.variant = variant; this.paint = paint;
    this.at = at || new THREE.Vector3();
    this.carYaw = yaw;
  }

  enter() { this._build(); }

  _build() {
    const app = this.app;
    this.vehicle = new Vehicle(app, { variant: this.variant, paint: this.paint });
    this.vehicle.ground = null;
    this.vehicle.flatGround = flatGround({ baseY: this.at.y });
    this.vehicle.sim.reset(this.at.x, this.at.y + this.vehicle.params.cgHeight + 0.02, this.at.z, this.carYaw);
    this.focus.set(this.at.x, this.at.y + 0.7, this.at.z);
  }

  rebuild(variant, paint) {
    this.vehicle.dispose();
    this.variant = variant; this.paint = paint;
    this._build();
  }

  setGarageView(on) {
    this.target.dist = on ? 5.4 : (this.cinematic ? 7.8 : 6.5);
    this.target.pitch = on ? 0.14 : (this.cinematic ? 0.07 : 0.12);
  }

  update(dt) {
    const { input, camera } = this.app;
    if (input.mouse.buttons & 3) {
      this.yaw -= input.mouse.dx * 0.005;
      this.target.pitch = THREE.MathUtils.clamp(this.target.pitch + input.mouse.dy * 0.004, -0.1, 1.2);
    } else if (!this.freeze) this.yaw += dt * (this.cinematic ? 0.06 : 0.08);
    if (input.mouse.wheel) this.target.dist = THREE.MathUtils.clamp(this.target.dist * (input.mouse.wheel > 0 ? 1.1 : 0.9), 2.5, 20);
    const k = 1 - Math.exp(-dt * 3);
    if (!this.freeze) { this.dist += (this.target.dist - this.dist) * k; this.pitch += (this.target.pitch - this.pitch) * k; }
    const v = this.vehicle;
    v.update(dt, {});
    v.updateGauges(dt);
    const c = this.focus;
    camera.position.set(c.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, c.y + Math.sin(this.pitch) * this.dist, c.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    camera.lookAt(c);
    if (Math.abs(camera.fov - 50) > 0.01) { camera.fov = 50; camera.updateProjectionMatrix(); }
  }

  dispose() { this.vehicle.dispose(); this.app.camera.fov = 62; this.app.camera.updateProjectionMatrix(); }
}
