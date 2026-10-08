import { WORLD } from '../world/gen/plan.js';

// Buyuk dunya haritasi (M): uretilen dunyanin ustten gorunumu (tepe golgeli arazi, su, yollar),
// sehir adlari, feribot hatlari, oyuncu oku ve (cok oyunculuda) diger oyuncular. Tekerlekle
// yakinlastir, surukleyerek kaydir. Harita bir kez, arka planda parca parca cizilir.

const MPP = 12;                           // metre / piksel (harita goruntusu)

export class BigMap {
  constructor(app) {
    this.app = app;
    this.open = false;
    this.zoom = 1;
    this.pan = null;
    this.el = document.createElement('div');
    this.el.id = 'bigmap';
    this.el.className = 'hidden';
    this.el.innerHTML = `<canvas></canvas><div class="bm-title">Dünya haritası <span>M: kapat · tekerlek: yakınlaştır · sürükle: kaydır</span></div><div class="bm-wait">Harita çiziliyor…</div>`;
    app.ui.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.W = Math.floor(WORLD.w / MPP); this.H = Math.floor(WORLD.h / MPP);
    this.img = document.createElement('canvas');
    this.img.width = this.W; this.img.height = this.H;
    this.row = 0;
    this.done = false;
    this._drag = null;
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.min(8, Math.max(0.6, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); });
    this.canvas.addEventListener('mousedown', (e) => { this._drag = { x: e.clientX, y: e.clientY, p: this.pan ? { ...this.pan } : null }; });
    addEventListener('mouseup', () => { this._drag = null; });
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this._drag || !this._view) return;
      const v = this._view;
      const base = this._drag.p || { x: v.cx, z: v.cz };
      this.pan = { x: base.x - (e.clientX - this._drag.x) / v.s, z: base.z + (e.clientY - this._drag.y) / v.s };
    });
    // bosta parca parca ciz
    const step = () => { if (!this.done) { this._genRows(12); setTimeout(step, this.open ? 0 : 30); } };
    setTimeout(step, 1500);
  }

  _genRows(n) {
    const plan = this.app.world.data.plan;
    if (!plan) return;
    if (!this._hs) { this._hs = new Float32Array(this.W * (this.H + 1)); this._data = this.img.getContext('2d').createImageData(this.W, this.H); }
    const s = {};
    const W = this.W, H = this.H, hs = this._hs, data = this._data.data;
    // yukseklikler bir satir onden (golge icin)
    for (let k = 0; k < n && this.row < H; k++, this.row++) {
      const py = this.row;
      for (const yy of [py, py + 1]) {
        if (yy > H || hs[yy * W] !== 0) continue;
        const z = WORLD.h - (yy + 0.5) * MPP;
        for (let px = 0; px < W; px++) { plan.sample((px + 0.5) * MPP, z, s); hs[yy * W + px] = s.h || 1e-6; }
      }
      const z = WORLD.h - (py + 0.5) * MPP;
      for (let px = 0; px < W; px++) {
        const x = (px + 0.5) * MPP;
        const h = hs[py * W + px];
        const hx = hs[py * W + Math.min(W - 1, px + 1)] - hs[py * W + Math.max(0, px - 1)];
        const hz = hs[Math.max(0, py - 1) * W + px] - hs[(py + 1) * W + px];
        const shade = Math.max(0.5, Math.min(1.35, 1 + ((-hx + hz) / (2 * MPP)) * 1.4));
        const b = plan.biome(x, z);
        let r = 124, g = 112, bl = 82;
        const mix = (c, w) => { r += (c[0] - r) * w; g += (c[1] - g) * w; bl += (c[2] - bl) * w; };
        mix([156, 140, 84], b.steppe);
        mix([84, 116, 52], b.grass);
        mix([56, 88, 44], b.forest * 0.6);
        mix([214, 188, 140], b.sand);
        mix([172, 96, 58], b.mesa * 0.4);
        if (h > 220) mix([128, 122, 112], Math.min(1, (h - 220) / 60));
        if (h > 330) mix([236, 238, 244], Math.min(1, (h - 330) / 40));
        r *= shade; g *= shade; bl *= shade;
        const wl = plan.waterLevel(x, z);
        if (wl !== null && h < wl) { const d = Math.min(1, (wl - h) / 10); r = 46 - d * 22; g = 104 - d * 40; bl = 150 - d * 28; }
        plan.sample(x, z, s);
        if (s.road > 0.3) { r = 92; g = 80; bl = 64; }
        if (plan.cityAt(x, z)) { r = r * 0.55 + 205 * 0.45; g = g * 0.55 + 190 * 0.45; bl = bl * 0.55 + 160 * 0.45; }
        const o = (py * W + px) * 4;
        data[o] = r; data[o + 1] = g; data[o + 2] = bl; data[o + 3] = 255;
      }
    }
    this.img.getContext('2d').putImageData(this._data, 0, 0);
    if (this.row >= H) { this.done = true; this._hs = null; this.el.querySelector('.bm-wait').classList.add('hidden'); }
  }

  toggle() {
    this.open = !this.open;
    this.el.classList.toggle('hidden', !this.open);
    if (this.open) { this.pan = null; this.zoom = 1; }
  }

  /** pos: Three.js konumu, heading: araç yonu (radyan, 0 = kuzey, + sola); others: [{x, z, name, color}] */
  draw(pos, heading, others = []) {
    if (!this.open) return;
    const c = this.canvas, ctx = c.getContext('2d');
    const cw = c.clientWidth, ch = c.clientHeight;
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const X = pos.x, Z = -pos.z;
    const fit = Math.min(cw / WORLD.w, ch / WORLD.h) * 0.96;
    const s = fit * this.zoom;                                   // piksel / metre
    const cx = this.pan ? this.pan.x : this.zoom > 1.01 ? X : WORLD.w / 2;
    const cz = this.pan ? this.pan.z : this.zoom > 1.01 ? Z : WORLD.h / 2;
    this._view = { s, cx, cz };
    const toPx = (x, z) => [cw / 2 + (x - cx) * s, ch / 2 - (z - cz) * s];
    ctx.fillStyle = '#10161c'; ctx.fillRect(0, 0, cw, ch);
    const [ox, oy] = toPx(0, WORLD.h);
    ctx.imageSmoothingEnabled = this.zoom < 3;
    ctx.drawImage(this.img, ox, oy, WORLD.w * s, WORLD.h * s);
    const plan = this.app.world.data.plan;
    // yollar (vektor): tas yol koyu, toprak yol kesikli
    for (const r of plan.roads) {
      ctx.setLineDash(r.kind === 'dirt' ? [5, 4] : []);
      ctx.strokeStyle = r.kind === 'dirt' ? 'rgba(120,92,60,0.95)' : 'rgba(70,56,40,0.95)';
      ctx.lineWidth = Math.max(1.5, r.width * s * 0.8);
      ctx.beginPath();
      for (let i = 0; i < r.dense.length; i += 6) {
        const [px, py] = toPx(r.dense[i][0], r.dense[i][1]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      const e = r.dense[r.dense.length - 1];
      ctx.lineTo(...toPx(e[0], e[1]));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // isinlanma kapilari
    for (const g of plan.portals) {
      const [px, py] = toPx(g.x, g.z);
      ctx.fillStyle = '#9fd8ff'; ctx.strokeStyle = '#123'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // feribot hatlari
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    for (const f of plan.ferries) {
      const [ax, ay] = toPx(f.a.ex, f.a.ez), [bx, by] = toPx(f.b.ex, f.b.ez);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.setLineDash([]);
    // sehirler
    ctx.font = '600 14px Georgia, serif'; ctx.textAlign = 'center';
    for (const ct of plan.cities) {
      const [px, py] = toPx(ct.x, ct.z);
      ctx.strokeStyle = 'rgba(40,30,20,0.9)'; ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(232,193,112,0.25)';
      ctx.beginPath(); ctx.arc(px, py, Math.max(4, ct.r * s), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(ct.name, px, py - Math.max(8, ct.r * s) - 6);
      ctx.fillStyle = '#f2d48a'; ctx.fillText(ct.name, px, py - Math.max(8, ct.r * s) - 6);
    }
    ctx.font = '12px sans-serif';
    for (const f of plan.ferries) {
      const [mx, my] = toPx((f.a.ex + f.b.ex) / 2, (f.a.ez + f.b.ez) / 2);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText('⛴ ' + f.name, mx, my - 6);
      ctx.fillStyle = '#ffffff'; ctx.fillText('⛴ ' + f.name, mx, my - 6);
    }
    // diger oyuncular
    for (const o of others) {
      const [px, py] = toPx(o.x, o.z);
      ctx.fillStyle = o.color || '#7fd0ff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (o.name) { ctx.fillStyle = '#fff'; ctx.fillText(o.name, px, py - 10); }
    }
    // oyuncu oku (heading: 0 = kuzey, + sola -> ekranda saat yonunun tersi)
    const [px, py] = toPx(X, Z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-heading);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    // olcek cubugu
    const km = s * 1000;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(16, ch - 40, km + 20, 26);
    ctx.fillStyle = '#fff'; ctx.fillRect(26, ch - 26, km, 4);
    ctx.textAlign = 'left'; ctx.fillText('1 km', 30, ch - 30);
  }

  dispose() { this.el.remove(); }
}
