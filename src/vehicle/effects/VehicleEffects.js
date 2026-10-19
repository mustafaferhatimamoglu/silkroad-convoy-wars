import * as THREE from 'three';
import { ParticleSystem } from './Particles.js';
import { SkidMarks } from './SkidMarks.js';
import { surfaceInfo } from '../presets.js';

// Aracin tekerlek/govde durumundan toz, duman, kivilcim ve lastik izi uretir.

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const SMOKE = [0.82, 0.82, 0.84];

export class VehicleEffects {
  constructor(app, vehicle) {
    this.app = app;
    this.vehicle = vehicle;
    const scene = app.scene;
    this.dust = new ParticleSystem(scene, { max: 700, soft: 0.0 });
    this.smoke = new ParticleSystem(scene, { max: 400, soft: 0.0 });
    this.sparks = new ParticleSystem(scene, { max: 240, additive: true, soft: 0.55 });
    this.shards = new ParticleSystem(scene, { max: 500, soft: 0.25 });
    this.flames = new ParticleSystem(scene, { max: 140, additive: true, soft: 0.25 });
    this.skids = new SkidMarks(scene, { width: 0.16 });
    this.acc = [0, 0, 0, 0];
    this.smokeAcc = [0, 0, 0, 0];
  }

  update(dt) {
    const v = this.vehicle, sim = v.sim;
    const cam = this.app.camera;
    const h = this.app.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    for (const ps of [this.dust, this.smoke, this.sparks, this.shards, this.flames]) ps.setViewport(h, cam.fov);
    const speed = v.velocity.length();
    _fwd.copy(v.forward);
    for (let i = 0; i < 4; i++) {
      const w = sim.wheels[i];
      if (!w.contact) { this.skids.lift(i); continue; }
      const s = surfaceInfo(w.surface);
      _p.set(w.point.x, w.point.y, w.point.z);
      _n.set(w.normal.x, w.normal.y, w.normal.z);
      const slide = w.slide;
      // toz (kum, toprak, cimen, kar) - col kumunda (dustAmt >= 1.0) genis savrulma ve atmosferik girdap
      if (s.dustAmt > 0 && (speed > 2 || slide > 1.5)) {
        const isSand = s.dustAmt >= 0.95;
        const rateMul = isSand ? 1.5 : 1.0;
        this.acc[i] += dt * s.dustAmt * Math.min(80, (speed * 1.6 + slide * 7) * rateMul);
        while (this.acc[i] >= 1) {
          this.acc[i] -= 1;
          const r = () => (Math.random() - 0.5);
          const pSize = isSand ? 3.0 + Math.random() * 2.8 + Math.min(speed, 45) * 0.08 : 2.2 + Math.random() * 2.2 + Math.min(speed, 30) * 0.05;
          const pLife = isSand ? 2.2 + Math.random() * 2.0 : 1.6 + Math.random() * 1.6;
          const pAlpha = isSand ? 0.22 + 0.14 * s.dustAmt : 0.16 + 0.12 * s.dustAmt;
          this.dust.emit(_p.x + r() * 0.35, _p.y + 0.1, _p.z + r() * 0.35,
            -v.velocity.x * 0.14 + r() * (isSand ? 1.8 : 1.2), 0.45 + Math.random() * (isSand ? 1.6 : 1.1), -v.velocity.z * 0.14 + r() * (isSand ? 1.8 : 1.2),
            { life: pLife, size0: 0.35, size1: pSize, color: s.dust, alpha: pAlpha, drag: isSand ? 0.9 : 1.1, gravity: isSand ? -0.08 : -0.05 });
        }
      }
      // lastik dumani (sert zeminde patinaj/kayma)
      if (s.dustAmt < 0.3 && slide > 3.2) {
        this.smokeAcc[i] += dt * Math.min(45, (slide - 3) * 9);
        while (this.smokeAcc[i] >= 1) {
          this.smokeAcc[i] -= 1;
          const r = () => (Math.random() - 0.5);
          this.smoke.emit(_p.x + r() * 0.2, _p.y + 0.15, _p.z + r() * 0.2, r() * 0.8, 0.5 + Math.random() * 0.6, r() * 0.8,
            { life: 2 + Math.random() * 1.5, size0: 0.4, size1: 3 + Math.random() * 2, color: SMOKE, alpha: 0.22, drag: 1.4, gravity: -0.12 });
        }
      }
      // lastik izi: kayarken koyu iz; kum/toprakta normal surus da iz birakir
      const softGround = s.dustAmt >= 0.5;
      if (slide > 2.2 || (softGround && speed > 1.5)) {
        const a = slide > 2.2 ? Math.min(0.55, 0.15 + (slide - 2.2) * 0.07) : 0.12;
        const col = slide > 2.2 && !softGround ? [0.03, 0.03, 0.03] : [s.dust[0] * 0.45, s.dust[1] * 0.42, s.dust[2] * 0.4];
        this.skids.add(i, _p, _n, _fwd, a, col);
      } else this.skids.lift(i);
    }
    // carpisma kivilcimlari
    for (const im of v.lastImpacts || []) {
      if (!im.object || im.speed < 3) continue;
      const n = Math.min(40, 8 + im.speed * 2);
      for (let k = 0; k < n; k++) {
        const r = () => (Math.random() - 0.5);
        this.sparks.emit(im.point.x, im.point.y, im.point.z,
          im.normal.x * 3 + r() * 6 + v.velocity.x * 0.4, Math.random() * 4, im.normal.z * 3 + r() * 6 + v.velocity.z * 0.4,
          { life: 0.25 + Math.random() * 0.45, size0: 0.06, size1: 0.02, color: [1.0, 0.62, 0.22], alpha: 1, drag: 0.6, gravity: 9.8 });
      }
    }
    v.lastImpacts = null;
    this.dust.update(dt); this.smoke.update(dt); this.sparks.update(dt); this.shards.update(dt); this.skids.update(dt); this.flames.update(dt);
  }

