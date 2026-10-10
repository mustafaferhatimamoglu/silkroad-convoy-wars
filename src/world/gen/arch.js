import * as THREE from 'three';

// Siluetten mimari: orijinal yapinin kaba siluetinden (world/massing) taban dikdortgeni, saçak ve
// mahya yuksekligi, cati bicimi, incelik gibi ozellikler cikarilir; yapi bizim ayrintili kultur
// modellerimizle (sutun, kiris, kapi, pencere, kavisli sacakli cati, kubbe, minare, mazgal...)
// orijinal olcu, yon ve renklerle kurulur. Cozulemeyen karmasik parcalar siluetle kalir.
// Koordinatlar siluetle ayni model-yerel eksende (yerlestirme degismez).

const TAU = Math.PI * 2;
const lin = (c) => Math.pow(c / 255, 2.2);

// ------------------------------------------------------------------ ozellikler

/** Siluet izgarasindan bicim ozellikleri ve renkler. */
export function massFeatures(M, palette) {
  const { nx, nz, res, x0, z0 } = M;
  const n = nx * nz;
  const top = new Float32Array(n), mask = new Uint8Array(n);
  let cnt = 0, ix0 = nx, ix1 = -1, iz0 = nz, iz1 = -1, arch = 0;
  for (let k = 0; k < n; k++) {
    if (M.top[k] === -32768) continue;
    top[k] = M.top[k] / 10;
    if (top[k] > 0.6) {
      mask[k] = 1; cnt++;
      const i = k % nx, j = (k / nx) | 0;
      ix0 = Math.min(ix0, i); ix1 = Math.max(ix1, i); iz0 = Math.min(iz0, j); iz1 = Math.max(iz1, j);
      if (M.low[k] !== 32767 && M.low[k] / 10 > 2.6 && M.low[k] / 10 < top[k] - 0.3) arch++;
    }
  }
  if (!cnt) return null;
  // kenar uzakligi
  const dist = new Float32Array(n).fill(1e9);
  const q = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!mask[k]) continue;
    let edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && !mask[jj * nx + ii]) edge = true; }
    if (edge) { dist[k] = 0; q.push(k); }
  }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % nx, j = (k / nx) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = jj * nx + ii;
      if (mask[kk] && dist[kk] > dist[k] + 1) { dist[kk] = dist[k] + 1; q.push(kk); }
    }
  }
  let maxD = 0;
  for (let k = 0; k < n; k++) if (mask[k] && dist[k] > maxD) maxD = dist[k];
  let sE = 0, nE = 0, sC = 0, nC = 0, H = 0, s = 0, s2 = 0;
  const tops = [];
  const roofCol = [0, 0, 0], wallCol = [0, 0, 0];
  let nr = 0, nw = 0;
  for (let k = 0; k < n; k++) {
    if (!mask[k]) continue;
    const t = top[k];
    H = Math.max(H, t); s += t; s2 += t * t; tops.push(t);
    if (dist[k] <= 0.5) {
      sE += t; nE++;
      const p = palette[M.sm[k]];
      if (p) { wallCol[0] += p[1]; wallCol[1] += p[2]; wallCol[2] += p[3]; nw++; }
    }
    if (dist[k] >= maxD * 0.5) { sC += t; nC++; }
    const p = palette[M.tm[k]];
    if (p && t > 1.5) { roofCol[0] += p[1]; roofCol[1] += p[2]; roofCol[2] += p[3]; nr++; }
  }
  tops.sort((a, b) => a - b);
  const mean = s / cnt;
  const bx0 = x0 + ix0 * res, bx1 = x0 + (ix1 + 1) * res, bz0 = z0 + iz0 * res, bz1 = z0 + (iz1 + 1) * res;
  const bw = bx1 - bx0, bd = bz1 - bz0;
  return {
    n: cnt, res, H, mean, std: Math.sqrt(Math.max(0, s2 / cnt - mean * mean)),
    edge: sE / Math.max(1, nE), center: sC / Math.max(1, nC), pitch: sC / Math.max(1, nC) - sE / Math.max(1, nE),
    median: tops[tops.length >> 1], p90: tops[Math.floor(tops.length * 0.9)], p30: tops[Math.floor(tops.length * 0.3)],
    thick: maxD * res * 2, fillBox: (cnt * res * res) / Math.max(1, bw * bd), arch: arch / cnt,
    box: { x0: bx0, x1: bx1, z0: bz0, z1: bz1, w: bw, d: bd, cx: (bx0 + bx1) / 2, cz: (bz0 + bz1) / 2 },
    roofCol: nr ? roofCol.map((v) => v / nr) : null, wallCol: nw ? wallCol.map((v) => v / nw) : null,
  };
}

/** Mimari tur: null = siluetle kalsin. */
export function archKind(f, name, culture) {
  if (!f) return null;
  if (/petra|canyon|cliff|rocky|_rock|crag|mountain|_mt_|stone_|godfld_ruin/.test(name)) return 'rock';
  const maxWD = Math.max(f.box.w, f.box.d), minWD = Math.min(f.box.w, f.box.d);
  if (/door|gate|_mun|enter|arch/.test(name)) return null;           // kapi/kemer: siluet (gecit acik kalsin)
  if (/stair|step/.test(name)) return 'steps';                      // merdiven: basamakli siluet
  if (/_dan\b|_dan_|dan\d|terrace|floor|_base|platform|ground|bridge|brg/.test(name)) return null;   // teras/kopru: siluet
  if (f.H > 8 && maxWD < f.H * 0.5 && minWD < 12) return 'spire';
  if (f.thick < 4.5 && maxWD > 8 && f.H > 2.2 && minWD < 6) return 'wall';
  if (f.H < 2.6) return null;                                        // teras/zemin: siluet
  if (f.fillBox < 0.72 || maxWD > 90) return null;                   // dikdortgen degil / cok buyuk
  if ((culture === 'persian' || culture === 'byzantine' || culture === 'desert') && f.pitch > 2 && f.std > 1.5 && f.center > f.edge + minWD * 0.25) return 'dome';
  // sirtli cati yalniz Cin ve Bizans'ta; Orta Asya/col/Misir evleri duz damli
  if (f.pitch > 0.9) return culture === 'china' || culture === 'byzantine' ? 'pitched' : f.std < 2.5 ? 'flat' : null;
  if (f.std < 1.2) return 'flat';
  return null;
}

