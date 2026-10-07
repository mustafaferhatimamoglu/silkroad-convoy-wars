// Service worker (yalniz oyunun GitHub Pages kopyasinda calisir).
//
// Silkroad dosyalari (assets/) Pages'te yoktur: istek once tarayicinin kalici onbellegine bakar,
// yoksa davet edenin bilgisayarindan (tunel adresi) indirilip onbellege yazilir. Boylece sunucu
// yeniden baslasa ya da tunel adresi degisse de ayni dosya bir daha inmez. Surum kontrolu:
// net/AssetSync.js etap paket listesindeki icerik ozetlerini (X-Sro-Hash) karsilastirip yalniz
// degisen dosyalari yeniler.

const CACHE = 'sro-assets';
const HOST_KEY = '__sro_host__';
let host = null;
// tani: bu calisma suresince onbellekten verilen / davet edenden indirilen dosyalar
const stats = { hits: 0, fetched: 0, bytes: 0 };

const hostUrl = () => new URL(HOST_KEY, self.registration.scope).href;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.stats && e.ports[0]) e.ports[0].postMessage({ ...stats, host });
  if (d.host) {
    host = d.host;
    e.waitUntil(caches.open(CACHE).then((c) => c.put(hostUrl(), new Response(host))));
  }
});

async function getHost() {
  if (host) return host;
  const c = await caches.open(CACHE);
  const r = await c.match(hostUrl());
  if (r) host = await r.text();
  return host;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(`${scope.pathname}assets/`)) return;
  e.respondWith(serve(url, scope));
});

async function serve(url, scope) {
  const cache = await caches.open(CACHE);
  const key = url.origin + url.pathname;          // surum parametresi (?v=) yok sayilir
  const hit = await cache.match(key);
  if (hit) { stats.hits++; return hit; }
  let h = await getHost();
  if (!h) return new Response('Davet eden oyuna bağlı değil', { status: 503 });
  const rel = url.pathname.slice(scope.pathname.length);
  try {
    let res;
    try {
      res = await fetch(`${h}/${rel}${url.search}`, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    } catch (err) {
      // tunel adresi degismis olabilir: sayfanin yazdigi guncel adresle bir kez daha
      host = null;
      const h2 = await getHost();
      if (!h2 || h2 === h) throw err;
      h = h2;
      res = await fetch(`${h}/${rel}${url.search}`, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    }
    if (res.status === 200) {
      const buf = await res.clone().arrayBuffer();
      stats.fetched++; stats.bytes += buf.byteLength;
      // ozet bilinmiyor: AssetSync paket listesiyle dogrulayip isaretler (tekrar indirmeden)
      await cache.put(key, new Response(buf, { headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' } }));
    }
    return res;
  } catch (err) {
    return new Response('Ağ hatası', { status: 504 });
  }
}
