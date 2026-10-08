// Uretken muzik (V5): hicbir ses dosyasi yok; calgilar WebAudio ile sentezlenir, ezgiler makama gore
// adim adim uretilir. Sehirlerde ritimli ve canli ("town"), kirda seyrek ve dem agirlikli ("field").
//
//  Calgilar: telli (Karplus-Strong: ut / pipa / santur / kanun), ney-dizi (flut: sinus + nefes
//  gurultusu + vibrato), dem (testere dis + alcak geciren, yavas), vurmali (dum / tek), yanki.
//  Makamlar: china pentatonik, desert Hicaz, persian Sur, byzantine Dor, egypt Hicazkar, theme.

const STYLES = {
  china: { scale: [0, 2, 4, 7, 9], root: 50, bpm: 72, pluck: 'pipa', lead: 'dizi', perc: 'soft', steps: 8, pattern: 'D...t...D.t.t...' },
  desert: { scale: [0, 1, 4, 5, 7, 8, 10], root: 50, bpm: 92, pluck: 'oud', lead: 'ney', perc: 'darbuka', steps: 8, pattern: 'D.t.tD.t' },
  persian: { scale: [0, 1, 3, 5, 7, 8, 10], root: 52, bpm: 84, pluck: 'santur', lead: 'ney', perc: 'tombak', steps: 6, pattern: 'D..t.tD.tt..' },
  byzantine: { scale: [0, 2, 3, 5, 7, 9, 10], root: 50, bpm: 64, pluck: 'lyra', lead: 'ney', perc: 'none', steps: 8, pattern: '' },
  egypt: { scale: [0, 1, 4, 5, 7, 8, 11], root: 52, bpm: 100, pluck: 'qanun', lead: 'ney', perc: 'riq', steps: 8, pattern: 'D.tDt.t.' },
  theme: { scale: [0, 1, 4, 5, 7, 8, 10], root: 47, bpm: 76, pluck: 'oud', lead: 'ney', perc: 'darbuka', steps: 8, pattern: 'D...t.D.t...t...' },
};

