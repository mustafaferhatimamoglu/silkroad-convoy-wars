import { net } from './Net.js';
import { RALLY_STAGES } from '../data/rally.js';
import { BOTS } from '../race/BotDriver.js';
import { PAINTS } from '../vehicle/model/KartalModel.js';
import { PROTOCOL, BUILD, dataHash } from '../version.js';
import { syncPack } from './AssetSync.js';

// Cok oyunculu lobi: oda kurucusu (host) ayarlari ve oyuncu listesini tutar, uyelere yayinlar.
// Uyeler kendi bilgilerini (isim, arac, renk, hazirlik) kurucuya gonderir. Kurucu "baslat"
// deyince herkese giris listesi (oyuncular + botlar, izgara sirasi) gider; herkes parkuru
// yukleyip "yuklendi" der, kurucu ortak start zamanini (sunucu saati) yayinlar.
//
// Modlar: 'ffa' herkes kendi icin; 'team' oyuncular takim (co-op) botlara karsi - botlar
// yalniz oyunculara saldirir, sonucta takim puanlari toplanir.
//
// Uyeler kurucunun sectigi etabin dosya paketini hemen indirir/dogrular (AssetSync); paket
// tamamlanmadan ve surum (ag protokolu + etap verisi) kurucuyla ayni olmadan "Hazirim" acilmaz,
// kurucu da yarisi baslatamaz.

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
      mode: 'ffa', bots: 4, level: s.get('raceLevel') || 'orta', botCars: 'same',
    };
    this.players = {};
    this.ready = false;
    this.onChange = null;
    this.onPack = null;     // yalniz indirme ilerlemesi degisti (hafif yenileme)
    this.error = null;
    this.pack = { stage: null, state: 'idle', done: 0, total: 0, bytes: 0, totalBytes: 0 };
    this.hostVer = null;
    this._sync = null;
    this._renderT = 0;
    this._subs = [
      net.on('room', () => this._onRoom()),
      net.on('r:info', (d, from) => this._onInfo(d, from)),
      net.on('r:lobby', (d) => { this.cfg = d.cfg; this.players = d.players; this.hostVer = d.ver || null; this._ensurePack(); this._changed(); }),
      net.on('r:start', (d) => this._onStart(d)),
      net.on('error', (m) => { this.error = m.msg; this._changed(); }),
      net.on('close', () => { this.error = 'Sunucu bağlantısı koptu'; this._changed(); }),
    ];
  }

  dispose() { for (const u of this._subs) u(); this._subs = []; }

  _changed() { if (this.onChange) this.onChange(); }

  /** Surum bilgisi: ag protokolu, yayin kimligi, etap verisi ozeti. */
  verInfo() { return { protocol: PROTOCOL, build: BUILD, data: DATA() }; }
  compat(v) { return !!v && v.protocol === PROTOCOL && v.data === DATA(); }
  get versionOk() { return net.isHost || !this.hostVer || this.compat(this.hostVer); }

  /** Uye hazir olabilir mi: etap paketi inmis ve surum uyumlu. */
  canReady() {
    if (net.isHost) return true;
    return this.versionOk && this.pack.state === 'ready' && this.pack.stage === this.cfg.stage;
  }

  /** Uye: kurucunun sectigi etabin dosyalarini indir/dogrula (kurucunun dosyalari kendinde). */
  _ensurePack() {
    if (net.isHost || !net.room) return;
    const stage = this.cfg.stage;
    // ayni etap: inmis, iniyor ya da hata verdi (hatada yeniden deneme yalniz "Tekrar dene" ile;
    // kendiliginden denemek sunucuya istek dongusu kurardi)
    if (this.pack.stage === stage && this.pack.state !== 'idle') return;
    if (this._sync) this._sync.aborted = true;
    const sig = (this._sync = { aborted: false });
    this.pack = { stage, state: 'sync', done: 0, total: 0, bytes: 0, totalBytes: 0, downloaded: 0 };
    if (this.ready) this.ready = false;
    this.publish();
    let lastSent = 0;
    syncPack(stage, (p) => {
      if (sig.aborted) return;
      Object.assign(this.pack, p);
      const now = performance.now();
      if (now - this._renderT > 200) { this._renderT = now; if (this.onPack) this.onPack(); else this._changed(); }
      if (now - lastSent > 1000) { lastSent = now; this.publish(); }
    }, sig).then(() => {
      if (sig.aborted) return;
      this.pack.state = 'ready';
      this.publish();
    }).catch((e) => {
      if (sig.aborted) return;
      this.pack.state = 'error';
      this.pack.error = e.message;
      this.publish();
    });
  }

  retryPack() { this.pack.stage = null; this._ensurePack(); }

  myInfo() {
    const s = this.app.settings, P = this.pack;
    const prog = P.totalBytes ? Math.round((P.bytes / P.totalBytes) * 100) : 0;
    return {
      name: net.name, variant: s.get('vehicleVariant'), paint: s.get('vehicleColor'), prep: s.get('vehiclePrep'), ready: this.ready,
      ver: this.verInfo(), pack: P.state === 'ready' ? P.stage : null, prog: P.state === 'sync' ? prog : P.state === 'error' ? -1 : null,
    };
  }

  /** Kendi bilgimi yayinla (kurucuysam tum lobiyi). */
  publish() {
    if (!net.room) return;
    if (net.isHost) { this.players[net.id] = { ...this.myInfo(), ready: true }; this._broadcast(); }
    else { this._ensurePack(); net.relay({ t: 'info', ...this.myInfo() }, 'host'); }
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
  }

  _onInfo(d, from) {
    if (!net.isHost) return;
    this.players[from] = { name: d.name, variant: d.variant, paint: d.paint, prep: d.prep, ready: !!d.ready, ver: d.ver, pack: d.pack, prog: d.prog };
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
    const nb = Math.min(this.cfg.bots, MAX - out.length);
    for (let k = 0; k < nb; k++) out.push({ bot: true, name: BOTS[k % BOTS.length].name });
    return out;
  }

  /** Kurucu baslatabilir mi: her uye hazir, etap paketi inmis, surumu uyumlu. */
  canStart() {
    return net.isHost && net.members.every((m) => {
      if (m.id === net.id) return true;
      const p = this.players[m.id];
      return p && p.ready && p.pack === this.cfg.stage && this.compat(p.ver);
    });
  }

  /** Kurucu: giris listesi, izgara sirasi ve tohumla yarisi baslat. */
  start() {
    if (!this.canStart()) return;
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
    this.started = d;
    this.game.startNetRace(d);
  }
}
