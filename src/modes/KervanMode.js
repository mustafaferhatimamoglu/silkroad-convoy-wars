import * as THREE from 'three';
import { CharacterLibrary } from '../chars/CharacterLibrary.js';
import { CharacterMover } from '../rpg/CharacterMover.js';
import { OrbitCamera } from '../rpg/OrbitCamera.js';
import { Population } from '../rpg/Population.js';
import { GameData } from '../rpg/GameData.js';
import { Caravan } from '../rpg/Caravan.js';
import { Combat } from '../rpg/Combat.js';
import { TraderState } from '../rpg/TraderState.js';
import { TRANSPORTS } from '../rpg/Economy.js';
import { KervanUI } from '../ui/KervanUI.js';
import { Minimap } from '../ui/Minimap.js';
import { ROUTE } from '../rpg/Economy.js';
import { cityById, CITIES } from '../data/cities.js';
import { musicForRegion } from '../core/AudioSystem.js';

// Kervan RPG: Silkroad dunyasinda yaya tuccar. Sehirlerde NPC'lerle konusur, mal alir-satar,
// kervaniyla sehirden sehre gider, yolda haydutlarla savasir.

const RUN = 5.0, WALK = 1.6;          // m/s (Silkroad: kosu 50, yuruyus 16 birim/sn)
const CITY_RADIUS = 230;              // m: bu mesafe icinde "sehirde" sayilir (pusu yok)
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _w = new THREE.Vector3();
const _v = new THREE.Vector3();

export class KervanMode {
  constructor(app, { city = 'jangan', look = 'player_ch_m', onPause = null, fresh = false } = {}) {
    this.app = app;
    this.cityId = city;
    this.look = look;
    this.onPause = onPause;
    this.fresh = fresh;
    this.focus = new THREE.Vector3();
    this.paused = false;
    this.ready = false;
    this.walk = false;
    this.yaw = 0;
    this.attackLock = 0;
    this.autoMove = null;
    this.dead = false;
    this.inCity = true;
    this.floaters = [];
    // dunya akisi enter() bitmeden de dogru yerde kalsin
    const c = cityById(city);
    app.world.toThree(c.rx, c.rz, c.lx, 0, c.lz, this.focus);
  }

  async enter() {
    const app = this.app;
    this.lib = app.chars || (app.chars = new CharacterLibrary());
    this.data = app.gameData || (app.gameData = await new GameData().load());
    this.state = this.fresh ? new TraderState() : new TraderState().restore();
    this.state.city = this.cityId;
    this.lastCity = this.cityId;
    this.nearCity = this.cityId;
    const city = cityById(this.cityId);
    const p = app.world.toThree(city.rx, city.rz, city.lx, 0, city.lz, new THREE.Vector3());
    this.mover = new CharacterMover(app);
    this.mover.place(p.x, p.z);
    this.focus.copy(this.mover.pos);
    this.player = await this.lib.create(this.look);
    this.player.root.position.copy(this.mover.pos);
    // sehir yonu (arac kurali: ileri = -sin/-cos) -> model donusu (ileri = +z) icin +pi
    this.yaw = (city.heading || 0) + Math.PI;
    this.player.root.rotation.y = this.yaw;
    app.scene.add(this.player.root);
    this.player.play('idle');
    this.camera = new OrbitCamera(app, { yaw: city.heading || 0, dist: 6.5 });
    this.population = new Population(app, this.data, this.lib);
    this.combat = new Combat(this);
    this.population.onRemove = (e) => { if (this.combat.target === e) this.combat.target = null; };
    this._buildHud();
    this.ui = new KervanUI(app.ui, this);
    this.minimap = new Minimap(app, this.hud);
    this.dest = this._defaultDest(this.cityId);
    if (this.state.transport !== 'none') await this._spawnCaravan();
    this._musicT = 0;
    this.ready = true;
    this.toast(`${city.name} — ${this.state.stats.trips ? 'kervanın seni bekliyor' : 'Özel Ürün Tüccarı\'ndan mal al, başka şehirde sat'}`, 4);
  }

