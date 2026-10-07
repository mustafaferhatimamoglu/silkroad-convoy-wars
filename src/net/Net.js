import { hostBase } from '../version.js';

// Cok oyunculu baglanti: server.py'deki /ws oda sistemi (sunucu yalniz mesaj aktarir).
// Oyun durumu istemcilerde: herkes kendi aracini simule eder ve durumunu yayinlar; botlari oda
// kurucusu simule eder. Sunucu saatine (ping/pong) gore ortak zaman: yaris herkeste ayni anda
// baslar, sureler karsilastirilabilir.
//
// Olaylar: on('room'|'rooms'|'error'|'left'|'close', fn) ve aktarilan oyun mesajlari icin
// on('r:<tur>', (veri, gonderenId) => ...).

export class Net {
  constructor() {
    this.ws = null;
    this.id = null;
    this.name = '';
    this.room = null;
    this.handlers = {};
    this.offset = 0;
    this.rtt = 0;
    this.connected = false;
    this._bestRtt = Infinity;
    // sayfadan ayrilirken baglantiyi kapat: tarayici sayfayi geri/ileri onbellegine alip soketi
    // acik birakirsa oyuncu odada "hayalet" olarak kalmasin
    addEventListener('pagehide', () => { if (this.ws) try { this.ws.close(); } catch { /* */ } });
  }

  /** Sunucuya baglan; donus: Net (hosgeldin mesajindan sonra). */
  connect(name) {
    this.name = name;
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = (msg) => { if (!done) { done = true; reject(new Error(msg)); } };
      let ws;
      try {
        const host = hostBase();
        ws = new WebSocket(host ? `${host.replace(/^http/, 'ws')}/ws` : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      } catch (e) { fail('Sunucuya bağlanılamadı'); return; }
      this.ws = ws;
      ws.onopen = () => this.send({ t: 'hello', name });
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'welcome' && !done) {
          this.id = m.id; this.connected = true; done = true;
          this.offset = m.s - performance.now();
          this._pingLoop();
          resolve(this);
        }
        this._msg(m);
      };
      ws.onclose = () => { const was = this.connected; this.connected = false; clearInterval(this._pt); if (was) this._emit('close', {}); fail('Bağlantı kapandı'); };
      ws.onerror = () => fail('Sunucuya bağlanılamadı (WebSocket)');
      setTimeout(() => fail('Sunucu yanıt vermedi'), 6000);
    });
  }

  _msg(m) {
    if (m.t === 'pong') this._clock(m.s, m.c);
    else if (m.t === 'room') this.room = m;
    this._emit(m.t, m);
    if (m.t === 'relay' && m.d && m.d.t) this._emit(`r:${m.d.t}`, m.d, m.from);
  }

  /** Sunucu saati farki: en dusuk gidis-donuslu olcumler agirlikli (ag gecikmesi dalgalanmasina dayanikli). */
  _clock(s, c) {
    const now = performance.now();
    const rtt = now - c;
    const off = s - (c + rtt / 2);
    this.rtt = rtt;
    if (rtt <= this._bestRtt * 1.3 + 2) {
      this._bestRtt = Math.min(this._bestRtt, rtt);
      this.offset = this.offset * 0.6 + off * 0.4;
    }
  }

  _pingLoop() {
    const ping = () => this.send({ t: 'ping', c: performance.now() });
    for (let i = 0; i < 6; i++) setTimeout(ping, 120 * i);
    this._pt = setInterval(ping, 2000);
  }

  /** Sunucu saati (ms). */
  serverNow() { return performance.now() + this.offset; }

  on(t, fn) { (this.handlers[t] || (this.handlers[t] = new Set())).add(fn); return () => this.handlers[t].delete(fn); }
  off(t, fn) { if (this.handlers[t]) this.handlers[t].delete(fn); }
  _emit(t, ...a) { for (const fn of [...(this.handlers[t] || [])]) { try { fn(...a); } catch (e) { console.error(e); } } }

  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  /** Odadakilere oyun mesaji: to = 'all' | 'host' | oyuncu kimligi. */
  relay(d, to = 'all') { this.send({ t: 'relay', to, d }); }

  create() { this.send({ t: 'create' }); }
  join(code) { this.send({ t: 'join', code }); }
  leave() { this.send({ t: 'leave' }); this.room = null; }
  rooms() { this.send({ t: 'rooms' }); }
  markStarted(v = true) { this.send({ t: 'started', v }); }

  get isHost() { return !!this.room && this.room.host === this.id; }
  get members() { return this.room ? this.room.members : []; }

  close() {
    clearInterval(this._pt);
    this.connected = false;
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.ws = null;
  }
}

/** Oyun boyunca tek baglanti. */
export const net = new Net();
