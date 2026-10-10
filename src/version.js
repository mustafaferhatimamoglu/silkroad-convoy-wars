// Oyun surumu ve cok oyunculu sunucu adresi.
//
//  VERSION  istemci surumu. Sunucu (server/server.py) ayni surumu tasir; "hello" mesajinda surumler
//           birebir tutmazsa sunucu baglantiyi reddeder. Her degisiklikte tools/bump.py ikisini
//           birlikte yukseltir (5.1.0 -> 5.2.0).
//  RELEASES guncel istemcinin indirilecegi yer (surum uyusmazsa oyuncuya gosterilir).

export const VERSION = '5.4.0';
export const RELEASES = 'https://github.com/mustafaferhatimamoglu/silkroad-convoy-wars/releases';

/**
 * Sunucu adresinden WebSocket / HTTP adresleri. Bos adres: oyunun acildigi sunucu (server.py
 * --client ile ayni adresten). Ornekler: "https://abc.trycloudflare.com", "abc.trycloudflare.com",
 * "192.168.1.5:5070", "localhost:5070".
 */
export function serverUrls(addr = '') {
  let a = String(addr || '').trim().replace(/\/+$/, '').replace(/\/ws$/, '');
  if (!a) {
    const ws = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    return { http: `${location.protocol}//${location.host}`, ws };
  }
  if (!/^[a-z]+:\/\//i.test(a)) {
    // sema yoksa: port ya da yerel/IP adresi -> http, alan adi -> https (tunel)
    const host = a.split('/')[0];
    const local = /:\d+$/.test(host) || /^(localhost|\d+\.\d+\.\d+\.\d+|\[[0-9a-f:]+\])$/i.test(host);
    a = `${local ? 'http' : 'https'}://${a}`;
  }
  a = a.replace(/^ws(s?):\/\//i, 'http$1://');
  return { http: a, ws: `${a.replace(/^http/i, 'ws')}/ws` };
}

/** Kisa veri ozeti (iki oyuncunun ayni etap verisini kullandigini dogrulamak icin). */
export function dataHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
