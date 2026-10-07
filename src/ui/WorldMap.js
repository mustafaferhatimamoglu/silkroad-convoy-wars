import { CITIES } from '../data/cities.js';

// Dunya haritasi (M): oyunun mini harita karolarindan (bolge basina 256 px) buyuk harita.
// Yollar karolarda cizili oldugu icin oyuncu kervan yolunu buradan bulur. Surukle: kaydir,
// tekerlek: yakinlastir. Sehirler, oyuncu, kervan ve hedef isaretli.

export class WorldMap {
  constructor(app, root) {
    this.app = app;
    this.el = document.createElement('div');
    this.el.id = 'worldMap';
    this.el.className = 'interactive hidden';
    this.el.innerHTML = '<canvas></canvas><div class="wmHead"><b>Dünya Haritası</b><span>sürükle: kaydır · tekerlek: yakınlaş · <kbd>M</kbd> / <kbd>Esc</kbd>: kapat</span></div>';
    root.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.tiles = new Map();
    this.open = false;
    this.scale = 48;                 // piksel / bolge
    this.cx = 0; this.cz = 0;        // merkez (bolge birimi, dunya: x dogu, z kuzey)
    this._drag = null;
    this.canvas.addEventListener('mousedown', (e) => { this._drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz }; });
    addEventListener('mousemove', (e) => {
      if (!this._drag || !this.open) return;
      this.cx = this._drag.cx - (e.clientX - this._drag.x) / this.scale;
      this.cz = this._drag.cz + (e.clientY - this._drag.y) / this.scale;
    });
    addEventListener('mouseup', () => { this._drag = null; });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scale = Math.min(256, Math.max(10, this.scale * (e.deltaY > 0 ? 0.85 : 1.18)));
    }, { passive: false });
  }

  _tile(key) {
    let t = this.tiles.get(key);
    if (!t) {
      t = new Image();
      t.src = this.app.world.data.minimapUrl(key);
      t.onerror = () => { t.failed = true; };
      this.tiles.set(key, t);
    }
    return t;
  }

  /** Dunya (bolge birimi) <- Three.js konumu */
  _reg(x, z) {
    const p = this.app.world.fromThree(x, z);
    return { x: p.rx + p.lx / 1920, z: p.rz + p.lz / 1920 };
  }

  toggle(state) {
    this.open = state ?? !this.open;
    this.el.classList.toggle('hidden', !this.open);
    if (this.open) this.fit();
  }

  /** Oyuncu ve hedefi birlikte gosterecek sekilde ortala. */
  fit() {
    const s = this.state;
    if (!s) return;
    const a = s.player, b = s.dest || s.player;
    this.cx = (a.x + b.x) / 2; this.cz = (a.z + b.z) / 2;
    const W = this.el.clientWidth || 900, H = this.el.clientHeight || 600;
    const span = Math.max(Math.abs(a.x - b.x) + 3, (Math.abs(a.z - b.z) + 3) * (W / H));
    this.scale = Math.min(96, Math.max(14, W / span));
  }

  /** state: { player: {x,z,yaw}, caravan, dest: {x,z,name} } (Three.js konumlari) */
  update(st) {
    if (!st) return;
    const player = this._reg(st.player.x, st.player.z);
    const conv = (p) => (p ? { ...this._reg(p.x, p.z), name: p.name } : null);
    if (st.ferries && !this.ferryLines) {
      // iskele hatlari (bir kez)
      this.ferryLines = [];
      const seen = new Set();
      for (const [a, b] of st.ferries.links) {
        const k = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const pa = st.gatePos(a), pb = st.gatePos(b);
        if (pa && pb) this.ferryLines.push([this._reg(pa.x, pa.z), this._reg(pb.x, pb.z), /FLYSHIP/.test(st.ferries.gates[a].code)]);
      }
    }
    this.state = { player, yaw: st.player.yaw, caravan: conv(st.caravan), dest: conv(st.dest), waypoint: conv(st.waypoint) };
    if (this.open) this.draw();
  }

  draw() {
    const c = this.canvas, ctx = c.getContext('2d');
    const W = (c.width = this.el.clientWidth), H = (c.height = this.el.clientHeight);
    const S = this.scale;
    const sx = (x) => W / 2 + (x - this.cx) * S;
    const sy = (z) => H / 2 - (z - this.cz) * S;
    ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, W, H);
    const x0 = Math.floor(this.cx - W / 2 / S) - 1, x1 = Math.ceil(this.cx + W / 2 / S);
    const z0 = Math.floor(this.cz - H / 2 / S) - 1, z1 = Math.ceil(this.cz + H / 2 / S);
    for (let rz = z0; rz <= z1; rz++) {
      for (let rx = x0; rx <= x1; rx++) {
        if (!this.app.world.data.regions.has(`${rz}_${rx}`)) continue;
        const img = this._tile(`${rz}_${rx}`);
        if (img.complete && !img.failed && img.naturalWidth) ctx.drawImage(img, sx(rx), sy(rz + 1), S + 0.6, S + 0.6);
      }
    }
    const st = this.state;
    // feribot / ucan gemi hatlari
    for (const [a, b, ship] of this.ferryLines || []) {
      ctx.setLineDash(ship ? [3, 6] : [10, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = ship ? 'rgba(220, 180, 255, 0.85)' : 'rgba(120, 200, 255, 0.9)';
      ctx.beginPath(); ctx.moveTo(sx(a.x), sy(a.z)); ctx.lineTo(sx(b.x), sy(b.z)); ctx.stroke();
      ctx.setLineDash([]);
      for (const p of [a, b]) { ctx.fillStyle = ship ? '#dcb4ff' : '#78c8ff'; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.z), 4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.setLineDash([]);
    // rota: oyuncu -> (iskele) -> hedef
    if (st.dest) {
      ctx.setLineDash([8, 7]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 211, 106, 0.85)';
      const via = st.waypoint || st.dest;
      ctx.beginPath(); ctx.moveTo(sx(st.player.x), sy(st.player.z)); ctx.lineTo(sx(via.x), sy(via.z)); ctx.stroke();
      ctx.setLineDash([]);
      if (st.waypoint) {
        ctx.font = 'bold 13px "Segoe UI", Arial'; ctx.fillStyle = '#78c8ff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.textAlign = 'center';
        ctx.strokeText(st.waypoint.name, sx(st.waypoint.x), sy(st.waypoint.z) + 20); ctx.fillText(st.waypoint.name, sx(st.waypoint.x), sy(st.waypoint.z) + 20);
      }
    }
    // sehirler
    ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center';
    for (const ct of CITIES) {
      const x = sx(ct.rx + ct.lx / 1920), y = sy(ct.rz + ct.lz / 1920);
      const isDest = st.dest && st.dest.name === ct.name;
      ctx.fillStyle = isDest ? '#ffd36a' : '#f2e9d8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, isDest ? 8 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeText(ct.name, x, y - 13); ctx.fillText(ct.name, x, y - 13);
    }
    if (st.caravan) {
      ctx.fillStyle = '#7fe36a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx(st.caravan.x), sy(st.caravan.z), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // oyuncu oku (yaw: model yonu, ileri = (sin, cos) Three; Three z = -dunya z)
    const px = sx(st.player.x), py = sy(st.player.z);
    const a = Math.atan2(Math.sin(st.yaw), -Math.cos(st.yaw));
    ctx.save(); ctx.translate(px, py); ctx.rotate(a);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 9); ctx.lineTo(0, 4); ctx.lineTo(-9, 9); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  dispose() { this.el.remove(); }
}
