// Buyuk dunya haritasi (M): dunya sablonunun ustten gorunumu (zemin sinifi renkleri, tepe golgesi,
// su), sehir adlari, feribot hatlari, oyuncu oku ve (cok oyunculuda) diger oyuncular. Tekerlekle
// yakinlastir, surukleyerek kaydir. Harita sablondan bir kez cizilir.

const MPP = 16;                           // metre / piksel (sablonun yukseklik izgarasi)
const PAL = {
  void: [70, 64, 58], sand: [214, 190, 138], dirt: [150, 120, 82], gravel: [150, 146, 136], grass: [96, 128, 60],
  steppe: [168, 152, 96], forest: [62, 92, 46], rock: [126, 120, 112], redrock: [168, 98, 64], snow: [236, 240, 246],
  mud: [100, 88, 66], paving: [206, 200, 188], cobble: [160, 152, 140], farmland: [126, 116, 58], mosaic: [150, 120, 104],
};

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
    this.img = document.createElement('canvas');
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
    setTimeout(() => this._render(), 1500);
  }

  /** Dunya siniri (metre): X0..X0+w, Z0..Z0+h. */
  get bounds() {
    const P = this.app.world && this.app.world.data && this.app.world.data.plan;
    if (!P) return { X0: 0, Z0: 0, w: 1, h: 1 };
    return { X0: P.X0, Z0: P.Z0, w: P.hw * MPP, h: P.hh * MPP };
  }

  _render() {
    const P = this.app.world.data.plan;
    if (!P || !P.H) { setTimeout(() => this._render(), 1000); return; }
    const W = P.hw, H = P.hh;
    this.img.width = W; this.img.height = H;
    const ctx = this.img.getContext('2d');
    const im = ctx.createImageData(W, H), d = im.data, hs = P.H;
    const pal = P.classes.map((c) => PAL[c] || [128, 128, 128]);
    for (let z = 0; z < H; z++) {
      const py = H - 1 - z;
      for (let x = 0; x < W; x++) {
        const i = z * W + x;
        const hx = hs[z * W + Math.min(W - 1, x + 1)] - hs[z * W + Math.max(0, x - 1)];
        const hz = hs[Math.min(H - 1, z + 1) * W + x] - hs[Math.max(0, z - 1) * W + x];
        const shade = Math.max(0.45, Math.min(1.4, 1 + ((-hx + hz) / (2 * MPP)) * 1.3));
        const X = P.X0 + x * MPP + 8, Z = P.Z0 + z * MPP + 8;
        let c = pal[P.groundAt(X, Z)];
        if (P.voidDist[i] > 0) c = PAL.void;
        let r = c[0] * shade, g = c[1] * shade, b = c[2] * shade;
        if (P.waterLevel(X, Z) !== null) { r = 40; g = 92; b = 146; }
        if (P.voidDist[i] > 6) { r *= 0.45; g *= 0.45; b *= 0.45; }
        const o = (py * W + x) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    this.done = true;
    this.el.querySelector('.bm-wait').classList.add('hidden');
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
    const B = this.bounds;
    const fit = Math.min(cw / B.w, ch / B.h) * 0.96;
    const s = fit * this.zoom;                                   // piksel / metre
    const cx = this.pan ? this.pan.x : this.zoom > 1.01 ? X : B.X0 + B.w / 2;
    const cz = this.pan ? this.pan.z : this.zoom > 1.01 ? Z : B.Z0 + B.h / 2;
    this._view = { s, cx, cz };
    const toPx = (x, z) => [cw / 2 + (x - cx) * s, ch / 2 - (z - cz) * s];
    ctx.fillStyle = '#10161c'; ctx.fillRect(0, 0, cw, ch);
    const [ox, oy] = toPx(B.X0, B.Z0 + B.h);
    ctx.imageSmoothingEnabled = this.zoom < 3;
    if (this.done) ctx.drawImage(this.img, ox, oy, B.w * s, B.h * s);
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
    // Roc hava gemisi hatlari ve tuneller
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,214,120,0.95)';
    for (const a of plan.airships || []) {
      const [ax, ay] = toPx(a.a.ex, a.a.ez), [bx, by] = toPx(a.b.ex, a.b.ez);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(30,24,18,0.9)'; ctx.lineWidth = 4;
    for (const T of plan.tunnels || []) {
      const r = T.r;
      ctx.beginPath();
      for (let i = r.ta; i <= r.tb; i += 4) { const [px, py] = toPx(r.dense[i][0], r.dense[i][1]); if (i === r.ta) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
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
    const label = (text, x, z, color = '#ffffff') => {
      const [mx, my] = toPx(x, z);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(text, mx, my - 6);
      ctx.fillStyle = color; ctx.fillText(text, mx, my - 6);
    };
    for (const f of plan.ferries) label('⛴ ' + f.name, (f.a.ex + f.b.ex) / 2, (f.a.ez + f.b.ez) / 2);
    for (const a of plan.airships || []) label('🦅 ' + a.name, (a.a.ex + a.b.ex) / 2, (a.a.ez + a.b.ez) / 2, '#ffd678');
    for (const T of plan.tunnels || []) { const m = T.r.dense[(T.r.ta + T.r.tb) >> 1]; label('Tünel', m[0], m[1] - 40, '#e8dcc4'); }
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
