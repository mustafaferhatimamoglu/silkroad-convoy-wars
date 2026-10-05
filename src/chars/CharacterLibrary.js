import * as THREE from 'three';

// Silkroad karakter/NPC/binek/canavar kaynaklari (tools/assets/export_chars.py ciktisi).
// Bir "tur" (CharacterType) geometri, malzeme ve animasyon kliplerini tutar ve paylasir;
// her ornek (Character) kendi kemik hiyerarsisini, iskeletini ve karistiricisini kurar.

const sanitize = (n) => THREE.PropertyBinding.sanitizeNodeName(n);

export class CharacterLibrary {
  constructor(base = 'assets/chars/', { anisotropy = 4 } = {}) {
    this.base = base;
    this.types = new Map();
    this.textures = new Map();
    this.texLoader = new THREE.TextureLoader();
    this.anisotropy = anisotropy;
    this._index = null;
  }

  index() {
    if (!this._index) this._index = fetch(this.base + 'index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    return this._index;
  }

  has(key) { return this.index().then((ix) => !!ix[key]); }

  /** Turu yukler (onbellekli). */
  load(key) {
    let p = this.types.get(key);
    if (!p) {
      // dosyalar uzun sureli onbellekte: index'teki icerik surumu (v) URL'ye eklenir
      p = this.index().then((ix) => {
        const v = ix[key] && ix[key].v ? `?v=${ix[key].v}` : '';
        return Promise.all([
          fetch(`${this.base}${key}.json${v}`).then((r) => { if (!r.ok) throw new Error(`${key}.json ${r.status}`); return r.json(); }),
          fetch(`${this.base}${key}.bin${v}`).then((r) => { if (!r.ok) throw new Error(`${key}.bin ${r.status}`); return r.arrayBuffer(); }),
        ]);
      }).then(([meta, bin]) => new CharacterType(meta, bin, this));
      this.types.set(key, p);
    }
    return p;
  }

  async create(key) { return (await this.load(key)).instantiate(); }

  texture(file) {
    let t = this.textures.get(file);
    if (!t) {
      t = this.texLoader.load(this.base + file);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false;                   // Silkroad UV: v asagi
      t.anisotropy = this.anisotropy;
      this.textures.set(file, t);
    }
    return t;
  }
}

export class CharacterType {
  constructor(meta, bin, lib) {
    this.meta = meta;
    this.key = meta.key;
    this.height = meta.height || 1.8;
    this.geometries = meta.meshes.map((m) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, m.pos, m.v * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bin, m.nrm, m.v * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bin, m.uv, m.v * 2), 2));
      g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(bin, m.si, m.v * 4), 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(bin, m.sw, m.v * 4), 4));
      g.setIndex(new THREE.BufferAttribute(m.idx32 ? new Uint32Array(bin, m.idx, m.i) : new Uint16Array(bin, m.idx, m.i), 1));
      g.computeBoundingBox();
      g.computeBoundingSphere();
      return g;
    });
    this.materials = meta.materials.map((mt) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.82, metalness: 0.0,
        map: mt.tex ? lib.texture(mt.tex) : null,
        alphaTest: mt.alpha ? 0.45 : 0, side: mt.alpha || mt.twoSided ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (!mt.tex) mat.color.setRGB(mt.color[0], mt.color[1], mt.color[2]);
      mat.name = mt.n;
      return mat;
    });
    this.clips = {};
    for (const [k, a] of Object.entries(meta.anims)) {
      const times = new Float32Array(bin, a.times, a.n);
      const tracks = [];
      for (const tr of a.tracks) {
        const name = sanitize(meta.bones[tr.b].n);
        tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, new Float32Array(bin, tr.q, a.n * 4)));
        tracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, new Float32Array(bin, tr.t, a.n * 3)));
      }
      const dur = Math.max(times[times.length - 1] || 0, 1e-3);
      this.clips[k] = new THREE.AnimationClip(k, dur, tracks);
      this.clips[k].userData = { loop: a.loop, src: a.src };
    }
  }

  instantiate() { return new Character(this); }
}

export class Character {
  constructor(type) {
    this.type = type;
    this.root = new THREE.Group();
    this.root.name = type.key;
    const bones = type.meta.bones.map((b) => {
      const bone = new THREE.Bone();
      bone.name = sanitize(b.n);
      bone.position.fromArray(b.t);
      bone.quaternion.fromArray(b.q);
      return bone;
    });
    type.meta.bones.forEach((b, i) => (b.p >= 0 ? bones[b.p] : this.root).add(bones[i]));
    this.root.updateMatrixWorld(true);
    this.bones = bones;
    this.skeleton = new THREE.Skeleton(bones);
    this.meshes = type.geometries.map((g, i) => {
      const m = new THREE.SkinnedMesh(g, type.materials[type.meta.meshes[i].mat]);
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
      m.bind(this.skeleton, new THREE.Matrix4());
      return m;
    });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    this.current = null;
    this.currentKey = null;
  }

  has(key) { return !!this.type.clips[key]; }

  action(key) {
    let a = this.actions[key];
    if (!a && this.type.clips[key]) { a = this.mixer.clipAction(this.type.clips[key]); this.actions[key] = a; }
    return a;
  }

  /**
   * Animasyonu yumusak gecisle oynatir. once: bir kez oynat ve son karede kal
   * (olum) ya da bitince onceki dongusele don (saldiri, darbe).
   */
  play(key, { fade = 0.22, once = false, timeScale = 1, restart = false, then = null } = {}) {
    const a = this.action(key);
    if (!a) return false;
    if (this.currentKey === key && !restart) { a.timeScale = timeScale; return true; }
    a.reset();
    a.timeScale = timeScale;
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.enabled = true;
    a.setEffectiveWeight(1);
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
    this.currentKey = key;
    if (once && then) {
      const onDone = (e) => {
        if (e.action !== a) return;
        this.mixer.removeEventListener('finished', onDone);
        if (this.current === a) this.play(then, { fade });
      };
      this.mixer.addEventListener('finished', onDone);
    }
    return true;
  }

  update(dt) { this.mixer.update(dt); }

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}
