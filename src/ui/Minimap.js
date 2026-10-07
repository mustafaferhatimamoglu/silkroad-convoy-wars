// Donen mini harita: oyunun kendi mini harita karolari (assets/minimap/world), oyuncu
// yukari bakar. Isaretler (NPC, dusman, kervan) nokta; harita disindaki hedef kenarda ok.

const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); e.innerHTML = html; return e; };

export class Minimap {
  constructor(app, root, { size = 380, scale = 1.6, id = 'minimap' } = {}) {
    this.app = app;
    this.S = scale;                // piksel / metre
    this.root = el('div', { id }, `<canvas width="${size}" height="${size}"></canvas><div class="n">K</div>`);
    root.appendChild(this.root);
    this.canvas = this.root.querySelector('canvas');
    this.tiles = new Map();
  }

  _tile(key) {
    let t = this.tiles.get(key);
    if (!t) {
      t = new Image();
      t.src = this.app.world.data.minimapUrl(key);
      t.onerror = () => { t.failed = true; };
      this.tiles.set(key, t);
      if (this.tiles.size > 64) { const k0 = this.tiles.keys().next().value; this.tiles.delete(k0); }
    }
    return t;
  }

  /**
   * pos: Three.js konumu; heading: yukari bakan yon (radyan; 0 = kuzey/-z).
   * marks: [{x, z, color, r}] ; target: {x, z, label} (kenarda ok)
   */
  draw(pos, heading, marks = [], target = null, path = null) {
    const c = this.canvas, ctx = c.getContext('2d');
    const W = c.width, S = this.S;
    const p = this.app.world.fromThree(pos.x, pos.z);
    ctx.save();
    ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    ctx.rotate(heading);
    const regionPx = 192 * S;
    const ox = (p.lx / 1920) * regionPx, oz = (p.lz / 1920) * regionPx;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const img = this._tile(`${p.rz + dz}_${p.rx + dx}`);
        if (!img.complete || img.failed || !img.naturalWidth) continue;
        const x = dx * regionPx - ox, y = -(dz * regionPx) - (regionPx - oz);
        ctx.drawImage(img, x, y, regionPx, regionPx);
      }
    }
    // rehber yolu (noktali)
    if (path && path.length > 1) {
      ctx.setLineDash([6, 6]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255, 211, 106, 0.9)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (const q of path) ctx.lineTo((q.x - pos.x) * S, (q.z - pos.z) * S);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // isaretler (dunya: +x dogu, -z kuzey -> harita: x sag, z asagi)
    for (const m of marks) {
      const x = (m.x - pos.x) * S, y = (m.z - pos.z) * S;
      if (Math.abs(x) > W || Math.abs(y) > W) continue;
      ctx.fillStyle = m.color; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, m.r || 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // hedef oku (dondurulmus uzayda yon)
    if (target) {
      const dx = (target.x - pos.x) * S, dy = (target.z - pos.z) * S;
      const a = Math.atan2(dy, dx) + heading;
      const d = Math.hypot(dx, dy);
      const R = W / 2 - 18;
      const rr = Math.min(R, d);
      const tx = W / 2 + Math.cos(a) * rr, ty = W / 2 + Math.sin(a) * rr;
      ctx.save();
      ctx.translate(tx, ty); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#ffd36a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 8); ctx.lineTo(0, 3); ctx.lineTo(-10, 8); ctx.closePath();
      ctx.stroke(); ctx.fill();
      ctx.restore();
    }
    // oyuncu oku
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, W / 2 - 14); ctx.lineTo(W / 2 + 9, W / 2 + 10); ctx.lineTo(W / 2, W / 2 + 5); ctx.lineTo(W / 2 - 9, W / 2 + 10); ctx.closePath();
    ctx.stroke(); ctx.fill();
    const n = this.root.querySelector('.n');
    const r = 82;
    n.style.left = `${95 + Math.sin(heading) * r}px`;
    n.style.top = `${95 - Math.cos(heading) * r}px`;
    n.style.transform = 'translate(-50%, -50%)';
  }

  dispose() { this.root.remove(); }
}
