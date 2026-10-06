import * as THREE from 'three';
import { surfaceInfo } from '../vehicle/presets.js';

// Bot surucu. Oyuncuyla ayni araclari ayni fizikle kullanir (ek guc, "lastik bandi" yok);
// zorluk yalnizca surus becerisini ve kirli taktiklerin sikligini belirler.
//
// Surus: aktif yol (rota ya da kestirmeli hizli cizgi) uzerinde yanal ofsetli model tabanli
// pure pursuit (teker acisi = atan(2 L y / d^2), hiza bagli direksiyon siniriyla normalize);
// hiz plani viraj egriligi + zemin tutusu + tumsek/cukur (dikey egrilik) + fren mesafesi.
//
// Taktikler (saldirganlik / kirlilik egilimine gore):
//  - sollama: yavas araci bos taraftan gecer; yer yoksa takip eder ya da arkadan durter
//  - blok: arkadan gelenin cizgisine kayar (kirli botlar zigzag yapar)
//  - bariyer: viraj girisinde dis tarafta yanindaki araca yaslanip ondan destek alarak daha
//    hizli doner (rakip disari savrulur)
//  - PIT: yanindaki aracin arka camurluguna gelir, direksiyonu ona kirar, arkasini dondurur
//  - fren testi: hemen arkasindaki araca ani fren yapar
//  - yandan itme: kenara (engel/ucurum/kum) yakin rakibi oraya iter
//  - kestirme: hizli cizgideki kestirmeleri kullanir (kapilar yine gecilmek zorunda)

export const DIFFICULTY = {
  kolay: { label: 'Kolay', grip: 0.6, brake: 0.55, aggression: 0.15, dirty: 0.0, shortcut: 0.0, line: 0.0, mistakes: 0.3, crest: 0.6 },
  orta: { label: 'Orta', grip: 0.7, brake: 0.66, aggression: 0.4, dirty: 0.35, shortcut: 0.45, line: 0.6, mistakes: 0.12, crest: 0.7 },
  zor: { label: 'Zor', grip: 0.79, brake: 0.75, aggression: 0.65, dirty: 0.7, shortcut: 0.85, line: 1.0, mistakes: 0.05, crest: 0.8 },
  acimasiz: { label: 'Acımasız', grip: 0.85, brake: 0.8, aggression: 0.95, dirty: 1.0, shortcut: 1.0, line: 1.0, mistakes: 0.02, crest: 0.85 },
};

// Rakip kadrosu: kisilik carpanlari (saldirganlik, kirlilik, beceri farki, kestirme egilimi)
export const BOTS = [
  { name: 'Deli Rıza', paint: 'kirmizi', agg: 1.35, dirty: 1.1, skill: -0.02, cut: 1.0 },
  { name: 'Sinsi Selim', paint: 'siyah', agg: 0.9, dirty: 1.45, skill: 0.0, cut: 1.1 },
  { name: 'Hızlı Hatice', paint: 'beyaz', agg: 0.6, dirty: 0.5, skill: 0.03, cut: 0.9 },
  { name: 'Kazma Kemal', paint: 'hardal', agg: 1.45, dirty: 0.9, skill: -0.03, cut: 0.7 },
  { name: 'Tilki Tülay', paint: 'yesil', agg: 0.8, dirty: 0.9, skill: 0.01, cut: 1.6 },
  { name: 'Kara Murat', paint: 'lacivert', agg: 1.0, dirty: 1.0, skill: 0.0, cut: 1.0 },
  { name: 'Haydut Hüsnü', paint: 'bej', agg: 1.2, dirty: 1.3, skill: -0.01, cut: 1.2 },
  { name: 'Çöl Aslanı Cemil', paint: 'gumus', agg: 0.85, dirty: 0.7, skill: 0.02, cut: 0.9 },
];

const G = 9.81;
const MU = (flag) => surfaceInfo(flag).mu;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();
const _pr = {};

