import * as THREE from 'three';
import { buildGenObjects } from './gen/build.js';

// Ulasim: feribotlar (nehir, bogaz, deniz). Her hatta iki gemi, her biri kendi iskelesinde bekler.
// Iskelenin ucuna gelip yavaslayinca G (kumandada B) ile binilir: arac guverteye alinir, gemi karsiya
// gecer, arac karsi iskeleye birakilir. Yolculuk sirasinda arac fizigi durur, araci gemi tasir.
// Dunya koordinatlari: plan (X dogu, Z kuzey) -> Three.js (x = X, z = -Z).

const BOAT_HALF = 13;

const ease = (t) => t * t * (3 - 2 * t);

export class Transport {
  constructor(app) {
    this.app = app;
    this.routes = [];
    this.riding = null;
    this.group = new THREE.Group();
    this.group.name = 'transport';
    app.scene.add(this.group);
    const plan = app.world.data.plan;
    for (const f of plan.ferries) {
      const side = (d, other) => {
        const ux = d.ux, uz = d.uz;
        // iskele ucu ve gemi bagi (iskele ucunun disinda, burun karsi kiyiya)
        const moor = { x: d.ex + ux * (BOAT_HALF + 0.6), z: d.ez + uz * (BOAT_HALF + 0.6) };
        return { ...d, moor, yaw: Math.atan2(uz, ux), other };
      };
      const A = side(f.a), B = side(f.b);
      const route = { f, A, B, boats: [] };
      // iki gemi: biri A'da biri B'de
      // guverte ustu iskeleyle ayni yukseklikte (su seviyesi + 1.15 m)
      route.boats.push({ home: A, at: A, y: f.a.wl + 1.15, mesh: null, trip: null });
      route.boats.push({ home: B, at: B, y: f.b.wl + 1.15, mesh: null, trip: null });
      this.routes.push(route);
    }
    this._meshReady = this._buildMeshes();
    this._promptT = 0;
  }

  async _buildMeshes() {
    const w = this.app.world;
    const built = await buildGenObjects(w.objPool, [{ m: 'ferry', x: 0, y: 0, z: 0, yaw: 0, s: 1 }], () => false);
    if (!built) return;
    for (const r of this.routes) {
      for (const b of r.boats) {
        const g = new THREE.Group();
        for (const k of Object.keys(built.meshes)) {
          const m = new THREE.Mesh(built.meshes[k], k === 'alpha' ? w.objectMats.alpha : w.objectMats.opaque);
          m.castShadow = true; m.receiveShadow = true;
          g.add(m);
        }
        this.group.add(g);
        b.mesh = g;
        this._pose(b, b.at.moor.x, b.at.moor.z, b.at.yaw, 0);
      }
    }
  }

  /** Gemiyi (dunya X,Z; yaw: burnun dunya acisi) konumla; dalga sallantisi. */
  _pose(b, X, Z, yaw, t) {
    b.X = X; b.Z = Z; b.yaw = yaw;
    if (!b.mesh) return;
    const bob = Math.sin(t * 1.3 + X * 0.01) * 0.08;
    b.mesh.position.set(X, b.y + bob, -Z);
    b.mesh.rotation.set(Math.sin(t * 0.9) * 0.015, yaw, Math.sin(t * 0.7) * 0.02, 'YXZ');
  }

  /** Surus modu her karede cagirir. Donus: gemideyse true (arac fizigi duraklatilir). */
  update(dt, mode) {
    this.time = (this.time || 0) + dt;
    const t = this.time;
    // bos gemiler: evine donus ya da beklemede sallanma
    for (const r of this.routes) {
      for (const b of r.boats) {
        if (b.trip) this._advance(r, b, dt, mode);
        else this._pose(b, b.X ?? b.at.moor.x, b.Z ?? b.at.moor.z, b.yaw ?? b.at.yaw, t);
      }
    }
    this._colliders();
    if (this.riding) return true;
    // binis: iskele ucunda ya da iskeledeki geminin guvertesinde, yavas
    const v = mode.vehicle, p = v.position;
    const X = p.x, Z = -p.z;
    let offer = null;
    for (const r of this.routes) {
      for (const side of [r.A, r.B]) {
        const boat = r.boats.find((b) => !b.trip && b.at === side);
        const onDeck = boat && Math.abs((X - boat.X) * Math.cos(boat.yaw) + (Z - boat.Z) * Math.sin(boat.yaw)) < 13 && Math.abs(-(X - boat.X) * Math.sin(boat.yaw) + (Z - boat.Z) * Math.cos(boat.yaw)) < 5.2;
        if (!onDeck && Math.hypot(X - side.ex, Z - side.ez) > 12) continue;
        offer = { r, side, boat };
      }
    }
    const input = this.app.input, gp = input.gamepad;
    if (offer) {
      const dest = offer.side === offer.r.A ? offer.r.B : offer.r.A;
      const name = offer.r.f.name;
      this._promptT -= dt;
      if (this._promptT <= 0) {
        this._promptT = 0.5;
        mode.hud.toast(offer.boat ? `G: ${name} — karşıya geç` : `${name} karşı kıyıda, geliyor…`, 0.7);
      }
      if (!offer.boat && !offer.r.boats.some((b) => b.trip)) {
        // iki gemi de karsida: biri bos gelir
        const b = offer.r.boats.find((q) => q.at !== offer.side);
        if (b) b.trip = { from: dest, to: offer.side, t: 0, dur: offer.r.f.time * 0.6, empty: true };
      }
      if (offer.boat && (input.pressed('KeyG') || (gp && gp.pressed(1))) && v.sim.speed < 4) this._board(offer.r, offer.side, offer.boat, mode);
    }
    return false;
  }

