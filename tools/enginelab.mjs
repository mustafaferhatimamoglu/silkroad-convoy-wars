// Motor sesi laboratuvari: worklet'i Node'da cevrimdisi calistirir; her profil icin
// rolanti, gaz pompalama, tam gaz cekis, motor freni, seyir ve devir siniri senaryolarini
// isler. Kanal seviyeleri, tepe/NaN denetimi, islemci suresi; istenirse WAV ve spektrogram.
//   node tools/enginelab.mjs [profil|all] [cikis_klasoru]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SR = 48000;
let Proc = null;
globalThis.sampleRate = SR;
globalThis.AudioWorkletProcessor = class {};
globalThis.registerProcessor = (name, cls) => { Proc = cls; };
const { PROFILES } = await import('../src/audio/engine-worklet.js');

const which = process.argv[2] || 'all';
const outDir = process.argv[3] || null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });

// Senaryo: devir ve gaz zamana gore (oyundaki VehicleSim'in urettigi gibi)
function timeline(P) {
  const { idle, redline, limiter } = P;
  const seg = [
    ['rolanti', 3, () => ({ rpm: idle, load: 0 })],
    ['gaz pompalama', 3, (t) => {
      if (t < 0.45) return { rpm: idle + (redline * 0.72 - idle) * (t / 0.45), load: 1 };
      return { rpm: Math.max(idle, redline * 0.72 - (t - 0.45) * 2100), load: 0 };
    }],
    ['tam gaz cekis', 6.5, (t) => ({ rpm: 1300 + (redline - 1300) * Math.pow(t / 6.5, 0.85), load: 1 })],
    ['motor freni', 3.5, (t) => ({ rpm: redline - (redline - 1400) * (t / 3.5), load: 0 })],
    ['seyir', 3, () => ({ rpm: 2300, load: 0.3 })],
    ['devir siniri', 2, () => ({ rpm: limiter + 8, load: 1 })],
  ];
  return seg;
}

function render(name) {
  const P = PROFILES[name];
  const proc = new Proc({ processorOptions: { profile: name } });
  const segs = timeline(P);
  const total = segs.reduce((a, s) => a + s[1], 0);
  const n = Math.floor((total * SR) / 128) * 128;
  const ch = [0, 1, 2, 3].map(() => new Float32Array(n));
  const bounds = [];
  let t0 = 0;
  for (const s of segs) { bounds.push([s[0], t0, t0 + s[1], s[2]]); t0 += s[1]; }
  const blk = [0, 1, 2, 3].map(() => new Float32Array(128));
  const start = process.hrtime.bigint();
  for (let b = 0; b < n / 128; b++) {
    const t = (b * 128) / SR;
    const sg = bounds.find((x) => t >= x[1] && t < x[2]) || bounds[bounds.length - 1];
    const { rpm, load } = sg[3](t - sg[1]);
    proc.process([], blk.map((x) => [x]), { rpm: [rpm], load: [load], level: [0.5] });
    for (let k = 0; k < 4; k++) ch[k].set(blk[k], b * 128);
  }
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return { P, ch, bounds, total, cpu: ms / total / 10 }; // % of one core
}

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -999);
function rms(x, a, b) { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); }

// Kamera karisimlari (VehicleAudio ile ayni oranlar)
export const MIX = { ext: [1.0, 0.45, 0.5, 0.12], int: [0.55, 1.0, 0.85, 1.0] };
function mix(ch, w) {
  const n = ch[0].length, o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = ch[0][i] * w[0] + ch[1][i] * w[1] + ch[2][i] * w[2] + ch[3][i] * w[3];
  return o;
}

// ---- FFT / spektrogram / PNG
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