/** Bir yol icin paylasilan 2 m'lik profil: yukseklik ve zemin tutusu (bolge yuklendikce dolar). */
const PROFILES = new WeakMap();
function profileOf(track, world) {
  let P = PROFILES.get(track);
  if (P) return P;
  const SS = 2, sx = [], sz = [], ss = [];
  for (let i = 0; i < track.n - 1; i++) {
    const a = track.pts[i], b = track.pts[i + 1], L = track.cum[i + 1] - track.cum[i], n = Math.max(1, Math.round(L / SS));
    for (let k = 0; k < n; k++) { const t = k / n; sx.push(a.x + (b.x - a.x) * t); sz.push(a.z + (b.z - a.z) * t); ss.push(track.cum[i] + L * t); }
  }
  const M = sx.length;
  P = { M, sx, sz, ss, h: new Float64Array(M).fill(NaN), mu: new Float64Array(M).fill(NaN), world };
  P.heightAt = (k) => {
    if (k < 0 || k >= M) return NaN;
    if (Number.isNaN(P.h[k]) && world.isLoadedAt(sx[k], sz[k])) {
      const h = world.heightAt(sx[k], sz[k]);
      if (h !== null && h !== undefined) P.h[k] = h;
    }
    return P.h[k];
  };
  P.muAt = (k) => {
    if (k < 0 || k >= M) return 0.78;
    if (Number.isNaN(P.mu[k]) && world.isLoadedAt(sx[k], sz[k])) P.mu[k] = MU(world.surfaceAt(sx[k], sz[k]));
    return Number.isNaN(P.mu[k]) ? 0.78 : P.mu[k];
  };
  P.sampleAt = (s) => {
    let lo = 0, hi = M - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ss[m] <= s) lo = m; else hi = m; }
    return lo;
  };
  PROFILES.set(track, P);
  return P;
}

export class BotDriver {
  /**
   * car: yaris araci kaydi { vehicle, state, team, name, ... }
   * course: Course; level: DIFFICULTY anahtari; persona: BOTS ogesi; rng: () => [0,1)
   */
  constructor(car, course, level = 'orta', persona = BOTS[0], rng = Math.random) {
    this.car = car;
    this.course = course;
    this.rng = rng;
    const D = DIFFICULTY[level] || DIFFICULTY.orta;
    this.level = level;
    this.persona = persona;
    const P = car.vehicle.params;
    // ayni arac: tutus siniri aracin lastiginden; zorluk yalniz kullanilan payi belirler
    this.skill = clamp(D.grip + (persona.skill || 0), 0.45, 0.92);
    this.aLat = this.skill * G * P.tire.mu * 0.9;
    this.aBrk = clamp(D.brake + (persona.skill || 0), 0.4, 0.88) * G * P.tire.mu * 0.85;
    this.aggression = clamp(D.aggression * (persona.agg || 1), 0, 1);
    this.dirty = clamp(D.dirty * (persona.dirty || 1), 0, 1);
    this.mistakes = D.mistakes;
    this.crest = D.crest;
    this.useLine = !!course.line && rng() < D.line;
    // kestirme kararlari (bolum basina, yaris basinda)
    this.takeCut = (course.shortcuts || []).map(() => rng() < clamp(D.shortcut * (persona.cut || 1), 0, 1));
    this.off = 0; this.offTarget = 0;
    this.li = 0;             // hizli cizgi indeksi
    this.tactic = null;      // { type, target, t, phase, ... }
    this.cool = { pit: 4 + rng() * 6, brake: 6 + rng() * 6, swipe: 5, lean: 2, bump: 4 };
    this.thinkT = rng() * 0.15;
    this.stuckT = 0; this.revT = 0; this.flipT = 0; this.offT = 0; this.lastStuckIdx = -99; this.stuckN = 0;
    this.mistake = null; this.mistakeT = 3 + rng() * 6;
    this.events = [];        // HUD'a giden olaylar (PIT, bariyer...)
    this.trace = [];         // hata ayiklama: takilma, geri vites, rotaya donus, taktikler
    this.c = { accel: 0, decel: 0, steer: 0, handbrake: 0, shiftUp: false, shiftDown: false };
    // sicramalar (pilot notu J): rota uzerindeki konumlari; yaklasirken havalanma payi kucuk tutulur
    this.jumps = (course.notes || []).filter((n) => n.k === 'J').map((n) => course.cum[n.i]);
    this.dbg = {};
  }

