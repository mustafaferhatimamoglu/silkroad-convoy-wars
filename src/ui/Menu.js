import { CITIES } from '../data/cities.js';
import { PAINTS } from '../vehicle/model/KartalModel.js';
import { QUALITY } from '../core/Settings.js';

// Menu arayuzu: ana menu, sehir secimi, garaj, ayarlar, duraklatma.
// Her ekran DOM olarak kurulur; geri cagirimlar Game denetleyicisine baglanir.

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

export const VARIANTS = {
  kartal80: { name: 'Kartal 1980', desc: '4 yuvarlak far, krom tampon ve çıtalar' },
  kartal90: { name: 'Kartal 90\'lar', desc: 'Dikdörtgen farlar, siyah plastik tampon' },
};

export class Menu {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.layer = null;
  }

  clear() { if (this.layer) { this.layer.remove(); this.layer = null; } }

  main() {
    this.clear();
    const s = this.game.app.settings;
    const el = h(`<div id="menu" class="interactive"><div class="box">
      <h1>SILKROAD</h1>
      <div class="ver">CONVOY WARS · V4</div>
      <button class="btn" data-a="drive">Serbest Sürüş<small>Silkroad dünyasında Tofaş Kartal ile dolaş</small></button>
      <button class="btn" data-a="rally">Ralli: Hotan → Taklamakan<small>Kontrol noktalı zamana karşı yarış</small></button>
      <button class="btn" data-a="garage">Garaj<small>Sürüm ve renk seçimi</small></button>
      <button class="btn" data-a="kervan">Kervan RPG<small>Tüccar ol: mal al, kervanla şehirden şehre taşı, haydutlara karşı koy</small></button>
      <button class="btn secondary" data-a="explore">Dünya Gezgini<small>Serbest kamera ile haritayı gez</small></button>
      <button class="btn secondary" data-a="settings">Ayarlar</button>
      <div class="foot">Araç: <b>${VARIANTS[s.get('vehicleVariant')]?.name || ''}</b> · ${PAINTS[s.get('vehicleColor')]?.name || ''}<br>
      Kumanda desteklenir. Esc: menü · F3: performans bilgisi</div>
    </div></div>`);
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const act = a.dataset.a;
      if (act === 'drive') this.cityPicker('drive');
      else if (act === 'explore') this.cityPicker('explore');
      else if (act === 'rally') this.game.startRally();
      else if (act === 'kervan') this.cityPicker('kervan');
      else if (act === 'garage') this.garage();
      else if (act === 'settings') this.settings(() => this.main());
    });
    this.root.appendChild(el);
    this.layer = el;
  }

  cityPicker(kind) {
    this.clear();
    const last = this.game.app.settings.get('lastCity') || 'hotan';
    const el = h(`<div class="panel dialog interactive">
      <h2>${kind === 'explore' ? 'Nereyi gezelim?' : kind === 'kervan' ? 'Ticarete nereden başlayalım?' : 'Nereden başlayalım?'}</h2>
      <div class="grid3">${CITIES.map((c) => `<div class="card ${c.id === last ? 'sel' : ''}" data-c="${c.id}"><b>${c.name}</b><span>${c.desc}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:16px"><button class="btn secondary" data-a="back" style="width:auto">← Geri</button><div style="flex:1"></div>
      <button class="btn" data-a="go" style="width:auto">Başla →</button></div>
    </div>`);
    let sel = last;
    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-c]');
      if (c) { sel = c.dataset.c; el.querySelectorAll('.card').forEach((x) => x.classList.toggle('sel', x === c)); return; }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'back') this.main();
      if (a.dataset.a === 'go') { this.game.app.settings.set('lastCity', sel); this.clear(); this._start(kind, sel); }
    });
    el.addEventListener('dblclick', (e) => {
      const c = e.target.closest('[data-c]');
      if (c) { this.game.app.settings.set('lastCity', c.dataset.c); this.clear(); this._start(kind, c.dataset.c); }
    });
    this.root.appendChild(el);
    this.layer = el;
  }

  _start(kind, city) {
    if (kind === 'drive') this.game.startDrive(city);
    else if (kind === 'kervan') this.game.startKervan(city);
    else this.game.startExplore(city);
  }

  garage(onBack = () => this.main()) {
    this.clear();
    const s = this.game.app.settings;
    const el = h(`<div class="panel dialog interactive" style="left:auto;right:3vw;transform:translate(0,-50%);width:420px">
      <h2>Garaj</h2>
      <div style="color:var(--muted);font-size:13px;margin-bottom:6px">Sürüm</div>
      <div class="grid2">${Object.entries(VARIANTS).map(([id, v]) => `<div class="card ${id === s.get('vehicleVariant') ? 'sel' : ''}" data-v="${id}"><b>${v.name}</b><span>${v.desc}</span></div>`).join('')}</div>
      <div style="color:var(--muted);font-size:13px;margin:14px 0 6px">Renk</div>
      <div class="swatches">${Object.entries(PAINTS).map(([id, p]) => `<div class="swatch ${id === s.get('vehicleColor') ? 'sel' : ''}" title="${p.name}" data-p="${id}" style="background:${p.color}"></div>`).join('')}</div>
      <div class="row"><button class="btn" data-a="back" style="width:auto">← Tamam</button></div>
    </div>`);
    el.addEventListener('click', (e) => {
      const v = e.target.closest('[data-v]');
      if (v) { s.set('vehicleVariant', v.dataset.v); el.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('sel', x === v)); this.game.previewCar(); return; }
      const p = e.target.closest('[data-p]');
      if (p) { s.set('vehicleColor', p.dataset.p); el.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('sel', x === p)); this.game.previewCar(true); return; }
      if (e.target.closest('[data-a="back"]')) onBack();
    });
    this.root.appendChild(el);
    this.layer = el;
    this.game.garageCamera(true);
  }

  settings(onBack) {
    this.clear();
    const s = this.game.app.settings;
    const opt = (k, items) => items.map(([v, l]) => `<option value="${v}" ${String(s.get(k)) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
    const el = h(`<div class="panel dialog interactive">
      <h2>Ayarlar</h2>
      <div class="setting"><label>Grafik kalitesi</label><select data-k="quality">${opt('quality', Object.entries(QUALITY).map(([k, q]) => [k, q.label]))}</select></div>
      <div class="setting"><label>Müzik sesi</label><input type="range" min="0" max="1" step="0.05" data-k="musicVolume" value="${s.get('musicVolume')}"></div>
      <div class="setting"><label>Efekt sesi</label><input type="range" min="0" max="1" step="0.05" data-k="sfxVolume" value="${s.get('sfxVolume')}"></div>
      <div class="setting"><label>Motor sesi</label><select data-k="engineSound">${opt('engineSound', [[true, 'Açık'], [false, 'Kapalı']])}</select></div>
      <div class="setting"><label>Şanzıman</label><select data-k="transmission">${opt('transmission', [['auto', 'Otomatik'], ['manual', 'Manuel (Q / E)']])}</select></div>
      <div class="setting"><label>Sürüş yardımları</label><select data-k="assists">${opt('assists', [['tam', 'Tam (ABS + TCS + direksiyon)'], ['orta', 'Orta (ABS + TCS)'], ['kapali', 'Kapalı (saf simülasyon)']])}</select></div>
      <div class="setting"><label>Günün saati</label><input type="range" min="0" max="24" step="0.25" data-k="hour" value="${s.get('hour')}"></div>
      <div class="setting"><label>Zaman akışı</label><select data-k="timeFlow">${opt('timeFlow', [[false, 'Sabit'], [true, 'Akıyor (1 dk = 1 saat)']])}</select></div>
      <div class="note" style="font-size:12px;color:var(--muted);margin-top:10px"></div>
      <div class="row" style="margin-top:12px"><button class="btn" data-a="back" style="width:auto">← Geri</button></div>
    </div>`);
    const note = el.querySelector('.note');
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      let v = e.target.value;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (e.target.type === 'range') v = Number(v);
      s.set(k, v);
      if (k === 'quality') note.innerHTML = 'Grafik kalitesi sayfa yeniden yüklenince uygulanır. <a href="#" data-a="reload" style="color:var(--gold)">Şimdi yeniden yükle</a>';
      this.game.applySetting(k, v);
    });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'reload') { e.preventDefault(); location.reload(); }
      if (a.dataset.a === 'back') onBack();
    });
    this.root.appendChild(el);
    this.layer = el;
  }

  pause({ onResume, onTeleport, onGarage, onRepair, onSettings, onMain, title = 'DURAKLATILDI' }) {
    this.clear();
    const el = h(`<div id="pause" class="interactive"><div class="panel box">
      <h2>${title}</h2>
      <button class="btn" data-a="resume">Devam et</button>
      ${onTeleport ? '<button class="btn secondary" data-a="teleport">Şehre ışınlan</button>' : ''}
      ${onRepair ? '<button class="btn secondary" data-a="repair">Aracı onar ve yıka</button>' : ''}
      ${onGarage ? '<button class="btn secondary" data-a="garage">Garaj (renk / sürüm)</button>' : ''}
      <button class="btn secondary" data-a="settings">Ayarlar</button>
      <button class="btn secondary" data-a="main">Ana menü</button>
    </div></div>`);
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const act = a.dataset.a;
      if (act === 'resume') onResume();
      if (act === 'teleport') this.teleportList(onTeleport, () => this.pause({ onResume, onTeleport, onGarage, onRepair, onSettings, onMain, title }));
      if (act === 'garage') onGarage();
      if (act === 'repair') onRepair();
      if (act === 'settings') onSettings();
      if (act === 'main') onMain();
    });
    this.root.appendChild(el);
    this.layer = el;
  }

  teleportList(onPick, onBack) {
    this.clear();
    const el = h(`<div class="panel dialog interactive"><h2>Şehre ışınlan</h2>
      <div class="grid3">${CITIES.map((c) => `<div class="card" data-c="${c.id}"><b>${c.name}</b><span>${c.desc}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn secondary" data-a="back" style="width:auto">← Geri</button></div></div>`);
    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-c]');
      if (c) { this.clear(); onPick(c.dataset.c); return; }
      if (e.target.closest('[data-a="back"]')) onBack();
    });
    this.root.appendChild(el);
    this.layer = el;
  }
}
