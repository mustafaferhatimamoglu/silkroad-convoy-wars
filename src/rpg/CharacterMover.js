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
    // yatay hiz istenene yaklasir
    const k = Math.min(1, (accel * dt) / Math.max(0.01, Math.hypot(wish.x - v.x, wish.z - v.z)));
    v.x += (wish.x - v.x) * k;
    v.z += (wish.z - v.z) * k;
    if (!this.onGround) v.y -= 22 * dt; else v.y = 0;
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
    // zemin
    const g = this._groundAt(p.x, p.z, p.y + this.stepUp + 0.05, this.stepUp + 3.0);
    if (g) {
      const gy = g.y;
      if (g.n.y < this.maxSlope && gy > p.y + 0.05) {
        // cok dik yukari yokus: duvar gibi geri it
        p.x = px; p.z = pz;
        this.blocked += 1;
      } else if (gy >= p.y - 0.06 || (this.onGround && gy > p.y - this.stepUp && v.y <= 0)) {
        // zemine otur (asagi basamak/yokus inisinde de yapis)
        p.y = gy;
        this.onGround = true;
        this.groundNormal.copy(g.n);
        if (v.y < 0) v.y = 0;
        return;
      }
    }
    this.onGround = false;
  }
}