  /** Aktif yol: hizli cizgi (kestirmesi reddedilmis bolumlerde rota). */
  _path() {
    const C = this.course, idx = this.car.state.idx || 0;
    // bu bolumde hizli cizgide takildi: bir sure rotayi izle
    if (this.avoidLine && (this.car.state.progress || 0) < this.avoidLine) return C.route;
    if (!this.useLine && !this.takeCut.some(Boolean)) return C.route;
    if (!C.line) return C.route;
    const cuts = C.shortcuts || [];
    for (let k = 0; k < cuts.length; k++) {
      if (idx >= cuts[k].a - 4 && idx <= cuts[k].b + 2) return this.takeCut[k] ? C.line : C.route;
    }
    return this.useLine ? C.line : C.route;
  }

  /** Yanal ofset (aktif yola gore, + sol) icin izin verilen aralik: rota koridorundan. */
  _room(path, s) {
    const C = this.course;
    const ri = path === C.route ? path.indexAt(s) : C.lineToRoute[path.indexAt(s)];
    let dev = 0;
    if (path !== C.route) { path.pointAt(s, _p); C.route.project(_p, ri, _pr); dev = _pr.lat; }
    return { lo: -C.wr[ri] + 1.4 - dev, hi: C.wl[ri] - 1.4 - dev, ri, dev };
  }

  /** Planlanan hiz (m/s) - yolun s noktasinda, ileriye 170 m bakarak. */
  plan(path, s, sp, leanUntil = -1) {
    const prof = profileOf(path, this.course.world);
    let vt = 75;
    const i0 = path.indexAt(s);
    let k = prof.sampleAt(s);
    for (let i = i0; i < path.n && path.cum[i] - s < 170; i++) {
      while (k < prof.M - 1 && prof.ss[k] < path.cum[i]) k++;
      let a = (this.aLat * prof.muAt(k)) / 0.78;
      if (path.cum[i] <= leanUntil) a *= 1.55;   // yanindaki araca yaslanarak donuyor
      if (this.mistake && this.mistake.type === 'late' && path.cum[i] - s < 80) a *= 1.35;
      const vk = Math.sqrt(a / Math.max(Math.abs(path.kap[i]), 1e-4));
      const d = Math.max(0, path.cum[i] - s);
      vt = Math.min(vt, Math.sqrt(vk * vk + 2 * this.aBrk * d));
    }
    // tumsek / cukur (bilinen sicramalarda havalanma payi dar: inis kum/virajsa takla riski)
    const k0 = prof.sampleAt(s);
    const C = this.course, onRoute = path === C.route;
    for (let q = k0 + 3; q < prof.M - 3 && prof.ss[q] - s < 140; q += 1) {
      const h0 = prof.heightAt(q - 3), h1 = prof.heightAt(q), h2 = prof.heightAt(q + 3);
      if (Number.isNaN(h0) || Number.isNaN(h1) || Number.isNaN(h2)) continue;
      const kv = (h2 - 2 * h1 + h0) / 36;
      let vl = 75;
      let crest = this.crest;
      if (this.jumps.length) {
        const rs = onRoute ? prof.ss[q] : C.cum[C.lineToRoute[path.indexAt(prof.ss[q])]];
        for (const j of this.jumps) if (Math.abs(rs - j) < 18) crest = Math.min(crest, 0.5);
      }
      if (kv < -0.004) vl = Math.sqrt((crest * G) / -kv);
      else if (kv > 0.012) vl = Math.sqrt((2.4 * G) / kv);
      vt = Math.min(vt, Math.sqrt(vl * vl + 2 * this.aBrk * Math.max(0, prof.ss[q] - s)));
    }
    return vt;
  }