  _buildHud() {
    const el = document.createElement('div');
    el.id = 'kervanHud';
    el.innerHTML = `
      <div class="zone"><b></b><span></span><i class="dest"></i></div>
      <div class="prompt hidden"></div>
      <div class="toast hidden"></div>
      <div class="help"><kbd>WASD</kbd> hareket · <kbd>Shift</kbd> yürü · <kbd>E</kbd> konuş · <kbd>Boşluk</kbd> saldır · <kbd>Tab</kbd> hedef · <kbd>Q</kbd> iksir · sağ fare: kamera · <kbd>Esc</kbd> menü</div>`;
    this.app.ui.appendChild(el);
    this.hud = el;
    this.hudZone = el.querySelector('.zone b');
    this.hudSub = el.querySelector('.zone span');
    this.hudPrompt = el.querySelector('.prompt');
    this.hudToast = el.querySelector('.toast');
    this.hudDest = el.querySelector('.zone .dest');
  }

  /** Varsayilan hedef: guzergahta bir sonraki sehir (sonda geri doner). */
  _defaultDest(city) {
    const i = ROUTE.indexOf(city);
    return ROUTE[i + 1] || ROUTE[i - 1] || 'donwhang';
  }

  _cycleDest() {
    const opts = ROUTE.filter((c) => c !== this.nearCity);
    const i = opts.indexOf(this.dest);
    this.dest = opts[(i + 1) % opts.length];
    this.toast(`Hedef: ${cityById(this.dest).name}`, 1.5);
  }

  _drawMap() {
    const marks = [];
    const col = { special: '#ffd36a', stable: '#e7b37a', potion: '#9fe08a', smith: '#d0d0d0', armor: '#d0d0d0', traderGuild: '#ffd36a' };
    for (const e of this.population.entities.values()) {
      if (e.kind === 'npc') { if (col[e.def.role]) marks.push({ x: e.pos.x, z: e.pos.z, color: col[e.def.role], r: 5 }); }
      else if (e.alive) marks.push({ x: e.pos.x, z: e.pos.z, color: '#ff5a4a', r: 3.5 });
    }
    for (const e of this.combat.ambushes) if (e.alive) marks.push({ x: e.pos.x, z: e.pos.z, color: '#ff2a1a', r: 5 });
    if (this.caravan) marks.push({ x: this.caravan.pos.x, z: this.caravan.pos.z, color: '#7fe36a', r: 6 });
    const dc = cityById(this.dest);
    const t = this.app.world.toThree(dc.rx, dc.rz, dc.lx, 0, dc.lz, _v);
    this.minimap.draw(this.mover.pos, this.camera.yaw, marks, { x: t.x, z: t.z });
    const km = Math.hypot(t.x - this.mover.pos.x, t.z - this.mover.pos.z) / 1000;
    this.hudDest.textContent = `Hedef: ${dc.name} · ${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'} (H: değiştir)`;
  }

