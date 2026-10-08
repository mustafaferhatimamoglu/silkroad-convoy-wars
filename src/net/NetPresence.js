import * as THREE from 'three';
import { Vehicle } from '../vehicle/Vehicle.js';
import { VehicleEffects } from '../vehicle/effects/VehicleEffects.js';
import { RemoteCar, encodeState, SNAP_MS } from './RemoteCar.js';
import { collideCars } from '../vehicle/physics/CarContacts.js';
import { PAINTS } from '../vehicle/model/KartalModel.js';

// Cok oyunculu serbest gezinti: odadaki diger oyuncularin araclari ayni acik dunyada.
// Her oyuncu kendi aracini simule eder ve 20 Hz durum yayinlar; digerleri RemoteCar ile ara
// degerlenmis gorunur. Arac bilgisi (surum, renk) 'car' mesajiyla duyurulur: yeni gelen herkese
// duyurur, digerleri ona kendi bilgisini dogrudan yollar. Carpisma tek tarafli: yerel arac uzak
// aracin govdesinden itilir (uzak oyuncu kendi makinesinde ayni carpismayi yasar).
// Feribot: biri gemiye binince diger oyuncularda ayni gemi ayni anda kalkar ('ferry').

const IDLE_STATE = () => ({ gate: 0, progress: 0, lat: 0, idx: 0, finished: false, time: null, dnf: false });

export class NetPresence {
  constructor(mode, net) {
    this.mode = mode;
    this.app = mode.app;
    this.net = net;
    this.others = new Map();
    this._sendT = 0;
    this.me = { id: net.id, state: IDLE_STATE(), get vehicle() { return mode.vehicle; } };
    this._subs = [
      net.on('r:car', (d, from) => this._onCar(d, from)),
      net.on('r:st', (d) => { const o = this.others.get(d.id); if (o) o.remote.push(d); else this._ask(d.id); }),
      net.on('r:dmg', (d) => this._onDamage(d)),
      net.on('r:ferry', (d) => { if (mode.transport) mode.transport.remoteBoard(d); }),
      net.on('left', (m) => this._remove(m.id, true)),
      net.on('room', () => { const ids = new Set(net.members.map((x) => x.id)); for (const id of [...this.others.keys()]) if (!ids.has(id)) this._remove(id, true); }),
      net.on('close', () => mode.hud.toast('Sunucu bağlantısı koptu', 4)),
    ];
    if (mode.transport) mode.transport.onBoard = (d) => net.relay({ t: 'ferry', ...d });
    this.announce();
  }

  /** Kendi aracimi duyur (to: herkes ya da tek oyuncu). */
  announce(to = 'all') {
    const s = this.app.settings, v = this.mode.vehicle;
    this.net.relay({ t: 'car', name: this.net.name, variant: v.variant, paint: v.paint || s.get('vehicleColor'), prep: v.prep || s.get('vehiclePrep'), reply: to === 'all' }, to);
  }

  /** Bilinmeyen oyuncudan durum geldi: arac bilgisini iste (bir kez / 2 sn). */
  _ask(id) {
    const now = performance.now();
    this._askT = this._askT || {};
    if (this._askT[id] && now - this._askT[id] < 2000) return;
    this._askT[id] = now;
    this.net.relay({ t: 'car', name: this.net.name, variant: this.mode.vehicle.variant, paint: this.mode.vehicle.paint, prep: this.mode.vehicle.prep, reply: true }, id);
  }

  _onCar(d, from) {
    if (from === this.net.id) return;
    const o = this.others.get(from);
    if (!o || o.variant !== d.variant || o.paint !== d.paint || o.prep !== d.prep) {
      if (o) this._remove(from, false);
      this._add(from, d);
    } else if (o.name !== d.name) { o.name = d.name; this._relabel(o); }
    if (d.reply) this.announce(from);
  }

  _add(id, d) {
    const app = this.app;
    const veh = new Vehicle(app, { variant: d.variant, paint: d.paint, prep: d.prep, reflections: false });
    veh.shareReflections(this.mode.vehicle);
    veh.headlights = this.mode.vehicle.headlights;
    const color = PAINTS[d.paint] ? PAINTS[d.paint].color : '#7fd0ff';
    const o = { id, name: d.name || `Oyuncu ${id}`, variant: d.variant, paint: d.paint, prep: d.prep, color, vehicle: veh, remote: new RemoteCar(veh), state: IDLE_STATE(), effects: new VehicleEffects(app, veh), visible: false };
    o.sim = veh.sim;
    veh.root.visible = false; veh.shadow.visible = false;
    this._relabel(o);
    this.others.set(id, o);
    this.mode.hud.toast(`${o.name} dünyada`, 2);
  }

