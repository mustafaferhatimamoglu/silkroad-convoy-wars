import * as THREE from 'three';
import { DriveMode } from './DriveMode.js';
import { makeContacts } from '../world/Collision.js';

// Ralli: Hotan meydanindan Taklamakan'daki Lord Yarkan tapinagina kontrol noktali yaris.
// Kontrol noktalari V3 parkurundan alinmistir; her nokta calisma aninda en yakin
// surulebilir zemine (egimi az, su ve engel olmayan) otomatik oturtulur.

const ROUTE = [
  { name: 'Hotan Saray Kapısı', rx: 135, rz: 92, lx: 1136, lz: 1400 },
  { name: 'Hotan Kuzey Kapısı ve Köprü', rx: 135, rz: 93, lx: 960, lz: 800 },
  { name: 'Hotan Vahası Çıkışı', rx: 135, rz: 94, lx: 960, lz: 960 },
  { name: 'Karakoram Geçidi', rx: 135, rz: 95, lx: 960, lz: 960 },
  { name: 'Kanyon Köprüsü', rx: 135, rz: 96, lx: 960, lz: 960 },
  { name: 'Taklamakan Çöl Girişi', rx: 135, rz: 97, lx: 960, lz: 960 },
  { name: 'Niya Kalıntıları', rx: 135, rz: 99, lx: 960, lz: 960 },
  { name: 'Tapınak Önü Köprüsü', rx: 135, rz: 101, lx: 687, lz: 1553 },
  { name: 'Lord Yarkan Tapınağı', rx: 135, rz: 102, lx: 49, lz: 1145, finish: true },
];
const START = { rx: 135, rz: 92, lx: 1136, lz: 680, yaw: 0 };
const RADIUS = 18;