  toast(text, secs = 2) {
    if (!this.hudToast) return;
    this.hudToast.textContent = text;
    this.hudToast.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.hudToast.classList.add('hidden'), secs * 1000);
  }

  sfx() { /* ses efektleri: sonraki adim (prim/snd) */ }

  saveSoon() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.state.save(), 800);
  }

  /** Dunyada yukselip kaybolan yazi (hasar, altin). */
  floatText(pos, text, color, up = 2) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(text, 128, 32);
    ctx.fillStyle = color; ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(1.6, 0.4, 1);
    s.position.set(pos.x + (Math.random() - 0.5) * 0.4, pos.y + up, pos.z + (Math.random() - 0.5) * 0.4);
    s.renderOrder = 20;
    this.app.scene.add(s);
    this.floaters.push({ s, t: 0 });
  }

  _updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.s.position.y += dt * 0.9;
      f.s.material.opacity = Math.max(0, 1 - f.t / 1.3);
      if (f.t > 1.3) { f.s.removeFromParent(); f.s.material.map.dispose(); f.s.material.dispose(); this.floaters.splice(i, 1); }
    }
  }

  _nearestCity() {
    const c = this.app.world.fromThree(this.mover.pos.x, this.mover.pos.z);
    let best = null, bd = Infinity;
    for (const ct of CITIES) {
      const d = Math.hypot(ct.rx + ct.lx / 1920 - (c.rx + c.lx / 1920), ct.rz + ct.lz / 1920 - (c.rz + c.lz / 1920)) * 192;
      if (d < bd) { bd = d; best = ct; }
    }
    return { city: best, dist: bd, region: c };
  }

  async _spawnCaravan() {
    if (this.caravan) { this.caravan.dispose(); this.caravan = null; }
    const s = this.state;
    if (s.transport === 'none') return;
    if (!s.transportHp) s.transportHp = TRANSPORTS[s.transport].hp;
    const cv = new Caravan(this.app, this.lib, s.transport);
    const p = this.mover.pos;
    await cv.spawn(new THREE.Vector3(p.x - Math.sin(this.yaw) * 3, p.y, p.z - Math.cos(this.yaw) * 3), this.yaw);
    this.caravan = cv;
  }

  // ---------------------------------------------------------------- NPC'ler
  openNpc(npc) {
    const s = this.state, city = this.nearCity;
    const say = (msg, big) => { this.toast(msg, big ? 4 : 2); this.saveSoon(); };
    const opts = [];
    const role = npc.def.role;
    if (role === 'special') {
      opts.push({ label: 'Özel ürün satın al', small: 'Bu şehrin ticaret malları', fn: () => this.ui.shopBuy(npc, s, city, say) });
      opts.push({ label: 'Yükümdeki malları sat', small: s.load ? `${s.load} birim yük` : 'Yükün boş', fn: () => this.ui.shopSell(npc, s, city, say) });
    } else if (role === 'stable') {
      opts.push({ label: 'Yük hayvanı satın al', small: 'Eşek, at, deve', fn: () => this.ui.stable(npc, s, (k) => this.buyTransport(k)) });
    } else if (role === 'potion') {
      opts.push({ label: 'İksir ve tedavi', fn: () => this.ui.healer(npc, s, say) });
    } else if (role === 'smith') {
      opts.push({ label: 'Silahımı güçlendir', fn: () => this.ui.upgrade(npc, s, 'weapon', say) });
    } else if (role === 'armor') {
      opts.push({ label: 'Zırhımı güçlendir', fn: () => this.ui.upgrade(npc, s, 'armor', say) });
    } else if (role === 'traderGuild' || role === 'merchant') {
      opts.push({ label: 'Ticaret tavsiyesi', fn: () => this.ui.talk({ ...npc, name: npc.name, def: { ...npc.def, talk: [this._advice()] } }, []) });
    }
    this.paused = true;
    this.ui.talk(npc, opts);
  }

  onDialogClosed() { this.paused = false; this.saveSoon(); }

  _advice() {
    const s = this.state;
    const tips = [
      'Malı aldığın şehirden ne kadar uzağa götürürsen o kadar kazanırsın. Ama uzak yollarda haydut da çoktur.',
      'Yükün doluyken şehir dışında haydutlar peşine düşer. Bineğinin dayanıklılığı biterse yükünün bir kısmını kaparlar.',
      `Şu an ${s.load}/${s.capacity} birim taşıyorsun. Daha büyük bir hayvan daha çok kâr demek.`,
      'İksirlerini yanına almadan yola çıkma. Şifacılar her şehirde vardır.',
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  async buyTransport(kind) {
    const s = this.state;
    const t = TRANSPORTS[kind];
    const refund = s.transport !== 'none' ? Math.round(TRANSPORTS[s.transport].price / 2) : 0;
    if (s.gold + refund < t.price) return;
    if (s.load > t.capacity) { this.toast('Önce fazla yükünü sat', 2); return; }
    s.gold += refund - t.price;
    s.transport = kind;
    s.transportHp = t.hp;
    this.toast(`${t.tr} senin! Seni takip edecek.`, 3);
    this.saveSoon();
    await this._spawnCaravan();
  }

  caravanDown() {
    const s = this.state;
    const lost = s.loseCargo(0.4);
    this.caravan.knockOut();
    this.combat.scatter();
    this.toast(`Haydutlar kervanı yağmaladı! ${lost} birim mal kayıp.`, 4);
    setTimeout(() => {
      if (!this.caravan) return;
      s.transportHp = Math.round(TRANSPORTS[s.transport].hp * 0.3);
      this.caravan.revive();
    }, 6000);
    this.saveSoon();
  }

  playerDown() {
    if (this.dead) return;
    const s = this.state;
    this.dead = true;
    this.player.play('die', { once: true, fade: 0.1 });
    const lost = s.loseCargo(0.25);
    const goldLost = Math.round(s.gold * 0.05);
    s.gold -= goldLost;
    this.toast(`Bayıldın… ${lost ? lost + ' birim mal ve ' : ''}${goldLost} altın kaybettin.`, 4);
    setTimeout(() => this._respawn(), 4500);
  }

  async _respawn() {
    const s = this.state;
    const city = cityById(this.lastCity);
    const p = this.app.world.toThree(city.rx, city.rz, city.lx, 0, city.lz, new THREE.Vector3());
    this.focus.copy(p);
    await this.app.game.loadArea(p, `${city.name}'e dönülüyor…`);
    this.app.game._hideOverlay();
    this.mover.place(p.x, p.z);
    s.hp = Math.round(s.maxHp * 0.6);
    this.dead = false;
    this.player.play('idle');
    this.camera.initialized = false;
    if (this.caravan) { this.caravan.mover.place(p.x + 2, p.z + 2, this.mover.pos.y); this.caravan.revive(); }
    this.saveSoon();
  }

  // ---------------------------------------------------------------- dongu
  update(dt) {
    if (!this.ready) return;
    const { input } = this.app;
    const s = this.state;
    if (input.pressed('Escape')) {
      if (this.ui.open) { this.ui.close(); return; }
      if (this.onPause) { this.onPause(); return; }
    }
    s.playTime += dt;
    this._updateFloaters(dt);
    if (this.paused) { this.camera.update(dt, this.mover.pos); this.population.update(dt, this.mover.pos); this.ui.updateStatus(s); return; }
    this.attackLock = Math.max(0, this.attackLock - dt);
    // hareket istegi (kameraya gore)
    this.camera.forward(_f);
    _r.set(-_f.z, 0, _f.x);
    let mx = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    let mz = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
    const gp = input.gamepad;
    if (gp && Math.hypot(gp.moveX, gp.moveY) > 0.1) { mx = gp.moveX; mz = -gp.moveY; }
    if (input.pressed('ShiftLeft', 'ShiftRight')) this.walk = !this.walk;
    let mag = Math.min(1, Math.hypot(mx, mz));
    const cap = this.caravan ? Math.min(RUN, TRANSPORTS[s.transport].speed + 0.6) : RUN;
    const speed = (this.walk ? WALK : cap) * mag;
    _w.set(0, 0, 0);
    if (this.dead || this.attackLock > 0) mag = 0;
    if (mag > 0.05) {
      this.autoMove = null;
      _w.copy(_f).multiplyScalar(mz).addScaledVector(_r, mx).normalize().multiplyScalar(speed);
    } else if (this.autoMove && this.autoMove.alive && !this.dead && !this.attackLock) {
      // hedefe yaklas, menzile girince vur
      _v.set(this.autoMove.pos.x - this.mover.pos.x, 0, this.autoMove.pos.z - this.mover.pos.z);
      if (_v.length() > 1.9) _w.copy(_v).setLength(cap);
      else { this.autoMove = null; this.combat.playerAttack(); }
    }
    if (_w.lengthSq() > 0.01) {
      const want = Math.atan2(_w.x, _w.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
    }
    this.mover.move(dt, _w);
    const v = Math.hypot(this.mover.vel.x, this.mover.vel.z);
    const pl = this.player;
    pl.root.position.copy(this.mover.pos);
    pl.root.rotation.y = this.yaw;
    const busy = pl.currentKey && /punch|hook|hit|die/.test(pl.currentKey) && pl.current && pl.current.isRunning();
    if (!this.dead && !busy) {
      const fighting = this.combat.target && this.combat.target.alive;
      if (v > 3.0) pl.play('run', { timeScale: v / RUN });
      else if (v > 0.25) pl.play('walk', { timeScale: Math.max(0.6, v / WALK) });
      else pl.play(fighting ? 'idleBattle' : 'idle');
    }
    pl.update(dt);
    this.focus.copy(this.mover.pos);
    this.camera.update(dt, this.mover.pos);
    this.population.update(dt, this.mover.pos);
    if (this.caravan) this.caravan.update(dt, this.mover.pos, this.yaw);
    this.combat.update(dt);
    // savas tuslari
    if (input.pressed('Space') || (gp && gp.pressed(2))) this.combat.playerAttack();
    if (input.pressed('Tab')) {
      this.combat.target = this.combat.nearestEnemy(this.mover.pos, 25);
      if (!this.combat.target) this.toast('Yakında düşman yok', 1.2);
    }
    if (input.pressed('KeyQ') || (gp && gp.pressed(3))) this.drinkPotion();
    if (input.pressed('KeyH')) this._cycleDest();
    if ((this._mapF = (this._mapF || 0) + 1) % 2 === 0) this._drawMap();
    // etkilesim
    const npc = this.dead ? null : this.population.nearestNpc(this.mover.pos);
    if (npc !== this.nearNpc || this.ui.open !== this._uiWas) {
      this.nearNpc = npc;
      this._uiWas = this.ui.open;
      this.hudPrompt.classList.toggle('hidden', !npc || this.ui.open);
      if (npc) this.hudPrompt.innerHTML = `<kbd>E</kbd> Konuş: <b>${npc.name}</b>`;
    }
    if (npc && (input.pressed('KeyE') || (gp && gp.pressed(0)))) this.interact(npc);
    this.ui.updateStatus(s);
    this.ui.showTarget(this.combat.target && this.combat.target.alive ? this.combat.target : null);
    // bolge, sehir ve muzik
    this._musicT -= dt;
    if (this._musicT <= 0) {
      this._musicT = 1;
      const { city, dist, region } = this._nearestCity();
      this.nearCity = city.id;
      const was = this.inCity;
      this.inCity = dist < CITY_RADIUS;
      if (this.inCity && (!was || this.lastCity !== city.id)) {
        if (this.lastCity !== city.id) this.toast(`${city.name}'e vardın. Özel Ürün Tüccarı'nı bul ve yükünü sat.`, 4);
        if (this.dest === city.id || this.lastCity !== city.id) this.dest = this._defaultDest(city.id);
        this.lastCity = city.id;
        s.city = city.id;
        this.saveSoon();
      }
      if (!this.inCity && was && s.load) this.toast('Şehirden çıktın. Yollar haydutlarla dolu, dikkatli ol!', 3);
      this.hudZone.textContent = this.inCity ? city.name : 'İpek Yolu';
      this.hudSub.textContent = this.inCity ? 'şehir · güvenli' : `${city.name} ${Math.round(dist)} m`;
      this.app.audio.playMusic(musicForRegion(region.rx, region.rz));
    }
  }

  drinkPotion() {
    const s = this.state;
    if (!s.potions || s.hp >= s.maxHp || this.dead) return;
    s.potions--;
    s.hp = Math.min(s.maxHp, s.hp + Math.round(s.maxHp * 0.45));
    this.floatText(this.mover.pos, '+can', '#9fe08a', 2.2);
    this.saveSoon();
  }

  interact(npc) {
    // yuz yuze: NPC oyuncuya donsun
    const dx = this.mover.pos.x - npc.pos.x, dz = this.mover.pos.z - npc.pos.z;
    npc.yaw = Math.atan2(dx, dz);
    npc.char.root.rotation.y = npc.yaw;
    this.yaw = Math.atan2(-dx, -dz);
    this.openNpc(npc);
  }

  dispose() {
    if (this.state) this.state.save();
    if (this.combat) this.combat.dispose();
    if (this.caravan) this.caravan.dispose();
    if (this.population) this.population.dispose();
    if (this.player) this.player.dispose();
    if (this.ui) this.ui.dispose();
    if (this.minimap) this.minimap.dispose();
    if (this.hud) this.hud.remove();
    for (const f of this.floaters) f.s.removeFromParent();
  }
}