// ------------------------------------------------------------------ geometri yardimcilari

function nrm(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

class Mesh {
  constructor() { this.pos = []; this.uv = []; this.col = []; }
  /** Dortgen: a,b,c,d (saat yonunun tersi, dis yuz), uv olcegi m. */
  quad(a, b, c, d, col, uvs) {
    const P = [a, b, c, a, c, d];
    const U = uvs ? [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]] : null;
    for (let i = 0; i < 6; i++) {
      this.pos.push(P[i][0], P[i][1], P[i][2]);
      this.col.push(col[0], col[1], col[2]);
      if (U) this.uv.push(U[i][0], U[i][1]); else this.uv.push(0, 0);
    }
  }
  /** Dortgen, normali dir yonune (dunya vektoru) bakacak sekilde cevrilir. */
  quadDir(a, b, c, d, dir, col, uvs) {
    const n = nrm(a, b, c);
    if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] >= 0) this.quad(a, b, c, d, col, uvs);
    else this.quad(b, a, d, c, col, uvs ? [uvs[1], uvs[0], uvs[3], uvs[2]] : null);
  }
  triDir(a, b, c, dir, col, uvs) {
    const n = nrm(a, b, c);
    if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] >= 0) this.tri(a, b, c, col, uvs);
    else this.tri(b, a, c, col, [uvs[1], uvs[0], uvs[2]]);
  }
  tri(a, b, c, col, uvs) {
    for (const [p, u] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]]]) { this.pos.push(p[0], p[1], p[2]); this.col.push(col[0], col[1], col[2]); this.uv.push(u[0], u[1]); }
  }
  /** Kutu (x0..x1, y0..y1, z0..z1), duvar uv'si dunya olcekli. */
  box(x0, x1, y0, y1, z0, z1, col, s = 2.5, faces = 'all') {
    const A = [x0, y0, z1], B = [x1, y0, z1], C = [x1, y1, z1], D = [x0, y1, z1];
    const E = [x1, y0, z0], F = [x0, y0, z0], G = [x0, y1, z0], Hh = [x1, y1, z0];
    const w = (x1 - x0) / s, d = (z1 - z0) / s, h0 = y0 / s, h1 = y1 / s, u0 = x0 / s, v0 = z0 / s;
    this.quad(A, B, C, D, col, [[u0, h0], [u0 + w, h0], [u0 + w, h1], [u0, h1]]);           // +z
    this.quad(E, F, G, Hh, col, [[u0, h0], [u0 + w, h0], [u0 + w, h1], [u0, h1]]);          // -z
    this.quad(B, E, Hh, C, col, [[v0, h0], [v0 + d, h0], [v0 + d, h1], [v0, h1]]);          // +x
    this.quad(F, A, D, G, col, [[v0, h0], [v0 + d, h0], [v0 + d, h1], [v0, h1]]);          // -x
    if (faces !== 'sides') {
      this.quad(D, C, Hh, G, col, [[u0, v0 + d], [u0 + w, v0 + d], [u0 + w, v0], [u0, v0]]); // ust
      if (y0 > 0.05) this.quad(F, E, B, A, col, [[u0, v0], [u0 + w, v0], [u0 + w, v0 + d], [u0, v0 + d]]);
    }
  }
  cylinder(cx, cz, r0, r1, y0, y1, seg, col, s = 2.5, cap = true) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * TAU, a1 = ((k + 1) / seg) * TAU;
      const p = (a, r, y) => [cx + Math.cos(a) * r, y, cz - Math.sin(a) * r];
      const u0 = (k / seg) * TAU * r0 / s, u1 = ((k + 1) / seg) * TAU * r0 / s;
      this.quad(p(a0, r0, y0), p(a1, r0, y0), p(a1, r1, y1), p(a0, r1, y1), col, [[u0, y0 / s], [u1, y0 / s], [u1, y1 / s], [u0, y1 / s]]);
      if (cap) this.tri([cx, y1, cz], p(a0, r1, y1), p(a1, r1, y1), col, [[0, 0], [Math.cos(a0) * r1 / s, Math.sin(a0) * r1 / s], [Math.cos(a1) * r1 / s, Math.sin(a1) * r1 / s]]);
    }
  }
  /** Kubbe (yarim kure benzeri, sivri ust istege bagli). */
  dome(cx, cz, r, y0, h, col, seg = 20, rings = 8, onion = 0) {
    const pt = (a, t) => {
      const ang = t * Math.PI / 2;
      let rr = r * Math.cos(ang) * (1 + onion * Math.sin(ang * 2) * 0.35);
      const y = y0 + h * Math.sin(ang) + (onion ? h * 0.25 * Math.pow(t, 6) : 0);
      if (t >= 1) rr = 0;
      return [cx + Math.cos(a) * rr, y, cz - Math.sin(a) * rr];
    };
    for (let i = 0; i < rings; i++) {
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * TAU, a1 = ((k + 1) / seg) * TAU, t0 = i / rings, t1 = (i + 1) / rings;
        this.quad(pt(a0, t0), pt(a1, t0), pt(a1, t1), pt(a0, t1), col, [[k / seg * 6, t0 * 3], [(k + 1) / seg * 6, t0 * 3], [(k + 1) / seg * 6, t1 * 3], [k / seg * 6, t1 * 3]]);
      }
    }
  }
  geometry() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const idx = new Uint32Array(this.pos.length / 3);
    for (let i = 0; i < idx.length; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }
}

