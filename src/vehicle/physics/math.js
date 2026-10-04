// Fizik icin hafif, bagimsiz vektor/kuaterniyon matematigi (Three.js gerektirmez,
// Node testlerinde de calisir). Tum islemler yerinde (allocation yok).

export class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  scale(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  addScaled(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  crossVectors(a, b) {
    const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
    this.x = x; this.y = y; this.z = z; return this;
  }
  length() { return Math.hypot(this.x, this.y, this.z); }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  normalize() { const l = this.length(); if (l > 1e-12) this.scale(1 / l); return this; }
  negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  /** v'yi n'ye dik duzleme izdusur */
  projectOnPlane(n) { const d = this.dot(n); this.x -= n.x * d; this.y -= n.y * d; this.z -= n.z * d; return this; }
}

export class Quat {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  setFromAxisAngle(ax, ay, az, a) {
    const s = Math.sin(a / 2);
    this.x = ax * s; this.y = ay * s; this.z = az * s; this.w = Math.cos(a / 2); return this;
  }
  multiply(b) { return this.multiplyQuaternions(this, b); }
  premultiply(a) { return this.multiplyQuaternions(a, this); }
  multiplyQuaternions(a, b) {
    const x = a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y;
    const y = a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z;
    const z = a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x;
    const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
    this.x = x; this.y = y; this.z = z; this.w = w; return this;
  }
  normalize() {
    const l = Math.hypot(this.x, this.y, this.z, this.w) || 1;
    this.x /= l; this.y /= l; this.z /= l; this.w /= l; return this;
  }
  /** Acisal hizla t sure entegre et (dunya uzayinda w). */
  integrate(w, dt) {
    const hx = w.x * dt * 0.5, hy = w.y * dt * 0.5, hz = w.z * dt * 0.5;
    const { x, y, z, w: qw } = this;
    this.x += hx * qw + hy * z - hz * y;
    this.y += hy * qw + hz * x - hx * z;
    this.z += hz * qw + hx * y - hy * x;
    this.w += -hx * x - hy * y - hz * z;
    return this.normalize();
  }
  slerp(qb, t) {
    if (t === 0) return this;
    if (t === 1) return this.copy(qb);
    const { x, y, z, w } = this;
    let cos = w * qb.w + x * qb.x + y * qb.y + z * qb.z;
    let bx = qb.x, by = qb.y, bz = qb.z, bw = qb.w;
    if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (cos > 0.9995) {
      this.x = x + (bx - x) * t; this.y = y + (by - y) * t; this.z = z + (bz - z) * t; this.w = w + (bw - w) * t;
      return this.normalize();
    }
    const th = Math.acos(cos), s = Math.sin(th);
    const a = Math.sin((1 - t) * th) / s, b = Math.sin(t * th) / s;
    this.x = x * a + bx * b; this.y = y * a + by * b; this.z = z * a + bz * b; this.w = w * a + bw * b;
    return this;
  }
}

/** Vektoru kuaterniyonla dondur: out = q * v * q^-1 */
export function rotate(q, v, out) {
  const vx = v.x, vy = v.y, vz = v.z;
  const tx = 2 * (q.y * vz - q.z * vy);
  const ty = 2 * (q.z * vx - q.x * vz);
  const tz = 2 * (q.x * vy - q.y * vx);
  out.x = vx + q.w * tx + q.y * tz - q.z * ty;
  out.y = vy + q.w * ty + q.z * tx - q.x * tz;
  out.z = vz + q.w * tz + q.x * ty - q.y * tx;
  return out;
}

/** Ters donus (dunya -> govde yerel). */
export function rotateInv(q, v, out) {
  const cq = _cq.set(-q.x, -q.y, -q.z, q.w);
  return rotate(cq, v, out);
}
const _cq = new Quat();

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
/** Karede bagimsiz ustel yaklasim: x'i hedefe rate (1/s) hiziyla yaklastir. */
export function damp(x, target, rate, dt) { return target + (x - target) * Math.exp(-rate * dt); }
