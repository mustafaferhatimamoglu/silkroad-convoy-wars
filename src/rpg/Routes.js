import { ROUTE } from './Economy.js';

// Sehirler arasi kervan yolu: kara + feribot / ucan gemi gecisleri. Iskeleler oyunun kendi
// isinlanma tablosundan (assets/data/ferries.json); hangi gecisin hangi iki sehir arasinda
// kullanildigi burada (orijinal oyundaki yollar: Sari Nehir feribotu, Karakurum gemisi...).

const SEGMENTS = {
  'jangan>donwhang': [[3, 4]],                 // Jangan iskelesi -> Donwhang kiyisi (Sari Nehir)
  'donwhang>hotan': [[14, 12]],                // Donwhang yakasi -> Hotan yakasi
  'hotan>samarkand': [[16, 28]],               // Karakurum ucan gemisi -> Orta Asya
  'samarkand>constantinople': [[22, 21]],      // Anadolu feribotu -> Konstantiniyye kiyisi
  'constantinople>alexandria': [[21, 177]],    // deniz yolu -> Iskenderiye
};

export const GATE_NAMES = {
  3: 'Jangan iskelesi', 4: 'Donwhang kıyısı iskelesi', 6: 'Donwhang kıyısı (2)', 9: 'Jangan iskelesi (2)',
  12: 'Hotan yakası iskelesi', 13: 'Hotan yakası (2)', 14: 'Donwhang yakası iskelesi', 15: 'Donwhang yakası (2)',
  16: 'Karakurum gemi iskelesi', 17: 'Karakurum gemisi (2)', 18: 'Roc Dağı gemisi', 19: 'Roc Dağı gemisi (2)',
  21: 'Konstantiniyye limanı', 22: 'Anadolu iskelesi', 23: 'Anadolu iskelesi (2)', 24: 'Anadolu gemi iskelesi',
  28: 'Orta Asya gemi iskelesi', 31: 'Roc Dağı gemisi (3)', 177: 'İskenderiye limanı',
};

/** a -> b sehirleri arasi gecis listesi [[cikis kapisi, varis kapisi], ...] (komsu olmayanlar birlesir). */
export function crossings(a, b) {
  const i = ROUTE.indexOf(a), j = ROUTE.indexOf(b);
  if (i < 0 || j < 0 || i === j) return [];
  const out = [];
  const step = j > i ? 1 : -1;
  for (let k = i; k !== j; k += step) {
    const x = ROUTE[k], y = ROUTE[k + step];
    if (step > 0) out.push(...(SEGMENTS[`${x}>${y}`] || []));
    else out.push(...(SEGMENTS[`${y}>${x}`] || []).map(([p, q]) => [q, p]).reverse());
  }
  return out;
}
