// Kalici oyun ayarlari (localStorage). Okunamazsa varsayilanlarla calisir.

const KEY = 'sro-v4-settings';

export const QUALITY = {
  dusuk: { label: 'Düşük', pixelRatio: 0.85, shadowMap: 2048, shadowExtent: 55, nearRadius: 1, farRadius: 3, msaa: 0, bloom: false, tileSize: 256, objTex: 256, anisotropy: 4 },
  orta: { label: 'Orta', pixelRatio: 1.0, shadowMap: 2048, shadowExtent: 65, nearRadius: 2, farRadius: 4, msaa: 4, bloom: true, tileSize: 512, objTex: 256, anisotropy: 8 },
  yuksek: { label: 'Yüksek', pixelRatio: 1.0, shadowMap: 4096, shadowExtent: 75, nearRadius: 2, farRadius: 5, msaa: 4, bloom: true, tileSize: 512, objTex: 256, anisotropy: 16 },
  ultra: { label: 'Ultra', pixelRatio: 1.5, shadowMap: 4096, shadowExtent: 90, nearRadius: 3, farRadius: 6, msaa: 8, bloom: true, tileSize: 512, objTex: 256, anisotropy: 16 },
};

const DEFAULTS = {
  quality: 'yuksek',
  musicVolume: 0.35,
  sfxVolume: 0.8,
  engineSound: true,
  hour: 15.5,
  timeFlow: false,
  transmission: 'auto',
  assists: 'orta',
  units: 'kmh',
  showDebug: false,
  vehicleColor: 'lacivert',
  vehicleVariant: 'kartal80',
  camera: 'chase',
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch (e) { /* gizli pencere vb. */ }
    if (!QUALITY[this.values.quality]) this.values.quality = DEFAULTS.quality;
    this.listeners = new Set();
  }
  get(k) { return this.values[k]; }
  set(k, v) {
    this.values[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch (e) { /* yoksay */ }
    for (const fn of this.listeners) fn(k, v);
  }
  get quality() { return QUALITY[this.values.quality]; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}
