import { net } from './Net.js';
import { RALLY_STAGES } from '../data/rally.js';
import { BOTS } from '../race/BotDriver.js';
import { PAINTS } from '../vehicle/model/KartalModel.js';
import { VERSION, dataHash } from '../version.js';

// Cok oyunculu lobi: oda kurucusu (host) ayarlari ve oyuncu listesini tutar, uyelere yayinlar.
// Uyeler kendi bilgilerini (isim, arac, renk, hazirlik) kurucuya gonderir. Kurucu "baslat"
// deyince herkese giris listesi (oyuncular + botlar, izgara sirasi) gider; herkes parkuru
// yukleyip "yuklendi" der, kurucu ortak start zamanini (sunucu saati) yayinlar.
//
// Modlar: 'free' serbest gezinti (acik dunyada birlikte; sonradan gelen dogrudan katilir);
// 'ffa' herkes kendi icin; 'team' oyuncular takim (co-op) botlara karsi - botlar yalniz
// oyunculara saldirir, sonucta takim puanlari toplanir.
//
// Oyunun tamami her istemcide (dosya indirme yok). Surum sunucuda denetlenir; etap verisi ozeti
// kurucuyla ayni olmadan "Hazirim" acilmaz.

const MAX = 8;
let dataVer = null;   // etap verisi ozeti (bir kez hesaplanir)
const DATA = () => dataVer || (dataVer = dataHash(RALLY_STAGES));

export class Lobby {
  constructor(game) {
    this.game = game;
    this.app = game.app;
    const first = Object.keys(RALLY_STAGES)[0];
    const s = this.app.settings;
    this.cfg = {
      stage: RALLY_STAGES[s.get('raceStage')] ? s.get('raceStage') : first,
      mode: s.get('mpMode') || 'free', bots: 4, level: s.get('raceLevel') || 'orta', botCars: 'same',
      city: s.get('lastCity') || 'hotan',
    };
    this.players = {};
    this.ready = false;
    this.onChange = null;
    this.error = null;
    this.hostVer = null;
    this.started = null;
    this._subs = [
      net.on('room', () => this._onRoom()),
      net.on('r:info', (d, from) => this._onInfo(d, from)),
      net.on('r:lobby', (d) => { this.cfg = d.cfg; this.players = d.players; this.hostVer = d.ver || null; this._changed(); }),
      net.on('r:start', (d) => this._onStart(d)),
      // serbest gezintiye sonradan gelen: kurucudan baslangic bilgisini ister
      net.on('r:need', (d, from) => { if (net.isHost && this.started && this.started.cfg.mode === 'free') net.relay(this.started, from); }),
      net.on('error', (m) => { this.error = m.msg; this._changed(); }),
      net.on('close', () => { this.error = 'Sunucu bağlantısı koptu'; this._changed(); }),
    ];
  }

  dispose() { for (const u of this._subs) u(); this._subs = []; }

  _changed() { if (this.onChange) this.onChange(); }

  /** Surum bilgisi: oyun surumu ve etap verisi ozeti. */
  verInfo() { return { version: VERSION, data: DATA() }; }
  compat(v) { return !!v && v.version === VERSION && v.data === DATA(); }
  get versionOk() { return net.isHost || !this.hostVer || this.compat(this.hostVer); }

  /** Uye hazir olabilir mi: surum ve etap verisi kurucuyla ayni. */
  canReady() { return net.isHost || this.versionOk; }

  /** Oda zaten serbest gezintide (sonradan katilan): kurucudan baslangic bilgisini iste. */
  catchUp() {
    const r = net.room;
    if (!r || !r.started || !r.open || this.started || net.isHost) return false;
    const now = performance.now();
    if (!this._needT || now - this._needT > 2000) { this._needT = now; net.relay({ t: 'need' }, 'host'); }
    return true;
  }

  myInfo() {
    const s = this.app.settings;
    return { name: net.name, variant: s.get('vehicleVariant'), paint: s.get('vehicleColor'), prep: s.get('vehiclePrep'), ready: this.ready, ver: this.verInfo() };
  }

  /** Kendi bilgimi yayinla (kurucuysam tum lobiyi). */
  publish() {
    if (!net.room) return;
    if (net.isHost) { this.players[net.id] = { ...this.myInfo(), ready: true }; this._broadcast(); }
    else net.relay({ t: 'info', ...this.myInfo() }, 'host');
    this._changed();
  }

