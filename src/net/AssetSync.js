import { hostBase } from '../version.js';

// Etap paketi senkronu (cok oyunculu lobide, yaris baslamadan once).
//
// Davet edenin sunucusundan paket listesi (assets/packs/<etap>.json: [yol, boyut, ozet]) alinir;
// sunucu ozetleri her istekte dosyalarin guncel iceriginden verir.
//  - Oyun GitHub Pages kopyasindan aciliyorsa: tarayicinin kalici onbelleginde (sw.js ile ayni
//    "sro-assets" deposu) ozeti (X-Sro-Hash) tutan dosyalar atlanir; eksik ya da degismis olanlar
//    davet edenden indirilir (6 paralel, 3 deneme). Sunucu yeniden baslasa, tunel adresi degisse
//    de ayni surumdeki dosya bir daha inmez.
//  - Oyun dogrudan sunucudan aciliyorsa (yerel ag): dosyalar HTTP onbellegine on-yuklenir.
// Ilerleme: onProgress({ done, total, bytes, totalBytes, downloaded }).

const CACHE = 'sro-assets';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sha1(buf) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', buf));
  let s = '';
  for (let i = 0; i < 8; i++) s += d[i].toString(16).padStart(2, '0');
  return s;
}

const tagged = (buf, type, hash) => new Response(buf, { headers: { 'Content-Type': type || 'application/octet-stream', 'X-Sro-Hash': hash } });

/** Paket listesi (sunucudan, onbelleksiz). */
export async function fetchPack(pack) {
  const host = hostBase();
  const r = await fetch(`${host ? `${host}/` : ''}assets/packs/${pack}.json`, { cache: 'no-store' });
  if (r.status === 404) throw new Error(`Kurucuda bu etabın dosya listesi yok (kurucu: python tools/packs.py record ${pack}, sonra write)`);
  if (!r.ok) throw new Error(`Etap dosya listesi alınamadı: ${pack} (${r.status})`);
  return r.json();
}

/**
 * Onbellekteki kopyalari listeyle karsilastir (32'lik gruplar halinde paralel). Ozet etiketi
 * tutan dosya guncel; etiketsiz (oyun acilirken talep uzerine inmis) ya da farkli etiketli olan
 * icerik ozetiyle dogrulanir, ayniysa etiketlenir. Donus: guncel olmayanlar { f, cached }.
 */
async function verify(cache, files, scope, signal, onOk) {
  const need = [];
  for (let i = 0; i < files.length && !signal.aborted; i += 32) {
    await Promise.all(files.slice(i, i + 32).map(async (f) => {
      const key = new URL(f[0], scope).href;
      const hit = await cache.match(key);
      if (hit) {
        if (hit.headers.get('X-Sro-Hash') === f[2]) { onOk(f); return; }
        const buf = await hit.clone().arrayBuffer();
        if (buf.byteLength === f[1] && (await sha1(buf)) === f[2]) {
          await cache.put(key, tagged(buf, hit.headers.get('Content-Type'), f[2]));
          onOk(f);
          return;
        }
      }
      need.push({ f, cached: !!hit });
    }));
  }
  return need;
}

/**
 * Oyun yuklenmeden once: listede olup onbellekte eski kalmis dosyalari sil, service worker
 * bunlari ilk istekte davet edenden taze indirsin (acilista eski surum yuklenmesin).
 * Donus: silinen dosya sayisi.
 */
export async function dropStale(pack) {
  if (!hostBase() || !('caches' in self)) return 0;
  const P = await fetchPack(pack);
  const cache = await caches.open(CACHE);
  const need = await verify(cache, P.files || [], new URL('./', location.href).href, {}, () => {});
  const stale = need.filter((n) => n.cached);
  await Promise.all(stale.map((n) => cache.delete(new URL(n.f[0], new URL('./', location.href)).href)));
  return stale.length;
}

/**
 * Etap paketini indir/dogrula. signal: { aborted } (etap degisince iptal).
 * Donus: { done, total, bytes, totalBytes, downloaded }
 */
export async function syncPack(pack, onProgress = () => {}, signal = {}) {
  const host = hostBase();
  const P = await fetchPack(pack);
  const files = P.files || [];
  const st = { done: 0, total: files.length, bytes: 0, totalBytes: files.reduce((a, f) => a + f[1], 0), downloaded: 0 };
  const report = () => onProgress({ ...st });
  report();
  let need;
  let cache = null;
  const scope = new URL('./', location.href).href;
  if (host && 'caches' in self) {
    cache = await caches.open(CACHE);
    need = (await verify(cache, files, scope, signal, (f) => { st.done++; st.bytes += f[1]; })).map((n) => n.f);
    if (signal.aborted) return st;
    report();
  } else need = files.slice();
  let next = 0;
  const worker = async () => {
    while (next < need.length && !signal.aborted) {
      const f = need[next++];
      for (let attempt = 0; ; attempt++) {
        try {
          if (cache) {
            // ?h=ozet: aradaki onbellekler (tunel) degisen dosyanin eskisini veremez
            const res = await fetch(`${host}/${f[0]}?h=${f[2]}`, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
            if (!res.ok) throw new Error(String(res.status));
            const buf = await res.arrayBuffer();
            // etiket: inen icerigin kendi ozeti (liste alindiktan sonra degismisse sonraki kontrol yeniler)
            await cache.put(new URL(f[0], scope).href, tagged(buf, res.headers.get('Content-Type'), await sha1(buf)));
          } else {
            // ayni sunucu: HTTP onbellegine al (sonraki istekler oradan ya da 304 ile)
            const res = await fetch(f[0]);
            if (!res.ok) throw new Error(String(res.status));
            await res.arrayBuffer();
          }
          break;
        } catch (e) {
          if (attempt >= 2) throw new Error(`İndirilemedi: ${f[0]} (${e.message})`);
          await sleep(700 * (attempt + 1));
        }
      }
      st.done++; st.bytes += f[1]; st.downloaded += f[1];
      report();
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return st;
}

/** Tarayicidan kalici depolama iste (onbellek dolunca dosyalar silinmesin). */
export function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* */ }
}
