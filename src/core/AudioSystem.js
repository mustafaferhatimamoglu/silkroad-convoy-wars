// Ses sistemi: AudioContext, ana/efekt/muzik kanallari, Silkroad muzikleri (gecisli).
// Tarayicilar sesi ilk kullanici etkilesimine kadar baslatmaz; ensure() bunu bekler.

const MUSIC_BASE = 'assets/music/';

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
    if (!track || this.music.track === track) return;
    if (!this.ctx) { this._pendingTrack = track; return; }
    const ctx = this.ctx;
    const old = this.music;
    const el = new Audio(MUSIC_BASE + track);
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
}

/** Bolgeye gore Silkroad muzigi. */
export function musicForRegion(rx, rz) {
  const near = (x, z, r) => Math.abs(rx - x) <= r && Math.abs(rz - z) <= r;
  if (near(168, 97, 2)) return 'jangan_town.ogg';
  if (near(153, 102, 2)) return 'donwhang_town.ogg';
  if (near(135, 92, 2)) return 'hotan_field.ogg';
  if (near(108, 106, 2)) return 'centralasia_town.ogg';
  if (near(79, 105, 2)) return 'easterneurope_town.ogg';
  if (near(49, 91, 3)) return 'egypt_town_alexandria1.ogg';
  if (rx >= 160) return 'jangan_field.ogg';
  if (rx >= 146) return 'donwhang_field.ogg';
  if (rx >= 125 && rz >= 95) return 'taklamakan_field.ogg';
  if (rx >= 125 && rz < 89) return 'karakoram_field.ogg';
  if (rx >= 125) return 'hotan_field.ogg';
  if (rx >= 105 && rz < 96) return 'mtrok_field.ogg';
  if (rx >= 98) return 'centralasia_field.ogg';
  if (rx >= 85) return 'asiaminor_field.ogg';
  if (rx >= 66) return 'easterneurope_field.ogg';
  return 'egypt_field_delta.ogg';
}
