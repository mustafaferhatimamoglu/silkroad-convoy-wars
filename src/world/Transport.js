import * as THREE from 'three';
import { buildGenObjects } from './gen/build.js';
import { ROC_SLOTS } from './gen/models.js';

// Ulasim: feribotlar (nehir, bogaz, deniz) ve Roc hava gemileri (istasyon <-> Roc Dagi zirvesi;
// gemiyi iki dev Roc kusu tasir, kalkista doner, yay cizerek tirmanir). Her hatta iki gemi, her biri
// kendi iskelesinde bekler.
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
      const route = { f, A, B, boats: [], air: !!f.air };
      // iki gemi: biri A'da biri B'de
      // guverte ustu iskeleyle ayni yukseklikte (su seviyesi + 1.15 m)
      route.boats.push({ home: A, at: A, y: f.a.wl + 1.15, mesh: null, trip: null });
      route.boats.push({ home: B, at: B, y: f.b.wl + 1.15, mesh: null, trip: null });
      this.routes.push(route);
    }
    for (const a of plan.airships || []) {
      const f = { ...a, air: true };
      const A = { ...a.a, moor: { x: a.a.ex + a.a.ux * (BOAT_HALF + 0.6), z: a.a.ez + a.a.uz * (BOAT_HALF + 0.6) }, yaw: Math.atan2(a.a.uz, a.a.ux), label: a.labels ? a.labels[0] : '' };
      const B = { ...a.b, moor: { x: a.b.ex + a.b.ux * (BOAT_HALF + 0.6), z: a.b.ez + a.b.uz * (BOAT_HALF + 0.6) }, yaw: Math.atan2(a.b.uz, a.b.ux), label: a.labels ? a.labels[1] : '' };
      const route = { f, A, B, boats: [], air: true, prof: airProfile(plan, A, B) };
      route.boats.push({ home: A, at: A, y: A.wl + 1.15, mesh: null, trip: null });
      route.boats.push({ home: B, at: B, y: B.wl + 1.15, mesh: null, trip: null });
      this.routes.push(route);
    }
    this._meshReady = this._buildMeshes();
    this._promptT = 0;
    // isinlanma kapilari: donen isikli halka + hedef secim paneli
    this.portals = plan.portals.map((g) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.35, 10, 48), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const grp = new THREE.Group();
      grp.add(ring, disc);
      grp.rotation.y = g.yaw + Math.PI / 2;    // halka gecis yonune dik
      this.group.add(grp);
      return { ...g, grp, ring, disc, placed: false };
    });
    this.panel = null;
  }

  async _buildMeshes() {
    const w = this.app.world;
    const built = await buildGenObjects(w.objPool, [{ m: 'ferry', x: 0, y: 0, z: 0, yaw: 0, s: 1 }], () => false);
    const airBuilt = this.routes.some((r) => r.air) ? await buildGenObjects(w.objPool, [{ m: 'airship', x: 0, y: 0, z: 0, yaw: 0, s: 1 }], () => false) : null;
    if (!built) return;
    for (const r of this.routes) {
      for (const b of r.boats) {
        const g = new THREE.Group();
        const src = r.air ? airBuilt : built;
        for (const k of Object.keys(src.meshes)) {
          const m = new THREE.Mesh(src.meshes[k], k === 'alpha' ? w.objectMats.alpha : w.objectMats.opaque);
          m.castShadow = true; m.receiveShadow = true;
          g.add(m);
        }
        if (r.air) {
          b.rocs = ROC_SLOTS.map(([x, y, z], k) => { const roc = makeRoc(k); roc.group.position.set(x, y, z); g.add(roc.group); return roc; });
        }
        this.group.add(g);
        b.mesh = g;
        this._pose(b, b.at.moor.x, b.at.moor.z, b.at.yaw, 0);
      }
    }
  }

  /** Gemiyi (dunya X,Z; yaw: burnun dunya acisi) konumla; dalga sallantisi (havada suzulme). */
  _pose(b, X, Z, yaw, t) {
    b.X = X; b.Z = Z; b.yaw = yaw;
    if (!b.mesh) return;
    const air = !!b.rocs;
    const bob = Math.sin(t * 1.3 + X * 0.01) * (air ? 0.18 : 0.08);
    b.mesh.position.set(X, b.y + bob, -Z);
    b.mesh.rotation.set(Math.sin(t * 0.9) * (air ? 0.025 : 0.015), yaw, Math.sin(t * 0.7) * 0.02, 'YXZ');
    if (air) {
      // kanat cirpma: yolculukta hizli ve genis, beklerken yavas
      const fast = b.trip ? 1 : 0;
      for (const r of b.rocs) {
        const a = Math.sin(t * (fast ? 4.2 : 1.6) + r.phase) * (fast ? 0.55 : 0.22);
        r.wings[0].rotation.x = a; r.wings[1].rotation.x = -a;
        r.group.position.y = ROC_SLOTS[0][1] + Math.sin(t * (fast ? 4.2 : 1.6) + r.phase + 1.2) * 0.35;
      }
    }
  }

  /** Surus modu her karede cagirir. Donus: gemideyse true (arac fizigi duraklatilir). */
  update(dt, mode) {
    this._mode = mode;
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
    this._portalFx(t);
    if (this.riding) return true;
    if (this._portal(mode)) return false;
    // binis: iskele ucunda ya da iskeledeki geminin guvertesinde, yavas
    const v = mode.vehicle, p = v.position;
    const X = p.x, Z = -p.z;
    let offer = null;
    for (const r of this.routes) {
      for (const side of [r.A, r.B]) {
        const boat = r.boats.find((b) => !b.trip && b.at === side);
        const onDeck = boat && this._onDeck(boat, X, Z);
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
        const go = offer.r.air ? `${dest.label || 'uç'} yolculuğu` : 'karşıya geç';
        mode.hud.toast(offer.boat ? `G: ${name} — ${go}` : `${name} ${offer.r.air ? 'öbür uçta' : 'karşı kıyıda'}, geliyor…`, 0.7);
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
          // iskeleden uzak uc kapali (guverteden suya/bosluga surulmesin) + yan korkuluklar
          const cx = Math.cos(boat.yaw), cz = Math.sin(boat.yaw);
          const far = ((boat.X - side.ex) * cx + (boat.Z - side.ez) * cz) >= 0 ? 1 : -1;
          const fx = boat.X + cx * 12.6 * far, fz = boat.Z + cz * 12.6 * far;
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

  /** Dunya X,Z guvertenin ustunde mi. */
  _onDeck(boat, X, Z) {
    return Math.abs((X - boat.X) * Math.cos(boat.yaw) + (Z - boat.Z) * Math.sin(boat.yaw)) < 13 && Math.abs(-(X - boat.X) * Math.sin(boat.yaw) + (Z - boat.Z) * Math.cos(boat.yaw)) < 5.2;
  }

  _board(r, side, boat, mode, remote = false) {
    const dest = side === r.A ? r.B : r.A;
    const v = mode.vehicle, b = v.sim.body;
    // guvertedeki yer: bindigi andaki konumu (gemi eksenine gore) korunur; ayni gemideki
    // oyuncular ust uste binmesin
    const cx = Math.cos(boat.yaw), cz = Math.sin(boat.yaw), dx = b.pos.x - boat.X, dz = -b.pos.z - boat.Z;
    const along = Math.max(-8, Math.min(8, dx * cx + dz * cz)), lat = Math.max(-2.6, Math.min(2.6, -dx * cz + dz * cx));
    this.riding = { r, boat, mode, phase: 'on', t: 0, along, lat, from: { x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: v.sim.yaw } };
    boat.trip = { from: side, to: dest, t: 0, dur: r.f.time, rider: true };
    mode.hud.toast(`${r.f.name}: ${Math.round(r.f.time)} sn`, 2.5);
    // cok oyunculu: ayni gemi diger oyuncularda da kalksin
    if (!remote && this.onBoard) this.onBoard({ r: this.routes.indexOf(r), s: side === r.A ? 'A' : 'B', b: r.boats.indexOf(boat) });
  }

  /** Baska bir oyuncu gemiye bindi: gemi burada da o iskeleden kalkar; guvertedeysem ben de giderim. */
  remoteBoard(d) {
    const r = this.routes[d.r];
    const boat = r && r.boats[d.b];
    if (!boat || (this.riding && this.riding.boat === boat)) return;
    const side = d.s === 'A' ? r.A : r.B, dest = side === r.A ? r.B : r.A;
    const mode = this._mode;
    if (mode && !this.riding && !boat.trip && boat.at === side && boat.X !== undefined) {
      const p = mode.vehicle.position;
      if (this._onDeck(boat, p.x, -p.z)) { this._board(r, side, boat, mode, true); return; }
    }
    boat.at = side;
    this._pose(boat, side.moor.x, side.moor.z, Math.atan2(dest.moor.z - side.moor.z, dest.moor.x - side.moor.x), this.time || 0);
    boat.trip = { from: side, to: dest, t: -1.2, dur: r.f.time };   // binen oyuncunun 1.2 sn binisi
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
    const lin = Math.max(0, Math.min(1, tr.t / tr.dur));
    const k = ease(lin);
    const A = tr.from.moor, B = tr.to.moor;
    const X = A.x + (B.x - A.x) * k, Z = A.z + (B.z - A.z) * k;
    let yaw = Math.atan2(B.z - A.z, B.x - A.x);
    if (r.air) {
      // hava gemisi: yay cizerek tirman/al, kalkista yolculuk yonune don
      if (tr.yaw0 === undefined) tr.yaw0 = b.yaw ?? tr.from.yaw;
      yaw = lerpAngle(tr.yaw0, yaw, ease(Math.min(1, lin / 0.22)));
      // irtifa: A->B profili (araziden en az 25 m yukarida), donuste tersinden
      const u = tr.from === r.A ? k : 1 - k;
      const P = r.prof, f = u * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f));
      b.y = P[i] + (P[i + 1] - P[i]) * (f - i);
    }
    this._pose(b, X, Z, yaw, this.time);
    if (ride) this._carOnDeck(ride, 1);
    if (tr.t >= tr.dur) {
      b.at = tr.to;
      b.trip = null;
      if (r.air) b.y = tr.to.wl + 1.15;
      if (ride) { ride.phase = 'off'; ride.t = 0; ride.dest = tr.to; b.trip = { ...tr, t: tr.dur, dur: tr.dur }; }
      else if (b.at !== b.home && !tr.empty) b.trip = { from: b.at, to: b.home, t: 0, dur: tr.dur * 0.8, empty: true };
    }
  }

  /** Araci guverte ortasina yerlestir (k: 0 = iskelede, 1 = guvertede). */
  _carOnDeck(ride, k) {
    const b = ride.boat, v = ride.mode.vehicle, s = v.sim;
    const cg = v.params.cgHeight + 0.05;
    const cx = Math.cos(b.yaw), cz = Math.sin(b.yaw), al = ride.along || 0, la = ride.lat || 0;
    const tx = b.X + cx * al - cz * la, tz = -(b.Z + cz * al + cx * la), ty = b.y + cg;
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
    // iskelede de dizilim korunur: yan kayma ve iskele boyunca 6..14 m
    const back = 6 + (Math.max(-8, Math.min(8, ride.along || 0)) + 8) * 0.5, la = ride.lat || 0;
    const ex = d.ex - d.ux * back - d.uz * la, ez = d.ez - d.uz * back + d.ux * la;
    const e = ease(k);
    const cx = Math.cos(b.yaw), cz = Math.sin(b.yaw), al = ride.along || 0;
    const sx = b.X + cx * al - cz * la, sz = b.Z + cz * al + cx * la;
    const x = sx + (ex - sx) * e, z = sz + (ez - sz) * e;
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
    ride.mode.hud.toast(ride.r.air ? `${ride.dest.label || 'Varış'}: inildi` : 'Karşı kıyıya varıldı', 2);
  }

  /** Kapi halkalari: zemin yuksekligi yuklenince yerine oturur; doner ve parlar. */
  _portalFx(t) {
    const w = this.app.world;
    for (const g of this.portals) {
      if (!g.placed) {
        const h = w.heightAt(g.x, -g.z);
        if (h === null) { g.grp.visible = false; continue; }
        g.grp.position.set(g.x, h + 4.9, -g.z); g.grp.visible = true; g.placed = true;
      }
      g.ring.rotation.z = t * 0.6;
      g.disc.material.opacity = 0.16 + Math.sin(t * 2.2) * 0.06;
    }
  }

  /** Kapinin icinde yavasken: G ile hedef paneli; secince isinlanir. Donus: panel acik mi. */
  _portal(mode) {
    const v = mode.vehicle, p = v.position, X = p.x, Z = -p.z;
    const input = this.app.input, gp = input.gamepad;
    const here = this.portals.find((g) => Math.abs(X - g.x) < 5 && Math.abs(Z - g.z) < 5.5);
    if (this.panel) {
      if (!here || input.pressed('Escape') || input.pressed('KeyG')) { this._closePanel(); return false; }
      for (let k = 0; k < this.panel.list.length; k++) if (input.pressed(`Digit${k + 1}`)) { this._go(this.panel.list[k], mode); return true; }
      return true;
    }
    if (!here) return false;
    this._promptT -= 1 / 60;
    if (this._promptT <= 0) { this._promptT = 0.5; mode.hud.toast(`G: Işınlanma kapısı (${here.name})`, 0.7); }
    if ((input.pressed('KeyG') || (gp && gp.pressed(1))) && v.sim.speed < 4) this._openPanel(here, mode);
    return false;
  }

  _openPanel(here, mode) {
    const list = this.portals.filter((g) => g !== here);
    const el = document.createElement('div');
    el.className = 'panel dialog interactive';
    el.style.width = '380px';
    el.innerHTML = `<h2>Işınlanma kapısı</h2><div style="color:var(--muted);font-size:13px;margin-bottom:8px">${here.name} kapısından nereye?</div>
      ${list.map((g, k) => `<button class="btn" data-k="${k}" style="margin:4px 0">${k + 1}. ${g.name}</button>`).join('')}
      <div style="color:var(--muted);font-size:12px;margin-top:8px">1–${list.length} ya da tıkla · G/Esc: vazgeç</div>`;
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) this._go(list[Number(b.dataset.k)], mode); });
    this.app.ui.appendChild(el);
    this.panel = { el, list };
    if (this.app.mouseLock && this.app.mouseLock.locked) document.exitPointerLock();
  }

  _closePanel() { if (this.panel) { this.panel.el.remove(); this.panel = null; } }

  _go(g, mode) {
    this._closePanel();
    // hedef kapinin dogu cikisi, doguya bakarak
    const at = { x: g.x + 10, z: -g.z, heading: -Math.PI / 2 };
    if (this.app.game) this.app.game.teleport(g.city, at);
    void mode;
  }

  get panelOpen() { return !!this.panel; }

  dispose() {
    this._closePanel();
    this.app.collision.boxes.length = 0;
    this.app.scene.remove(this.group);
  }
}

