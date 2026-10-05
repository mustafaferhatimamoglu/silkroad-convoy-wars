// Silkroad oyun verisi (tools/assets/export_gamedata.py ciktisi): karakter tanimlari,
// bolge bazli NPC/canavar dogma noktalari, ticaret mallari.

export class GameData {
  constructor(base = 'assets/data/') {
    this.base = base;
    this.chars = [];
    this.spawns = {};
    this.goods = [];
  }

  async load() {
    const get = (f) => fetch(this.base + f, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [chars, spawns, goods] = await Promise.all([get('chars.json'), get('spawns.json'), get('goods.json')]);
    this.chars = chars || [];
    this.spawns = spawns || {};
    this.goods = goods || [];
    this.byCode = new Map(this.chars.map((c, i) => [c.code, i]));
    return this;
  }

  /** Bolgedeki dogma noktalari: [[tanim, x, y, z], ...] (bolge-yerel Silkroad birimi). */
  spawnsIn(rx, rz) { return this.spawns[`${rz}_${rx}`] || []; }

  def(i) { return this.chars[i]; }
}
