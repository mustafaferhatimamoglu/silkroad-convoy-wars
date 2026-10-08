import * as THREE from 'three';

// Dramatik hasar: menteseli parcalar (kaput, kapilar, bagaj kapagi/arka kapak).
//
// Her parcanin bir kilidi ve menteşe dayanimi vardir. Yakinina gelen sert carpmalar kilidi
// zayiflatir; kilit kirilinca parca menteşesinde serbest kalir ve 1 serbestlik dereceli bir
// sarkac gibi davranir: aracin ivmesi (frenlemede kapilar acilir), yercekimi (pikap kapagi
// duser, kaput kapanmaya calisir), ruzgar (acik kaput hizla yukari kalkar) ve dayanaklara
// carpma (sekme). Dayanaga cok hizli vuran ya da dogrudan cok sert darbe alan parca kopar:
// dunyaya birakilir, takla atarak yere duser ve bir sure sonra kaybolur. Sert darbede o
// parcanin camlari tuzla buz olur.

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _box = new THREE.Box3();
const _e = new THREE.Euler();

const KINDS = {
  // eksen: parca grubunun donme ekseni; isaret: acilma yonu; max: acilma acisi (rad)
  hood: { axis: 'x', sign: 1, max: 1.35, latch: 1.0, hinge: 1.0, mass: 18 },
  tailgate: { axis: 'x', sign: 1, max: Math.PI / 2, latch: 0.9, hinge: 0.9, mass: 25 },
  hatch: { axis: 'x', sign: -1, max: 1.35, latch: 0.9, hinge: 0.9, mass: 22 },
  door: { axis: 'y', sign: 1, max: 1.2, latch: 1.0, hinge: 1.1, mass: 28 },
};

