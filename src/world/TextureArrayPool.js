import * as THREE from 'three';

// GPU doku dizisi havuzu. Ayni boyuttaki pek cok dokuyu (zemin karolari, bina dokulari)
// tek bir sampler2DArray icinde tutar; boylece bir bolgenin tum objeleri tek cizim
// cagrisinda cizilebilir. Katmanlar referans sayimi + LRU ile yeniden kullanilir.

const _dst = new THREE.Vector3();

export class TextureArrayPool {
  constructor(renderer, { size = 512, capacity = 128, anisotropy = 8, name = 'pool' } = {}) {
    this.renderer = renderer;
    this.size = size;
    this.capacity = capacity;
    this.name = name;

    this.rt = new THREE.WebGLArrayRenderTarget(size, size, capacity, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      colorSpace: THREE.SRGBColorSpace,
      anisotropy,
    });
    this.texture = this.rt.texture;
    renderer.initRenderTarget(this.rt);

    this.slots = Array.from({ length: capacity }, () => ({ key: null, refs: 0, used: 0, busy: false }));
    this.keySlot = new Map();   // key -> slot
    this.loading = new Map();   // key -> Promise<slot>
    this.queue = [];
    this.clock = 0;
    this.onSlotFilled = null;   // (slot, key, bitmapInfo) => void
  }

  /** Dokuyu bir katmana yerlestirir (gerekirse yukler) ve referansini arttirir. */
  acquire(key, url) {
    const hit = this.keySlot.get(key);
    if (hit !== undefined) {
      const s = this.slots[hit];
      s.refs++; s.used = ++this.clock;
      return Promise.resolve(hit);
    }
    let p = this.loading.get(key);
    if (!p) {
      p = this._load(key, url);
      this.loading.set(key, p);
    }
    return p.then((slot) => {
      const s = this.slots[slot];
      s.refs++; s.used = ++this.clock;
      return slot;
    });
  }

  release(key) {
    const slot = this.keySlot.get(key);
    if (slot === undefined) return;
    const s = this.slots[slot];
    s.refs = Math.max(0, s.refs - 1);
  }

  _freeSlot() {
    let best = -1, bestUsed = Infinity;
    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (s.busy) continue;
      if (s.key === null) return i;
      if (s.refs === 0 && s.used < bestUsed) { best = i; bestUsed = s.used; }
    }
    return best;
  }

  async _load(key, url) {
    let bitmap = null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const blob = await res.blob();
      bitmap = await createImageBitmap(blob, {
        resizeWidth: this.size, resizeHeight: this.size, resizeQuality: 'high',
        colorSpaceConversion: 'none', premultiplyAlpha: 'none',
      });
    } catch (e) {
      console.warn(`[${this.name}] doku yuklenemedi`, url, e.message || e);
    }
    let slot = this._freeSlot();
    if (slot < 0) {
      console.warn(`[${this.name}] kapasite doldu (${this.capacity}); katman paylasiliyor`);
      slot = (this.clock % this.capacity);
    }
    const s = this.slots[slot];
    if (s.key !== null) this.keySlot.delete(s.key);
    s.key = key; s.refs = 0; s.used = ++this.clock; s.busy = true;
    await new Promise((resolve) => this.queue.push({ slot, key, bitmap, resolve }));
    s.busy = false;
    this.keySlot.set(key, slot);
    this.loading.delete(key);
    return slot;
  }

  /** Bekleyen dokulari GPU'ya aktarir. Her karede cagrilir. */
  flush(maxPerFrame = 8) {
    if (!this.queue.length) return 0;
    const batch = this.queue.splice(0, maxPerFrame);
    const tex = this.texture;
    let copied = 0;
    tex.generateMipmaps = false;
    for (const job of batch) {
      if (!job.bitmap) continue;
      if (this.onSlotFilled) this.onSlotFilled(job.slot, job.key, job.bitmap);
      const src = new THREE.Texture(job.bitmap);
      _dst.set(0, 0, job.slot);
      this.renderer.copyTextureToTexture(src, tex, null, _dst);
      job.bitmap.close();
      copied++;
    }
    tex.generateMipmaps = true;
    if (copied) this._regenMips();
    for (const job of batch) job.resolve();
    return batch.length;
  }

  _regenMips() {
    const gl = this.renderer.getContext();
    const props = this.renderer.properties.get(this.texture);
    if (!props.__webglTexture) return;
    this.renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, props.__webglTexture);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  }

  stats() {
    let used = 0, refd = 0;
    for (const s of this.slots) { if (s.key !== null) used++; if (s.refs > 0) refd++; }
    return { used, refd, capacity: this.capacity, queued: this.queue.length };
  }
}
