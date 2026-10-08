import * as THREE from 'three';
import { Vehicle } from '../vehicle/Vehicle.js';
import { VehicleCamera, CAMERA_NAMES } from '../vehicle/VehicleCamera.js';
import { DriveHud } from '../ui/DriveHud.js';
import { cityById } from '../data/cities.js';
import { VehicleEffects } from '../vehicle/effects/VehicleEffects.js';
import { VehicleAudio } from '../vehicle/VehicleAudio.js';
import { musicForRegion } from '../core/AudioSystem.js';
import { Transport } from '../world/Transport.js';

// Serbest surus modu: Silkroad dunyasinda Tofas Kartal.

export class DriveMode {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = opts;
    this.focus = new THREE.Vector3();
    this.ctl = { accel: 0, decel: 0, steer: 0, handbrake: 0, shiftUp: false, shiftDown: false };
    this.paused = false;
    this.onPause = opts.onPause || null;
  }

  enter() {
    const app = this.app, s = app.settings;
    this.vehicle = new Vehicle(app, { variant: this.opts.variant || s.get('vehicleVariant'), paint: this.opts.paint || s.get('vehicleColor') });
    this.vehicle.sim.autoShift = s.get('transmission') !== 'manual';
    this.applyAssists(s.get('assists'));
    const city = this.opts.city ? cityById(this.opts.city) : cityById('hotan');
    const p = app.world.toThree(city.rx, city.rz, city.lx, 0, city.lz, new THREE.Vector3());
    this.vehicle.spawn(this.opts.x ?? p.x, this.opts.z ?? p.z, this.opts.yaw ?? city.heading, this.opts.y ?? null);
    this.camera = new VehicleCamera(app, this.vehicle, s.get('camera'));
    // feribotlar vb. (yalniz serbest surus; ralli/yaris kendi dunyasinda kalir)
    this.transport = this.opts.transport === false ? null : new Transport(app);
    this.hud = new DriveHud(app, app.ui);
    this.hud.toast(`${city.name} — iyi yolculuklar!`, 3);
    this.vehicle.headlights = app.sky.night > 0.5;
    this.focus.copy(this.vehicle.position);
    this.effects = new VehicleEffects(app, this.vehicle);
    this.sound = new VehicleAudio(app.audio, this.vehicle, { engine: s.get('engineSound') });
    this._musicT = 0;
  }

  /** Arac surumunu degistir (garajdan); konum ve yon korunur. */
  rebuildVehicle(variant, paint) {
    const app = this.app, old = this.vehicle, b = old.sim.body;
    const x = b.pos.x, y = b.pos.y, z = b.pos.z, yaw = old.sim.yaw, head = old.headlights, auto = old.sim.autoShift;
    this.sound.dispose(); this.effects.dispose(); old.dispose();
    this.vehicle = new Vehicle(app, { variant, paint });
    this.vehicle.sim.reset(x, y + 0.15, z, yaw);
    this.vehicle.sim.autoShift = auto;
    this.vehicle.headlights = head;
    this.applyAssists(app.settings.get('assists'));
    this.camera.vehicle = this.vehicle;
    this.effects = new VehicleEffects(app, this.vehicle);
    this.sound = new VehicleAudio(app.audio, this.vehicle, { engine: app.settings.get('engineSound') });
  }

  applyAssists(level) {
    const a = this.vehicle.sim.assists;
    const eq = this.vehicle.params.equipment || {};
    a.abs = level !== 'kapali' && eq.abs !== false;
    a.tcs = (level === 'tam' || level === 'orta') && eq.tcs !== false;
    if (!a.tcs) this.vehicle.sim.tcsCut = 0;
    a.steer = level !== 'kapali';
  }

  _readControls(dt) {
    const { input } = this.app;
    const gp = input.gamepad;
    const c = this.ctl;
    const ramp = (cur, target, up, down) => (target > cur ? Math.min(target, cur + up * dt) : Math.max(target, cur - down * dt));
    const kAccel = input.down('KeyW', 'ArrowUp') ? 1 : 0;
    const kDecel = input.down('KeyS', 'ArrowDown') ? 1 : 0;
    // gaz aninda tepki versin (0.08 sn'de tam gaz)
    c.accel = Math.max(ramp(c.accel, kAccel, 12, 10), gp ? gp.throttle : 0);
    c.decel = Math.max(ramp(c.decel, kDecel, 6, 10), gp ? gp.brake : 0);
    let steer = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    if (gp && Math.abs(gp.steer) > 0.02) steer = Math.sign(gp.steer) * Math.pow(Math.abs(gp.steer), 1.5);
    c.steer = steer;
    c.handbrake = input.down('Space') || (gp && gp.buttons[0] > 0.5) ? 1 : 0;
    c.shiftUp = input.pressed('KeyE') || (gp && gp.pressed(5));
    c.shiftDown = input.pressed('KeyQ') || (gp && gp.pressed(4));
    return c;
  }

  update(dt) {
    const { input } = this.app;
    if (input.pressed('Escape') && this.onPause) { this.onPause(); }
    if (this.paused) { this.camera.update(0, input); return; }
    const c = this._readControls(dt);
    this._keys();
    // gemideyken arac fizigi durur, araci gemi tasir
    if (!(this.transport && this.transport.update(dt, this))) this._stepVehicles(dt, c);
    this._afterVehicle(dt);
  }

  /** Tus komutlari: kamera, far, duzeltme, sanziman, yardim, motor sesi, muzik, korna. */
  _keys() {
    const { input, settings } = this.app;
    const v = this.vehicle;
    if (input.pressed('KeyC') || (input.gamepad && input.gamepad.pressed(3))) {
      const m = this.camera.next();
      settings.set('camera', m);
      this.hud.toast(`Kamera: ${CAMERA_NAMES[m]}`, 1.2);
    }
    if (input.pressed('KeyL')) { v.headlights = !v.headlights; this.hud.toast(v.headlights ? 'Farlar açık' : 'Farlar kapalı', 1.2); }
    this._rewindKey(input);
    if (input.pressed('KeyT')) {
      v.sim.autoShift = !v.sim.autoShift;
      settings.set('transmission', v.sim.autoShift ? 'auto' : 'manual');
      this.hud.toast(v.sim.autoShift ? 'Otomatik şanzıman' : 'Manuel şanzıman (Q / E)', 1.6);
    }
    if (input.pressed('F1')) this.hud.toggleHelp();
    if (input.pressed('KeyN')) {
      const on = !settings.get('engineSound');
      settings.set('engineSound', on); this.sound.setEngine(on);
      this.hud.toast(on ? 'Motor sesi açık' : 'Motor sesi kapalı', 1.2);
    }
    if (input.pressed('KeyM')) {
      this.app.audio.setMusicMuted(!this.app.audio.musicMuted);
      this.hud.toast(this.app.audio.musicMuted ? 'Müzik kapalı' : 'Müzik açık', 1.2);
    }
    this.sound.horn(input.down('KeyH') || !!(input.gamepad && input.gamepad.buttons[10] > 0.5));
  }

  /** Fizik: serbest suruste yalniz oyuncu araci (yaris modu tum araclari birlikte adimlar). */
  _stepVehicles(dt, c) {
    this.vehicle.update(dt, c);
  }

  /** Arac adimindan sonra: gostergeler, hasar olaylari, kir, kamera, ses, efektler, HUD, muzik. */
  _afterVehicle(dt) {
    const { input } = this.app;
    const v = this.vehicle;
    v.updateGauges(dt);
    // carpismalarda kamera sarsintisi
    if (v.sim.impacts.length) {
      for (const im of v.sim.impacts) this.camera.addShake(Math.min(1, im.speed / 12));
      v.lastImpacts = v.sim.impacts.splice(0);
      v.applyImpacts(v.lastImpacts);
    }
    // menteseli parca olaylari
    if (v.damage.events.length) {
      for (const ev of v.damage.events) {
        if (ev.type === 'shatter') { this.effects.glass(ev.point); this.sound.glass(1); }
        else if (ev.type === 'detach') { this.effects.debris(ev.point); this.sound.clank(1); this.camera.addShake(0.3); }
        else if (ev.type === 'open') this.sound.clank(0.5);
        else if (ev.type === 'slam') this.sound.clank(0.35);
      }
      v.damage.events.length = 0;
    }
    v.updateDirt(dt);
    // bozuk zeminde hafif sarsinti
    const rough = v.sim.wheels.reduce((a, w) => a + (w.contact ? Math.abs(w.x - w.xPrev) : 0), 0);
    if (rough > 0.004) this.camera.addShake(Math.min(0.15, rough * 3));
    this.camera.update(dt, input);
    this.sound.setView(this.camera.mode);
    this.sound.update(dt);
    this.effects.update(dt);
    this.hud.update(dt, v, this.camera.mode);
    this.focus.copy(v.position);
    // bolge muzigi
    this._musicT -= dt;
    if (this._musicT <= 0) {
      this._musicT = 2;
      const p = this.app.world.fromThree(v.position.x, v.position.z);
      this.app.audio.playMusic(musicForRegion(p.rx, p.rz));
    }
  }

  /**
   * R (kumandada X) basili tutma kademeleri, basildigi andan itibaren:
   *   bas: 1 sn geriye | 1 sn tut: 5 sn geriye | 2 sn tut: 10 sn geriye | 3 sn tut: rotaya (ralli/yaris)
   * Her kademe basis anina gore geri sarar (birikmez). Gecmis yoksa eski kurtarma (dogrult/guvenli nokta).
   */
  _rewindKey(input) {
    const gp = input.gamepad;
    const down = input.down('KeyR') || !!(gp && gp.buttons[2] > 0.5);
    const now = performance.now() / 1000;
    if (!down) { this._rw = null; return; }
    if (!this._rw) {
      this._rw = { t0: now, simT0: this.vehicle.sim.time, stage: 0 };
      this._rewindTo(1);
      return;
    }
    const held = now - this._rw.t0;
    const tiers = this._routeTier ? [[1, 5], [2, 10], [3, 'route']] : [[1, 5], [2, 10]];
    for (let k = 0; k < tiers.length; k++) {
      if (this._rw.stage <= k && held >= tiers[k][0]) {
        this._rw.stage = k + 1;
        if (tiers[k][1] === 'route') this._routeTier();
        else this._rewindTo(tiers[k][1]);
      }
    }
  }

  _rewindTo(sec) {
    const v = this.vehicle;
    const ok = v.rewind(sec, this._rw.simT0);
    if (!ok) v.recover();
    this.camera.initialized = false;
    this._afterTeleport();
    const next = sec === 1 ? 'basılı tut: 5 sn' : sec === 5 ? 'basılı tut: 10 sn' : this._routeTier ? 'basılı tut: rotaya dön' : '';
    this.hud.toast(`${ok ? `${sec} sn geri` : 'Araç doğrultuldu'}${next ? ` (${next})` : ''}`, 1.4);
  }

  /** Isinlanmadan sonra (geri sarma/rota): yaris/ralli ilerleme takibi sifirlanir. */
  _afterTeleport() {}

  dispose() {
    if (this.transport) this.transport.dispose();
    this.sound.dispose();
    this.effects.dispose();
    this.vehicle.dispose();
    this.hud.dispose();
  }
}
