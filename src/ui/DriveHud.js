import { CITIES } from '../data/cities.js';
import { CAMERA_NAMES } from '../vehicle/VehicleCamera.js';

// Surus gostergeleri: hiz/devir saatleri, vites, hasar, zemin, mini harita, yardim.

function el(tag, attrs = {}, html = '') {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}

export class DriveHud {
  constructor(app, root) {
    this.app = app;
    this.root = el('div', { id: 'hud' });
    root.appendChild(this.root);
    this.tl = el('div', { class: 'tl' }, '<div class="zone"></div><div class="coord"></div><div class="info"></div>');
    this.root.appendChild(this.tl);
    // mini harita
    this.mini = el('div', { id: 'minimap' }, '<canvas width="380" height="380"></canvas><div class="n">K</div>');
    this.root.appendChild(this.mini);
    this.miniCanvas = this.mini.querySelector('canvas');
    this.tiles = new Map();
    // gostergeler
    this.dash = el('div', { id: 'dash' });
    this.cluster = el('canvas', { width: 640, height: 300 });
    this.cluster.style.width = '320px'; this.cluster.style.height = '150px';
    this.dash.appendChild(this.cluster);
    this.root.appendChild(this.dash);
    this.damage = el('div', { id: 'damage' }, 'GÖVDE<div class="bar"><div></div></div><div class="surf" style="margin-top:6px"></div>');
    this.root.appendChild(this.damage);
    this.help = el('div', { id: 'controlsHelp' }, [
      '<kbd>W</kbd><kbd>S</kbd> gaz / fren-geri &nbsp; <kbd>A</kbd><kbd>D</kbd> direksiyon &nbsp; <kbd>Boşluk</kbd> el freni',
      '<kbd>C</kbd> kamera &nbsp; <kbd>L</kbd> farlar &nbsp; <kbd>R</kbd> geri sar (bas 1 sn, tut 5/10 sn) &nbsp; <kbd>T</kbd> şanzıman &nbsp; <kbd>Q</kbd><kbd>E</kbd> vites (manuel)',
      '<kbd>N</kbd> motor sesi &nbsp; <kbd>M</kbd> müzik &nbsp; <kbd>H</kbd> korna &nbsp; <kbd>F</kbd> tam ekran (fareyle bakış) &nbsp; <kbd>F1</kbd> yardımı gizle &nbsp; <kbd>Esc</kbd> menü',
    ].join('<br>'));
    this.root.appendChild(this.help);
    this.toastEl = el('div', { id: 'toast', class: 'panel' });
    this.root.appendChild(this.toastEl);
    this._t = 0;
    this._toastT = 0;
  }

