import * as THREE from 'three';

// Fizik icin dunya sorgulari: arazi yukseklik alani + bolge obje BVH'lari.
// Tum giris/cikislar Three.js dunya koordinatlarinda (metre).

const _ray = new THREE.Ray();
const _o = new THREE.Vector3();
const _c = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _n = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _regions = [];

export class Collision {
  constructor(world) {
    this.world = world;
  }

  /**
   * Isin sorgusu. dir normalize olmali. Ilk carpismayi out'a yazar:
   * { distance, point: Vector3, normal: Vector3, object: boolean, surface }
   */
  raycast(origin, dir, far, out, { objects = true, terrain = true } = {}) {
    let best = far;
    let hit = false;
    const w = this.world;
    if (terrain) {
      const t = this._terrainRay(origin, dir, far);
      if (t !== null && t < best) {
        best = t; hit = true;
        out.point.copy(origin).addScaledVector(dir, t);
        w.normalAt(out.point.x, out.point.z, out.normal);
        out.object = false;
      }
    }
    if (objects) {
      const ex = origin.x + dir.x * far, ez = origin.z + dir.z * far;
      const cx = (origin.x + ex) / 2, cz = (origin.z + ez) / 2;
      const rad = Math.hypot(ex - origin.x, ez - origin.z) / 2 + 1;
      w.bvhsNear(cx, cz, rad, _regions);
      for (const r of _regions) {
        _o.set(origin.x - r.origin.x, origin.y, origin.z - r.origin.z);
        _ray.origin.copy(_o); _ray.direction.copy(dir);
        const h = r.near.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, best);
        if (h && h.distance < best) {
          best = h.distance; hit = true;
          out.point.set(h.point.x + r.origin.x, h.point.y, h.point.z + r.origin.z);
          out.normal.copy(h.face.normal);
          if (out.normal.dot(dir) > 0) out.normal.negate();
          out.object = true;
        }
      }
    }
    if (hit) {
      out.distance = best;
      out.surface = out.object ? 100 : w.surfaceAt(out.point.x, out.point.z);
    }
    return hit;
  }

  _terrainRay(o, d, far) {
    const w = this.world;
    const f = (t) => {
      const h = w.heightAt(o.x + d.x * t, o.z + d.z * t);
      return h === null ? null : o.y + d.y * t - h;
    };
    let f0 = f(0);
    if (f0 === null) return null;
    if (f0 <= 0) return 0;
    const step = Math.min(0.5, Math.max(0.05, far / 12));
    let t0 = 0;
    for (let t = step; t <= far + 1e-6; t += step) {
      const ft = f(Math.min(t, far));
      if (ft === null) return null;
      if (ft <= 0) {
        let a = t0, b = Math.min(t, far);
        for (let k = 0; k < 10; k++) {
          const m = (a + b) / 2;
          const fm = f(m);
          if (fm === null || fm <= 0) b = m; else a = m;
        }
        return b;
      }
      t0 = t;
    }
    return null;
  }

  /**
   * Kure temaslari: arazi + objeler. contacts dizisine {point, normal, depth, object} yazar.
   * Ayni yone bakan temaslar birlestirilir (en derini kalir).
   */
  sphereContacts(center, radius, contacts, max = 6) {
    let count = 0;
    const w = this.world;
    // arazi
    const h = w.heightAt(center.x, center.z);
    if (h !== null) {
      w.normalAt(center.x, center.z, _n);
      const dist = (center.y - h) * _n.y;
      const depth = radius - dist;
      if (depth > 0) {
        const c = contacts[count++];
        c.normal.copy(_n);
        c.point.copy(center).addScaledVector(_n, -radius + depth);
        c.depth = depth; c.object = false;
      }
    }
    // objeler
    w.bvhsNear(center.x, center.z, radius + 0.5, _regions);
    for (const r of _regions) {
      _c.set(center.x - r.origin.x, center.y, center.z - r.origin.z);
      _sphere.set(_c, radius);
      const r2 = radius * radius;
      r.near.bvh.shapecast({
        intersectsBounds: (box) => box.intersectsSphere(_sphere),
        intersectsTriangle: (tri) => {
          tri.closestPointToPoint(_c, _tmp);
          const d2 = _tmp.distanceToSquared(_c);
          if (d2 >= r2) return false;
          const d = Math.sqrt(d2);
          if (d > 1e-5) _n.subVectors(_c, _tmp).multiplyScalar(1 / d);
          else { tri.getNormal(_n); }
          const depth = radius - d;
          // benzer normalli temas varsa en derini tut
          for (let k = 0; k < count; k++) {
            const c = contacts[k];
            if (c.object && c.normal.dot(_n) > 0.9) {
              if (depth > c.depth) {
                c.depth = depth; c.normal.copy(_n);
                c.point.set(_tmp.x + r.origin.x, _tmp.y, _tmp.z + r.origin.z);
              }
              return false;
            }
          }
          if (count < max) {
            const c = contacts[count++];
            c.normal.copy(_n); c.depth = depth; c.object = true;
            c.point.set(_tmp.x + r.origin.x, _tmp.y, _tmp.z + r.origin.z);
          }
          return false;
        },
      });
    }
    return count;
  }
}

export function makeContacts(n = 8) {
  return Array.from({ length: n }, () => ({ point: new THREE.Vector3(), normal: new THREE.Vector3(), depth: 0, object: false }));
}

export function makeHit() {
  return { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), object: false, surface: 0 };
}
