// Oyunun kendi ses efektleri (tools/assets/export_sfx.py): konumlu (3B) ve arayuz sesleri,
// zemine gore ayak sesleri, karakter/canavar sesleri. Ses baglami ilk kullanici
// etkilesiminde acilir (AudioSystem.ensure); acilmadan cagrilar sessizce atlanir.

const STEP_OF = { 0: 'ground', 1: 'sand', 3: 'hground', 6: 'mud', 7: 'mud', 9: 'snow', 10: 'grass', 11: 'grass', 12: 'grass', 100: 'hground' };

export class Sfx {
  constructor(app, base = 'assets/sfx/') {
    this.app = app;
    this.base = base;
    this.buffers = new Map();
    this.index = { named: {}, steps: {}, voice: {}, chars: {} };
    this.ready = fetch(base + 'index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((ix) => { if (ix) this.index = ix; }).catch(() => {});
    this.last = new Map();       // ayni sesin ust uste calmasini sinirla
  }

  get ctx() { return this.app.audio.ctx; }

  _buffer(file) {
    let p = this.buffers.get(file);
    if (!p && this.ctx) {
      p = fetch(this.base + file).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).catch(() => null);
      this.buffers.set(file, p);
    }
    return p;
  }

  /** Kamera = dinleyici. */
  updateListener(camera) {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener, p = camera.position;
    const e = camera.matrixWorld.elements;
    const fx = -e[8], fy = -e[9], fz = -e[10], ux = e[4], uy = e[5], uz = e[6];
    if (l.positionX) {
      const t = ctx.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.03); l.positionY.setTargetAtTime(p.y, t, 0.03); l.positionZ.setTargetAtTime(p.z, t, 0.03);
      l.forwardX.setTargetAtTime(fx, t, 0.03); l.forwardY.setTargetAtTime(fy, t, 0.03); l.forwardZ.setTargetAtTime(fz, t, 0.03);
      l.upX.setTargetAtTime(ux, t, 0.03); l.upY.setTargetAtTime(uy, t, 0.03); l.upZ.setTargetAtTime(uz, t, 0.03);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  /** Dosyayi cal. pos verilirse konumlu (uzaklikla azalir, yonlu). */
  async playFile(file, { pos = null, vol = 1, rate = 1, gap = 0.05 } = {}) {
    const ctx = this.ctx;
    if (!ctx || !file) return;
    const now = ctx.currentTime;
    if (now - (this.last.get(file) || -1) < gap) return;
    this.last.set(file, now);
    const buf = await this._buffer(file);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    if (pos) {
      const pan = ctx.createPanner();
      pan.panningModel = 'equalpower';
      pan.distanceModel = 'inverse';
      pan.refDistance = 4; pan.rolloffFactor = 1.1; pan.maxDistance = 120;
      if (pan.positionX) { pan.positionX.value = pos.x; pan.positionY.value = pos.y + 1; pan.positionZ.value = pos.z; }
      else pan.setPosition(pos.x, pos.y + 1, pos.z);
      g.connect(pan); pan.connect(this.app.audio.sfx);
    } else g.connect(this.app.audio.sfx);
    src.start();
  }

  _pick(list) { return list && list.length ? list[Math.floor(Math.random() * list.length)] : null; }

  play(name, opts) { return this.playFile(this.index.named[name], opts); }

  /** Karakter/canavar sesi: cat = die | hurt | shout | idle */
  char(key, cat, pos, opts = {}) {
    const c = this.index.chars[key];
    return this.playFile(this._pick(c && c[cat]), { pos, ...opts });
  }

  voice(gender, cat, pos) {
    const v = this.index.voice[gender] || this.index.voice.m;
    return this.playFile(this._pick(v && v[cat]), { pos, vol: 0.9, gap: 0.4 });
  }

  /** Ayak sesi: yuzey bayragi (arazi) ya da nesne ustu (sert zemin). */
  step(surface, run, pos, vol = 0.55) {
    const s = this.index.steps[STEP_OF[surface] || 'ground'] || this.index.steps.ground;
    if (!s) return;
    return this.playFile(run ? s.run || s.walk : s.walk || s.run, { pos, vol, gap: 0.12 });
  }
}
