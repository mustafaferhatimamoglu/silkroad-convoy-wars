import * as THREE from 'three';
import { App } from './core/App.js';
import { ExploreMode } from './modes/ExploreMode.js';
import { cityById } from './data/cities.js';

// Giris noktasi: yukleme ekrani -> uygulama -> mod.
// Test icin URL parametreleri: ?mode=explore&city=hotan

const ui = document.getElementById('ui');
const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);

const TIPS = [
  'Silkroad zemin dokuları orijinal oyundan birebir alınmıştır; yakından bakınca taş, kum ve çimen ayrıntıları görünür.',
  'Kum ve çimen asfalt kadar tutmaz: virajlara çölde daha yavaş girin.',
  'El freni (Boşluk) arka tekerlekleri kilitler; kontrollü kaydırma için kısa basın.',
];

function loadingScreen() {
  const el = document.createElement('div');
  el.id = 'loading';
  el.innerHTML = `<h1>SILKROAD</h1><div class="sub">CONVOY WARS · V4</div>
    <div class="bar"><div></div></div><div class="msg"></div>
    <div class="tip">${TIPS[Math.floor(Math.random() * TIPS.length)]}</div>`;
  ui.appendChild(el);
  return {
    set(p, msg) { el.querySelector('.bar > div').style.width = `${Math.round(p * 100)}%`; if (msg) el.querySelector('.msg').textContent = msg; },
    done() { el.classList.add('fade'); setTimeout(() => el.remove(), 700); },
  };
}

async function waitForWorld(app, pos, loading, from = 0.2, to = 1.0) {
  // yakin bolgeler (ve objeleri) yuklenene kadar bekle
  const t0 = performance.now();
  while (!app.world.readyAround(pos.x, pos.z, 1)) {
    const s = app.world.stats;
    const total = Math.max(1, s.near + s.pendingNear);
    loading.set(from + (to - from) * (s.near / total) * 0.9, `Bölgeler yükleniyor… (${s.near}/${total})`);
    await new Promise((r) => setTimeout(r, 100));
    if (performance.now() - t0 > 60000) break;
  }
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

  const city = cityById(params.get('city') || 'hotan');
  const start = app.world.toThree(city.rx, city.rz, city.lx, 0, city.lz, new THREE.Vector3());
  start.y = 40;
  const explore = new ExploreMode(app, start);
  app.setMode(explore);
  app.start();
  await waitForWorld(app, start, loading);
  const top = groundTop(app, start.x, start.z);
  if (params.get('mode') === 'garage') {
    const { GarageMode } = await import('./modes/GarageMode.js');
    app.setMode(new GarageMode(app, { variant: params.get('variant') || 'kartal80', paint: params.get('paint') || 'lacivert', at: new THREE.Vector3(start.x, top, start.z) }));
  } else if (params.get('mode') === 'drive') {
    const { DriveMode } = await import('./modes/DriveMode.js');
    app.setMode(new DriveMode(app, { city: city.id }));
  } else {
    explore.teleport(new THREE.Vector3(start.x, top + 12, start.z + 25));
  }
  loading.set(1, 'Hazır');
  loading.done();
}

/** Bir noktadaki en ust yuzey (arazi veya obje) yuksekligi. */
function groundTop(app, x, z) {
  const hit = { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), object: false, surface: 0 };
  if (app.collision.raycast(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0), 900, hit)) return hit.point.y;
  return app.world.heightAt(x, z) ?? 0;
}

main().catch((e) => {
  console.error(e);
  const el = document.createElement('div');
  el.className = 'panel dialog';
  el.innerHTML = `<h2>Başlatılamadı</h2><pre style="white-space:pre-wrap">${String(e && e.stack || e)}</pre>`;
  ui.appendChild(el);
});
