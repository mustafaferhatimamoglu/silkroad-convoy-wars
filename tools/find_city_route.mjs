import * as THREE from '../vendor/three/three.module.js';
import { MeshBVH } from '../vendor/three-mesh-bvh/src/index.js';
import { loadGenWorld } from './inspect_cities.mjs';
import { model } from '../src/world/gen/models.js';

export class CityPathfinder {
  constructor(g, regionKeys) {
    this.g = g;
    this.regionKeys = regionKeys;
    this.bvh = this._buildBVH();
    this.downRay = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    this.probeRay = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(1, 0, 0));
  }

  _buildBVH() {
    let cv = 0, ci = 0;
    const list = [];
    for (const rk of this.regionKeys) {
      const [rz, rx] = rk.split('_').map(Number);
      const rox = rx * 192, roz = -rz * 192;
      const objs = this.g.objects(rk);
      for (const o of objs) {
        const parts = o.parts || model(o.m);
        for (const p of parts) {
          if (p.collide) {
            list.push({ o, p, rox, roz });
            cv += p.geo.attributes.position.count;
            ci += p.geo.index.count;
          }
        }
      }
    }
    if (cv === 0) return null;

    const pos = new Float32Array(cv * 3);
    const idx = new Uint32Array(ci);
    let vOff = 0, iOff = 0;
    for (const { o, p, rox, roz } of list) {
      const geo = p.geo;
      const P = geo.attributes.position.array;
      const I = geo.index.array;
      const vc = geo.attributes.position.count;
      const ic = geo.index.count;
      const c = Math.cos(o.yaw), s = Math.sin(o.yaw), k = o.s || 1;

      for (let v = 0; v < vc; v++) {
        const x = P[v * 3] * k, y = P[v * 3 + 1] * k, z = P[v * 3 + 2] * k;
        const w = (vOff + v) * 3;
        pos[w] = (c * x + s * z + o.x) + rox;
        pos[w + 1] = y + o.y;
        pos[w + 2] = (-s * x + c * z + o.z) + roz;
      }
      for (let q = 0; q < ic; q++) idx[iOff + q] = I[q] + vOff;
      vOff += vc;
      iOff += ic;
    }

    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    cg.setIndex(new THREE.BufferAttribute(idx, 1));
    return new MeshBVH(cg);
  }

  getGround(x, z, prevY = null) {
    const terrainY = this.g.plan.templateH(x, -z);
    if (!this.bvh) return terrainY;

    const startProbeY = (prevY !== null ? Math.max(prevY, terrainY) : terrainY) + 2.5;
    this.downRay.origin.set(x, startProbeY, z);
    const hit = this.bvh.raycastFirst(this.downRay, THREE.DoubleSide, 0, 8.0);
    if (hit && hit.face.normal.y > 0.4) {
      return hit.point.y;
    }
    return terrainY;
  }

  isPassable(x, z, prevX = null, prevZ = null, prevY = null) {
    const y = this.getGround(x, z, prevY);
    if (prevY !== null) {
      const dh = Math.abs(y - prevY);
      const dl = Math.hypot(x - prevX, z - prevZ);
      if (dl > 0.01 && (dh / dl) > 0.50) return false; // max ~26.5 degrees slope
    }

    if (!this.bvh) return true;

    const ck = `${Math.round(x * 4)},${Math.round(z * 4)},${Math.round(y * 2)}`;
    if (!this._clearCache) this._clearCache = new Map();
    const cached = this._clearCache.get(ck);
    if (cached !== undefined) return cached;

    // Check vehicle bounding clearance in all 8 directions so any incoming/outgoing turn is 100% collision-free
    const DIRS = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, 0.7071], [-0.7071, -0.7071],
    ];
    for (const [dx, dz] of DIRS) {
      const rx = -dz, rz = dx;
      for (const hOff of [0.35, 0.55, 0.95]) {
        for (const lat of [-0.90, 0, 0.90]) {
          const px = x + rx * lat;
          const pz = z + rz * lat;
          const py = y + hOff;

          this.probeRay.origin.set(px - dx * 0.4, py, pz - dz * 0.4);
          this.probeRay.direction.set(dx, 0, dz);
          const hit = this.bvh.raycastFirst(this.probeRay, THREE.DoubleSide, 0, 1.35);
          if (hit && Math.abs(hit.face.normal.y) < 0.6) {
            this._clearCache.set(ck, false);
            return false;
          }
        }
      }
    }
    this._clearCache.set(ck, true);
    return true;
  }

  snapPassable(rxRz, stepM = 1.5, maxRadiusM = 24) {
    const rawX = rxRz[0] * 192, rawZ = -rxRz[1] * 192;
    const ix0 = Math.round(rawX / stepM), iz0 = Math.round(rawZ / stepM);
    const maxR = Math.ceil(maxRadiusM / stepM);
    for (let r = 0; r <= maxR; r++) {
      let best = null, bestD = Infinity;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const x = (ix0 + dx) * stepM, z = (iz0 + dz) * stepM;
          if (this.isPassable(x, z)) {
            const d = Math.hypot(x - rawX, z - rawZ);
            if (d < bestD) { bestD = d; best = [x / 192, -z / 192]; }
          }
        }
      }
      if (best) return best;
    }
    return [ix0 * stepM / 192, -(iz0 * stepM) / 192];
  }

  findPath(startRxRz, goalRxRz, stepM = 2.0) {
    const sSnap = this.snapPassable(startRxRz, stepM);
    const gSnap = this.snapPassable(goalRxRz, stepM);
    const sx = Math.round((sSnap[0] * 192) / stepM) * stepM;
    const sz = Math.round((-sSnap[1] * 192) / stepM) * stepM;
    const gx = Math.round((gSnap[0] * 192) / stepM) * stepM;
    const gz = Math.round((-gSnap[1] * 192) / stepM) * stepM;

    const startGround = this.getGround(sx, sz);
    const startKey = `${Math.round(sx / stepM)},${Math.round(sz / stepM)}`;

    // Min-heap for A*
    const pq = [];
    const dist = new Map();
    const parent = new Map();
    const posMap = new Map();

    const push = (k, priority) => {
      pq.push({ k, priority });
      pq.sort((a, b) => a.priority - b.priority);
    };

    dist.set(startKey, 0);
    posMap.set(startKey, { x: sx, z: sz, y: startGround });
    push(startKey, Math.hypot(gx - sx, gz - sz));

    let foundKey = null;
    let iterations = 0;

    while (pq.length > 0 && iterations < 80000) {
      iterations++;
      const current = pq.shift();
      const currKey = current.k;
      const currPos = posMap.get(currKey);

      const dGoal = Math.hypot(gx - currPos.x, gz - currPos.z);
      if (dGoal < stepM * 1.2) {
        foundKey = currKey;
        break;
      }

      const currDist = dist.get(currKey);
      if (current.priority > currDist + dGoal * 1.5) continue;

      const [ix, iz] = currKey.split(',').map(Number);
      for (const [dx, dz] of [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]]) {
        const nx = (ix + dx) * stepM;
        const nz = (iz + dz) * stepM;
        const nextKey = `${ix + dx},${iz + dz}`;

        if (!this.isPassable(nx, nz, currPos.x, currPos.z, currPos.y)) continue;

        const nextY = this.getGround(nx, nz, currPos.y);
        const stepCost = Math.hypot(nx - currPos.x, nz - currPos.z) * (1 + Math.abs(nextY - currPos.y) * 2.0);
        const newDist = currDist + stepCost;

        if (!dist.has(nextKey) || newDist < dist.get(nextKey)) {
          dist.set(nextKey, newDist);
          parent.set(nextKey, currKey);
          posMap.set(nextKey, { x: nx, z: nz, y: nextY });
          const h = Math.hypot(gx - nx, gz - nz);
          push(nextKey, newDist + h);
        }
      }
    }

    if (!foundKey) {
      console.warn(`Path not found between [${startRxRz}] and [${goalRxRz}]`);
      return null;
    }

    // Reconstruct
    const path = [];
    let k = foundKey;
    while (k) {
      const p = posMap.get(k);
      path.push([p.x / 192, -p.z / 192]);
      k = parent.get(k);
    }
    path.reverse();
    return path;
  }
}