function fmt(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

export class RallyMode extends DriveMode {
  static startPosition(world) {
    return world.toThree(START.rx, START.rz, START.lx, 0, START.lz, new THREE.Vector3());
  }

  constructor(app, opts = {}) {
    const p = RallyMode.startPosition(app.world);
    super(app, { ...opts, x: p.x, z: p.z, yaw: START.yaw, city: 'hotan' });
    this.onFinish = opts.onFinish;
    this.teleportable = false;
    this.cpIndex = 0;
    this.time = 0;
    this.state = 'countdown';
    this.countdown = 3.5;
    this.splits = [];
  }

  enter() {
    super.enter();
    const app = this.app;
    this.cps = ROUTE.map((c) => ({ ...c, pos: app.world.toThree(c.rx, c.rz, c.lx, 0, c.lz, new THREE.Vector3()), placed: false }));
    this.gates = new THREE.Group();
    app.scene.add(this.gates);
    this._buildGateAssets();
    this.ui = document.createElement('div');
    this.ui.id = 'race';
    this.ui.className = 'panel';
    this.ui.innerHTML = '<div class="t">00:00.00</div><div class="cp"></div><div class="bar"><div></div></div><div class="arrow" style="font-size:26px;line-height:1;margin-top:4px;color:var(--gold)">▲</div>';
    this.hud.root.appendChild(this.ui);
    this.big = document.createElement('div');
    this.big.style.cssText = 'position:absolute;top:32%;left:50%;transform:translate(-50%,-50%);font:800 96px Georgia,serif;color:#ffd36b;text-shadow:0 6px 30px rgba(0,0,0,.7);pointer-events:none';
    this.hud.root.appendChild(this.big);
    this.hud.toast('Ralli: Hotan → Lord Yarkan Tapınağı', 3);
    this.best = app.settings.get('rallyBest');
  }

  _buildGateAssets() {
    // isik sutunu (uzaktan gorunur) + iki bayrak diregi
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(1.6, 1.05, 0.35) }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * 0.9 * (0.8 + 0.2 * sin(uTime * 3.0 + vUv.y * 12.0)); a *= smoothstep(0.0, 0.25, min(vUv.x, 1.0 - vUv.x) * 4.0); gl_FragColor = vec4(uColor * a, a); }',
    });
    this.beamMat = beamMat;
    this.beamGeo = new THREE.CylinderGeometry(RADIUS * 0.55, RADIUS * 0.55, 140, 32, 1, true);
    this.beamGeo.translate(0, 70, 0);
    this.poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 7, 10);
    this.poleGeo.translate(0, 3.5, 0);
    this.poleMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.8 });
    this.flagMat = new THREE.MeshStandardMaterial({ color: 0xc8962e, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x332000 });
  }

  _placeCheckpoint(cp) {
    // V3 noktasi cevresinde surulebilir en yakin yeri ara (spiral)
    const w = this.app.world, col = this.app.collision;
    const contacts = makeContacts(6);
    const n = new THREE.Vector3();
    const ok = (x, z) => {
      const h = w.heightAt(x, z);
      if (h === null) return null;
      w.normalAt(x, z, n);
      if (n.y < 0.93) return null;
      const water = w.waterAt(x, z);
      if (water !== null && water > h - 0.2) return null;
      const top = new THREE.Vector3(x, h + 1.2, z);
      const cnt = col.sphereContacts(top, 2.5, contacts, 6);
      for (let i = 0; i < cnt; i++) if (contacts[i].object) return null;
      return h;
    };
    for (let r = 0; r <= 160; r += 8) {
      const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 8);
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const x = cp.pos.x + Math.cos(a) * r, z = cp.pos.z + Math.sin(a) * r;
        const h = ok(x, z);
        if (h !== null) { cp.pos.set(x, h, z); cp.placed = true; return true; }
      }
    }
    const h = w.heightAt(cp.pos.x, cp.pos.z);
    if (h !== null) { cp.pos.y = h; cp.placed = true; }
    return cp.placed;
  }

  _showGate(cp) {
    this.gates.clear();
    if (!cp) return;
    const g = new THREE.Group();
    g.position.copy(cp.pos);
    const beam = new THREE.Mesh(this.beamGeo, this.beamMat);
    beam.renderOrder = 9;
    g.add(beam);
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(this.poleGeo, this.poleMat);
      pole.position.set(s * RADIUS * 0.55, 0, 0); pole.castShadow = true;
      g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), this.flagMat);
      flag.position.set(s * RADIUS * 0.55 + s * 0.85, 6.3, 0);
      g.add(flag);
    }
    this.gates.add(g);
    this.gateGroup = g;
  }

  update(dt) {
    const v = this.vehicle;
    if (this.paused) { super.update(dt); return; }
    // yakindaki kontrol noktasini yerlestir (bolge yuklendiginde)
    const cp = this.cps[this.cpIndex];
    if (cp && !cp.placed && this.app.world.isLoadedAt(cp.pos.x, cp.pos.z)) { this._placeCheckpoint(cp); this._showGate(cp); }
    if (this.beamMat) this.beamMat.uniforms.uTime.value += dt;
    if (this.gateGroup && cp) this.gateGroup.lookAt(v.position.x, this.gateGroup.position.y, v.position.z);

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.5);
      this.big.textContent = n > 0 ? String(n) : 'BAŞLA!';
      // geri sayimda arac frenli bekler
      const keep = this.ctl;
      super.update(dt);
      v.sim.body.vel.x *= 0.5; v.sim.body.vel.z *= 0.5;
      void keep;
      if (this.countdown <= 0) { this.state = 'run'; setTimeout(() => { if (this.big) this.big.textContent = ''; }, 700); }
      this._hud(cp);
      return;
    }
    super.update(dt);
    if (this.state === 'run') {
      this.time += dt;
      if (cp && cp.placed) {
        const d = Math.hypot(v.position.x - cp.pos.x, v.position.z - cp.pos.z);
        if (d < RADIUS) {
          this.splits.push(this.time);
          this.hud.toast(`${this.cpIndex + 1}. ${cp.name} — ${fmt(this.time)}`, 2);
          this.cpIndex++;
          if (this.cpIndex >= this.cps.length) this._finish();
          else this._showGate(this.cps[this.cpIndex].placed ? this.cps[this.cpIndex] : null);
        }
      }
    }
    this._hud(this.cps[this.cpIndex]);
  }

  _hud(cp) {
    if (!this.ui) return;
    const v = this.vehicle;
    this.ui.querySelector('.t').textContent = fmt(this.time);
    const total = this.cps.length;
    if (cp) {
      const d = Math.hypot(v.position.x - cp.pos.x, v.position.z - cp.pos.z);
      this.ui.querySelector('.cp').textContent = `${this.cpIndex + 1}/${total} · ${cp.name} · ${d < 1000 ? `${d.toFixed(0)} m` : `${(d / 1000).toFixed(2)} km`}${this.best ? ` · en iyi ${fmt(this.best)}` : ''}`;
      const heading = Math.atan2(-v.forward.x, -v.forward.z);
      const target = Math.atan2(-(cp.pos.x - v.position.x), -(cp.pos.z - v.position.z));
      let rel = target - heading; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      this.ui.querySelector('.arrow').style.transform = `rotate(${-rel}rad)`;
    }
    this.ui.querySelector('.bar > div').style.width = `${(this.cpIndex / total) * 100}%`;
  }

  _finish() {
    this.state = 'done';
    this.gates.clear();
    const best = this.best;
    const isBest = !best || this.time < best;
    if (this.onFinish) this.onFinish({ finished: true, time: this.time, splits: this.splits });
    this.best = isBest ? this.time : best;
    const el = document.createElement('div');
    el.className = 'panel dialog interactive';
    el.innerHTML = `<h2>Ralli tamamlandı!</h2>
      <div style="font:700 42px Consolas,monospace;color:#fff;margin:6px 0">${fmt(this.time)}</div>
      <div style="color:var(--muted);margin-bottom:10px">${isBest ? 'Yeni en iyi süre!' : `En iyi: ${fmt(best)}`}</div>
      <div style="font-size:13px;line-height:1.7;color:var(--text)">${this.splits.map((t, i) => `${i + 1}. ${this.cps[i].name}: ${fmt(t)}`).join('<br>')}</div>
      <div class="row" style="margin-top:14px"><button class="btn" data-a="again" style="width:auto">Tekrar dene</button><button class="btn secondary" data-a="main" style="width:auto">Ana menü</button></div>`;
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      el.remove();
      if (a.dataset.a === 'again') window.game.startRally();
      else window.game.showMainMenu();
    });
    this.app.ui.appendChild(el);
    this.resultEl = el;
  }

  dispose() {
    this.app.scene.remove(this.gates);
    if (this.resultEl) this.resultEl.remove();
    super.dispose();
  }
}
