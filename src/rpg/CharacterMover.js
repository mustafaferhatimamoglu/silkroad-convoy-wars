import * as THREE from 'three';
import { makeContacts, makeHit } from '../world/Collision.js';

// Kinematik karakter hareketi (oyuncu, binek, canavar): ayak noktasi `pos`.
//  - zemin: asagi isin (arazi + objeler); `stepUp` kadar basamak cikar, yokus siniri
//  - duvar: iki kure (diz ve gogus yuksekligi) ile obje temaslari, yatay itme + kayma
//  - yercekimi ve dusme; cok dik araziye tirmanamaz (duvar gibi davranir)

const _o = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _c = new THREE.Vector3();
const _n = new THREE.Vector3();

export class CharacterMover {
  constructor(app, { radius = 0.32, stepUp = 0.42, maxSlope = 0.62, spheres = [0.5, 1.2] } = {}) {
    this.app = app;
    this.radius = radius;
    this.stepUp = stepUp;
    this.maxSlope = maxSlope;      // izin verilen en dusuk zemin normali y'si
    this.spheres = spheres;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.onGround = false;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.hit = makeHit();
    this.contacts = makeContacts(8);
    this.blocked = 0;              // bu karede duvara takilma miktari (yapay zeka icin)
  }

  place(x, z, yHint = null) {
    const g = this._groundAt(x, z, (yHint ?? this.app.world.heightAt(x, z) ?? 0) + 2.0, 60);
    this.pos.set(x, g ? g.y : (yHint ?? 0), z);
    this.vel.set(0, 0, 0);
    this.onGround = !!g;
  }

  /** (x,z)'de `fromY`'den asagi ilk zemin. */
  _groundAt(x, z, fromY, far) {
    const h = this.hit;
    if (!this.app.collision.raycast(_o.set(x, fromY, z), _down, far, h)) return null;
    this.groundSurface = h.surface;       // arazi bayragi ya da 100 (obje ustu)
    return { y: h.point.y, n: h.normal, object: h.object };
  }

  /**
   * wish: istenen yatay hiz (m/s). Donus: gercekte kat edilen yatay mesafe.
   */
  move(dt, wish, { accel = 30 } = {}) {
    dt = Math.min(dt, 0.05);
    const v = this.vel;
    // altindaki bolge henuz yuklenmediyse bekle (zemin isini bos doner: dunyanin altina dusmesin)
    if (!this.app.world.isLoadedAt(this.pos.x, this.pos.z)) { v.set(0, 0, 0); return 0; }
    // yatay hiz istenene yaklasir
    const k = Math.min(1, (accel * dt) / Math.max(0.01, Math.hypot(wish.x - v.x, wish.z - v.z)));
    v.x += (wish.x - v.x) * k;
    v.z += (wish.z - v.z) * k;
    if (!this.onGround) v.y = Math.max(-40, v.y - 22 * dt); else v.y = 0;
    const x0 = this.pos.x, z0 = this.pos.z;
    // alt adimlar (hizli harekette duvardan gecmesin)
    const travel = Math.hypot(v.x, v.z) * dt;
    const n = Math.max(1, Math.ceil(travel / 0.25));
    this.blocked = 0;
    for (let i = 0; i < n; i++) this._step(dt / n);
    return Math.hypot(this.pos.x - x0, this.pos.z - z0);
  }

  _step(dt) {
    const p = this.pos, v = this.vel;
    const px = p.x, pz = p.z;
    p.x += v.x * dt; p.z += v.z * dt; p.y += v.y * dt;
    if (!this.app.world.isLoadedAt(p.x, p.z)) { p.x = px; p.z = pz; v.x = 0; v.z = 0; }
    // duvarlar (objeler)
    for (const hgt of this.spheres) {
      _c.set(p.x, p.y + hgt, p.z);
      const n = this.app.collision.sphereContacts(_c, this.radius, this.contacts, 8);
      for (let i = 0; i < n; i++) {
        const ct = this.contacts[i];
        if (!ct.object) continue;
        _n.copy(ct.normal);
        if (_n.y > 0.7) continue;                   // zemin gibi: asagi isin halleder
        if (_n.y < -0.7) { if (v.y > 0) v.y = 0; continue; }   // tavan
        _n.y = 0;
        const l = _n.length();
        if (l < 1e-4) continue;
        _n.multiplyScalar(1 / l);
        p.x += _n.x * ct.depth; p.z += _n.z * ct.depth;
        const vn = v.x * _n.x + v.z * _n.z;
        if (vn < 0) { v.x -= _n.x * vn; v.z -= _n.z * vn; this.blocked += -vn; }
      }
    }
    // derin gomulme (2 m+; normalde olmaz): eski yere don ve yuzeye cik
    const th = this.app.world.heightAt(p.x, p.z);
    if (th !== null && p.y < th - 2.0) {
      p.x = px; p.z = pz;
      const th0 = this.app.world.heightAt(p.x, p.z) ?? th;
      const g2 = this._groundAt(p.x, p.z, th0 + 2.5, 6);
      p.y = g2 ? Math.max(g2.y, th0) : th0;
      if (v.y < 0) v.y = 0;
    }
    // zemin
    let g = this._groundAt(p.x, p.z, p.y + this.stepUp + 0.05, this.stepUp + 3.0);
    if (g && g.n.y < this.maxSlope && g.y > p.y + 0.05) {
      // cok dik yukari yokus: duvar gibi; eski yere don ve oradaki zemine otur
      p.x = px; p.z = pz;
      this.blocked += 1;
      g = this._groundAt(p.x, p.z, p.y + this.stepUp + 0.05, this.stepUp + 3.0);
      if (g && g.y > p.y + 0.05 && g.n.y < this.maxSlope) g = { y: Math.max(p.y, Math.min(g.y, p.y + 0.05)), n: g.n };
    }
    if (g && (g.y >= p.y - 0.06 || (this.onGround && g.y > p.y - this.stepUp && v.y <= 0))) {
      // zemine otur (asagi basamak/yokus inisinde de yapis)
      p.y = g.y;
      this.onGround = true;
      this.groundNormal.copy(g.n);
      if (v.y < 0) v.y = 0;
      return;
    }
    this.onGround = false;
  }
}
