import * as THREE from 'three';
import { VehicleSim } from './physics/VehicleSim.js';
import { V3 } from './physics/math.js';
import { KARTAL, surfaceInfo } from './presets.js';
import { KartalModel } from './model/KartalModel.js';
import { WorldGround } from './WorldGround.js';
import { VehicleReflections } from './Reflections.js';

// Oyundaki arac: sabit adimli fizik (240 Hz) + ara degerlemeli gorsel model + isiklar.

const STEP = 1 / 240;
const _v = new V3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();

export class Vehicle {
  constructor(app, { variant = 'kartal80', paint = 'lacivert', params = KARTAL } = {}) {
    this.app = app;
    this.params = params;
    this.variant = variant;
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
    this.reflections = new VehicleReflections(app, { size: 128 });
    this.reflections.enabled = app.settings ? app.settings.get('quality') !== 'dusuk' : true;
    this.reflections.track(this.model.reflectiveMaterials());
    this._reflPos = new THREE.Vector3();
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

  /**
   * Araci (x,z) noktasinda zemine yerlestirir. yaw: 0 = kuzey.
   * above: zemin arama isini yHint'in ne kadar ustunden baslasin (kopru alti, kemer
   * altinda kisa tutulur ki arac catinin ustune konmasin).
   */
  spawn(x, z, yaw = 0, yHint = null, above = 60) {
    let y = yHint;
    if (this.ground) {
      const o = new V3(x, (yHint ?? 0) + above, z), d = new V3(0, -1, 0);
      const hit = this.ground.raycast(o, d, 400);
      if (hit) y = hit.point.y;
    }
    if (y === null || y === undefined) y = 0;
    this.sim.reset(x, y + this.params.cgHeight + 0.06, z, yaw);
    this.acc = 0;
    this._sync(1);
  }

  /**
   * R: takla atmis/sikismis araci duzeltir. Suya ya da derin bir yere dusmusse veya
   * 4 sn icinde ikinci kez basilirsa son guvenli noktaya (yolda, dik, su disi) geri dondurur.
   * Donus: 'upright' | 'safe'
   */
  recover() {
    const b = this.sim.body, now = performance.now();
    const list = this._safe || (this._safe = []);
    const groundY = b.pos.y - this.params.cgHeight;
    const wl = this.app.world ? this.app.world.waterAt(b.pos.x, b.pos.z) : null;
    const inWater = wl !== null && wl !== undefined && wl > groundY + 0.35;
    const last = list[list.length - 1];
    const fell = last && last.y - groundY > 4;
    const again = this._lastRecover && now - this._lastRecover < 4000;
    this._lastRecover = now;
    if ((inWater || fell || again) && list.length) {
      // en yeni kayit dusus kenarina cok yakin olabilir: bir oncekini sec, sonrakileri at
      const i = Math.max(0, list.length - 2);
      const p = list[i];
      list.length = i;   // tekrar basilirsa daha geriye gider
      this.sim.reset(p.x, p.y + this.params.cgHeight + 0.06, p.z, p.yaw);
      this.acc = 0;
      this._sync(1);
      return 'safe';
    }
    this.spawn(b.pos.x, b.pos.z, this.sim.yaw, b.pos.y, 2.5);
    return 'upright';
  }

  /** Guvenli nokta gecmisi (yarim saniyede bir, en az 3 m arayla, ~40 sn). */
  _trackSafe(dt) {
    this._safeT = (this._safeT || 0) + dt;
    if (this._safeT < 0.5) return;
    this._safeT = 0;
    const s = this.sim, b = s.body, q = b.q;
    if (1 - 2 * (q.x * q.x + q.z * q.z) < 0.93) return;
    for (const w of s.wheels) if (!w.contact || w.normal.y < 0.87) return;
    const groundY = b.pos.y - this.params.cgHeight;
    const wl = this.app.world ? this.app.world.waterAt(b.pos.x, b.pos.z) : null;
    if (wl !== null && wl !== undefined && wl > groundY - 0.1) return;
    const list = this._safe || (this._safe = []);
    const last = list[list.length - 1];
    if (last && Math.hypot(last.x - b.pos.x, last.z - b.pos.z) < 3) return;
    list.push({ x: b.pos.x, y: groundY, z: b.pos.z, yaw: s.yaw });
    if (list.length > 80) list.shift();
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
    if (ground) this._trackSafe(dt);
    this._sync(this.acc / STEP);
    this._reflPos.copy(this.position).y += 0.6;
    this.reflections.update(this._reflPos, [this.root, this.shadow]);
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

  /** Carpisma olaylarini gorsel hasara cevirir (gocuk, kirik far, catlak cam). */
  applyImpacts(list) {
    if (!list || !list.length) return;
    const inv = _q.copy(this.root.quaternion).invert();
    for (const im of list) {
      if (im.speed < 3) continue;
      const p = _p.set(im.point.x, im.point.y, im.point.z).sub(this.root.position).applyQuaternion(inv).sub(this.model.body.position);
      const d = _d.set(im.normal.x, im.normal.y, im.normal.z).applyQuaternion(inv).normalize();
      const amount = Math.min(0.14, (im.speed - 2.5) * 0.013);
      const radius = 0.32 + Math.min(0.45, im.speed * 0.025);
      this.model.deform(p, d, amount, radius);
      if (p.z < -1.75 && im.speed > 5) this.model.breakHeadlight(p.x < 0 ? 'L' : 'R');
      if (im.speed > 9) this.model.crackGlass();
    }
  }

  /** Tozlu zeminde kir birikir, suda yikanir. */
  updateDirt(dt) {
    const s = this.sim;
    let dust = 0, n = 0, wet = false;
    const col = this._dirtCol || (this._dirtCol = [0.62, 0.52, 0.38]);
    for (const w of s.wheels) {
      if (!w.contact) continue;
      const info = surfaceInfo(w.surface);
      dust += info.dustAmt; n++;
      if (info.dustAmt > 0.2) for (let k = 0; k < 3; k++) col[k] += (Math.pow(info.dust[k], 2.2) * 0.9 - col[k]) * Math.min(1, dt * 0.05);
      const wl = this.app.world && this.app.world.waterAt(w.point.x, w.point.z);
      if (wl !== null && wl !== undefined && wl > w.point.y + 0.15) wet = true;
    }
    if (n) dust /= n;
    const speed = this.velocity.length();
    this.dirt = Math.min(1, Math.max(0, (this.dirt || 0) + (dust * speed * 0.00055 - (wet ? 0.25 : 0)) * dt));
    this.model.setDirt(this.dirt, col);
  }

  repair() {
    this.model.repair();
    this.sim.health = this.params.maxHealth;
    this.dirt = 0;
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
    this.reflections.dispose();
  }
}
