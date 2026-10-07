import * as THREE from 'three';
import { makeHit } from '../world/Collision.js';

// Yol bulucu ("rehber"): oyuncunun cevresindeki yuklu dunyada 4 m'lik izgarada A*.
//  - arazi egimi > ~35 derece gecilmez, derin su gecilmez
//  - duz obje ustleri (kopru, meydan) yurunebilir; egik/yuksek objeler (duvar, cati) engel
//  - hedef arama kutusu disindaysa kutu kenarinda hedefe en yakin noktaya gidilir
// Arama kareler arasina bolunur (zaman butcesi), sonuc sadelestirilmis yol noktalaridir.

const CELL = 4;
const SLOPE_MAX = 0.72;           // dh / mesafe
const _o = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= n.f) break; a[i] = a[p]; i = p; }
    a[i] = n;
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < (m === i ? last.f : a[m].f)) m = l;
        if (r < a.length && a[r].f < (m === i ? last.f : a[m].f)) m = r;
        if (m === i) break;
        a[i] = a[m]; i = m;
      }
      a[i] = last;
    }
    return top;
  }
}

export class PathFinder {
  constructor(app) {
    this.app = app;
    this.cache = new Map();
    this.hit = makeHit();
    this.job = null;
    this.path = null;
  }

  _key(ix, iz) { return (ix + 60000) * 120000 + (iz + 60000); }

  /** Hucre: { h: zemin yuksekligi, ok: gecilebilir mi } (yuklu bolgede onbellekli). */
  _cell(ix, iz) {
    const k = this._key(ix, iz);
    let c = this.cache.get(k);
    if (c) return c;
    const w = this.app.world;
    const x = ix * CELL + CELL / 2, z = iz * CELL + CELL / 2;
    const th = w.heightAt(x, z);
    if (th === null) return { h: 0, ok: false };
    let h = th, ok = true;
    const col = this.app.collision;
    if (col.raycast(_o.set(x, th + 45, z), _down, 60, this.hit, { terrain: false })) {
      const oy = this.hit.point.y;
      if (oy > th + 0.4) {
        if (this.hit.normal.y > 0.85 && oy < th + 14) h = oy;          // kopru / meydan / basamak
        else ok = false;                                                 // duvar, cati, kaya
      }
    }
    const wl = w.waterAt(x, z);
    if (ok && wl !== null && wl > h + 0.9) ok = false;                   // derin su
    c = { h, ok };
    if (w.isLoadedAt(x, z)) this.cache.set(k, c);
    if (this.cache.size > 400000) this.cache.clear();
    return c;
  }

  /** Yeni arama baslat (onceki iptal). */
  start(from, to, { radius = 460 } = {}) {
    const fx = Math.floor(from.x / CELL), fz = Math.floor(from.z / CELL);
    let tx = to.x, tz = to.z;
    const d = Math.hypot(tx - from.x, tz - from.z);
    const lim = radius - CELL * 3;
    if (d > lim) { tx = from.x + ((to.x - from.x) * lim) / d; tz = from.z + ((to.z - from.z) * lim) / d; }
    const R = Math.ceil(radius / CELL);
    this.job = {
      fx, fz, gx: Math.floor(tx / CELL), gz: Math.floor(tz / CELL), R, final: { x: to.x, z: to.z },
      open: new Heap(), nodes: new Map(), best: null, iter: 0, done: false,
    };
    const j = this.job;
    const s = { ix: fx, iz: fz, g: 0, f: 0, parent: null, closed: false };
    s.f = this._h(s, j);
    j.nodes.set(this._key(fx, fz), s);
    j.open.push(s);
    j.best = s;
  }

  _h(n, j) { return Math.hypot(n.ix - j.gx, n.iz - j.gz) * CELL; }

  /** Zaman butcesi (ms) kadar ilerle; bitince this.path dolar. */
  step(budgetMs = 3) {
    const j = this.job;
    if (!j || j.done) return;
    const t0 = performance.now();
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (j.open.size) {
      if ((++j.iter & 63) === 0 && performance.now() - t0 > budgetMs) return;
      const n = j.open.pop();
      if (n.closed) continue;
      n.closed = true;
      const hn = this._h(n, j);
      if (hn < this._h(j.best, j)) j.best = n;
      if (n.ix === j.gx && n.iz === j.gz) { j.best = n; break; }
      if (j.iter > 90000) break;
      const cn = this._cell(n.ix, n.iz);
      for (const [dx, dz] of dirs) {
        const ix = n.ix + dx, iz = n.iz + dz;
        if (Math.abs(ix - j.fx) > j.R || Math.abs(iz - j.fz) > j.R) continue;
        const c = this._cell(ix, iz);
        if (!c.ok) continue;
        const dist = (dx && dz ? 1.4142 : 1) * CELL;
        const slope = Math.abs(c.h - cn.h) / dist;
        if (slope > SLOPE_MAX) continue;
        if (dx && dz && (!this._cell(n.ix + dx, n.iz).ok || !this._cell(n.ix, n.iz + dz).ok)) continue;  // kose kesme
        const k = this._key(ix, iz);
        let m = j.nodes.get(k);
        const g = n.g + dist * (1 + slope * 2.5);
        if (m && (m.closed || m.g <= g)) continue;
        if (!m) { m = { ix, iz, g, f: 0, parent: n, closed: false }; j.nodes.set(k, m); }
        m.g = g; m.parent = n;
        m.f = g + this._h(m, j) * 1.1;
        j.open.push(m);
      }
    }
    // sonuc: hedefe (ya da ulasilabilen en yakin hucreye) giden yol
    const cells = [];
    for (let n = j.best; n; n = n.parent) cells.push(n);
    cells.reverse();
    this.path = this._simplify(cells.map((n) => ({ x: n.ix * CELL + CELL / 2, z: n.iz * CELL + CELL / 2 })));
    j.done = true;
    this.reached = j.best.ix === j.gx && j.best.iz === j.gz;
  }

  /** Gorus hatti sadelestirme: araya engel/dik egim girmeyen noktalari atla. */
  _simplify(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let k = Math.min(pts.length - 1, i + 40);
      while (k > i + 1 && !this._clear(pts[i], pts[k])) k--;
      out.push(pts[k]);
      i = k;
    }
    return out;
  }

  _clear(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / (CELL * 0.5));
    let prev = this._cell(Math.floor(a.x / CELL), Math.floor(a.z / CELL));
    for (let s = 1; s <= n; s++) {
      const x = a.x + ((b.x - a.x) * s) / n, z = a.z + ((b.z - a.z) * s) / n;
      const c = this._cell(Math.floor(x / CELL), Math.floor(z / CELL));
      if (!c.ok || Math.abs(c.h - prev.h) / (CELL * 0.5) > SLOPE_MAX) return false;
      prev = c;
    }
    return true;
  }

  get busy() { return !!(this.job && !this.job.done); }
}