  /** Uzak (fiziksiz) mod icin ortalama hiz: plan hizinin biraz alti. */
  virtualSpeed(s) {
    const path = this.course.route;
    return Math.max(6, this.plan(path, s, 20) * (0.86 + 0.08 * this.skill));
  }

  /** Diger araclarin bu araca gore konumu. */
  _perceive(race) {
    const me = this.car, sim = me.vehicle.sim, b = sim.body;
    const fwd = me.vehicle.forward, left = _t.set(fwd.z, 0, -fwd.x);
    const sp = sim.forwardSpeed;
    const out = [];
    for (const o of race.cars) {
      if (o === me || !o.sim || o.state.finished || o.ghost) continue;
      const ob = o.sim.body;
      const rx = ob.pos.x - b.pos.x, rz = ob.pos.z - b.pos.z;
      const dist = Math.hypot(rx, rz);
      if (dist > 90) continue;
      const df = rx * fwd.x + rz * fwd.z, dl = rx * left.x + rz * left.z;
      const vO = ob.vel.x * fwd.x + ob.vel.z * fwd.z;
      // hedefin yonu ve benim on tamponumun hedef govdesindeki yeri
      const of = o.forward || o.vehicle.forward;
      const ol = { x: of.z, z: -of.x };
      const frontZ = me.vehicle.model.frontZ ?? -2;
      const fx = b.pos.x + fwd.x * -frontZ - ob.pos.x, fz = b.pos.z + fwd.z * -frontZ - ob.pos.z;
      const zO = -(fx * of.x + fz * of.z);     // + : hedefin CG'sinin arkasinda
      const xO = fx * ol.x + fz * ol.z;          // + : hedefin solunda
      const head = Math.atan2(fwd.x * of.z - fwd.z * of.x, fwd.x * of.x + fwd.z * of.z);
      out.push({ o, dist, df, dl, vO, closing: sp - vO, zO, xO, head, lat: o.state.lat || 0, enemy: !race.teams || o.team !== me.team, human: !!o.human });
    }
    return out;
  }

  _corner(path, s, from, to) {
    // [s+from, s+to] araliginda en keskin egrilik (isaretli) ve konumu
    let best = 0, at = -1;
    for (let i = path.indexAt(s + from); i < path.n && path.cum[i] - s < to; i++) {
      if (Math.abs(path.kap[i]) > Math.abs(best)) { best = path.kap[i]; at = path.cum[i]; }
    }
    return { k: best, at };
  }

  _event(type, target) {
    this.events.push({ type, target, bot: this.car });
    this._log(type + ' -> ' + target.name, this.car.state);
  }

  _log(what, st) {
    this.trace.push([+(this.car.sim.time || 0).toFixed(1), what, st.idx || 0]);
    if (this.trace.length > 60) this.trace.shift();
  }

