// Uzak arac: baska bir makinede simule edilen aracin durum ornekleri (20 Hz) 110 ms geriden ara
// degerlenerek gosterilir; ornek gecikirse hiziyla en fazla 250 ms ileri tahmin edilir. Fizik adimi
// yoktur: carpisma icin govde konumu/hizi ornekten alinir (yerel arac tek tarafli itilir), teker,
// motor devri ve kayma bilgisi gorsel/ses/efekt (toz, iz, motor sesi) icin aktarilir.

export const SNAP_MS = 50;
const DELAY = 110;
const RPM = 60 / (2 * Math.PI);

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 10000) / 10000;

/** Yerel aracin durum ornegi (kucuk diziler; ~350 bayt). */
export function encodeState(car, serverNow) {
  const v = car.vehicle, s = v.sim, b = s.body, st = car.state;
  const w = [];
  for (const wh of s.wheels) w.push(r3(wh.x), r2(wh.spin), wh.contact ? r2(wh.slide) : -1, wh.surface | 0);
  return {
    t: 'st', id: car.id, ts: Math.round(serverNow),
    p: [r3(b.pos.x), r3(b.pos.y), r3(b.pos.z)], q: [r4(b.q.x), r4(b.q.y), r4(b.q.z), r4(b.q.w)],
    v: [r2(b.vel.x), r2(b.vel.y), r2(b.vel.z)], a: [r2(b.angVel.x), r2(b.angVel.y), r2(b.angVel.z)],
    sa: r3(s.steer), w0: r3(s.wheels[0].steer), w1: r3(s.wheels[1].steer),
    rpm: Math.round(s.rpm), ld: r2(Math.max(0, s.engine.load)), g: s.gearLabel,
    br: s.input.brake > 0.05 && !s.holding ? 1 : 0, hl: v.headlights ? 1 : 0, hp: Math.round(s.health), w,
    s: [st.gate, Math.round(st.progress * 10) / 10, r2(st.lat || 0), st.idx | 0, st.finished ? 1 : 0, st.time === null || st.time === undefined ? -1 : r3(st.time), st.dnf ? 1 : 0],
  };
}

export class RemoteCar {
  constructor(vehicle) {
    this.vehicle = vehicle;
    this.buf = [];
    this.lastRecv = 0;
  }

  push(m) {
    const buf = this.buf;
    if (buf.length && m.ts <= buf[buf.length - 1].ts) { if (!buf.some((x) => x.ts === m.ts)) { buf.push(m); buf.sort((a, b) => a.ts - b.ts); } }
    else buf.push(m);
    if (buf.length > 14) buf.splice(0, buf.length - 14);
    const now = performance.now();
    if (this.lastRecv) this.maxGap = Math.max(this.maxGap || 0, now - this.lastRecv);
    this.lastRecv = now;
  }

  get fresh() { return this.buf.length > 0 && performance.now() - this.lastRecv < 3000; }

  /** Sunucu saatine gore ara degerlenmis durumu araca (govde, teker, motor, isik) ve yaris durumuna uygula. */
  apply(serverNow, car) {
    const buf = this.buf;
    if (!buf.length) return false;
    const t = serverNow - DELAY;
    let a = buf[0], b = buf[0];
    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i].ts <= t) { a = buf[i]; b = buf[i + 1] || buf[i]; break; }
    }
    const sim = this.vehicle.sim, body = sim.body;
    if (t >= b.ts) {
      // en yeni ornekten ileri tahmin (en fazla 250 ms)
      const dt = Math.min(0.25, (t - b.ts) / 1000);
      body.pos.set(b.p[0] + b.v[0] * dt, b.p[1] + b.v[1] * dt, b.p[2] + b.v[2] * dt);
      body.q.set(b.q[0], b.q[1], b.q[2], b.q[3]);
      if (dt > 0) body.q.integrate({ x: b.a[0], y: b.a[1], z: b.a[2] }, dt);
      body.vel.set(b.v[0], b.v[1], b.v[2]);
      body.angVel.set(b.a[0], b.a[1], b.a[2]);
    } else {
      const k = b.ts > a.ts ? Math.min(1, Math.max(0, (t - a.ts) / (b.ts - a.ts))) : 0;
      const L = (i, P, Q) => P[i] + (Q[i] - P[i]) * k;
      body.pos.set(L(0, a.p, b.p), L(1, a.p, b.p), L(2, a.p, b.p));
      body.q.set(a.q[0], a.q[1], a.q[2], a.q[3]);
      const qb = { x: b.q[0], y: b.q[1], z: b.q[2], w: b.q[3] };
      body.q.slerp(qb, k);
      body.vel.set(L(0, a.v, b.v), L(1, a.v, b.v), L(2, a.v, b.v));
      body.angVel.set(L(0, a.a, b.a), L(1, a.a, b.a), L(2, a.a, b.a));
    }
    sim.prevPos.copy(body.pos); sim.prevQ.copy(body.q);
    // teker, direksiyon, motor, isiklar (yeni ornekten)
    const W = sim.wheels;
    for (let i = 0; i < 4; i++) {
      const w = W[i], o = i * 4;
      w.x = b.w[o]; w.xPrev = w.x; w.spin = b.w[o + 1];
      w.contact = b.w[o + 2] >= 0; w.slide = Math.max(0, b.w[o + 2]); w.surface = b.w[o + 3];
      w.slipRatio = 0;
      // temas noktasi (efektler): teker merkezinin altinda
      sim.wheelLocal(w, w.point);
      body.localToWorld(w.point, w.point);
      w.point.y -= w.radius;
      w.normal.set(0, 1, 0);
    }
    W[0].steer = b.w0; W[1].steer = b.w1; sim.steer = b.sa;
    sim.engine.omega = b.rpm / RPM; sim.engine.load = b.ld;
    sim.input.brake = b.br; sim.holding = false;
    sim.gear = b.g === 'R' ? -1 : b.g === 'N' ? 0 : parseInt(b.g, 10) || 1; sim.shiftTimer = 0;
    sim.health = b.hp;
    this.vehicle.headlights = !!b.hl;
    this.vehicle._sync(1);
    // yaris durumu (sahibi hesaplar)
    const st = car.state, s = b.s;
    st.gate = s[0]; st.progress = s[1]; st.lat = s[2]; st.idx = s[3];
    st.finished = !!s[4]; st.time = s[5] >= 0 ? s[5] : null; st.dnf = !!s[6];
    return true;
  }
}
