// Tam ekranda fare kilidi: surus sirasinda imlec gizlenir ve fare hareketi dogrudan kamerayi
// cevirir (sag tusa basmadan etrafa bakis). F tusu tam ekrani acar/kapatir; tarayicinin kendi
// tam ekrani (F11) da tanınir. Esc kilidi acar ve oyunu duraklatir; menude imlec geri gelir.
// Kilit icin tarayici bir tiklama ister: tam ekranda kilit yoksa ekrana tiklamak yeter.

export class MouseLock {
  constructor(app, { onLost = null } = {}) {
    this.app = app;
    this.want = false;
    this.onLost = onLost;
    this._was = false;
    const c = app.canvas;
    this.hint = document.createElement('div');
    this.hint.id = 'lockHint';
    this.hint.className = 'hidden';
    this.hint.textContent = 'Fareyle etrafa bakmak için ekrana tıkla';
    app.ui.appendChild(this.hint);
    c.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.want && this.fullscreen && !this.locked) this.lock();
    });
    document.addEventListener('pointerlockchange', () => {
      const now = this.locked;
      // kilit kullanici tarafindan (Esc) acildiysa oyunu duraklat
      if (this._was && !now && this.want && this.onLost) this.onLost();
      this._was = now;
      this._updateHint();
    });
    document.addEventListener('pointerlockerror', () => this._updateHint());
    addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (e.code !== 'KeyF' || e.repeat || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      this.toggleFullscreen();
    });
    addEventListener('resize', () => this._updateHint());
    document.addEventListener('fullscreenchange', () => {
      if (!this.fullscreen && this.locked) document.exitPointerLock();
      this._updateHint();
    });
  }

  get locked() { return document.pointerLockElement === this.app.canvas; }

  /** Tam ekran: Fullscreen API ya da tarayicinin F11 tam ekrani (pencere ekrani kapliyor). */
  get fullscreen() {
    return !!document.fullscreenElement || (innerWidth >= screen.width - 2 && innerHeight >= screen.height - 2);
  }

  lock() {
    const c = this.app.canvas;
    const quiet = (p) => { if (p && p.catch) p.catch(() => {}); return p; };
    try {
      // ham fare hareketi (isletim sistemi ivmesi olmadan); desteklenmezse normal kilit
      const p = c.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { quiet(c.requestPointerLock()); } catch { /* */ } });
    } catch { try { quiet(c.requestPointerLock()); } catch { /* */ } }
  }

  toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    const el = document.documentElement;
    if (!el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (this.want) this.lock(); }).catch(() => {});
  }

  /** Oyun her karede bildirir: surus suruyor mu (menu/duraklatma yok). */
  setWant(w) {
    if (w === this.want) return;
    this.want = w;
    if (!w && this.locked) document.exitPointerLock();
    this._updateHint();
  }

  /** Bir tiklamayla surus yeniden basladiginda (menuden "Devam") kilidi geri al. */
  relock() { if (this.fullscreen && !this.locked) this.lock(); }

  _updateHint() {
    this.hint.classList.toggle('hidden', !(this.want && this.fullscreen && !this.locked));
  }
}
