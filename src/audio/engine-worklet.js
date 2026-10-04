// 4 silindirli 4 zamanli motor sesi (AudioWorklet).
// Her ateslemede kisa bir darbe uretilir (devir/30 Hz); darbeler egzoz ve govde
// rezonanslarindan (iki bant geciren filtre) gecer, emme/mekanik gurultu eklenir ve
// yumusak kirpma ile doygunlastirilir. Silindirler arasi kucuk dengesizlik ve rastgelelik
// rolantide karakteristik "pitirti"yi verir.

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
    this.rpm = 850; this.load = 0.2; this.level = 0.5;
    this.exhaust = new Biquad(); this.body = new Biquad(); this.intake = new Biquad(); this.tone = new Biquad();
    this.exhaust2 = new Biquad();
    this.seed = 12345;
    this.imb = [1.0, 0.9, 1.07, 0.95];
    this.decay = Math.exp(-1 / (sampleRate * 0.0045));
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
    this.exhaust.bandpass(55 + rpm * 0.011, 1.4);
    this.exhaust2.bandpass(120 + rpm * 0.028, 2.2);
    this.body.bandpass(330 + rpm * 0.06, 2.5);
    this.intake.highpass(1800 + rpm * 0.25, 0.7);
    this.tone.lowpass(1800 + rpm * 0.9 + load * 1500, 0.7);
    const inc = ff / sampleRate;
    for (let i = 0; i < ch.length; i++) {
      this.phase += inc;
      if (this.phase >= 1) {
        this.phase -= 1;
        this.cyl = (this.cyl + 1) & 3;
        this.kick = (0.22 + 0.78 * load) * this.imb[this.cyl] * (0.85 + this.rand() * 0.3);
        this.env = 1;
      }
      this.env *= this.decay;
      const n = this.rand() * 2 - 1;
      const exc = this.kick * this.env * (0.55 + 0.45 * n);
      let s = this.exhaust.run(exc) * 2.6 + this.exhaust2.run(exc) * 1.1 + this.body.run(exc) * 0.55;
      s += this.intake.run(n * (0.04 + load * 0.08) * (0.4 + this.env));
      s = this.tone.run(s);
      s = Math.tanh(s * (1.6 + load * 1.2)) * this.level;
      ch[i] = s;
    }
    for (let c = 1; c < out.length; c++) out[c].set(ch);
    return true;
  }
}

registerProcessor('sro-engine', EngineProcessor);
