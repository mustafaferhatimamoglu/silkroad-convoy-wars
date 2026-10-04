import * as THREE from 'three';
import { VehicleSim } from './physics/VehicleSim.js';
import { V3 } from './physics/math.js';
import { KARTAL, surfaceInfo } from './presets.js';
import { KartalModel } from './model/KartalModel.js';
import { WorldGround } from './WorldGround.js';

// Oyundaki arac: sabit adimli fizik (240 Hz) + ara degerlemeli gorsel model + isiklar.

const STEP = 1 / 240;
const _v = new V3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();

export class Vehicle {
  constructor(app, { variant = 'kartal80', paint = 'lacivert', params = KARTAL } = {}) {
    this.app = app;
    this.params = params;
    this.sim = new VehicleSim(params);
    this.ground = app.collision ? new WorldGround(app.collision) : null;
    this.model = new KartalModel({ variant, paint });
    this.model.alignToPhysics(params.cgHeight);
    this.root = this.model.root;
    app.scene.add(this.root);
    this.acc = 0;
    this.headlights = false;
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.steps = 0;
    this._gaugeT = 0;
    this.shadow = this._makeShadowBlob();
    app.scene.add(this.shadow);
  }

  _makeShadowBlob() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.62)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.38)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    return m;
  }

  /** Araci (x,z) noktasinda zemine yerlestirir. yaw: 0 = kuzey. */
  spawn(x, z, yaw = 0, yHint = null) {
    let y = yHint;
    if (this.ground) {
      const o = new V3(x, (yHint ?? 0) + 60, z), d = new V3(0, -1, 0);
      const hit = this.ground.raycast(o, d, 400);
      if (hit) y = hit.point.y;
    }
    if (y === null || y === undefined) y = 0;
    this.sim.reset(x, y + this.params.cgHeight + 0.06, z, yaw);
    this.acc = 0;
    this._sync(1);
  }

  /** Takla atmis/sikismis araci duzeltir (R). */
  recover() {
    const b = this.sim.body;
    const yaw = this.sim.yaw;
    this.spawn(b.pos.x, b.pos.z, yaw, b.pos.y);
  }

  update(dt, controls) {
    const ground = this.ground;
    if (ground) {
      // arac alti yuklenmemisse fizigi beklet (hizli surerken akis gecikirse)
      const b = this.sim.body;
      if (!this.app.world.isLoadedAt(b.pos.x, b.pos.z)) { this._sync(1); return; }
    }
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 24) {
      this.sim.step(STEP, controls, ground || this.flatGround);
      this.acc -= STEP;
      n++;
    }
    if (n >= 24) this.acc = 0;
    this.steps = n;
    this._sync(this.acc / STEP);
  }

  _sync(alpha) {
    const s = this.sim, b = s.body;
    // ara degerleme (onceki adim -> son adim)
    this.position.set(
      s.prevPos.x + (b.pos.x - s.prevPos.x) * alpha,
      s.prevPos.y + (b.pos.y - s.prevPos.y) * alpha,
      s.prevPos.z + (b.pos.z - s.prevPos.z) * alpha,
    );
    _q.set(s.prevQ.x, s.prevQ.y, s.prevQ.z, s.prevQ.w);
    _q2.set(b.q.x, b.q.y, b.q.z, b.q.w);
    this.quaternion.copy(_q).slerp(_q2, alpha);
    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.quaternion);
    this.velocity.set(b.vel.x, b.vel.y, b.vel.z);
    this.forward.set(0, 0, -1).applyQuaternion(this.quaternion);

    // tekerlekler
    for (let i = 0; i < 4; i++) {
      const w = s.wheels[i], mw = this.model.wheels[i];
      s.wheelLocal(w, _v);
      mw.group.position.set(_v.x, _v.y, _v.z);
      mw.group.rotation.y = -w.steer;
      mw.spin.rotation.x = -w.spin;
    }
    if (this.model.steeringWheel) this.model.steeringWheel.rotation.z = -s.steer * 6.5;

    // isiklar
    const inp = s.input;
    const braking = inp.brake > 0.05 && !s.holding;
    this.model.setLights({ head: this.headlights, brake: braking ? 1 : 0, reverse: s.gearLabel === 'R', tail: this.headlights });

    // zemin golgesi
    _p.copy(this.position);
    const h = this.app.world ? this.app.world.heightAt(_p.x, _p.z) : 0;
    const gy = h ?? this.position.y - this.params.cgHeight;
    this.shadow.position.set(_p.x, Math.max(gy, this.position.y - this.params.cgHeight - 0.6) + 0.03, _p.z);
    this.shadow.rotation.z = Math.atan2(this.forward.x, this.forward.z) + Math.PI;
    const lift = Math.max(0, this.position.y - this.params.cgHeight - gy);
    this.shadow.material.opacity = Math.max(0, 1 - lift * 1.5);
  }

  updateGauges(dt) {
    this._gaugeT += dt;
    if (this._gaugeT < 0.066 || !this.model.gauges) return;
    this._gaugeT = 0;
    this.model.gauges.draw(Math.abs(this.sim.forwardSpeed) * 3.6, this.sim.rpm);
  }

  get speedKmh() { return this.sim.forwardSpeed * 3.6; }

  surfaceUnder() {
    const w = this.sim.wheels.find((x) => x.contact);
    return w ? surfaceInfo(w.surface).name : '—';
  }

  dispose() {
    this.app.scene.remove(this.root);
    this.app.scene.remove(this.shadow);
  }
}
