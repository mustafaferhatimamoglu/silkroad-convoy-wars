import { V3 } from './math.js';

// Araclar arasi carpisma: iki aracin govde kureleri (params.colliders) cift cift sinanir.
// Her A kuresi icin en derin B kuresi bir temas olur; temas normali B'den A'ya.
//  - Konum duzeltme kutle oraninda paylasilir (kucuk tolerans, yarim duzeltme).
//  - Normal impuls (hafif sekme) + Coulomb surtunmesi (sac sace surtme).
//  - Tek tarafli mod (oneSided): B uzak bir oyuncunun vekilidir; yalniz A etkilenir. Diger
//    makine ayni temasi kendi tarafindan cozer, toplam etki yaklasik simetrik olur.
// Hasar/efekt icin carpisma olaylari her iki aracin sim.impacts listesine yazilir (yerel
// koordinatli nokta Vehicle.applyImpacts icin govde uzayina cevrilir).

const _n = new V3(), _c = new V3(), _va = new V3(), _vb = new V3(), _J = new V3(), _t = new V3(), _lp = new V3(), _rel = new V3();

function bound(sim) {
  if (sim._bound === undefined) {
    let r = 0;
    for (const c of sim.p.colliders) r = Math.max(r, Math.hypot(c.p[0], c.p[1], c.p[2]) + c.r);
    sim._bound = r;
  }
  return sim._bound;
}

function worldColliders(sim) {
  const cols = sim.p.colliders, b = sim.body;
  const out = sim._wc || (sim._wc = cols.map(() => new V3()));
  for (let i = 0; i < cols.length; i++) b.localToWorld(_lp.set(cols[i].p[0], cols[i].p[1], cols[i].p[2]), out[i]);
  return out;
}

/** Iki arac govdesinin kaba ortusmesi (sinirlayici kureler). */
export function carsNear(A, B, margin = 0) {
  const a = A.body.pos, b = B.body.pos, r = bound(A) + bound(B) + margin;
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz < r * r;
}

/**
 * A ile B arasindaki temaslari coz. Donus: temas sayisi.
 * opts: { oneSided, restitution, friction }
 */
export function collideCars(A, B, { oneSided = false, restitution = 0.12, friction = 0.32 } = {}) {
  if (!carsNear(A, B)) return 0;
  const a = A.body, b = B.body;
  const CA = worldColliders(A), CB = worldColliders(B);
  const colA = A.p.colliders, colB = B.p.colliders;
  const shareA = a.invMass / (a.invMass + b.invMass);
  let count = 0, maxImpact = 0, impPoint = null, impNormal = null;
  for (let i = 0; i < CA.length; i++) {
    const pa = CA[i], ra = colA[i].r;
    let best = 0, bj = -1;
    for (let j = 0; j < CB.length; j++) {
      const pb = CB[j], rr = ra + colB[j].r;
      const ex = pa.x - pb.x, ey = pa.y - pb.y, ez = pa.z - pb.z;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 >= rr * rr) continue;
      const depth = rr - Math.sqrt(d2);
      if (depth > best) { best = depth; bj = j; }
    }
    if (bj < 0) continue;
    const pb = CB[bj], rb = colB[bj].r;
    _n.subVectors(pa, pb);
    const d = _n.length();
    if (d < 1e-6) _n.set(0, 1, 0); else _n.scale(1 / d);
    // yatay agirlikli normal: araclar birbirinin ustune cikmasin (kure yuvarligi dik bilesen uretir)
    _n.y *= 0.35;
    _n.normalize();
    const depth = best;
    _c.copy(pb).addScaled(_n, rb - depth * 0.5);
    // konum duzeltme
    const corr = Math.max(depth - 0.005, 0) * 0.5;
    a.pos.addScaled(_n, corr * shareA);
    if (!oneSided) b.pos.addScaled(_n, -corr * (1 - shareA));
    // normal impuls
    a.velocityAt(_c, _va); b.velocityAt(_c, _vb);
    _rel.subVectors(_va, _vb);
    const vn = _rel.dot(_n);
    count++;
    if (vn >= 0) continue;
    const kA = a.invMassAt(_c, _n), kB = b.invMassAt(_c, _n);
    const e = -vn > 1.5 ? restitution : 0;
    const jn = (-(1 + e) * vn) / (kA + kB);
    _J.copy(_n).scale(jn);
    a.applyImpulse(_J, _c);
    if (!oneSided) { _J.scale(-1); b.applyImpulse(_J, _c); }
    // surtunme
    a.velocityAt(_c, _va); b.velocityAt(_c, _vb);
    _rel.subVectors(_va, _vb);
    _t.copy(_rel).addScaled(_n, -_rel.dot(_n));
    const vt = _t.length();
    if (vt > 1e-4) {
      _t.scale(1 / vt);
      const kt = a.invMassAt(_c, _t) + b.invMassAt(_c, _t);
      const jt = Math.min(vt / kt, friction * jn);
      _J.copy(_t).scale(-jt);
      a.applyImpulse(_J, _c);
      if (!oneSided) { _J.scale(-1); b.applyImpulse(_J, _c); }
    }
    if (-vn > maxImpact) { maxImpact = -vn; impPoint = _c.clone(); impNormal = _n.clone(); }
  }
  // tek olay (en sert temas): hasar ve efektler
  if (maxImpact > 2.2) {
    const dmg = Math.pow(maxImpact - 2.2, 1.35) * 1.0;
    A.health = Math.max(0, A.health - dmg * (1 - shareA) * 2);
    A.impacts.push({ speed: maxImpact, point: impPoint, normal: impNormal, object: true, car: B });
    if (!oneSided) {
      B.health = Math.max(0, B.health - dmg * shareA * 2);
      B.impacts.push({ speed: maxImpact, point: impPoint.clone(), normal: impNormal.clone().negate(), object: true, car: A });
    }
  }
  if (count) { A.lastCarContact = A.time; if (!oneSided) B.lastCarContact = B.time; }
  return count;
}
