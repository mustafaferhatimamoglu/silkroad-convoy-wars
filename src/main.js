import { App } from './core/App.js';
import { Game } from './Game.js';

// Giris noktasi: yukleme ekrani -> uygulama -> ana menu.
// Test kisayollari: ?mode=drive&city=hotan | ?mode=explore&city=jangan | ?mode=garage | ?mode=rally | &debug=1

const ui = document.getElementById('ui');
const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);

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

async function main() {
  const loading = loadingScreen();
  const app = new App(canvas, ui);
  window.app = app; // hata ayiklama icin
  await app.init((p, m) => loading.set(p, m));
  debugOverlay(app);
  const game = new Game(app);
  window.game = game;
  app.start();
  const city = params.get('city');
  if (city) app.settings.set('lastCity', city);
  // test kisayolu: &variant=hilux&paint=beyaz&prep=stok
  for (const [q, k] of [['variant', 'vehicleVariant'], ['paint', 'vehicleColor'], ['prep', 'vehiclePrep']]) if (params.get(q)) app.settings.set(k, params.get(q));
  await game.boot(loading);
  loading.set(1, 'Hazır');
  loading.done();
  const mode = params.get('mode');
  if (mode === 'drive') game.startDrive(city || app.settings.get('lastCity'));
  else if (mode === 'explore') game.startExplore(city || 'jangan');
  else if (mode === 'rally') game.startRally();
  else if (mode === 'garage') game.menu.garage();
  else if (mode === 'kervan') game.startKervan(city || 'jangan');
  else if (mode === 'chars') game.startCharView(city || 'jangan', params.get('keys') ? params.get('keys').split(',') : null);
}

main().catch((e) => {
  console.error(e);
  const el = document.createElement('div');
  el.className = 'panel dialog';
  el.innerHTML = `<h2>Başlatılamadı</h2><pre style="white-space:pre-wrap">${String((e && e.stack) || e)}</pre>`;
  ui.appendChild(el);
});
