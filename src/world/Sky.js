import * as THREE from 'three';

// Gokyuzu + gunes + sis + ortam (IBL) haritasi.
// Sis rengi gokyuzunun ufuk rengiyle birebir aynidir; uzak arazi ufka dikissiz karisir.
// Gunun saati (0-24) gunes yonunu, renkleri ve isik siddetini belirler.

const PALETTE = [
  // saat, zenit, ufuk, gunes rengi, gunes siddeti, ortam siddeti
  { t: 0.0, zenith: [0.01, 0.015, 0.04], horizon: [0.035, 0.045, 0.08], sun: [0.35, 0.45, 0.8], sunI: 0.18, amb: 0.12 },
  { t: 5.0, zenith: [0.03, 0.05, 0.12], horizon: [0.12, 0.10, 0.14], sun: [0.4, 0.45, 0.7], sunI: 0.2, amb: 0.18 },
  { t: 6.2, zenith: [0.18, 0.28, 0.48], horizon: [0.93, 0.56, 0.36], sun: [1.0, 0.55, 0.3], sunI: 1.4, amb: 0.45 },
  { t: 8.0, zenith: [0.22, 0.42, 0.72], horizon: [0.78, 0.80, 0.82], sun: [1.0, 0.86, 0.68], sunI: 2.6, amb: 0.8 },
  { t: 12.0, zenith: [0.20, 0.42, 0.78], horizon: [0.74, 0.82, 0.90], sun: [1.0, 0.97, 0.92], sunI: 3.2, amb: 1.0 },
  { t: 16.0, zenith: [0.21, 0.40, 0.72], horizon: [0.80, 0.80, 0.80], sun: [1.0, 0.90, 0.75], sunI: 2.8, amb: 0.9 },
  { t: 18.2, zenith: [0.16, 0.24, 0.46], horizon: [0.96, 0.52, 0.30], sun: [1.0, 0.50, 0.25], sunI: 1.3, amb: 0.45 },
  { t: 19.6, zenith: [0.04, 0.06, 0.15], horizon: [0.18, 0.13, 0.18], sun: [0.45, 0.45, 0.7], sunI: 0.25, amb: 0.2 },
  { t: 24.0, zenith: [0.01, 0.015, 0.04], horizon: [0.035, 0.045, 0.08], sun: [0.35, 0.45, 0.8], sunI: 0.18, amb: 0.12 },
];

