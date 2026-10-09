import * as THREE from 'three';
import { VERTS, CELLS, CELL_M, SCALE } from './WorldData.js';

// Silkroad zemin geometrisi ve "splat" malzemesi.
//
// Her kose noktasi bir orijinal zemin dokusu + olcek ussu tasir. Parca shader'i bulundugu
// hucrenin 4 kosesindeki dokulari dogru tekrar boyunda (4 * 2^u hucre) ornekler ve
// dokularin parlakligini "yukseklik" gibi kullanarak dogal gecisler uretir (tas cimenin
// arasindan cikar gibi). Uzaklasinca bolgenin renk haritasina yumusakca gecer.

const SHARED_INDEX = new Map();

/** Ortak index tamponu (ayni topolojiye sahip tum bolgeler paylasir). */
function gridIndex(n) {
  if (SHARED_INDEX.has(n)) return SHARED_INDEX.get(n);
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let t = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
      idx[t++] = a; idx[t++] = b; idx[t++] = c;
      idx[t++] = b; idx[t++] = d; idx[t++] = c;
    }
  }
  const attr = new THREE.BufferAttribute(idx, 1);
  SHARED_INDEX.set(n, attr);
  return attr;
}

/** Delikli bolge (tunel agzi) icin index: delik kosesine degen ucgenler atlanir. */
export function holeIndex(holes) {
  const n = VERTS, out = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
      if (!holes[a] && !holes[b] && !holes[c]) out.push(a, b, c);
      if (!holes[b] && !holes[d] && !holes[c]) out.push(b, d, c);
    }
  }
  return new THREE.BufferAttribute(new Uint32Array(out), 1);
}

/**
 * Bolge yerel koordinatlarinda zemin geometrisi kurar.
 * step: 1 = tam cozunurluk (97x97), 4 = uzak LOD (25x25).
 * heightAt(i, j): komsu bolgelere tasan indisler icin yukseklik (Silkroad birimi) ya da null.
 */