  _broadcast() {
    if (!net.isHost) return;
    const ids = new Set(net.members.map((m) => m.id));
    for (const id of Object.keys(this.players)) if (!ids.has(Number(id))) delete this.players[id];
    // yeni uye: kendi bilgisi (surum, arac) gelene kadar yer tutucu
    for (const m of net.members) if (!this.players[m.id]) this.players[m.id] = { name: m.name, variant: 'kartal80', paint: 'beyaz', prep: 'ralli', ready: false, pending: true };
    this.players[net.id] = { ...this.myInfo(), ready: true };
    net.relay({ t: 'lobby', cfg: this.cfg, players: this.players, ver: this.verInfo() });
    this._changed();
  }

  _onRoom() {
    if (net.isHost) this._broadcast();
    else this.publish();
    this.catchUp();
  }

  _onInfo(d, from) {
    if (!net.isHost) return;
    this.players[from] = { name: d.name, variant: d.variant, paint: d.paint, prep: d.prep, ready: !!d.ready, ver: d.ver };
    this._broadcast();
  }

  setCfg(k, v) {
    if (!net.isHost) return;
    this.cfg[k] = v;
    this._broadcast();
  }

  toggleReady() {
    if (!this.ready && !this.canReady()) return;
    this.ready = !this.ready;
    this.publish();
  }

  /** Lobi satirlari: oyuncular (katilma sirasiyla) + bot yerleri. */
  rows() {
    const out = net.members.map((m) => ({ id: m.id, host: net.room && m.id === net.room.host, me: m.id === net.id, ...(this.players[m.id] || { name: m.name }) }));
    const nb = this.cfg.mode === 'free' ? 0 : Math.min(this.cfg.bots, MAX - out.length);
    for (let k = 0; k < nb; k++) out.push({ bot: true, name: BOTS[k % BOTS.length].name });
    return out;
  }

  /** Kurucu baslatabilir mi: yarista her uye hazir ve surumu uyumlu (serbest gezintide hemen). */
  canStart() {
    if (!net.isHost) return false;
    if (this.cfg.mode === 'free') return true;
    return net.members.every((m) => {
      if (m.id === net.id) return true;
      const p = this.players[m.id];
      return p && p.ready && this.compat(p.ver);
    });
  }

  /** Kurucu: giris listesi, izgara sirasi ve tohumla yarisi baslat. */
  start() {
    if (!this.canStart()) return;
    if (this.cfg.mode === 'free') {
      const d = { t: 'start', cfg: { ...this.cfg } };
      net.relay(d);
      net.markStarted(true, true, 'free');
      this._onStart(d);
      return;
    }
    const seed = (Math.random() * 1e9) | 0;
    let r = seed;
    const rnd = () => { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; r >>>= 0; return r / 4294967296; };
    const humans = net.members.map((m) => {
      const p = this.players[m.id] || {};
      return { id: m.id, kind: 'human', name: p.name || m.name, variant: p.variant || 'kartal80', paint: p.paint || 'beyaz', prep: p.prep || 'ralli' };
    });
    const used = new Set(humans.map((h) => h.paint));
    const hostCar = humans.find((h) => h.id === net.id) || humans[0];
    const pool = ['kartal80', 'kartal90', 'hilux', 'f150', 'rs6', 'tank'];
    const nb = Math.min(this.cfg.bots, MAX - humans.length);
    const bots = [];
    for (let k = 0, pi = 0; k < nb; k++) {
      let persona = pi % BOTS.length;
      // oyuncu renkleriyle karismasin
      for (let tries = 0; tries < BOTS.length && used.has(BOTS[persona].paint); tries++) persona = (persona + 1) % BOTS.length;
      pi = persona + 1;
      let paint = BOTS[persona].paint;
      if (used.has(paint)) paint = Object.keys(PAINTS).find((p) => !used.has(p)) || paint;
      used.add(paint);
      bots.push({ id: `bot${k}`, kind: 'bot', name: BOTS[persona].name, persona,
        variant: this.cfg.botCars === 'mixed' ? pool[Math.floor(rnd() * pool.length)] : hostCar.variant, paint, prep: hostCar.prep });
    }
    // izgara: botlar onde, oyuncular arkada (rastgele sira kendi aralarinda)
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const entries = [...shuffle(bots), ...shuffle(humans)];
    entries.forEach((e, i) => { e.slot = i; });
    const d = { t: 'start', cfg: { ...this.cfg }, seed, entries };
    net.relay(d);
    net.markStarted(true);
    this._onStart(d);
  }

  _onStart(d) {
    if (this.started && this.started.cfg.mode === 'free' && d.cfg.mode === 'free') return;   // zaten dunyada
    this.started = d;
    if (d.cfg.mode === 'free') this.game.startNetFree(d);
    else this.game.startNetRace(d);
  }
}