  /** Carpisma kutulari: iskeledeki geminin guvertesi (ustune surulur), gemi yoksa iskele ucunda bariyer. */
  _colliders() {
    const list = this.app.collision.boxes;
    list.length = 0;
    for (const r of this.routes) {
      for (const side of [r.A, r.B]) {
        const boat = r.boats.find((b) => !b.trip && b.at === side && b.X !== undefined);
        if (boat) {
          list.push({ x: boat.X, y: boat.y - 0.5, z: -boat.Z, hx: 13, hy: 0.5, hz: 5, yaw: boat.yaw });
          // pruva rampasi kalkik (guverteden suya surulmesin) + yan korkuluklar
          const fx = boat.X + Math.cos(boat.yaw) * 12.6, fz = boat.Z + Math.sin(boat.yaw) * 12.6;
          list.push({ x: fx, y: boat.y + 0.7, z: -fz, hx: 0.3, hy: 0.7, hz: 5, yaw: boat.yaw });
          for (const sgn of [-1, 1]) {
            const sx = boat.X - Math.sin(boat.yaw) * 4.9 * sgn, sz = boat.Z + Math.cos(boat.yaw) * 4.9 * sgn;
            list.push({ x: sx, y: boat.y + 0.5, z: -sz, hx: 13, hy: 0.5, hz: 0.15, yaw: boat.yaw });
          }
        }
        else list.push({ x: side.ex, y: side.wl + 1.8, z: -side.ez, hx: 0.3, hy: 0.6, hz: 5, yaw: side.yaw });
      }
    }
  }

  _board(r, side, boat, mode) {
    const dest = side === r.A ? r.B : r.A;
    const v = mode.vehicle, b = v.sim.body;
    this.riding = { r, boat, mode, phase: 'on', t: 0, from: { x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: v.sim.yaw } };
    boat.trip = { from: side, to: dest, t: 0, dur: r.f.time, rider: true };
    mode.hud.toast(`${r.f.name}: ${Math.round(r.f.time)} sn`, 2.5);
  }

  /** Gemi yolculugu: binis (1.2 sn), sefer, inis (1.2 sn). */
  _advance(r, b, dt, mode) {
    const tr = b.trip;
    const ride = this.riding && this.riding.boat === b ? this.riding : null;
    if (ride && ride.phase === 'on') {
      ride.t += dt;
      this._carOnDeck(ride, Math.min(1, ride.t / 1.2));
      if (ride.t >= 1.2) { ride.phase = 'sail'; ride.t = 0; }
      this._pose(b, b.X, b.Z, b.yaw, this.time);
      return;
    }
    if (ride && ride.phase === 'off') {
      ride.t += dt;
      this._carOff(ride, Math.min(1, ride.t / 1.2));
      if (ride.t >= 1.2) this._release(ride);
      this._pose(b, b.X, b.Z, b.yaw, this.time);
      return;
    }
    tr.t += dt;
    const k = ease(Math.min(1, tr.t / tr.dur));
    const A = tr.from.moor, B = tr.to.moor;
    const X = A.x + (B.x - A.x) * k, Z = A.z + (B.z - A.z) * k;
    const yaw = Math.atan2(B.z - A.z, B.x - A.x);
    this._pose(b, X, Z, yaw, this.time);
    if (ride) this._carOnDeck(ride, 1);
    if (tr.t >= tr.dur) {
      b.at = tr.to;
      b.trip = null;
      if (ride) { ride.phase = 'off'; ride.t = 0; ride.dest = tr.to; b.trip = { ...tr, t: tr.dur, dur: tr.dur }; }
      else if (b.at !== b.home && !tr.empty) b.trip = { from: b.at, to: b.home, t: 0, dur: tr.dur * 0.8, empty: true };
    }
  }

  /** Araci guverte ortasina yerlestir (k: 0 = iskelede, 1 = guvertede). */
  _carOnDeck(ride, k) {
    const b = ride.boat, v = ride.mode.vehicle, s = v.sim;
    const cg = v.params.cgHeight + 0.05;
    const tx = b.X, tz = -b.Z, ty = b.y + cg;
    const yaw = b.yaw - Math.PI / 2;   // arac yonu (0 = kuzey, + sola) = geminin burun acisi - 90 derece
    const e = ease(k), f = ride.from;
    s.reset(f.x + (tx - f.x) * e, f.y + (ty - f.y) * e, f.z + (tz - f.z) * e, lerpAngle(f.yaw, yaw, e));
    v._sync(1);
  }

  /** Inis: guverteden karsi iskeleye (iskele ucundan 6 m iceri, karaya bakarak). */
  _carOff(ride, k) {
    const b = ride.boat, v = ride.mode.vehicle, s = v.sim, d = ride.dest;
    const cg = v.params.cgHeight + 0.05;
    const yaw = b.yaw - Math.PI / 2;
    const ex = d.ex - d.ux * 6, ez = d.ez - d.uz * 6;
    const e = ease(k);
    const x = b.X + (ex - b.X) * e, z = b.Z + (ez - b.Z) * e;
    s.reset(x, d.wl + 1.2 + cg + 0.02, -z, yaw);
    v._sync(1);
  }

  _release(ride) {
    const b = ride.boat, v = ride.mode.vehicle;
    v.acc = 0;
    if (v._hist) v._hist.length = 0;            // geri sarma gemiden once ki konuma atlamasin
    ride.mode.camera.initialized = false;
    // bos gemi evine doner
    b.trip = b.at !== b.home ? { from: b.at, to: b.home, t: 0, dur: ride.r.f.time * 0.8, empty: true } : null;
    this.riding = null;
    ride.mode.hud.toast('Karşı kıyıya varıldı', 2);
  }

  dispose() {
    this.app.collision.boxes.length = 0;
    this.app.scene.remove(this.group);
  }
}

function lerpAngle(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}
