// Kervan ticareti: sehir ozel mallari, fiyatlar ve binekler.
// Mallar oyunun kendi ticaret mallaridir (ITEM_ETC_TRADE_*); Turkce adlar burada.
// Fiyat: alis sehrinde taban fiyat; satis = taban x (1 + 0.55 x yol asamasi) x talep x gunluk dalga.
// Ayni sehirde geri satmak zarar ettirir. Uzak yol daha karli ama daha tehlikelidir.

export const ROUTE = ['jangan', 'donwhang', 'hotan', 'samarkand', 'constantinople', 'alexandria'];

export const GOODS = {
  CH_01: { tr: 'Beyaz İpek', city: 'jangan', base: 110 },
  CH_02: { tr: 'Kırmızı İpek', city: 'jangan', base: 165 },
  CH_03: { tr: 'Mavi Seladon Vazo', city: 'jangan', base: 260 },
  CH_04: { tr: 'Wolju Seladon Vazo', city: 'jangan', base: 380 },
  WC_01: { tr: 'Deri', city: 'donwhang', base: 120 },
  WC_02: { tr: 'Üzengi', city: 'donwhang', base: 175 },
  WC_03: { tr: 'Eyer', city: 'donwhang', base: 270 },
  WC_04: { tr: 'Nal', city: 'donwhang', base: 330 },
  KT_01: { tr: 'Nefrit', city: 'hotan', base: 200 },
  KT_02: { tr: 'Akik', city: 'hotan', base: 260 },
  KT_03: { tr: 'Kristal', city: 'hotan', base: 340 },
  KT_04: { tr: 'Yeşim', city: 'hotan', base: 460 },
  CA_01: { tr: 'Yün', city: 'samarkand', base: 150 },
  CA_02: { tr: 'Lacivert Taşı', city: 'samarkand', base: 290 },
  CA_03: { tr: 'Baharat', city: 'samarkand', base: 230 },
  CA_04: { tr: 'Nar', city: 'samarkand', base: 130 },
  EU_01: { tr: 'Keten', city: 'constantinople', base: 160 },
  EU_02: { tr: 'Parfüm', city: 'constantinople', base: 310 },
  EU_03: { tr: 'Mercan', city: 'constantinople', base: 390 },
  EU_04: { tr: 'İnci', city: 'constantinople', base: 520 },
  SD_01: { tr: 'Tütsü', city: 'alexandria', base: 180 },
  SD_02: { tr: 'Mermer', city: 'alexandria', base: 240 },
  VE_01: { tr: 'Kaymaktaşı', city: 'alexandria', base: 330 },
  VE_02: { tr: 'Bokböceği Tılsımı', city: 'alexandria', base: 450 },
};

export const icon = (code) => `assets/icons/trade_${code.toLowerCase()}.png`;

/** Binekler: kapasite (birim mal), hiz (m/s), can, fiyat. Modeller oyunun ticaret binekleri. */
export const TRANSPORTS = {
  none: { tr: 'Sırt çantası', capacity: 6, speed: 5.0, hp: 0, price: 0, model: null },
  donkey: { tr: 'Yük Eşeği', capacity: 30, speed: 4.2, hp: 900, price: 3000, model: 'cos_t_donkey', lvl: 1 },
  horse: { tr: 'Yük Atı', capacity: 60, speed: 5.4, hp: 1500, price: 12000, model: 'cos_t_horse1', lvl: 2 },
  camel: { tr: 'Yük Devesi', capacity: 100, speed: 4.8, hp: 2600, price: 32000, model: 'cos_t_camel1', lvl: 3 },
};

/** Tuccar seviyeleri: gereken toplam ticaret puani ve satis primi. */
export const TRADER_LEVELS = [
  { xp: 0, bonus: 0 }, { xp: 400, bonus: 0.03 }, { xp: 1500, bonus: 0.06 }, { xp: 4500, bonus: 0.09 },
  { xp: 12000, bonus: 0.12 }, { xp: 30000, bonus: 0.15 }, { xp: 70000, bonus: 0.2 },
];

export function traderLevel(xp) {
  let l = 0;
  for (let i = 0; i < TRADER_LEVELS.length; i++) if (xp >= TRADER_LEVELS[i].xp) l = i;
  return l + 1;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/** Gun ve sehir/mal'a bagli -1..1 dalga (her gun degisir, ayni gun sabit). */
function wave(day, city, code) { return hash(`${day}|${city}|${code}`) * 2 - 1; }

export function routeStage(a, b) { return Math.abs(ROUTE.indexOf(a) - ROUTE.indexOf(b)); }

/** Sehirde bu malin alis fiyati (yalniz kendi sehrinde satilir). */
export function buyPrice(code, city, day) {
  const g = GOODS[code];
  if (!g || g.city !== city) return null;
  return Math.round(g.base * (1 + 0.08 * wave(day, city, code)));
}

/** Sehirde bu mali satarken birim fiyat (tuccar seviyesi primi dahil). */
export function sellPrice(code, city, day, level = 1) {
  const g = GOODS[code];
  if (!g) return 0;
  const stage = routeStage(g.city, city);
  if (stage === 0) return Math.round(g.base * 0.7);
  const demand = 1 + 0.12 * wave(day + 7, city, code);
  const bonus = TRADER_LEVELS[Math.max(0, Math.min(TRADER_LEVELS.length - 1, level - 1))].bonus;
  return Math.round(g.base * (1 + 0.55 * stage) * demand * (1 + bonus));
}

export function goodsOf(city) { return Object.keys(GOODS).filter((k) => GOODS[k].city === city); }
