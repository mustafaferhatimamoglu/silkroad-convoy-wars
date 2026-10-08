import * as THREE from 'three';
import { VehicleSim } from './physics/VehicleSim.js';
import { V3 } from './physics/math.js';
import { presetFor, surfaceInfo } from './presets.js';
import { KartalModel } from './model/KartalModel.js';
import { CarModel } from './model/CarModel.js';
import { SPECS } from './model/specs/index.js';
import { WorldGround } from './WorldGround.js';
import { VehicleReflections } from './Reflections.js';
import { VehicleDamage } from './Damage.js';

// Oyundaki arac: sabit adimli fizik (240 Hz) + ara degerlemeli gorsel model + isiklar.

const STEP = 1 / 240;
const _v = new V3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();

export class Vehicle {
  constructor(app, { variant = 'kartal80', paint = 'lacivert', prep = null, params = null, reflections = true } = {}) {
    this.app = app;
    this.prep = prep || (app.settings ? app.settings.get('vehiclePrep') : 'ralli') || 'ralli';
    this.params = params || presetFor(variant, this.prep);
    this.variant = variant;
    this.sim = new VehicleSim(this.params);
    this.ground = app.collision ? new WorldGround(app.collision) : null;
    this.model = SPECS[variant] ? new CarModel(SPECS[variant], { paint }) : new KartalModel({ variant, paint });
    this.model.alignToPhysics(this.params.cgHeight);
    this.root = this.model.root;
    app.scene.add(this.root);
    this.acc = 0;
    this.headlights = false;
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.steps = 0;
    this._gaugeT = 0;
    this.shadow = this._makeShadowBlob();
    app.scene.add(this.shadow);
    // dinamik yansima (kup kamera) yalniz oyuncu aracinda; rakipler oyuncununkini paylasir (shareReflections)
    this.reflections = reflections ? new VehicleReflections(app, { size: 128 }) : null;
    if (this.reflections) {
      this.reflections.enabled = app.settings ? app.settings.get('quality') !== 'dusuk' : true;
      this.reflections.track(this.model.reflectiveMaterials());
    }
    // menteseli parcalar (kapi, kaput, bagaj): kilit kirilir, savrulur, kopar
    this.root.updateMatrixWorld(true);
    this.damage = new VehicleDamage(this);
    this._reflPos = new THREE.Vector3();
  }

