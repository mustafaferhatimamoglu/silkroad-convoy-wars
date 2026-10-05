import { TRANSPORTS, traderLevel } from './Economy.js';

// Tuccarin kalici durumu: altin, yuk, binek, seviyeler. localStorage'da saklanir.

const KEY = 'sro-v4-kervan';

export const LEVEL_XP = (lvl) => Math.round(120 * lvl ** 1.75);   // savas seviyesi icin gereken tecrube

export class TraderState {
  constructor() {
    this.reset();
  }

  reset() {
    this.gold = 5000;
    this.cargo = {};          // kod -> adet
    this.cost = {};           // kod -> toplam alis maliyeti (kar hesabi icin)
    this.transport = 'none';
    this.transportHp = 0;
    this.tradeXp = 0;
    this.level = 1;
    this.xp = 0;
    this.maxHp = 220;
    this.hp = this.maxHp;
    this.potions = 3;
    this.weapon = 0;          // silah kademesi (demirci)
    this.armor = 0;           // zirh kademesi
    this.playTime = 0;
    this.city = 'jangan';
    this.stats = { trips: 0, profit: 0, kills: 0, robbed: 0 };
    this.tutorial = 0;
  }

  restore() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s.gold === 'number') Object.assign(this, s);
    } catch { /* bozuk kayit: yeni oyun */ }
    return this;
  }

  save() {
    try {
      const { gold, cargo, cost, transport, transportHp, tradeXp, level, xp, maxHp, hp, potions, weapon, armor, playTime, city, stats, tutorial, look, boughtIn } = this;
      localStorage.setItem(KEY, JSON.stringify({ gold, cargo, cost, transport, transportHp, tradeXp, level, xp, maxHp, hp, potions, weapon, armor, playTime, city, stats, tutorial, look, boughtIn }));
    } catch { /* gizli pencere vb. */ }
  }

  static hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
  static wipe() { try { localStorage.removeItem(KEY); } catch { /* */ } }

  get day() { return Math.floor(this.playTime / 600) + 1; }        // 10 dakika = 1 gun
  get capacity() { return TRANSPORTS[this.transport].capacity; }
  get load() { let n = 0; for (const k in this.cargo) n += this.cargo[k]; return n; }
  get traderLevel() { return traderLevel(this.tradeXp); }
  get damage() { return [14 + this.level * 5 + this.weapon * 9, 22 + this.level * 7 + this.weapon * 13]; }
  get defense() { return this.level * 2 + this.armor * 8; }

  buy(code, qty, price) {
    qty = Math.max(0, Math.min(qty, this.capacity - this.load, Math.floor(this.gold / price)));
    if (!qty) return 0;
    this.gold -= qty * price;
    this.cargo[code] = (this.cargo[code] || 0) + qty;
    this.cost[code] = (this.cost[code] || 0) + qty * price;
    return qty;
  }

  /** Satar; kar (maliyete gore) dondurur. */
  sell(code, qty, price) {
    const have = this.cargo[code] || 0;
    qty = Math.min(qty, have);
    if (!qty) return 0;
    const unitCost = (this.cost[code] || 0) / have;
    const income = qty * price;
    const profit = income - unitCost * qty;
    this.gold += income;
    this.cargo[code] = have - qty;
    this.cost[code] = (this.cost[code] || 0) - unitCost * qty;
    if (!this.cargo[code]) { delete this.cargo[code]; delete this.cost[code]; }
    if (profit > 0) { this.tradeXp += Math.round(profit * 0.5); this.stats.profit += Math.round(profit); }
    return profit;
  }

  /** Yukun bir kismini kaybet (haydut). Kaybedilen adet. */
  loseCargo(frac) {
    let lost = 0;
    for (const k of Object.keys(this.cargo)) {
      const have = this.cargo[k];
      const n = Math.ceil(have * frac);
      if (!n) continue;
      this.cost[k] = (this.cost[k] || 0) * (1 - n / have);
      this.cargo[k] = have - n;
      lost += n;
      if (!this.cargo[k]) { delete this.cargo[k]; delete this.cost[k]; }
    }
    this.stats.robbed += lost;
    return lost;
  }

  /** Savas tecrubesi; seviye atlarsa true. */
  gainXp(n) {
    this.xp += n;
    let up = false;
    while (this.xp >= LEVEL_XP(this.level)) {
      this.xp -= LEVEL_XP(this.level);
      this.level++;
      this.maxHp += 40;
      this.hp = this.maxHp;
      up = true;
    }
    return up;
  }
}
