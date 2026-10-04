/**
 * SilkroadMap.js — Silkroad dunyasini ve zindanlarini Three.js (r128) ile yukler.
 *
 * Ozellikler:
 *   - 4595 arazi bolgesi akisi (streaming chunks: .bin + colormaps + water)
 *   - Gercek 3D modeller (.bms/.bmt -> BufferGeometry + textures)
 *   - 28 Silkroad zindani destegi (.dof -> rooms, props, lights)
 *   - Otantik Joymax arka plan muzikleri (BGM, .ogg)
 *   - Resmi mini harita entegrasyonu
 */
(function (global) {
  'use strict';

  const TYPED = { float32: Float32Array, uint16: Uint16Array, uint8: Uint8Array };

  class SilkroadMap {
    constructor(scene, opts = {}) {
      this.scene = scene;
      this.opts = Object.assign({
        baseUrl: './',
        modelsUrl: '../MODELS/',
        musicUrl: '../MUSIC/',
        minimapUrl: '../MINIMAP/',
        scale: 0.1,            // 1 Silkroad birimi -> Three.js birimi
        origin: null,          // {x, z} bolge; null ise world.json'daki onerilen (Jangan 168,97)
        viewRadius: 2,         // oyuncunun etrafinda yuklenecek bolge yaricapi
        keepRadius: 3,         // bu yaricap disindaki bolgeler bosaltilir
        colormap: true,        // bake edilmis zemin rengi
        detailTexture: true,   // Zemin mikro detay dokusu (repeating detail texture)
        detailRepeat: 96,      // Silkroad 96 cell / bolge cozunurluguyle birebir eslesen doku tekrari
        detailStrength: 0.62,  // Zemin harmanlama gucu (0.0 - 1.0)
        water: true,
        objects: true,         // obje yerlesimleri
        realModels: true,      // gercek 3D modelleri yukle (MODELS/)
        seasonalEvents: false, // mevsimsel etkinlik susleri (cadilar bayrami, seritler vb.)
        objectColor: 0xb08850,
        maxConcurrent: 4,
        bgmVolume: 0.4
      }, opts);

      this.group = new THREE.Group();
      this.group.name = 'SilkroadMap';
      scene.add(this.group);

      this.dungeonGroup = new THREE.Group();
      this.dungeonGroup.name = 'SilkroadDungeons';
      scene.add(this.dungeonGroup);

      this.regions = new Map();   // key -> { state, root, heights, ... }
      this.loading = 0;
      this.queue = [];

      // 3D model ve geometri onbellegi
      this.modelDefs = new Map();     // mid -> model json
      this.geomCache = new Map();     // path -> THREE.BufferGeometry
      this.matCache = new Map();      // path -> THREE.Material
      this.detailTexCache = new Map(); // path -> THREE.Texture
      this.geomLoader = new THREE.BufferGeometryLoader();
      this.texLoader = new THREE.TextureLoader();

      // Audio
      this.audio = null;
      this.currentTrack = null;
      this.dungeons = [];
    }

    async init() {
      const base = this.opts.baseUrl;
      this.world = await (await fetch(base + 'world.json')).json();
      this.cs = this.world.coordinateSystem;
      this.layout = this.world.binLayout;
      this.index = new Map(this.world.regions.map(r => [r.key, r]));

      const o = this.opts.origin || this.cs.suggestedOrigin;
      this.origin = { x: o.x, z: o.z };

      // Obje ve model tanimlari
      if (this.opts.objects) {
        try { this.models = await (await fetch(base + this.world.paths.models + '?v=6')).json(); } catch (e) { this.models = {}; }
        try {
          const mIdx = await (await fetch(this.opts.modelsUrl + 'models_index.json?v=6')).json();
          this.modelsIndex = mIdx.models || {};
        } catch (e) {
          this.modelsIndex = {};
        }
      }

      // Zindan katalogu
      try {
        this.dungeons = await (await fetch(base + 'dungeons.json')).json();
      } catch (e) {
        this.dungeons = [];
      }

      // Muzik katalogu
      try {
        this.musicIndex = await (await fetch(this.opts.musicUrl + 'music_index.json')).json();
      } catch (e) {
        this.musicIndex = [];
      }

      this.waterNormalTex = this._createWaterNormalTexture();
      this.waterMat = new THREE.MeshStandardMaterial({
        color: 0x166e9c,
        roughness: 0.08,
        metalness: 0.18,
        transparent: true,
        opacity: 0.74,
        side: THREE.DoubleSide,
        depthWrite: false,
        normalMap: this.waterNormalTex,
        normalScale: new THREE.Vector2(0.35, 0.35)
      });

      this.objGeo = new THREE.BoxGeometry(1, 1, 1);
      this.objGeo.translate(0, 0.5, 0);
      this.objMat = new THREE.MeshStandardMaterial({ color: this.opts.objectColor, roughness: 0.9 });

      return this;
    }

    _createWaterNormalTexture() {
      const size = 256;
      const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      if (!canvas) return null;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(size, size);
      const d = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = (x / size) * Math.PI * 8;
          const ny = (y / size) * Math.PI * 8;
          const dx = Math.sin(nx) * 0.4 + Math.sin(nx * 2.3 + ny * 1.5) * 0.25;
          const dy = Math.cos(ny) * 0.4 + Math.cos(nx * 1.5 + ny * 2.3) * 0.25;
          const r = Math.floor((-dx * 0.5 + 0.5) * 255);
          const g = Math.floor((-dy * 0.5 + 0.5) * 255);
          const idx = (y * size + x) * 4;
          d[idx] = r;
          d[idx + 1] = g;
          d[idx + 2] = 255;
          d[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 8);
      return tex;
    }

    updateWater(time) {
      if (this.waterNormalTex) {
        this.waterNormalTex.offset.x = (time * 0.00004) % 1;
        this.waterNormalTex.offset.y = (time * 0.00003) % 1;
      }
    }

    // ------------------------------------------------------------ koordinat yardimcilari
    /** Silkroad bolge + yerel konum -> Three.js Vector3 */
    toThree(rx, rz, lx, y, lz, target = new THREE.Vector3()) {
      const R = this.cs.regionSize, s = this.opts.scale;
      return target.set(((rx - this.origin.x) * R + lx) * s, y * s, -((rz - this.origin.z) * R + lz) * s);
    }

    /** Three.js x,z -> { rx, rz, lx, lz } */
    fromThree(x, z) {
      const R = this.cs.regionSize, s = this.opts.scale;
      const wx = x / s + this.origin.x * R, wz = -z / s + this.origin.z * R;
      const rx = Math.floor(wx / R), rz = Math.floor(wz / R);
      return { rx, rz, lx: wx - rx * R, lz: wz - rz * R };
    }

    /** Bolge merkez koordinati */
    regionCenter(rx, rz) {
      const R = this.cs.regionSize;
      const v = this.toThree(rx, rz, R / 2, 0, R / 2);
      v.y = this.getHeightAt(v.x, v.z) || 0;
      return v;
    }

    hasRegion(rx, rz) { return this.index.has(`${rz}_${rx}`); }

    /** Verilen x,z noktasindaki arazi yuksekligi */
    getHeightAt(x, z) {
      const p = this.fromThree(x, z);
      const reg = this.regions.get(`${p.rz}_${p.rx}`);
      if (!reg || !reg.heights) return null;
      const N = this.cs.vertsPerSide, C = this.cs.cellSize;
      const fx = Math.min(Math.max(p.lx / C, 0), N - 1.0001), fz = Math.min(Math.max(p.lz / C, 0), N - 1.0001);
      const j = Math.floor(fx), i = Math.floor(fz), tx = fx - j, tz = fz - i;
      const h = reg.heights;
      const a = h[i * N + j], b = h[i * N + j + 1], c = h[(i + 1) * N + j], d = h[(i + 1) * N + j + 1];
      return ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz) * this.opts.scale;
    }

    // ------------------------------------------------------------ akis (streaming)
    update(position) {
      if (!this.world) return;
      const p = this.fromThree(position.x, position.z);
      const r = this.opts.viewRadius, k = this.opts.keepRadius;
      const wanted = [];
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const key = `${p.rz + dz}_${p.rx + dx}`;
        if (this.index.has(key) && !this.regions.has(key)) wanted.push({ key, d: dx * dx + dz * dz });
      }
      wanted.sort((a, b) => a.d - b.d).forEach(w => {
        this.regions.set(w.key, { state: 'queued' });
        this.queue.push(w.key);
      });
      for (const [key, reg] of this.regions) {
        const info = this.index.get(key);
        if (Math.abs(info.x - p.rx) > k || Math.abs(info.z - p.rz) > k) this.unloadRegion(key);
      }
      this._pump();
    }

    _pump() {
      while (this.loading < this.opts.maxConcurrent && this.queue.length) {
        const key = this.queue.shift();
        const reg = this.regions.get(key);
        if (!reg || reg.state !== 'queued') continue;
        this.loading++;
        this.loadRegion(key).catch(e => console.warn('SilkroadMap: bolge yuklenemedi', key, e))
          .finally(() => { this.loading--; this._pump(); });
      }
    }

    unloadRegion(key) {
      const reg = this.regions.get(key);
      if (!reg) return;
      reg.state = 'unloaded';
      if (reg.root) {
        this.group.remove(reg.root);
        reg.root.traverse(o => {
          if (o.geometry && o.geometry !== this.objGeo) o.geometry.dispose();
          if (o.material && o.material !== this.waterMat && o.material !== this.objMat) {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose();
          }
        });
      }
      this.regions.delete(key);
    }

    async loadRegion(key) {
      const info = this.index.get(key);
      const reg = this.regions.get(key);
      reg.state = 'loading';
      const base = this.opts.baseUrl, P = this.world.paths;
      const buf = await (await fetch(base + P.region.replace('{key}', key))).arrayBuffer();
      if (reg.state !== 'loading') return;
      const f = this.layout.fields;
      const view = (name) => new TYPED[f[name].type](buf, f[name].offset, f[name].count);
      const heights = view('height');
      reg.heights = heights;
      reg.info = info;

      const root = new THREE.Group();
      root.name = 'region_' + key;
      root.add(this._buildTerrain(info, heights));
      if (this.opts.water) {
        const w = this._buildWater(info, heights, view('waterType'), view('waterHeight'));
        if (w) root.add(w);
      }
      reg.root = root;
      reg.state = 'ready';
      this.group.add(root);

      if (this.opts.objects && info.objects) {
        try {
          const data = await (await fetch(base + P.objects.replace('{key}', key) + '?v=6')).json();
          if (reg.state === 'ready') root.add(await this._buildObjects(info, data.objects));
        } catch (e) { }
      }
      if (this.onRegionLoaded) this.onRegionLoaded(key, reg);
    }

    _buildTerrain(info, heights) {
      const N = this.cs.vertsPerSide, C = this.cs.cellSize, s = this.opts.scale;
      const pos = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
      const o = this.toThree(info.x, info.z, 0, 0, 0);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const k = i * N + j;
        pos[k * 3] = o.x + j * C * s;
        pos[k * 3 + 1] = heights[k] * s;
        pos[k * 3 + 2] = o.z - i * C * s;
        uv[k * 2] = j / (N - 1);
        uv[k * 2 + 1] = i / (N - 1);
      }
      const idx = new Uint32Array((N - 1) * (N - 1) * 6);
      let t = 0;
      for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
        const a = i * N + j, b = a + 1, c = a + N, d = c + 1;
        idx[t++] = a; idx[t++] = b; idx[t++] = c;
        idx[t++] = b; idx[t++] = d; idx[t++] = c;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.05 });
      if (this.opts.colormap) {
        const tex = this.texLoader.load(this.opts.baseUrl + this.world.paths.colormap.replace('{key}', info.key));
        tex.anisotropy = 8;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
        mat.map = tex;
      } else {
        mat.color.set(0x8a7a5a);
      }

      if (this.opts.detailTexture) {
        const { texture: detailTex, path: detailPath } = this._getTerrainDetailTexture(info);
        const repeatCount = this.opts.detailRepeat || 96;
        const strength = this.opts.detailStrength !== undefined ? this.opts.detailStrength : 0.62;

        mat.onBeforeCompile = (shader) => {
          shader.uniforms.detailMap = { value: detailTex };
          shader.uniforms.detailRepeat = { value: new THREE.Vector2(repeatCount, repeatCount) };
          shader.uniforms.detailStrength = { value: strength };

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_pars_fragment>',
            `#include <map_pars_fragment>
            uniform sampler2D detailMap;
            uniform vec2 detailRepeat;
            uniform float detailStrength;
            `
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            #ifdef USE_MAP
              vec4 dTex = texture2D( detailMap, vUv * detailRepeat );
              // Standart Joymax arazi mikro-detay harmonisi:
              // Ortalama parlaklik ~0.5 civari oldugundan 1.95 ile carpilarak 1.0 merkezlenir.
              vec3 dMod = dTex.rgb * 1.95;
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * dMod, detailStrength);
            #endif
            `
          );
        };
        mat.customProgramCacheKey = () => 'terrain_detail_' + detailPath;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'terrain_' + info.key;
      mesh.renderOrder = 0;
      mesh.receiveShadow = true;
      mesh.userData.region = info;
      return mesh;
    }

    _getDetailTexturePath(info) {
      const rx = info.x, rz = info.z;
      // Hotan (Vaha & Col bolgesi)
      if (rx >= 125 && rx <= 145 && rz >= 85 && rz <= 100) return 'textures/tile2d/oaho_dust_earth01.jpg';
      // Donwhang (Kanyon & Sari Col)
      if (rx >= 146 && rx <= 164 && rz >= 90 && rz <= 104) return 'textures/tile2d/wc_dust_don00.jpg';
      // Jangan & Asya (Cin Imparatorlugu)
      if (rx >= 165) return 'textures/tile2d/asiaminor_dust_01.jpg';
      // Roc Dagi
      if (rx >= 105 && rx <= 120 && rz <= 95) return 'textures/tile2d/rok_dust_01.jpg';
      // Samarkand & Central Asia
      if (rx >= 95 && rx <= 124) return 'textures/tile2d/central asia_dust_01.jpg';
      // Alexandria / Misir
      if (rx <= 65) return 'textures/tile2d/alex_dust_01.jpg';
      // Constantinople / Dogu Avrupa
      if (rx >= 66 && rx <= 94) return 'textures/tile2d/c_dust_fld_01.jpg';
      // Varsayilan otantik zemin
      return 'textures/tile2d/asiaminor_dust_01.jpg';
    }

    _getTerrainDetailTexture(info) {
      const relPath = this._getDetailTexturePath(info);
      if (this.detailTexCache.has(relPath)) {
        return { texture: this.detailTexCache.get(relPath), path: relPath };
      }
      const tex = this.texLoader.load(this.opts.baseUrl + encodeURI(relPath));
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      this.detailTexCache.set(relPath, tex);
      return { texture: tex, path: relPath };
    }

    _buildWater(info, heights, types, wh) {
      const s = this.opts.scale, C = this.cs.cellSize, N = this.cs.vertsPerSide;
      const pos = [], uvs = [];
      const p00 = new THREE.Vector3(), p10 = new THREE.Vector3(), p01 = new THREE.Vector3(), p11 = new THREE.Vector3();
      for (let bz = 0; bz < 6; bz++) for (let bx = 0; bx < 6; bx++) {
        const k = bz * 6 + bx;
        if (types[k] === 255) continue;
        const wHeight = wh[k] - 0.2; // Kiyi z-fighting'ini sifirlamak ve temiz gecis saglamak icin hafif alcak
        for (let cz = 0; cz < 16; cz++) {
          for (let cx = 0; cx < 16; cx++) {
            const iz = bz * 16 + cz, ix = bx * 16 + cx;
            const h00 = heights[iz * N + ix];
            const h10 = heights[iz * N + ix + 1];
            const h01 = heights[(iz + 1) * N + ix];
            const h11 = heights[(iz + 1) * N + ix + 1];
            // Eger 4 kose de su yuksekliginin ustundeyse kuru kara
            if (h00 >= wHeight && h10 >= wHeight && h01 >= wHeight && h11 >= wHeight) continue;

            const lx0 = ix * C, lz0 = iz * C;
            const lx1 = (ix + 1) * C, lz1 = (iz + 1) * C;
            this.toThree(info.x, info.z, lx0, wHeight, lz0, p00);
            this.toThree(info.x, info.z, lx1, wHeight, lz0, p10);
            this.toThree(info.x, info.z, lx0, wHeight, lz1, p01);
            this.toThree(info.x, info.z, lx1, wHeight, lz1, p11);

            // Winding order CCW (+Y up)
            pos.push(p00.x, p00.y, p00.z, p10.x, p10.y, p10.z, p01.x, p01.y, p01.z);
            pos.push(p10.x, p10.y, p10.z, p11.x, p11.y, p11.z, p01.x, p01.y, p01.z);

            // Doku ve dalga koordinatlari
            const u0 = (info.x * 1920 + lx0) * 0.005;
            const v0 = (info.z * 1920 + lz0) * 0.005;
            const u1 = (info.x * 1920 + lx1) * 0.005;
            const v1 = (info.z * 1920 + lz1) * 0.005;
            uvs.push(u0, v0, u1, v0, u0, v1);
            uvs.push(u1, v0, u1, v1, u0, v1);
          }
        }
      }
      if (!pos.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.waterMat);
      m.name = 'water_' + info.key;
      m.renderOrder = 1;
      return m;
    }

    // ------------------------------------------------------------ 3D model yukleme
    async loadModelMesh(mid) {
      const sMid = String(mid);
      if (!this.modelsIndex || !this.modelsIndex[sMid]) return null;

      if (!this.modelDefs.has(sMid)) {
        try {
          const def = await (await fetch(this.opts.modelsUrl + `models/${mid}.json`)).json();
          this.modelDefs.set(sMid, def);
        } catch (e) {
          return null;
        }
      }
      const def = this.modelDefs.get(sMid);
      if (!def || !def.meshes) return null;

      const group = new THREE.Group();
      group.name = 'model_' + mid + '_' + def.name;

      for (const m of def.meshes) {
        let geom = this.geomCache.get(m.geom);
        if (!geom) {
          try {
            const gJson = await (await fetch(this.opts.modelsUrl + m.geom.replace('MODELS/', ''))).json();
            geom = this.geomLoader.parse(gJson);
            this.geomCache.set(m.geom, geom);
          } catch (e) {
            continue;
          }
        }

        let mat = this.matCache.get((m.texture || m.geom) + (m.alpha ? '_alpha' : ''));
        if (!mat) {
          const isAlpha = !!m.alpha || (m.texture && m.texture.toLowerCase().endsWith('.png'));
          if (m.texture) {
            const tex = this.texLoader.load(this.opts.modelsUrl + m.texture.replace('MODELS/', ''));
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.anisotropy = 4;
            if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
            mat = new THREE.MeshStandardMaterial({
              map: tex,
              roughness: 0.8,
              metalness: 0.1,
              transparent: false,
              alphaTest: isAlpha ? 0.35 : 0.0,
              depthWrite: true,
              side: THREE.DoubleSide
            });
          } else {
            const c = m.color || [0.8, 0.8, 0.8];
            mat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(c[0], c[1], c[2]),
              roughness: 0.9,
              side: THREE.DoubleSide
            });
          }
          this.matCache.set((m.texture || m.geom) + (m.alpha ? '_alpha' : ''), mat);
        }

        const meshPart = new THREE.Mesh(geom, mat);
        meshPart.castShadow = true;
        meshPart.receiveShadow = true;
        group.add(meshPart);
      }
      return group;
    }

    async _buildObjects(info, list) {
      const s = this.opts.scale;
      const group = new THREE.Group();
      group.name = 'objects_' + info.key;

      // Model gruplari (Instanced vs Gercek)
      for (const o of list) {
        let [model, x, y, z, yaw] = o;

        // Mevsimsel Joymax etkinlik objelerini filtrele (kapiya saplanan seritler, cadirlar, cadilar bayrami vb.)
        const mInfo = this.models && (this.models[model] || this.models[String(model)]);
        const path = (mInfo && mInfo.path) || '';
        const mIdxInfo = this.modelsIndex && (this.modelsIndex[model] || this.modelsIndex[String(model)]);
        const mName = (mIdxInfo && mIdxInfo.name) || '';
        if (!this.opts.seasonalEvents && (
          /(?:res|compound\/struct)\/etc\/(?:summer_event|obt|halloween|x_mas|newyearday)/i.test(path) ||
          /^(?:sum_event|obt_event|halloween_|x_mas_|newyearday_)/i.test(mName) ||
          /^(?:sum_event|halloween|x_mas|obt_event)/i.test(path)
        )) {
          continue;
        }

        const pos = this.toThree(info.x, info.z, x, y, z);

        if (this.opts.realModels && this.modelsIndex && this.modelsIndex[String(model)]) {
          // Gercek 3D modeli yukle
          this.loadModelMesh(model).then(mObj => {
            if (mObj) {
              const clone = mObj.clone();
              clone.position.copy(pos);
              clone.rotation.y = yaw;
              clone.scale.set(s, s, s);
              group.add(clone);
            }
          });
        } else {
          // Yer tutucu kutu
          const big = /bldg|castle|wall|gate|bridge/i.test(path);
          const size = (big ? 120 : 30) * s;
          const box = new THREE.Mesh(this.objGeo, this.objMat);
          box.position.copy(pos);
          box.rotation.y = yaw;
          box.scale.set(size, size * (big ? 1.2 : 1.6), size);
          group.add(box);
        }
      }
      return group;
    }

    // ------------------------------------------------------------ Zindan Sistemi
    async loadDungeon(dungeonId) {
      // Onceki zindani temizle
      while (this.dungeonGroup.children.length) {
        const c = this.dungeonGroup.children[0];
        this.dungeonGroup.remove(c);
      }

      const dInfo = this.dungeons.find(d => d.id === dungeonId);
      if (!dInfo) return null;

      const res = await (await fetch(this.opts.baseUrl + dInfo.file)).json();
      const s = this.opts.scale;

      const root = new THREE.Group();
      root.name = 'dungeon_' + dungeonId;

      for (const obj of res.objects) {
        const pos = new THREE.Vector3(obj.pos[0] * s, obj.pos[1] * s, -obj.pos[2] * s);
        const yaw = obj.yaw || (obj.rot ? obj.rot[1] : 0);

        if (this.opts.realModels && this.modelsIndex && this.modelsIndex[String(obj.model)]) {
          this.loadModelMesh(obj.model).then(mObj => {
            if (mObj) {
              const clone = mObj.clone();
              clone.position.copy(pos);
              clone.rotation.y = yaw;
              clone.scale.set(s, s, s);
              root.add(clone);
            }
          });
        } else {
          const isBlock = obj.type === 'room_block';
          const size = (isBlock ? 80 : 20) * s;
          const box = new THREE.Mesh(this.objGeo, this.objMat);
          box.position.copy(pos);
          box.rotation.y = yaw;
          box.scale.set(size, size, size);
          root.add(box);
        }
      }

      this.dungeonGroup.add(root);

      // BGM cal
      if (res.bgm) {
        this.playBGM(res.bgm);
      }

      return {
        dungeon: res,
        bounds: res.bounds,
        center: new THREE.Vector3(
          ((res.bounds[0][0] + res.bounds[1][0]) / 2) * s,
          ((res.bounds[0][1] + res.bounds[1][1]) / 2) * s,
          -((res.bounds[0][2] + res.bounds[1][2]) / 2) * s
        )
      };
    }

    // ------------------------------------------------------------ Muzik (BGM)
    playBGM(trackName) {
      if (!trackName) return;
      if (this.currentTrack === trackName && this.audio && !this.audio.paused) return;

      if (this.audio) {
        this.audio.pause();
        this.audio = null;
      }
      try {
        const url = this.opts.musicUrl + trackName;
        this.audio = new Audio(url);
        this.audio.loop = true;
        this.audio.volume = this.opts.bgmVolume;
        this.audio.play().catch(e => {
          // Tarayici kullanici etkilesimi bekleyebilir
        });
        this.currentTrack = trackName;
      } catch (e) {
        console.warn('BGM play error:', e);
      }
    }

    setBGMVolume(vol) {
      this.opts.bgmVolume = vol;
      if (this.audio) this.audio.volume = vol;
    }
  }

  global.SilkroadMap = SilkroadMap;
})(typeof window !== 'undefined' ? window : globalThis);
