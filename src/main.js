import { App } from './core/App.js';
import { Game } from './Game.js';
import { hostBase } from './version.js';
import { requestPersistence, dropStale } from './net/AssetSync.js';

// Giris noktasi: yukleme ekrani -> uygulama -> ana menu.
// Test kisayollari: ?mode=drive&city=hotan | ?mode=explore&city=jangan | ?mode=garage | ?mode=rally | &debug=1

const ui = document.getElementById('ui');
const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);
// istenen dosyalarin tam listesi (etap paketlerini olusturan arac okur: tools/packs.py)
try { performance.setResourceTimingBufferSize(200000); } catch { /* */ }

const TIPS = [
  'Silkroad zemin dokuları orijinal oyundan alınmıştır; yakından bakınca taş, kum ve çimen ayrıntıları görünür.',
  'Kum ve çimen taş kadar tutmaz: virajlara çölde daha yavaş girin, fren mesafesi uzar.',
  'El freni (Boşluk) arka tekerlekleri kilitler; kontrollü kaydırma için kısa basın.',
  'Durunca geri tuşunu basılı tutun: araç geri vitese geçer.',
  'Kokpit kamerasında (C) gösterge paneli gerçek hızı ve devri gösterir.',
  'L ile farları açın: gece Silkroad yolları zifiri karanlıktır.',
];

function loadingScreen() {
  const el = document.createElement('div');
  el.id = 'loading';
  el.innerHTML = `<h1>SILKROAD</h1><div class="sub">CONVOY WARS · V4</div>
    <div class="bar"><div></div></div><div class="msg"></div>
    <div class="tip">${TIPS[Math.floor(Math.random() * TIPS.length)]}</div>`;
  ui.appendChild(el);
  return {
    el,
    set(p, msg) { el.querySelector('.bar > div').style.width = `${Math.round(p * 100)}%`; if (msg) el.querySelector('.msg').textContent = msg; },
    done() { el.classList.add('fade'); setTimeout(() => el.remove(), 700); },
  };
}

function debugOverlay(app) {
  const el = document.createElement('div');
  el.id = 'debug';
  ui.appendChild(el);
  app.renderer.info.autoReset = false;
  let acc = 0;
  app.onFrame((dt) => {
    acc += dt;
    if (acc < 0.25) { app.renderer.info.reset(); return; }
    acc = 0;
    const i = app.renderer.info;
    const s = app.world.stats;
    const tp = app.world.tilePool.stats(), op = app.world.objPool.stats();
    const f = app.mode && app.mode.focus;
    const p = f ? app.world.fromThree(f.x, f.z) : null;
    el.textContent = `FPS ${app.fps.toFixed(0)}  çizim ${i.render.calls}  üçgen ${(i.render.triangles / 1e6).toFixed(2)}M
bölge yakın ${s.near} uzak ${s.far} bekleyen ${s.pendingNear}
zemin dokusu ${tp.used}/${tp.capacity} (aktif ${tp.refd})  obje dokusu ${op.used}/${op.capacity}
${p ? `bölge ${p.rx},${p.rz}  yerel ${p.lx.toFixed(0)},${p.lz.toFixed(0)}  y ${f.y.toFixed(1)}` : ''}`;
    i.reset();
  });
  el.classList.toggle('hidden', !app.settings.get('showDebug') && !params.has('debug'));
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); el.classList.toggle('hidden'); } });
}

/**
 * Oyun sunucusu: sayfa dogrudan sunucudan aciliyorsa 'local'. GitHub Pages kopyasi davetle
 * (?host=...) aciliyorsa service worker Silkroad dosyalarini davet edenden indirip kalici
 * onbellekte tutar ('remote'). Pages davetsiz acildiysa 'nohost'.
 */