export function buildTerrainGeometry(heights, step, heightAt) {
  const n = Math.floor(CELLS / step) + 1;
  const pos = new Float32Array(n * n * 3);
  const nor = new Float32Array(n * n * 3);
  const H = (i, j) => {
    if (i >= 0 && i < VERTS && j >= 0 && j < VERTS) return heights[i * VERTS + j];
    const v = heightAt ? heightAt(i, j) : null;
    if (v !== null && v !== undefined) return v;
    return heights[Math.min(VERTS - 1, Math.max(0, i)) * VERTS + Math.min(VERTS - 1, Math.max(0, j))];
  };
  const inv2c = 1 / (2 * CELL_M * step);
  for (let a = 0; a < n; a++) {
    const i = a * step;
    for (let b = 0; b < n; b++) {
      const j = b * step;
      const k = a * n + b;
      pos[k * 3] = j * CELL_M;
      pos[k * 3 + 1] = heights[i * VERTS + j] * SCALE;
      pos[k * 3 + 2] = -i * CELL_M;
      // merkezi fark ile normal (komsu bolgelerle dikissiz)
      const dhdx = (H(i, j + step) - H(i, j - step)) * SCALE * inv2c;
      const dhdi = (H(i + step, j) - H(i - step, j)) * SCALE * inv2c; // i kuzeye (= -z) dogru
      // H(x, z): dH/dz = -dH/di
      let nx = -dhdx, ny = 1, nz = dhdi;
      const l = 1 / Math.hypot(nx, ny, nz);
      nor[k * 3] = nx * l; nor[k * 3 + 1] = ny * l; nor[k * 3 + 2] = nz * l;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(gridIndex(n));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** Kenar normallerini komsu yuklendikten sonra tazeler (dikis kaybolsun). */
export function refreshEdgeNormals(geo, heights, step, heightAt) {
  const n = Math.floor(CELLS / step) + 1;
  const nor = geo.attributes.normal.array;
  const H = (i, j) => {
    if (i >= 0 && i < VERTS && j >= 0 && j < VERTS) return heights[i * VERTS + j];
    const v = heightAt(i, j);
    if (v !== null && v !== undefined) return v;
    return heights[Math.min(VERTS - 1, Math.max(0, i)) * VERTS + Math.min(VERTS - 1, Math.max(0, j))];
  };
  const inv2c = 1 / (2 * CELL_M * step);
  const upd = (a, b) => {
    const i = a * step, j = b * step, k = a * n + b;
    const dhdx = (H(i, j + step) - H(i, j - step)) * SCALE * inv2c;
    const dhdi = (H(i + step, j) - H(i - step, j)) * SCALE * inv2c;
    let nx = -dhdx, ny = 1, nz = dhdi;
    const l = 1 / Math.hypot(nx, ny, nz);
    nor[k * 3] = nx * l; nor[k * 3 + 1] = ny * l; nor[k * 3 + 2] = nz * l;
  };
  for (let t = 0; t < n; t++) { upd(0, t); upd(n - 1, t); upd(t, 0); upd(t, n - 1); }
  geo.attributes.normal.needsUpdate = true;
}

/** Zemin malzemesi fabrikasi: tum bolgeler ayni shader programini paylasir. */
export class TerrainMaterials {
  constructor(pool, opts = {}) {
    this.pool = pool;
    // katman basina ortalama parlaklik (yukseklik karisimini dokudan bagimsiz yapar), vec4 paketli
    this.cap4 = Math.ceil(pool.capacity / 4);
    this.layerLum = new Float32Array(this.cap4 * 4).fill(0.5);
    this.opts = Object.assign({ farStart: 140, farEnd: 320, sharpness: 0.75, blendDepth: 0.18, tintK: 0.85 }, opts);
    this.shared = {
      tTiles: { value: pool.texture },
      tTilesN: { value: pool.normalTexture },
      uLayerLum: { value: this.layerLum },
      uFar: { value: new THREE.Vector2(this.opts.farStart, this.opts.farEnd) },
      uSharp: { value: this.opts.sharpness },
      uBlendDepth: { value: this.opts.blendDepth },
      uTintK: { value: this.opts.tintK },
    };
  }

  setLayerLuminance(slot, lum) { this.layerLum[slot] = lum; }

  /** Duzeltme haritasi olmayan bolgeler icin 1.0 (= 102/255 x 2.5). */
  static unitCorr() {
    if (!TerrainMaterials._unit) {
      const t = new THREE.DataTexture(new Uint8Array([102, 102, 102, 255]), 1, 1, THREE.RGBAFormat);
      t.needsUpdate = true;
      TerrainMaterials._unit = t;
    }
    return TerrainMaterials._unit;
  }

  /** Yakin (tam detay) bolge malzemesi. */
  createNear(indexTex, colormapTex, cellOffset) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.0 });
    const cap4 = this.cap4;
    const shared = this.shared;
    const uniforms = {
      tIndex: { value: indexTex },
      tColormap: { value: colormapTex },
      tCorr: { value: (colormapTex.userData && colormapTex.userData.corr) || TerrainMaterials.unitCorr() },
      uCellOffset: { value: new THREE.Vector2(cellOffset.x, cellOffset.y) },
    };
    mat.userData.uniforms = uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vCell;\nvarying vec3 vTerrN;\nvarying float vHCell;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCell = vec2(position.x, -position.z) * ' + (1 / CELL_M).toFixed(6) + ';\nvTerrN = normal;\nvHCell = position.y * ' + (1 / CELL_M).toFixed(6) + ';');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vCell;
varying vec3 vTerrN;
varying float vHCell;
uniform highp sampler2DArray tTiles;
uniform highp sampler2DArray tTilesN;
uniform sampler2D tIndex;
uniform sampler2D tColormap;
uniform sampler2D tCorr;
uniform float uTintK;
uniform vec2 uCellOffset;
uniform vec2 uFar;
uniform float uSharp;
uniform float uBlendDepth;
uniform vec4 uLayerLum[${cap4}];
// karisik normal (RGB) + puruzluluk (A): map_fragment'te hesaplanir, normal/puruzluluk adiminda kullanilir
vec4 gNR = vec4(0.5, 0.5, 1.0, 0.92);

vec4 nrTap(vec4 id, vec2 g, vec2 gdx, vec2 gdy) {
  int layer = int(id.r * 255.0 + 0.5);
  float inv = 1.0 / exp2(floor(id.g * 255.0 + 0.5));
  return textureGrad(tTilesN, vec3(g * inv, float(layer)), gdx * inv, gdy * inv);
}

// yan izdusum (ucurum): baskin karonun dokusu, yatay eksen + yukseklik ile
// (turevler dallanma disinda hesaplanip verilir: tekdüze olmayan akista dFdx tanimsiz)
vec3 sideTap(vec4 id, vec2 uv, vec2 dx, vec2 dy) {
  int layer = int(id.r * 255.0 + 0.5);
  float inv = 1.0 / exp2(floor(id.g * 255.0 + 0.5));
  return textureGrad(tTiles, vec3(uv * inv, float(layer)), dx * inv, dy * inv).rgb;
}

vec3 splatTap(vec4 id, vec2 g, vec2 gdx, vec2 gdy, out float h) {
  int layer = int(id.r * 255.0 + 0.5);
  float inv = 1.0 / exp2(floor(id.g * 255.0 + 0.5));
  vec3 c = textureGrad(tTiles, vec3(g * inv, float(layer)), gdx * inv, gdy * inv).rgb;
  h = dot(c, vec3(0.2126, 0.7152, 0.0722)) - uLayerLum[layer >> 2][layer & 3] + 0.5;
  return c;
}
`)
        .replace('#include <map_fragment>', `
{
  vec2 cc = clamp(vCell, vec2(0.0), vec2(95.999));
  vec2 cf = floor(cc);
  ivec2 ci = ivec2(cf);
  vec2 f = cc - cf;
  vec4 i00 = texelFetch(tIndex, ci, 0);
  vec4 i10 = texelFetch(tIndex, ci + ivec2(1, 0), 0);
  vec4 i01 = texelFetch(tIndex, ci + ivec2(0, 1), 0);
  vec4 i11 = texelFetch(tIndex, ci + ivec2(1, 1), 0);
  vec2 g = uCellOffset + vCell;
  vec2 gdx = dFdx(vCell), gdy = dFdy(vCell);
  float hdx = dFdx(vHCell), hdy = dFdy(vHCell);
  vec3 splat;
  float h0, h1, h2, h3;
  if (i00 == i10 && i00 == i01 && i00 == i11) {
    splat = splatTap(i00, g, gdx, gdy, h0);
    gNR = nrTap(i00, g, gdx, gdy);
  } else {
    vec3 c0 = splatTap(i00, g, gdx, gdy, h0);
    vec3 c1 = splatTap(i10, g, gdx, gdy, h1);
    vec3 c2 = splatTap(i01, g, gdx, gdy, h2);
    vec3 c3 = splatTap(i11, g, gdx, gdy, h3);
    vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
    vec3 lin = c0 * w.x + c1 * w.y + c2 * w.z + c3 * w.w;
    vec4 hw = vec4(h0, h1, h2, h3) + w;
    float ma = max(max(hw.x, hw.y), max(hw.z, hw.w)) - uBlendDepth;
    vec4 b = max(hw - vec4(ma), vec4(0.0));
    vec3 hb = (c0 * b.x + c1 * b.y + c2 * b.z + c3 * b.w) / max(b.x + b.y + b.z + b.w, 1e-4);
    splat = mix(lin, hb, uSharp);
    vec4 fw = mix(w, b / max(b.x + b.y + b.z + b.w, 1e-4), uSharp);
    gNR = nrTap(i00, g, gdx, gdy) * fw.x + nrTap(i10, g, gdx, gdy) * fw.y + nrTap(i01, g, gdx, gdy) * fw.z + nrTap(i11, g, gdx, gdy) * fw.w;
  }
  // Dik yamaclarda ustten izdusum dokuyu dikey cizgilere uzatir: yandan (triplanar)
  // izdusume gec. Yalnizca dik piksellerde calisir; duz zeminin maliyeti degismez.
  vec3 tn = normalize(vTerrN);
  float steep = smoothstep(0.78, 0.5, tn.y);
  if (steep > 0.0) {
    vec4 w4 = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
    vec4 dom = i00; float dw = w4.x;
    if (w4.y > dw) { dom = i10; dw = w4.y; }
    if (w4.z > dw) { dom = i01; dw = w4.z; }
    if (w4.w > dw) { dom = i11; }
    vec2 aw = pow(abs(tn.xz), vec2(3.0));
    aw /= max(aw.x + aw.y, 1e-4);
    vec3 side = vec3(0.0);
    float sw = 0.0;
    if (aw.x > 0.02) { side += sideTap(dom, vec2(g.y, vHCell), vec2(gdx.y, hdx), vec2(gdy.y, hdy)) * aw.x; sw += aw.x; }
    if (aw.y > 0.02) { side += sideTap(dom, vec2(g.x, vHCell), vec2(gdx.x, hdx), vec2(gdy.x, hdy)) * aw.y; sw += aw.y; }
    splat = mix(splat, side / max(sw, 1e-4), steep);
    gNR.xyz = mix(gNR.xyz, vec3(0.5, 0.5, 1.0), steep);
  }
  // orijinal palete renk duzeltmesi (16 m olcekli, yerel karo farklari korunur)
  splat *= mix(vec3(1.0), texture(tCorr, vCell / 96.0).rgb * 2.5, uTintK);
  float farT = smoothstep(uFar.x, uFar.y, length(vViewPosition));
  if (farT > 0.0) {
    vec3 cm = texture(tColormap, vCell / 96.0).rgb;
    splat = mix(splat, cm, farT);
    gNR = mix(gNR, vec4(0.5, 0.5, 1.0, 0.95), farT);
  }
  diffuseColor.rgb *= splat;
}
`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(gNR.a, 0.62, 1.0);')
        .replace('#include <normal_fragment_maps>', `
{
  // dunya eksenine hizali teget cerceve (u = dogu, v = kuzey), gorus uzayinda
  vec3 tN = gNR.xyz * 2.0 - 1.0;
  vec3 Tv = (viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz;
  Tv = normalize(Tv - normal * dot(normal, Tv));
  vec3 Bv = normalize(cross(normal, Tv));
  normal = normalize(Tv * tN.x + Bv * tN.y + normal * max(tN.z, 0.2));
}
`);
    };
    mat.customProgramCacheKey = () => 'sro-terrain-near-' + cap4;
    return mat;
  }

  /** Uzak LOD bolge malzemesi: sadece renk haritasi. */
  createFar(colormapTex) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0.0, map: colormapTex });
    return mat;
  }
}

/** Bolgenin 97x97 doku indeksi -> GPU index dokusu (R = katman, G = olcek ussu, B = yuzey). */
export function buildIndexTexture(texWords, tileToSlot, tileFlags) {
  const data = new Uint8Array(VERTS * VERTS * 4);
  for (let k = 0; k < VERTS * VERTS; k++) {
    const w = texWords[k];
    const id = w & 0x3ff;
    data[k * 4] = tileToSlot(id);
    data[k * 4 + 1] = (w >> 13) & 7;
    data[k * 4 + 2] = tileFlags(id);
    data[k * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, VERTS, VERTS, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/** Terrain yuksekligi (Silkroad birimi) - render ucgenleriyle birebir ayni interpolasyon. */
export function sampleHeight(heights, lx, lz) {
  const fx = Math.min(Math.max(lx / 20, 0), CELLS - 1e-4);
  const fz = Math.min(Math.max(lz / 20, 0), CELLS - 1e-4);
  const j = Math.floor(fx), i = Math.floor(fz);
  const tx = fx - j, tz = fz - i;
  const a = heights[i * VERTS + j], b = heights[i * VERTS + j + 1];
  const c = heights[(i + 1) * VERTS + j], d = heights[(i + 1) * VERTS + j + 1];
  if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
  return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
}