function lerpAngle(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

/** Roc kusu (dev kartal): govde, bas, gaga, kuyruk ve kok noktasindan donen iki kanat. Yerel +X ileri. */
function makeRoc(k) {
  const brown = new THREE.MeshStandardMaterial({ color: k ? 0x6a4a2c : 0x5c3f26, roughness: 0.9, flatShading: true });
  const light = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b040, roughness: 0.6, flatShading: true });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), brown); body.scale.set(3.6, 1.5, 1.6); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), light); head.position.set(3.7, 1.0, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 6), gold); beak.rotation.z = -Math.PI / 2.3; beak.position.set(4.8, 0.7, 0); g.add(beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.6, 5), brown); tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.3); tail.position.set(-4.6, 0.2, 0); g.add(tail);
  for (const z of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.8, 5), gold); leg.position.set(0.4, -1.8, z); g.add(leg);
  }
  // kanat: omuzdan disari uzanan, uca dogru daralan yuzey (iki tarafa simetrik)
  const wingGeo = (sgn) => {
    const pts = [[1.6, 0], [-1.8, 0], [-2.4, 4.5], [-1.6, 9], [0.2, 12], [1.4, 8.5], [2.0, 4]];
    const pos = [];
    for (let i = 1; i < pts.length - 1; i++) for (const q of [pts[0], pts[i], pts[i + 1]]) pos.push(q[0], 0, q[1] * sgn);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  };
  const wings = [];
  for (const sgn of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.4, 0.7, sgn * 1.1);
    pivot.add(new THREE.Mesh(wingGeo(sgn), light));
    g.add(pivot);
    wings.push(pivot);
  }
  for (const m of g.children) if (m.isMesh) m.castShadow = true;
  return { group: g, wings, phase: k * 0.9 };
}

