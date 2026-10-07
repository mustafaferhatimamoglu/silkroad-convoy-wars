import * as THREE from 'three';

// Etap parkuru (src/data/rally.js verisinden): Three.js yol noktalari, kumulatif mesafe, egrilik,
// kontrol kapilari, pilot notlari, yol koridoru genisligi (sol/sag serbest mesafe) ve botlarin
// hizli cizgisi (viraj ici ve kestirmeler). Arac takibi: en yakin yol noktasi, ilerleme, yanal
// sapma, kapi gecisi. Yaris modu, botlar ve ag senkronu ayni nesneyi kullanir.

export const GATE_W = 13;
export const PASS_R = 11;

/** Kesirli bolge koordinati -> Three.js konumu. */
export function regionToThree(world, rx, rz, out = new THREE.Vector3()) {
  const ix = Math.floor(rx), iz = Math.floor(rz);
  return world.toThree(ix, iz, (rx - ix) * 1920, 0, (rz - iz) * 1920, out);
}

/** Polyline yardimcilari: kumulatif mesafe ve egrilik (+ sol donus). */
function measure(pts) {
  const n = pts.length, cum = new Float64Array(n), kap = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 2)], b = pts[i], c = pts[Math.min(n - 1, i + 2)];
    // Three: +x dogu, -z kuzey. Kuzeyden bakisla sola donus = saat yonu tersi (x, -z duzleminde)
    const a1 = Math.atan2(-(b.z - a.z), b.x - a.x), a2 = Math.atan2(-(c.z - b.z), c.x - b.x);
    let da = a2 - a1; da = Math.atan2(Math.sin(da), Math.cos(da));
    kap[i] = da / Math.max(1, Math.hypot(c.x - a.x, c.z - a.z) / 2);
  }
  return { cum, kap };
}

/** Yol uzerinde takip edilen bir polyline (rota ya da hizli cizgi). */
export class Track {
  constructor(pts) {
    this.pts = pts;
    const { cum, kap } = measure(pts);
    this.cum = cum; this.kap = kap;
    this.length = cum[pts.length - 1];
    this.n = pts.length;
  }