function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function samplePalette(hour) {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < PALETTE.length - 1; i++) {
    const a = PALETTE[i], b = PALETTE[i + 1];
    if (h >= a.t && h <= b.t) {
      const t = (h - a.t) / (b.t - a.t);
      const s = t * t * (3 - 2 * t);
      return {
        zenith: lerp3(a.zenith, b.zenith, s), horizon: lerp3(a.horizon, b.horizon, s), sun: lerp3(a.sun, b.sun, s),
        sunI: a.sunI + (b.sunI - a.sunI) * s, amb: a.amb + (b.amb - a.amb) * s,
      };
    }
  }
  return PALETTE[0];
}

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */`
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uCloud;
uniform float uNight;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col;
  if (h >= 0.0) {
    col = mix(uHorizon, uZenith, pow(h, 0.45));
  } else {
    col = mix(uHorizon, uGround, smoothstep(0.0, 0.25, -h));
  }
  float sd = max(dot(d, uSunDir), 0.0);
  // gunes parlamasi ve disk
  col += uSunColor * (pow(sd, 8.0) * 0.18 + pow(sd, 64.0) * 0.35);
  col += uSunColor * smoothstep(0.99955, 0.99975, sd) * 6.0;
  // bulutlar
  if (h > 0.0 && uCloud > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(uTime * 0.004, uTime * 0.0015);
    float c = fbm(uv * 1.6);
    c = smoothstep(0.52 - uCloud * 0.25, 0.85, c) * smoothstep(0.0, 0.18, h);
    vec3 cloudCol = mix(uHorizon * 1.05, vec3(1.0) * (0.55 + 0.45 * uSunColor), 0.6) * (1.0 - uNight * 0.8);
    cloudCol += uSunColor * pow(sd, 6.0) * 0.4;
    col = mix(col, cloudCol, c * 0.85);
  }
  // yildizlar
  if (uNight > 0.0 && h > 0.0) {
    vec2 sp = d.xz / (h + 0.3) * 220.0;
    float st = step(0.9975, hash(floor(sp))) * smoothstep(0.0, 0.25, h);
    col += vec3(st) * uNight * 0.9;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SkySystem {
  constructor(renderer, scene, { shadowMapSize = 4096, shadowExtent = 70 } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.hour = 15.5;
    this.cloudiness = 0.45;

    this.uniforms = {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color(0.32, 0.27, 0.21) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uTime: { value: 0 },
      uCloud: { value: this.cloudiness },
      uNight: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(1, 48, 24);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    this.dome = new THREE.Mesh(geo, this.skyMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    this.dome.scale.setScalar(1000);
    scene.add(this.dome);

    this.fog = new THREE.Fog(0xbfd4e6, 250, 1400);
    scene.fog = this.fog;

    // Gunes
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    const c = this.sun.shadow.camera;
    c.left = -shadowExtent; c.right = shadowExtent; c.top = shadowExtent; c.bottom = -shadowExtent;
    c.near = 1; c.far = 900;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.04;
    this.shadowExtent = shadowExtent;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Gece icin zayif mavi dolgu (ay isigi) - ortam haritasina ek olarak
    this.moon = new THREE.DirectionalLight(0x8899cc, 0);
    scene.add(this.moon);

    // Ortam haritasi (IBL): sadece gokyuzunu iceren sahneden uretilir
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(geo, this.skyMat);
    this.envDome.scale.setScalar(100);
    this.envScene.add(this.envDome);
    this.envRT = null;
    this._envHour = -99;
    this.sunDir = new THREE.Vector3();
    this.setHour(this.hour, true);
  }

  setHour(hour, forceEnv = false) {
    this.hour = ((hour % 24) + 24) % 24;
    const p = samplePalette(this.hour);
    // gunes yonu: 6'da dogu ufku, 12'de tepede (biraz guneye egik), 18'de bati
    const ang = ((this.hour - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    this.sunDir.set(Math.cos(ang), Math.max(elev, -0.3) * 0.92 + 0.08, 0.35).normalize();
    const night = THREE.MathUtils.clamp(1 - (this.sunDir.y + 0.05) / 0.25, 0, 1);
    this.uniforms.uSunDir.value.copy(this.sunDir);
    this.uniforms.uZenith.value.setRGB(...p.zenith);
    this.uniforms.uHorizon.value.setRGB(...p.horizon);
    this.uniforms.uSunColor.value.setRGB(...p.sun);
    this.uniforms.uNight.value = night;
    this.fog.color.setRGB(...p.horizon);
    this.uniforms.uGround.value.setRGB(p.horizon[0] * 0.45, p.horizon[1] * 0.4, p.horizon[2] * 0.35);
    const sunUp = this.sunDir.y > 0.02;
    this.sun.color.setRGB(...p.sun);
    this.sun.intensity = sunUp ? p.sunI : 0;
    this.moon.intensity = sunUp ? 0 : 0.35;
    this.moon.position.set(-0.3, 1, 0.4);
    this.ambient = p.amb;
    this.scene.environmentIntensity = p.amb;
    this.night = night;
    if (forceEnv || Math.abs(this.hour - this._envHour) > 0.25) this._updateEnv();
  }

  _updateEnv() {
    this._envHour = this.hour;
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
    this.scene.environment = this.envRT.texture;
    if (old) old.dispose();
  }

  /** Gunesi ve golge kamerasini odak noktasina gore konumlar (texel'e kilitli -> titreme yok). */
  update(dt, camera, focus) {
    this.uniforms.uTime.value += dt;
    this.dome.position.copy(camera.position);
    const ext = this.shadowExtent;
    const texel = (ext * 2) / this.sun.shadow.mapSize.x;
    // odak noktasini isik uzayinda texel boyutuna yuvarla
    const L = this.sunDir;
    const up = Math.abs(L.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, L).normalize();
    const up2 = new THREE.Vector3().crossVectors(L, right).normalize();
    const fx = Math.round(focus.dot(right) / texel) * texel;
    const fy = Math.round(focus.dot(up2) / texel) * texel;
    const fz = focus.dot(L);
    const snapped = new THREE.Vector3().addScaledVector(right, fx).addScaledVector(up2, fy).addScaledVector(L, fz);
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(L, 450);
    this.sun.target.updateMatrixWorld();
  }

  setCloudiness(v) { this.cloudiness = v; this.uniforms.uCloud.value = v; }
}