/**
 * Hava gemisi irtifa profili (A -> B, gemi guvertesi yuksekligi): uclarda iskele seviyesi, arada
 * gemi genisligince arazinin en az 25 m ustu (uclara dogru payi azalir) ve hafif bir yay;
 * tirmanis/inis yumusatilir.
 */
function airProfile(plan, A, B, N = 80) {
  const y0 = A.wl + 1.15, y1 = B.wl + 1.15;
  const ax = A.moor.x, az = A.moor.z, bx = B.moor.x, bz = B.moor.z;
  const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
  const s = {};
  const req = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const x = ax + (bx - ax) * k, z = az + (bz - az) * k;
    let top = -Infinity;
    for (const o of [-14, 0, 14]) { plan.sample(x + nx * o, z + nz * o, s); top = Math.max(top, s.h); }
    const clear = 25 * Math.min(1, k / 0.12, (1 - k) / 0.12);
    req[i] = Math.max(y0 + (y1 - y0) * k + Math.sin(Math.PI * k) * 15, top + 2 + Math.max(0, clear));
  }
  // ileri/geri egim siniri (Roc kuslari dik tirmanir: adim basina en fazla ~%160) + yumusatma; uclar sabit
  const g = (L / N) * 1.6;
  const y = Float32Array.from(req);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = N - 1; i >= 0; i--) y[i] = Math.max(y[i], y[i + 1] - g);
    for (let i = 1; i <= N; i++) y[i] = Math.max(y[i], y[i - 1] - g);
  }
  for (let pass = 0; pass < 3; pass++) {
    const c = Float32Array.from(y);
    for (let i = 1; i < N; i++) y[i] = Math.max(req[i], (c[i - 1] + c[i] * 2 + c[i + 1]) / 4);
  }
  y[0] = y0; y[N] = y1;
  return y;
}