  /** En yakin nokta (pencereli arama). Donus: indeks. */
  nearest(p, from = 0, back = 6, ahead = 40) {
    const pts = this.pts;
    let best = Infinity, bi = from;
    const i0 = Math.max(0, from - back), i1 = Math.min(this.n, from + ahead);
    for (let i = i0; i < i1; i++) {
      const d = (pts[i].x - p.x) ** 2 + (pts[i].z - p.z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  }

  /** Tum noktalar icinde en yakin (kaybolmus takip icin). */
  nearestGlobal(p, i0 = 0, i1 = this.n - 1) {
    let best = Infinity, bi = i0;
    for (let i = i0; i <= i1; i++) {
      const d = (this.pts[i].x - p.x) ** 2 + (this.pts[i].z - p.z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  }

  /** i civarinda p'nin yol boyunca konumu (mesafe) ve yanal sapmasi (+ sol). */
  project(p, i, out = {}) {
    const pts = this.pts, n = this.n;
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const q = pts[i];
    const dx = p.x - q.x, dz = p.z - q.z;
    out.s = this.cum[i] + dx * tx + dz * tz;
    // sol: ileri (tx, tz) icin sol vektor (tz, -tx)  [Three: +x dogu, -z kuzey, yukaridan bakis]
    out.lat = dx * tz - dz * tx;
    out.tx = tx; out.tz = tz;
    return out;
  }

  /** Yol boyunca s mesafesindeki nokta ve yon. */
  pointAt(s, out = new THREE.Vector3(), dir = null) {
    const cum = this.cum, n = this.n;
    if (s <= 0) { out.copy(this.pts[0]); if (dir) dir.set(this.pts[1].x - this.pts[0].x, 0, this.pts[1].z - this.pts[0].z).normalize(); return out; }
    if (s >= this.length) { out.copy(this.pts[n - 1]); if (dir) dir.set(this.pts[n - 1].x - this.pts[n - 2].x, 0, this.pts[n - 1].z - this.pts[n - 2].z).normalize(); return out; }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const t = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
    const a = this.pts[lo], b = this.pts[hi];
    out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    if (dir) dir.set(b.x - a.x, 0, b.z - a.z).normalize();
    return out;
  }

  /** s mesafesinden sonraki ilk indeks. */
  indexAt(s) {
    const cum = this.cum;
    let lo = 0, hi = this.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    return lo;
  }
}

export class Course {
  constructor(world, stage, id = 'hotan') {
    this.id = id;
    this.st = stage;
    this.world = world;
    this.route = new Track(stage.path.map(([rx, rz]) => regionToThree(world, rx, rz)));
    this.pts = this.route.pts;
    this.cum = this.route.cum;
    this.length = this.route.length;
    const n = this.pts.length;
    this.gates = stage.cps.map((c, k) => {
      const i = c.i, a = this.pts[Math.max(0, i - 2)], b = this.pts[Math.min(n - 1, i + 2)];
      const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
      return { name: c.name, i, n: k + 1, idx: k, pos: this.pts[i].clone(), dir };
    });
    this.notes = stage.notes || [];
    this.gateTol = 1;    // yarista toplu kalkista itis-kakis: kapi toleransi genisletilir (RaceMode)
    // koridor: yolun solunda/saginda engele/suya/dik yamaca kadar serbest mesafe (m)
    this.wl = stage.wl ? Float32Array.from(stage.wl) : new Float32Array(n).fill(6);
    this.wr = stage.wr ? Float32Array.from(stage.wr) : new Float32Array(n).fill(6);
    // hizli cizgi (botlar): viraj ici ve kestirmeler; her noktasinin rotadaki karsiligi
    this.line = stage.line ? new Track(stage.line.map(([rx, rz]) => regionToThree(world, rx, rz))) : null;
    if (this.line) {
      const map = new Int32Array(this.line.n);
      let j = 0;
      for (let k = 0; k < this.line.n; k++) { j = this.route.nearest(this.line.pts[k], j, 4, 60); map[k] = j; }
      this.lineToRoute = map;
      // kestirme bolumleri: hizli cizginin rotadan 5 m'den fazla ayrildigi rota araliklari
      const pr = {};
      this.shortcuts = [];
      let open = null;
      for (let k = 0; k < this.line.n; k++) {
        this.route.project(this.line.pts[k], map[k], pr);
        const away = Math.abs(pr.lat) > 5;
        if (away && !open) open = { a: map[k], b: map[k], dev: Math.abs(pr.lat) };
        else if (away && open) { open.b = map[k]; open.dev = Math.max(open.dev, Math.abs(pr.lat)); }
        else if (!away && open) { this.shortcuts.push(open); open = null; }
      }
      if (open) this.shortcuts.push(open);
    }
  }

  /** Baslangic izgarasi: start cizgisi yolun ~38 m'sinde; 2'li sira, 4 sira geriye. */
  grid(count = 8) {
    const r = this.route, slots = [];
    const startS = Math.min(38, r.length * 0.1);
    const p = new THREE.Vector3(), d = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      const row = k >> 1, col = k & 1;
      const s = startS - 5 - row * 8 - (col ? 3 : 0);
      r.pointAt(Math.max(0.5, s), p, d);
      const i = r.indexAt(Math.max(0.5, s));
      const side = col ? -1 : 1;   // + sol
      const room = side > 0 ? this.wl[i] : this.wr[i];
      const lat = side * Math.min(2.4, Math.max(0.6, room - 1.6));
      // sol vektor (dz, -dx)
      slots.push({ x: p.x + d.z * lat, z: p.z - d.x * lat, yaw: Math.atan2(-d.x, -d.z), s });
    }
    return { slots, startS };
  }

  /** Kapi gecisi: a->b hareketi kapi cizgisini (genislik icinde) keser ya da kapiya yakin gecer. */
  passed(gate, a, b) {
    const dx = b.x - gate.pos.x, dz = b.z - gate.pos.z, k = this.gateTol;
    if (Math.hypot(dx, dz) < PASS_R * k) return true;
    const sa = (a.x - gate.pos.x) * gate.dir.x + (a.z - gate.pos.z) * gate.dir.z;
    const sb = dx * gate.dir.x + dz * gate.dir.z;
    if (sa < 0 && sb >= 0) return Math.abs(dx * -gate.dir.z + dz * gate.dir.x) < GATE_W * 0.75 * k;
    return false;
  }

  /** Bir aracin parkur durumunu ilerlet: en yakin nokta, ilerleme, yanal sapma, kapilar. */
  track(state, pos, prev) {
    const r = this.route;
    state.idx = r.nearest(pos, state.idx || 0);
    // yanlis yere kilitlenme (rotaya donus, isinlanma): genis arama
    const q = r.pts[state.idx];
    if ((q.x - pos.x) ** 2 + (q.z - pos.z) ** 2 > 60 * 60) {
      const lo = state.gate > 0 ? this.gates[state.gate - 1].i : 0;
      const hi = state.gate < this.gates.length ? this.gates[state.gate].i : r.n - 1;
      state.idx = r.nearestGlobal(pos, lo, hi);
    }
    const pr = r.project(pos, state.idx, state._pr || (state._pr = {}));
    // ilerleme kapidan once gecilmemis bolume tasamaz (kestirmeyle kapi atlanamaz)
    const cap = state.gate < this.gates.length ? this.cum[this.gates[state.gate].i] + 2 : this.length;
    state.progress = Math.min(pr.s, cap);
    state.lat = pr.lat;
    let passedGate = null;
    if (prev && state.gate < this.gates.length && this.passed(this.gates[state.gate], prev, pos)) {
      passedGate = this.gates[state.gate];
      state.gate++;
    }
    return passedGate;
  }
}
