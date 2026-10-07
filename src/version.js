// Surum ve oyun sunucusu adresi.
//
//  PROTOCOL  cok oyunculu mesaj surumu: degisirse farkli surumdeki oyuncular ayni odada yarisamaz.
//  BUILD     yayinlanan kopyanin kimligi (tools/publish_pages.py commit kimligini yazar; yerelde 'dev').
//  PAGES_URL oyunun herkese acik kopyasi (GitHub Pages): YALNIZ kod. Silkroad dosyalari (assets/,
//            Joymax'in telifli icerigi) orada durmaz; davet edenin bilgisayarindan bir kez inip
//            arkadasin tarayicisinda kalici onbellekte saklanir (sw.js, net/AssetSync.js).

export const PROTOCOL = 2;
export const BUILD = '561be87-2026-10-07';
export const PAGES_URL = 'https://mustafaferhatimamoglu.github.io/silkroad-convoy-wars/';

const KEY = 'sro-host';

/**
 * Oyun sunucusu (davet edenin tunel adresi). Oyun ayni sunucudan aciliyorsa '' (goreli adresler).
 * Pages kopyasi ?host=https://....trycloudflare.com ile acilir; adres oturum boyunca saklanir.
 */
export function hostBase() {
  const p = new URLSearchParams(location.search).get('host');
  if (p) {
    const h = p.replace(/\/+$/, '');
    if (/^https?:\/\/[^/?#]+$/.test(h)) {
      try { sessionStorage.setItem(KEY, h); } catch { /* */ }
      return h;
    }
  }
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}

/** Kisa veri ozeti (iki oyuncunun ayni etap verisini kullandigini dogrulamak icin). */
export function dataHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