  _makeShadowBlob() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.62)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.38)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    return m;
  }

  /**
   * Araci (x,z) noktasinda zemine yerlestirir. yaw: 0 = kuzey.
   * yHint: bilinen zemin yuksekligi (findSpawn); yoksa arazi yuksekligi esas alinir.
   * above: zemin arama isini bu yuksekligin ne kadar ustunden baslasin. Ipucu varsa kisa
   * tutulur ki arac kemer/cati ustune konmasin; ipucu yoksa 30 m (findSpawn ile ayni kural).
   * (Eskiden isin sabit y=60'tan atiliyordu: zemini 86 m'de olan Iskenderiye'de arac
   * arazinin altina konup bir platformun altina sikisiyordu.)
   */
  spawn(x, z, yaw = 0, yHint = null, above = null) {
    let y = yHint;
    if (this.ground) {
      const terrain = this.app.world ? this.app.world.heightAt(x, z) : null;
      const base = yHint ?? terrain ?? 0;
      const up = above ?? (yHint !== null && yHint !== undefined ? 2 : 30);
      const o = new V3(x, base + up, z), d = new V3(0, -1, 0);
      const hit = this.ground.raycast(o, d, up + 60);
      if (hit) y = hit.point.y;
      else if (y === null || y === undefined) y = base;
    }
    if (y === null || y === undefined) y = 0;
    this.sim.reset(x, y + this.params.cgHeight + 0.06, z, yaw);
    this.acc = 0;
    this._sync(1);
  }

  /**
   * R: araci kurtarir.
   *  - Devrilmis/yan yatmissa ve bulundugu yer duz, su disi ve bossa: yerinde dogrultur (yon korunur).
   *  - Dik ama sikismissa, suya ya da cukura dustuyse veya yerinde dogrultulamiyorsa: geride
   *    (en az 1.5 sn once, 6 m geride) gecilen guvenli noktaya, o anki gidis yonuyle.
   *  - 4 sn icinde tekrar basilirsa her basista bir onceki guvenli noktaya.
   * Hedef, govde kureleriyle denetlenir: duvar, cati, agac ya da kaya icine konmaz.
   * inPlaceOnly: yalniz yerinde dogrultmayi dene (ralli/yaris rotaya kendisi dondurur).
   * Donus: 'upright' | 'safe' | 'none'
   */
  recover({ inPlaceOnly = false } = {}) {
    const b = this.sim.body, now = performance.now();
    const list = this._safe || (this._safe = []);
    const q = b.q;
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);       // govde yukari ekseninin dikey bileseni
    const again = !inPlaceOnly && this._lastRecover && now - this._lastRecover < 4000;
    if (!inPlaceOnly) this._lastRecover = now;
    const groundY = this.app.world ? (this.app.world.heightAt(b.pos.x, b.pos.z) ?? b.pos.y - 1) : b.pos.y - 1;
    const wl = this.app.world ? this.app.world.waterAt(b.pos.x, b.pos.z) : null;
    const inWater = wl !== null && wl !== undefined && wl > Math.min(groundY, b.pos.y - 0.3) + 0.35;
    // 1) devrilmis: yerinde dogrult (yakin cevrede bos ve duz bir yer)
    if (!again && !inWater && upY < 0.6) {
      const yaw = this._headingYaw(list);
      for (const [dx, dz] of [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [2.4, 2.4], [-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4]]) {
        const x = b.pos.x + dx, z = b.pos.z + dz;
        // isin aracin hemen ustunden: ustteki cati/kemer/agac zemin sanilmasin
        const h = this.app.world ? this.app.world.heightAt(x, z) : null;
        const y = this._freeSpot(x, z, Math.max(b.pos.y + 0.6, h !== null && h !== undefined ? h + 0.6 : -Infinity), yaw);
        if (y !== null) { this._place(x, y, z, yaw); return 'upright'; }
      }
    }
    if (inPlaceOnly) return 'none';
    // 2) guvenli nokta: tekrar basildiysa bir oncekine; degilse yeterince eski ve uzak olan en yenisine
    const cut = again ? (this._recIdx ?? list.length) - 1 : list.length - 1;
    for (let i = Math.min(cut, list.length - 1); i >= 0; i--) {
      const p = list[i];
      if (!again && (now - p.t < 1500 || Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 6) && i > 0) continue;
      const y = this._freeSpot(p.x, p.z, p.y + 1.0, p.yaw);
      if (y === null) continue;
      this._recIdx = i;
      this._place(p.x, y, p.z, p.yaw);
      return 'safe';
    }
    // 3) kayit yok: bulundugu yerde dogrult (en azindan dik ve zeminde)
    this.spawn(b.pos.x, b.pos.z, this._headingYaw(list), b.pos.y, 1.2);
    return 'upright';
  }

  /** Aracin yatay yonu: burnun yatay izdusumu (burun dikine bakiyorsa son kaydin yonu). */
  _headingYaw(list) {
    const { x, y, z, w } = this.sim.body.q;
    // govde ileri ekseni (0,0,-1) dunyada
    const fx = -2 * (x * z + w * y), fz = -(1 - 2 * (x * x + y * y));
    if (Math.hypot(fx, fz) < 0.3 && list.length) return list[list.length - 1].yaw;
    return Math.atan2(-fx, -fz);
  }

  /**
   * (x,z) noktasinda arac dik olarak bos bir yere sigar mi? Zemini fromY'den asagi isinla bulur;
   * zemin dik (egim > ~35 derece), su altinda ya da govde kurelerinden biri bir seye giriyorsa null.
   * Donus: zemin yuksekligi.
   */
  _freeSpot(x, z, fromY, yaw) {
    if (!this.ground) return fromY - 1.0;
    _p.set(x, fromY, z); _d.set(0, -1, 0);
    const hit = this.ground.raycast(_p, _d, 8);
    if (!hit || hit.normal.y < 0.82) return null;
    const gy = hit.point.y;
    const wl = this.app.world ? this.app.world.waterAt(x, z) : null;
    if (wl !== null && wl !== undefined && wl > gy + 0.25) return null;
    const cy = gy + this.params.cgHeight + 0.08, c = Math.cos(yaw), s = Math.sin(yaw);
    for (const col of this.params.colliders) {
      const [lx, ly, lz] = col.p;
      // govde ekseni: -z ileri; yaw sola donus (VehicleSim.reset ile ayni)
      _v.set(x + lx * c + lz * s, cy + ly, z - lx * s + lz * c);
      const cs = this.ground.sphereContacts(_v, col.r * 0.92);
      for (const ct of cs) if (ct.depth > 0.03) return null;
    }
    return gy;
  }

  _place(x, gy, z, yaw) {
    this.sim.reset(x, gy + this.params.cgHeight + 0.06, z, yaw);
    this.acc = 0;
    this._sync(1);
    this._recSpot = { x, z };   // buradan 6 m uzaklasana kadar yeni guvenli nokta kaydedilmez
  }

  /** Guvenli nokta gecmisi (yarim saniyede bir, en az 3 m arayla, ~40 sn). */
  _trackSafe(dt) {
    this._safeT = (this._safeT || 0) + dt;
    if (this._safeT < 0.5) return;
    this._safeT = 0;
    const s = this.sim, b = s.body, q = b.q;
    if (1 - 2 * (q.x * q.x + q.z * q.z) < 0.93) return;
    for (const w of s.wheels) if (!w.contact || w.normal.y < 0.87) return;
    const groundY = b.pos.y - this.params.cgHeight;
    const wl = this.app.world ? this.app.world.waterAt(b.pos.x, b.pos.z) : null;
    if (wl !== null && wl !== undefined && wl > groundY - 0.1) return;
    const list = this._safe || (this._safe = []);
    const last = list[list.length - 1];
    if (last && Math.hypot(last.x - b.pos.x, last.z - b.pos.z) < 3) return;
    // kurtarma noktasinin hemen yaninda kayit yok: tekrar R zinciri (her basista daha geri) bozulmasin
    if (this._recSpot) {
      if (Math.hypot(this._recSpot.x - b.pos.x, this._recSpot.z - b.pos.z) < 6) return;
      this._recSpot = null;
    }
    // gidis yonu: ileri gidiyorsa hiz yonu (geri vitesteyken govde yonu)
    const v = b.vel, fwd = s.forwardSpeed;
    const yaw = fwd > 2 ? Math.atan2(-v.x, -v.z) : s.yaw;
    list.push({ x: b.pos.x, y: groundY, z: b.pos.z, yaw, t: performance.now() });
    if (list.length > 80) list.shift();
    this._recIdx = undefined;   // yeni yol katedildi: tekrar basis zinciri sifirlanir
  }

  /** Konum gecmisi (geri sarma icin): 0.1 sn'de bir, son ~16 sn (fizik saati). */
  _trackHistory() {
    const s = this.sim, b = s.body, h = this._hist || (this._hist = []);
    const last = h[h.length - 1];
    if (last && s.time - last.t < 0.1) return;
    const v = b.vel;
    const yaw = s.forwardSpeed > 2 ? Math.atan2(-v.x, -v.z) : this._headingYaw(this._safe || []);
    h.push({ t: s.time, x: b.pos.x, y: b.pos.y - this.params.cgHeight, z: b.pos.z, yaw });
    if (h.length > 160) h.shift();
  }

  /**
   * Zamanda geri sar: fizik saatine gore `from` aninin `seconds` oncesindeki konuma, o anki gidis
   * yonuyle, dik ve duragan koy. Hedef bossa (duvar/cati/su degil) oraya, degilse daha eskisine.
   * Sonraki gecmis silinir (yeni zaman cizgisi). Donus: true ya da (gecmis yoksa) false.
   */
  rewind(seconds, from = this.sim.time) {
    const h = this._hist || [];
    const t = from - seconds;
    let i = h.length - 1;
    while (i > 0 && h[i].t > t) i--;
    for (; i >= 0; i--) {
      const p = h[i];
      const y = this._freeSpot(p.x, p.z, p.y + 1.2, p.yaw);
      if (y === null) continue;
      h.length = i;   // bu noktadan sonrasi silinir; tekrar geri sarma daha eskiye gider
      this._place(p.x, y, p.z, p.yaw);
      return true;
    }
    return false;
  }

  /** Aracin altindaki bolge (carpisma geometrisi) yuklu mu; degilse fizik beklemeli. */
  groundReady() {
    if (!this.ground) return true;
    const b = this.sim.body;
    return this.app.world.isLoadedAt(b.pos.x, b.pos.z);
  }

  update(dt, controls) {
    // arac alti yuklenmemisse fizigi beklet (hizli surerken akis gecikirse)
    if (!this.groundReady()) { this._sync(1); return; }
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 24) {
      this.physicsStep(STEP, controls);
      this.acc -= STEP;
      n++;
    }
    if (n >= 24) this.acc = 0;
    this.steps = n;
    this.postStep(dt, this.acc / STEP);
  }

  /** Tek sabit fizik adimi (yaris dunyasi tum araclari ayni adimla birlikte ilerletir). */
  physicsStep(dt, controls) {
    this.sim.step(dt, controls, this.ground || this.flatGround);
  }

  /** Adimlardan sonra: guvenli nokta kaydi, gorsel senkron (alpha: ara degerleme), hasar, yansima. */
  postStep(dt, alpha) {
    if (this.ground) { this._trackSafe(dt); this._trackHistory(); }
    this._sync(alpha);
    this.damage.update(dt);
    if (this.reflections) {
      this._reflPos.copy(this.position).y += 0.6;
      this.reflections.update(this._reflPos, [this.root, this.shadow]);
    }
  }

  /** Bu aracin boya/krom/cam malzemeleri baska bir aracin yansima haritasini kullansin. */
  shareReflections(from) {
    if (!from.reflections) return;
    for (const m of this.model.reflectiveMaterials()) if (!from.reflections.materials.includes(m)) from.reflections.materials.push(m);
  }

  _sync(alpha) {
    const s = this.sim, b = s.body;
    // ara degerleme (onceki adim -> son adim)
    this.position.set(
      s.prevPos.x + (b.pos.x - s.prevPos.x) * alpha,
      s.prevPos.y + (b.pos.y - s.prevPos.y) * alpha,
      s.prevPos.z + (b.pos.z - s.prevPos.z) * alpha,
    );
    _q.set(s.prevQ.x, s.prevQ.y, s.prevQ.z, s.prevQ.w);
    _q2.set(b.q.x, b.q.y, b.q.z, b.q.w);
    this.quaternion.copy(_q).slerp(_q2, alpha);
    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.quaternion);
    this.velocity.set(b.vel.x, b.vel.y, b.vel.z);
    this.forward.set(0, 0, -1).applyQuaternion(this.quaternion);

    // tekerlekler
    for (let i = 0; i < 4; i++) {
      const w = s.wheels[i], mw = this.model.wheels[i];
      s.wheelLocal(w, _v);
      mw.group.position.set(_v.x, _v.y, _v.z);
      mw.group.rotation.y = -w.steer;
      mw.spin.rotation.x = -w.spin;
    }
    if (this.model.steeringWheel) this.model.steeringWheel.rotation.z = -s.steer * 6.5;

    // isiklar
    const inp = s.input;
    const braking = inp.brake > 0.05 && !s.holding;
    this.model.setLights({ head: this.headlights, brake: braking ? 1 : 0, reverse: s.gearLabel === 'R', tail: this.headlights });

    // zemin golgesi
    _p.copy(this.position);
    const h = this.app.world ? this.app.world.heightAt(_p.x, _p.z) : 0;
    const gy = h ?? this.position.y - this.params.cgHeight;
    this.shadow.position.set(_p.x, Math.max(gy, this.position.y - this.params.cgHeight - 0.6) + 0.03, _p.z);
    this.shadow.rotation.z = Math.atan2(this.forward.x, this.forward.z) + Math.PI;
    const lift = Math.max(0, this.position.y - this.params.cgHeight - gy);
    this.shadow.material.opacity = Math.max(0, 1 - lift * 1.5);
  }

  /** Carpisma olaylarini gorsel hasara cevirir (gocuk, kirik far, catlak cam). */
  applyImpacts(list) {
    if (!list || !list.length) return;
    const inv = _q.copy(this.root.quaternion).invert();
    for (const im of list) {
      if (im.speed < 3) continue;
      const p = _p.set(im.point.x, im.point.y, im.point.z).sub(this.root.position).applyQuaternion(inv).sub(this.model.body.position);
      const d = _d.set(im.normal.x, im.normal.y, im.normal.z).applyQuaternion(inv).normalize();
      const amount = Math.min(0.14, (im.speed - 2.5) * 0.013);
      const radius = 0.32 + Math.min(0.45, im.speed * 0.025);
      this.model.deform(p, d, amount, radius);
      this.damage.impact(p, d, im.speed);
      if (p.z < (this.model.frontZ ?? -1.75) && im.speed > 5) this.model.breakHeadlight(p.x < 0 ? 'L' : 'R');
      if (im.speed > 9) this.model.crackGlass();
    }
  }

  /** Tozlu zeminde kir birikir, suda yikanir. */
  updateDirt(dt) {
    const s = this.sim;
    let dust = 0, n = 0, wet = false;
    const col = this._dirtCol || (this._dirtCol = [0.62, 0.52, 0.38]);
    for (const w of s.wheels) {
      if (!w.contact) continue;
      const info = surfaceInfo(w.surface);
      dust += info.dustAmt; n++;
      if (info.dustAmt > 0.2) for (let k = 0; k < 3; k++) col[k] += (Math.pow(info.dust[k], 2.2) * 0.9 - col[k]) * Math.min(1, dt * 0.05);
      const wl = this.app.world && this.app.world.waterAt(w.point.x, w.point.z);
      if (wl !== null && wl !== undefined && wl > w.point.y + 0.15) wet = true;
    }
    if (n) dust /= n;
    const speed = this.velocity.length();
    this.dirt = Math.min(1, Math.max(0, (this.dirt || 0) + (dust * speed * 0.00055 - (wet ? 0.25 : 0)) * dt));
    this.model.setDirt(this.dirt, col);
  }

  repair() {
    this.damage.repair();
    this.model.repair();
    this.sim.health = this.params.maxHealth;
    this.dirt = 0;
  }

  updateGauges(dt) {
    this._gaugeT += dt;
    if (this._gaugeT < 0.066 || !this.model.gauges) return;
    this._gaugeT = 0;
    this.model.gauges.draw(Math.abs(this.sim.forwardSpeed) * 3.6, this.sim.rpm);
  }

  get speedKmh() { return this.sim.forwardSpeed * 3.6; }

  surfaceUnder() {
    const w = this.sim.wheels.find((x) => x.contact);
    return w ? surfaceInfo(w.surface).name : '—';
  }

  dispose() {
    this.damage.dispose();
    this.app.scene.remove(this.root);
    this.app.scene.remove(this.shadow);
    if (this.reflections) this.reflections.dispose();
  }
}