  /** Egzoz patlamasi: gercekci mavi/turuncu alev patlamasi ve kivilcimlar. */
  backfire(level = 0.8) {
    const v = this.vehicle;
    const P = v.params;
    const exLocal = new THREE.Vector3(-P.dims.trackR * 0.42, -P.cgHeight + 0.18, P.axleRear + 0.82);
    _p.copy(exLocal).applyMatrix4(v.root.matrixWorld);
    const back = v.forward.clone().negate();
    const count = Math.floor(5 + level * 9);
    const speed = 5.0 + level * 4.0;
    for (let k = 0; k < count; k++) {
      const r = () => (Math.random() - 0.5) * 0.16;
      const isCore = Math.random() < 0.45;
      const col = isCore ? [0.22, 0.65, 1.0] : [1.0, 0.45, 0.08];
      this.flames.emit(
        _p.x + r(), _p.y + r(), _p.z + r(),
        back.x * speed + (Math.random() - 0.5) * 1.6,
        back.y * speed + Math.random() * 0.9,
        back.z * speed + (Math.random() - 0.5) * 1.6,
        {
          life: 0.08 + Math.random() * 0.12,
          size0: 0.12,
          size1: 0.45 + level * 0.35,
          color: col,
          alpha: 0.95,
          drag: 1.8,
          gravity: -0.4,
        }
      );
      if (Math.random() < 0.65) {
        this.sparks.emit(
          _p.x, _p.y, _p.z,
          back.x * (speed * 1.6) + (Math.random() - 0.5) * 4.2,
          Math.random() * 2.5,
          back.z * (speed * 1.6) + (Math.random() - 0.5) * 4.2,
          { life: 0.18 + Math.random() * 0.25, size0: 0.05, size1: 0.01, color: [1.0, 0.85, 0.4], alpha: 1, drag: 0.8, gravity: 6 }
        );
      }
    }
  }

  /** Cam kirilmasi: parlak kucuk kiriklar etrafa sacilir. */
  glass(point, n = 90) {
    const v = this.vehicle.velocity;
    for (let k = 0; k < n; k++) {
      const r = () => Math.random() - 0.5;
      const c = 0.78 + Math.random() * 0.2;
      this.shards.emit(point.x + r() * 0.5, point.y + r() * 0.3, point.z + r() * 0.5,
        v.x * 0.8 + r() * 5, Math.random() * 3.2, v.z * 0.8 + r() * 5,
        { life: 0.7 + Math.random() * 1.1, size0: 0.05 + Math.random() * 0.04, size1: 0.03, color: [c * 0.92, c, c * 1.04], alpha: 0.95, drag: 0.4, gravity: 9.8 });
    }
  }

  /** Kopan parca: biraz toz ve kivilcim. */
  debris(point) {
    for (let k = 0; k < 18; k++) {
      const r = () => Math.random() - 0.5;
      this.sparks.emit(point.x, point.y, point.z, r() * 6, Math.random() * 3, r() * 6,
        { life: 0.2 + Math.random() * 0.3, size0: 0.05, size1: 0.02, color: [1.0, 0.62, 0.22], alpha: 1, drag: 0.6, gravity: 9.8 });
    }
  }

  dispose() {
    const scene = this.app.scene;
    this.dust.dispose(scene); this.smoke.dispose(scene); this.sparks.dispose(scene); this.shards.dispose(scene); this.skids.dispose(scene); this.flames.dispose(scene);
  }
}
