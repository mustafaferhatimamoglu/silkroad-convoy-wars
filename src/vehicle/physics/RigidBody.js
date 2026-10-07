import { V3, Quat, rotate, rotateInv } from './math.js';

// Tek rijit govde (arac sasisi). Govde ekseni: +x sag, +y yukari, -z ileri.
// Konum = kutle merkezi. Atalet tensoru govde ekseninde kosegen kabul edilir.

const _a = new V3(), _b = new V3(), _r = new V3(), _c = new V3();

export class RigidBody {
  constructor(mass, inertia) {
    this.mass = mass;
    this.invMass = 1 / mass;
    this.inertia = new V3(inertia.x, inertia.y, inertia.z);
    this.invInertia = new V3(1 / inertia.x, 1 / inertia.y, 1 / inertia.z);
    this.pos = new V3();
    this.q = new Quat();
    this.vel = new V3();
    this.angVel = new V3();
    this.force = new V3();
    this.torque = new V3();
  }

  /** Dunya uzayinda I^-1 * v */
  applyInvInertia(v, out) {
    rotateInv(this.q, v, _a);
    _a.x *= this.invInertia.x; _a.y *= this.invInertia.y; _a.z *= this.invInertia.z;
    return rotate(this.q, _a, out);
  }

  /** Dunya uzayinda I * v */
  applyInertia(v, out) {
    rotateInv(this.q, v, _a);
    _a.x *= this.inertia.x; _a.y *= this.inertia.y; _a.z *= this.inertia.z;
    return rotate(this.q, _a, out);
  }

  /** Dunya noktasinin hizi. */
  velocityAt(p, out) {
    _r.subVectors(p, this.pos);
    out.crossVectors(this.angVel, _r);
    return out.add(this.vel);
  }

  /** Noktadaki dir yonu icin ters etkin kutle (1/m_eff). */
  invMassAt(p, dir) {
    _r.subVectors(p, this.pos);
    _b.crossVectors(_r, dir);
    this.applyInvInertia(_b, _c);
    _b.crossVectors(_c, _r);
    return this.invMass + dir.dot(_b);
  }

  applyImpulse(J, p) {
    this.vel.addScaled(J, this.invMass);
    _r.subVectors(p, this.pos);
    _b.crossVectors(_r, J);
    this.applyInvInertia(_b, _c);
    this.angVel.add(_c);
  }

  /** Kuvveti biriktir (integrateVelocities ile uygulanir). */
  addForce(F, p) {
    this.force.add(F);
    _r.subVectors(p, this.pos);
    _b.crossVectors(_r, F);
    this.torque.add(_b);
  }

  addForceAtCenter(F) { this.force.add(F); }

  integrateVelocities(dt) {
    this.vel.addScaled(this.force, this.invMass * dt);
    // jiroskopik terim: tau - w x (I w)
    this.applyInertia(this.angVel, _a);
    _b.crossVectors(this.angVel, _a);
    _c.copy(this.torque).sub(_b);
    this.applyInvInertia(_c, _a);
    this.angVel.addScaled(_a, dt);
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }

  integratePositions(dt) {
    this.pos.addScaled(this.vel, dt);
    this.q.integrate(this.angVel, dt);
  }

  /** Govde yerel noktasini dunyaya cevir. */
  localToWorld(local, out) { return rotate(this.q, local, out).add(this.pos); }
  /** Govde yerel yonunu dunyaya cevir. */
  localDir(local, out) { return rotate(this.q, local, out); }
  worldToLocalDir(v, out) { return rotateInv(this.q, v, out); }
}
