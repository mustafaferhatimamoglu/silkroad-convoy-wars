// Fiziksel modelli motor sesi (AudioWorklet), surum 2.
//
// Yaklasim iki acik kaynak calismadan esinlenir: DasEtwas/enginesound (Rust, MIT) ve onun
// tarayici uyarlamasi Antonio-R1/engine-sound-generator (MIT). Ikisinde de motor sesi
// osilatorle "sentezlenmez": silindirlerden borulara giden basinc darbeleri dijital dalga
// kilavuzlarinda (iki yonlu gecikme hatlari) yayilir, eklemlerde yansir, susturucuda
// sonumlenir ve egzoz ucundan disari yayilir. Burada ayni fikir daha fiziksel kuruldu
// (kod aktarilmadi):
//
//  * Silindir: krank acisina gore hacim; kapali fazda politropik sikistirma/genlesme ve Wiebe
//    yanma egrisi; supaplar acikken basinc diferansiyel denklemi. Supap bir orifistir
//    (Q ~ A*sqrt(dP)); sinir kosulu boruya gelen dalgayla birlikte kapali bicimde (ikinci
//    derece denklem) cozulur -> kararli ve her devirde dogal darbe sekli.
//  * Egzoz: manifold kollari -> kollektor (N kollu sacilma eklemi; kola geri donen negatif
//    dalga = supurme etkisi) -> (V8'de iki sira + Y boru) -> borular, katalizor/susturucu
//    odalari (kesit degisimi yansimalari + emici kayip) -> cikis borusu -> acik uc (frekansa
//    bagli yansima). Duyulan ses uctaki hacimsel akisin turevidir (tek kutuplu isinim).
//  * Emme: silindir -> emme kollari -> plenum -> gaz kelebegi (aciklikla iletim) -> hava
//    kutusu -> agiz. Dizelde kelebek yok; turbin egzoz darbelerini yutar, kompresor islik
//    calar.
//  * Mekanik: yanma basincinin artis hizindan dogan blok vuruntusu (dizel takirtisi), supap
//    oturma tikirtilari, atesleme darbelerinin blok titresimi.
//  * Canlilik: cevrimden cevrime yanma farki, silindir dengesizligi, rolanti dalgalanmasi,
//    gazdan ayak cekince / devir sinirinda yakit kesme, karburatorlu motorda geri tepme.
//
// Cikislar (mono): 0 = egzoz (aracin arkasi), 1 = emme + turbo (motor bolmesi),
// 2 = mekanik (supap, yanma vuruntusu), 3 = govde titresimi (kabin ici ugultu).
// Karisim kamera konumuna gore VehicleAudio'da yapilir.

const GAMMA = 1.32;
const K_RAD = 200;   // isinim ciktisini (bar/ornek) ses seviyesine olcekler
const FOURPI = 4 * Math.PI;

