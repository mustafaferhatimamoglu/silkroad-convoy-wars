import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './Input.js';
import { Settings } from './Settings.js';
import { World } from '../world/World.js';
import { Collision } from '../world/Collision.js';
import { SkySystem } from '../world/Sky.js';

// Uygulama cekirdegi: renderer, sahne, kamera, dunya ve oyun dongusu.
// Oyun modlari (surus, gezgin, ralli...) setMode ile degisir; her mod
// update(dt) ve dispose() saglar.

export class App {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.ui = uiRoot;
    this.settings = new Settings();
    this.mode = null;
    this.time = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.listeners = { frame: new Set() };
  }

  async init(onProgress = () => {}) {
    const q = this.settings.quality;
    onProgress(0.05, 'Grafik motoru hazırlanıyor…');
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: false, powerPreference: 'high-performance',
      reversedDepthBuffer: true, stencil: false,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio * devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2600);
    this.camera.position.set(0, 60, 0);
    this.scene.add(this.camera);

    this.input = new Input(this.canvas);
    this.canvas.tabIndex = 0;

    onProgress(0.1, 'Gökyüzü ve ışık…');
    this.sky = new SkySystem(renderer, this.scene, { shadowMapSize: q.shadowMap, shadowExtent: q.shadowExtent });
    this.sky.setHour(this.settings.get('hour'), true);

    onProgress(0.15, 'Silkroad dünya haritası okunuyor…');
    this.world = new World(renderer, this.scene, {
      nearRadius: q.nearRadius, farRadius: q.farRadius, tileSize: q.tileSize, objTexSize: q.objTex,
    });
    await this.world.init();
    this.collision = new Collision(this.world);
    this.camera.far = (q.farRadius + 1.5) * 192;
    this.sky.fog.far = q.farRadius * 192 * 0.95;
    this.sky.fog.near = Math.min(260, this.sky.fog.far * 0.25);
    this.camera.updateProjectionMatrix();

    this._setupComposer();
    addEventListener('resize', () => this.resize());
    this.resize();
    onProgress(0.2, 'Dünya hazır.');
  }

  _setupComposer() {
    const q = this.settings.quality;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.45, 0.92);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  }

  setMode(mode) {
    if (this.mode && this.mode.dispose) this.mode.dispose();
    this.mode = mode;
    if (mode && mode.enter) mode.enter();
  }

  start() {
    this.last = performance.now();
    this._fpsT = this.last; this._fpsN = 0;
    const loop = (now) => {
      requestAnimationFrame(loop);
      this.frame(now);
    };
    requestAnimationFrame(loop);
  }

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;
    this.input.poll();
    try {
      if (this.mode) this.mode.update(dt);
      const focus = (this.mode && this.mode.focus) || this.camera.position;
      this.world.update(focus, dt);
      if (this.settings.get('timeFlow')) this.sky.setHour(this.sky.hour + dt / 60);
      this.sky.update(dt, this.camera, focus);
      for (const fn of this.listeners.frame) fn(dt);
      this.composer.render(dt);
    } catch (e) {
      console.error(e);
      this.lastError = e;
    }
    this.input.endFrame();
    this._fpsN++;
    if (now - this._fpsT > 500) { this.fps = (this._fpsN * 1000) / (now - this._fpsT); this._fpsN = 0; this._fpsT = now; }
  }

  onFrame(fn) { this.listeners.frame.add(fn); return () => this.listeners.frame.delete(fn); }
}
