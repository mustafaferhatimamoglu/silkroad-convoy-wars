import * as THREE from 'three';
import { CharacterLibrary } from '../chars/CharacterLibrary.js';

// Gelistirici gorunumu: donusturulmus karakterleri bir sirada gosterir, animasyonlari gezer.
// ?mode=chars&city=jangan[&keys=a,b,c]   Sol/sag ok: animasyon, fare: kamera, tekerlek: yakinlik

export class CharViewMode {
  constructor(app, at, keys = null) {
    this.app = app;
    this.at = at.clone();
    this.focus = at.clone();
    this.keys = keys;
    this.yaw = 0.35; this.pitch = 0.12; this.dist = 9;
    this.chars = [];
    this.animIndex = 0;
    this.lib = app.chars || (app.chars = new CharacterLibrary());
  }

  async enter() {
    const ix = await this.lib.index();
    const keys = this.keys || Object.keys(ix);
    let x = -((keys.length - 1) * 1.6) / 2;
    for (const k of keys) {
      try {
        const c = await this.lib.create(k);
        c.root.position.set(this.at.x + x, this.app.game ? this.app.game.groundTop(this.at.x + x, this.at.z) : this.at.y, this.at.z);
        c.root.rotation.y = 0;
        this.app.scene.add(c.root);
        c.play('idle') || c.play(Object.keys(c.type.clips)[0]);
        this.chars.push(c);
        x += Math.max(1.6, c.type.height * 0.8);
      } catch (e) { console.warn('karakter yuklenemedi', k, e); }
    }
    this.focus.set(this.at.x, this.at.y + 1.0, this.at.z);
  }

  /** Tum karakterlere ayni anahtarli animasyonu oynat (yoksa bekleme). */
  playAll(key) {
    for (const c of this.chars) c.play(key) || c.play('idle');
    this.animKey = key;
  }

  update(dt) {
    const { input, camera } = this.app;
    if (input.mouse.buttons & 3) {
      this.yaw -= input.mouse.dx * 0.005;
      this.pitch = THREE.MathUtils.clamp(this.pitch + input.mouse.dy * 0.004, -0.2, 1.3);
    }
    if (input.mouse.wheel) this.dist = THREE.MathUtils.clamp(this.dist * (input.mouse.wheel > 0 ? 1.1 : 0.9), 1.5, 40);
    const all = [...new Set(this.chars.flatMap((c) => Object.keys(c.type.clips)))];
    if (input.pressed('ArrowRight') || input.pressed('ArrowLeft')) {
      this.animIndex = (this.animIndex + (input.pressed('ArrowRight') ? 1 : all.length - 1)) % Math.max(1, all.length);
      this.playAll(all[this.animIndex]);
    }
    for (const c of this.chars) c.update(dt);
    const f = this.focus;
    camera.position.set(f.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, f.y + Math.sin(this.pitch) * this.dist, f.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    camera.lookAt(f);
  }

  dispose() { for (const c of this.chars) c.dispose(); this.chars = []; }
}
