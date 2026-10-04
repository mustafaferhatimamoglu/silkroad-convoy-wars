// 4 silindirli 4 zamanli motor sesi (AudioWorklet).
// Her ateslemede kisa bir basinc darbesi uretilir (devir/30 Hz). Darbeler:
//  - devirle kayan bir alcak geciren "govde" filtresinden (atesleme vurusu, bas),
//  - SABIT frekansli egzoz/govde rezonanslarindan (formantlar) gecer. Gercek egzozda boru
//    rezonanslari devirle kaymaz; harmonikler bu sabit tepelerin icinden gecer ve tini
//    devirle dogal bicimde degistirir (eski surumde filtreler devirle kayiyor, enerji
//    30-150 Hz'e yigiliyordu: kucuk hoparlorde rolanti neredeyse duyulmuyordu).
// Yuk altinda emme ugultusu, yuksek devirde supap tikirtisi eklenir; yumusak kirpma.
// Silindirler arasi kucuk dengesizlik ve rastgelelik rolantide "pitirti"yi verir.

class Biquad {
  constructor() { this.b0 = 0; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  bandpass(f, q) {
    const w = (2 * Math.PI * f) / sampleRate, s = Math.sin(w), c = Math.cos(w), a = s / (2 * q);
    const a0 = 1 + a;
    this.b0 = a / a0; this.b1 = 0; this.b2 = -a / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  lowpass(f, q) {
    const w = (2 * Math.PI * f) / sampleRate, s = Math.sin(w), c = Math.cos(w), a = s / (2 * q);
    const a0 = 1 + a;
    this.b0 = ((1 - c) / 2) / a0; this.b1 = (1 - c) / a0; this.b2 = ((1 - c) / 2) / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  highpass(f, q) {
    const w = (2 * Math.PI * f) / sampleRate, s = Math.sin(w), c = Math.cos(w), a = s / (2 * q);
    const a0 = 1 + a;
    this.b0 = ((1 + c) / 2) / a0; this.b1 = -(1 + c) / a0; this.b2 = ((1 + c) / 2) / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 850, minValue: 0, maxValue: 9000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'level', defaultValue: 0.5, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.phase = 0;
    this.cyl = 0;
    this.env = 0;
    this.kick = 0;
    this.valve = 0;
    this.vphase = 0;
    this.rpm = 850; this.load = 0.2; this.level = 0.5;
    this.thump = new Biquad();
    // sabit rezonanslar: [frekans, Q, kazanc]
    this.formants = [[115, 1.3, 1.5], [330, 1.8, 1.0], [780, 2.4, 0.62], [1500, 2.6, 0.32], [2900, 2.0, 0.12]].map(([f, q, g]) => {
      const bq = new Biquad(); bq.bandpass(f, q); return { bq, g };
    });
    this.intake = new Biquad(); this.tone = new Biquad(); this.tick = new Biquad();
    this.tick.bandpass(4200, 1.4);
    this.dc = 0; this.dc2 = 0;
    this.seed = 12345;
    this.imb = [1.0, 0.9, 1.07, 0.95];
    this.decay = Math.exp(-1 / (sampleRate * 0.0028));   // govde vurusu
    this.sdecay = Math.exp(-1 / (sampleRate * 0.00045)); // keskin basinc cephesi (parlaklik)
    this.senv = 0;
    this.vdecay = Math.exp(-1 / (sampleRate * 0.0006));
  }

  rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const ch = out[0];
    if (!ch) return true;
    // parametreleri yumusat
    this.rpm += (params.rpm[0] - this.rpm) * 0.35;
    this.load += (params.load[0] - this.load) * 0.25;
    this.level += (params.level[0] - this.level) * 0.2;
    const rpm = Math.max(300, this.rpm), load = this.load;
    const ff = rpm / 30; // atesleme frekansi (Hz)
    this.thump.lowpass(Math.min(ff * 2.2, 900), 0.9);
    this.intake.bandpass(700 + rpm * 0.18, 0.8);
    this.tone.lowpass(2600 + rpm * 0.7 + load * 1800, 0.7);
    const inc = ff / sampleRate;
    const vinc = (rpm / 60) * 4 / sampleRate;  // supap olaylari (krank turu basina ~4)
    const fm = this.formants;
    const tickAmt = 0.025 * Math.min(1, rpm / 4000);
    for (let i = 0; i < ch.length; i++) {
      this.phase += inc;
      if (this.phase >= 1) {
        this.phase -= 1;
        this.cyl = (this.cyl + 1) & 3;
        this.kick = (0.25 + 0.75 * load) * this.imb[this.cyl] * (0.86 + this.rand() * 0.28);
        this.env = 1; this.senv = 1;
      }
      this.vphase += vinc;
      if (this.vphase >= 1) { this.vphase -= 1; this.valve = 0.6 + this.rand() * 0.4; }
      this.env *= this.decay;
      this.senv *= this.sdecay;
      this.valve *= this.vdecay;
      const n = this.rand() * 2 - 1;
      const body = this.kick * this.env;
      // rezonanslari, keskin cephe + gurultulu kuyruk uyarir (orta frekanslar duyulsun)
      const bright = this.kick * (this.senv * 2.2 + this.env * n * 0.55);
      let s = this.thump.run(body) * 1.5;
      for (let k = 0; k < fm.length; k++) s += fm[k].bq.run(bright) * fm[k].g;
      s += this.intake.run(n) * (0.015 + load * 0.07) * (0.35 + this.env);
      s += this.tick.run(n * this.valve) * tickAmt;
      s = this.tone.run(s);
      // DC engelleme (tek yonlu darbeler)
      this.dc += (s - this.dc) * 0.0015;
      s -= this.dc;
      s = Math.tanh(s * (1.15 + load * 0.75));
      // kirpmanin asimetrisinden dogan DC'yi de temizle
      this.dc2 += (s - this.dc2) * 0.0015;
      ch[i] = (s - this.dc2) * this.level;
    }
    for (let c = 1; c < out.length; c++) out[c].set(ch);
    return true;
  }
}

registerProcessor('sro-engine', EngineProcessor);
