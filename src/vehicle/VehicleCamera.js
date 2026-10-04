import * as THREE from 'three';
import { makeHit } from '../world/Collision.js';

// Arac kameralari. C ile sirayla: takip, uzak takip, kaput, kokpit, sinematik.
// Sag fare tusu (veya kumanda sag cubugu) ile etrafa bakilir; birakinca geri doner.

export const CAMERA_MODES = ['chase', 'far', 'hood', 'cockpit', 'cinematic'];
export const CAMERA_NAMES = { chase: 'Takip', far: 'Uzak takip', hood: 'Kaput', cockpit: 'Kokpit', cinematic: 'Sinematik' };

const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _off = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export class VehicleCamera {
  constructor(app, vehicle, mode = 'chase') {
    this.app = app;
    this.vehicle = vehicle;
    this.mode = CAMERA_MODES.includes(mode) ? mode : 'chase';
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.lookYaw = 0; this.lookPitch = 0; this.lookTimer = 0;
    this.shake = 0;
    this.fov = 62;
    this.hit = makeHit();
    this.cineT = 0;
    this.initialized = false;
    this.baseFov = 62;
  }

  setMode(m) { this.mode = m; this.initialized = false; }
  next() { this.setMode(CAMERA_MODES[(CAMERA_MODES.indexOf(this.mode) + 1) % CAMERA_MODES.length]); return this.mode; }

  addShake(a) { this.shake = Math.min(1.2, this.shake + a); }

  update(dt, input) {
    const cam = this.app.camera, v = this.vehicle;
    const pos = v.position, fwd = v.forward;
    const speed = v.velocity.length();
    // fare/kumanda ile bakis
    const gp = input.gamepad;
    if (input.mouse.buttons & 2) {
      this.lookYaw -= input.mouse.dx * 0.004;
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - input.mouse.dy * 0.003, -0.6, 0.9);
      this.lookTimer = 1.2;
    } else if (gp && (Math.abs(gp.lookX) > 0.1 || Math.abs(gp.lookY) > 0.1)) {
      this.lookYaw = -gp.lookX * Math.PI * 0.9; this.lookPitch = -gp.lookY * 0.5; this.lookTimer = 0.4;
    } else {
      this.lookTimer -= dt;
      if (this.lookTimer <= 0) {
        const k = 1 - Math.exp(-dt * 4);
        this.lookYaw += (0 - this.lookYaw) * k; this.lookPitch += (0 - this.lookPitch) * k;
      }
    }
    // hedef yon: aracin yonu + kayarken hiz yonune dogru kisinen bakis
    let hFwd = Math.atan2(-fwd.x, -fwd.z);
    if (speed > 4) {
      const hv = Math.atan2(-v.velocity.x, -v.velocity.z);
      let d = hv - hFwd; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.2) hFwd += d * 0.3;
    }
    if (!this.initialized) { this.heading = hFwd; }
    let dh = hFwd - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-dt * (this.mode === 'far' ? 3.5 : 5.5)));

    // sarsinti: carpisma + bozuk zemin
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake;
    const shx = (Math.random() - 0.5) * sh * 0.25, shy = (Math.random() - 0.5) * sh * 0.25;

    const kmh = speed * 3.6;
    let fovTarget = this.baseFov + Math.min(kmh / 160, 1.2) * 11;
    if (this.mode === 'chase' || this.mode === 'far') {
      const far = this.mode === 'far';
      const dist = (far ? 9.5 : 5.4) + Math.min(kmh, 160) * (far ? 0.012 : 0.008);
      const height = (far ? 3.2 : 1.85) + Math.min(kmh, 160) * 0.002;
      const yaw = this.heading + this.lookYaw;
      _target.set(pos.x + Math.sin(yaw) * dist, pos.y + height + this.lookPitch * dist * 0.6, pos.z + Math.cos(yaw) * dist);
      _look.set(pos.x - Math.sin(yaw) * 2.2, pos.y + 0.9, pos.z - Math.cos(yaw) * 2.2);
      // kamera carpismasi
      _dir.subVectors(_target, _look);
      const len = _dir.length();
      _dir.multiplyScalar(1 / len);
      if (this.app.collision.raycast(_look, _dir, len, this.hit)) {
        _target.copy(_look).addScaledVector(_dir, Math.max(0.6, this.hit.distance - 0.3));
      }
      const h = this.app.world.heightAt(_target.x, _target.z);
      if (h !== null && _target.y < h + 0.5) _target.y = h + 0.5;
      if (!this.initialized) this.pos.copy(_target);
      const k = 1 - Math.exp(-dt * (far ? 6 : 10));
      this.pos.lerp(_target, k);
      // kamera yerden yuksek kalsin (ara degerden sonra da)
      cam.position.copy(this.pos);
      cam.position.x += shx; cam.position.y += shy;
      cam.lookAt(_look);
    } else if (this.mode === 'hood' || this.mode === 'cockpit') {
      const local = this.mode === 'hood' ? _off.set(0, 0.47, -0.42) : _off.set(-0.36, 0.66, 0.47);
      cam.position.copy(local).applyQuaternion(v.quaternion).add(pos);
      _e.set(this.lookPitch - (this.mode === 'cockpit' ? 0.07 : 0.03), this.lookYaw, 0, 'YXZ');
      _q.setFromEuler(_e);
      cam.quaternion.copy(v.quaternion).multiply(_q);
      cam.position.x += shx * 0.4; cam.position.y += shy * 0.4;
      if (this.mode === 'cockpit') fovTarget = 70 + Math.min(kmh / 160, 1) * 6;
    } else if (this.mode === 'cinematic') {
      this.cineT += dt * 0.25;
      const r = 7.5 + Math.sin(this.cineT * 0.7) * 2;
      _target.set(pos.x + Math.sin(this.cineT) * r, pos.y + 1.2 + Math.sin(this.cineT * 0.5) * 0.8, pos.z + Math.cos(this.cineT) * r);
      const h = this.app.world.heightAt(_target.x, _target.z);
      if (h !== null && _target.y < h + 0.6) _target.y = h + 0.6;
      if (!this.initialized) this.pos.copy(_target);
      this.pos.lerp(_target, 1 - Math.exp(-dt * 3));
      cam.position.copy(this.pos);
      cam.lookAt(pos.x, pos.y + 0.5, pos.z);
      fovTarget = 45;
    }
    this.fov += (fovTarget - this.fov) * (1 - Math.exp(-dt * 3));
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    this.initialized = true;
  }
}
