import * as THREE from 'three';
import { RallyMode } from './RallyMode.js';
import { DriveMode } from './DriveMode.js';
import { Vehicle } from '../vehicle/Vehicle.js';
import { VehicleEffects } from '../vehicle/effects/VehicleEffects.js';
import { VehicleAudio, updateListener } from '../vehicle/VehicleAudio.js';
import { collideCars } from '../vehicle/physics/CarContacts.js';
import { PAINTS } from '../vehicle/model/KartalModel.js';
import { Course } from '../race/Course.js';
import { BotDriver, BOTS, DIFFICULTY } from '../race/BotDriver.js';

// Yaris: ralli etabinda 8 araca kadar toplu kalkis. Oyuncu + botlar (ve ag oyununda uzak
// oyuncular) ayni 240 Hz fizik adimiyla birlikte ilerler; araclar birbirine carpar (PIT, itme,
// yaslanma gercek fizikle olur). Siralama: gecilen kapi + rota uzerindeki ilerleme; kapilar
// atlanamaz (kestirme serbest). Oyuncudan uzak (bolgesi yuklu olmayan) botlar fiziksiz "uzak"
// modda kendi hiz planiyla rota boyunca ilerler, yaklasinca yeniden fiziksel olur.

const STEP = 1 / 240;
export const VARIANT_POOL = ['kartal80', 'kartal90', 'hilux', 'f150', 'rs6', 'tank'];
export const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function fmtTime(t) {
  if (t === null || t === undefined || !Number.isFinite(t)) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function newState() { return { idx: 0, progress: 0, lat: 0, gate: 0, finished: false, time: null, prev: null }; }

/** Tohumlu rastgele (ayni ayarlar -> ayni bot kararlari; ag oyununda herkes ayni kadroyu gorur). */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export class RaceMode extends RallyMode {
  /**
   * opts: { stage, bots (0-7), level (DIFFICULTY anahtari), cars ('same'|'mixed'), grid ('back'|'front'|'random'),
   *         seed, onPause, onFinish }
   */
  constructor(app, opts = {}) {
    super(app, opts);
    this.raceOpts = { bots: 7, level: 'orta', cars: 'same', grid: 'back', ...opts };
    if (!this.raceOpts.seed) this.raceOpts.seed = (Math.random() * 1e9) | 0;
    this.raceState = 'countdown';
    this.raceTime = 0;
    this.cars = [];
    this.teams = false;
    this.repairable = false;
    this.acc = 0;
    this.voices = [];
    this._voiceT = 0;
    this._events = [];
  }

  enter() {
    super.enter();
    const app = this.app, s = app.settings, O = this.raceOpts;
    this.rng = seeded(O.seed);
    this.course = new Course(app.world, this.st, this.stageId);
    this.course.gateTol = 1.5;
    this.best = null;   // zamana karsi en iyi sure yarista gosterilmez
    const { slots, startS } = this.course.grid(8);
    this.startS = startS;
    const sp = new THREE.Vector3(), sd = new THREE.Vector3();
    this.course.route.pointAt(startS, sp, sd);
    this.startGate = { pos: sp.clone(), dir: sd.clone(), placed: false, label: 'START' };
    const nBots = clamp(O.bots | 0, 0, 7);
    const total = nBots + 1;
    const order = [...Array(total).keys()];
    const playerSlot = O.grid === 'front' ? 0 : O.grid === 'random' ? Math.floor(this.rng() * total) : total - 1;
    // oyuncu
    const myPaint = s.get('vehicleColor');
    this.me = this._addCar({ id: 'me', name: 'Sen', human: true, local: true, team: 'players', vehicle: this.vehicle, effects: this.effects, paint: myPaint });
    this.me.slot = playerSlot;
    this._place(this.me, slots[playerSlot]);
    // test / izleme: oyuncu aracini da bot sursun
    if (O.auto) this.me.autopilot = new BotDriver(this.me, this.course, O.level, { name: 'Sen', paint: myPaint, agg: 1, dirty: 1, skill: 0, cut: 1 }, this.rng);
    // botlar: farkli renkler, oyuncununkinden farkli
    const roster = BOTS.filter((b) => b.paint !== myPaint).concat(BOTS.filter((b) => b.paint === myPaint));
    const free = order.filter((k) => k !== playerSlot);
    for (let k = 0; k < nBots; k++) {
      const persona = roster[k % roster.length];
      const variant = O.cars === 'mixed' ? VARIANT_POOL[Math.floor(this.rng() * VARIANT_POOL.length)] : this.vehicle.variant;
      const paint = persona.paint === myPaint ? Object.keys(PAINTS).find((p) => p !== myPaint && !this.cars.some((c) => c.paint === p)) || persona.paint : persona.paint;
      const veh = new Vehicle(app, { variant, paint, prep: this.vehicle.prep, reflections: false });
      veh.shareReflections(this.vehicle);
      veh.sim.autoShift = true;
      const eq = veh.params.equipment || {};
      veh.sim.assists.abs = eq.abs !== false; veh.sim.assists.tcs = false; veh.sim.assists.steer = true; veh.sim.tcsCut = 0;
      veh.headlights = this.vehicle.headlights;
      const car = this._addCar({ id: `bot${k}`, name: persona.name, human: false, local: true, team: 'bots', vehicle: veh, paint });
      car.slot = free[k];
      car.effects = new VehicleEffects(app, veh);
      car.driver = new BotDriver(car, this.course, O.level, persona, this.rng);
      car.label = this._label(persona.name, PAINTS[paint] ? PAINTS[paint].color : '#fff');
      veh.root.add(car.label);
      this._place(car, slots[car.slot]);
    }
    this.levelLabel = (DIFFICULTY[O.level] || DIFFICULTY.orta).label;
    this.hud.route.cars = this.cars;
    // HUD: sira + siralama tablosu
    const pos = document.createElement('div');
    pos.className = 'pos';
    this.ui.insertBefore(pos, this.ui.querySelector('.cp'));
    this.posEl = pos;
    this.board = document.createElement('div');
    this.board.id = 'standings';
    this.board.className = 'panel';
    this.hud.root.appendChild(this.board);
    this.hud.toast(`${this.st.name} · ${total} araç · ${this.levelLabel}`, 3.5);
  }

  _addCar(rec) {
    const car = { state: newState(), controls: { accel: 0, decel: 0, steer: 0, handbrake: 0 }, physical: true, ghost: false, ...rec };
    car.sim = car.vehicle.sim;
    car.color = PAINTS[car.paint] ? PAINTS[car.paint].color : '#ffd36b';
    this.cars.push(car);
    return car;
  }

  _place(car, slot) {
    car.vehicle.spawn(slot.x, slot.z, slot.yaw);
    car.state.idx = this.course.route.indexAt(Math.max(0, slot.s));
    car.state.progress = slot.s;
    car.state.prev = null;
  }

  /** Bot adi etiketi (aracin uzerinde, yakindayken gorunur). */
  _label(text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(text, 128, 34);
    g.fillStyle = '#fff'; g.fillText(text, 128, 34);
    g.fillStyle = color; g.fillRect(40, 56, 176, 5);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // ekranda sabit boy (uzaklikla kuculmez, yakinda ekrani kaplamaz)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }));
    sp.scale.set(0.15, 0.0375, 1);
    sp.position.set(0, 2.5, 0);
    sp.renderOrder = 5;
    return sp;
  }

  // ------------------------------------------------------------ dongu

  update(dt) {
    const v = this.vehicle;
    if (this.paused) { DriveMode.prototype.update.call(this, dt); return; }
    this._refreshGates();
    if (this.beamMat) this.beamMat.uniforms.uTime.value += dt;
    if (this.raceState === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.5);
      this.big.textContent = n > 0 ? String(n) : 'BAŞLA!';
      if (this.countdown <= 0) {
        this.raceState = 'run'; this.state = 'run';
        setTimeout(() => { if (this.big) this.big.textContent = ''; }, 700);
      }
    }
    DriveMode.prototype.update.call(this, dt);   // tuslar + _stepVehicles (tum araclar) + kamera/ses/HUD
    if (this.raceState === 'run') {
      this.raceTime += dt;
      if (this.state === 'run') this.time = this.raceTime;
      // oyuncu bitirdikten 90 sn sonra (ya da herkes bitince) yaris kapanir; bitiremeyenler DNF
      if (this.state === 'done' && !this.final) {
        this.endT = (this.endT ?? 90) - dt;
        if (this.endT <= 0 || this.cars.every((c) => c.state.finished)) {
          this.final = true;
          for (const c of this.cars) if (!c.state.finished) c.state.dnf = true;
        }
      }
    }
    this._trackAll();
    // hata ayiklama gecmisi (saniyede bir): zaman, indeks, kapi, ilerleme, konum, fiziksel mi
    this._histT = (this._histT || 0) - dt;
    if (this._histT <= 0) {
      this._histT = 1;
      for (const c of this.cars) {
        const h = c.hist || (c.hist = []);
        const p = c.sim.body.pos;
        h.push([+this.raceTime.toFixed(1), c.state.idx, c.state.gate, Math.round(c.state.progress), Math.round(p.x), Math.round(p.z), c.physical ? 1 : 0, Math.round(c.state.lat || 0)]);
        if (h.length > 400) h.shift();
      }
    }
    this._events.length = 0;
    for (const car of this.cars) {
      for (const d of [car.driver, car.autopilot]) if (d && d.events.length) { this._events.push(...d.events); d.events.length = 0; }
    }
    this._announce();
    this.routeIdx = this.me.state.idx;
    this.cpIndex = this.me.state.gate;
    this.hud.route.next = this.cpIndex;
    this._hud(this.cps[this.cpIndex]);
    this._board(dt);
    void v;
  }

  /** Tum araclari birlikte adimla (DriveMode yalniz oyuncuyu adimlar). */
  _stepVehicles(dt, c) {
    const counting = this.raceState === 'countdown';
    for (const car of this.cars) {
      if (car === this.me) car.controls = this.me.autopilot ? this.me.autopilot.update(dt, this) : c;
      else if (car.driver && car.physical) car.controls = car.driver.update(dt, this);
    }
    for (const car of this.cars) if (car.driver) this._physicalSwitch(car);
    const phys = this.cars.filter((car) => car.physical && car.vehicle.groundReady());
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 24) {
      for (const car of phys) car.vehicle.physicsStep(STEP, car.controls);
      for (let i = 0; i < phys.length; i++) {
        const A = phys[i];
        if (A.ghost) continue;
        for (let j = i + 1; j < phys.length; j++) if (!phys[j].ghost) collideCars(A.sim, phys[j].sim);
      }
      this._remoteContacts(phys);
      this.acc -= STEP;
      n++;
    }
    if (n >= 24) this.acc = 0;
    for (const car of phys) car.vehicle.postStep(dt, this.acc / STEP);
    if (!phys.includes(this.me)) this.vehicle._sync(1);
    if (counting) for (const car of phys) { car.sim.body.vel.x *= 0.5; car.sim.body.vel.z *= 0.5; }
    for (const car of this.cars) if (car.driver && !car.physical) this._virtualStep(car, dt);
    for (const car of this.cars) if (car !== this.me && car.vehicle && car.local) this._botVisuals(car, dt);
  }

  /** Ag oyunu: uzak araclara tek tarafli carpisma (RaceNet ezer). */
  _remoteContacts() {}

  /** Uzak bot: bolgesi yuklu degilse ya da oyuncudan cok uzaksa fiziksiz ilerlesin. */
  _physicalSwitch(car) {
    const b = car.sim.body, p = this.vehicle.position;
    const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
    if (car.physical) {
      if (this.raceState === 'run' && !car.state.finished && (!car.vehicle.groundReady() || d > 430)) {
        car.physical = false;
        car.vs = car.state.progress;
        car.vv = Math.max(4, Math.abs(car.sim.forwardSpeed));
        car.vlat = clamp(car.state.lat || 0, -3, 3);
      }
    } else if (d < 380) {
      const R = this.course.route, q = new THREE.Vector3(), dir = new THREE.Vector3();
      R.pointAt(car.vs, q, dir);
      const x = q.x + dir.z * car.vlat, z = q.z - dir.x * car.vlat;
      if (!this.app.world.isLoadedAt(x, z)) return;
      car.vehicle.spawn(x, z, Math.atan2(-dir.x, -dir.z));
      car.sim.body.vel.set(dir.x * car.vv, 0, dir.z * car.vv);
      for (const w of car.sim.wheels) w.omega = car.vv / w.radius;
      car.sim.gear = Math.min(car.sim.maxGear, 3);
      car.state.prev = null;
      car.physical = true;
    }
  }

  _virtualStep(car, dt) {
    if (this.raceState !== 'run') return;
    const st = car.state, R = this.course.route;
    if (st.finished) return;
    const target = car.driver.virtualSpeed(car.vs);
    car.vv += clamp(target - car.vv, -6 * dt, 3.2 * dt);
    car.vs += car.vv * dt;
    // kapilar: uzak modda yol uzerinde gidiyor, sirayla gecer
    const G = this.course.gates;
    while (st.gate < G.length && car.vs >= this.course.cum[G[st.gate].i]) {
      st.gate++;
      if (st.gate >= G.length) { this._finishCar(car); break; }
    }
    st.progress = Math.min(car.vs, this.course.length);
    st.idx = R.indexAt(st.progress);
    st.lat = car.vlat;
    // gorsel (uzakta; sis icinde) ve fizik govdesi konumu
    const q = new THREE.Vector3(), dir = new THREE.Vector3();
    R.pointAt(car.vs, q, dir);
    const x = q.x + dir.z * car.vlat, z = q.z - dir.x * car.vlat;
    const h = this.app.world.heightAt(x, z);
    const b = car.sim.body;
    b.pos.set(x, (h ?? b.pos.y - car.vehicle.params.cgHeight) + car.vehicle.params.cgHeight, z);
    b.q.setFromAxisAngle(0, 1, 0, Math.atan2(-dir.x, -dir.z));
    b.vel.set(dir.x * car.vv, 0, dir.z * car.vv);
    car.sim.prevPos.copy(b.pos); car.sim.prevQ.copy(b.q);
    car.vehicle._sync(1);
  }

  _botVisuals(car, dt) {
    const v = car.vehicle;
    if (v.sim.impacts.length) { v.lastImpacts = v.sim.impacts.splice(0); v.applyImpacts(v.lastImpacts); }
    if (v.damage.events.length) {
      for (const ev of v.damage.events) {
        if (ev.type === 'shatter' && car.effects) car.effects.glass(ev.point);
        else if (ev.type === 'detach' && car.effects) car.effects.debris(ev.point);
      }
      v.damage.events.length = 0;
    }
    const near = v.position.distanceTo(this.vehicle.position) < 260;
    if (near) v.updateDirt(dt);
    if (car.effects) { if (near) car.effects.update(dt); else v.lastImpacts = null; }
    if (car.label) {
      const dc = v.position.distanceTo(this.app.camera.position);
      car.label.visible = near && dc > 9 && dc < 110 && car !== this.spectating;
    }
  }

  _keys() {
    super._keys();
    // finisten sonra (ya da izleme modunda) V: siradaki araci izle
    if (this.app.input.pressed('KeyV') && (this.me.state.finished || this.me.autopilot)) {
      const list = this.ranking();
      const cur = this.spectating ? list.indexOf(this.spectating) : list.indexOf(this.me);
      this.spectate(list[(cur + 1) % list.length]);
    }
  }

  /** Kamerayi baska bir araca bagla (null/oyuncu: geri don). */
  spectate(car) {
    const c = car && car !== this.me ? car : null;
    this.spectating = c;
    this.camera.vehicle = c ? c.vehicle : this.vehicle;
    this.camera.initialized = false;
    if (c) this.hud.toast(`İzleniyor: ${c.name} (V: sonraki)`, 2);
  }

  _afterVehicle(dt) {
    super._afterVehicle(dt);
    updateListener(this.app.audio, this.app.camera);
    this._updateVoices(dt);
  }

  /** En yakin 3 rakibin motor sesi (konumlu). */
  _updateVoices(dt) {
    if (!this.app.audio.ctx) return;
    this._voiceT -= dt;
    if (this._voiceT <= 0) {
      this._voiceT = 0.6;
      const cam = this.app.camera.position;
      const near = this.cars.filter((c) => c !== this.me && c.vehicle && c.physical && c.vehicle.position.distanceTo(cam) < 160)
        .sort((a, b) => a.vehicle.position.distanceTo(cam) - b.vehicle.position.distanceTo(cam)).slice(0, 3);
      for (const vo of this.voices.slice()) {
        if (!near.includes(vo.car)) { vo.audio.dispose(); this.voices.splice(this.voices.indexOf(vo), 1); }
      }
      for (const c of near) {
        if (this.voices.some((vo) => vo.car === c)) continue;
        this.voices.push({ car: c, audio: new VehicleAudio(this.app.audio, c.vehicle, { engine: this.app.settings.get('engineSound'), spatial: true, level: 0.8 }) });
      }
    }
    for (const vo of this.voices) vo.audio.update(dt);
  }

  // ------------------------------------------------------------ parkur ve siralama

  _trackAll() {
    const C = this.course;
    for (const car of this.cars) {
      if (!car.physical || car.remote) continue;
      const st = car.state, pos = car.sim.body.pos;
      const passed = C.track(st, pos, st.prev);
      st.prev = st.prev || new THREE.Vector3();
      st.prev.set(pos.x, pos.y, pos.z);
      if (!passed || this.raceState !== 'run') continue;
      if (car === this.me) this._playerGate(passed);
      if (st.gate >= C.gates.length) this._finishCar(car);
    }
  }

  _playerGate(gate) {
    this.splits.push(this.raceTime);
    const p = this.me.place ? ` · ${this.me.place}. sıradasın` : '';
    this.hud.toast(`${gate.n}. ${gate.name} — ${fmtTime(this.raceTime)}${p}`, 2);
  }

  _finishCar(car) {
    const st = car.state;
    if (st.finished) return;
    st.finished = true;
    st.time = this.raceTime;
    car.ghost = true;   // finisten sonra kimseye carpmaz
    if (car === this.me) this._playerFinished();
    else if (this.me.state.finished || car.vehicle.position.distanceTo(this.vehicle.position) < 120) {
      const place = this.cars.filter((c) => c.state.finished).length;
      this.hud.toast(`${car.name} ${place}. olarak bitirdi — ${fmtTime(st.time)}`, 2.2);
    }
  }

  _playerFinished() {
    this.state = 'done';
    this.time = this.me.state.time;
    this._results();
  }

  ranking() {
    return this.cars.slice().sort((a, b) => {
      const A = a.state, B = b.state;
      if (A.finished && B.finished) return A.time - B.time;
      if (A.finished !== B.finished) return A.finished ? -1 : 1;
      if (A.gate !== B.gate) return B.gate - A.gate;
      return B.progress - A.progress;
    });
  }

  _board(dt) {
    this._boardT = (this._boardT || 0) - dt;
    if (this._boardT > 0) return;
    this._boardT = 0.25;
    const list = this.ranking();
    list.forEach((c, i) => { c.place = i + 1; });
    const lead = list[0];
    const rows = list.map((c) => {
      let gap = '';
      if (c.state.finished) gap = fmtTime(c.state.time);
      else if (c !== lead) {
        const d = Math.max(0, (lead.state.finished ? this.course.length : lead.state.progress) - c.state.progress);
        gap = `+${d < 1000 ? `${d.toFixed(0)} m` : `${(d / 1000).toFixed(1)} km`}`;
      }
      const me = c === this.me ? ' me' : '';
      return `<div class="row${me}"><span class="p">${c.place}</span><span class="dot" style="background:${c.color}"></span><span class="n">${c.name}</span><span class="g">${gap}</span></div>`;
    }).join('');
    this.board.innerHTML = `<div class="h">SIRALAMA · ${this.levelLabel}</div>${rows}`;
    if (this.posEl) this.posEl.innerHTML = `<b>${this.me.place}</b>/${this.cars.length}`;
    if (this.resultEl && this.resultEl.isConnected) this._results(true);
  }

  /** Olay anonslari: oyuncuya yapilan kirli hareketler ve yakindaki kapismalar. */
  _announce() {
    const TXT = {
      pit: (a, t) => (t === this.me ? `${a} sana PIT attı!` : `${a}, ${t.name} aracına PIT attı`),
      lean: (a, t) => (t === this.me ? `${a} seni bariyer gibi kullandı!` : `${a}, ${t.name} aracına yaslanıp döndü`),
      brake: (a, t) => (t === this.me ? `${a} önünde fren testi yaptı!` : null),
      swipe: (a, t) => (t === this.me ? `${a} seni yoldan itmeye çalıştı!` : `${a}, ${t.name} aracını itti`),
      bump: (a, t) => (t === this.me ? `${a} arkadan dürttü!` : null),
    };
    this._announceT = (this._announceT || 0) - 1 / 60;
    for (const e of this._events) {
      // oyuncuya (ya da izlenen araca) yapilanlar hep; botlar arasi kapismalar yakinsa ve seyrek
      const mine = e.target === this.me || e.target === this.spectating || e.bot === this.spectating;
      const near = e.bot.vehicle.position.distanceTo(this.camera.vehicle.position) < 60;
      if (!mine && (!near || this._announceT > 0)) continue;
      if (!mine) this._announceT = 6;
      const msg = TXT[e.type] && TXT[e.type](e.bot.name, e.target);
      if (msg) this.hud.toast(msg, 2.2);
    }
  }

  /** Oyuncunun ya da botun aracini rotaya geri koy (R iki kez / bot takilmasi). */
  toRoute(car = this.me) {
    const C = this.course, st = car.state, v = car.vehicle, pts = C.pts, w = this.app.world;
    const p = car.sim.body.pos;
    const lo = st.gate > 0 ? C.gates[st.gate - 1].i : 0;
    const hi = st.gate < C.gates.length ? C.gates[st.gate].i : pts.length - 1;
    let bi = Math.min(C.route.nearestGlobal(p, lo, hi), pts.length - 3);
    // baska bir aracin ustune konmasin: bos bir nokta ara (geriye dogru)
    for (let k = 0; k < 12; k++) {
      const q = pts[bi];
      if (!this.cars.some((o) => o !== car && o.physical && !o.ghost && (o.sim.body.pos.x - q.x) ** 2 + (o.sim.body.pos.z - q.z) ** 2 < 36)) break;
      bi = Math.max(lo, bi - 1);
    }
    const a = pts[bi], b = pts[bi + 2];
    const yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
    const h = w.heightAt(a.x, a.z) ?? a.y ?? 0;
    const hit = { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), object: false, surface: 0 };
    const down = new THREE.Vector3(0, -1, 0);
    let y = h;
    if (this.app.collision.raycast(new THREE.Vector3(a.x, h + 30, a.z), down, 80, hit)) {
      y = hit.point.y;
      if (y > h + 3 && hit.normal.y < 0.9 && this.app.collision.raycast(new THREE.Vector3(a.x, h + 2.5, a.z), down, 10, hit)) y = hit.point.y;
    }
    v.spawn(a.x, a.z, yaw, y, 0.6);
    st.idx = bi; st.prev = null;
    if (car === this.me) { this.routeIdx = bi; this.camera.initialized = false; }
  }

  // ------------------------------------------------------------ sonuc

  _finish() {}   // RallyMode'un tek arac bitisi kullanilmaz

  _results(refresh = false) {
    const list = this.ranking();
    const rows = list.map((c, i) => {
      const t = c.state.finished ? fmtTime(c.state.time) : (c.state.dnf ? 'DNF' : `yarışta · ${(c.state.progress / 1000).toFixed(2)} km`);
      return `<tr class="${c === this.me ? 'me' : ''}"><td>${i + 1}.</td><td><span class="dot" style="background:${c.color}"></span>${c.name}</td><td>${c.vehicle ? this._carName(c.vehicle.variant) : ''}</td><td>${t}</td><td>${c.state.finished ? POINTS[i] || 0 : ''}</td></tr>`;
    }).join('');
    const html = `<h2>${this.st.name}</h2>
      <div style="color:var(--muted);margin-bottom:8px">${this.me.place}. oldun · ${fmtTime(this.me.state.time)} · ${this.levelLabel}</div>
      <table class="results"><tr><th></th><th>Sürücü</th><th>Araç</th><th>Süre</th><th>Puan</th></tr>${rows}</table>
      <div class="row" style="margin-top:14px"><button class="btn" data-a="again" style="width:auto">Tekrar yarış</button><button class="btn secondary" data-a="main" style="width:auto">Ana menü</button></div>`;
    if (refresh) { if (this._resultHtml !== html) { this.resultEl.innerHTML = html; this._resultHtml = html; } return; }
    const el = document.createElement('div');
    el.className = 'panel dialog interactive results-panel';
    el.innerHTML = html;
    this._resultHtml = html;
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      el.remove();
      if (a.dataset.a === 'again') window.game.startRace({ ...this.raceOpts, seed: (Math.random() * 1e9) | 0 });
      else window.game.showMainMenu();
    });
    this.app.ui.appendChild(el);
    this.resultEl = el;
    if (this.onFinish) this.onFinish({ finished: true, place: this.me.place, time: this.me.state.time, stage: this.stageId });
  }

  _carName(variant) {
    return { kartal80: 'Kartal', kartal90: 'Kartal 90', hilux: 'Hilux', f150: 'F-150', rs6: 'RS 6', tank: 'Tank' }[variant] || variant;
  }

  dispose() {
    for (const vo of this.voices) vo.audio.dispose();
    this.voices.length = 0;
    for (const car of this.cars) {
      if (car === this.me) continue;
      if (car.effects) car.effects.dispose();
      if (car.vehicle) car.vehicle.dispose();
    }
    if (this.board) this.board.remove();
    super.dispose();
  }
}
