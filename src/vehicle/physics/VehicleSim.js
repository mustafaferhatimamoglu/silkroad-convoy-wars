import { V3, Quat, rotate, clamp, sign, smoothstep, lerp } from './math.js';
import { RigidBody } from './RigidBody.js';
import { surfaceInfo } from '../presets.js';

// Arac simulasyonu (sabit adimli, onerilen dt = 1/240 s).
//
//  - Isinli suspansiyon: her teker icin govdenin asagi ekseni boyunca isin; yay + amortisor
//    (sikisma/acilma ayri) + viraj demiri + tampon (bump stop).
//  - Lastik: boyuna kayma orani ve yanal kayma acisina bagli surtunme egrileri, surtunme
//    elipsi, yuk duyarliligi ve zemin malzemesi. Kuvvetler hiz seviyesinde impuls olarak
//    cozulur; dusuk hizda bile kararlidir (yokusta kaymadan durur, titremez).
//  - Aktarma: motor tork egrisi, motor freni, devir siniri, otomatik debriyaj (kalkista
//    patinaj), istenen sayida ileri vites + geri, otomatik/manuel vites, kilitlemeli
//    diferansiyeller. Arkadan itis ya da dort ceker (merkez kavrama ile on/arka dagilim).
//  - Yardimlar: ABS, cekis kontrolu (TCS), hiza bagli direksiyon acisi.
//  - Govde: carpisma kureleri ile arazi/bina temasi, surtunmeli impuls, hasar olaylari.

const UP = new V3(0, 1, 0);
const _up = new V3(), _fwd = new V3(), _right = new V3();
const _p = new V3(), _d = new V3(), _f = new V3(), _s = new V3(), _v = new V3(), _J = new V3(), _t = new V3(), _h = new V3();
const _o = new V3(), _hd = new V3(), _hp = new V3(), _hn = new V3(), _c = new V3();
// Lastik profili: dingilin onunde (geri giderken arkasinda) teker yaricapinin bu oranlarinda
// ek isinlar. Yuvarlak lastik bordur/basamak kenarina tirmanir; tek dikey isinda once tampon
// carpiyordu.
const PROBE = [0.4, 0.75];

function curve(x, peak, slideRatio) {
  // 0 -> tepeye yumusak yukselis, sonra kayma surtunmesine dusus
  if (x < peak) { const t = x / peak; return t * (2 - t); }
  const t = Math.min((x - peak) / (peak * 3), 1);
  return 1 - (1 - slideRatio) * t * t * (3 - 2 * t);
}