/** Malzeme kovalari: doku anahtari -> Mesh. */
class Parts {
  constructor(avg) { this.m = new Map(); this.avg = avg; }
  get(tex) { let m = this.m.get(tex); if (!m) this.m.set(tex, (m = new Mesh())); return m; }
  /** Hedef renk (sRGB 0-255) -> doku ortalamasina gore kose tonu. */
  tint(tex, rgb, k = 1) {
    if (!rgb) return [1, 1, 1];
    const a = this.avg[tex] || [180, 180, 180];
    return [0, 1, 2].map((c) => {
      const t = lin(rgb[c]) / Math.max(0.02, lin(a[c]));
      return Math.min(2.6, Math.max(0.2, 1 + (t - 1) * k));
    });
  }
  list(collide = true) {
    const out = [];
    for (const [tex, m] of this.m) {
      const g = m.geometry();
      const win = tex.startsWith('build/win_');                 // pencere kartlari: alfa testli, carpismasiz
      if (g) out.push({ geo: g, tex, alpha: win, collide: collide && !win });
    }
    return out;
  }
}

// ------------------------------------------------------------------ catilar

/**
 * Cin catisi (kalkik sacakli kirma/beşik): taban dikdortgeni [x0..x1]x[z0..z1] (sacak dahil),
 * sacak yuksekligi ye, mahya yuksekligi yr; uzun kenar boyunca mahya. Kiremit uv'si egim boyunca.
 */
function chineseRoof(m, b, ye, yr, col, curl = 0.9, hip = true, under = null) {
  const alongX = b.w >= b.d;
  const L = alongX ? b.w : b.d, S = alongX ? b.d : b.w;
  const ridgeHalf = hip ? Math.max(0.3, L / 2 - S / 2 * 0.8) : L / 2;
  const seg = 6;
  // yerel (u: mahya boyunca, v: mahyaya dik) -> model
  const P = (u, v, y) => (alongX ? [b.cx + u, y, b.cz + v] : [b.cx + v, y, b.cz + u]);
  // egim profili: icten disa kavisli (Cin cati egrisi), uclarda kalkik
  const prof = (t) => { const tt = t * t; return yr - (yr - ye) * (0.55 * t + 0.45 * tt) + curl * Math.pow(t, 6); };
  const half = S / 2;
  // iki uzun yuz
  for (const side of [1, -1]) {
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg, t1 = (i + 1) / seg;
      const v0 = side * half * t0, v1 = side * half * t1;
      // mahya ucundan sacak koselerine: kirmada kenar boyunca daralan
      const l0 = hip ? ridgeHalf + (L / 2 - ridgeHalf) * t0 : L / 2, l1 = hip ? ridgeHalf + (L / 2 - ridgeHalf) * t1 : L / 2;
      const c0 = curl * Math.pow(t0, 6) * 0.6, c1 = curl * Math.pow(t1, 6) * 0.6;   // kose kalkisi ekstra
      const a = P(-l0, v0, prof(t0) + c0 * 0), b2 = P(l0, v0, prof(t0)), c = P(l1, v1, prof(t1) + c1), d = P(-l1, v1, prof(t1) + c1);
      const sl = (half * (t1 - t0)) / 0.45;                         // kiremit sirasi ~45 cm
      const uv = [[-l0 / 2, (i) * sl], [l0 / 2, (i) * sl], [l1 / 2, (i + 1) * sl], [-l1 / 2, (i + 1) * sl]];
      m.quadDir(a, b2, c, d, [0, 1, 0], col, uv);
      if (under) under.m.quadDir(a, b2, c, d, [0, -1, 0], under.col, uv);
    }
  }
  if (hip) {
    // iki kalkan (ucgen yuzler)
    for (const end of [1, -1]) {
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg, t1 = (i + 1) / seg;
        const u0 = end * (ridgeHalf + (L / 2 - ridgeHalf) * t0), u1 = end * (ridgeHalf + (L / 2 - ridgeHalf) * t1);
        const w0 = half * t0, w1 = half * t1;
        const y0 = prof(t0), y1 = prof(t1) + curl * Math.pow(t1, 6) * 0.6;
        const a = P(u0, -w0, y0), b2 = P(u0, w0, y0), c = P(u1, w1, y1), d = P(u1, -w1, y1);
        const sl = ((L / 2 - ridgeHalf) * (t1 - t0) + 0.01) / 0.45;
        const uv = [[-w0 / 2, i * sl], [w0 / 2, i * sl], [w1 / 2, (i + 1) * sl], [-w1 / 2, (i + 1) * sl]];
        m.quadDir(a, b2, c, d, [0, 1, 0], col, uv);
        if (under) under.m.quadDir(a, b2, c, d, [0, -1, 0], under.col, uv);
      }
    }
  }
  return { ridgeY: yr, ridgeHalf, alongX };
}

/** Besik cati (Bizans/Avrupa): kalkanli, dz sacak. */
function gableRoof(m, wallM, b, ye, yr, col, wcol, under = null) {
  const alongX = b.w >= b.d;
  const L = alongX ? b.w : b.d, S = alongX ? b.d : b.w, half = S / 2;
  const P = (u, v, y) => (alongX ? [b.cx + u, y, b.cz + v] : [b.cx + v, y, b.cz + u]);
  const sl = Math.hypot(half, yr - ye) / 0.4;
  for (const side of [1, -1]) {
    const a = P(-L / 2, 0, yr), bb = P(L / 2, 0, yr), c = P(L / 2, side * half, ye), d = P(-L / 2, side * half, ye);
    const uv = [[-L / 4, 0], [L / 4, 0], [L / 4, sl], [-L / 4, sl]];
    m.quadDir(a, bb, c, d, [0, 1, 0], col, uv);
    if (under) under.m.quadDir(a, bb, c, d, [0, -1, 0], under.col, uv);
  }
  // kalkan duvarlari
  for (const end of [1, -1]) {
    const u = end * (L / 2 - 0.25);
    const a = P(u, -half + 0.3, ye), bb = P(u, half - 0.3, ye), c = P(u, 0, yr - 0.3);
    const out = alongX ? [end, 0, 0] : [0, 0, end];
    wallM.triDir(a, bb, c, out, wcol, [[0, ye / 2.5], [S / 2.5, ye / 2.5], [S / 5, yr / 2.5]]);
  }
}

