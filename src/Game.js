import * as THREE from 'three';
import { Menu } from './ui/Menu.js';
import { cityById } from './data/cities.js';
import { GarageMode } from './modes/GarageMode.js';
import { DriveMode } from './modes/DriveMode.js';
import { ExploreMode } from './modes/ExploreMode.js';

// Oyun denetleyicisi: modlar arasi gecis, sehir yukleme ekranlari, menuler, ayarlar.

class LoadingMode {
  constructor(pos) { this.focus = pos.clone(); }
  update() {}
}

export class Game {
  constructor(app) {
    this.app = app;
    app.game = this;
    this.menu = new Menu(app.ui, this);
    this.overlay = null;
  }

  // ------------------------------------------------------------ yukleme
  _overlay(text) {
    if (!this.overlay) {
      const el = document.createElement('div');
      el.id = 'loading';
      el.innerHTML = '<h1>SILKROAD</h1><div class="sub">CONVOY WARS · V4</div><div class="bar"><div></div></div><div class="msg"></div>';
      this.app.ui.appendChild(el);
      this.overlay = el;
    }
    this.overlay.classList.remove('fade');
    this.overlay.querySelector('.msg').textContent = text;
    return this.overlay;
  }

  _hideOverlay() {
    const el = this.overlay;
    if (!el) return;
    el.classList.add('fade');
    this.overlay = null;
    setTimeout(() => el.remove(), 700);
  }

  cityPos(id) {
    const c = cityById(id);
    return { city: c, pos: this.app.world.toThree(c.rx, c.rz, c.lx, 0, c.lz, new THREE.Vector3()) };
  }

  /** Sehrin cevresindeki bolgeler (objeleriyle) yuklenene kadar bekler. */
  async loadArea(pos, label, external = null) {
    const app = this.app;
    const ov = external || this._overlay(label);
    if (!app.mode || !app.mode.focus || app.mode.focus.distanceTo(pos) > 50) app.setMode(new LoadingMode(pos));
    const t0 = performance.now();
    while (!app.world.readyAround(pos.x, pos.z, 1)) {
      const s = app.world.stats;
      const total = Math.max(1, s.near + s.pendingNear);
      if (ov.querySelector) {
        ov.querySelector('.bar > div').style.width = `${Math.round((s.near / total) * 90)}%`;
        ov.querySelector('.msg').textContent = `${label} (${s.near}/${total})`;
      } else if (ov.set) ov.set(0.2 + (s.near / total) * 0.75, `${label} (${s.near}/${total})`);
      await new Promise((r) => setTimeout(r, 100));
      if (performance.now() - t0 > 60000) break;
    }
  }