  _relabel(o) {
    if (o.label) { o.vehicle.root.remove(o.label); o.label.material.map.dispose(); o.label.material.dispose(); }
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(o.name, 128, 34);
    g.fillStyle = '#fff'; g.fillText(o.name, 128, 34);
    g.fillStyle = o.color; g.fillRect(40, 56, 176, 5);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }));
    sp.scale.set(0.15, 0.0375, 1);
    sp.position.set(0, 2.5, 0);
    sp.renderOrder = 5;
    o.label = sp;
    o.vehicle.root.add(sp);
  }

  _remove(id, toast) {
    const o = this.others.get(id);
    if (!o) return;
    this.others.delete(id);
    const refl = this.mode.vehicle.reflections;
    if (refl) { const ms = new Set(o.vehicle.model.reflectiveMaterials()); refl.materials = refl.materials.filter((m) => !ms.has(m)); }
    if (o.label) { o.label.material.map.dispose(); o.label.material.dispose(); }
    o.effects.dispose();
    o.vehicle.dispose();
    if (toast) this.mode.hud.toast(`${o.name} ayrıldı`, 2);
  }

  _onDamage(d) {
    const o = this.others.get(d.id);
    if (!o) return;
    o.vehicle.applyImpacts(d.list.map((x) => ({ speed: x.s, point: { x: x.p[0], y: x.p[1], z: x.p[2] }, normal: { x: x.n[0], y: x.n[1], z: x.n[2] }, object: true })));
  }

  /** Yerel carpisma izlerini digerlerine bildir (uzak goruntude gocuk). */
  sendDamage(list) {
    if (!list || !list.length) return;
    const now = performance.now();
    if (this._dmgT && now - this._dmgT < 120) return;
    const out = list.filter((im) => im.speed > 4).slice(0, 3).map((im) => ({ s: +im.speed.toFixed(1), p: [+im.point.x.toFixed(2), +im.point.y.toFixed(2), +im.point.z.toFixed(2)], n: [+im.normal.x.toFixed(2), +im.normal.y.toFixed(2), +im.normal.z.toFixed(2)] }));
    if (!out.length) return;
    this._dmgT = now;
    this.net.relay({ t: 'dmg', id: this.net.id, list: out });
  }

  /** Kare basinda: uzak araclari ara degerle, kendi durumumu yayinla. */
  update(dt) {
    const net = this.net;
    if (!net.connected) return;
    const now = net.serverNow();
    for (const o of this.others.values()) {
      const fresh = o.remote.buf.length && performance.now() - o.remote.lastRecv < 5000;
      if (fresh !== o.visible) { o.visible = !!fresh; o.vehicle.root.visible = o.visible; o.vehicle.shadow.visible = o.visible; }
      if (!o.visible) continue;
      o.remote.apply(now, o);
      o.effects.update(dt);
    }
    this._sendT += dt * 1000;
    if (this._sendT >= SNAP_MS) {
      this._sendT = 0;
      this.me.id = net.id;
      net.relay(encodeState(this.me, now));
    }
  }

  /** Her fizik adiminda: yakindaki uzak araclarla carpisma (yerel arac itilir). */
  step(h) {
    if (!this.others.size) return;
    const my = this.mode.vehicle.sim, p = my.body.pos;
    for (const o of this.others.values()) {
      if (!o.visible) continue;
      const b = o.sim.body;
      b.pos.addScaled(b.vel, h);
      if (Math.abs(b.pos.x - p.x) > 12 || Math.abs(b.pos.z - p.z) > 12) continue;
      collideCars(my, o.sim, { oneSided: true });
    }
  }

  /** Buyuk harita icin diger oyuncular. */
  mapList() {
    const out = [];
    for (const o of this.others.values()) if (o.visible) out.push({ x: o.sim.body.pos.x, z: -o.sim.body.pos.z, name: o.name, color: o.color });
    return out;
  }

  dispose() {
    for (const u of this._subs) u();
    this._subs = [];
    if (this.mode.transport) this.mode.transport.onBoard = null;
    for (const id of [...this.others.keys()]) this._remove(id, false);
  }
}