function spectrum(x, a, b, N = 8192) {
  // ortalama guc spektrumu (Hann, %50 bindirme)
  const acc = new Float64Array(N / 2);
  let cnt = 0;
  for (let o = a; o + N <= b; o += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[o + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    for (let k = 0; k < N / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
    cnt++;
  }
  for (let k = 0; k < N / 2; k++) acc[k] /= Math.max(1, cnt);
  return acc;
}

function aWeight(f) {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return ra * 1.2589; // +2.0 dB
}
/** A agirlikli seviye farki (dB): spektrumdan agirlikli/agirliksiz guc orani. */
function aDelta(spec, N = 8192) {
  let w = 0, t = 0;
  for (let k = 1; k < spec.length; k++) { const a = aWeight((k * SR) / N); w += spec[k] * a * a; t += spec[k]; }
  return 10 * Math.log10(w / t + 1e-30);
}

function bandShares(spec, N = 8192) {
  const edges = [20, 80, 160, 315, 630, 1250, 2500, 5000, 10000, 20000];
  const out = new Array(edges.length - 1).fill(0);
  let tot = 0, cen = 0;
  for (let k = 1; k < spec.length; k++) {
    const f = (k * SR) / N;
    tot += spec[k]; cen += f * spec[k];
    for (let j = 0; j < out.length; j++) if (f >= edges[j] && f < edges[j + 1]) { out[j] += spec[k]; break; }
  }
  return { edges, shares: out.map((v) => v / tot), centroid: cen / tot };
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

function spectrogram(file, x, bounds) {
  const N = 4096, hop = 480, H = 420, fmin = 20, fmax = 16000;
  const frames = Math.floor((x.length - N) / hop);
  const W = frames;
  const img = Buffer.alloc(W * H * 3);
  const col = new Float32Array(H);
  const mags = [];
  let peak = -999;
  for (let f = 0; f < frames; f++) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[f * hop + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    const m = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const fr = fmin * Math.pow(fmax / fmin, 1 - y / (H - 1));
      const fr2 = fmin * Math.pow(fmax / fmin, 1 - (y + 1) / (H - 1));
      const k0 = Math.max(1, Math.floor((fr2 * N) / SR)), k1 = Math.max(k0, Math.ceil((fr * N) / SR));
      let s = 0;
      for (let k = k0; k <= k1; k++) s = Math.max(s, re[k] * re[k] + im[k] * im[k]);
      m[y] = 10 * Math.log10(s + 1e-20);
      peak = Math.max(peak, m[y]);
    }
    mags.push(m);
  }
  const range = 75;
  for (let f = 0; f < frames; f++) {
    for (let y = 0; y < H; y++) {
      const v = Math.max(0, Math.min(1, (mags[f][y] - (peak - range)) / range));
      // inferno benzeri renk
      const r = Math.min(255, Math.floor(255 * Math.min(1, v * 1.6)));
      const g = Math.floor(255 * Math.max(0, Math.min(1, (v - 0.35) * 1.6)));
      const b = Math.floor(255 * Math.max(0, Math.min(1, v < 0.5 ? v * 1.2 : (v - 0.75) * 4)));
      const o = (y * W + f) * 3;
      img[o] = r; img[o + 1] = g; img[o + 2] = b;
    }
  }
  // frekans izgarasi (100 Hz, 1 kHz, 10 kHz) ve senaryo sinirlari
  for (const gf of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    const y = Math.round((1 - Math.log(gf / fmin) / Math.log(fmax / fmin)) * (H - 1));
    for (let f = 0; f < W; f += 3) { const o = (y * W + f) * 3; img[o] = img[o + 1] = img[o + 2] = gf % 1000 === 0 ? 200 : 110; }
  }
  for (const b of bounds) {
    const fx = Math.floor((b[1] * SR) / hop);
    if (fx <= 0 || fx >= W) continue;
    for (let y = 0; y < H; y += 2) { const o = (y * W + fx) * 3; img[o] = img[o + 1] = img[o + 2] = 255; }
  }
  png(file, W, H, img);
}

function wav(file, x) {
  const n = x.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

const names = which === 'all' ? Object.keys(PROFILES) : which.split(',');
for (const name of names) {
  const { ch, bounds, cpu } = render(name);
  let bad = 0, pk = 0;
  for (const c of ch) for (const v of c) { if (!Number.isFinite(v)) bad++; else pk = Math.max(pk, Math.abs(v)); }
  const ext = mix(ch, MIX.ext), int = mix(ch, MIX.int);
  console.log(`\n== ${name}  islemci %${cpu.toFixed(1)} (tek cekirdek)  tepe ${pk.toFixed(2)}  NaN ${bad}`);
  console.log('senaryo            egzoz  emme  mekan titr |  dis   ic   | disA  icA  | dis merkez  <160Hz 160-630 630-2.5k >2.5k');
  for (const [label, a, b] of bounds) {
    const i0 = Math.floor(a * SR) + 4800, i1 = Math.floor(b * SR);
    const sp = spectrum(ext, i0, i1);
    const bs = bandShares(sp);
    const sh = bs.shares;
    const spI = spectrum(int, i0, i1);
    const dA = db(rms(ext, i0, i1)) + aDelta(sp), iA = db(rms(int, i0, i1)) + aDelta(spI);
    const lo = sh[0] + sh[1], mid = sh[2] + sh[3], hm = sh[4] + sh[5], hi = sh[6] + sh[7] + sh[8];
    console.log(`${label.padEnd(18)} ${db(rms(ch[0], i0, i1)).toFixed(1).padStart(5)} ${db(rms(ch[1], i0, i1)).toFixed(1).padStart(5)} ${db(rms(ch[2], i0, i1)).toFixed(1).padStart(6)} ${db(rms(ch[3], i0, i1)).toFixed(1).padStart(5)} | ${db(rms(ext, i0, i1)).toFixed(1).padStart(5)} ${db(rms(int, i0, i1)).toFixed(1).padStart(5)} | ${dA.toFixed(1).padStart(5)} ${iA.toFixed(1).padStart(5)} | ${bs.centroid.toFixed(0).padStart(6)} Hz  ${(lo * 100).toFixed(0).padStart(4)}% ${(mid * 100).toFixed(0).padStart(5)}% ${(hm * 100).toFixed(0).padStart(6)}% ${(hi * 100).toFixed(0).padStart(5)}%`);
  }
  if (outDir) {
    wav(path.join(outDir, `${name}_dis.wav`), ext);
    wav(path.join(outDir, `${name}_ic.wav`), int);
    spectrogram(path.join(outDir, `${name}_dis.png`), ext, bounds);
  }
}