  /** Taktik kararlari (her ~0.15 sn). */
  _think(race, others, path, s, sp) {
    const me = this.car;
    const R = this._room(path, s);
    const roll = (p) => this.rng() < p;
    const T = this.tactic;
    if (T) return;
    const enemies = others.filter((x) => x.enemy);
    const corner = this._corner(path, s, 10, 65);
    const straight = Math.abs(this._corner(path, s, 0, 60).k) < 1 / 90;
    // --- PIT: yandaki aracin arka camurlugu
    if (this.cool.pit <= 0 && this.dirty > 0.25 && sp > 11 && sp < 42 && Math.abs(corner.k) < 1 / 35) {
      for (const x of enemies) {
        if (x.df < -1 || x.df > 9 || Math.abs(x.dl) < 0.9 || Math.abs(x.dl) > 4 || Math.abs(x.head) > 0.4 || Math.abs(x.closing) > 7) continue;
        const want = x.human ? 1.4 : 1;
        if (!roll(0.35 * this.dirty * this.aggression * want + 0.08 * this.dirty)) { this.cool.pit = 2 + this.rng() * 3; continue; }
        this.tactic = { type: 'pit', target: x.o, side: Math.sign(x.dl), phase: 'align', t: 0 };
        return;
      }
    }
    // --- bariyer: viraj girisinde dis tarafimdaki araca yaslan
    if (this.cool.lean <= 0 && Math.abs(corner.k) > 1 / 70 && corner.at - s < 55) {
      const outside = -Math.sign(corner.k);   // sola donuste dis taraf sag (dl < 0)
      for (const x of enemies) {
        if (Math.abs(x.df) > 4.5 || x.dl * outside <= 1.1 || Math.abs(x.dl) > 4.5) continue;
        if (!roll(0.25 + 0.6 * this.aggression)) { this.cool.lean = 2; break; }
        this.tactic = { type: 'lean', target: x.o, side: outside, until: corner.at + 18, t: 0 };
        return;
      }
    }
    // --- fren testi: tam arkamdaki araca
    if (this.cool.brake <= 0 && this.dirty > 0.35 && straight && sp > 14) {
      for (const x of enemies) {
        if (x.df > -2 || x.df < -11 || Math.abs(x.dl) > 1.4 || x.closing > 1.5) continue;
        if (!roll(0.4 * this.dirty)) { this.cool.brake = 4; break; }
        this.tactic = { type: 'brake', target: x.o, t: 0, dur: 0.35 + 0.2 * this.rng() };
        return;
      }
    }
    // --- yandan itme: kenara yakin rakip
    if (this.cool.swipe <= 0 && this.dirty > 0.3 && sp > 9) {
      for (const x of enemies) {
        if (Math.abs(x.df) > 2.8 || Math.abs(x.dl) < 1.3 || Math.abs(x.dl) > 3.2) continue;
        const C = this.course, oi = x.o.state.idx || 0;
        const roomO = x.dl > 0 ? C.wl[oi] - (x.lat) : C.wr[oi] + (x.lat);
        if (roomO > 5 && !roll(0.15 * this.dirty)) continue;
        if (!roll(0.3 + 0.5 * this.dirty)) { this.cool.swipe = 3; break; }
        this.tactic = { type: 'swipe', target: x.o, side: Math.sign(x.dl), t: 0 };
        return;
      }
    }
    // --- blok: arkadan gelenin cizgisine kay
    let block = null;
    if (this.aggression > 0.15) {
      for (const x of enemies) {
        if (x.df > -3 || x.df < -22 || x.closing > -0.3) continue;   // arkamda ve yaklasiyor
        if (!block || x.df > block.df) block = x;
      }
    }
    // --- sollama / takip
    let ahead = null;
    for (const x of others) {
      if (x.df < 2 || x.df > 32 || Math.abs(x.dl) > 2.6 || x.closing < 0.8) continue;
      if (!ahead || x.df < ahead.df) ahead = x;
    }
    let target = this.useLine || path !== this.course.route ? 0 : this._insideBias(path, s, R);
    this.follow = null;
    if (ahead) {
      // bos taraf: yolun iki yanindaki yer (rakibin yanal konumuna gore)
      const oOff = this.off + ahead.dl;
      const roomL = R.hi - (oOff + 2.6), roomR = (oOff - 2.6) - R.lo;
      if (roomL > 0.3 || roomR > 0.3) target = roomL >= roomR ? oOff + 2.8 : oOff - 2.8;
      else if (this.cool.bump <= 0 && this.rng() < this.aggression * 0.6) { this.tactic = { type: 'bump', target: ahead.o, t: 0 }; return; }
      else this.follow = ahead;
    } else if (block && this.rng() < 0.4 + 0.5 * this.aggression) {
      target = this.off + block.dl * (0.6 + 0.4 * this.dirty);
    }
    this.offTarget = clamp(target, R.lo, R.hi);
  }

