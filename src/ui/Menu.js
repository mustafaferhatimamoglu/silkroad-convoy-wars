import { CITIES } from '../data/cities.js';
import { PAINTS } from '../vehicle/model/KartalModel.js';
import { QUALITY } from '../core/Settings.js';
import { RALLY_STAGES } from '../data/rally.js';
import { DIFFICULTY } from '../race/BotDriver.js';
import { downloadInvite, inviteLink } from '../net/invite.js';
import { hostBase } from '../version.js';

const LEVEL_DESC = {
  kolay: 'Temiz sürer, sık hata yapar; kirli numara yok',
  orta: 'Hızlı; arada blok, itme ve kestirme',
  zor: 'Sınırda sürer, kestirmeleri bilir, PIT atar',
  acimasiz: 'Her fırsatta PIT, fren testi, seni bariyer gibi kullanır',
};
const stageInfo = (st) => `${(st.length / 1000).toFixed(1)} km · ${st.cps.length} kapı`;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Menu arayuzu: ana menu, sehir secimi, garaj, ayarlar, duraklatma.
// Her ekran DOM olarak kurulur; geri cagirimlar Game denetleyicisine baglanir.

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

export const VARIANTS = {
  kartal80: { name: 'Kartal 1980', desc: '4 yuvarlak far, krom tampon ve çıtalar' },
  kartal90: { name: 'Kartal 90\'lar', desc: 'Dikdörtgen farlar, siyah plastik tampon' },
  hilux: { name: 'Toyota Hilux', desc: '2.8 dizel turbo, 4x4, çift kabin' },
  f150: { name: 'Ford F-150', desc: '5.0 V8, 10 ileri otomatik, 4x4 SuperCrew' },
  rs6: { name: 'Audi RS 6 Avant', desc: '4.0 V8 çift turbo, ~840 BG, quattro' },
  tank: { name: 'Rezvani Tank', desc: '6.4 V8, 37 inç lastik, kilitli 4x4' },
};
// Bütün motorlar fabrika değerinin %40 üstünde (vehicle/presets.js POWER)
export const PREPS = {
  ralli: { name: 'Ralli hazırlığı', desc: '~180 BG, +6 cm yükseklik, uzun yollu süspansiyon, kilitli diferansiyel' },
  stok: { name: 'Stok', desc: '1.6 karbüratörlü, ~105 BG; fabrika süspansiyonu' },
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
    this.game.garageCamera(false);
    const s = this.game.app.settings;
    const el = h(`<div id="menu" class="interactive"><div class="box">
      <h1>SILKROAD</h1>
      <div class="ver">CONVOY WARS · V4</div>
      <button class="btn" data-a="drive">Serbest Sürüş<small>Silkroad dünyasında Tofaş Kartal ile dolaş</small></button>
      <button class="btn" data-a="race">Yarış: Botlara Karşı<small>8 araç · PIT manevrası, blok, kestirme; 4 zorluk seviyesi</small></button>
      <button class="btn" data-a="mp">Çok Oyunculu<small>Arkadaşlarınla yarış ya da takım olup botlara karşı (co-op)</small></button>
      <button class="btn" data-a="rally">Ralli: Zamana Karşı<small>${Object.keys(RALLY_STAGES).length} etap · pilot notlarıyla kontrol noktalı etap</small></button>
      <button class="btn" data-a="garage">Garaj<small>Sürüm ve renk seçimi</small></button>
      <button class="btn" data-a="kervan">Kervan RPG<small>Tüccar ol: mal al, kervanla şehirden şehre taşı, haydutlara karşı koy</small></button>
      <button class="btn secondary" data-a="explore">Dünya Gezgini<small>Serbest kamera ile haritayı gez</small></button>
      <button class="btn secondary" data-a="settings">Ayarlar</button>
      <div class="foot">Araç: <b>${VARIANTS[s.get('vehicleVariant')]?.name || ''}</b> · ${PAINTS[s.get('vehicleColor')]?.name || ''}<br>
      Kumanda desteklenir. Esc: menü · F: tam ekran (fare ile bakış) · F3: performans bilgisi</div>
    </div></div>`);
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const act = a.dataset.a;
      if (act === 'drive') this.cityPicker('drive');
      else if (act === 'explore') this.cityPicker('explore');
      else if (act === 'rally') this.stagePicker();
      else if (act === 'race') this.raceSetup();
      else if (act === 'mp') this.multiplayer();
      else if (act === 'kervan') this.kervanMenu();
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

  /** Kervan RPG: kayitli oyuna devam ya da yeni kervan (gorunum secimi). */
  kervanMenu() {
    this.clear();
    const s = this.game.app.settings;
    let save = null;
    try { save = JSON.parse(localStorage.getItem('sro-v4-kervan') || 'null'); } catch { /* */ }
    const looks = [['player_ch_m', 'Çinli tüccar', 'Jangan doğumlu'], ['player_ch_w', 'Çinli tüccar kadın', 'Jangan doğumlu'],
      ['player_eu_m', 'Avrupalı tüccar', 'Konstantiniyye kökenli'], ['player_eu_w', 'Avrupalı tüccar kadın', 'Konstantiniyye kökenli']];
    let look = s.get('kervanLook') || 'player_ch_m';
    const cityName = (id) => (CITIES.find((c) => c.id === id) || CITIES[0]).name;
    const el = h(`<div class="panel dialog interactive">
      <h2>Kervan RPG</h2>
      ${save ? `<button class="btn" data-a="continue">Devam et<small>${cityName(save.city)} · ${Math.round(save.gold).toLocaleString('tr-TR')} altın · seviye ${save.level} · ${save.stats ? save.stats.trips : 0} sefer</small></button>` : ''}
      <div style="color:var(--muted);font-size:13px;margin:${save ? 14 : 0}px 0 6px">${save ? 'ya da yeni bir kervan kur:' : 'Görünümünü seç:'}</div>
      <div class="grid2">${looks.map(([k, n, d]) => `<div class="card ${k === look ? 'sel' : ''}" data-l="${k}"><b>${n}</b><span>${d}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn secondary" data-a="back" style="width:auto">← Geri</button><div style="flex:1"></div>
      <button class="btn" data-a="new" style="width:auto">Yeni kervan · Jangan →</button></div>
      ${save ? '<div class="note" style="font-size:12px;color:var(--muted);margin-top:8px">Yeni kervan kurmak kayıtlı ilerlemeni siler.</div>' : ''}
    </div>`);
    el.addEventListener('click', (e) => {
      const l = e.target.closest('[data-l]');
      if (l) { look = l.dataset.l; el.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('sel', x === l)); return; }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'back') this.main();
      if (a.dataset.a === 'continue') { this.clear(); this.game.startKervan(save.city || 'jangan', { look: save.look || look }); }
      if (a.dataset.a === 'new') { s.set('kervanLook', look); this.clear(); this.game.startKervan('jangan', { fresh: true, look }); }
    });
    this.root.appendChild(el);
    this.layer = el;
  }

  /** Ralli (zamana karsi): etap secimi. */
  stagePicker() {
    this.clear();
    const s = this.game.app.settings;
    let sel = RALLY_STAGES[s.get('rallyStage')] ? s.get('rallyStage') : Object.keys(RALLY_STAGES)[0];
    const el = h(`<div class="panel dialog interactive">
      <h2>Ralli etabı</h2>
      <div class="grid2">${Object.entries(RALLY_STAGES).map(([id, st]) => `<div class="card ${id === sel ? 'sel' : ''}" data-s="${id}"><b>${st.name}</b><span>${stageInfo(st)}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:16px"><button class="btn secondary" data-a="back" style="width:auto">← Geri</button><div style="flex:1"></div>
      <button class="btn" data-a="go" style="width:auto">Başla →</button></div>
    </div>`);
    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-s]');
      if (c) { sel = c.dataset.s; el.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('sel', x === c)); return; }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'back') this.main();
      if (a.dataset.a === 'go') { s.set('rallyStage', sel); this.clear(); this.game.startRally(sel); }
    });
    this.root.appendChild(el);
    this.layer = el;
  }

  /** Botlara karsi yaris: etap, rakip sayisi, zorluk, araclar, baslangic sirasi. */
  raceSetup() {
    this.clear();
    const s = this.game.app.settings;
    const cfg = {
      stage: RALLY_STAGES[s.get('raceStage')] ? s.get('raceStage') : Object.keys(RALLY_STAGES)[0],
      bots: s.get('raceBots') ?? 7, level: s.get('raceLevel') || 'orta', cars: s.get('raceCars') || 'same', grid: s.get('raceGrid') || 'back',
    };
    const opt = (k, items) => items.map(([v, l]) => `<option value="${v}" ${String(cfg[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
    const el = h(`<div class="panel dialog interactive" style="width:min(860px,95vw)">
      <h2>Yarış: Botlara Karşı</h2>
      <div style="color:var(--muted);font-size:13px;margin-bottom:6px">Etap</div>
      <div class="grid3">${Object.entries(RALLY_STAGES).map(([id, st]) => `<div class="card ${id === cfg.stage ? 'sel' : ''}" data-s="${id}"><b>${st.name}</b><span>${stageInfo(st)}</span></div>`).join('')}</div>
      <div style="color:var(--muted);font-size:13px;margin:14px 0 6px">Bot zorluğu <span style="opacity:.7">(aynı araçlar, ek güç yok: fark sürüş becerisi ve kirli taktiklerde)</span></div>
      <div class="grid2">${Object.entries(DIFFICULTY).map(([id, d]) => `<div class="card ${id === cfg.level ? 'sel' : ''}" data-l="${id}"><b>${d.label}</b><span>${LEVEL_DESC[id]}</span></div>`).join('')}</div>
      <div class="setting" style="margin-top:12px"><label>Rakip sayısı</label><select data-k="bots">${opt('bots', [1, 2, 3, 4, 5, 6, 7].map((n) => [n, `${n} bot (${n + 1} araç)`]))}</select></div>
      <div class="setting"><label>Botların araçları</label><select data-k="cars">${opt('cars', [['same', 'Herkes benim aracımla'], ['mixed', 'Karışık (garajdaki tüm araçlar)']])}</select></div>
      <div class="setting"><label>Başlangıç sırası</label><select data-k="grid">${opt('grid', [['back', 'En arkadan'], ['random', 'Rastgele'], ['front', 'En önden']])}</select></div>
      <div class="row" style="margin-top:16px"><button class="btn secondary" data-a="back" style="width:auto">← Geri</button><div style="flex:1"></div>
      <button class="btn" data-a="go" style="width:auto">Yarışa başla →</button></div>
    </div>`);
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (k) cfg[k] = k === 'bots' ? Number(e.target.value) : e.target.value;
    });
    el.addEventListener('click', (e) => {
      const st = e.target.closest('[data-s]');
      if (st) { cfg.stage = st.dataset.s; el.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('sel', x === st)); return; }
      const l = e.target.closest('[data-l]');
      if (l) { cfg.level = l.dataset.l; el.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('sel', x === l)); return; }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'back') this.main();
      if (a.dataset.a === 'go') {
        s.set('raceStage', cfg.stage); s.set('raceBots', cfg.bots); s.set('raceLevel', cfg.level); s.set('raceCars', cfg.cars); s.set('raceGrid', cfg.grid);
        this.clear();
        this.game.startRace({ ...cfg });
      }
    });
    this.root.appendChild(el);
    this.layer = el;
  }

  /** Cok oyunculu: isim, oda kur / katil, acik odalar, yerel ag bilgisi. */
  async multiplayer() {
    this.clear();
    const game = this.game, s = game.app.settings;
    const el = h(`<div class="panel dialog interactive" style="width:min(640px,94vw)">
      <h2>Çok Oyunculu Yarış</h2>
      <div class="setting"><label>Adın</label><input data-k="name" maxlength="20" value="${esc(s.get('mpName') || 'Oyuncu')}"></div>
      <div class="row" style="gap:8px;align-items:center"><button class="btn" data-a="create" style="width:auto">Oda kur</button>
        <div style="flex:1"></div><input data-k="code" placeholder="ODA KODU" maxlength="4" style="width:120px;text-transform:uppercase;text-align:center">
        <button class="btn secondary" data-a="join" style="width:auto">Odaya katıl</button></div>
      <div style="color:var(--muted);font-size:13px;margin:14px 0 6px">Açık odalar</div>
      <div class="rooms" style="min-height:40px;font-size:14px">Bağlanıyor…</div>
      <div class="lan note" style="font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5"></div>
      <div class="err" style="color:#ff8a7a;margin-top:6px"></div>
      <div class="row" style="margin-top:14px"><button class="btn secondary" data-a="back" style="width:auto">← Geri</button></div>
    </div>`);
    this.root.appendChild(el);
    this.layer = el;
    const err = (t) => { el.querySelector('.err').textContent = t || ''; };
    const name = () => (el.querySelector('[data-k="name"]').value.trim() || 'Oyuncu').slice(0, 20);
    fetch(`${hostBase()}/api/info`).then((r) => r.json()).then((info) => {
      const lan = info.lan && info.addresses.length
        ? `Yerel ağdaki arkadaşların tarayıcıda şu adresi açsın: ${info.addresses.map((a) => `<b style="color:var(--gold)">http://${a}:${info.port}/</b>`).join(' ya da ')} — sonra “Çok Oyunculu”dan odana katılsın.`
        : '';
      const web = info.tunnel
        ? '<b style="color:#8fdc7a">İnternet daveti açık.</b> Oda kurunca lobideki “Davet dosyası” ile arkadaşına gönder; açınca doğrudan odana gelir.'
        : info.tunnelWanted ? 'İnternet tüneli açılıyor…'
          : 'İnternetten arkadaş çağırmak için oyunu <b>INTERNET_OYUNU.bat</b> ile başlat (sabit IP ya da modem ayarı gerekmez). Aynı ağdaysanız <b>COKLU_OYUNCU.bat</b> yeter.';
      el.querySelector('.lan').innerHTML = [web, lan].filter(Boolean).join('<br>');
    }).catch(() => {});
    let net;
    try { net = await game.connectNet(name()); } catch (e) { el.querySelector('.rooms').textContent = ''; err(`${e.message}. Sunucu güncel mi? (server.py yeniden başlatılmalı)`); }
    const off = [];
    const go = () => { off.forEach((u) => u()); clearInterval(timer); game.showLobby(); };
    if (net) {
      off.push(net.on('rooms', (m) => {
        const box = el.querySelector('.rooms');
        if (!box) return;
        box.innerHTML = m.list.length ? m.list.map((r) => `<div class="row" style="align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
          <b style="width:70px;letter-spacing:2px">${esc(r.code)}</b><span style="flex:1">${esc(r.host)}</span><span style="width:90px;color:var(--muted)">${r.n}/8${r.started ? ' · yarışta' : ''}</span>
          <button class="btn secondary" data-join="${esc(r.code)}" style="width:auto;padding:4px 12px" ${r.started || r.n >= 8 ? 'disabled' : ''}>Katıl</button></div>`).join('') : '<span style="color:var(--muted)">Açık oda yok — bir oda kur.</span>';
      }));
      off.push(net.on('room', () => go()));
      off.push(net.on('error', (m) => err(m.msg)));
      net.rooms();
    }
    const timer = setInterval(() => { if (!el.isConnected) { clearInterval(timer); off.forEach((u) => u()); return; } if (net) net.rooms(); }, 2000);
    el.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a],[data-join]');
      if (!a) return;
      if (a.dataset.a === 'back') { clearInterval(timer); off.forEach((u) => u()); this.main(); return; }
      s.set('mpName', name());
      try { net = await game.connectNet(name()); } catch (x) { err(x.message); return; }
      if (a.dataset.a === 'create') net.create();
      else if (a.dataset.a === 'join') { const code = el.querySelector('[data-k="code"]').value.trim().toUpperCase(); if (code.length === 4) net.join(code); else err('Oda kodu 4 harf'); }
      else if (a.dataset.join) net.join(a.dataset.join);
    });
  }

  /** Oda lobisi: oyuncular, araclar, hazirlik; kurucu etap/mod/bot ayarlarini yapar ve baslatir. */
  lobby(lob, net) {
    this.clear();
    const s = this.game.app.settings;
    const el = h(`<div class="panel dialog interactive" style="width:min(820px,95vw)"><div class="body"></div></div>`);
    this.root.appendChild(el);
    this.layer = el;
    const body = el.querySelector('.body');
    const sel = (k, items, val, dis) => `<select data-c="${k}" ${dis ? 'disabled' : ''}>${items.map(([v, l]) => `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const mb = (b) => `${(b / 1048576).toFixed(b < 10485760 ? 1 : 0)} MB`;
    // oyuncu durumu: surum, etap dosyalari, hazirlik
    const status = (r) => {
      if (r.host) return 'kurucu';
      if (r.pending) return '<span style="color:var(--muted)">bağlanıyor…</span>';
      if (!lob.compat(r.ver)) return '<span style="color:#ff8a7a">sürüm farklı</span>';
      if (r.pack !== lob.cfg.stage) return r.prog === -1 ? '<span style="color:#ff8a7a">indirme hatası</span>' : `<span style="color:var(--muted)">dosyalar iniyor${r.prog !== null && r.prog !== undefined ? ` %${r.prog}` : ''}</span>`;
      return r.ready ? '<b style="color:#8fdc7a">Hazır</b>' : '<span style="color:var(--muted)">bekliyor</span>';
    };
    // uye: etap paketi ilerlemesi (kurucunun dosyalari kendinde)
    const packRow = () => {
      if (net.isHost) {
        const old = lob.rows().some((r) => !r.bot && !r.host && !r.pending && !lob.compat(r.ver));
        return old ? `<div style="margin-top:10px;font-size:13px;color:#ff8a7a">Bir oyuncunun oyun sürümü seninkinden farklı. Değişikliklerini yayınla
          (<code>python tools/publish_pages.py publish</code>), sonra arkadaşın sayfayı yenilesin.</div>` : '';
      }
      const P = lob.pack;
      if (!lob.versionOk) {
        const hv = lob.hostVer || {};
        return `<div style="margin-top:10px;font-size:13px;color:#ff8a7a">Oyun sürümün kurucununkinden farklı (kurucu: ${esc(hv.build || '?')}, sen: ${esc(lob.verInfo().build)}). Kurucu yeni sürümü yayınlamalı; sonra bu sayfayı yenile.</div>`;
      }
      if (P.state === 'error') return `<div style="margin-top:10px;font-size:13px;color:#ff8a7a">${esc(P.error || 'İndirme hatası')} <button class="btn secondary" data-a="retry" style="width:auto;padding:4px 10px">Tekrar dene</button></div>`;
      if (P.state === 'ready') return `<div style="margin-top:10px;font-size:13px;color:#8fdc7a">Etap dosyaları hazır ✓ <span style="color:var(--muted)">(${mb(P.totalBytes)} · ${P.downloaded ? `${mb(P.downloaded)} indirildi` : 'hepsi bu bilgisayarda kayıtlıydı'})</span></div>`;
      const pct = P.totalBytes ? Math.round((P.bytes / P.totalBytes) * 100) : 0;
      return `<div style="margin-top:10px;font-size:13px">Etap dosyaları indiriliyor: ${mb(P.bytes)} / ${P.totalBytes ? mb(P.totalBytes) : '…'} (%${pct}) — bitince “Hazırım” açılır
        <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--gold-2),var(--gold))"></div></div></div>`;
    };
    // internet daveti (sunucu tuneli aciksa): davet dosyasi / baglanti
    let info = null, copied = false;
    const loadInfo = () => fetch(`${hostBase()}/api/info`).then((r) => r.json()).then((x) => { info = x; render(); if (x.tunnelWanted && !x.tunnel && el.isConnected) setTimeout(loadInfo, 3000); }).catch(() => {});
    const inviteRow = () => {
      if (!info) return '';
      if (info.tunnel) {
        return `<div class="row" style="margin-top:10px;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(232,193,112,0.3);border-radius:6px">
          <span style="flex:1;font-size:13px">İnternetten arkadaş çağır: dosyayı (WhatsApp, e-posta…) gönder, açınca odaya gelir.</span>
          <button class="btn" data-a="invite" style="width:auto;padding:6px 12px">Davet dosyası (.html)</button>
          <button class="btn secondary" data-a="copy" style="width:auto;padding:6px 12px">${copied ? 'Kopyalandı ✓' : 'Bağlantıyı kopyala'}</button></div>`;
      }
      if (!net.isHost) return '';   // sunucu ayari yalniz kurucuyu ilgilendirir
      if (info.tunnelWanted) return '<div style="margin-top:10px;font-size:13px;color:var(--muted)">İnternet tüneli açılıyor…</div>';
      return '<div style="margin-top:10px;font-size:12px;color:var(--muted)">İnternetten arkadaş çağırmak için oyunu <b>INTERNET_OYUNU.bat</b> ile başlat.</div>';
    };
    // lobi sik guncellenir (indirme ilerlemesi): yalniz degisen bolum yeniden yazilir, boylece
    // acik bir secim kutusu ya da tiklanan dugme kaybolmaz
    body.innerHTML = `<h2 data-s="title"></h2><div data-s="table"></div><div data-s="settings"></div><div data-s="pack"></div>
      <div data-s="invite"></div><div data-s="err" class="err" style="color:#ff8a7a;margin-top:6px"></div><div data-s="actions"></div>`;
    const last = {};
    const put = (k, html) => { if (last[k] === html) return; last[k] = html; body.querySelector(`[data-s="${k}"]`).innerHTML = html; };
    const render = () => {
      if (!el.isConnected) return;
      const host = net.isHost, cfg = lob.cfg, rows = lob.rows();
      const humans = net.members.length;
      const carName = (v) => (VARIANTS[v] ? VARIANTS[v].name : v || '—');
      const dot = (p) => `<span class="dot" style="background:${PAINTS[p] ? PAINTS[p].color : '#888'}"></span>`;
      put('title', `Oda <span style="letter-spacing:4px;color:var(--gold)">${esc(net.room ? net.room.code : '')}</span>`);
      put('table', `<table class="results" style="margin-bottom:12px"><tr><th></th><th>Sürücü</th><th>Araç</th><th>Durum</th></tr>
        ${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}.</td><td>${r.host ? '👑 ' : ''}${esc(r.name)}${r.bot ? ' <span style="color:var(--muted)">(bot)</span>' : ''}</td>
          <td>${r.bot ? `<span style="color:var(--muted)">${cfg.botCars === 'mixed' ? 'karışık' : 'kurucunun aracı'}</span>` : `${dot(r.paint)}${esc(carName(r.variant))}`}</td>
          <td>${r.bot ? `<span style="color:var(--muted)">${esc((DIFFICULTY[cfg.level] || {}).label || '')}</span>` : status(r)}</td></tr>`).join('')}
        </table>`);
      put('settings', `<div class="grid2" style="gap:6px 14px">
          <div class="setting"><label>Etap</label>${sel('stage', Object.entries(RALLY_STAGES).map(([id, st]) => [id, `${st.name} (${(st.length / 1000).toFixed(1)} km)`]), cfg.stage, !host)}</div>
          <div class="setting"><label>Mod</label>${sel('mode', [['ffa', 'Herkes kendi için'], ['team', 'Takım: oyuncular botlara karşı (co-op)']], cfg.mode, !host)}</div>
          <div class="setting"><label>Bot sayısı</label>${sel('bots', [...Array(8 - humans + 1).keys()].map((n) => [n, `${n} bot`]), Math.min(cfg.bots, 8 - humans), !host)}</div>
          <div class="setting"><label>Bot zorluğu</label>${sel('level', Object.entries(DIFFICULTY).map(([id, d]) => [id, d.label]), cfg.level, !host)}</div>
          <div class="setting"><label>Bot araçları</label>${sel('botCars', [['same', 'Kurucunun aracı'], ['mixed', 'Karışık']], cfg.botCars, !host)}</div>
          <div class="setting"><label>Aracın</label>${sel('myVariant', Object.entries(VARIANTS).map(([id, v]) => [id, v.name]), s.get('vehicleVariant'), lob.ready && !host)} ${sel('myPaint', Object.entries(PAINTS).map(([id, p]) => [id, p.name]), s.get('vehicleColor'), lob.ready && !host)}</div>
        </div>`);
      put('pack', packRow());
      put('invite', inviteRow());
      put('err', esc(lob.error || ''));
      put('actions', `<div class="row" style="margin-top:14px;align-items:center">
          <button class="btn secondary" data-a="leave" style="width:auto">← Odadan çık</button><div style="flex:1"></div>
          ${host ? `<span style="color:var(--muted);font-size:12px;margin-right:10px">${lob.canStart() ? '' : 'Herkesin dosyaları inip “Hazır” olunca başlatabilirsin'}</span><button class="btn" data-a="start" style="width:auto" ${lob.canStart() ? '' : 'disabled'}>Yarışı başlat →</button>`
            : `<button class="btn" data-a="ready" style="width:auto" ${lob.ready || lob.canReady() ? '' : 'disabled'}>${lob.ready ? 'Hazır değilim' : !lob.versionOk ? 'Sürüm farklı' : lob.pack.state === 'ready' ? 'Hazırım' : lob.pack.state === 'error' ? 'Dosyalar eksik' : 'Dosyalar iniyor…'}</button>`}
        </div>`);
    };
    lob.onChange = render;
    lob.onPack = () => { if (el.isConnected) put('pack', packRow()); };
    el.addEventListener('change', (e) => {
      const k = e.target.dataset.c;
      if (!k) return;
      const v = e.target.value;
      if (k === 'myVariant') { s.set('vehicleVariant', v); this.game.previewCar(); lob.publish(); return; }
      if (k === 'myPaint') { s.set('vehicleColor', v); this.game.previewCar(true); lob.publish(); return; }
      lob.setCfg(k, k === 'bots' ? Number(v) : v);
    });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'leave') { this.game.leaveNet(); this.multiplayer(); }
      if (a.dataset.a === 'ready') lob.toggleReady();
      if (a.dataset.a === 'retry') lob.retryPack();
      if (a.dataset.a === 'start') lob.start();
      if ((a.dataset.a === 'invite' || a.dataset.a === 'copy') && info && info.tunnel && net.room) {
        const host = (lob.players[net.room.host] && lob.players[net.room.host].name) || net.name;
        const st = RALLY_STAGES[lob.cfg.stage];
        const opts = { url: info.tunnel, code: net.room.code, host, stage: lob.cfg.stage, stageName: st ? st.name : '' };
        if (a.dataset.a === 'invite') downloadInvite(opts);
        else navigator.clipboard.writeText(inviteLink(opts)).then(() => { copied = true; render(); setTimeout(() => { copied = false; render(); }, 2500); }).catch(() => {});
      }
    });
    render();
    loadInfo();
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
      <div class="prep" style="${String(s.get('vehicleVariant')).startsWith('kartal') ? '' : 'display:none'}">
        <div style="color:var(--muted);font-size:13px;margin:14px 0 6px">Kartal hazırlığı</div>
        <div class="grid2">${Object.entries(PREPS).map(([id, v]) => `<div class="card ${id === s.get('vehiclePrep') ? 'sel' : ''}" data-r="${id}"><b>${v.name}</b><span>${v.desc}</span></div>`).join('')}</div>
      </div>
      <div style="color:var(--muted);font-size:13px;margin:14px 0 6px">Renk</div>
      <div class="swatches">${Object.entries(PAINTS).map(([id, p]) => `<div class="swatch ${id === s.get('vehicleColor') ? 'sel' : ''}" title="${p.name}" data-p="${id}" style="background:${p.color}"></div>`).join('')}</div>
      <div class="row"><button class="btn" data-a="back" style="width:auto">← Tamam</button></div>
    </div>`);
    el.addEventListener('click', (e) => {
      const v = e.target.closest('[data-v]');
      if (v) {
        s.set('vehicleVariant', v.dataset.v);
        el.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('sel', x === v));
        el.querySelector('.prep').style.display = v.dataset.v.startsWith('kartal') ? '' : 'none';
        this.game.previewCar();
        return;
      }
      const r = e.target.closest('[data-r]');
      if (r) { s.set('vehiclePrep', r.dataset.r); el.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('sel', x === r)); this.game.previewCar(); return; }
      const p = e.target.closest('[data-p]');
      if (p) { s.set('vehicleColor', p.dataset.p); el.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('sel', x === p)); this.game.previewCar(true); return; }
      if (e.target.closest('[data-a="back"]')) onBack();
    });
    this.root.appendChild(el);
    this.layer = el;
    this.game.garageCamera(true, el);
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
