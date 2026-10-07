import * as THREE from 'three';

// Dunya gezgini: serbest ucan kamera. WASD/oklar hareket, Q/E alcal/yuksel,
// sag/sol fare surukleme ile bakis, Shift hizli, tekerlek hiz ayari.

export class ExploreMode {
  constructor(app, start) {
    this.app = app;
    this.focus = new THREE.Vector3();
    this.yaw = 0; this.pitch = -0.25;
    this.speed = 25;
    this.pos = start.clone();
    this.vel = new THREE.Vector3();
  }

  enter() {
    const cam = this.app.camera;
    cam.position.copy(this.pos);
    this.app.canvas.focus();
  }

  teleport(p) { this.pos.copy(p); this.vel.set(0, 0, 0); }

  update(dt) {
    const { input, camera, world } = this.app;
    if (input.pressed('Escape') && this.onPause) this.onPause();
    if (input.mouse.buttons & 3) {
      this.yaw -= input.mouse.dx * 0.0032;
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouse.dy * 0.0032, -1.5, 1.5);
    }
    if (input.mouse.wheel) this.speed = THREE.MathUtils.clamp(this.speed * (input.mouse.wheel > 0 ? 0.8 : 1.25), 2, 600);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const mv = new THREE.Vector3();
    if (input.down('KeyW', 'ArrowUp')) mv.add(fwd);
    if (input.down('KeyS', 'ArrowDown')) mv.sub(fwd);
    if (input.down('KeyD', 'ArrowRight')) mv.add(right);
    if (input.down('KeyA', 'ArrowLeft')) mv.sub(right);
    if (input.down('KeyE', 'Space')) mv.y += 1;
    if (input.down('KeyQ', 'ControlLeft')) mv.y -= 1;
    const sp = this.speed * (input.down('ShiftLeft', 'ShiftRight') ? 4 : 1);
    if (mv.lengthSq()) mv.normalize().multiplyScalar(sp);
    this.vel.lerp(mv, 1 - Math.exp(-dt * 8));
    this.pos.addScaledVector(this.vel, dt);
    const h = world.heightAt(this.pos.x, this.pos.z);
    if (h !== null && this.pos.y < h + 1.7) this.pos.y = h + 1.7;
    camera.position.copy(this.pos);
    camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.focus.copy(this.pos);
  }

  dispose() {}
}