const PLUCKS = {
  oud: { bright: 0.35, decay: 0.996, body: 260, gain: 0.55 },
  pipa: { bright: 0.65, decay: 0.993, body: 600, gain: 0.45 },
  santur: { bright: 0.85, decay: 0.997, body: 900, gain: 0.35 },
  qanun: { bright: 0.7, decay: 0.995, body: 700, gain: 0.4 },
  lyra: { bright: 0.45, decay: 0.998, body: 400, gain: 0.45 },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class GenMusic {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    // yanki: uretilmis dusen gurultu darbe yaniti
    const len = ctx.sampleRate * 2.6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.rev = ctx.createConvolver();
    this.rev.buffer = ir;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.32;
    this.dry = ctx.createGain(); this.dry.gain.value = 0.85;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.55;
    this.bus.connect(this.dry).connect(this.out);
    this.bus.connect(this.rev).connect(this.wet).connect(this.out);
    this.out.connect(out);
    this.noise = (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    this.cache = new Map();
    this.style = null;
    this.mood = 'field';
    this.next = 0;
    this.step = 0;
    this.phrase = [];
    this.voice = 0;
    this.deg = 0;
    this.drone = null;
    this.timer = setInterval(() => this._tick(), 90);
  }

  /** Makam ve ruh hali (town: ritim + iki calgi; field: seyrek ezgi + dem). */
  set(styleId, mood = 'field') {
    const st = STYLES[styleId] || STYLES.theme;
    const t = this.ctx.currentTime;
    if (this.style === st && this.mood === mood) return;
    const changed = this.style !== st;
    this.style = st; this.mood = mood;
    if (changed) {
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(0.0001, t + 1.2);
      this.out.gain.linearRampToValueAtTime(1, t + 3.5);
      this.next = Math.max(this.next, t + 1.3);
      this.phrase = []; this.deg = 0;
      this._setDrone(t + 1.3);
    }
  }

  stop() {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + 1.5);
    this.style = null;
  }

  dispose() { clearInterval(this.timer); this.out.disconnect(); }

  // ---------------------------------------------------------------- zamanlayici

  _tick() {
    const st = this.style;
    if (!st) return;
    const ctx = this.ctx;
    const stepDur = 60 / st.bpm / 2;          // sekizlik
    while (this.next < ctx.currentTime + 0.35) {
      const t = Math.max(this.next, ctx.currentTime + 0.02);
      this._step(t, stepDur);
      this.next = t + stepDur;
      this.step++;
    }
  }

  _step(t, dur) {
    const st = this.style, town = this.mood === 'town';
    // vurmali
    if (town && st.perc !== 'none' && st.pattern) {
      const c = st.pattern[this.step % st.pattern.length];
      if (c === 'D') this._drum(t, 'dum', st.perc);
      else if (c === 't') this._drum(t, 'tek', st.perc);
    }
    // ezgi: cumle bitince yeni cumle (calgi sirayla); kirda cumleler arasi uzun sessizlik
    if (!this.phrase.length) {
      if (!town && Math.random() < 0.55) { this.phrase = [{ rest: 4 + Math.floor(Math.random() * 8) }]; }
      else { this.voice = (this.voice + 1) % 2; this.phrase = this._newPhrase(st, town); }
    }
    const n = this.phrase[0];
    if (n.left === undefined) {
      n.left = n.rest || n.len;
      if (!n.rest) {
        const midi = st.root + 12 + this._degToSemi(st.scale, n.deg);
        if (this.voice === 0 || !town) this._pluck(t, midi, st.pluck, n.len * dur, n.orn);
        else this._lead(t, midi, st.lead, n.len * dur * 0.95);
        if (town && Math.random() < 0.15) this._pluck(t, midi - 12, st.pluck, n.len * dur);   // oktav eslik
      }
    }
    if (--n.left <= 0) this.phrase.shift();
  }

  _degToSemi(scale, d) {
    const n = scale.length;
    const o = Math.floor(d / n), k = ((d % n) + n) % n;
    return o * 12 + scale[k];
  }

  /** Cumle: cogunlukla adim adim hareket, sonunda karar sesine (0 ya da 4/5) yonelir. */
  _newPhrase(st, town) {
    const n = st.scale.length;
    const len = 4 + Math.floor(Math.random() * 5);
    const out = [];
    let d = this.deg;
    const durs = town ? [1, 1, 2, 1, 2, 3] : [2, 3, 4, 2, 6];
    for (let k = 0; k < len; k++) {
      const r = Math.random();
      d += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.92 ? -2 : 0;
      d = Math.max(-2, Math.min(n + 4, d));
      const last = k === len - 1;
      if (last) d = Math.random() < 0.6 ? 0 : Math.min(n - 1, 4);
      out.push({ deg: d, len: last ? durs[durs.length - 1] + 1 : durs[Math.floor(Math.random() * durs.length)], orn: Math.random() < 0.18 });
    }
    this.deg = d;
    out.push({ rest: town ? 2 : 4 });
    return out;
  }

  // ---------------------------------------------------------------- calgilar

  _pluckBuffer(kind, midi) {
    const key = kind + midi;
    let b = this.cache.get(key);
    if (b) return b;
    const P = PLUCKS[kind] || PLUCKS.oud;
    const sr = this.ctx.sampleRate;
    const f = mtof(midi);
    const N = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * 2.2);
    b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    // baslangic: parlakliga gore yumusatilmis gurultu
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * P.bright; d[i] = lp; }
    const dec = Math.pow(P.decay, 440 / f);
    for (let i = N; i < len; i++) d[i] = (d[i - N] + d[i - N + 1]) * 0.5 * dec;
    this.cache.set(key, b);
    return b;
  }

  _pluck(t, midi, kind, dur, orn = false) {
    const ctx = this.ctx, P = PLUCKS[kind] || PLUCKS.oud;
    const play = (tt, m, g) => {
      const s = ctx.createBufferSource();
      s.buffer = this._pluckBuffer(kind, m);
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = P.body; body.Q.value = 1.2; body.gain.value = 5;
      const v = ctx.createGain();
      v.gain.setValueAtTime(P.gain * g, tt);
      v.gain.setTargetAtTime(0, tt + Math.max(0.25, dur), 0.25);
      s.connect(body).connect(v).connect(this.bus);
      s.start(tt); s.stop(tt + Math.max(0.6, dur) + 1.2);
    };
    if (orn) play(t, midi + 1, 0.45);          // susleme: ust komsu ses
    play(t + (orn ? 0.07 : 0), midi, 1);
    // santur/kanun: tremolo hissi icin ikinci vurus
    if ((kind === 'santur' || kind === 'qanun') && dur > 0.5) play(t + dur * 0.5, midi, 0.5);
  }

  _lead(t, midi, kind, dur) {
    const ctx = this.ctx;
    const f = mtof(midi + (kind === 'dizi' ? 12 : 0));
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
    const g2 = ctx.createGain(); g2.gain.value = kind === 'dizi' ? 0.12 : 0.05;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.value = 0;
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(14, t + Math.min(0.6, dur * 0.6));
    vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    // nefes
    const nz = ctx.createBufferSource(); nz.buffer = this.noise; nz.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 2.5;
    const ng = ctx.createGain(); ng.gain.value = kind === 'ney' ? 0.05 : 0.025;
    const env = ctx.createGain();
    const peak = 0.16;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.09);
    env.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.12));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    o.connect(env); o2.connect(g2).connect(env); nz.connect(bp).connect(ng).connect(env);
    env.connect(this.bus);
    const end = t + dur + 0.3;
    for (const s of [o, o2, vib, nz]) { s.start(t); s.stop(end); }
  }

  _drum(t, hit, kind) {
    const ctx = this.ctx;
    const soft = kind === 'soft';
    if (hit === 'dum') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(soft ? 120 : 150, t);
      o.frequency.exponentialRampToValueAtTime(soft ? 55 : 62, t + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(soft ? 0.35 : 0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(this.bus);
      o.start(t); o.stop(t + 0.5);
    } else {
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const hp = ctx.createBiquadFilter(); hp.type = kind === 'riq' ? 'highpass' : 'bandpass'; hp.frequency.value = kind === 'riq' ? 6000 : 2400; hp.Q.value = 1.5;
      const g = ctx.createGain();
      const a = soft ? 0.08 : kind === 'riq' ? 0.14 : 0.22;
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'riq' ? 0.12 : 0.06));
      s.connect(hp).connect(g).connect(this.bus);
      s.start(t, Math.random() * 0.5); s.stop(t + 0.15);
    }
  }

  /** Dem: karar sesi + besli, testere dis, yavas acilir; makam degisince yenilenir. */
  _setDrone(t) {
    const ctx = this.ctx, st = this.style;
    if (this.drone) {
      const d = this.drone;
      d.g.gain.cancelScheduledValues(t);
      d.g.gain.setValueAtTime(d.g.gain.value, ctx.currentTime);
      d.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(() => d.oscs.forEach((o) => o.stop()), 1500);
    }
    const g = ctx.createGain(); g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
    const oscs = [];
    for (const [semi, det] of [[0, -6], [0, 6], [7, 0], [-12, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = mtof(st.root - 12 + semi); o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = semi === -12 ? 0.05 : 0.035;
      o.connect(og).connect(lp);
      o.start(t);
      oscs.push(o);
    }
    lp.connect(g).connect(this.bus);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 3.5);
    this.drone = { g, oscs };
  }
}
