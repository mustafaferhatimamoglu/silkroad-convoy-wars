// Lastik sesleri (AudioWorklet).
//
//  * Cigliklama (sert zeminde kayma, drift, patinaj, kilitlenme): beyaz gurultu uc rezonansli
//    bant geciren suzgecte (f0, ~2f0, ~3f0) - gercek lastik ciglikligi perdeli bir ugultudur.
//    Perde kayma hiziyla yukselir; yapis-kay titresimi genligi 15-40 Hz'de dalgalandirir;
//    agir kaymada genis bantli "surtunme hisirtisi" eklenir. Patinajda (boyuna kayma) perde
//    daha kalin ve puruzlu olur.
//  * Cakil / toprak / kum: tanecikli (granuler) sentez - Poisson dagilimli kisa gurultu
//    patlamalari; siklik ve siddet kayma + hiza baglidir (kayarken tas puskurtme, normal
//    yuvarlanmada hafif citirti). Kumda yumusak "hisirti", cimende hafif surtunme.
//  * Yuvarlanma ugultusu: hizla artan, sert zeminde belirgin alcak frekansli gurultu.
// Parametreler k-rate; VehicleAudio her karede tekerlek durumlarindan hesaplar.

class Bq {
  constructor() { this.b0 = 0; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  set(type, f, q) {
    const w = (2 * Math.PI * Math.min(f, sampleRate * 0.45)) / sampleRate, s = Math.sin(w), c = Math.cos(w), a = s / (2 * q), a0 = 1 + a;
    if (type === 'bp') { this.b0 = a / a0; this.b1 = 0; this.b2 = -a / a0; }
    else if (type === 'lp') { this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = (1 - c) / 2 / a0; }
    else { this.b0 = (1 + c) / 2 / a0; this.b1 = -(1 + c) / a0; this.b2 = (1 + c) / 2 / a0; }
    this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const KEYS = ['squeal', 'pitch', 'spin', 'scrub', 'gravel', 'rate', 'tone', 'roll', 'rollTone', 'soft', 'level'];

class TireProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const p = (name, def, max = 1) => ({ name, defaultValue: def, minValue: 0, maxValue: max, automationRate: 'k-rate' });
    return [
      p('squeal', 0), p('pitch', 800, 4000), p('spin', 0), p('scrub', 0),
      p('gravel', 0), p('rate', 0, 2000), p('tone', 1800, 6000),
      p('roll', 0), p('rollTone', 400, 3000), p('soft', 0), p('level', 0.6, 2),
    ];
  }

  constructor() {
    super();
    this.seed = 22222;
    this.res = [new Bq(), new Bq(), new Bq()];
    this.scrubHp = new Bq(); this.scrubHp.set('hp', 2600, 0.7);
    this.grainBp = new Bq(); this.grainLp = new Bq();
    this.rollLp = new Bq(); this.rollLp2 = new Bq();
    this.softLp = new Bq(); this.softLp.set('lp', 700, 0.6);
    this.cur = { squeal: 0, pitch: 800, spin: 0, scrub: 0, gravel: 0, rate: 0, tone: 1800, roll: 0, rollTone: 400, soft: 0, level: 0.6 };
    this.phase = 0; this.chatF = 24; this.chatP = 0; this.jit = 0;
    this.grains = new Float32Array(32); this.gdec = new Float32Array(32); this.gn = 0;
    this.pink = [0, 0, 0];
    this.dc = 0;
  }

  rnd() {
    let s = this.seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.seed = s >>> 0;
    return this.seed / 4294967296;
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const ch = out && out[0];
    if (!ch) return true;
    const n = ch.length, sr = sampleRate;
    const C = this.cur;
    // parametreleri yumusat (ani gecis tiklamasi olmasin)
    for (let j = 0; j < KEYS.length; j++) { const k = KEYS[j]; C[k] += (params[k][0] - C[k]) * (j === 1 || j === 6 || j === 8 ? 0.25 : 0.35); }
    // cigliklama rezonanslari: perde titresimi (stick-slip) ile hafif kayar
    this.jit += ((this.rnd() * 2 - 1) - this.jit) * 0.15;
    const spin = C.spin;
    const f0 = C.pitch * (1 + 0.025 * this.jit) * (1 - 0.18 * spin);
    const q = 22 - 10 * spin;
    this.res[0].set('bp', f0, q);
    this.res[1].set('bp', f0 * 2.03, q * 0.7);
    this.res[2].set('bp', f0 * 3.07, q * 0.5);
    this.grainBp.set('bp', C.tone, 0.9);
    this.grainLp.set('lp', 700, 0.7);
    this.rollLp.set('lp', C.rollTone, 0.6);
    this.rollLp2.set('lp', C.rollTone * 1.6, 0.6);
    this.chatF += ((15 + this.rnd() * 25) - this.chatF) * 0.05;
    const chatInc = this.chatF / sr;
    const sq = C.squeal, sc = C.scrub, gv = C.gravel, rl = C.roll, sf = C.soft;
    const grainP = C.rate / sr;
    const gd = Math.exp(-1 / (sr * (0.002 + 0.004 * this.rnd())));
    for (let i = 0; i < n; i++) {
      const w = this.rnd() * 2 - 1;
      let s = 0;
      if (sq > 0.002) {
        this.chatP += chatInc; if (this.chatP >= 1) this.chatP -= 1;
        const am = 0.72 + 0.28 * Math.sin(2 * Math.PI * this.chatP) + spin * 0.25 * (this.rnd() - 0.5);
        const r = this.res[0].run(w) + 0.5 * this.res[1].run(w) + 0.22 * this.res[2].run(w);
        s += r * sq * am * (4.5 + 1.2 * spin);
      }
      if (sc > 0.002) s += this.scrubHp.run(w) * sc * 0.35;
      // tanecikler (cakil): Poisson dogumu, kisa sonen gurultu patlamalari
      if (gv > 0.002) {
        if (this.rnd() < grainP && this.gn < 32) { this.grains[this.gn] = 0.3 + this.rnd() * 0.7; this.gdec[this.gn] = gd; this.gn++; }
        let e = 0;
        for (let k = 0; k < this.gn; k++) {
          e += this.grains[k];
          this.grains[k] *= this.gdec[k];
          if (this.grains[k] < 0.004) { this.gn--; this.grains[k] = this.grains[this.gn]; this.gdec[k] = this.gdec[this.gn]; k--; }
        }
        const gnz = w * e;
        s += (this.grainBp.run(gnz) * 0.42 + this.grainLp.run(gnz) * 0.16) * gv;
      }
      // yuvarlanma ugultusu: pembe gurultu (uc kutuplu yaklasik) alcak geciren
      if (rl > 0.002) {
        const P = this.pink;
        P[0] = 0.997 * P[0] + w * 0.029591; P[1] = 0.985 * P[1] + w * 0.032534; P[2] = 0.95 * P[2] + w * 0.048056;
        const pk = P[0] + P[1] + P[2] + w * 0.05;
        s += this.rollLp2.run(this.rollLp.run(pk)) * rl * 1.1;
      }
      if (sf > 0.002) s += this.softLp.run(w) * sf * 0.3;
      this.dc += (s - this.dc) * 0.001;
      ch[i] = Math.tanh((s - this.dc) * C.level);
    }
    for (let c = 1; c < out.length; c++) out[c].set(ch);
    return true;
  }
}

registerProcessor('sro-tires', TireProcessor);
