import * as THREE from 'three';

// Arac icin dinamik ortam yansimasi: aracin konumunda bir kup kamera cevredeki binalari,
// zemini ve gokyuzunu kup haritaya cizer (her karede 1 yuz, 6 karede bir tam tur), sonra
// PMREM ile puruzluluk seviyelerine suzulur. Boya, krom ve cam bu haritayi yansitir.

export class VehicleReflections {
  constructor(app, { size = 128 } = {}) {
    this.app = app;
    this.rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.cam = new THREE.CubeCamera(0.4, 350, this.rt);
    this.pmrem = new THREE.PMREMGenerator(app.renderer);
    this.envRT = null;
    this.face = 0;
    this.materials = [];
    this.hidden = [];
    this.enabled = true;
  }

  /** Bu malzemeler dinamik haritayi kullanir. */
  track(materials) { this.materials = materials; }

  update(position, hideObjects) {
    if (!this.enabled) return;
    const { renderer, scene } = this.app;
    const cam = this.cam;
    if (cam.coordinateSystem !== renderer.coordinateSystem) {
      cam.coordinateSystem = renderer.coordinateSystem;
      cam.updateCoordinateSystem();
    }
    cam.position.copy(position);
    cam.updateMatrixWorld(true);
    for (const o of hideObjects) { o.userData._v = o.visible; o.visible = false; }
    const prevRT = renderer.getRenderTarget();
    const prevXr = renderer.xr.enabled;
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false; // golge haritasi bu karede zaten cizildi
    const cams = cam.children;
    renderer.setRenderTarget(this.rt, this.face);
    renderer.render(scene, cams[this.face]);
    renderer.setRenderTarget(prevRT);
    renderer.xr.enabled = prevXr;
    renderer.shadowMap.autoUpdate = prevShadow;
    for (const o of hideObjects) o.visible = o.userData._v;
    this.face = (this.face + 1) % 6;
    if (this.face === 0) {
      this.envRT = this.pmrem.fromCubemap(this.rt.texture, this.envRT);
      for (const m of this.materials) {
        if (m.envMap !== this.envRT.texture) { m.envMap = this.envRT.texture; m.needsUpdate = true; }
      }
    }
  }

  dispose() {
    this.rt.dispose();
    if (this.envRT) this.envRT.dispose();
    this.pmrem.dispose();
  }
}
