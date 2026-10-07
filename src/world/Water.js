import * as THREE from 'three';
import { SCALE, CELL_M, VERTS } from './WorldData.js';

// Su yuzeyi: kiyida seffaflasan, derinlikle koyulasan, iki katmanli kayan normal haritali
// ve gokyuzunu yansitan (sahne ortam haritasi) malzeme.

function makeWaterNormalMap(size = 256, seed = 7) {
  // Tam dosenebilir (periyodik) dalga yukseklik alani -> normal haritasi
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const waves = [];
  for (let k = 0; k < 28; k++) {
    const kx = Math.round((rnd() * 2 - 1) * (2 + k * 0.6));
    const ky = Math.round((rnd() * 2 - 1) * (2 + k * 0.6));
    if (!kx && !ky) continue;
    const f = Math.hypot(kx, ky);
    waves.push({ kx, ky, a: 1 / Math.pow(f, 1.25), p: rnd() * Math.PI * 2 });
  }
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const w of waves) v += w.a * Math.sin((2 * Math.PI * (w.kx * x + w.ky * y)) / size + w.p);
      h[y * size + x] = v;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const k = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const d = h[((y - 1 + size) % size) * size + x], u = h[((y + 1) % size) * size + x];
      let nx = (l - r) * k, ny = (d - u) * k, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255; data[i + 1] = (ny * 0.5 + 0.5) * 255; data[i + 2] = (nz * 0.5 + 0.5) * 255; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export class WaterSystem {
  constructor() {
    this.time = { value: 0 };
    const normalTex = makeWaterNormalMap();
    this.material = new THREE.MeshStandardMaterial({
      color: 0x0d3a4a, roughness: 0.06, metalness: 0.0, transparent: true, depthWrite: false,
      envMapIntensity: 1.25,
    });
    const uNormal = { value: normalTex };
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.time;
      shader.uniforms.tWaterN = uNormal;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float depth;\nvarying float vDepth;\nvarying vec2 vWUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = depth;\nvWUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform sampler2D tWaterN;\nvarying float vDepth;\nvarying vec2 vWUv;')
        .replace('#include <normal_fragment_maps>', `
{
  vec3 n1 = texture(tWaterN, vWUv * 0.045 + uTime * vec2(0.011, 0.007)).xyz * 2.0 - 1.0;
  vec3 n2 = texture(tWaterN, vWUv * 0.13 + uTime * vec2(-0.017, 0.012)).xyz * 2.0 - 1.0;
  vec3 tn = normalize(vec3((n1.xy + n2.xy * 0.6) * 0.55, 1.0));
  vec3 wn = normalize(vec3(tn.x, tn.z, -tn.y));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float d = clamp(vDepth, 0.0, 30.0);
  vec3 shallow = vec3(0.10, 0.38, 0.40);
  vec3 deep = vec3(0.012, 0.075, 0.11);
  diffuseColor.rgb = mix(shallow, deep, smoothstep(0.0, 6.0, d));
  diffuseColor.a = mix(0.25, 0.9, smoothstep(0.0, 1.6, d));
}`);
    };
    this.material.customProgramCacheKey = () => 'sro-water';
  }

  update(dt) { this.time.value += dt; }

  /**
   * Bolge su meshi: 6x6 blok, blok basina su tipi + yuksekligi. Arazinin su altinda
   * kalan hucrelerine dortgen uretir; her kose arazi ile su arasindaki derinligi tasir.
   * Geometri bolge-yerel koordinatlardadir.
   */
  buildRegion(rx, rz, heights, waterType, waterHeight) {
    const pos = [], uv = [], dep = [];
    const ox = (rx * 96) % 512, oz = (rz * 96) % 512;
    for (let bz = 0; bz < 6; bz++) {
      for (let bx = 0; bx < 6; bx++) {
        const k = bz * 6 + bx;
        if (waterType[k] === 255) continue;
        const wh = waterHeight[k] - 0.2;
        for (let cz = 0; cz < 16; cz++) {
          for (let cx = 0; cx < 16; cx++) {
            const i = bz * 16 + cz, j = bx * 16 + cx;
            const h00 = heights[i * VERTS + j], h10 = heights[i * VERTS + j + 1];
            const h01 = heights[(i + 1) * VERTS + j], h11 = heights[(i + 1) * VERTS + j + 1];
            if (h00 >= wh && h10 >= wh && h01 >= wh && h11 >= wh) continue;
            const y = wh * SCALE;
            const x0 = j * CELL_M, x1 = (j + 1) * CELL_M, z0 = -i * CELL_M, z1 = -(i + 1) * CELL_M;
            const d00 = (wh - h00) * SCALE, d10 = (wh - h10) * SCALE, d01 = (wh - h01) * SCALE, d11 = (wh - h11) * SCALE;
            const u0 = (ox + j) * CELL_M, u1 = (ox + j + 1) * CELL_M, v0 = (oz + i) * CELL_M, v1 = (oz + i + 1) * CELL_M;
            pos.push(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z0, x1, y, z1, x0, y, z1);
            uv.push(u0, v0, u1, v0, u0, v1, u1, v0, u1, v1, u0, v1);
            dep.push(d00, d10, d01, d10, d11, d01);
          }
        }
      }
    }
    if (!pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('depth', new THREE.Float32BufferAttribute(dep, 1));
    const n = new Float32Array(pos.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.renderOrder = 2;
    mesh.name = `water_${rz}_${rx}`;
    return mesh;
  }
}
