import * as THREE from 'three';
import { CharacterMover } from './CharacterMover.js';
import { Entity } from './Population.js';
import { routeStage } from './Economy.js';

// Savas: canavar yapay zekasi (dolasma -> fark etme -> kovalama -> saldiri -> eve donus),
// oyuncu saldirisi, haydut pusulari (yuklu kervan sehir disindayken), ganimet ve tecrube.

const _d = new THREE.Vector3();
const _w = new THREE.Vector3();

const PLAYER_ATTACKS = ['spearAttack1', 'spearAttack2', 'spearAttack3'];
const FIST_ATTACKS = ['punchL', 'punchR', 'hookL'];
const MELEE = 2.6;          // mizrak menzili (m)

function isArcher(def) { return /ARCHER|BOW/.test(def.code); }
function isBandit(def) { return /BANDIT|ROBBER|THIEF/.test(def.code); }

/** Canavar istatistikleri (oyun dengesine olceklenmis). */
export function mobStats(def, ambushLvl = null) {
  const lvl = ambushLvl ?? Math.max(1, def.lvl || 1);
  if (ambushLvl !== null) return { lvl, hp: 70 + 32 * lvl, dmg: [4 + 2.2 * lvl, 7 + 3.0 * lvl], pd: lvl * 2 };
  return { lvl, hp: Math.max(60, Math.round((def.hp || 200) * 0.3)), dmg: [3 + 1.8 * lvl, 6 + 2.6 * lvl], pd: Math.round((def.pd || 0) / 6) };
}

export class Combat {
  constructor(mode) {
    this.mode = mode;
    this.app = mode.app;
    this.ambushes = [];       // pusu haydutlari (Population disinda)
    this.raidT = 90;
    this.cooldown = 0;
    this.comboI = 0;
    this.target = null;
    this.floaters = [];
  }

  /** Population'in canavari icin savas alanlarini hazirla. */
  arm(e, ambushLvl = null) {
    const st = mobStats(e.def, ambushLvl);
    e.lvl = st.lvl; e.maxHp = st.hp; e.hp = st.hp; e.dmg = st.dmg; e.pd = st.pd;
    e.archer = isArcher(e.def);
    e.bandit = isBandit(e.def);
    // yaban canavarlari oyuncudan cok yuksek seviyedeyse saldirilmadikca pasif (yeni tuccar uzak
    // yollardan gecebilsin); haydutlar her zaman kervanin pesinde
    const pl = this.mode.state ? this.mode.state.level : 1;
    e.aggro = e.bandit ? 13 : e.lvl > pl + 8 ? 0 : 8;
    e.atkT = 1 + Math.random();
    e.state = 'idle';
    e.wanderT = 2 + Math.random() * 5;
    e.alive = true;
    e.deadT = 0;
  }

  /** Oyuncunun cevresindeki tum dusmanlar. */
  *enemies() {
    for (const e of this.mode.population.entities.values()) if (e.kind === 'mob' && e.char) yield e;
    for (const e of this.ambushes) if (e.char) yield e;
  }

