import * as THREE from 'three';
import { makeHit } from '../world/Collision.js';
import { CharacterMover } from './CharacterMover.js';
import { MOB_TR } from './MobNames.js';

// Dunya nufusu: oyuncunun cevresindeki bolgelerde NPC ve canavarlari orijinal Silkroad
// dogma noktalarinda (npcpos) kurar, uzaklasinca kaldirir.
//  - NPC'ler arkalarindaki duvara sirtini verecek yone bakar (cevreye isin atilarak)
//  - yakindaki NPC'lerin ustunde Turkce adlari gorunur
//  - canavarlar evlerinin cevresinde dolasir (savas davranisi Combat'ta)
//  - uzaktaki karakterlerin animasyonu seyrek guncellenir

const NPC_RADIUS = 140, MOB_RADIUS = 120, KEEP = 1.18;
const LABEL_DIST = 24;
const ROLE_COLORS = {
  special: '#ffd36a', stable: '#e7b37a', potion: '#9fe08a', smith: '#c9c9c9', armor: '#c9c9c9', accessory: '#e6a8ff',
  warehouse: '#b9d2ff', guard: '#ff9b8a', merchant: '#ffe3a6', smuggler: '#ffb070', traderGuild: '#ffd36a',
  hunterGuild: '#8fd0ff', mob: '#ff6a5a', npc: '#f2e9d8',
};
const ROLE_TITLES = {
  special: 'Özel Ürün Tüccarı', stable: 'Ahır', potion: 'Şifacı', smith: 'Demirci', armor: 'Zırhçı', accessory: 'Mücevherci',
  warehouse: 'Ambar', guard: 'Asker', merchant: 'Tüccar', smuggler: 'Kaçakçı', traderGuild: 'Tüccar Loncası', hunterGuild: 'Avcı Loncası',
};

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();

function labelSprite(text, sub, color) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = 'bold 30px "Segoe UI", Arial, sans-serif', font2 = '22px "Segoe UI", Arial, sans-serif';
  ctx.font = font;
  const w = Math.ceil(Math.max(ctx.measureText(text).width, sub ? (ctx.font = font2, ctx.measureText(sub).width) : 0)) + 24;
  c.width = w; c.height = sub ? 70 : 42;
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = color;
  ctx.strokeText(text, w / 2, 4); ctx.fillText(text, w / 2, 4);
  if (sub) { ctx.font = font2; ctx.fillStyle = 'rgba(240,230,210,0.9)'; ctx.strokeText(sub, w / 2, 40); ctx.fillText(sub, w / 2, 40); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(mat);
  const hgt = sub ? 0.5 : 0.3;
  s.scale.set((hgt * c.width) / c.height, hgt, 1);
  s.renderOrder = 10;
  return s;
}

export class Entity {
  constructor(def, key, home) {
    this.def = def;
    this.key = key;
    this.home = home.clone();
    this.pos = home.clone();
    this.yaw = 0;
    this.char = null;
    this.kind = def.role === 'mob' ? 'mob' : 'npc';
    this.hp = def.hp || 100;
    this.maxHp = this.hp;
    this.alive = true;
    this.state = 'idle';
    this.t = Math.random() * 4;
    this.target = null;
    this.mover = null;
    this.label = null;
    this.animSkip = 0;
  }

  get name() {
    if (this.kind === 'mob') return MOB_TR[this.def.en] || this.def.en || this.def.code;
    return this.def.name || this.def.en || this.def.code;
  }
}

export class Population {
  constructor(app, data, lib) {
    this.app = app;
    this.data = data;
    this.lib = lib;
    this.group = new THREE.Group();
    this.group.name = 'population';
    app.scene.add(this.group);
    this.entities = new Map();   // anahtar -> Entity
    this.pending = new Set();
    this.scanT = 0;
    this.hit = makeHit();
    this.frame = 0;
    this.enabledMobs = true;
    this.onSpawn = null;         // (entity) => void
    this.onRemove = null;
  }

