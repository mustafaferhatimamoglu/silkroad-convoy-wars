import { surfaceInfo } from './presets.js';

// Arac sesleri: motor (AudioWorklet), lastik cigligi, ruzgar, zemin ugultusu, carpisma,
// vites, korna. Hepsi efekt kanalina baglidir.
//
// Motor sesi fiziksel modeldir (src/audio/engine-worklet.js) ve dort ayri cikis verir:
// egzoz, emme/turbo, mekanik, govde titresimi. Kamera konumu karisimi belirler: disaridan
// egzoz baskindir; kokpitte egzoz kabinden bogularak gelir, emme ve govde ugultusu one cikar.

const VIEW_MIX = {
  // [egzoz, emme, mekanik, titresim], egzozun alcak geciren frekansi (Hz)
  ext: { g: [1.0, 0.45, 0.5, 0.12], lp: 16000 },
  hood: { g: [0.62, 0.95, 0.9, 0.45], lp: 3500 },
  int: { g: [0.6, 1.0, 0.7, 1.0], lp: 850 },
};
const viewKey = (mode) => (mode === 'cockpit' ? 'int' : mode === 'hood' ? 'hood' : 'ext');

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
      const P = this.vehicle.params;
      const profile = (P.engine && P.engine.sound) || P.id || 'kartal';
      this.engine = new AudioWorkletNode(ctx, 'sro-engine', {
        numberOfInputs: 0, numberOfOutputs: 4, outputChannelCount: [1, 1, 1, 1], processorOptions: { profile },
      });
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = this.engineOn ? 1 : 0;
      this.exLp = ctx.createBiquadFilter(); this.exLp.type = 'lowpass'; this.exLp.Q.value = 0.6;
      this.engMix = [0, 1, 2, 3].map((i) => { const g = ctx.createGain(); this.engine.connect(g, i); return g; });
      this.engMix[0].connect(this.exLp).connect(this.engineGain);
      for (let i = 1; i < 4; i++) this.engMix[i].connect(this.engineGain);
      this.engineGain.connect(this.out);
      this._mixKey = null;
      this.setView(this.view || 'chase');
    } catch (e) { console.warn('Motor sesi kullanilamiyor', e); }
    const chain = (filterType, f, q, gain = 0) => {
      const src = a.noiseSource();
      const bq = ctx.createBiquadFilter(); bq.type = filterType; bq.frequency.value = f; bq.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(bq).connect(g).connect(this.out);
      src.start();
      return { src, bq, g };
    };
    this.wind = chain('lowpass', 520, 0.7);
    this.rumble = chain('lowpass', 240, 0.9);
    // lastikler: cigliklama, patinaj, drift, cakil puskurtme, yuvarlanma (src/audio/tire-worklet.js)
    try {
      this.tires = new AudioWorkletNode(ctx, 'sro-tires', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
      this.tireGain = ctx.createGain(); this.tireGain.gain.value = 0.9;
      this.tires.connect(this.tireGain).connect(this.out);
    } catch (e) { console.warn('Lastik sesi kullanilamiyor', e); }
  }

  /** Kamera kipine gore motor sesi karisimi (disaridan / kaputtan / kokpitten). */
  setView(mode) {
    this.view = mode;
    const k = viewKey(mode);
    if (!this.engMix || k === this._mixKey) return;
    const first = this._mixKey === null;
    this._mixKey = k;
    const m = VIEW_MIX[k], t = this.ctx.currentTime;
    this.engMix.forEach((g, i) => { if (first) g.gain.value = m.g[i]; else g.gain.setTargetAtTime(m.g[i], t, 0.08); });
    if (first) this.exLp.frequency.value = m.lp; else this.exLp.frequency.setTargetAtTime(m.lp, t, 0.08);
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
      // yuk = motora giden gercek gaz (vites gecisinde ve cekis kontrolunde kesilir)
      p.get('rpm').setValueAtTime(sim.rpm, t);
      p.get('load').setValueAtTime(Math.min(1, Math.max(0, sim.engine.load)), t);
      p.get('level').setValueAtTime(0.55, t);
    }
    // lastikler: her teker kendi zemininde kayma (yanal + boyuna) ve yuvarlanma
    let rough = 0, contacts = 0;
    let hardEx = 0, hardSum = 0, hardN = 0, spinSum = 0;
    let looseSlide = 0, looseN = 0, toneSum = 0, sandAmt = 0;
    for (const w of sim.wheels) {
      if (!w.contact) continue;
      contacts++;
      rough += Math.abs(w.x - w.xPrev);
      const s = surfaceInfo(w.surface);
      const slide = w.slide || 0;
      // boyuna kayma hizi (patinaj/kilitlenme) ve kaymanin boyuna payi
      const longS = Math.abs((w.slipRatio || 0) * Math.max(Math.abs(w.vLong || 0), 1));
      if (s.dustAmt < 0.3) {
        hardN++;
        hardSum += slide;
        hardEx += Math.max(0, slide - 1.2);
        spinSum += slide > 0.5 ? Math.min(1, longS / (slide + 0.1)) * Math.max(0, slide - 1.2) : 0;
      } else {
        looseN++;
        looseSlide += slide;
        toneSum += s.dustAmt >= 0.9 ? 1300 : s.dustAmt >= 0.6 ? 1800 : s.dustAmt >= 0.45 ? 950 : 2500;
        if (s.dustAmt >= 0.9) sandAmt += 1;
      }
    }
    if (this.tires) {
      const P = this.tires.parameters, k = 0.04;
      const set = (name, v) => P.get(name).setTargetAtTime(v, t, k);
      // sert zemin: cigliklama (kayma arttikca yukselen perde), patinajda kalin ve puruzlu
      const sq = Math.min(1, Math.pow(hardEx / 9, 0.8));
      const avg = hardN ? hardSum / hardN : 0;
      set('squeal', sq * 0.55);
      set('pitch', Math.min(1500, 640 + avg * 24));
      set('spin', hardEx > 0.01 ? Math.min(1, spinSum / hardEx) : 0);
      set('scrub', Math.min(1, Math.max(0, (avg - 3.5) / 9)) * (hardN ? 1 : 0));
      // gevsek zemin: tanecikli cakil/toprak puskurtmesi (kayma + hiz), kumda hisirti
      const air = contacts === 0;
      const lv = looseN ? looseSlide / looseN : 0;
      const gravel = air || !looseN ? 0 : Math.min(1, 0.1 + Math.min(1, speed / 18) * 0.25 + lv / 8) * (looseN / Math.max(1, contacts));
      set('gravel', speed > 0.4 || lv > 0.5 ? gravel : 0);
      set('rate', Math.min(900, looseN * (speed * 3.2 + lv * 55)));
      set('tone', looseN ? toneSum / looseN : 1800);
      set('soft', air ? 0 : Math.min(1, (sandAmt / Math.max(1, contacts)) * (speed / 25 + lv / 6)));
      // yuvarlanma ugultusu: sert zeminde belirgin, gevsek zeminde az
      const hv = Math.min(1, speed / 38);
      set('roll', air ? 0 : (hardN / Math.max(1, contacts)) * (0.04 + 0.5 * hv * hv) + (looseN / Math.max(1, contacts)) * 0.12 * hv);
      set('rollTone', 220 + speed * 14);
    }
    // ruzgar
    const wv = Math.min(1, speed / 45);
    this.wind.g.gain.setTargetAtTime(wv * wv * 0.35, t, 0.2);
    this.wind.bq.frequency.setTargetAtTime(350 + speed * 18, t, 0.2);
    // zemin: yumusak zeminde cakil/kum hisirtisi, sert zeminde ugultu
    const sp = Math.min(1, speed / 22);
    const air = contacts === 0;
    this.rumble.g.gain.setTargetAtTime(air ? 0 : sp * (0.06 + rough * 6), t, 0.08);
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

  /** Cam kirilmasi: yuksek frekansli kirik sesi + rastgele "tink"ler. */
  glass(level = 1) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [f, q, d] of [[4200, 1.6, 0.35], [7600, 2.5, 0.25]]) {
      const s = this.audio.noiseSource();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5 * level, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(bp).connect(g).connect(this.out); s.start(t); s.stop(t + d + 0.05);
    }
    for (let k = 0; k < 9; k++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = 2800 + Math.random() * 6000;
      const g = ctx.createGain(); const t0 = t + Math.random() * 0.45;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06 * level, t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.09);
      o.connect(g).connect(this.out); o.start(t0); o.stop(t0 + 0.1);
    }
  }

  /** Sac parca carpmasi/sallanmasi (kapi dayanaga vurur, kaput cama kalkar). */
  clank(level = 0.6) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = this.audio.noiseSource();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650 + Math.random() * 500; bp.Q.value = 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(level * 0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    s.connect(bp).connect(g).connect(this.out); s.start(t); s.stop(t + 0.3);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(180 + Math.random() * 60, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
    const og = ctx.createGain(); og.gain.setValueAtTime(level * 0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(og).connect(this.out); o.start(t); o.stop(t + 0.25);
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
    for (const c of [this.wind, this.rumble]) if (c) c.src.stop();
    if (this.tires) this.tires.disconnect();
    if (this.engine) { this.engine.disconnect(); this.engine.port.postMessage({ stop: true }); }
    this.out.disconnect();
  }
}