export class VehicleDamage {
  constructor(vehicle) {
    this.vehicle = vehicle;
    this.model = vehicle.model;
    this.panels = [];
    this.debris = [];
    this.prevVel = new THREE.Vector3();
    this.events = [];       // { type: 'shatter'|'detach'|'open', point: Vector3(dunya) }
    const parts = this.model.parts || {};
    const body = this.model.body;
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    for (const p of Object.values(parts)) {
      const kind = p.name.startsWith('door') ? 'door' : p.name;
      const K = KINDS[kind];
      if (!K) continue;
      // kapali durumdaki sinir kutusu (govde uzayinda) ve kutle merkezi (menteşeye gore)
      _box.makeEmpty();
      p.group.updateMatrixWorld(true);
      p.group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox.clone().applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld));
        _box.union(bb);
      });
      if (_box.isEmpty()) continue;
      const center = _box.getCenter(new THREE.Vector3());
      const size = _box.getSize(new THREE.Vector3());
      // kapilar: sol kapi -x yonune acilir
      const sign = kind === 'door' ? (p.pivot.x < 0 ? -1 : 1) : K.sign;
      const glass = [];
      p.group.traverse((o) => { if (o.isMesh && o.material && o.material.transparent && o.material.opacity < 0.95 && !o.material.map) glass.push(o); });
      this.panels.push({
        part: p, kind, K, sign,
        box: _box.clone().expandByScalar(0.12), center, size,
        com: center.clone().sub(p.pivot),
        latch: K.latch, hinge: K.hinge,
        state: 'closed', angle: 0, omega: 0,
        glass, shattered: false,
        home: { parent: p.group.parent, pos: p.group.position.clone(), quat: p.group.quaternion.clone() },
      });
    }
  }

  /** Carpma: p govde (zemin) uzayinda, d ice dogru birim vektor, speed m/s. */
  impact(p, d, speed) {
    if (speed < 4) return;
    for (const P of this.panels) {
      if (P.state === 'detached') continue;
      const dist = P.box.distanceToPoint(p);
      if (dist > 0.3) continue;
      const near = 1 - dist / 0.3;
      const e = Math.pow(Math.max(0, speed - 4), 1.3) * 0.075 * near;
      // cam: orta siddette darbede bile kirilir
      if (!P.shattered && P.glass.length && speed * near > 7.5) this._shatter(P);
      if (P.state === 'closed') {
        P.latch -= e;
        if (P.latch <= 0) this._open(P, speed * near * 0.35);
      } else {
        P.omega += (Math.random() - 0.3) * speed * near * 0.3;   // acik parca darbeyle savrulur
      }
      P.hinge -= e * 0.55;
      if (P.hinge <= 0 || speed * near > 15) this._detach(P, d, speed * near);
    }
  }

  _open(P, kick = 0) {
    P.state = 'open';
    P.omega = kick;
    this._event('open', P);
  }

  _shatter(P) {
    P.shattered = true;
    for (const g of P.glass) g.visible = false;
    this._event('shatter', P);
  }

  _event(type, P) {
    const w = new THREE.Vector3().copy(P.center);
    this.model.body.localToWorld(w);
    this.events.push({ type, point: w, panel: P });
  }

  /** Parcayi aractan kopar: dunyaya tasinir, kendi basina ucar. */
  _detach(P, d, speed) {
    if (P.state === 'detached') return;
    if (!P.shattered && P.glass.length) this._shatter(P);
    const g = P.part.group;
    const scene = this.vehicle.app.scene;
    g.updateMatrixWorld(true);
    // kutle merkezi dunya konumu
    const comW = P.com.clone().applyMatrix4(g.matrixWorld);
    const q = new THREE.Quaternion();
    g.getWorldQuaternion(q);
    scene.attach(g);
    // hiz: aracin o noktadaki hizi + darbe yonunde firlatma + rastgele yukari
    const v = this.vehicle;
    const vel = new THREE.Vector3(v.sim.body.vel.x, v.sim.body.vel.y, v.sim.body.vel.z);
    const w = new THREE.Vector3(v.sim.body.angVel.x, v.sim.body.angVel.y, v.sim.body.angVel.z);
    const r = comW.clone().sub(v.position);
    vel.add(_v.crossVectors(w, r));
    if (d) {
      const dw = _v2.copy(d).applyQuaternion(v.quaternion);
      vel.addScaledVector(dw, -Math.min(8, speed * 0.25));
    }
    vel.y += 1.5 + Math.random() * 2.5;
    P.state = 'detached';
    this.debris.push({
      P, group: g, pos: comW, quat: q, vel,
      ang: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8),
      age: 0, rest: 0, radius: Math.max(0.08, Math.min(P.size.x, P.size.y, P.size.z) * 0.5 + 0.03),
    });
    if (this.debris.length > 14) this._removeDebris(this.debris[0]);
    this._event('detach', P);
  }

  _removeDebris(D) {
    const i = this.debris.indexOf(D);
    if (i >= 0) this.debris.splice(i, 1);
    D.group.parent && D.group.parent.remove(D.group);
    D.gone = true;
  }

  /** Her kare: acik parcalarin salinimi ve kopan parcalarin ucusu. */
  update(dt) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const v = this.vehicle, b = v.sim.body;
    // aracin govde ekseninde hissedilen ivme (yercekimi - ivme)
    const vel = _v.set(b.vel.x, b.vel.y, b.vel.z);
    const acc = _v2.copy(vel).sub(this.prevVel).divideScalar(dt);
    this.prevVel.copy(vel);
    if (acc.lengthSq() > 2500) acc.setLength(50);
    const qInv = _q.copy(v.quaternion).invert();
    const f = new THREE.Vector3(0, -9.81, 0).sub(acc).applyQuaternion(qInv);   // govde ekseninde
    const speed = vel.length();
    const fwd = -(_v.set(b.vel.x, b.vel.y, b.vel.z).applyQuaternion(qInv).z);  // ileri hiz
    for (const P of this.panels) {
      if (P.state !== 'open') continue;
      const K = P.K, g = P.part.group;
      // menteşe eksenine gore tork: (R c) x (m f)
      const R = this._rot(P, P.angle);
      const c = _v.copy(P.com).applyQuaternion(R);
      const F = f.clone().multiplyScalar(K.mass);
      const tq = new THREE.Vector3().crossVectors(c, F);
      const axisT = K.axis === 'x' ? tq.x : tq.y;
      const I = K.mass * Math.max(0.05, P.com.lengthSq()) * 1.3;
      // parcanin "acilma" yonunde acisal ivme
      let alpha = (axisT / I) * this._dirSign(P);
      // ruzgar: kaput ileri giderken acilir (yukari kalkar), kapilar kapanir
      const wind = fwd > 2 ? fwd * fwd : 0;
      if (P.kind === 'hood') alpha += wind * 0.1 * (0.3 + Math.sin(P.angle + 0.25)) + (Math.random() - 0.5) * wind * 0.06;
      else if (P.kind === 'door') alpha -= wind * 0.006 * Math.sin(P.angle);
      alpha -= P.omega * 1.2;   // menteşe surtunmesi
      P.omega += alpha * dt;
      P.angle += P.omega * dt;
      // dayanaklar
      if (P.angle < 0) {
        P.angle = 0;
        if (P.omega < -3) this.events.push({ type: 'slam', point: this._worldCenter(P), panel: P });
        P.omega = -P.omega * 0.3;
      } else if (P.angle > K.max) {
        P.angle = K.max;
        if (P.omega > 7) { P.hinge -= (P.omega - 7) * 0.12; this.events.push({ type: 'slam', point: this._worldCenter(P), panel: P }); }
        P.omega = -P.omega * 0.25;
        if (P.hinge <= 0) { this._detach(P, null, speed); continue; }
      }
      g.quaternion.copy(this._rot(P, P.angle));
    }
    // kopan parcalar
    const world = v.app.world;
    for (const D of [...this.debris]) {
      D.age += dt;
      if (D.age > 40) { this._removeDebris(D); continue; }
      if (D.rest > 1.5) continue;
      D.vel.y -= 9.81 * dt;
      D.vel.multiplyScalar(1 - 0.12 * dt);
      D.pos.addScaledVector(D.vel, dt);
      const angL = D.ang.length();
      if (angL > 1e-4) {
        _q2.setFromAxisAngle(_v.copy(D.ang).divideScalar(angL), angL * dt);
        D.quat.premultiply(_q2).normalize();
      }
      const gy = world ? world.heightAt(D.pos.x, D.pos.z, D.pos.y) : null;
      const ground = gy === null || gy === undefined ? -1e9 : gy;
      if (D.pos.y < ground + D.radius) {
        D.pos.y = ground + D.radius;
        if (D.vel.y < 0) D.vel.y = -D.vel.y * 0.25;
        D.vel.x *= 0.7; D.vel.z *= 0.7;
        D.ang.multiplyScalar(0.6);
        // yere yatis: yuzeyi en duz olan eksen yukari baksin
        const up = _v.set(0, 1, 0).applyQuaternion(_q2.copy(D.quat).invert());
        const ax = Math.abs(up.x) > Math.abs(up.y) ? (Math.abs(up.x) > Math.abs(up.z) ? 'x' : 'z') : (Math.abs(up.y) > Math.abs(up.z) ? 'y' : 'z');
        const tgt = new THREE.Vector3(ax === 'x' ? Math.sign(up.x) : 0, ax === 'y' ? Math.sign(up.y) : 0, ax === 'z' ? Math.sign(up.z) : 0);
        const fix = new THREE.Quaternion().setFromUnitVectors(up.normalize(), tgt);
        D.quat.multiply(new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), fix, Math.min(1, dt * 6)));
        if (D.vel.lengthSq() < 0.2 && D.ang.lengthSq() < 0.5) D.rest += dt; else D.rest = 0;
      }
      // grubu (menteşe orijinli) kutle merkezine gore yerlestir
      D.group.quaternion.copy(D.quat);
      D.group.position.copy(D.pos).sub(_v.copy(D.P.com).applyQuaternion(D.quat));
    }
  }

  _dirSign(P) {
    // kapilar: sol kapi -y donusuyle acilir; acilma acisi pozitif tanimli
    return P.kind === 'door' ? P.sign : P.K.sign;
  }

  _rot(P, angle) {
    const a = angle * this._dirSign(P);
    _e.set(P.K.axis === 'x' ? a : 0, P.K.axis === 'y' ? a : 0, 0);
    return new THREE.Quaternion().setFromEuler(_e);
  }

  _worldCenter(P) {
    const w = new THREE.Vector3().copy(P.center);
    this.model.body.localToWorld(w);
    return w;
  }

  /** Her seyi onar: parcalar yerine, camlar geri, kilitler saglam. */
  repair() {
    for (const D of this.debris) D.group.parent && D.group.parent.remove(D.group);
    this.debris.length = 0;
    for (const P of this.panels) {
      const g = P.part.group;
      if (g.parent !== P.home.parent) { g.parent && g.parent.remove(g); P.home.parent.add(g); }
      g.position.copy(P.home.pos); g.quaternion.copy(P.home.quat);
      P.state = 'closed'; P.angle = 0; P.omega = 0; P.latch = P.K.latch; P.hinge = P.K.hinge;
      for (const gl of P.glass) gl.visible = true;
      P.shattered = false;
    }
  }

  dispose() {
    for (const D of this.debris) D.group.parent && D.group.parent.remove(D.group);
    this.debris.length = 0;
  }
}