async function setupHost() {
  const host = hostBase();
  if (!host) return /github\.io$/.test(location.hostname) ? 'nohost' : 'local';
  if (!('serviceWorker' in navigator) || !('caches' in self)) throw new Error('Bu tarayıcı desteklemiyor: Chrome ya da Edge kullanın.');
  // adres once onbellege yazilir: service worker ilk istekte de bilsin (yeniden basladiysa bile)
  const scope = new URL('./', location.href).href;
  await (await caches.open('sro-assets')).put(new URL('__sro_host__', scope).href, new Response(host));
  const reg = await navigator.serviceWorker.register('sw.js');
  if (!navigator.serviceWorker.controller) {
    await new Promise((r) => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 5000); });
  }
  const sw = navigator.serviceWorker.controller || reg.active;
  if (sw) sw.postMessage({ host });
  requestPersistence();
  return 'remote';
}

async function main() {
  const hostMode = await setupHost();
  if (hostMode === 'nohost') {
    ui.innerHTML = `<div class="panel dialog" style="text-align:center"><h2>Silkroad: Convoy Wars</h2>
      <p>Bu sayfa bir yarış davetiyle açılır. Arkadaşından gelen <b>davet dosyasını (.html)</b> aç ve
      “Yarışa katıl”a bas; oyun ve Silkroad dosyaları oradan yüklenir.</p></div>`;
    return;
  }
  const loading = loadingScreen();
  if (hostMode === 'remote' && params.get('stage')) {
    // davetle acilis: onbellekte eski kalmis dosyalari (davet eden degistirdiyse) once temizle
    loading.set(0.02, 'Dosya sürümleri denetleniyor…');
    try { await dropStale(params.get('stage')); } catch { /* davet edene ulasilamadi: onbellekle acilir */ }
  }
  const app = new App(canvas, ui);
  window.app = app; // hata ayiklama icin
  await app.init((p, m) => loading.set(p, m));
  debugOverlay(app);
  const game = new Game(app);
  window.game = game;
  app.start();
  const city = params.get('city');
  if (city) app.settings.set('lastCity', city);
  // internet daveti: ?join=ODA&name=AD&stage=ETAP (davet dosyasindan gelir)
  const join = params.get('join');
  if (join && params.get('stage')) app.settings.set('lastCity', params.get('stage'));
  // test kisayolu: &variant=hilux&paint=beyaz&prep=stok
  for (const [q, k] of [['variant', 'vehicleVariant'], ['paint', 'vehicleColor'], ['prep', 'vehiclePrep']]) if (params.get(q)) app.settings.set(k, params.get(q));
  await game.boot(loading);
  loading.set(1, 'Hazır');
  loading.done();
  const mode = params.get('mode');
  if (join) {
    history.replaceState(null, '', location.pathname);   // yenilemede ayni odaya tekrar katilmasin
    game.joinInvite(join, params.get('name'));
  } else if (mode === 'drive') game.startDrive(city || app.settings.get('lastCity'));
  else if (mode === 'explore') game.startExplore(city || 'jangan');
  else if (mode === 'rally') game.startRally(params.get('stage') || 'hotan');
  else if (mode === 'race') {
    // test kisayolu: &stage=hotan&bots=7&level=zor&cars=mixed&grid=back&seed=1&auto=1 (auto: oyuncu aracini da bot surer)
    game.startRace({ stage: params.get('stage') || 'hotan', bots: Number(params.get('bots') ?? 7), level: params.get('level') || 'orta',
      cars: params.get('cars') || 'same', grid: params.get('grid') || 'back', seed: Number(params.get('seed') || 0) || undefined, auto: params.get('auto') === '1' });
  }
  else if (mode === 'garage') game.menu.garage();
  else if (mode === 'kervan') game.startKervan(city || 'jangan');
  else if (mode === 'chars') game.startCharView(city || 'jangan', params.get('keys') ? params.get('keys').split(',') : null);
}

// geri/ileri onbellekten donen sayfa: ag baglantisi kapanmistir, temiz baslat
addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

main().catch((e) => {
  console.error(e);
  const el = document.createElement('div');
  el.className = 'panel dialog';
  el.innerHTML = `<h2>Başlatılamadı</h2><pre style="white-space:pre-wrap">${String((e && e.stack) || e)}</pre>`;
  ui.appendChild(el);
});