// ------------------------------------------------------------------ yapilar

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Kirma cati kesik piramidi (Cin egrisi): ic dikdortgen (yari boylar li x si, yIn) -> dis sacak
 * (lo x so, yOut). Profil mahyada dik, sacakta yatik; sacak cizgisi koselere dogru kalkar (curl).
 * Alt yuz (under) ve sacak kalinligi (fascia) istege bagli. Donus: mahya/kirma cizgisi noktalari.
 */
function hipFrustum(m, o, col, under = null, fascia = null) {
  const { cx, cz, alongX, li, si, lo, so, yIn, yOut, curl } = o;
  const P = (u, v, y) => (alongX ? [cx + u, y, cz + v] : [cx + v, y, cz + u]);
  const NT = 7, NU = 10;
  const f = (t) => 0.62 * (1 - (1 - t) * (1 - t)) + 0.38 * t;
  const Y = (t, a) => yIn - (yIn - yOut) * f(t) + curl * t * t * Math.pow(a, 4);
  const l = (t) => li + (lo - li) * t, sw = (t) => si + (so - si) * t;
  const slope = Math.hypot(yIn - yOut, Math.max(lo - li, so - si));
  const TS = 1.3;                                              // kiremit doku olcegi (m)
  const face = (fixedU, sgn) => {
    // fixedU: uzun yuz (v sabit, u boyunca) ya da uc yuz (u sabit, v boyunca)
    for (let i = 0; i < NT; i++) {
      const t0 = i / NT, t1 = (i + 1) / NT;
      for (let k = 0; k < NU; k++) {
        const a0 = -1 + (2 * k) / NU, a1 = -1 + (2 * (k + 1)) / NU;
        const pt = (t, a) => (fixedU ? P(a * l(t), sgn * sw(t), Y(t, Math.abs(a))) : P(sgn * l(t), a * sw(t), Y(t, Math.abs(a))));
        const A = pt(t0, a0), B = pt(t0, a1), Cq = pt(t1, a1), D = pt(t1, a0);
        const ext = (t, a) => (fixedU ? a * l(t) : a * sw(t)) / TS;
        const uv = [[ext(t0, a0), t0 * slope / TS], [ext(t0, a1), t0 * slope / TS], [ext(t1, a1), t1 * slope / TS], [ext(t1, a0), t1 * slope / TS]];
        const out = fixedU ? (alongX ? [0, 0.3, sgn] : [sgn, 0.3, 0]) : (alongX ? [sgn, 0.3, 0] : [0, 0.3, sgn]);
        m.quadDir(A, B, Cq, D, out, col, uv);
        if (under) under.m.quadDir(A, B, Cq, D, [-out[0], -1, -out[2]], under.col, uv);
      }
    }
    if (fascia) {
      for (let k = 0; k < NU; k++) {
        const a0 = -1 + (2 * k) / NU, a1 = -1 + (2 * (k + 1)) / NU;
        const pt = (a, dy) => { const q = fixedU ? P(a * l(1), sgn * sw(1), Y(1, Math.abs(a))) : P(sgn * l(1), a * sw(1), Y(1, Math.abs(a))); q[1] -= dy; return q; };
        const out = fixedU ? (alongX ? [0, 0, sgn] : [sgn, 0, 0]) : (alongX ? [sgn, 0, 0] : [0, 0, sgn]);
        fascia.m.quadDir(pt(a0, fascia.h), pt(a1, fascia.h), pt(a1, 0), pt(a0, 0), out, fascia.col, [[a0, 1], [a1, 1], [a1, 0], [a0, 0]]);
      }
    }
  };
  face(true, 1); face(true, -1);
  face(false, 1); face(false, -1);
  // kirma cizgileri (mahya ucundan sacak kosesine) ve mahya
  const hips = [];
  for (const su of [1, -1]) for (const sv of [1, -1]) {
    const line = [];
    for (let i = 0; i <= NT; i++) { const t = i / NT; line.push(P(su * l(t), sv * sw(t), Y(t, 1))); }
    hips.push(line);
  }
  return { hips, ridge: [P(-li, 0, yIn), P(li, 0, yIn)] };
}

/** Kirma/mahya cizgisi boyunca ince sirt (ucgen prizma). */
function ridgeStrip(m, pts, w, h, col) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
    const nx = (-dz / L) * w, nz = (dx / L) * w;
    const ta = [a[0], a[1] + h, a[2]], tb = [b[0], b[1] + h, b[2]];
    const la = [a[0] + nx, a[1], a[2] + nz], lb = [b[0] + nx, b[1], b[2] + nz];
    const ra = [a[0] - nx, a[1], a[2] - nz], rb = [b[0] - nx, b[1], b[2] - nz];
    const uv = [[0, 0], [L, 0], [L, 0.3], [0, 0.3]];
    m.quadDir(la, lb, tb, ta, [nx, 0.5, nz], col, uv);
    m.quadDir(ra, rb, tb, ta, [-nx, 0.5, -nz], col, uv);
  }
}

/** Dikdortgen cevresinde dort dikey yuz; u = cevre boyunca / us, v: ust 0 -> alt 1 (doku ust satiri ustte). */
function ring(m, r, y0, y1, col, us, faces = [1, 1, 1, 1]) {
  const sides = [
    [[r.x0, r.z1], [r.x1, r.z1], [0, 0, 1]],
    [[r.x1, r.z0], [r.x0, r.z0], [0, 0, -1]],
    [[r.x1, r.z1], [r.x1, r.z0], [1, 0, 0]],
    [[r.x0, r.z0], [r.x0, r.z1], [-1, 0, 0]],
  ];
  sides.forEach(([p, q, n], i) => {
    if (!faces[i]) return;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const ue = us > 0 ? L / us : -us;
    m.quadDir([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], n, col, [[0, 1], [ue, 1], [ue, 0], [0, 0]]);
  });
}