  nearestEnemy(pos, range = 16) {
    let best = null, bd = range;
    for (const e of this.enemies()) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** Oyuncu saldirisi (Space / tikla). */
  playerAttack() {
    const m = this.mode, s = m.state;
    if (this.cooldown > 0 || m.dead) return;
    let t = this.target && this.target.alive ? this.target : null;
    const p = m.mover.pos;
    if (!t || Math.hypot(t.pos.x - p.x, t.pos.z - p.z) > 16) t = this.nearestEnemy(p, 16);
    this.target = t;
    if (!t) return;
    const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
    m.yaw = Math.atan2(t.pos.x - p.x, t.pos.z - p.z);
    if (d > MELEE + 0.4) { m.autoMove = t; return; }     // yaklas, sonra vur
    const armed = m.player.has('spearAttack1') && m.hasWeapon;
    const list = armed ? PLAYER_ATTACKS : FIST_ATTACKS;
    const anim = list[this.comboI++ % list.length];
    m.player.play(anim, { once: true, then: m.idleKey(true), fade: 0.08, restart: true, timeScale: armed ? 1.15 : 1.25 });
    m.sfxs.play(armed ? (this.comboI % 2 ? 'spearSwing1' : 'spearSwing2') : 'punchSwing', { pos: m.mover.pos, vol: 0.7 });
    if (Math.random() < 0.35) m.sfxs.voice(m.look.endsWith('_w') ? 'w' : 'm', 'shout', m.mover.pos);
    m.attackLock = 0.45;
    this.cooldown = 0.75;
    setTimeout(() => {
      if (!t.alive || m.dead) return;
      if (Math.hypot(t.pos.x - m.mover.pos.x, t.pos.z - m.mover.pos.z) > MELEE + 0.8) return;
      const [a, b] = s.damage;
      let dmg = a + Math.random() * (b - a) - (t.pd || 0) * 0.5;
      const crit = Math.random() < 0.12;
      if (crit) dmg *= 2;
      dmg = Math.max(1, Math.round(dmg));
      m.sfxs.play(crit ? 'crit' : m.hasWeapon ? (Math.random() < 0.5 ? 'spearHit1' : 'spearHit2') : 'punchHit', { pos: t.pos, vol: 0.9 });
      this.damage(t, dmg, crit);
      t.provoked = true;
    }, armed ? 330 : 260);
  }

  damage(e, dmg, crit = false) {
    e.hp -= dmg;
    this.mode.floatText(e.pos, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd36a' : '#ffffff', (e.char.type.height || 1.8) + 0.2);
    if (e.hp <= 0) { this.kill(e); return; }
    if (Math.random() < 0.6) this.mode.sfxs.char(e.def.model, 'hurt', e.pos, { gap: 0.3 });
    if (e.state !== 'attack' || Math.random() < 0.5) e.char.play('hit', { once: true, then: 'idle', fade: 0.06 });
    if (e.state === 'idle' || e.state === 'wander' || e.state === 'home') { e.state = 'chase'; e.target = 'player'; }
  }

  kill(e) {
    const m = this.mode, s = m.state;
    e.alive = false;
    e.state = 'dead';
    e.deadT = 0;
    e.char.play('die', { once: true, fade: 0.08 });
    m.sfxs.char(e.def.model, 'die', e.pos);
    setTimeout(() => m.sfx('coin'), 350);
    const gold = Math.round((e.bandit ? 14 : 7) * e.lvl * (0.8 + Math.random() * 0.5));
    const xp = Math.round((e.ambush ? 30 + e.lvl * 12 : Math.max(8, (e.def.exp || 40) / 3)));
    s.gold += gold;
    s.stats.kills++;
    const up = s.gainXp(xp);
    m.floatText(e.pos, `+${gold} altın`, '#ffd36a', 2.4);
    if (up) { m.toast(`Seviye atladın! Seviye ${s.level}`, 3); m.sfx('level'); }
    if (this.target === e) this.target = null;
    m.saveSoon();
  }

  /** Pusu: yuklu kervan sehir disindayken haydut grubu. */
  _raid(dt) {
    const m = this.mode, s = m.state;
    if (m.inCity || s.load === 0 || !m.caravan) { this.raidT = Math.max(this.raidT, 40); return; }
    this.raidT -= dt;
    if (this.raidT > 0 || this.ambushes.some((e) => e.alive)) return;
    this.raidT = 70 + Math.random() * 80;
    const stage = Math.max(1, routeStage(m.lastCity, m.nearCity) || 1);
    const lvl = Math.max(1, s.level + stage - 1);
    const n = 2 + (Math.random() < 0.5 ? 1 : 0) + (stage >= 3 ? 1 : 0);
    const def = m.data.chars[m.data.byCode.get(stage >= 2 ? 'MOB_OA_BLACKROBBER' : 'MOB_CH_BANDIT')];
    const defA = m.data.chars[m.data.byCode.get(stage >= 2 ? 'MOB_OA_BLACKROBBERARCHER' : 'MOB_CH_BANDITARCHER')];
    if (!def) return;
    const base = Math.random() * Math.PI * 2;
    m.toast('Haydutlar! Kervanını koru!', 3);
    m.sfx('alarm');
    for (let i = 0; i < n; i++) {
      const a = base + (i - n / 2) * 0.35;
      const r = 32 + Math.random() * 8;
      const x = m.mover.pos.x + Math.sin(a) * r, z = m.mover.pos.z + Math.cos(a) * r;
      this._spawnAmbush(i === n - 1 && defA ? defA : def, x, z, lvl);
    }
  }

  async _spawnAmbush(def, x, z, lvl) {
    const m = this.mode;
    const char = await m.lib.create(def.model).catch(() => null);
    if (!char) return;
    const e = new Entity(def, `ambush_${Math.random()}`, new THREE.Vector3(x, m.mover.pos.y, z));
    e.char = char;
    e.kind = 'mob';
    e.ambush = true;
    e.mover = new CharacterMover(this.app, { radius: 0.4, spheres: [0.6] });
    e.mover.place(x, z, m.mover.pos.y);
    e.pos = e.mover.pos;
    this.arm(e, lvl);
    e.aggro = 80;
    e.state = 'chase';
    e.target = 'caravan';
    char.root.position.copy(e.pos);
    m.population.group.add(char.root);
    char.play('run');
    this.ambushes.push(e);
  }

  update(dt) {
    const m = this.mode, s = m.state;
    this.cooldown -= dt;
    this._raid(dt);
    const pp = m.mover.pos;
    const cv = m.caravan && m.caravan.ready && m.caravan.alive ? m.caravan : null;
    for (const e of this.enemies()) {
      if (e.lvl === undefined) this.arm(e);
      if (!e.mover) continue;
      if (!e.alive) {
        e.deadT += dt;
        e.char.update(0);
        if (e.deadT > 9) {
          if (e.ambush) { e.char.dispose(); this.ambushes.splice(this.ambushes.indexOf(e), 1); }
          else if (e.deadT > 45) { this.arm(e); e.mover.place(e.home.x, e.home.z, e.home.y); e.char.play('idle'); }
          else e.char.root.visible = false;
        }
        if (e.alive) e.char.root.visible = true;
        continue;
      }
      const dP = Math.hypot(pp.x - e.pos.x, pp.z - e.pos.z);
      const dC = cv ? Math.hypot(cv.pos.x - e.pos.x, cv.pos.z - e.pos.z) : Infinity;
      const dHome = Math.hypot(e.home.x - e.pos.x, e.home.z - e.pos.z);
      // durum gecisleri
      if (e.state === 'idle' || e.state === 'wander') {
        if (!m.dead && (dP < e.aggro || (e.bandit && dC < e.aggro))) {
          e.state = 'chase'; e.target = dC < dP ? 'caravan' : 'player';
          m.sfxs.char(e.def.model, 'shout', e.pos, { gap: 1 });
        }
      } else if (e.state === 'chase' || e.state === 'attack') {
        if (!e.ambush && dHome > 38 && !e.provoked) e.state = 'home';
        if (m.dead) e.state = e.ambush ? 'flee' : 'home';
        if (e.target === 'caravan' && !cv) e.target = 'player';
        if (e.target === 'player' && e.bandit && cv && dC < dP - 4) e.target = 'caravan';
        if (e.provoked && e.target === 'caravan' && dP < 6) e.target = 'player';
      }
      const tgt = e.target === 'caravan' && cv ? cv.pos : pp;
      const dT = e.target === 'caravan' && cv ? dC : dP;
      const range = e.archer ? 12 : MELEE + (e.target === 'caravan' ? 0.8 : 0);
      _w.set(0, 0, 0);
      let speed = 0;
      if (e.state === 'wander' || e.state === 'idle') {
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.wanderT = 3 + Math.random() * 6;
          if (e.state === 'idle' && Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 8;
            e.goal = new THREE.Vector3(e.home.x + Math.sin(a) * r, 0, e.home.z + Math.cos(a) * r);
            e.state = 'wander';
          } else e.state = 'idle';
        }
        if (e.state === 'wander' && e.goal) {
          _d.set(e.goal.x - e.pos.x, 0, e.goal.z - e.pos.z);
          if (_d.length() < 0.6) e.state = 'idle';
          else { speed = 1.3; _w.copy(_d).setLength(speed); }
        }
      } else if (e.state === 'chase' || e.state === 'attack') {
        _d.set(tgt.x - e.pos.x, 0, tgt.z - e.pos.z);
        if (dT > range) { e.state = 'chase'; speed = e.ambush ? 4.6 : 4.2; _w.copy(_d).setLength(speed); }
        else {
          e.state = 'attack';
          e.atkT -= dt;
          if (e.atkT <= 0) {
            e.atkT = (e.archer ? 2.3 : 1.8) + Math.random() * 0.6;
            const key = e.char.has('attack2') && Math.random() < 0.4 ? 'attack2' : 'attack1';
            e.char.play(key, { once: true, then: 'idle', fade: 0.08, restart: true });
            m.sfxs.play(e.archer ? 'bowShot' : 'swordSwing', { pos: e.pos, vol: 0.6 });
            if (Math.random() < 0.3) m.sfxs.char(e.def.model, 'shout', e.pos, { gap: 1.5 });
            const target = e.target;
            setTimeout(() => this._mobHit(e, target), e.archer ? 520 : 380);
          }
        }
        e.yaw = Math.atan2(_d.x, _d.z);
      } else if (e.state === 'home' || e.state === 'flee') {
        _d.set(e.home.x - e.pos.x, 0, e.home.z - e.pos.z);
        if (e.state === 'flee') _d.set(e.pos.x - pp.x, 0, e.pos.z - pp.z);
        if (e.state === 'home' && _d.length() < 1.5) { e.state = 'idle'; e.hp = e.maxHp; e.provoked = false; }
        else { speed = 4.6; _w.copy(_d).setLength(speed); }
        if (e.state === 'flee' && dP > 60) { e.alive = false; e.deadT = 100; e.char.root.visible = false; }
      }
      if (speed > 0) e.yaw = Math.atan2(_w.x, _w.z);
      if (dP < 150) e.mover.move(dt, _w, { accel: 14 });
      e.char.root.position.copy(e.mover.pos);
      e.char.root.rotation.y = e.yaw;
      const v = Math.hypot(e.mover.vel.x, e.mover.vel.z);
      const busy = e.char.currentKey && /attack|hit/.test(e.char.currentKey) && e.char.current && e.char.current.isRunning();
      if (!busy) {
        if (v > 2.5) e.char.play('run', { timeScale: Math.max(0.7, v / 4.5) });
        else if (v > 0.3) e.char.play('walk');
        else e.char.play('idle');
      }
      if (e.ambush) e.char.update(dt);
    }
    if (this.target && !this.target.alive) this.target = null;
  }

  _mobHit(e, target) {
    const m = this.mode, s = m.state;
    if (!e.alive || m.dead) return;
    const dmg = Math.round(e.dmg[0] + Math.random() * (e.dmg[1] - e.dmg[0]));
    if (target === 'caravan' && m.caravan && m.caravan.alive) {
      if (Math.hypot(m.caravan.pos.x - e.pos.x, m.caravan.pos.z - e.pos.z) > (e.archer ? 14 : 3.6)) return;
      s.transportHp = Math.max(0, s.transportHp - dmg);
      m.caravan.hit();
      m.sfxs.play('punchHit', { pos: m.caravan.pos, vol: 0.7 });
      if (Math.random() < 0.5) m.sfxs.char(m.caravan.t.model, 'hurt', m.caravan.pos, { gap: 0.8 });
      m.floatText(m.caravan.pos, `${dmg}`, '#ff9b6a', 2.6);
      if (s.transportHp <= 0) m.caravanDown();
    } else {
      if (Math.hypot(m.mover.pos.x - e.pos.x, m.mover.pos.z - e.pos.z) > (e.archer ? 14 : MELEE + 1)) return;
      const d = Math.max(1, Math.round(dmg - s.defense * 0.6));
      s.hp = Math.max(0, s.hp - d);
      m.floatText(m.mover.pos, `-${d}`, '#ff6a5a', 2.1);
      m.sfxs.play(e.archer ? 'spearHit3' : 'spearHit1', { pos: m.mover.pos, vol: 0.8 });
      if (Math.random() < 0.5) m.sfxs.voice(m.look.endsWith('_w') ? 'w' : 'm', 'hurt', m.mover.pos);
      m.camera.shake = Math.min(1, m.camera.shake + 0.35);
      if (!m.attackLock) m.player.play('hit', { once: true, then: m.idleKey(true), fade: 0.06, restart: true });
      if (s.hp <= 0) m.playerDown();
    }
  }

  /** Haydutlar kervani dusurunce: yuk calindi, kacarlar. */
  scatter() {
    for (const e of this.ambushes) if (e.alive) { e.state = 'flee'; e.target = null; }
  }

  dispose() {
    for (const e of this.ambushes) e.char.dispose();
    this.ambushes = [];
  }
}