  toast(msg, secs = 2.2) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    this._toastT = secs;
  }

  toggleHelp() { this.help.classList.toggle('hidden'); }

  update(dt, vehicle, cameraMode) {
    if (this._toastT > 0) { this._toastT -= dt; if (this._toastT <= 0) this.toastEl.classList.remove('show'); }
    this._t += dt;
    if (this._t < 1 / 30) return;
    this._t = 0;
    const sim = vehicle.sim;
    this._drawCluster(Math.abs(sim.forwardSpeed) * 3.6, sim.rpm, sim.gearLabel, sim.autoShift, vehicle);
    const hp = Math.max(0, sim.health);
    const bar = this.damage.querySelector('.bar > div');
    bar.style.width = `${hp}%`;
    bar.style.background = hp > 60 ? 'var(--green)' : hp > 30 ? '#e8c170' : 'var(--red)';
    this.damage.querySelector('.surf').textContent = `Zemin: ${vehicle.surfaceUnder()}`;
    // konum
    const w = this.app.world;
    const p = w.fromThree(vehicle.position.x, vehicle.position.z);
    let best = null, bd = Infinity;
    for (const c of CITIES) {
      const d = Math.hypot(c.rx * 1920 + c.lx - (p.rx * 1920 + p.lx), c.rz * 1920 + c.lz - (p.rz * 1920 + p.lz)) * 0.1;
      if (d < bd) { bd = d; best = c; }
    }
    this.tl.querySelector('.zone').textContent = bd < 450 ? best.name : `${best.name} yolu`;
    this.tl.querySelector('.coord').textContent = `${bd < 450 ? 'şehir içi' : `${(bd / 1000).toFixed(1)} km uzakta`} · bölge ${p.rx},${p.rz}`;
    this.tl.querySelector('.info').textContent = `Kamera: ${CAMERA_NAMES[cameraMode] || cameraMode}`;
    this._drawMinimap(vehicle, p);
  }

  _tile(key) {
    let t = this.tiles.get(key);
    if (!t) {
      t = this.app.world.data.minimapTile(key);
      this.tiles.set(key, t);
      if (this.tiles.size > 64) { const k0 = this.tiles.keys().next().value; this.tiles.delete(k0); }
    }
    return t;
  }

  _drawMinimap(vehicle, p) {
    const c = this.miniCanvas, ctx = c.getContext('2d');
    const W = c.width, S = 1.6; // piksel / metre
    ctx.save();
    ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    const heading = Math.atan2(-vehicle.forward.x, -vehicle.forward.z);
    ctx.rotate(heading); // arac yukari baksin
    const regionPx = 192 * S;
    const ox = (p.lx / 1920) * regionPx, oz = (p.lz / 1920) * regionPx;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const img = this._tile(`${p.rz + dz}_${p.rx + dx}`);
        if (!img.complete || img.failed || !img.naturalWidth) continue;
        // kuzey yukari: bolge z arttikca yukari
        const x = dx * regionPx - ox, y = -(dz * regionPx) - (regionPx - oz);
        ctx.drawImage(img, x, y, regionPx, regionPx);
      }
    }
    // ralli rotasi ve kontrol noktalari (dunya: +x dogu, -z kuzey -> harita x sag, z asagi)
    const R = this.route;
    if (R && R.pts) {
      const pos = vehicle.position;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineJoin = 'round';
      const trace = () => {
        ctx.beginPath();
        let first = true;
        for (const q of R.pts) {
          const x = (q.x - pos.x) * S, y = (q.z - pos.z) * S;
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      trace();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 211, 106, 0.95)'; trace();
      R.cps.forEach((cp, k) => {
        if (k < R.next) return;
        const x = (cp.pos.x - pos.x) * S, y = (cp.pos.z - pos.z) * S;
        ctx.fillStyle = k === R.next ? '#ff5a3a' : 'rgba(255,255,255,0.85)';
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, k === R.next ? 8 : 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      // yaristaki diger araclar
      if (R.cars) for (const c of R.cars) {
        if (!c.vehicle || c.vehicle === vehicle) continue;
        const q = c.vehicle.position;
        const x = (q.x - pos.x) * S, y = (q.z - pos.z) * S;
        ctx.fillStyle = c.color || '#fff'; ctx.strokeStyle = c.human ? '#ffd36b' : '#000'; ctx.lineWidth = c.human ? 3 : 2;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
    // oyuncu oku
    ctx.fillStyle = '#ffd36b'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, W / 2 - 16); ctx.lineTo(W / 2 + 10, W / 2 + 12); ctx.lineTo(W / 2, W / 2 + 6); ctx.lineTo(W / 2 - 10, W / 2 + 12); ctx.closePath();
    ctx.stroke(); ctx.fill();
    // kuzey isareti dondur
    const n = this.mini.querySelector('.n');
    const r = 82;
    n.style.left = `${95 + Math.sin(heading) * r}px`;
    n.style.top = `${95 - Math.cos(heading) * r}px`;
    n.style.transform = 'translate(-50%, -50%)';
  }

  _drawCluster(kmh, rpm, gear, auto, vehicle) {
    const c = this.cluster, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const dial = (cx, cy, R, val, max, step, sub, label, redFrom) => {
      ctx.save();
      ctx.translate(cx, cy);
      const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
      g.addColorStop(0, 'rgba(18,20,24,0.92)'); g.addColorStop(1, 'rgba(6,7,9,0.92)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(232,193,112,0.55)'; ctx.lineWidth = 3; ctx.stroke();
      const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
      if (redFrom) {
        ctx.strokeStyle = 'rgba(224,64,48,0.85)'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(0, 0, R - 9, a0 + (redFrom / max) * span, a0 + span); ctx.stroke();
      }
      for (let v = 0; v <= max + 1e-6; v += step / sub) {
        const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
        const a = a0 + (v / max) * span;
        ctx.strokeStyle = major ? '#efe6d2' : 'rgba(239,230,210,0.45)';
        ctx.lineWidth = major ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (R - (major ? 20 : 13)), Math.sin(a) * (R - (major ? 20 : 13)));
        ctx.lineTo(Math.cos(a) * (R - 6), Math.sin(a) * (R - 6));
        ctx.stroke();
        if (major) {
          ctx.fillStyle = '#efe6d2'; ctx.font = `600 ${Math.round(R * 0.15)}px Segoe UI, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(label(v), Math.cos(a) * (R - 36), Math.sin(a) * (R - 36));
        }
      }
      const a = a0 + (Math.min(val, max * 1.04) / max) * span;
      ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255,120,40,0.7)'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 14, -Math.sin(a) * 14); ctx.lineTo(Math.cos(a) * (R - 14), Math.sin(a) * (R - 14)); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#26282c'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    dial(185, 150, 140, kmh, 180, 20, 4, (v) => String(v), 0);
    dial(470, 165, 112, rpm, 7000, 1000, 2, (v) => String(v / 1000), 6200);
    // dijital hiz ve vites
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.font = '700 46px Consolas, monospace';
    ctx.fillText(String(Math.round(kmh)), 185, 222);
    ctx.fillStyle = '#a99f8c'; ctx.font = '500 18px Segoe UI, sans-serif';
    ctx.fillText('km/s', 185, 258);
    ctx.fillStyle = gear === 'R' ? '#ff9a3c' : '#ffd36b'; ctx.font = '800 54px Segoe UI, sans-serif';
    ctx.fillText(gear, 470, 238);
    ctx.fillStyle = '#a99f8c'; ctx.font = '500 16px Segoe UI, sans-serif';
    ctx.fillText(auto ? 'OTOMATİK' : 'MANUEL', 470, 280);
    ctx.fillText('x1000 d/dk', 470, 104);
    // uyari isiklari
    const lamp = (x, y, on, color, txt) => {
      ctx.fillStyle = on ? color : 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.25)'; ctx.font = '600 13px Segoe UI'; ctx.fillText(txt, x, y + 22);
    };
    const s = vehicle.sim;
    lamp(560, 40, vehicle.headlights, '#4aa3ff', 'FAR');
    lamp(608, 40, s.input.handbrake > 0 || s.holding, '#e0584f', 'FREN');
    if (s.assists.tcs) lamp(560, 92, s.tcsCut > 0.05, '#ffb84a', 'TCS');
  }

  dispose() { this.root.remove(); }
}
