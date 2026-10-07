import * as THREE from 'three';

// Zeminde kalan lastik izleri: halka tamponlu dortgen seritler. Her teker kaydikca
// onceki temas noktasindan yenisine seffaf koyu bir serit ekler; eski izler yavasca solar.

export class SkidMarks {
  constructor(scene, { max = 3000, width = 0.17 } = {}) {
    this.max = max;
    this.width = width;
    this.head = 0;
    this.pos = new Float32Array(max * 4 * 3);
    this.col = new Float32Array(max * 4 * 4);
    this.birth = new Float32Array(max);
    this.time = 0;
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) {
      const v = i * 4;
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.last = new Map(); // teker -> {l: Vector3, r: Vector3}
    this._side = new THREE.Vector3();
    this._dirty = false;
  }

  /** Teker icin iz noktasi ekle. p: temas noktasi, n: zemin normali, dir: ileri yon, a: koyuluk (0..1), color: [r,g,b] */
  add(key, p, n, dir, a, color) {
    const side = this._side.crossVectors(dir, n).normalize().multiplyScalar(this.width / 2);
    const lx = p.x - side.x + n.x * 0.025, ly = p.y - side.y + n.y * 0.025, lz = p.z - side.z + n.z * 0.025;
    const rx = p.x + side.x + n.x * 0.025, ry = p.y + side.y + n.y * 0.025, rz = p.z + side.z + n.z * 0.025;
    const prev = this.last.get(key);
    if (prev && Math.hypot(prev.lx - lx, prev.lz - lz) < 2.5) {
      if (Math.hypot(prev.lx - lx, prev.lz - lz) < 0.12) return; // cok yakin: bekle
      const i = this.head;
      const v = i * 4;
      const P = this.pos;
      P.set([prev.lx, prev.ly, prev.lz, prev.rx, prev.ry, prev.rz, lx, ly, lz, rx, ry, rz], v * 3);
      for (let k = 0; k < 4; k++) {
        const aa = k < 2 ? prev.a : a;
        this.col.set([color[0], color[1], color[2], aa], (v + k) * 4);
      }
      this.birth[i] = this.time;
      this.head = (this.head + 1) % this.max;
      this._dirty = true;
    }
    this.last.set(key, { lx, ly, lz, rx, ry, rz, a });
  }

  /** Teker kaymayi biraktiginda izi kopar. */
  lift(key) { this.last.delete(key); }

  update(dt) {
    this.time += dt;
    if (this._dirty) {
      this.aPos.needsUpdate = true;
      this.aCol.needsUpdate = true;
      this._dirty = false;
    }
  }

  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
