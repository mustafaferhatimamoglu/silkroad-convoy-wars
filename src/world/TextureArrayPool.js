import * as THREE from 'three';

// GPU doku dizisi havuzu. Ayni boyuttaki pek cok dokuyu (zemin karolari, bina dokulari)
// tek bir sampler2DArray icinde tutar; boylece bir bolgenin tum objeleri tek cizim
// cagrisinda cizilebilir. Katmanlar referans sayimi + LRU ile yeniden kullanilir.
// normals: true ise ayni katman indeksinde ikinci bir dizi (normal haritasi RGB + puruzluluk A)
// tutulur; dokunun normal dosyasi yoksa duz normal ve varsayilan puruzluluk yazilir.

const _dst = new THREE.Vector3();

export class TextureArrayPool {
  constructor(renderer, { size = 512, capacity = 128, anisotropy = 8, name = 'pool', normals = false, roughness = 0.85 } = {}) {
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
    this.normalTexture = null;
    if (normals) {
      this.rtN = new THREE.WebGLArrayRenderTarget(size, size, capacity, {
        depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy,
      });
      this.normalTexture = this.rtN.texture;
      renderer.initRenderTarget(this.rtN);
      // duz normal + varsayilan puruzluluk
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(4, 4) : document.createElement('canvas');
      c.width = c.height = 4;
      const g = c.getContext('2d');
      g.fillStyle = `rgba(128,128,255,${roughness})`;
      g.fillRect(0, 0, 4, 4);
      this._flatN = createImageBitmap(c, { resizeWidth: size, resizeHeight: size, premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    }

    this.slots = Array.from({ length: capacity }, () => ({ key: null, refs: 0, used: 0, busy: false }));
    this.keySlot = new Map();   // key -> slot
    this.loading = new Map();   // key -> Promise<slot>
    this.queue = [];
    this._pendingN = [];
    this.clock = 0;
    this.onSlotFilled = null;   // (slot, key, bitmapInfo) => void
  }

  /** Dokuyu bir katmana yerlestirir (gerekirse yukler) ve referansini arttirir. nurl: normal+puruzluluk dosyasi. */
  acquire(key, url, nurl = null) {
    const hit = this.keySlot.get(key);
    if (hit !== undefined) {
      const s = this.slots[hit];
      s.refs++; s.used = ++this.clock;
      return Promise.resolve(hit);
    }
    let p = this.loading.get(key);
    if (!p) {
      p = this._load(key, url, nurl);
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

  async _bitmap(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const blob = await res.blob();
    return createImageBitmap(blob, {
      resizeWidth: this.size, resizeHeight: this.size, resizeQuality: 'high',
      colorSpaceConversion: 'none', premultiplyAlpha: 'none',
    });
  }

  async _load(key, url, nurl) {
    let bitmap = null, nbitmap = null;
    try { bitmap = await this._bitmap(url); } catch (e) { console.warn(`[${this.name}] doku yuklenemedi`, url, e.message || e); }
    if (this.rtN && nurl) {
      try { nbitmap = await this._bitmap(nurl); } catch (e) { console.warn(`[${this.name}] normal yuklenemedi`, nurl, e.message || e); }
    }
    let slot = this._freeSlot();
    if (slot < 0) {
      console.warn(`[${this.name}] kapasite doldu (${this.capacity}); katman paylasiliyor`);
      slot = (this.clock % this.capacity);
    }
    const s = this.slots[slot];
    if (s.key !== null) this.keySlot.delete(s.key);
    s.key = key; s.refs = 0; s.used = ++this.clock; s.busy = true;
    await new Promise((resolve) => this.queue.push({ slot, key, bitmap, nbitmap, resolve }));
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
      if (this.rtN) this._pendingN.push(job);
      copied++;
    }
    tex.generateMipmaps = true;
    if (copied) this._regenMips(this.texture);
    if (this.rtN && this._pendingN.length) this._flushNormals();
    for (const job of batch) job.resolve();
    return batch.length;
  }

  /** Normal dizisi: dosyasi olanlar kendi, olmayanlar duz normal. */
  async _flushNormals() {
    const jobs = this._pendingN.splice(0);
    const flat = await this._flatN;
    const tn = this.normalTexture;
    tn.generateMipmaps = false;
    for (const job of jobs) {
      const src = new THREE.Texture(job.nbitmap || flat);
      src.colorSpace = THREE.NoColorSpace;
      _dst.set(0, 0, job.slot);
      this.renderer.copyTextureToTexture(src, tn, null, _dst);
      if (job.nbitmap) job.nbitmap.close();
    }
    tn.generateMipmaps = true;
    this._regenMips(tn);
  }

  _regenMips(texture = this.texture) {
    const gl = this.renderer.getContext();
    const props = this.renderer.properties.get(texture);
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
