import * as THREE from 'three';
import { DriveMode } from './DriveMode.js';
import { RALLY_STAGES } from '../data/rally.js';
import { canvasTexture } from '../vehicle/model/carkit.js';

// Ralli: etap verisindeki rota (src/data/rally.js) boyunca kontrol noktali zamana karsi yaris.
// Rota, oyunun carpisma sistemiyle taranip arac icin planlandi; kapilar yolun tam ustunde,
// yola dik durur. Gecis: kapi cizgisini (12 m genislik) kesmek ya da kapiya 11 m yaklasmak.
// Siradaki kapi isik sutunuyla, ondan sonraki sonuk direklerle gorunur; mini haritada rota.
// Pilot notlari (etap verisinde, rotadan uretildi): yaklasan viraj yonu/siddeti (1 keskin .. 6 hafif,
// firkete), tumsek / sicrama / cukur - ralli usulu, siradaki iki not mesafesiyle gosterilir.

const GATE_W = 13;
const PASS_R = 11;

const NOTE_TEXT = { C: '⌒ TÜMSEK', J: '⚠ SIÇRAMA', D: '◡ ÇUKUR' };

function noteText(n) {
  if (NOTE_TEXT[n.k]) return NOTE_TEXT[n.k];
  const left = n.k === 'L';
  return `${left ? '↰ SOL' : 'SAĞ ↱'} ${n.g === 0 ? 'FİRKETE' : n.g}${n.long ? ' uzun' : ''}`;
}