// ---------------------------------------------------------------------------------------
// Motor profilleri. Uzunluk m, cap mm, supap etkin alani m^2, silindir hacmi L,
// supap zamanlari krank derecesi (atesleme UNS'si = 0, tam cevrim = 720).
// exhaust/intake: sirali boru parcalari; chamber = susturucu/hava kutusu odasi (emici),
// fc = boru basina alcak geciren kayip (Hz), loss = gecis basina kazanc.
export const PROFILES = {
  // Tofas Kartal 1.6 (Fiat 131 OHC, cift govdeli karburator, katalizorsuz, iki susturucu)
  kartal: {
    cyl: 4, order: [1, 3, 4, 2], vd: 0.396, cr: 9.2, diesel: false,
    idle: 850, redline: 6200, limiter: 6350,
    valves: { evo: 128, evc: 372, ivo: 348, ivc: 592 },
    exValve: 4.6e-4, inValve: 5.6e-4, kc: 3.6, burn: 0.085,
    cov: [0.13, 0.05], bias: 0.05, carb: true,
    exRunners: { len: [0.46, 0.36, 0.36, 0.46], d: 34 },
    exhaust: [
      { len: 0.85, d: 42, c: 540 },
      { len: 1.1, d: 42, c: 520 },
      { len: 0.30, d: 105, c: 500, chamber: true, fc: 2200, loss: 0.9 },  // orta susturucu
      { len: 1.35, d: 42, c: 480 },
      { len: 0.46, d: 150, c: 460, chamber: true, fc: 1100, loss: 0.84 }, // arka susturucu
      { len: 0.30, d: 40, c: 440 },
    ],
    tailFc: 2600,
    inRunners: { len: [0.20, 0.25, 0.25, 0.20], d: 33 },
    intake: [
      { len: 0.07, d: 60 },                                               // karburator alti
      { len: 0.06, d: 36 },                                               // karburator gobegi
      { len: 0.16, d: 210, chamber: true, fc: 2600, loss: 0.9 },         // yuvarlak hava filtresi
      { len: 0.10, d: 52 },
    ],
    snorkelFc: 3000,
    jet: [0.35, 0.08],
    mech: { valve: 0.55, knock: 0.05, res: [[880, 9, 1], [1650, 11, 0.8], [2900, 12, 0.55]], vres: [[3300, 7, 1], [5200, 8, 0.6]] },
    pops: [2.5, 3],
    gain: { ex: 1.0, in: 1.0, mech: 12.6, vib: 3.8 },
  },

  // Toyota Hilux 2.8 D-4D (1GD-FTV: sira 4 dizel, degisken kanatli turbo, DPF)
  hilux: {
    cyl: 4, order: [1, 3, 4, 2], vd: 0.697, cr: 15.6, diesel: true,
    idle: 750, redline: 3900, limiter: 4150,
    valves: { evo: 140, evc: 366, ivo: 354, ivc: 572 },
    exValve: 6.4e-4, inValve: 7.6e-4, kc: 3.0, idleFuel: 0.16,
    cov: [0.05, 0.025], bias: 0.03,
    exRunners: { len: [0.26, 0.20, 0.20, 0.26], d: 38 },
    exhaust: [
      { len: 0.12, d: 70, c: 560, loss: 0.68, fc: 900 },                  // turbin (darbeleri yutar)
      { len: 0.75, d: 63, c: 520 },
      { len: 0.55, d: 165, c: 500, chamber: true, fc: 1400, loss: 0.82 }, // DOC + DPF
      { len: 1.9, d: 63, c: 470 },
      { len: 0.50, d: 175, c: 450, chamber: true, fc: 900, loss: 0.82 },  // susturucu
      { len: 0.40, d: 57, c: 430 },
    ],
    tailFc: 2200,
    inRunners: { len: [0.30, 0.34, 0.34, 0.30], d: 40 },
    intake: [
      { len: 0.12, d: 75 },                                               // plenum
      { len: 1.2, d: 55 },                                                // intercooler hatti
      { len: 0.30, d: 190, chamber: true, fc: 2200, loss: 0.88 },        // hava kutusu
      { len: 0.22, d: 70 },
    ],
    snorkelFc: 2600,
    jet: [0.25, 0.05],
    turbo: { boost: 1.25, spoolFrom: 1150, spoolTo: 2300, up: 0.75, down: 1.6, whistle: 0.06, f0: 2300, f1: 7200 },
    mech: { valve: 0.35, knock: 1.0, res: [[920, 10, 1], [1780, 12, 0.9], [2650, 13, 0.75], [3900, 14, 0.5]], vres: [[3600, 7, 1], [5600, 8, 0.6]] },
    pops: null,
    gain: { ex: 1.0, in: 1.0, mech: 6.3, vib: 0.8 },
  },

  // Ford F-150 5.0 V8 (Coyote; capraz duzlem krank, 1-5-4-8-6-3-7-2, sag sira 1-4, sol 5-8)
  f150: {
    cyl: 8, order: [1, 5, 4, 8, 6, 3, 7, 2], vd: 0.629, cr: 12.0, diesel: false,
    banks: [[1, 2, 3, 4], [5, 6, 7, 8]],
    idle: 650, redline: 6600, limiter: 6900,
    valves: { evo: 132, evc: 378, ivo: 344, ivc: 596 },
    exValve: 8.0e-4, inValve: 1.0e-3, kc: 3.7, burn: 0.08,
    cov: [0.07, 0.035], bias: 0.035,
    exRunners: { len: [0.40, 0.31, 0.33, 0.42, 0.42, 0.33, 0.31, 0.40], d: 40 },
    bankPipes: [{ len: 0.75, d: 57, c: 540 }, { len: 1.55, d: 57, c: 530 }], // sol sira karsiya gecer
    exhaust: [
      { len: 0.45, d: 125, c: 520, chamber: true, fc: 3000, loss: 0.9 },  // katalizorler
      { len: 1.7, d: 70, c: 490 },
      { len: 0.56, d: 210, c: 470, chamber: true, fc: 1000, loss: 0.86 }, // susturucu
      { len: 0.42, d: 76, c: 450 },
    ],
    tailFc: 2000,
    inRunners: { len: [0.46, 0.46, 0.46, 0.46, 0.46, 0.46, 0.46, 0.46], d: 42 },
    intake: [
      { len: 0.20, d: 110 },                                              // plenum
      { len: 0.55, d: 85 },                                               // kelebek -> giris borusu
      { len: 0.34, d: 220, chamber: true, fc: 2000, loss: 0.88 },        // hava kutusu
      { len: 0.25, d: 90 },
    ],
    snorkelFc: 2400,
    jet: [0.3, 0.05],
    mech: { valve: 0.3, knock: 0.04, res: [[760, 9, 1], [1500, 11, 0.8], [2500, 12, 0.5]], vres: [[3000, 7, 1], [4800, 8, 0.6]] },
    pops: [0, 2],
    gain: { ex: 1.0, in: 1.0, mech: 16, vib: 3.5 },
  },
};