  /** Rota uzerinde (hizli cizgi kullanmayan bot): virajlarda ice yaklas. */
  _insideBias(path, s, R) {
    const c = this._corner(path, s, 0, 35);
    const amt = clamp(Math.abs(c.k) * 45, 0, 1);
    return c.k > 0 ? Math.min(R.hi, 3) * amt : Math.max(R.lo, -3) * amt;
  }

  update(dt, race) {
    const me = this.car, v = me.vehicle, sim = v.sim, b = sim.body;
    const c = this.c;
    c.accel = 0; c.decel = 0; c.steer = 0; c.handbrake = 0;
    const st = me.state;
    if (race.raceState !== 'run' || st.finished) {
      if (st.finished) { // finisten sonra yolu izleyerek fren yap ve dur
        const s = st.progress, path = this.course.route;
        path.pointAt(s + 10, _p);
        const dx = _p.x - b.pos.x, dz = _p.z - b.pos.z, fw = v.forward;
        const yT = fw.x * dz - fw.z * dx, xT = fw.x * dx + fw.z * dz;
        c.steer = clamp(Math.atan2(yT, Math.max(1, xT)) * 2, -1, 1);
        c.decel = sim.forwardSpeed > 1 ? 1 : 0;
      }
      return c;
    }
    for (const k in this.cool) this.cool[k] -= dt;
    const fwd = v.forward;
    const sp = sim.forwardSpeed;
    // --- kurtarma: takla, takilma, rotadan kopma
    const up = 1 - 2 * (b.q.x * b.q.x + b.q.z * b.q.z);
    this.flipT = up < 0.35 ? this.flipT + dt : 0;
    if (this.flipT > 1.2) {
      // ayni yerde ust uste takla: yerinde duzeltmek ayni tuzaga koyar -> rotaya don
      const again = this._lastFlip && sim.time - this._lastFlip.t < 15 && Math.abs((st.idx || 0) - this._lastFlip.i) < 6;
      this._lastFlip = { t: sim.time, i: st.idx || 0 };
      if (again) { race.toRoute(me); this._log('rotaya (takla)', st); } else { v.recover(); this._log('takla', st); }
      this.flipT = 0;
      return c;
    }
    if (this.revT > 0) {
      this.revT -= dt;
      c.decel = 1; c.steer = this._revSteer;
      return c;
    }
    this.stuckT = Math.abs(sp) < 1 ? this.stuckT + dt : 0;
    if (this.stuckT > 2.2) {
      this.stuckT = 0;
      this.stuckN = Math.abs((st.idx || 0) - this.lastStuckIdx) < 3 ? this.stuckN + 1 : 1;
      this.lastStuckIdx = st.idx || 0;
      if (this.stuckN >= 3) { race.toRoute(me); this.stuckN = 0; this._log('rotaya (takildi)', st); return c; }
      this.revT = 1.3; this._revSteer = -Math.sign(this._lastSteer || 1) * 0.8;
      if (this._path() !== this.course.route) this.avoidLine = (st.progress || 0) + 160;
      if (this.tactic) this._endTactic(this.tactic, 4);
      this._log('takildi', st);
      return c;
    }
    // kapiyi kacirdi (itildi, savruldu): oyuncunun R-R'si gibi kapidan once rotaya don
    const Gs = this.course.gates;
    if (st.gate < Gs.length && (st.idx || 0) > Gs[st.gate].i + 3) { race.toRoute(me); this._log('kapi kacti', st); return c; }
    const onCut = this._path() !== this.course.route;
    this.offT = Math.abs(st.lat || 0) > (onCut ? 60 : 22) ? this.offT + dt : 0;
    if (this.offT > 3.5) { race.toRoute(me); this.offT = 0; this._log('rotaya (uzak)', st); return c; }

    // --- aktif yol ve konum
    const path = this._path();
    let s;
    if (path === this.course.route) s = st.progress;
    else {
      this.li = path.nearest(b.pos, this.li, 8, 50);
      if ((path.pts[this.li].x - b.pos.x) ** 2 + (path.pts[this.li].z - b.pos.z) ** 2 > 40 * 40) this.li = path.nearestGlobal(b.pos);
      s = path.project(b.pos, this.li, _pr).s;
    }
    const pr = path.project(b.pos, path.indexAt(Math.max(0, s)), _pr);
    this.off += clamp(this.offTarget - this.off, -2.2 * dt, 2.2 * dt);

    // --- algi ve taktik
    const others = this._perceive(race);
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.12 + this.rng() * 0.08; this._think(race, others, path, s, sp); }
    // hatalar (beceriye gore)
    this.mistakeT -= dt;
    if (this.mistakeT <= 0) {
      this.mistakeT = 4 + this.rng() * 8;
      if (this.rng() < this.mistakes) {
        const r = this.rng();
        this.mistake = r < 0.45 ? { type: 'late', t: 3 } : r < 0.75 ? { type: 'lift', t: 0.6 } : { type: 'wide', t: 1.6, off: (this.rng() < 0.5 ? -1 : 1) * 1.8 };
      }
    }
    if (this.mistake && (this.mistake.t -= dt) <= 0) this.mistake = null;