function torqueAt(table, rpm) {
  if (rpm <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (rpm <= table[i][0]) {
      const [r0, t0] = table[i - 1], [r1, t1] = table[i];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return table[table.length - 1][1];
}

const RPM = 60 / (2 * Math.PI);

export class VehicleSim {
  constructor(params) {
    this.p = params;
    this.body = new RigidBody(params.mass, params.inertia);
    const P = params, S = P.suspension;
    const mk = (side, front) => {
      const s = front ? S.front : S.rear;
      const track = front ? P.dims.trackF : P.dims.trackR;
      return {
        name: (front ? 'F' : 'R') + (side < 0 ? 'L' : 'R'),
        front, side,
        mount: new V3((side * track) / 2, s.mountY ?? S.mountY, front ? P.axleFront : P.axleRear),
        rest: s.rest, travel: s.travel, k: s.k, bump: s.bump, rebound: s.rebound, arb: s.arb,
        radius: P.wheel.radius, inertia: P.wheel.inertia,
        steerable: front, driven: front ? P.drive === 'awd' : true,
        // durum
        x: 0, xPrev: 0, Fz: 0, contact: false, point: new V3(), normal: new V3(0, 1, 0), surface: 3, object: false,
        omega: 0, spin: 0, steer: 0, driveTorque: 0, brakeTorque: 0, handbrakeTorque: 0,
        slipRatio: 0, slipAngle: 0, slide: 0, vLong: 0, bottomed: false, lastHitPoint: new V3(),
      };
    };
    this.wheels = [mk(-1, true), mk(1, true), mk(-1, false), mk(1, false)];
    this.awd = P.drive === 'awd';
    this.maxGear = P.gearbox.ratios.length - 2;
    this.steer = 0;
    this.engine = { rpm: P.engine.idle, omega: P.engine.idle / RPM, torque: 0, load: 0 };
    this.gear = 1;
    this.targetGear = 1;
    this.shiftTimer = 0;
    this.clutch = 1;
    this.locked = false;
    this.autoShift = true;
    this.assists = { abs: true, tcs: true, steer: true };
    this.autoHold = true;
    this.health = P.maxHealth;
    this.reverseTimer = 0;
    this.tcsCut = 0;
    this.time = 0;
    this.impacts = [];        // carpisma olaylari (oyun tarafi okur ve temizler)
    this.airTime = 0;
    this.speed = 0;
    this.prevPos = new V3();
    this.prevQ = new Quat();
    this.input = { throttle: 0, brake: 0 };
  }

  /** Araci dunyaya yerlestir. yaw: 0 = kuzey (-z), pozitif = sola donus. */
  reset(x, y, z, yaw = 0) {
    const b = this.body;
    b.pos.set(x, y, z);
    b.q.setFromAxisAngle(0, 1, 0, yaw);
    b.vel.set(0, 0, 0); b.angVel.set(0, 0, 0);
    for (const w of this.wheels) { w.x = w.xPrev = 0.14; w.omega = 0; w.contact = false; }
    this.engine.omega = this.p.engine.idle / RPM;
    this.gear = 1; this.shiftTimer = 0; this.clutch = 1; this.locked = false;
    this.prevPos.copy(b.pos); this.prevQ.copy(b.q);
  }

  get yaw() {
    rotate(this.body.q, _f.set(0, 0, -1), _f);
    return Math.atan2(-_f.x, -_f.z);
  }

  /** Ileri hiz (m/s, geri giderken negatif). */
  get forwardSpeed() {
    rotate(this.body.q, _f.set(0, 0, -1), _f);
    return this.body.vel.dot(_f);
  }

  shift(dir) {
    if (this.shiftTimer > 0) return;
    const g = this.gear + dir;
    if (g < -1 || g > this.maxGear) return;
    // geri vitese sadece neredeyse dururken
    if (g === -1 && this.forwardSpeed > 1.5) return;
    if (this.gear === -1 && g === 0 && this.forwardSpeed < -1.5) return;
    this._beginShift(g);
  }

  _beginShift(g) {
    if (g === this.gear) return;
    this.targetGear = g;
    this.shiftTimer = this.p.gearbox.shiftTime;
    this.gear = 0; // gecis sirasinda bos
    this.locked = false;
  }

  ratio(g = this.gear) {
    const r = this.p.gearbox.ratios[g + 1];
    return r * this.p.gearbox.final;
  }

  /**
   * Tek fizik adimi.
   * c: { accel 0..1 (ileri tusu), decel 0..1 (geri/fren tusu), steer -1..1 (+sag), handbrake 0..1, shiftUp, shiftDown }
   * ground: { raycast(o, d, far) -> hit|null, sphereContacts(center, r) -> contacts[] (length = adet) }
   */
  step(dt, c, ground) {
    const P = this.p, b = this.body;
    this.time += dt;
    this.prevPos.copy(b.pos); this.prevQ.copy(b.q);
    rotate(b.q, UP, _up);
    rotate(b.q, _fwd.set(0, 0, -1), _fwd);
    rotate(b.q, _right.set(1, 0, 0), _right);
    const vF = b.vel.dot(_fwd);
    this.speed = b.vel.length();

    this._controls(dt, c, vF);
    this._steering(dt, c.steer || 0, vF);

    // 1) yercekimi + aerodinamik
    b.addForceAtCenter(_v.set(0, -9.81 * b.mass, 0));
    const sp = this.speed;
    if (sp > 0.1) b.addForceAtCenter(_v.copy(b.vel).scale(-0.5 * P.aero.rho * P.aero.cdA * sp));

    // 2) suspansiyon
    this._suspension(dt, ground);

    // 3) kuvvetleri hiza isle
    b.integrateVelocities(dt);

    // 4) aktarma organlari -> teker torklari
    this._drivetrain(dt);

    // 5) lastik impulslari (sira her adimda aynalanir: sirali cozumun sol/sag yanliligi iptal olur)
    this._flip = !this._flip;
    const W = this.wheels;
    if (this._flip) { this._tire(W[0], dt); this._tire(W[1], dt); this._tire(W[2], dt); this._tire(W[3], dt); }
    else { this._tire(W[1], dt); this._tire(W[0], dt); this._tire(W[3], dt); this._tire(W[2], dt); }
    this._syncEngine();

    // 6) govde carpismalari
    this._bodyCollisions(dt, ground);

    // 7) konum
    b.integratePositions(dt);

    for (const w of this.wheels) w.spin = (w.spin + w.omega * dt) % (Math.PI * 2);
    const air = this.wheels.every((w) => !w.contact);
    this.airTime = air ? this.airTime + dt : 0;
  }

  _controls(dt, c, vF) {
    const accel = clamp(c.accel || 0, 0, 1), decel = clamp(c.decel || 0, 0, 1);
    let throttle = 0, brake = 0;
    if (this.autoShift) {
      const g = this.shiftTimer > 0 ? this.targetGear : this.gear;
      if (g >= 1 || g === 0) {
        throttle = accel; brake = decel;
        // duruyorken geri tusu basili -> geri vites
        if (decel > 0.3 && accel < 0.1 && vF < 0.6) {
          this.reverseTimer += dt;
          if (this.reverseTimer > 0.25 && this.gear !== -1) { this._beginShift(-1); this.reverseTimer = 0; }
        } else this.reverseTimer = 0;
      } else if (g === -1) {
        throttle = decel; brake = accel;
        if (accel > 0.3 && decel < 0.1 && vF > -0.6) {
          this.reverseTimer += dt;
          if (this.reverseTimer > 0.15) { this._beginShift(1); this.reverseTimer = 0; }
        } else this.reverseTimer = 0;
      }
    } else {
      throttle = accel; brake = decel;
      if (c.shiftUp) this.shift(1);
      if (c.shiftDown) this.shift(-1);
    }
    // durunca / vites yonunun tersine kayarken otomatik fren tutma (yokusta geri kaymaz)
    this.holding = false;
    const g = this.shiftTimer > 0 ? this.targetGear : this.gear;
    const against = (g >= 1 && vF < -0.05) || (g === -1 && vF > 0.05);
    if (this.autoHold && throttle < 0.04 && brake < 0.04 && !(c.handbrake > 0) && (Math.abs(vF) < 0.35 || against)) {
      brake = against && Math.abs(vF) > 0.35 ? 1 : 0.6;
      this.holding = true;
    }
    this.input.throttle = throttle;
    this.input.brake = brake;
    this.input.handbrake = clamp(c.handbrake || 0, 0, 1);
  }

  _steering(dt, steerIn, vF) {
    const S = this.p.steering;
    const v = Math.abs(vF);
    // 1) giris rampasi: tus 0.25 sn'de tam aciya, birakinca daha hizli merkeze
    const si = this.steerIn || 0;
    const back = Math.abs(steerIn) < Math.abs(si) || sign(steerIn) !== sign(si);
    const inRate = back ? 6.5 : 4.0;
    this.steerIn = si + clamp(steerIn - si, -inRate * dt, inRate * dt);
    // 2) hiza bagli aci siniri: yardimla lastik tutusuna gore (geometri + kayma payi)
    let maxA;
    if (this.assists.steer) {
      const grip = 6.6 * this.p.tire.mu / 0.9;
      maxA = Math.min(S.maxAngle, (this.p.dims.wheelbase * grip) / Math.max(v * v, 1) + 0.02 + 0.02 * clamp(1 - v / 20, 0, 1));
      // karsi direksiyon: sadece arka, onden daha cok kayarken (savrulma) ek aci
      const W = this.wheels;
      const rear = W[2].contact ? Math.abs(W[2].slipAngle) : 0, front = W[0].contact ? Math.abs(W[0].slipAngle) : 0;
      maxA = Math.min(S.maxAngle, maxA + Math.max(0, rear - front) * 1.4);
      // el freni cekiliyken (kasitli kaydirma) direksiyon serbest
      if (this.input.handbrake > 0) maxA = Math.max(maxA, S.maxAngle * 0.65);
    } else {
      maxA = S.maxAngle / (1 + v * 0.06);
    }
    // 3) teker acisi hedefe fiziksel bir hizla yaklasir
    const target = this.steerIn * maxA;
    const rate = S.rate * 1.6;
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    // Ackermann: icteki teker daha fazla doner
    const L = this.p.dims.wheelbase, T = this.p.dims.trackF;
    const a = this.steer;
    if (Math.abs(a) < 1e-4) { this.wheels[0].steer = this.wheels[1].steer = 0; return; }
    const R = L / Math.tan(Math.abs(a));
    const inner = Math.atan(L / (R - T / 2)), outer = Math.atan(L / (R + T / 2));
    const k = S.ackermann;
    const innerA = sign(a) * lerp(Math.abs(a), inner, k), outerA = sign(a) * lerp(Math.abs(a), outer, k);
    // sag donus (a>0): sag teker ic
    this.wheels[0].steer = a > 0 ? outerA : innerA;
    this.wheels[1].steer = a > 0 ? innerA : outerA;
  }

  _suspension(dt, ground) {
    const b = this.body;
    _d.copy(_up).negate();
    const back = b.vel.dot(_fwd) < -0.3;
    for (const w of this.wheels) {
      b.localToWorld(w.mount, _p);
      const r = w.radius, far = w.rest + r;
      // (zemin arayuzu ayni sonuc nesnesini yeniden kullanabilir: degerler hemen kopyalanir)
      let x = -1, surface = 3, object = false;
      const hit = ground.raycast(_p, _d, far + 0.05);
      if (hit && hit.distance <= far && hit.normal.x * _up.x + hit.normal.y * _up.y + hit.normal.z * _up.z > 0.3) {
        x = far - hit.distance;
        _hp.set(hit.point.x, hit.point.y, hit.point.z);
        _hn.set(hit.normal.x, hit.normal.y, hit.normal.z);
        surface = hit.surface ?? 3; object = !!hit.object;
      }
      // lastik profili: yuvarlanma yonunde (on tekerde direksiyon acisiyla) iki isin daha
      rotate(b.q, _h.set(Math.sin(w.steer), 0, -Math.cos(w.steer)), _hd);
      for (let k = 0; k < PROBE.length; k++) {
        const dx = PROBE[k] * r * (back ? -1 : 1);
        _o.copy(_p).addScaled(_hd, dx);
        const h2 = ground.raycast(_o, _d, far + 0.05);
        if (!h2 || h2.distance > far) continue;
        const x2 = w.rest - h2.distance + Math.sqrt(r * r - dx * dx);
        if (x2 <= x + 0.002) continue;
        x = x2;
        _hp.set(h2.point.x, h2.point.y, h2.point.z);
        // temas normali: temas noktasindan teker merkezine (kenar tekeri yukari ve geri iter)
        _c.copy(_p).addScaled(_d, w.rest - x2);
        _hn.copy(_c).sub(_hp).normalize();
        surface = h2.surface ?? 3; object = !!h2.object;
      }
      w.xPrev = w.x;
      if (x >= 0) {
        x = Math.min(x, w.travel + 0.15);
        // amortisor hizi sinirli (lastik esnekligi): basamakta ani sicrama patlama yaratmasin
        const xd = w.contact ? clamp((x - w.x) / dt, -5, 5) : 0;
        w.x = x;
        let F = w.k * x + (xd > 0 ? w.bump : w.rebound) * xd;
        w.bottomed = x > w.travel;
        if (w.bottomed) F += 250000 * (x - w.travel) + 4000 * Math.max(xd, 0);
        w.Fz = Math.max(F, 0);
        w.contact = true;
        w.point.copy(_hp);
        w.normal.copy(_hn);
        w.surface = surface;
        w.object = object;
      } else {
        w.contact = false;
        w.Fz = 0;
        w.x = Math.max(0, w.x - dt * 2.0);
        w.bottomed = false;
      }
    }
    // viraj demirleri
    for (const [l, r] of [[0, 1], [2, 3]]) {
      const L = this.wheels[l], R = this.wheels[r];
      const dx = L.x - R.x;
      const f = L.arb * dx;
      if (L.contact) L.Fz = Math.max(0, L.Fz + f);
      if (R.contact) R.Fz = Math.max(0, R.Fz - f);
    }
    for (const w of this.wheels) {
      if (!w.contact || w.Fz <= 0) continue;
      b.addForce(_v.copy(w.normal).scale(w.Fz), w.point);
    }
  }

  _drivetrain(dt) {
    const P = this.p, E = P.engine, G = P.gearbox, e = this.engine;
    const inp = this.input;
    // vites gecisi
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) { this.gear = this.targetGear; this.shiftTimer = 0; }
    }
    const W = this.wheels, RL = W[2], RR = W[3], FL = W[0], FR = W[1];
    const wd = this._shaftOmega();
    const ratio = this.gear === 0 ? 0 : this.ratio();
    const shaft = wd * ratio; // tekerden gelen motor tarafi acisal hiz
    let rpm = e.omega * RPM;

    // otomatik vites (vites atinca kisa sure geri vitese inmez: oranlar arasi bosluk
    // dar vites bandiyla birlesince 1-2 arasi gidip gelme olmasin)
    this.shiftHold = Math.max(0, (this.shiftHold || 0) - dt);
    if (this.autoShift && this.shiftTimer === 0 && this.gear >= 1) {
      const thr = inp.throttle;
      // tam gazda guc tepesinin biraz ustunde, hafif gazda erken vites (araca ozel devirler)
      const SU = G.shiftUp || [2600, 5600], SD = G.shiftDown || [1300, 2600];
      // hafif gazda erken (ekonomik) vites: esik gazin karesiyle artar, tam devir yalniz dibe yakin
      const t2 = thr * thr;
      const up = lerp(SU[0], SU[1], t2), down = lerp(SD[0], SD[1], t2);
      let slipping = false;
      for (const w of W) if (w.driven && Math.abs(w.slipRatio) > 0.25) slipping = true;
      const shaftRpm = shaft * RPM;
      if (this.gear < this.maxGear && (shaftRpm > up || shaftRpm > E.redline - 150) && !slipping && this.airTime === 0) {
        this._beginShift(this.gear + 1);
        this.shiftHold = 1.2;
      } else if (this.gear > 1 && shaftRpm < down && (this.shiftHold === 0 || shaftRpm < E.idle + 250)) {
        const lowerRpm = wd * this.ratio(this.gear - 1) * RPM;
        if (lowerRpm < E.redline - 400) this._beginShift(this.gear - 1);
      }
    }

    // gaz (TCS ile kesilebilir)
    let thr = inp.throttle * (1 - this.tcsCut);
    // elektronik hiz sinirlayici (varsa)
    if (E.vmax) thr *= clamp((E.vmax - this.forwardSpeed * 3.6) / 4, 0, 1);
    if (this.shiftTimer > 0) thr = 0;
    // hasarli motor guc kaybeder
    const healthF = 0.55 + 0.45 * Math.min(1, this.health / 60);
    const full = torqueAt(E.torque, rpm) * healthF;
    let Te = thr * full - (1 - thr) * E.brakeTorque * full * Math.min(1, rpm / E.redline);
    if (rpm > E.limiter) Te = -E.brakeTorque * full; // yakit kesme
    // rolanti regulatoru
    if (rpm < E.idle && !this.locked) Te += (E.idle - rpm) * 0.35;

    // otomatik debriyaj (vites yonunun tersine yuvarlanirken kavramaz)
    let engage = 1;
    const shaftRpm = Math.max(0, shaft) * RPM;
    if (this.gear === 0 || this.shiftTimer > 0) {
      engage = 0;
      this.clutchRamp = 0;
    } else {
      // kalkis: gaza gore hedef devirde kavrar; yuvarlanirken yol hiziyla kapanir
      const launchRpm = E.idle + 300 + (G.launch || 2600) * inp.throttle;
      const eLaunch = inp.throttle > 0.02 ? smoothstep(E.idle + 100, launchRpm, rpm) : 0;
      const eRoll = smoothstep(E.idle - 100, E.idle + 900, shaftRpm);
      engage = Math.max(eLaunch, eRoll);
      if (inp.brake > 0.1 && inp.throttle < 0.05 && shaftRpm < E.idle + 200) engage = 0;
      // vites sonrasi yumusak kavrama
      this.clutchRamp = Math.min(1, (this.clutchRamp ?? 1) + dt / 0.16);
      engage = Math.min(engage, this.clutchRamp);
    }
    this.clutch = engage;
    const nDriven = this.awd ? 4 : 2;
    const eta = G.efficiency;
    let wheelTorque = 0;
    // Debriyaj: kilitliyken motor + tekerler tek rijit sistemdir (motor ataleti tekerlere
    // yansir, devir tekerlerden gelir). Kayarken kapasite kadar sabit tork iletir. En hafif
    // yuk varsayimiyla (sadece teker ataleti) bile senkron tutulabiliyorsa kilitlenir ->
    // tek adimda yon degistiren (titreyen) debriyaj torku olusmaz.
    const cap = engage * G.clutchTorque;
    if (ratio === 0 || engage <= 0) this.locked = false;
    else if (this.locked && (Math.abs(Te) > cap * 1.05 || shaftRpm < E.idle * 0.85)) this.locked = false;
    let Tc = 0;
    if (!this.locked && ratio !== 0 && engage > 0) {
      const IdMin = (nDriven * RL.inertia) / (ratio * ratio);
      const Tlock = (e.omega - shaft + (Te / E.inertia) * dt) / (dt * (1 / E.inertia + 1 / IdMin));
      if (Math.abs(Tlock) <= cap && shaftRpm >= E.idle * 0.85) { this.locked = true; e.omega = shaft; }
      else Tc = clamp(Tlock, -cap, cap);
    }
    if (this.locked) {
      wheelTorque = (Te * ratio * eta) / nDriven;
      this.reflectedInertia = (E.inertia * ratio * ratio) / nDriven;
    } else {
      e.omega += ((Te - Tc) / E.inertia) * dt;
      if (e.omega < 300 / RPM) e.omega = 300 / RPM;
      wheelTorque = (Tc * ratio * eta) / nDriven;
      this.reflectedInertia = 0;
    }
    e.torque = Te; e.load = thr;

    // diferansiyeller (kilitlemeli): hizli tekerden yavasa tork aktar
    const D = P.diff;
    if (this.awd) {
      // merkez: on/arka dagilim + viskoz kavrama (hizli akstan yavasa); wheelTorque teker basinadir
      const total = wheelTorque * 4;
      const fs = D.front ?? 0.5;
      const center = (D.center || 0) * ((FL.omega + FR.omega) / 2 - (RL.omega + RR.omega) / 2);
      const Tf = total * fs - center, Tr = total * (1 - fs) + center;
      const lf = (D.lsdFront || 0) * (FL.omega - FR.omega), lr = (D.lsd || 0) * (RL.omega - RR.omega);
      FL.driveTorque = Tf / 2 - lf; FR.driveTorque = Tf / 2 + lf;
      RL.driveTorque = Tr / 2 - lr; RR.driveTorque = Tr / 2 + lr;
    } else {
      const lsd = D.lsd * (RL.omega - RR.omega);
      RL.driveTorque = wheelTorque - lsd;
      RR.driveTorque = wheelTorque + lsd;
      FL.driveTorque = FR.driveTorque = 0;
    }

    // frenler (ayak freni ABS'e tabi, el freni degil)
    const B = P.brakes;
    const hb = this.input.handbrake;
    for (const w of this.wheels) {
      w.brakeTorque = (w.front ? B.front : B.rear) * inp.brake;
      w.handbrakeTorque = w.front ? 0 : B.handbrake * hb;
    }
  }

  /** Tahrik milinin teker tarafindaki acisal hizi (tahrikli tekerlerin ortalamasi). */
  _shaftOmega() {
    const W = this.wheels;
    return this.awd ? (W[0].omega + W[1].omega + W[2].omega + W[3].omega) / 4 : (W[2].omega + W[3].omega) / 2;
  }

  /** Kilitli debriyajda motor devri tekerlerden gelir; cok duserse debriyaj ayrilir. */
  _syncEngine() {
    if (!this.locked) return;
    const E = this.p.engine;
    const shaft = this._shaftOmega() * this.ratio();
    if (shaft * RPM < E.idle * 0.85) {
      this.locked = false;
      this.engine.omega = Math.max(this.engine.omega, E.idle / RPM);
    } else {
      this.engine.omega = shaft;
    }
  }

  _tire(w, dt) {
    const b = this.body;
    const T = this.p.tire;
    const I = w.inertia + (w.driven ? this.reflectedInertia || 0 : 0);
    const R = w.radius;
    // tahrik torku
    const w1 = w.omega + (w.driveTorque / I) * dt;

    if (!w.contact || w.Fz <= 0) {
      // havada: fren + hafif yatak surtunmesi
      let om = w1;
      const dB = ((w.brakeTorque + w.handbrakeTorque) / I) * dt;
      om = Math.abs(om) <= dB ? 0 : om - sign(om) * dB;
      w.omega = om * Math.exp(-0.4 * dt); w.slipRatio = 0; w.slipAngle = 0; w.slide = 0;
      return;
    }
    const surf = surfaceInfo(w.surface);
    const loose = surf.mu < 0.95 ? (T.loose || 0) : 0;
    const surfMu = surf.mu + (1 - surf.mu) * loose;
    const n = w.normal;
    // teker yonu (direksiyon acisi govde ekseninde)
    const st = w.steer;
    _h.set(Math.sin(st), 0, -Math.cos(st));
    rotate(b.q, _h, _f);
    _f.projectOnPlane(n).normalize();
    _s.crossVectors(_f, n).normalize();
    b.velocityAt(w.point, _v);
    const vLong = _v.dot(_f), vLat = _v.dot(_s);

    const Fz0 = (this.p.mass * 9.81) / 4;
    const mu = T.mu * surfMu * Math.max(0.5, 1 - T.loadSens * (w.Fz / Fz0 - 1)) * (0.92 + 0.08 * Math.min(1, this.health / 50));
    const maxJ = mu * w.Fz * dt;

    // fren torku: ayak freni (ideal ABS: lastigin tasiyabilecegi tepe torku asmaz) + el freni
    let Tb = w.brakeTorque;
    if (this.assists.abs && Tb > 0) Tb = Math.min(Tb, mu * w.Fz * R * 0.97);
    Tb += w.handbrakeTorque;
    // yuvarlanma direnci de fren gibi donusu yavaslatan bir torktur
    // gevsek zeminde (kum, camur) yuvarlanma direnci: arazi lastigi az, alcak profilli yol lastigi cok batar
    Tb += T.rolling * (1 + (surf.rolling - 1) * (1 - loose) * (surf.mu < 0.95 ? (T.sink ?? 1) : 1)) * w.Fz * R;
    const TbDt = Tb * dt;

    // ---- boyuna: teker + fren + zemin birlikte cozulur
    const kL = b.invMassAt(w.point, _f);
    let Jl;
    const J0 = -vLong / kL;                  // teker tutulursa temas noktasini durduracak impuls
    const Jb0 = J0 * R - I * w1;             // bunun icin gereken fren impulsu
    if (TbDt > 0 && Math.abs(Jb0) <= TbDt) {
      Jl = J0;                               // fren tekeri tutuyor (park / durus)
    } else {
      const A = I + (R * R) / kL;
      const wFree = (I * w1 + (R * vLong) / kL) / A;   // tutunarak serbest yuvarlanma
      let wNew = (I * w1 + (R * vLong) / kL - sign(wFree) * TbDt) / A;
      if (sign(wNew) !== sign(wFree)) wNew = 0;
      Jl = (wNew * R - vLong) / kL;
    }
    // statik surtunmeyi asarsa kayar (patinaj / kilitlenme): kinetik surtunme
    const slip0 = w1 * R - vLong;
    if (Math.abs(Jl) > maxJ) {
      const kappa = Math.abs(slip0) / Math.max(Math.abs(vLong), 1.0);
      Jl = sign(Jl) * maxJ * curve(Math.max(kappa, T.peakRatio), T.peakRatio, T.slideRatio);
    }

    // ---- yanal: kayma acisina bagli kuvvet, yanal hizi asmayacak sekilde (dusuk hizda kararli)
    const kLat = b.invMassAt(w.point, _s);
    const Jcancel = -vLat / kLat;
    // lastik gecikmesi (relaxation length): yanal kuvvet kayma acisini ~0.45 m yolda yakalar
    const alphaRaw = Math.atan2(vLat, Math.max(Math.abs(vLong), 0.5));
    const relax = Math.min(1, (dt * Math.max(Math.abs(vLong), 1.5)) / 0.45);
    w.alphaEff = (w.alphaEff || 0) + (alphaRaw - (w.alphaEff || 0)) * relax;
    const muY = curve(Math.abs(w.alphaEff), T.peakSlip, T.slideRatio);
    let Jy = -sign(w.alphaEff) * muY * maxJ;
    if (Jy * Jcancel < 0) Jy = 0;                         // gecikmeden dolayi ters itme olmasin
    else if (Math.abs(Jy) > Math.abs(Jcancel)) Jy = Jcancel;

    // ---- surtunme elipsi
    const r = Math.hypot(Jl, Jy) / maxJ;
    if (r > 1) { Jl /= r; Jy /= r; }

    // teker acisal hizi: tahrik + zemin + fren (sifirdan ote ters cevirmez)
    let omega = w1 - (Jl * R) / I;
    const dB = TbDt / I;
    omega = Math.abs(omega) <= dB ? 0 : omega - sign(omega) * dB;
    _J.copy(_f).scale(Jl).addScaled(_s, Jy);
    b.applyImpulse(_J, w.point);
    w.omega = omega;
    // impuls sonrasi gercek kayma (TCS/efektler bunu kullanir)
    const vLongPost = vLong + Jl * kL, vLatPost = vLat + Jy * kLat;
    const slipPost = omega * w.radius - vLongPost;
    w.vLong = vLongPost;
    w.slipRatio = slipPost / Math.max(Math.abs(vLongPost), 1.0);
    w.slipAngle = Math.atan2(vLatPost, Math.max(Math.abs(vLongPost), 0.5));
    // gorsel/ses icin kayma miktari (m/s)
    w.slide = Math.hypot(Math.abs(slipPost) > 0.5 ? slipPost : 0, Math.abs(vLatPost) > 0.5 ? vLatPost : 0);

    // TCS: tahrik tekeri patinaj yapiyorsa gazi kes
    if (w.driven && this.assists.tcs) {
      const over = Math.max(0, w.slipRatio * sign(vLong || 1) - 0.16);
      this.tcsCut = clamp(this.tcsCut + (over > 0 ? 6 : -3) * dt, 0, 0.85);
    }
  }

  _bodyCollisions(dt, ground) {
    const b = this.body;
    for (const col of this.p.colliders) {
      _p.set(col.p[0], col.p[1], col.p[2]);
      b.localToWorld(_p, _p);
      const contacts = ground.sphereContacts(_p, col.r);
      const n = contacts.length;
      for (let i = 0; i < n; i++) {
        const ct = contacts[i];
        if (ct.depth <= 0) continue;
        _t.set(ct.normal.x, ct.normal.y, ct.normal.z);
        // konum duzeltme (sadece oteleme; kucuk tolerans)
        const corr = Math.max(ct.depth - 0.004, 0) * 0.6;
        b.pos.addScaled(_t, corr);
        _d.set(ct.point.x, ct.point.y, ct.point.z);
        b.velocityAt(_d, _v);
        const vn = _v.dot(_t);
        if (vn >= 0) continue;
        const kN = b.invMassAt(_d, _t);
        const e = -vn > 2.5 ? 0.18 : 0.0;
        const jn = (-(1 + e) * vn) / kN;
        _J.copy(_t).scale(jn);
        b.applyImpulse(_J, _d);
        // surtunme (metal surtme)
        b.velocityAt(_d, _v);
        _v.addScaled(_t, -_v.dot(_t));
        const vt = _v.length();
        if (vt > 1e-4) {
          _v.scale(1 / vt);
          const kT = b.invMassAt(_d, _v);
          const jt = Math.min(vt / kT, 0.4 * jn);
          _J.copy(_v).scale(-jt);
          b.applyImpulse(_J, _d);
        }
        if (-vn > 2.2) {
          this.impacts.push({ speed: -vn, point: _d.clone(), normal: _t.clone(), local: new V3(col.p[0], col.p[1], col.p[2]), object: !!ct.object });
          const dmg = Math.pow(-vn - 2.2, 1.35) * 1.15;
          this.health = Math.max(0, this.health - dmg);
        }
      }
    }
    if (this.impacts.length > 32) this.impacts.splice(0, this.impacts.length - 32);
  }

  /** Teker merkezinin govde-yerel konumu (gorsel icin). */
  wheelLocal(w, out) {
    return out.set(w.mount.x, w.mount.y - (w.rest - w.x), w.mount.z);
  }

  get rpm() { return this.engine.omega * RPM; }
  get gearLabel() {
    const g = this.shiftTimer > 0 ? this.targetGear : this.gear;
    return g === -1 ? 'R' : g === 0 ? 'N' : String(g);
  }
}