function fmt(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

/** Kesirli bolge koordinati -> Three.js konumu. */
function regionToThree(world, rx, rz, out = new THREE.Vector3()) {
  const ix = Math.floor(rx), iz = Math.floor(rz);
  return world.toThree(ix, iz, (rx - ix) * 1920, 0, (rz - iz) * 1920, out);
}

export class RallyMode extends DriveMode {
  static stage(id = 'hotan') { return RALLY_STAGES[id] || RALLY_STAGES.hotan; }

  /** Baslangic konumu ve yonu (yol basinda, yolun yonune bakar). */
  static startPosition(world, id) {
    const st = RallyMode.stage(id);
    const p0 = regionToThree(world, st.path[0][0], st.path[0][1]);
    const p1 = regionToThree(world, st.path[4][0], st.path[4][1]);
    p0.yaw = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
    return p0;
  }

  constructor(app, opts = {}) {
    const st = RallyMode.stage(opts.stage);
    const p = RallyMode.startPosition(app.world, opts.stage);
    super(app, { ...opts, x: p.x, z: p.z, yaw: p.yaw, city: 'hotan' });
    this.st = st;
    this.stageId = opts.stage || 'hotan';
    this.onFinish = opts.onFinish;
    this.teleportable = false;
    this.cpIndex = 0;
    this.time = 0;
    this.state = 'countdown';
    this.countdown = 3.5;
    this.splits = [];
    this.autopilot = null;   // test araci kontrol saglayabilir
  }

  enter() {
    super.enter();
    const app = this.app, st = this.st;
    // rota noktalari (Three.js)
    this.pts = st.path.map(([rx, rz]) => regionToThree(app.world, rx, rz));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].z - this.pts[i - 1].z));
    this.routeIdx = 0;
    this.notes = st.notes || [];
    this.cps = st.cps.map((c) => {
      const i = c.i, a = this.pts[Math.max(0, i - 2)], b = this.pts[Math.min(this.pts.length - 1, i + 2)];
      const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
      return { ...c, pos: this.pts[i].clone(), dir, placed: false, group: null };
    });
    this.cps.forEach((cp, k) => { cp.idx = k; cp.n = k + 1; });
    this.gates = new THREE.Group();
    app.scene.add(this.gates);
    this._buildGateAssets();
    this.ui = document.createElement('div');
    this.ui.id = 'race';
    this.ui.className = 'panel';
    this.ui.innerHTML = '<div class="t">00:00.00</div><div class="cp"></div><div class="bar"><div></div></div><div class="arrow" style="font-size:26px;line-height:1;margin-top:4px;color:var(--gold)">▲</div><div class="notes"><div class="n1"></div><div class="n2"></div></div>';
    this.hud.root.appendChild(this.ui);
    if (this.hud.toastEl) this.hud.toastEl.style.top = 'max(18%, 184px)';   // ralli paneli (notlar) altinda kalsin
    this.big = document.createElement('div');
    this.big.style.cssText = 'position:absolute;top:32%;left:50%;transform:translate(-50%,-50%);font:800 96px Georgia,serif;color:#ffd36b;text-shadow:0 6px 30px rgba(0,0,0,.7);pointer-events:none';
    this.hud.root.appendChild(this.big);
    this.hud.toast(`${st.name} · ${(st.length / 1000).toFixed(1)} km`, 3.5);
    this.best = app.settings.get(`rallyBest_${this.stageId}`);
    this.hud.route = { pts: this.pts, cps: this.cps, next: 0 };
    this.startGate = { pos: this.pts[1].clone(), dir: new THREE.Vector3(this.pts[3].x - this.pts[0].x, 0, this.pts[3].z - this.pts[0].z).normalize(), placed: false, label: 'START' };
  }

  _buildGateAssets() {
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(1.6, 1.05, 0.35) }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * 0.8 * (0.8 + 0.2 * sin(uTime * 3.0 + vUv.y * 12.0)); a *= smoothstep(0.0, 0.25, min(vUv.x, 1.0 - vUv.x) * 4.0); gl_FragColor = vec4(uColor * a, a); }',
    });
    this.beamMat = beamMat;
    this.beamGeo = new THREE.CylinderGeometry(GATE_W * 0.5, GATE_W * 0.5, 120, 32, 1, true);
    this.beamGeo.translate(0, 60, 0);
    this.poleGeo = new THREE.CylinderGeometry(0.13, 0.17, 6.2, 10);
    this.poleGeo.translate(0, 3.1, 0);
    this.poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 });
    this.bannerTex = (text, check = false) => canvasTexture(512, 96, (ctx, w, h) => {
      if (check) {
        for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; ctx.fillRect(x * 32, y * 48, 32, 48); }
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(140, 14, 232, 68);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#b8262a'); g.addColorStop(1, '#7c1418');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(0, 0, w, 6); ctx.fillRect(0, h - 6, w, 6);
      }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 54px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2 + 2);
    });
  }

  /** Kapinin direk konumlari yerine oturtulur (bolge yuklenince). */
  _placeGate(cp, { beam = false, dim = false, label = null } = {}) {
    const w = this.app.world, col = this.app.collision;
    if (!w.isLoadedAt(cp.pos.x, cp.pos.z)) return null;
    const hit = { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), object: false, surface: 0 };
    const down = new THREE.Vector3(0, -1, 0);
    const ground = (x, z) => {
      const h = w.heightAt(x, z);
      if (col.raycast(new THREE.Vector3(x, (h ?? 0) + 30, z), down, 80, hit)) return hit.point.y;
      return h ?? 0;
    };
    const g = new THREE.Group();
    const perp = new THREE.Vector3(-cp.dir.z, 0, cp.dir.x);
    const y0 = ground(cp.pos.x, cp.pos.z);
    cp.pos.y = y0;
    g.position.copy(cp.pos);
    const posts = [];
    for (const s of [-1, 1]) {
      const px = cp.pos.x + perp.x * s * GATE_W * 0.5, pz = cp.pos.z + perp.z * s * GATE_W * 0.5;
      const pole = new THREE.Mesh(this.poleGeo, this.poleMat);
      pole.position.set(px - cp.pos.x, ground(px, pz) - y0, pz - cp.pos.z);
      pole.castShadow = true;
      g.add(pole);
      posts.push(pole.position.clone());
    }
    // pankart: iki direk arasinda
    const mid = posts[0].clone().add(posts[1]).multiplyScalar(0.5);
    const len = posts[0].distanceTo(posts[1]);
    const text = label || `${cp.n}. ${cp.name}`;
    const mat = new THREE.MeshStandardMaterial({ map: this.bannerTex(text, label === 'FİNİŞ'), roughness: 0.8, side: THREE.DoubleSide, transparent: dim, opacity: dim ? 0.55 : 1 });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.25), mat);
    banner.position.set(mid.x, Math.max(posts[0].y, posts[1].y) + 5.3, mid.z);
    banner.rotation.y = Math.atan2(cp.dir.x, cp.dir.z);
    g.add(banner);
    if (beam) {
      const b = new THREE.Mesh(this.beamGeo, this.beamMat);
      b.renderOrder = 9;
      g.add(b);
    }
    this.gates.add(g);
    return g;
  }

  _refreshGates() {
    for (const cp of this.cps) if (cp.group && (cp.idx < this.cpIndex || cp.idx > this.cpIndex + 1)) { this.gates.remove(cp.group); cp.group = null; cp.kind = null; }
    for (let k = this.cpIndex; k <= Math.min(this.cps.length - 1, this.cpIndex + 1); k++) {
      const cp = this.cps[k];
      const kind = k === this.cpIndex ? 'cur' : 'next';
      if (cp.group && cp.kind === kind) continue;
      if (cp.group) { this.gates.remove(cp.group); cp.group = null; }
      const last = k === this.cps.length - 1;
      const g = this._placeGate(cp, { beam: kind === 'cur', dim: kind === 'next', label: last ? 'FİNİŞ' : null });
      if (g) { cp.group = g; cp.kind = kind; }
    }
    if (this.startGate && !this.startGate.group && this.state !== 'done') {
      const g = this._placeGate(this.startGate, { label: 'START' });
      if (g) this.startGate.group = g;
    }
  }

  update(dt) {
    const v = this.vehicle;
    if (this.paused) { super.update(dt); return; }
    this._refreshGates();
    if (this.beamMat) this.beamMat.uniforms.uTime.value += dt;
    const cp = this.cps[this.cpIndex];

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.5);
      this.big.textContent = n > 0 ? String(n) : 'BAŞLA!';
      super.update(dt);
      v.sim.body.vel.x *= 0.5; v.sim.body.vel.z *= 0.5;
      if (this.countdown <= 0) { this.state = 'run'; setTimeout(() => { if (this.big) this.big.textContent = ''; }, 700); }
      this._hud(cp);
      return;
    }
    const prev = this._prevPos || (this._prevPos = v.position.clone());
    super.update(dt);
    this._trackRoute();
    if (this.state === 'run') {
      this.time += dt;
      if (cp && this._passed(cp, prev, v.position)) {
        this.splits.push(this.time);
        this.hud.toast(`${this.cpIndex + 1}. ${cp.name} — ${fmt(this.time)}`, 2);
        this.cpIndex++;
        this.hud.route.next = this.cpIndex;
        if (this.cpIndex >= this.cps.length) this._finish();
      }
    }
    prev.copy(v.position);
    this._hud(this.cps[this.cpIndex]);
  }

  /** Aracin rotadaki yeri (en yakin yol noktasi, ileri pencerede aranir). */
  _trackRoute() {
    const p = this.vehicle.position, pts = this.pts;
    let best = Infinity, bi = this.routeIdx;
    for (let i = Math.max(0, this.routeIdx - 6); i < Math.min(pts.length, this.routeIdx + 40); i++) {
      const d = (pts[i].x - p.x) ** 2 + (pts[i].z - p.z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    this.routeIdx = bi;
  }

  /** Kapi gecisi: kapi cizgisini kesme (genislik icinde) ya da yakin gecis. */
  _passed(cp, a, b) {
    const dx = b.x - cp.pos.x, dz = b.z - cp.pos.z;
    if (Math.hypot(dx, dz) < PASS_R) return true;
    const sa = (a.x - cp.pos.x) * cp.dir.x + (a.z - cp.pos.z) * cp.dir.z;
    const sb = dx * cp.dir.x + dz * cp.dir.z;
    if (sa < 0 && sb >= 0) {
      const lat = Math.abs(dx * -cp.dir.z + dz * cp.dir.x);
      return lat < GATE_W * 0.75;
    }
    return false;
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
    // pilot notlari: siradaki iki not (300 m icinde)
    const up = [];
    for (const n of this.notes) {
      if (n.i < this.routeIdx) continue;
      const d = this.cum[n.i] - this.cum[this.routeIdx];
      if (d > 300 || up.length >= 2) break;
      up.push({ n, d });
    }
    const n1 = this.ui.querySelector('.n1'), n2 = this.ui.querySelector('.n2');
    const t1 = up[0] ? `${noteText(up[0].n)} <span>${Math.max(0, Math.round(up[0].d / 10) * 10)} m</span>` : '';
    if (n1.innerHTML !== t1) n1.innerHTML = t1;
    n1.classList.toggle('near', !!up[0] && up[0].d < 60);
    const t2 = up[1] ? `sonra ${noteText(up[1].n)}` : '';
    if (n2.textContent !== t2) n2.textContent = t2;
  }

  _finish() {
    this.state = 'done';
    const best = this.best;
    const isBest = !best || this.time < best;
    if (isBest) this.app.settings.set(`rallyBest_${this.stageId}`, this.time);
    if (this.onFinish) this.onFinish({ finished: true, time: this.time, splits: this.splits, stage: this.stageId });
    this.best = isBest ? this.time : best;
    const el = document.createElement('div');
    el.className = 'panel dialog interactive';
    el.innerHTML = `<h2>${this.st.name}</h2>
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

  /** R: araci duzelt; 4 sn icinde tekrar basilirsa rotaya (siradaki kapidan once, en yakin yol noktasina) don. */
  _recover() {
    const now = performance.now();
    const again = this._recT && now - this._recT < 4000;
    this._recT = now;
    if (!again || this.state === 'done') {
      const how = this.vehicle.recover();
      this.camera.initialized = false;
      this.hud.toast(how === 'safe' ? 'Son güvenli noktaya dönüldü' : 'Araç düzeltildi (tekrar R: rotaya dön)', 1.6);
      return;
    }
    this.toRoute();
    this.hud.toast('Rotaya dönüldü', 1.6);
  }

  /** Araci rota cizgisine koyar: gecilen son kapi ile siradaki kapi arasindaki en yakin nokta. */
  toRoute() {
    const v = this.vehicle, p = v.position, pts = this.pts, w = this.app.world;
    const lo = this.cpIndex > 0 ? this.cps[this.cpIndex - 1].i : 0;
    const hi = this.cpIndex < this.cps.length ? this.cps[this.cpIndex].i : pts.length - 1;
    let best = Infinity, bi = lo;
    for (let i = lo; i <= hi; i++) {
      const d = (pts[i].x - p.x) ** 2 + (pts[i].z - p.z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    bi = Math.min(bi, pts.length - 3);
    const a = pts[bi], b = pts[bi + 2];
    const yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
    // zemin: yukaridan isin; agac tepesi gibi egik bir yuzeye denk gelirse daha alcaktan tekrar
    const h = w.heightAt(a.x, a.z) ?? a.y ?? 0;
    const hit = { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), object: false, surface: 0 };
    const down = new THREE.Vector3(0, -1, 0);
    let y = h;
    if (this.app.collision.raycast(new THREE.Vector3(a.x, h + 30, a.z), down, 80, hit)) {
      y = hit.point.y;
      if (y > h + 3 && hit.normal.y < 0.9 && this.app.collision.raycast(new THREE.Vector3(a.x, h + 2.5, a.z), down, 10, hit)) y = hit.point.y;
    }
    v.spawn(a.x, a.z, yaw, y, 0.6);
    this.routeIdx = bi;
    this._prevPos = null;   // isinlanma bir kapi cizgisini "gecmis" sayilmasin
    this.camera.initialized = false;
  }

  _readControls(dt) {
    if (this.autopilot) return this.autopilot(dt, this);
    return super._readControls(dt);
  }

  dispose() {
    this.app.scene.remove(this.gates);
    if (this.resultEl) this.resultEl.remove();
    if (this.hud) { this.hud.route = null; if (this.hud.toastEl) this.hud.toastEl.style.top = ''; }
    super.dispose();
  }
}