  groundTop(x, z) {
    const hit = { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), object: false, surface: 0 };
    if (this.app.collision.raycast(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0), 900, hit)) return hit.point.y;
    return this.app.world.heightAt(x, z) ?? 0;
  }

  /**
   * Arac icin guvenli dogma noktasi: duz, su ve duvar olmayan, cati ustu olmayan,
   * onu en acik yone bakan bir yer. Merkezden spiral aranir.
   */
  findSpawn(center, preferHeading = 0) {
    const { world, collision } = this.app;
    const hit = { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), object: false, surface: 0 };
    const contacts = Array.from({ length: 6 }, () => ({ point: new THREE.Vector3(), normal: new THREE.Vector3(), depth: 0, object: false }));
    const probe = new THREE.Vector3();
    const surfaceAt = (x, z) => {
      const th = world.heightAt(x, z);
      if (th === null) return null;
      if (!collision.raycast(probe.set(x, th + 30, z), new THREE.Vector3(0, -1, 0), 60, hit)) return null;
      const y = hit.point.y;
      if (hit.normal.y < 0.965) return null;            // egimli
      if (hit.object && (y > th + 2.6 || y < th - 1.5)) return null; // cati, duvar ustu
      const wtr = world.waterAt(x, z);
      if (wtr !== null && wtr > y - 0.3) return null;   // su
      return y;
    };
    const clear = (x, y, z, r = 2.3) => {
      const n = collision.sphereContacts(probe.set(x, y + 1.0 + r * 0.5, z), r, contacts, 6);
      for (let i = 0; i < n; i++) if (contacts[i].object && Math.abs(contacts[i].normal.y) < 0.75) return false;
      return true;
    };
    for (let r = 0; r <= 140; r += 4) {
      const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 4);
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
        const y = surfaceAt(x, z);
        if (y === null || !clear(x, y, z)) continue;
        // en acik yon: onde 24 m'ye kadar bos yol, arkada takip kamerasi icin 6 m
        let best = -1, bestH = preferHeading;
        const freeDist = (fx, fz, max, step) => {
          let free = 0;
          for (let d = step; d <= max; d += step) {
            const yy = surfaceAt(x + fx * d, z + fz * d);
            if (yy === null || Math.abs(yy - y) > 1.2 || !clear(x + fx * d, yy, z + fz * d, 1.8)) break;
            free = d;
          }
          return free;
        };
        for (let hk = 0; hk < 8; hk++) {
          const hd = preferHeading + (hk * Math.PI) / 4;
          const fx = -Math.sin(hd), fz = -Math.cos(hd);
          // dort teker de ayni duzlemde mi (kaldirim/platform kenarina yamuk oturmasin)
          let flat = true;
          for (const [lat, lon] of [[-0.8, -1.5], [0.8, -1.5], [-0.8, 1.6], [0.8, 1.6]]) {
            const wx = x + fx * lon + fz * lat, wz = z + fz * lon - fx * lat;
            const yy = surfaceAt(wx, wz);
            if (yy === null || Math.abs(yy - y) > 0.1) { flat = false; break; }
          }
          if (!flat) continue;
          if (freeDist(-fx, -fz, 6, 3) < 6) continue;
          const free = freeDist(fx, fz, 24, 6);
          if (free > best) { best = free; bestH = hd; }
          if (free >= 24) break;
        }
        if (best >= 12) return { x, y, z, heading: bestH };
      }
    }
    return { x: center.x, y: this.groundTop(center.x, center.z), z: center.z, heading: preferHeading };
  }

  // ------------------------------------------------------------ ekranlar
  async boot(loading) {
    const id = this.app.settings.get('lastCity') || 'hotan';
    const { pos } = this.cityPos(id);
    await this.loadArea(pos, 'Bölgeler yükleniyor…', loading);
    this.showMainMenu(id);
  }

  showMainMenu(id = this.app.settings.get('lastCity') || 'hotan') {
    const app = this.app, s = app.settings;
    const { city, pos } = this.cityPos(id);
    const top = this.groundTop(pos.x, pos.z);
    this.menuMode = new GarageMode(app, { variant: s.get('vehicleVariant'), paint: s.get('vehicleColor'), at: new THREE.Vector3(pos.x, top, pos.z), cinematic: true, yaw: city.heading });
    app.setMode(this.menuMode);
    this.menu.main();
    app.audio.playMusic('maintheme_cut.ogg');
  }

  previewCar(paintOnly = false) {
    const m = this.menuMode, s = this.app.settings;
    if (!m || this.app.mode !== m) return;
    if (paintOnly) m.vehicle.model.setPaint(s.get('vehicleColor'));
    else m.rebuild(s.get('vehicleVariant'), s.get('vehicleColor'));
  }

  garageCamera(on) { if (this.menuMode) this.menuMode.setGarageView(on); }

  async startDrive(id, viaMenu = true) {
    const app = this.app;
    const { city, pos } = this.cityPos(id);
    this.menu.clear();
    await this.loadArea(pos, `${city.name} yükleniyor…`);
    const sp = this.findSpawn(pos, city.heading);
    const mode = new DriveMode(app, { city: id, x: sp.x, y: sp.y, z: sp.z, yaw: sp.heading, onPause: () => this.pauseDrive() });
    app.setMode(mode);
    this.drive = mode;
    this._hideOverlay();
  }

  async startExplore(id) {
    const app = this.app;
    const { city, pos } = this.cityPos(id);
    this.menu.clear();
    await this.loadArea(pos, `${city.name} yükleniyor…`);
    const top = this.groundTop(pos.x, pos.z);
    const mode = new ExploreMode(app, new THREE.Vector3(pos.x, top + 14, pos.z + 30));
    mode.onPause = () => this.pauseExplore();
    app.setMode(mode);
    this._hideOverlay();
  }

  /** Kervan RPG: sehirde yaya tuccar olarak basla. */
  async startKervan(id) {
    const { KervanMode } = await import('./modes/KervanMode.js');
    const app = this.app;
    const { city, pos } = this.cityPos(id);
    this.menu.clear();
    await this.loadArea(pos, `${city.name} yükleniyor…`);
    const mode = new KervanMode(app, { city: id, look: app.settings.get('kervanLook') || 'player_ch_m', onPause: () => this.pauseKervan() });
    app.setMode(mode);
    this.kervan = mode;
    this._hideOverlay();
  }

  pauseKervan() {
    const mode = this.app.mode;
    if (!mode) return;
    if (mode.paused) { this.menu.clear(); mode.paused = false; return; }
    mode.paused = true;
    const resume = () => { this.menu.clear(); mode.paused = false; };
    this.menu.pause({
      onResume: resume,
      onTeleport: (id) => { this.menu.clear(); this.startKervan(id); },
      onSettings: () => this.menu.settings(() => { mode.paused = false; this.pauseKervan(); }),
      onMain: () => { this.menu.clear(); this.showMainMenu(); },
    });
  }

  /** Gelistirici: donusturulmus karakterleri sehirde sirala (?mode=chars). */
  async startCharView(id, keys = null) {
    const { CharViewMode } = await import('./modes/CharViewMode.js');
    const app = this.app;
    const { city, pos } = this.cityPos(id);
    this.menu.clear();
    await this.loadArea(pos, `${city.name} yükleniyor…`);
    const sp = this.findSpawn(pos, city.heading);
    app.setMode(new CharViewMode(app, new THREE.Vector3(sp.x, sp.y, sp.z), keys));
    this._hideOverlay();
  }

  async startRally() {
    const { RallyMode } = await import('./modes/RallyMode.js');
    const app = this.app;
    this.menu.clear();
    const start = RallyMode.startPosition(app.world);
    await this.loadArea(start, 'Ralli parkuru yükleniyor…');
    const mode = new RallyMode(app, { onPause: () => this.pauseDrive(), onFinish: (r) => this.rallyFinished(r) });
    app.setMode(mode);
    this.drive = mode;
    this._hideOverlay();
  }

  rallyFinished(result) {
    const best = this.app.settings.get('rallyBest');
    if (result.finished && (!best || result.time < best)) this.app.settings.set('rallyBest', result.time);
  }

  pauseDrive() {
    const mode = this.app.mode;
    if (!mode || !mode.vehicle) return;
    if (mode.paused) { this._resume(mode); return; }
    mode.paused = true;
    if (mode.hud) mode.hud.root.classList.add('hidden');
    this.menu.pause({
      onResume: () => this._resume(mode),
      onTeleport: mode.teleportable === false ? null : (id) => { this._resume(mode); this.teleport(id); },
      onGarage: () => this.menu.garage(() => { this._applyVehicleLook(mode); this.pauseDrive2(mode); }),
      onRepair: () => { mode.vehicle.repair(); this._resume(mode); if (mode.hud) mode.hud.toast('Araç onarıldı ve yıkandı', 1.8); },
      onSettings: () => this.menu.settings(() => this.pauseDrive2(mode)),
      onMain: () => { this.menu.clear(); this.showMainMenu(); },
    });
  }

  pauseDrive2(mode) { mode.paused = false; this.pauseDrive(); }

  _applyVehicleLook(mode) {
    const s = this.app.settings;
    mode.vehicle.model.setPaint(s.get('vehicleColor'));
    if (mode.vehicle.variant !== s.get('vehicleVariant')) mode.rebuildVehicle(s.get('vehicleVariant'), s.get('vehicleColor'));
  }

  _resume(mode) {
    this.menu.clear();
    mode.paused = false;
    if (mode.hud) mode.hud.root.classList.remove('hidden');
  }

  pauseExplore() {
    const mode = this.app.mode;
    this.menu.pause({
      onResume: () => this.menu.clear(),
      onTeleport: (id) => { this.menu.clear(); this.startExplore(id); },
      onSettings: () => this.menu.settings(() => this.pauseExplore()),
      onMain: () => { this.menu.clear(); this.showMainMenu(); },
    });
  }

  async teleport(id) {
    const mode = this.app.mode;
    const { city, pos } = this.cityPos(id);
    mode.paused = true;
    const keep = mode.focus.clone();
    mode.focus.copy(pos);
    await this.loadArea(pos, `${city.name} yükleniyor…`);
    const sp = this.findSpawn(pos, city.heading);
    mode.vehicle.spawn(sp.x, sp.z, sp.heading, sp.y);
    mode.focus.copy(mode.vehicle.position);
    mode.camera.initialized = false;
    mode.paused = false;
    if (mode.hud) mode.hud.toast(`${city.name}`, 2.5);
    this._hideOverlay();
    void keep;
  }

  applySetting(k, v) {
    const app = this.app, mode = app.mode;
    if (k === 'hour') app.sky.setHour(v, true);
    if (mode && mode.vehicle) {
      if (k === 'engineSound' && mode.sound) mode.sound.setEngine(v);
      if (k === 'transmission') mode.vehicle.sim.autoShift = v !== 'manual';
      if (k === 'assists' && mode.applyAssists) mode.applyAssists(v);
    }
  }
}
