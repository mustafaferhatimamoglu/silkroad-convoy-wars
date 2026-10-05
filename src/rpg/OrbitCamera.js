import * as THREE from 'three';
import { makeHit } from '../world/Collision.js';

// Ucuncu sahis kamerasi: oyuncunun cevresinde doner (sag fare / sol fare surukleme),
// tekerlek ile yakinlasir, araya giren duvar ve araziye girmez.

const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();

export class OrbitCamera {
  constructor(app, { dist = 7, pitch = 0.32, yaw = 0, height = 1.55 } = {}) {
    this.app = app;
    this.yaw = yaw;
    this.pitch = pitch;
    this.dist = dist;
    this.cur = dist;
    this.height = height;
    this.hit = makeHit();
    this.target = new THREE.Vector3();
    this.initialized = false;
    this.shake = 0;
  }

  /** Kameranin bakis yonu (yatay, birim): ileri hareket bu yone gore. */
  forward(out) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt, focus) {
    const { input, camera, collision, world } = this.app;
    if (input.mouse.buttons & 2 || (input.mouse.buttons & 1 && this.dragLeft)) {
      this.yaw -= input.mouse.dx * 0.0042;
      this.pitch = THREE.MathUtils.clamp(this.pitch + input.mouse.dy * 0.0036, -0.35, 1.35);
    }
    if (input.mouse.wheel) this.dist = THREE.MathUtils.clamp(this.dist * (input.mouse.wheel > 0 ? 1.12 : 0.89), 2.2, 22);
    const gp = input.gamepad;
    if (gp) {
      this.yaw -= gp.lookX * dt * 2.4;
      this.pitch = THREE.MathUtils.clamp(this.pitch + gp.lookY * dt * 1.6, -0.35, 1.35);
    }
    _t.set(focus.x, focus.y + this.height, focus.z);
    if (!this.initialized) { this.target.copy(_t); this.initialized = true; }
    this.target.lerp(_t, 1 - Math.exp(-dt * 14));
    _d.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // engel: hedef -> kamera isini
    let want = this.dist;
    if (collision.raycast(this.target, _d, this.dist + 0.3, this.hit)) want = Math.max(0.6, this.hit.distance - 0.35);
    this.cur += (want - this.cur) * (want < this.cur ? 1 : 1 - Math.exp(-dt * 4));
    _p.copy(this.target).addScaledVector(_d, this.cur);
    const h = world.heightAt(_p.x, _p.z);
    if (h !== null && _p.y < h + 0.4) _p.y = h + 0.4;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      _p.x += (Math.random() - 0.5) * this.shake * 0.25;
      _p.y += (Math.random() - 0.5) * this.shake * 0.25;
    }
    camera.position.copy(_p);
    camera.lookAt(this.target);
  }
}
