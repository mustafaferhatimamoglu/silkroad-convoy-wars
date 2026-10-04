// Klavye + fare + oyun kumandasi (Gamepad API) girisleri.
// down(code): basili mi; pressed(code): bu karede basildi mi (kenar algilama).

export class Input {
  constructor(target) {
    this.keys = new Set();
    this.justDown = new Set();
    this.justUp = new Set();
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, wheel: 0, buttons: 0 };
    this.gamepad = null;
    this.enabled = true;
    this._onKey = (e, down) => {
      if (!this.enabled) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (down) {
        if (!this.keys.has(e.code)) this.justDown.add(e.code);
        this.keys.add(e.code);
      } else {
        this.keys.delete(e.code);
        this.justUp.add(e.code);
      }
      // oyun tuslarinda sayfa kaydirmasin
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    };
    addEventListener('keydown', (e) => this._onKey(e, true));
    addEventListener('keyup', (e) => this._onKey(e, false));
    addEventListener('blur', () => { this.keys.clear(); });
    target.addEventListener('mousemove', (e) => {
      this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    target.addEventListener('mousedown', (e) => { this.mouse.buttons = e.buttons; target.focus?.(); });
    addEventListener('mouseup', (e) => { this.mouse.buttons = e.buttons; });
    target.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(...codes) { for (const c of codes) if (this.keys.has(c)) return true; return false; }
  pressed(...codes) { for (const c of codes) if (this.justDown.has(c)) return true; return false; }

  /** Kumanda durumunu oku (karede bir kez). */
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { this.gamepad = null; return; }
    const prev = this.gamepad ? this.gamepad.buttons : [];
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
    const btn = gp.buttons.map((b) => b.value);
    this.gamepad = {
      steer: dz(gp.axes[0] || 0),
      lookX: dz(gp.axes[2] || 0), lookY: dz(gp.axes[3] || 0),
      throttle: btn[7] || 0, brake: btn[6] || 0,
      buttons: btn,
      pressed: (i) => (btn[i] || 0) > 0.5 && !((prev[i] || 0) > 0.5),
    };
  }

  /** Kare sonunda kenar durumlarini temizle. */
  endFrame() {
    this.justDown.clear();
    this.justUp.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
  }
}
