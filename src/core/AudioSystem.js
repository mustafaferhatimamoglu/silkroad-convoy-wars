import { GenMusic } from '../audio/GenMusic.js';
import { REGION_M } from '../world/gen/blueprint.js';
import { CITIES } from '../world/gen/features.js';

// Ses sistemi: AudioContext, ana/efekt/muzik kanallari, uretken muzik (V5: ses dosyasi yok).
// Tarayicilar sesi ilk kullanici etkilesimine kadar baslatmaz; ensure() bunu bekler.


export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = null;
    this.music = { el: null, track: null, gain: null };
    this._unlock = () => this.ensure();
    addEventListener('pointerdown', this._unlock);
    addEventListener('keydown', this._unlock);
    settings.onChange((k, v) => {
      if (k === 'sfxVolume' && this.sfx) this.sfx.gain.value = v;
      if (k === 'musicVolume' && this.musicBus) this.musicBus.gain.value = v;
    });
  }

  ensure() {
    if (this.ready) return this.ready;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return Promise.resolve(null);
    this.ctx = new Ctx({ latencyHint: 'interactive' });
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.settings.get('sfxVolume'); this.sfx.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.settings.get('musicVolume'); this.musicBus.connect(this.master);
    // ortak beyaz gurultu tamponu
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ready = ctx.audioWorklet.addModule('src/audio/engine-worklet.js')
      .then(() => ctx.audioWorklet.addModule('src/audio/tire-worklet.js'))
      .then(() => ctx).catch((e) => { console.warn('Motor/lastik sesi yuklenemedi', e); return ctx; });
    if (ctx.state === 'suspended') ctx.resume();
    removeEventListener('pointerdown', this._unlock);
    removeEventListener('keydown', this._unlock);
    if (this._pendingTrack) { const t = this._pendingTrack; this._pendingTrack = null; this.playMusic(t); }
    return this.ready;
  }

  /** Muzik parcasi cal (ayni parca caliyorsa bir sey yapma); 2.5 sn gecis. */
  playMusic(track) {
    // uretken muzik: 'gen:<makam>:<town|field>'
    if (track && track.startsWith('gen:')) {
      if (this.music.track === track) return;
      if (!this.ctx) { this._pendingTrack = track; return; }
      const [, style, mood] = track.split(':');
      if (!this.gen) this.gen = new GenMusic(this.ctx, this.musicBus);
      this.gen.set(style, mood || 'field');
      this.music.track = track;
      return;
    }
    if (!track || this.music.track === track || !/^content\//.test(track)) return;
    if (!this.ctx) { this._pendingTrack = track; return; }
    const ctx = this.ctx;
    const old = this.music;
    const el = new Audio(track);
    el.loop = true;
    el.crossOrigin = 'anonymous';
    const src = ctx.createMediaElementSource(el);
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(this.musicBus);
    el.play().catch(() => { /* etkilesim bekleniyor */ });
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(1, t + 2.5);
    if (old.gain) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + 2.5);
      const oe = old.el;
      setTimeout(() => { oe.pause(); oe.src = ''; }, 2700);
    }
    this.music = { el, track, gain: g };
  }

  setMusicMuted(m) { if (this.musicBus) this.musicBus.gain.value = m ? 0 : this.settings.get('musicVolume'); this.musicMuted = m; }

  noiseSource() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    s.loopStart = Math.random(); s.loopEnd = s.loopStart + 0.9;
    return s;
  }

  /**
   * Sentezlenmis arayuz sesleri (dosya gerektirmez):
   * hover: kristal hafif altin tisi (880-1320 Hz)
   * click: tok oryantal arayuz tiklamasi
   * start: derin bas ve rezonansli akor
   */
  uiSound(type = 'click') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = (this.settings ? this.settings.get('sfxVolume') : 0.8) ?? 0.8;
    if (vol <= 0.01) return;
    try {
      if (type === 'hover') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.035);
        g.gain.setValueAtTime(vol * 0.06, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.connect(g);
        g.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.045);
      } else if (type === 'click') {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc2.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
        osc2.frequency.setValueAtTime(660, now);
        osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.06);
        g.gain.setValueAtTime(vol * 0.16, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
        osc.connect(g); osc2.connect(g);
        g.connect(this.master);
        osc.start(now); osc2.start(now);
        osc.stop(now + 0.08); osc2.stop(now + 0.08);
      } else if (type === 'start') {
        const freqs = [220, 330, 440, 660];
        for (const f of freqs) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          g.gain.setValueAtTime(vol * 0.12, now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
          osc.connect(g); g.connect(this.master);
          osc.start(now); osc.stop(now + 0.5);
        }
      }
    } catch (_) {}
  }
}

/** Bolgeye gore uretken muzik: sehre yakinsa sehir (ritimli), degilse kultur bolgesinin kir hali. */
export function musicForRegion(rx, rz) {
  const x = (rx + 0.5) * REGION_M, z = (rz + 0.5) * REGION_M;
  for (const c of CITIES) if (Math.hypot(x - c.x, z - c.z) < c.r + 380) return `gen:${c.culture}:town`;
  // kir: en yakin sehrin kultur bolgesi
  let style = 'desert', bd = Infinity;
  for (const c of CITIES) { const d = Math.hypot(x - c.x, z - c.z); if (d < bd) { bd = d; style = c.culture; } }
  return `gen:${style}:field`;
}