// ---------------------------------------------------------------------------------------
const coef = (fc, sr) => 1 - Math.exp((-2 * Math.PI * fc) / sr);

/** Iki yonlu gecikme hatti (dalga kilavuzu). A ucundan B'ye `r`, B'den A'ya `l`. */
class Pipe {
  constructor(n, area, loss, k) {
    this.n = n;
    this.r = new Float32Array(n);
    this.l = new Float32Array(n);
    this.i = 0;
    this.area = area; this.g = loss; this.k = k;
    this.fa = 0; this.fb = 0;
    this.inA = 0; this.inB = 0;    // bu ornekte uclara varan dalgalar
    this.outA = 0; this.outB = 0;  // uclardan boruya giren dalgalar
  }
  read() {
    const i = this.i;
    this.fb += this.k * (this.r[i] * this.g - this.fb);
    this.fa += this.k * (this.l[i] * this.g - this.fa);
    this.inB = this.fb; this.inA = this.fa;
  }
  write() {
    const i = this.i;
    this.r[i] = this.outA; this.l[i] = this.outB;
    this.i = i + 1 === this.n ? 0 : i + 1;
  }
}

/** N kollu sacilma eklemi (basinc dalgalari, admitans = kesit). */
class Junction {
  constructor(ports) {
    this.pipes = ports.map((p) => p[0]);
    this.ends = Int8Array.from(ports.map((p) => p[1]));
    this.Y = Float64Array.from(ports.map((p) => p[0].area));
    let s = 0;
    for (const y of this.Y) s += y;
    this.k = 2 / s;
    this.inject = 0;
  }
  run() {
    const P = this.pipes, E = this.ends, Y = this.Y, n = P.length;
    let s = 0;
    for (let i = 0; i < n; i++) s += Y[i] * (E[i] ? P[i].inB : P[i].inA);
    const pj = s * this.k + this.inject;
    for (let i = 0; i < n; i++) {
      if (E[i]) P[i].outB = pj - P[i].inB;
      else P[i].outA = pj - P[i].inA;
    }
  }
}

/**
 * Gaz kelebegi: a borusunun B ucu ile b borusunun A ucu arasinda degisken iletim.
 * Ortalama akis (manifold basinci ayrica hesaplanir) kelebekten her zaman gecer; yalnizca
 * akustik (degisen) kisim kapali kelebekten yansir. Yoksa kapali kelebek rijit duvar olur,
 * silindirler emme hattini bosaltir ve rolantide dolgu sifira duser.
 */
class Throttle {
  constructor(a, b, sr) { this.a = a; this.b = b; this.t = 1; this.inject = 0; this.da = 0; this.db = 0; this.k = coef(3, sr); }
  run() {
    const ia = this.a.inB, ib = this.b.inA, t = this.t;
    this.da += this.k * (ia - this.da);
    this.db += this.k * (ib - this.db);
    this.a.outB = t * ib + (1 - t) * (ia - this.da) + this.inject;
    this.b.outA = t * ia + (1 - t) * (ib - this.db) + this.inject;
  }
}

/** Acik boru ucu: frekansa bagli ters yansima; yayilan ses = uctaki akisin turevi. */
class OpenEnd {
  constructor(pipe, fc, sr) { this.pipe = pipe; this.k = coef(fc, sr); this.lp = 0; this.u = 0; this.out = 0; }
  run() {
    const p = this.pipe, x = p.inB;
    this.lp += this.k * (x - this.lp);
    p.outB = -0.97 * this.lp;
    const u = x - p.outB;
    this.out = u - this.u;
    this.u = u;
  }
}