  /** Bir bolgenin dogma noktalarini (yakinda olanlari) iste. */
  _wanted(focus) {
    const { world } = this.app;
    const out = [];
    const c = world.fromThree(focus.x, focus.z);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const rx = c.rx + dx, rz = c.rz + dz;
      const list = this.data.spawnsIn(rx, rz);
      for (let i = 0; i < list.length; i++) {
        const [di, x, y, z] = list[i];
        const def = this.data.def(di);
        if (!def || !def.model) continue;
        if (def.role === 'mob' && !this.enabledMobs) continue;
        world.toThree(rx, rz, x, y, z, _v);
        const d = Math.hypot(_v.x - focus.x, _v.z - focus.z);
        out.push({ key: `${rz}_${rx}_${i}`, def, x: _v.x, y: _v.y, z: _v.z, d });
      }
    }
    return out;
  }

  update(dt, focus) {
    this.frame++;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.6;
      const wanted = this._wanted(focus);
      const keep = new Set();
      for (const w of wanted) {
        const r = w.def.role === 'mob' ? MOB_RADIUS : NPC_RADIUS;
        if (w.d < r * KEEP) keep.add(w.key);
        if (w.d < r && !this.entities.has(w.key) && !this.pending.has(w.key)) this._spawn(w);
      }
      for (const [k, e] of this.entities) if (!keep.has(k) && !e.persistent) this._remove(k);
    }
    // animasyon ve etiketler
    const cam = this.app.camera.position;
    for (const e of this.entities.values()) {
      if (!e.char) continue;
      const d = Math.hypot(e.pos.x - focus.x, e.pos.z - focus.z);
      const skip = d < 45 ? 1 : d < 90 ? 3 : 6;
      e.animSkip += dt;
      if (this.frame % skip === 0) { e.char.update(e.animSkip); e.animSkip = 0; }
      if (e.kind === 'npc') {
        const show = cam.distanceTo(e.pos) < LABEL_DIST;
        if (show && !e.label) {
          const sub = ROLE_TITLES[e.def.role] ? null : null;
          e.label = labelSprite(e.name, sub, ROLE_COLORS[e.def.role] || ROLE_COLORS.npc);
          e.label.position.set(0, (e.char.type.height || 1.8) + 0.35, 0);
          e.char.root.add(e.label);
        }
        if (e.label) e.label.visible = show;
      }
    }
  }

  async _spawn(w) {
    this.pending.add(w.key);
    try {
      const char = await this.lib.create(w.def.model);
      if (!this.pending.has(w.key)) { char.dispose(); return; }   // bu arada uzaklasildi
      const e = new Entity(w.def, w.key, new THREE.Vector3(w.x, w.y, w.z));
      e.char = char;
      // zemine oturt (objeler henuz yuklenmediyse bolge yuklenince tekrar)
      this._ground(e);
      e.yaw = e.kind === 'npc' ? this._faceOpen(e) : Math.random() * Math.PI * 2;
      char.root.position.copy(e.pos);
      char.root.rotation.y = e.yaw;
      char.play('idle');
      if (char.current) char.current.time = Math.random() * char.current.getClip().duration;
      if (e.kind === 'mob') {
        e.mover = new CharacterMover(this.app, { radius: 0.4, spheres: [0.6] });
        e.mover.pos.copy(e.pos);
        e.mover.onGround = true;
        e.pos = e.mover.pos;          // konum hareket denetleyicisiyle ortak
      }
      this.group.add(char.root);
      this.entities.set(w.key, e);
      if (this.onSpawn) this.onSpawn(e);
    } catch (err) {
      console.warn('nufus: model yuklenemedi', w.def.model, err);
    } finally {
      this.pending.delete(w.key);
    }
  }

  _remove(k) {
    const e = this.entities.get(k);
    this.pending.delete(k);
    if (!e) return;
    if (this.onRemove) this.onRemove(e);
    if (e.label) { e.label.material.map.dispose(); e.label.material.dispose(); }
    e.char.dispose();
    this.entities.delete(k);
  }

  _ground(e) {
    const { collision, world } = this.app;
    const from = Math.max(e.pos.y, world.heightAt(e.pos.x, e.pos.z) ?? e.pos.y) + 1.6;
    if (collision.raycast(_v.set(e.pos.x, from, e.pos.z), _dir.set(0, -1, 0), 12, this.hit)) e.pos.y = this.hit.point.y;
    e.home.y = e.pos.y;
  }

  /** NPC'nin bakacagi yon: 16 yonde gogus hizasinda en uzak bosluk; kisa bosluklar elenir. */
  _faceOpen(e) {
    const { collision } = this.app;
    let best = -1, bestYaw = 0;
    const o = new THREE.Vector3(e.pos.x, e.pos.y + 1.1, e.pos.z);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      _dir.set(Math.sin(a), 0, Math.cos(a));
      const d = collision.raycast(o, _dir, 9, this.hit, { terrain: false }) ? this.hit.distance : 9;
      // sirtin duvarda olmasi da iyi: karsi yonde yakin duvar varsa bonus
      _dir.negate();
      const back = collision.raycast(o, _dir, 4, this.hit, { terrain: false }) ? this.hit.distance : 4;
      const score = d + (4 - back) * 0.6;
      if (score > best) { best = score; bestYaw = a; }
    }
    return bestYaw;
  }

  /** Oyuncuya en yakin, etkilesilebilir NPC (menzil ve on taraf). */
  nearestNpc(pos, range = 3.2) {
    let best = null, bd = range;
    for (const e of this.entities.values()) {
      if (e.kind !== 'npc' || !e.char) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < bd && Math.abs(e.pos.y - pos.y) < 2.5) { bd = d; best = e; }
    }
    return best;
  }

  dispose() {
    for (const k of [...this.entities.keys()]) this._remove(k);
    this.group.removeFromParent();
  }
}