/** Cin salonu: kaide, lake sutunlar, kafes kapili duvarlar, boyali konsol bandi, kalkik sacakli
 *  kirma cati (buyuklerde cift sacak), mahya ve kose susleri. */
function chinaHall(parts, f, C) {
  const b = f.box, H = Math.max(4, f.H);
  const alongX = b.w >= b.d;
  const L = Math.max(b.w, b.d), S = Math.min(b.w, b.d);
  const ov = clamp(S * 0.1, 0.6, 2.4);
  const bodyL = L - 2 * ov, bodyS = S - 2 * ov;
  const rect = (hl, hs) => (alongX ? { x0: b.cx - hl, x1: b.cx + hl, z0: b.cz - hs, z1: b.cz + hs } : { x0: b.cx - hs, x1: b.cx + hs, z0: b.cz - hl, z1: b.cz + hl });
  // renkler: cati orijinal ortalamasindan (parlatilmis), govde Cin paleti
  const rr = f.roofCol ? f.roofCol.map((v) => Math.min(255, v * 1.22)) : [92, 94, 96];
  const palace = rr[0] > rr[2] * 1.35 && rr[0] > 90;            // sirli altin/kahve kiremit
  const roofTex = C.roof;
  const rc = parts.tint(roofTex, palace ? [rr[0] * 1.18, rr[1] * 1.02, rr[2] * 0.62] : rr, 0.95);
  const R = parts.get(roofTex);
  const ridgeC = parts.tint(roofTex, palace ? [rr[0] * 0.8, rr[1] * 0.7, rr[2] * 0.6] : [rr[0] * 0.7, rr[1] * 0.7, rr[2] * 0.72], 0.95);
  const U = { m: parts.get('build/wood_planks'), col: parts.tint('build/wood_planks', palace ? [70, 92, 96] : [92, 60, 44], 0.9) };
  const FA = { m: parts.get('build/wood_lacquer'), col: parts.tint('build/wood_lacquer', palace ? [120, 40, 30] : [70, 52, 40], 0.9), h: clamp(S * 0.018, 0.18, 0.4) };
  const lacq = parts.get('build/wood_lacquer'), lacqC = parts.tint('build/wood_lacquer', palace ? [150, 40, 30] : [120, 50, 36], 0.9);
  const sideWall = palace ? parts.get('build/plaster_ochre') : parts.get('build/plaster_white');
  const sideC = palace ? parts.tint('build/plaster_ochre', [168, 60, 44], 0.9) : parts.tint('build/plaster_white', [214, 208, 196], 0.7);
  const lat = parts.get('build/lattice'), latC = palace ? [1, 1, 1] : parts.tint('build/lattice', [120, 72, 50], 0.8);
  const band = parts.get('build/dougong');
  const curl = clamp(S * 0.045, 0.25, 1.3);
  const dbl = H >= 13 && bodyS >= 11;
  const baseH = clamp(H * 0.045, 0.4, 1.1);
  // kaide
  const pr = rect(bodyL / 2 + ov * 0.55, bodyS / 2 + ov * 0.55);
  parts.get('build/stone_wall').box(pr.x0, pr.x1, -1.5, baseH, pr.z0, pr.z1, parts.tint('build/stone_wall', palace ? [196, 190, 176] : [150, 146, 138], 0.8), 2.5);
  // bir kat govdesi: sutun hatti (hl, hs), sutun ustu yC, sacak alti yE
  const body = (hl, hs, y0, yC, yE, cols) => {
    const cr = rect(hl, hs);
    const wr = rect(hl - 0.45, hs - 0.45);
    const nL = Math.max(3, Math.round((2 * hl) / 4.2)), nS = Math.max(2, Math.round((2 * hs) / 4.2));
    // uzun yuzler kafes kapi (her aciklik bir doku), kisa yuzler dolu duvar
    const longFaces = alongX ? [1, 1, 0, 0] : [0, 0, 1, 1];
    const shortFaces = alongX ? [0, 0, 1, 1] : [1, 1, 0, 0];
    ring(lat, wr, y0, yC, latC, -nL, longFaces);
    ring(sideWall, wr, y0, yC, sideC, 2.5, shortFaces);
    // ic tavan (asagidan bakinca bosluk gorunmesin)
    const ceil = U.m;
    ceil.quadDir([wr.x0, yC, wr.z0], [wr.x1, yC, wr.z0], [wr.x1, yC, wr.z1], [wr.x0, yC, wr.z1], [0, -1, 0], U.col, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    if (cols) {
      const rad = clamp(S * 0.012, 0.16, 0.34);
      const put = (x, z) => lacq.cylinder(x, z, rad, rad * 0.92, y0, yC + 0.05, 10, lacqC, 1.2, false);
      for (let i = 0; i <= nL; i++) {
        const u = -hl + (2 * hl * i) / nL;
        for (const v of [-hs, hs]) put(alongX ? b.cx + u : b.cx + v, alongX ? b.cz + v : b.cz + u);
      }
      for (let i = 1; i < nS; i++) {
        const v = -hs + (2 * hs * i) / nS;
        for (const u of [-hl, hl]) put(alongX ? b.cx + u : b.cx + v, alongX ? b.cz + v : b.cz + u);
      }
    }
    // konsol bandi: sutun ustunden sacak altina, hafif disa tasan
    const br = rect(hl + 0.25, hs + 0.25);
    ring(band, br, yC, yE, [1, 1, 1], 2.6);
    U.m.quadDir([br.x0, yC, br.z0], [br.x1, yC, br.z0], [br.x1, yC, br.z1], [br.x0, yC, br.z1], [0, -1, 0], U.col, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  };
  const ornament = (ridge, yTop) => {
    // mahya + uclarda kalkik susler
    ridgeStrip(R, ridge, 0.35, 0.55, ridgeC);
    for (const p of ridge) {
      const h = clamp(S * 0.05, 0.6, 1.8);
      R.box(p[0] - 0.25, p[0] + 0.25, yTop, yTop + h, p[2] - 0.25, p[2] + 0.25, ridgeC, 1);
    }
  };
  if (dbl) {
    const inset = bodyS * 0.16;
    const uL = bodyL / 2 - inset, uS = bodyS / 2 - inset, ov2 = ov * 0.85;
    const rise2 = Math.min(H * 0.42, 0.42 * (2 * uS + 2 * ov2));
    const yE2 = H - rise2;
    const band2 = clamp(uS * 0.1, 0.5, 1.3), band1 = clamp(bodyS * 0.05, 0.55, 1.4);
    const skirt = (inset + ov) * 0.5;
    const yE1 = Math.max(3.2, Math.min(H * 0.36, yE2 - band2 - 1.0 - skirt));
    const yS = yE1 + skirt;
    body(bodyL / 2, bodyS / 2, baseH, yE1 - band1, yE1 - 0.05, true);
    hipFrustum(R, { cx: b.cx, cz: b.cz, alongX, li: uL + 0.05, si: uS + 0.05, lo: L / 2, so: S / 2, yIn: yS, yOut: yE1, curl: curl * 0.8 }, rc, U, FA);
    body(uL, uS, yS - 0.8, yE2 - band2, yE2 - 0.05, false);
    const top = hipFrustum(R, { cx: b.cx, cz: b.cz, alongX, li: Math.max(0.3, uL + ov2 - (uS + ov2) * 0.85), si: 0.12, lo: uL + ov2, so: uS + ov2, yIn: H - 0.3, yOut: yE2, curl }, rc, U, FA);
    for (const h of top.hips) ridgeStrip(R, h, 0.2, 0.28, ridgeC);
    ornament(top.ridge, H - 0.3);
  } else {
    const rise = Math.min(H - 3, 0.44 * S);
    const yE = Math.max(2.6, H - rise);
    const band1 = clamp(bodyS * 0.06, 0.4, 1.2);
    body(bodyL / 2, bodyS / 2, baseH, yE - band1, yE - 0.05, bodyS > 5);
    const top = hipFrustum(R, { cx: b.cx, cz: b.cz, alongX, li: Math.max(0.3, L / 2 - (S / 2) * 0.85), si: 0.1, lo: L / 2, so: S / 2, yIn: H - 0.25, yOut: yE, curl }, rc, U, FA);
    for (const h of top.hips) ridgeStrip(R, h, 0.16, 0.22, ridgeC);
    ornament(top.ridge, H - 0.25);
  }
  return parts.list();
}

const CUL = {
  china: { wall: 'build/plaster_white', base: 'build/stone_wall', roof: 'build/roof_grey', wood: 'build/wood_lacquer', trim: 'build/wood_planks' },
  desert: { wall: 'build/plaster_adobe', base: 'build/sandstone_blocks', roof: 'build/plaster_adobe', wood: 'build/wood_planks', trim: 'build/wood_planks' },
  persian: { wall: 'build/plaster_ochre', base: 'build/sandstone_blocks', roof: 'build/mosaic_turquoise', wood: 'build/wood_planks', trim: 'build/mosaic_blue' },
  byzantine: { wall: 'build/plaster_white', base: 'build/stone_wall', roof: 'build/roof_red', wood: 'build/wood_planks', trim: 'build/marble' },
  egypt: { wall: 'build/sandstone_blocks', base: 'build/sandstone_blocks', roof: 'build/sandstone_blocks', wood: 'build/wood_planks', trim: 'build/plaster_ochre' },
};

/** Duvar yuzunde kapi/pencere: girinti (koyu) + cerceve. along: duvar ekseni. */
function openings(parts, C, b, y0, yTop, culture, wcol) {
  const dark = parts.get('build/wood_planks');
  const frame = parts.get(C.trim);
  const shade = [0.28, 0.24, 0.2];
  const fc = parts.tint(C.trim, null);
  const floors = Math.max(1, Math.floor((yTop - y0) / 3.4));
  const sides = [
    { n: [0, 1], len: b.w, at: (u) => [b.x0 + u, b.z1 + 0.06] },
    { n: [0, -1], len: b.w, at: (u) => [b.x1 - u, b.z0 - 0.06] },
    { n: [1, 0], len: b.d, at: (u) => [b.x1 + 0.06, b.z1 - u] },
    { n: [-1, 0], len: b.d, at: (u) => [b.x0 - 0.06, b.z0 + u] },
  ];
  for (const [si, s] of sides.entries()) {
    const cnt = Math.floor(s.len / 3.2);
    for (let f = 0; f < floors; f++) {
      for (let k = 0; k < cnt; k++) {
        const u = (k + 0.5) * (s.len / cnt);
        const door = f === 0 && si === 0 && k === Math.floor(cnt / 2);
        const ww = door ? 1.5 : 0.9, hh = door ? 2.4 : 1.2;
        const yb = y0 + f * 3.4 + (door ? 0 : 1.1);
        const [px, pz] = s.at(u);
        const tx = s.n[1] !== 0 ? 1 : 0, tz = s.n[0] !== 0 ? 1 : 0;      // duvar boyunca
        const dir = [s.n[0], 0, s.n[1]];
        if (!door) {
          // pencere: kulture gore dokulu kart (kemerli / kafesli / camli)
          const wt = culture === 'china' ? 'build/win_china' : culture === 'byzantine' ? 'build/win_euro' : 'build/win_arch';
          const W2 = wt === 'build/win_china' ? 0.6 : 0.55, H2 = wt === 'build/win_china' ? 1.2 : 1.7;
          const yb2 = y0 + f * 3.4 + (wt === 'build/win_china' ? 1.2 : 0.9);
          const P0 = [px - tx * W2, yb2, pz - tz * W2], P1 = [px + tx * W2, yb2, pz + tz * W2];
          parts.get(wt).quadDir(P0, P1, [P1[0], yb2 + H2, P1[2]], [P0[0], yb2 + H2, P0[2]], dir, [1, 1, 1], [[0, 1], [1, 1], [1, 0], [0, 0]]);
          continue;
        }
        const a = [px - tx * ww / 2, yb, pz - tz * ww / 2], c = [px + tx * ww / 2, yb + hh, pz + tz * ww / 2];
        const A = [a[0], a[1], a[2]], B = [c[0], a[1], c[2]], Cc = [c[0], c[1], c[2]], D = [a[0], c[1], a[2]];
        // arka plan (koyu girinti)
        dark.quadDir(A, B, Cc, D, dir, shade, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        // ust kemer (fars/bizans) ya da lento
        if (culture === 'persian' || culture === 'byzantine' || culture === 'desert') {
          const r = ww / 2, cy = yb + hh;
          for (let i = 0; i < 6; i++) {
            const a0 = (i / 6) * Math.PI, a1 = ((i + 1) / 6) * Math.PI;
            const p0 = [px + tx * Math.cos(a0) * r, cy + Math.sin(a0) * r, pz + tz * Math.cos(a0) * r];
            const p1 = [px + tx * Math.cos(a1) * r, cy + Math.sin(a1) * r, pz + tz * Math.cos(a1) * r];
            const cc = [px, cy, pz];
            dark.triDir(cc, p0, p1, dir, shade, [[0, 0], [1, 0], [0, 1]]);
          }
        } else {
          const t = 0.16;
          frame.box(Math.min(A[0], Cc[0]) - t * tx - 0.04 * tz, Math.max(A[0], Cc[0]) + t * tx + 0.04 * tz, yb + hh, yb + hh + 0.22,
            Math.min(A[2], Cc[2]) - t * tz - 0.04 * tx, Math.max(A[2], Cc[2]) + t * tz + 0.04 * tx, fc, 1);
        }
      }
    }
  }
  void wcol;
}

/** Bina: govde + cati + kapi/pencere; kultur ve siluet ozelliklerine gore. */
export function buildingModel(f, culture, kind, avg) {
  const C = CUL[culture] || CUL.desert;
  const parts = new Parts(avg);
  const b = f.box;
  const roofRGB = f.roofCol, wallRGB = f.wallCol;
  const wallTex = C.wall, roofTex = C.roof;
  const wc = parts.tint(wallTex, wallRGB, 0.85);
  const W = parts.get(wallTex);
  if (culture === 'china' && kind === 'pitched') return chinaHall(parts, f, C);
  if (kind === 'pitched') {
    // besik catili ev (Bizans/Avrupa; digerlerinde de ayni)
    const ye = Math.min(f.H - 1, Math.max(2.6, f.p30)), yr = Math.max(ye + 1, f.H);
    W.box(b.x0 + 0.3, b.x1 - 0.3, -1.5, ye, b.z0 + 0.3, b.z1 - 0.3, wc, 2.5, 'sides');
    parts.get(C.base).box(b.x0 + 0.2, b.x1 - 0.2, -1.5, 0.6, b.z0 + 0.2, b.z1 - 0.2, parts.tint(C.base, null), 2.5, 'sides');
    // korniş
    parts.get(C.trim).box(b.x0 + 0.15, b.x1 - 0.15, ye - 0.3, ye, b.z0 + 0.15, b.z1 - 0.15, parts.tint(C.trim, null), 1.5, 'sides');
    openings(parts, C, { x0: b.x0 + 0.3, x1: b.x1 - 0.3, z0: b.z0 + 0.3, z1: b.z1 - 0.3, w: b.w - 0.6, d: b.d - 0.6 }, 0.1, ye - 0.4, culture, wc);
    const rt = culture === 'byzantine' || culture === 'china' ? roofTex : 'build/roof_red';
    gableRoof(parts.get(rt), W, { ...b, x0: b.x0 - 0.2, x1: b.x1 + 0.2, z0: b.z0 - 0.2, z1: b.z1 + 0.2, w: b.w + 0.4, d: b.d + 0.4 }, ye, yr, parts.tint(rt, roofRGB, 0.85), wc,
      { m: parts.get('build/wood_planks'), col: parts.tint('build/wood_planks', [90, 70, 52], 0.9) });
    return parts.list();
  }
  if (kind === 'flat' || kind === 'dome') {
    const top = kind === 'dome' ? Math.max(2.6, f.edge) : Math.max(2.6, f.p90);
    W.box(b.x0, b.x1, -1.5, top, b.z0, b.z1, wc, 2.5);
    // korkuluk (parapet) + kornis
    const t = 0.35, ph = culture === 'china' ? 0 : 0.8;
    if (ph) {
      W.box(b.x0, b.x1, top, top + ph, b.z1 - t, b.z1, wc, 2.5, 'all');
      W.box(b.x0, b.x1, top, top + ph, b.z0, b.z0 + t, wc, 2.5, 'all');
      W.box(b.x1 - t, b.x1, top, top + ph, b.z0 + t, b.z1 - t, wc, 2.5, 'all');
      W.box(b.x0, b.x0 + t, top, top + ph, b.z0 + t, b.z1 - t, wc, 2.5, 'all');
    }
    parts.get(C.trim).box(b.x0 - 0.12, b.x1 + 0.12, top - 0.35, top - 0.05, b.z0 - 0.12, b.z1 + 0.12, parts.tint(C.trim, null, 0.5), 1.5, 'sides');
    openings(parts, C, b, 0.05, top - 0.3, culture, wc);
    if (culture === 'desert' || culture === 'egypt') {
      // cikintili ahsap kirisler (vigas)
      const wood = parts.get(C.wood), woc = parts.tint(C.wood, null);
      for (let x = b.x0 + 0.8; x < b.x1 - 0.4; x += 1.4) { wood.box(x - 0.1, x + 0.1, top - 0.7, top - 0.5, b.z1 - 0.2, b.z1 + 0.45, woc, 1); wood.box(x - 0.1, x + 0.1, top - 0.7, top - 0.5, b.z0 - 0.45, b.z0 + 0.2, woc, 1); }
    }
    if (kind === 'dome') {
      const r = Math.min(b.w, b.d) * 0.36;
      const drum = Math.min(2.5, r * 0.5);
      W.cylinder(b.cx, b.cz, r * 1.02, r * 1.02, top, top + drum, 20, wc, 2.5, false);
      const dt = culture === 'byzantine' ? 'build/copper_patina' : C.roof;
      const dh = Math.min(r * (culture === 'persian' ? 1.35 : 1.0), Math.max(r * 0.9, f.H - top - drum));
      parts.get(dt).dome(b.cx, b.cz, r * 1.04, top + drum, dh, parts.tint(dt, roofRGB, 0.9), 22, 9, culture === 'persian' ? 1 : 0);
    }
    return parts.list();
  }
  return null;
}

/** Minare / kule / direk: kultur. */
export function spireModel(f, culture, avg) {
  const parts = new Parts(avg);
  const C = CUL[culture] || CUL.desert;
  const b = f.box;
  const r = Math.max(0.6, Math.min(b.w, b.d) * 0.42);
  const H = f.H;
  const wc = parts.tint(C.wall, f.wallCol, 0.85), rc = parts.tint(C.roof, f.roofCol, 0.9);
  if (culture === 'china') {
    // cok katli pagoda/gozetleme kulesi
    const tiers = Math.max(2, Math.min(9, Math.round(H / 5)));
    let y = -1.5, rr = r;
    for (let t = 0; t < tiers; t++) {
      const h = (H - 2) / tiers;
      parts.get(C.wall).box(b.cx - rr * 0.8, b.cx + rr * 0.8, y, y + h * 0.75, b.cz - rr * 0.8, b.cz + rr * 0.8, wc, 2.5, 'sides');
      hipFrustum(parts.get(C.roof), { cx: b.cx, cz: b.cz, alongX: true, li: rr * 0.62, si: rr * 0.62, lo: rr * 1.3, so: rr * 1.3, yIn: y + h * 0.98, yOut: y + h * 0.7, curl: clamp(rr * 0.25, 0.2, 0.8) }, rc,
        { m: parts.get('build/wood_planks'), col: parts.tint('build/wood_planks', [96, 52, 38], 0.9) });
      y += h; rr *= 0.9;
    }
    parts.get(C.trim).cylinder(b.cx, b.cz, 0.12, 0.05, y, y + 2, 6, parts.tint(C.trim, [200, 170, 80]), 1);
    return parts.list();
  }
  if (culture === 'persian' || culture === 'desert' || culture === 'egypt') {
    // minare: govde, serefeler, sivri/sogan tepelik
    const W = parts.get(C.wall);
    W.cylinder(b.cx, b.cz, r, r * 0.82, -1.5, H * 0.82, 14, wc, 2.5, false);
    const tr = parts.get(C.trim), tc = parts.tint(C.trim, f.roofCol, 0.6);
    for (const k of [0.45, 0.78]) tr.cylinder(b.cx, b.cz, r * 1.35, r * 1.35, H * k, H * k + 0.5, 16, tc, 1.5, true);
    W.cylinder(b.cx, b.cz, r * 0.7, r * 0.7, H * 0.82, H * 0.9, 12, wc, 2.5, false);
    parts.get(C.roof).dome(b.cx, b.cz, r * 0.9, H * 0.9, H * 0.1, rc, 14, 6, 1);
    return parts.list();
  }
  // bizans: kare can kulesi, sivri cati
  const W = parts.get(C.wall);
  W.box(b.cx - r, b.cx + r, -1.5, H * 0.85, b.cz - r, b.cz + r, wc, 2.5, 'sides');
  parts.get(C.trim).box(b.cx - r - 0.15, b.cx + r + 0.15, H * 0.7, H * 0.72, b.cz - r - 0.15, b.cz + r + 0.15, parts.tint(C.trim, null), 1.5, 'sides');
  parts.get('build/roof_red').cylinder(b.cx, b.cz, r * 1.35, 0.05, H * 0.85, H, 4, parts.tint('build/roof_red', f.roofCol, 0.8), 1.2, false);
  return parts.list();
}

/** Sur/duvar: uzun eksen boyunca, ust kenarda mazgallar (Cin: kiremit sapka). */
export function wallModel(f, culture, avg) {
  const parts = new Parts(avg);
  const C = CUL[culture] || CUL.desert;
  const b = f.box;
  const alongX = b.w >= b.d;
  const L = alongX ? b.w : b.d, T = Math.max(0.6, Math.min(alongX ? b.d : b.w, f.thick || 3));
  const H = Math.max(2.2, f.median);
  const tex = culture === 'china' && H < 5 ? C.wall : C.base;
  const wc = parts.tint(tex, f.wallCol, 0.85);
  const W = parts.get(tex);
  const P = (u0, u1, y0, y1, v0, v1) => (alongX ? W.box(b.cx + u0, b.cx + u1, y0, y1, b.cz + v0, b.cz + v1, wc, 2.5) : W.box(b.cx + v0, b.cx + v1, y0, y1, b.cz + u0, b.cz + u1, wc, 2.5));
  P(-L / 2, L / 2, -1.5, H, -T / 2, T / 2);
  if (culture === 'china' && H < 5) {
    const R = parts.get(C.roof);
    chineseRoof(R, alongX ? { x0: b.cx - L / 2, x1: b.cx + L / 2, z0: b.cz - T / 2 - 0.4, z1: b.cz + T / 2 + 0.4, w: L, d: T + 0.8, cx: b.cx, cz: b.cz }
      : { x0: b.cx - T / 2 - 0.4, x1: b.cx + T / 2 + 0.4, z0: b.cz - L / 2, z1: b.cz + L / 2, w: T + 0.8, d: L, cx: b.cx, cz: b.cz }, H, H + 0.8, parts.tint(C.roof, f.roofCol, 0.9), 0.15, false);
  } else {
    const n = Math.max(2, Math.floor(L / 2.4));
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (k + 0.5) * (L / n);
      P(u - 0.55, u + 0.55, H, H + 1.0, T / 2 - 0.5, T / 2);
      P(u - 0.55, u + 0.55, H, H + 1.0, -T / 2, -T / 2 + 0.5);
    }
  }
  return parts.list();
}