class Biquad {
  constructor() { this.b0 = 0; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  set(type, f, q, sr) {
    const w = (2 * Math.PI * f) / sr, s = Math.sin(w), c = Math.cos(w), a = s / (2 * q), a0 = 1 + a;
    if (type === 'bp') { this.b0 = a / a0; this.b1 = 0; this.b2 = -a / a0; }
    else if (type === 'lp') { this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = (1 - c) / 2 / a0; }
    else { this.b0 = (1 + c) / 2 / a0; this.b1 = -(1 + c) / a0; this.b2 = (1 + c) / 2 / a0; }
    this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Supap sinir kosulu: D = P_silindir - P_boru - 2*gelen dalga, G = iletkenlik. Donus: Z*u (bar).
 * lim: bogulma siniri (ses hizinda akis; disari ve iceri yonde ayri).
 */
function valveFlow(D, G, limOut, limIn, rev) {
  if (G <= 1e-7) return 0;
  // ters yonde (borudan silindire) supap/port geometrisi daha az gecirgendir
  if (D < 0) G *= rev;
  const a = D < 0 ? -D : D;
  const y = (2 * a) / (1 + Math.sqrt(1 + (4 * a) / (G * G)));
  return D < 0 ? -Math.min(y, limIn) : Math.min(y, limOut);
}

/**
 * Supap sabitleri (gaz yogunlugu 1 bar'daki rho0 icin): G (sqrt(bar)), akis donusumu
 * Kq (L/s / bar) ve bogulma akisi (L/s). Yogunluk basincla olceklenir: G ~ sqrt(p),
 * Kq ~ 1/p. Dusuk manifold basincinda ayni basinc farki cok daha fazla hacim tasir.
 */
function valveConst(area, dRunner, rho0, c) {
  const A = Math.PI * (dRunner / 2000) ** 2;
  const Z = (rho0 * c) / A;
  return { G: (Z * area * Math.sqrt(2 / rho0)) / 316.23, Kq: 1e8 / Z, Qc: area * c * 0.6 * 1000 };
}

export class EngineModel {
  constructor(name, sr) {
    this.sr = sr;
    this.seed = 0x9e3779b9;
    this.setProfile(name);
  }

  rnd() {
    let s = this.seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.seed = s >>> 0;
    return this.seed / 4294967296;
  }
  gauss() { return (this.rnd() + this.rnd() + this.rnd() - 1.5) * 2; }

  setProfile(name) {
    const P = PROFILES[name] || PROFILES.kartal;
    this.name = PROFILES[name] ? name : 'kartal';
    this.P = P;
    const sr = this.sr, N = P.cyl;
    const pipes = [], juncs = [];
    const mk = (s, c0, fc0, loss0) => {
      const c = s.c || c0;
      const p = new Pipe(Math.max(2, Math.round((s.len / c) * sr)), (s.d / 1000) ** 2,
        s.loss ?? loss0 ?? Math.pow(0.965, s.len), coef(s.fc ?? fc0, sr));
      pipes.push(p);
      return p;
    };
    // silindirler
    const V = P.valves, vc = P.vd / (P.cr - 1);
    this.vc = vc; this.vh = P.vd / 2;
    this.xEvo = V.evo / 720; this.xEvc = V.evc / 720; this.xIvo = V.ivo / 720; this.xIvc = V.ivc / 720;
    this.invEx = 1 / (this.xEvc - this.xEvo); this.invIn = 1 / (this.xIvc - this.xIvo);
    this.exK = valveConst(P.exValve, P.exRunners.d, 0.42, 560);
    this.inK = valveConst(P.inValve, P.inRunners.d, 1.2, 345);
    this.cyls = [];
    for (let i = 0; i < N; i++) {
      const slot = P.order.indexOf(i + 1);
      const ex = mk({ len: P.exRunners.len[i], d: P.exRunners.d }, 560, 9000, 0.996);
      const inn = mk({ len: P.inRunners.len[i], d: P.inRunners.d }, 345, 9000, 0.996);
      this.cyls.push({
        phase: slot / N, x: slot / N, V: 0, P: 1, Pivc: 0.4, Vivc: vc + P.vd * 0.94, comb: P.kc, pm: 0.3, e1: 0, e2: 0,
        open: false, bias: 1 + (this.rnd() * 2 - 1) * P.bias, ex, in: inn, bank: 0,
      });
    }
    // egzoz
    const chain = P.exhaust.map((s) => mk(s, 500, s.chamber ? 1500 : 4200));
    if (P.banks) {
      const bp = P.bankPipes.map((s) => mk(s, 540, 4500));
      this.collectors = [];
      P.banks.forEach((g, k) => {
        for (const c of g) this.cyls[c - 1].bank = k;
        const j = new Junction([...g.map((c) => [this.cyls[c - 1].ex, 1]), [bp[k], 0]]);
        juncs.push(j);
        this.collectors.push(j);
      });
      juncs.push(new Junction([...bp.map((p) => [p, 1]), [chain[0], 0]]));
    } else {
      const j = new Junction([...this.cyls.map((c) => [c.ex, 1]), [chain[0], 0]]);
      juncs.push(j);
      this.collectors = [j];
    }
    let lastChamber = -1;
    for (let i = 1; i < chain.length; i++) {
      const j = new Junction([[chain[i - 1], 1], [chain[i], 0]]);
      juncs.push(j);
      if (P.exhaust[i].chamber) { lastChamber = i; this.popJ = j; }
      if (i === chain.length - 1) this.tailJ = j;
    }
    if (lastChamber < 0) this.popJ = this.tailJ;
    this.exOpen = new OpenEnd(chain[chain.length - 1], P.tailFc, sr);
    // emme
    const ich = P.intake.map((s) => mk(s, 345, s.chamber ? 2000 : 5000));
    this.plenum = new Junction([...this.cyls.map((c) => [c.in, 1]), [ich[0], 0]]);
    juncs.push(this.plenum);
    this.throttle = new Throttle(ich[0], ich[1], sr);
    for (let i = 2; i < ich.length; i++) juncs.push(new Junction([[ich[i - 1], 1], [ich[i], 0]]));
    this.inOpen = new OpenEnd(ich[ich.length - 1], P.snorkelFc, sr);
    this.pipes = pipes; this.juncs = juncs;

    // mekanik rezonanslar
    this.kRes = P.mech.res.map(([f, q, g]) => ({ bq: new Biquad().set('bp', f, q, sr), g }));
    this.vRes = P.mech.vres.map(([f, q, g]) => ({ bq: new Biquad().set('bp', f, q, sr), g }));
    this.vibLp1 = new Biquad().set('lp', 150, 0.7, sr);
    this.vibLp2 = new Biquad().set('lp', 150, 0.7, sr);
    this.vibHp = new Biquad().set('hp', 28, 0.7, sr);
    // jet gurultusu: supaptan gecen gaz jeti (Strouhal ~0.2 -> 0.7..2.5 kHz)
    this.jetBp = [new Biquad().set('bp', 1500, 0.55, sr), new Biquad().set('bp', 1700, 0.55, sr)];
    this.ijetBp = new Biquad().set('bp', 1200, 0.6, sr);
    this.jet = new Float64Array(2);
    this.whBp = new Biquad().set('bp', 4000, 4, sr);
    this.kEnv = 0; this.vEnv = 0;
    this.kDecay = Math.exp(-1 / (sr * 0.00035));
    this.vDecay = Math.exp(-1 / (sr * 0.00025));
    this.popEnv = 0; this.popDelay = -1; this.popAmp = 0;
    this.popDecay = Math.exp(-1 / (sr * 0.004));

    // durum
    this.X = 0;
    this.rpm = P.idle; this.load = 0; this.map = 0.35; this.pe0 = 1.03; this.spool = 0;
    this.cut = false; this.limiting = false; this.overrunT = 0;
    this.jit = 0; this.jitT = 0; this.whPhase = 0;
    for (const c of this.cyls) {
      c.V = this.vc + this.vh * (1 - Math.cos(FOURPI * c.x));
      c.open = c.x >= this.xEvo && c.x < this.xIvc;
      c.P = 1;
    }
  }

  /** Bir cevrim icin yanma siddeti (UNS'de cagrilir). */
  _fire(c) {
    const P = this.P;
    let fuel = 1;
    if (P.diesel) fuel = P.idleFuel + (1 - P.idleFuel) * this.load;
    let misfire = false;
    if (this.limiting && this.rnd() < 0.7) fuel = 0;
    else if (this.cut) {
      if (P.carb) {
        // karburatorde rolanti devresi yakit vermeye devam eder: zayif/teklemeli yanma
        if (this.rnd() < 0.32) { fuel = 0; misfire = true; } else fuel = 0.25 + this.rnd() * 0.2;
      } else fuel = 0;
    }
    const L = this.load;
    const sigma = P.cov[0] + (P.cov[1] - P.cov[0]) * Math.min(1, L * 1.5 + (this.rpm - P.idle) / 2500);
    c.comb = fuel > 0 ? Math.max(0, P.kc * fuel * c.bias * (1 + sigma * this.gauss())) : 0;
    // dizel: tutusma gecikmesinde biriken yakit (on karisimli yanma) yukten neredeyse bagimsizdir;
    // agir yukte fazla yakit difuzyonla yavas yanar. Takirti bu ani yanmadan gelir.
    if (P.diesel && fuel > 0) c.pm = Math.min(0.6, (0.5 * P.idleFuel) / fuel);
    // yanmamis karisim sicak egzozda patlar (geri tepme)
    // P.pops = [motor freninde, devir sinirinda] saniyedeki ortalama patlama
    if (P.pops && this.popDelay < 0 && this.rpm > 2400 && fuel === 0) {
      const events = (this.rpm / 120) * P.cyl;
      let rate = 0;
      if (this.limiting) rate = P.pops[1];
      else if (misfire) rate = P.pops[0] * Math.max(0, 1 - this.overrunT / 2.5) / 0.32;
      if (this.rnd() < rate / events) {
        this.popDelay = Math.floor(this.sr * (0.006 + this.rnd() * 0.02));
        this.popAmp = (0.04 + this.rnd() * 0.1) * Math.min(1.2, this.rpm / 4000);
      }
    }
  }

  /** Blok basina degisen degerler (devir, yuk, manifold basinci, turbo...). */
  _block(rpmT, loadT, dt) {
    const P = this.P;
    this.rpm += (rpmT - this.rpm) * 0.35;
    this.load += (loadT - this.load) * 0.3;
    const rpm = this.rpm, L = this.load;
    const rn = Math.min(1, Math.max(0, (rpm - P.idle) / (P.redline - P.idle)));
    // yakit kesme (histerezisli)
    if (this.cut) { if (L > 0.05 || rpm < P.idle + 180) this.cut = false; }
    else if (L < 0.02 && rpm > P.idle + 380) this.cut = true;
    this.overrunT = this.cut ? this.overrunT + dt : 0;
    this.limiting = rpm > P.limiter - 25;
    // turbo
    let boost = 0;
    if (P.turbo) {
      const T = P.turbo;
      const target = Math.min(1, Math.max(0, (rpm - T.spoolFrom) / (T.spoolTo - T.spoolFrom))) * Math.pow(L, 0.8);
      this.spool += (target - this.spool) * Math.min(1, dt / (target > this.spool ? T.up : T.down));
      boost = T.boost * this.spool;
    }
    // manifold ve egzoz ortalama basinclari
    let map;
    if (P.diesel) map = 1.0 + boost;
    else {
      const pv = 0.31 - 0.11 * rn;
      map = pv + (0.97 - pv) * (1 - Math.pow(1 - L, 3));
      this.throttle.t = 0.03 + 0.97 * (1 - (1 - L) * (1 - L));
    }
    this.map += (map - this.map) * Math.min(1, dt / 0.05);
    this.pe0 = P.diesel ? 1.05 + 0.85 * this.spool : 1.03 + 0.28 * L * rn * rn;
    // rolanti dalgalanmasi (yavas, kucuk)
    this.jitT -= dt;
    if (this.jitT <= 0) { this.jitT = 0.25 + this.rnd() * 0.5; this.jitTarget = (this.rnd() * 2 - 1); }
    this.jit += ((this.jitTarget || 0) - this.jit) * Math.min(1, dt * 3);
  }

  render(oE, oI, oM, oV, n, rpmT, loadT) {
    const sr = this.sr, P = this.P, dt = n / sr;
    const rpm0 = this.rpm;
    this._block(rpmT, loadT, dt);
    const idleAmt = Math.max(0, 1 - (this.rpm - P.idle) / 500);
    const rpm1 = this.rpm * (1 + 0.006 * idleAmt * this.jit);
    const cyls = this.cyls, N = cyls.length, pipes = this.pipes, nP = pipes.length, juncs = this.juncs, nJ = juncs.length;
    const xEvo = this.xEvo, xEvc = this.xEvc, xIvo = this.xIvo, xIvc = this.xIvc, invEx = this.invEx, invIn = this.invIn;
    const GE = this.exK.G * Math.sqrt(this.pe0), KE = this.exK.Kq / this.pe0;
    const GI = this.inK.G * Math.sqrt(this.map), KI = this.inK.Kq / this.map;
    const QcE = this.exK.Qc / KE, QcI = this.inK.Qc / KI;  // bogulma (Z*u birimi, 1 bar yukari akis)
    const vc = this.vc, vh = this.vh, invSr = 1 / sr;
    const map = this.map, pe0 = this.pe0;
    const diesel = P.diesel, burnX = P.burn || 0.08;
    const rn = Math.min(1, this.rpm / P.redline);
    const jetE = P.jet[0], jetI = P.jet[1] * (P.diesel ? 1 : 0.3 + 0.7 * this.throttle.t);
    const cols = this.collectors, nCol = cols.length, jet = this.jet;
    const vClick = P.mech.valve * (0.25 + 0.75 * rn);
    const kGain = P.mech.knock * (P.diesel ? P.idle / Math.max(P.idle, this.rpm) : 1);
    const T = P.turbo;
    const whF = T ? T.f0 + (T.f1 - T.f0) * this.spool : 0;
    const whA = T ? T.whistle * this.spool * this.spool * (0.3 + 0.7 * this.load) : 0;
    const G = P.gain;
    // Devire bagli kazanc: fiziksel ses rolantiden kirmizi cizgiye ~20 dB artar; oyunda bu
    // aralik yariya iner, yuk (gaz acik/kapali) farki oldugu gibi kalir. Rolanti gercekte tam
    // gazdan ~25 dB sessizdir ve enerjisi 160 Hz altindadir; duyulsun diye rolantiye yakin
    // devirde egzoz ve emmeye ek kazanc verilir (gaz acildikca kalkar).
    const idleBoost = 1 + 2 * Math.max(0, 1 - (this.rpm - P.idle) / 900) * (1 - 0.7 * this.load);
    const rg = this.rgOn === false ? 1 : 2.2 * Math.pow(Math.max(1, this.rpm / P.idle), -0.45);
    const rgA = this.rgOn === false ? 1 : rg * idleBoost;   // egzoz + emme
    const rgM = this.rgOn === false ? 1 : rg * (1 + (idleBoost - 1) * (P.diesel ? 0 : 0.5)); // supap tikirtisi
    const vibG = G.vib / (0.25 + 0.75 * this.load);
    const kRes = this.kRes, vRes = this.vRes;
    for (let s = 0; s < n; s++) {
      const rpm = rpm0 + ((rpm1 - rpm0) * (s + 1)) / n;
      this.X += (rpm / 120) * invSr;
      if (this.X >= 1) this.X -= 1;
      for (let i = 0; i < nP; i++) pipes[i].read();
      let power = 0, knock = 0, ijet = 0;
      jet[0] = 0; jet[1] = 0;
      for (let i = 0; i < N; i++) {
        const c = cyls[i];
        let x = this.X + c.phase;
        if (x >= 1) x -= 1;
        const xp = c.x;
        c.x = x;
        if (x < xp) this._fire(c);
        if ((xp < xEvc && x >= xEvc) || (xp < xIvc && x >= xIvc)) this.vEnv += vClick * (0.7 + 0.6 * this.rnd());
        const Vn = vc + vh * (1 - Math.cos(FOURPI * x));
        const dV = Vn - c.V;
        c.V = Vn;
        const re = c.ex, ri = c.in;
        if (x >= xEvo && x < xIvc) {
          c.open = true;
          let Q = 0;
          if (x < xEvc) {
            const sn = Math.sin(Math.PI * (x - xEvo) * invEx);
            const a = Math.min(1, 2.2 * sn * sn);
            const y = valveFlow(c.P - pe0 - 2 * re.inA, GE * a, QcE * a * c.P / pe0, QcE * a, 0.45);
            re.outA = y + re.inA;
            Q += y * KE;
            if (y > 0) jet[c.bank] += y * y;
          } else re.outA = re.inA;
          if (x >= xIvo) {
            const sn = Math.sin(Math.PI * (x - xIvo) * invIn);
            const a = Math.min(1, 2.2 * sn * sn);
            const y = valveFlow(c.P - map - 2 * ri.inA, GI * a, QcI * a * c.P / map, QcI * a, 0.6);
            ri.outA = y + ri.inA;
            Q += y * KI;
            if (y < 0) ijet += y * y;
          } else ri.outA = ri.inA;
          c.P -= (GAMMA * c.P * (dV + Q * invSr)) / Vn;
          if (c.P < 0.05) c.P = 0.05;
        } else {
          re.outA = re.inA; ri.outA = ri.inA;
          if (c.open) { c.open = false; c.Pivc = c.P; c.Vivc = Vn; }
          let burn = 0;
          if (x < xEvo) {
            if (diesel) {
              // on karisimli kisim aniden baslar (tutusma gecikmesi sonu), difuzyon yavas
              const t1 = Math.min(1, x / 0.012), t2 = x / 0.075;
              burn = c.pm * (1 - Math.exp(-5 * t1 * Math.sqrt(t1))) + (1 - c.pm) * (1 - Math.exp(-5 * t2 * t2 * t2));
            } else {
              const t = x / burnX;
              burn = 1 - Math.exp(-5 * t * t * t);
            }
          }
          const base = c.Pivc * Math.pow(c.Vivc / Vn, GAMMA);
          const extra = base * c.comb * burn;
          c.P = base + extra;
          // yanma vuruntusu: yanma basincinin ani degisimi (ikinci fark); sikistirma sayilmaz
          const jerk = extra - 2 * c.e1 + c.e2;
          c.e2 = c.e1; c.e1 = extra;
          if (jerk > 0) knock += jerk;
        }
        power += (c.P - 1) * dV;
      }
      // jet gurultusu: her egzoz darbesiyle "puf", emme akisiyla hisirti (anlik akisa bagli);
      // geri tepme patlamalari son susturucunun girisine basinc darbesi olarak eklenir
      for (let k = 0; k < nCol; k++) cols[k].inject = this.jetBp[k].run(this.rnd() * 2 - 1) * jet[k] * jetE;
      this.plenum.inject = this.ijetBp.run(this.rnd() * 2 - 1) * ijet * jetI;
      if (this.popDelay >= 0) {
        if (this.popDelay-- === 0) this.popEnv = this.popAmp;
      }
      let pop = 0;
      if (this.popEnv > 1e-4) {
        pop = this.popEnv * (0.6 + 0.8 * this.rnd());
        this.popEnv *= this.popDecay;
      }
      this.popJ.inject += pop;
      for (let j = 0; j < nJ; j++) juncs[j].run();
      this.throttle.run();
      this.popJ.inject = 0;
      this.exOpen.run();
      this.inOpen.run();
      for (let i = 0; i < nP; i++) pipes[i].write();

      // mekanik: yanma vuruntusu + supap tikirtisi (kisa gurultu patlamalari rezonanslarda)
      this.kEnv += knock * kGain;
      const nz = this.rnd() * 2 - 1;
      const ke = nz * this.kEnv, ve = (this.rnd() * 2 - 1) * this.vEnv;
      this.kEnv *= this.kDecay; this.vEnv *= this.vDecay;
      let m = 0;
      for (let k = 0; k < kRes.length; k++) m += kRes[k].bq.run(ke) * kRes[k].g;
      for (let k = 0; k < vRes.length; k++) m += vRes[k].bq.run(ve) * vRes[k].g * 0.05;
      const vib = this.vibHp.run(this.vibLp2.run(this.vibLp1.run(power)));
      // turbo islik sesi
      let wh = 0;
      if (whA > 1e-5) {
        this.whPhase += whF * invSr;
        if (this.whPhase >= 1) this.whPhase -= 1;
        wh = whA * (Math.sin(2 * Math.PI * this.whPhase) + 0.35 * this.whBp.run(nz));
      }
      const e = this.exOpen.out * K_RAD * G.ex;
      const ii = this.inOpen.out * K_RAD * G.in + wh;
      const mm = m * G.mech;
      const vv = vib * vibG;
      oE[s] = e * rgA;
      oI[s] = ii * rgA;
      oM[s] = mm * rgM;
      oV[s] = vv * rg;
    }
  }
}

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 850, minValue: 0, maxValue: 9000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'level', defaultValue: 0.5, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.model = new EngineModel(o.profile || 'kartal', sampleRate);
    this.level = 0.5;
    this.dc = new Float64Array(4);
    this.tmp = [new Float32Array(128), new Float32Array(128), new Float32Array(128), new Float32Array(128)];
    this.alive = true;
    if (this.port) {
      this.port.onmessage = (e) => {
        if (!e.data) return;
        if (e.data.profile) this.model.setProfile(e.data.profile);
        if (e.data.stop) this.alive = false;
      };
    }
  }

  process(inputs, outputs, params) {
    if (!this.alive) return false;
    const n = outputs[0] && outputs[0][0] ? outputs[0][0].length : 128;
    if (this.tmp[0].length !== n) this.tmp = [0, 1, 2, 3].map(() => new Float32Array(n));
    const [a, b, c, d] = this.tmp;
    const rpm = params.rpm[0];
    this.level += (params.level[0] - this.level) * 0.2;
    if (rpm < 60) {
      for (const o of outputs) for (const ch of o) ch.fill(0);
      return true;
    }
    this.model.render(a, b, c, d, n, rpm, params.load[0]);
    const lv = this.level;
    const srcs = this.tmp;
    for (let k = 0; k < 4; k++) {
      const out = outputs[k];
      if (!out || !out[0]) continue;
      const src = srcs[k], ch = out[0];
      let dc = this.dc[k];
      for (let i = 0; i < n; i++) {
        const v = src[i];
        dc += (v - dc) * 0.0008;
        ch[i] = Math.tanh((v - dc) * lv);
      }
      this.dc[k] = dc;
      for (let j = 1; j < out.length; j++) out[j].set(ch);
    }
    return true;
  }
}

registerProcessor('sro-engine', EngineProcessor);
