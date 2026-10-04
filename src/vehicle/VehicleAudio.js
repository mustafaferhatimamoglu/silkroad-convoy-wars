import { surfaceInfo } from './presets.js';

// Arac sesleri: motor (AudioWorklet), lastik cigligi, ruzgar, zemin ugultusu, carpisma,
// vites, korna. Hepsi efekt kanalina baglidir.

export class VehicleAudio {
  constructor(audio, vehicle, { engine = true } = {}) {
    this.audio = audio;
    this.vehicle = vehicle;
    this.engineOn = engine;
    this.ctx = null;
    this.lastGear = null;
    this.hornOn = false;
    audio.ensure().then((ctx) => { if (ctx && !this.disposed) this._build(ctx); });
  }

  _build(ctx) {
    this.ctx = ctx;
    const a = this.audio;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(a.sfx);
    try {
      this.engine = new AudioWorkletNode(ctx, 'sro-engine', { numberOfOutputs: 1, outputChannelCount: [2] });
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = this.engineOn ? 1 : 0;
      this.engine.connect(this.engineGain).connect(this.out);
    } catch (e) { console.warn('Motor sesi kullanilamiyor', e); }
    const chain = (filterType, f, q, gain = 0) => {
      const src = a.noiseSource();
      const bq = ctx.createBiquadFilter(); bq.type = filterType; bq.frequency.value = f; bq.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(bq).connect(g).connect(this.out);
      src.start();
      return { src, bq, g };
    };
    this.squeal = chain('bandpass', 1500, 9);
    this.squeal2 = chain('bandpass', 2300, 12);
    this.wind = chain('lowpass', 520, 0.7);
    this.rumble = chain('lowpass', 240, 0.9);
    this.gravel = chain('bandpass', 1200, 1.2);
  }

  setEngine(on) {
    this.engineOn = on;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  update(dt) {
    const ctx = this.ctx;
    if (!ctx) return;
    const v = this.vehicle, sim = v.sim;
    const t = ctx.currentTime;
    const speed = v.velocity.length();
    if (this.engine) {
      const p = this.engine.parameters;
      const slipRev = sim.locked ? 0 : 0.15 * sim.input.throttle;
      p.get('rpm').setValueAtTime(sim.rpm, t);
      p.get('load').setValueAtTime(Math.min(1, sim.input.throttle * (0.7 + 0.3 * sim.clutch) + slipRev), t);
      p.get('level').setValueAtTime(0.55, t);
    }
    // lastik cigligi: sert zeminde kayma
    let slideHard = 0, rough = 0, soft = 0, contacts = 0;
    for (const w of sim.wheels) {
      if (!w.contact) continue;
      contacts++;
      const s = surfaceInfo(w.surface);
      if (s.dustAmt < 0.3) slideHard = Math.max(slideHard, w.slide);
      soft += s.dustAmt;
      rough += Math.abs(w.x - w.xPrev);
    }
    soft = contacts ? soft / contacts : 0;
    const sq = Math.min(1, Math.max(0, (slideHard - 2.2) / 7));
    this.squeal.g.gain.setTargetAtTime(sq * 0.32, t, 0.04);
    this.squeal2.g.gain.setTargetAtTime(sq * 0.12, t, 0.04);
    this.squeal.bq.frequency.setTargetAtTime(1300 + sq * 500 + Math.sin(t * 23) * 60, t, 0.05);
    // ruzgar
    const wv = Math.min(1, speed / 45);
    this.wind.g.gain.setTargetAtTime(wv * wv * 0.35, t, 0.2);
    this.wind.bq.frequency.setTargetAtTime(350 + speed * 18, t, 0.2);
    // zemin: yumusak zeminde cakil/kum hisirtisi, sert zeminde ugultu
    const sp = Math.min(1, speed / 22);
    const air = contacts === 0;
    this.rumble.g.gain.setTargetAtTime(air ? 0 : sp * (0.12 + rough * 6), t, 0.08);
    this.gravel.g.gain.setTargetAtTime(air ? 0 : sp * soft * 0.13, t, 0.08);
    // vites gecisi
    const g = sim.gearLabel;
    if (this.lastGear !== null && g !== this.lastGear) this.click(0.18);
    this.lastGear = g;
    // carpismalar
    for (const im of v.lastImpacts || []) this.impact(im.speed, im.object);
  }

  click(level = 0.2) {
    const ctx = this.ctx;
    const s = this.audio.noiseSource();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + 0.08);
  }

  impact(speed, metal) {
    const ctx = this.ctx, t = ctx.currentTime;
    const lvl = Math.min(1.2, speed / 10);
    // gumburtu
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    const og = ctx.createGain(); og.gain.setValueAtTime(lvl * 0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(this.out); o.start(t); o.stop(t + 0.32);
    // sac sesi
    const s = this.audio.noiseSource();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = metal ? 2600 : 1400; f.Q.value = metal ? 3 : 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(lvl * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + (metal ? 0.45 : 0.2));
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + 0.5);
  }

  horn(on) {
    const ctx = this.ctx;
    if (!ctx || on === this.hornOn) return;
    this.hornOn = on;
    const t = ctx.currentTime;
    if (on) {
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const o1 = ctx.createOscillator(); o1.type = 'square'; o1.frequency.value = 405;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 482;
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(this.out);
      o1.start(t); o2.start(t);
      this._horn = { g, o1, o2 };
    } else if (this._horn) {
      const { g, o1, o2 } = this._horn;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.04);
      o1.stop(t + 0.06); o2.stop(t + 0.06);
      this._horn = null;
    }
  }

  dispose() {
    this.disposed = true;
    if (!this.ctx) return;
    this.horn(false);
    for (const c of [this.squeal, this.squeal2, this.wind, this.rumble, this.gravel]) if (c) c.src.stop();
    if (this.engine) this.engine.disconnect();
    this.out.disconnect();
  }
}