    let steerBias = 0, leanUntil = -1, forceBrake = 0, throttleMin = 0, speedCap = Infinity, offAdd = 0;
    const T = this.tactic;
    if (T) {
      T.t += dt;
      const x = others.find((q) => q.o === T.target);
      if (!x || T.target.state.finished) this._endTactic(T, 3);
      else if (T.type === 'pit') {
        // hedef arka camurluk: on tamponum hedefin CG'sinin 0.4-2.0 m arkasinda, yaninda
        if (T.phase === 'align') {
          speedCap = Math.max(8, x.vO + clamp((x.zO - 1.1) * 0.9 + 0.8, -4, 6));   // geriden yaklas
          throttleMin = x.zO > 2.5 ? 0.6 : 0;
          offAdd = 0;
          this.offTarget = clamp(this.off + x.dl - T.side * 1.75, -6, 6);
          if (x.zO > 0.2 && x.zO < 2.2 && Math.abs(x.xO) < 2.4) { T.phase = 'hit'; T.t = 0; }
          if (T.t > 3.5 || x.df > 12 || x.df < -6) this._endTactic(T, 5);
        } else if (T.phase === 'hit') {
          steerBias = -T.side * (0.55 + 0.3 * this.aggression);  // + sag; hedef solda (side>0) -> sola kir
          throttleMin = 0.8;
          if (T.t > 0.5 || (sim.lastCarContact && sim.time - sim.lastCarContact < 0.05 && T.t > 0.22)) { T.phase = 'out'; T.t = 0; this._event('pit', T.target); }
        } else if (T.phase === 'out') {
          throttleMin = 0.5;
          if (T.t > 0.7) this._endTactic(T, 9 + this.rng() * 8 * (1.2 - this.aggression));
        }
      } else if (T.type === 'lean') {
        leanUntil = T.until;
        if (Math.abs(sp) < 7) this._endTactic(T, 3);
        offAdd = T.side * 0.9;                     // disariya, rakibe dogru yaslan
        if (s > T.until) { this._endTactic(T, 3); if (sim.lastCarContact && sim.time - sim.lastCarContact < 2) this._event('lean', T.target); }
      } else if (T.type === 'brake') {
        forceBrake = 1;
        if (T.t > T.dur) { this._event('brake', T.target); this._endTactic(T, 12 + this.rng() * 10); }
      } else if (T.type === 'swipe') {
        steerBias = -T.side * 0.42;
        if (T.t > 0.35) { this._endTactic(T, 6 + this.rng() * 6); if (sim.lastCarContact && sim.time - sim.lastCarContact < 0.5) this._event('swipe', T.target); }
      } else if (T.type === 'bump') {
        this.offTarget = clamp(this.off + x.dl, -6, 6);
        throttleMin = 0.75;
        if (T.t > 2.2 || x.df < 2) { this._endTactic(T, 5); if (sim.lastCarContact && sim.time - sim.lastCarContact < 0.6) this._event('bump', T.target); }
      }
    }
    if (this.mistake && this.mistake.type === 'wide') offAdd += this.mistake.off;

    // --- direksiyon: ofsetli ileri bakis noktasi (model tabanli pure pursuit)
    const Ld = clamp(6 + 0.7 * Math.abs(sp), 8, 32);
    path.pointAt(s + Ld, _p, _d);
    const R = this._room(path, s + Ld);
    const off = clamp(this.off + offAdd, R.lo - 0.8, R.hi + 0.8);
    _p.x += _d.z * off; _p.z += -_d.x * off;
    const dx = _p.x - b.pos.x, dz = _p.z - b.pos.z;
    const yT = fwd.x * dz - fwd.z * dx, xT = fwd.x * dx + fwd.z * dz;   // yT + = sag
    const wb = sim.p.dims.wheelbase, S = sim.p.steering;
    const kappa = (2 * yT) / Math.max(1, xT * xT + yT * yT);
    const delta = Math.atan(kappa * wb);
    const asp = Math.abs(sp);
    const grip = (6.6 * sim.p.tire.mu) / 0.9;
    const maxA = Math.min(S.maxAngle, (wb * grip) / Math.max(asp * asp, 1) + 0.02 + 0.02 * clamp(1 - asp / 20, 0, 1));
    c.steer = clamp(delta / maxA + steerBias, -1, 1);
    this._lastSteer = c.steer;

    // --- hiz
    let vt = Math.min(this.plan(path, s, asp, leanUntil), speedCap);
    const vPlan = vt;
    if (this.follow && !T) vt = Math.min(vt, this.follow.vO + clamp((this.follow.df - 9) * 0.5, -4, 3));
    const D = this.dbg;
    D.vt = vt; D.vPlan = vPlan; D.follow = this.follow ? this.follow.o.name : null; D.tactic = T ? `${T.type}/${T.phase || ''}` : null;
    D.path = path === this.course.route ? 'rota' : 'cizgi'; D.off = this.off; D.offT = this.offTarget;
    // uzun sure yavas kalma: nedenini kaydet
    this.slowT = Math.abs(sp) < 4.5 ? (this.slowT || 0) + dt : 0;
    if (this.slowT > 5) { this.slowT = 0; this._log(`yavas vt=${(vt * 3.6).toFixed(0)} plan=${(vPlan * 3.6).toFixed(0)} takip=${D.follow} taktik=${D.tactic} ${D.path}`, st); }
    if (this.mistake && this.mistake.type === 'lift') vt = Math.min(vt, asp - 2);
    const dv = vt - sp;
    if (forceBrake) { c.decel = forceBrake; c.accel = 0; }
    else if (dv > 0) c.accel = Math.min(1, 0.3 + dv * 0.3);
    else if (dv < -1.0 && sp > 2.5) c.decel = Math.min(1, -dv * 0.35);
    else c.accel = 0.12;
    if (throttleMin && !c.decel) c.accel = Math.max(c.accel, throttleMin);
    // surucu ayagi: patinajda gazi azalt (aractaki elektronik TCS degil)
    let slip = 0;
    for (const w of sim.wheels) if (w.driven && w.contact) slip = Math.max(slip, w.slipRatio * Math.sign(sp || 1));
    if (slip > 0.22 && c.accel > 0.3) c.accel *= clamp(1 - (slip - 0.22) * 2.5, 0.35, 1);
    void pr;
    return c;
  }

  _endTactic(T, cool) {
    this.tactic = null;
    if (T.type === 'pit') this.cool.pit = cool;
    else if (T.type === 'brake') this.cool.brake = cool;
    else if (T.type === 'swipe') this.cool.swipe = cool;
    else if (T.type === 'lean') this.cool.lean = cool;
    else if (T.type === 'bump') this.cool.bump = cool;
  }
}
