import { GOODS, TRANSPORTS, icon, buyPrice, sellPrice, goodsOf, TRADER_LEVELS } from '../rpg/Economy.js';
import { LEVEL_XP } from '../rpg/TraderState.js';
import { cityById } from '../data/cities.js';

// Kervan RPG arayuzu: durum paneli (can, altin, yuk, binek), NPC konusma ve dukkan pencereleri.

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fmt = (n) => Math.round(n).toLocaleString('tr-TR');

export class KervanUI {
  constructor(root, mode) {
    this.root = root;
    this.mode = mode;
    this.layer = null;
    this.status = h(`<div id="kStatus" class="interactive-off">
      <div class="row"><span class="lbl">Can</span><div class="bar hp"><div></div><span></span></div></div>
      <div class="row"><span class="lbl">Tecrübe</span><div class="bar xp"><div></div><span></span></div></div>
      <div class="row tr hidden"><span class="lbl">Binek</span><div class="bar thp"><div></div><span></span></div></div>
      <div class="info"><span class="gold"></span><span class="cargo"></span><span class="pot"></span></div>
      <div class="lvl"></div>
    </div>`);
    root.appendChild(this.status);
    this.target = h(`<div id="kTarget" class="hidden"><b></b><div class="bar ehp"><div></div><span></span></div></div>`);
    root.appendChild(this.target);
  }

  get open() { return !!this.layer; }

  updateStatus(s) {
    const q = (sel) => this.status.querySelector(sel);
    const bar = (sel, v, max, text) => { q(sel + ' > div').style.width = `${Math.max(0, Math.min(1, v / max)) * 100}%`; q(sel + ' > span').textContent = text; };
    bar('.hp', s.hp, s.maxHp, `${fmt(s.hp)} / ${fmt(s.maxHp)}`);
    bar('.xp', s.xp, LEVEL_XP(s.level), `${Math.floor((s.xp / LEVEL_XP(s.level)) * 100)}%`);
    const t = TRANSPORTS[s.transport];
    q('.tr').classList.toggle('hidden', s.transport === 'none');
    if (s.transport !== 'none') bar('.thp', s.transportHp, t.hp, `${t.tr} ${fmt(s.transportHp)}`);
    q('.gold').textContent = `${fmt(s.gold)} altın`;
    q('.cargo').textContent = `Yük ${s.load}/${s.capacity}`;
    q('.pot').textContent = `İksir ×${s.potions}`;
    q('.lvl').innerHTML = `Seviye <b>${s.level}</b> · Tüccar <b>${s.traderLevel}</b>`;
  }

  showTarget(e) {
    if (!e) { this.target.classList.add('hidden'); return; }
    this.target.classList.remove('hidden');
    this.target.querySelector('b').textContent = `${e.name}  Sv. ${e.lvl ?? e.def.lvl ?? 1}`;
    this.target.querySelector('.ehp > div').style.width = `${Math.max(0, e.hp / e.maxHp) * 100}%`;
    this.target.querySelector('.ehp > span').textContent = `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}`;
  }

  close() {
    if (this.layer) { this.layer.remove(); this.layer = null; }
    this.mode.onDialogClosed && this.mode.onDialogClosed();
  }

  _show(el) {
    if (this.layer) this.layer.remove();
    this.layer = el;
    this.root.appendChild(el);
    el.addEventListener('click', (e) => { const x = e.target.closest('[data-x]'); if (x) this.close(); });
  }

  /** NPC konusmasi: karsilama + role gore secenekler. */
  talk(npc, options) {
    const text = (npc.def.talk && npc.def.talk[0]) || 'Hoş geldin, yolcu.';
    const el = h(`<div class="panel dialog interactive kDialog">
      <h2>${npc.name}</h2>
      <p class="speech">“${text}”</p>
      <div class="opts">${options.map((o, i) => `<button class="btn" data-o="${i}">${o.label}${o.small ? `<small>${o.small}</small>` : ''}</button>`).join('')}
      <button class="btn secondary" data-x>Hoşça kal</button></div>
    </div>`);
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-o]'); if (b) options[+b.dataset.o].fn(); });
    this._show(el);
  }

  /** Ozel urun tuccari: bu sehrin mallarini satin al. */
  shopBuy(npc, s, city, onChange) {
    const render = () => {
      const day = s.day;
      const rows = goodsOf(city).map((code) => {
        const p = buyPrice(code, city, day);
        const max = Math.max(0, Math.min(s.capacity - s.load, Math.floor(s.gold / p)));
        const dests = ['donwhang', 'hotan', 'samarkand', 'constantinople', 'jangan'].filter((c) => c !== city).slice(0, 3)
          .map((c) => `${cityById(c).name} ~${fmt(sellPrice(code, c, day, s.traderLevel))}`).join(' · ');
        return `<tr><td><img src="${icon(code)}" alt=""></td><td><b>${GOODS[code].tr}</b><small>${dests}</small></td>
          <td class="num">${fmt(p)}</td><td class="num">${s.cargo[code] || 0}</td>
          <td><button class="btn mini" data-b="${code}" data-q="1" ${max ? '' : 'disabled'}>+1</button>
          <button class="btn mini" data-b="${code}" data-q="10" ${max ? '' : 'disabled'}>+10</button>
          <button class="btn mini" data-b="${code}" data-q="${max}" ${max ? '' : 'disabled'}>Doldur</button></td></tr>`;
      }).join('');
      el.querySelector('tbody').innerHTML = rows;
      el.querySelector('.foot').innerHTML = `Altın <b>${fmt(s.gold)}</b> · Yük <b>${s.load}/${s.capacity}</b>${s.transport === 'none' ? ' · <i>Daha fazla taşımak için ahırdan binek al.</i>' : ''}`;
    };
    const el = h(`<div class="panel dialog interactive kDialog wide">
      <h2>${npc.name} — Özel Ürünler</h2>
      <table class="kTable"><thead><tr><th></th><th>Mal (tahmini satış)</th><th>Fiyat</th><th>Yükte</th><th></th></tr></thead><tbody></tbody></table>
      <div class="foot"></div>
      <div class="row"><button class="btn secondary" data-back style="width:auto">← Geri</button><div style="flex:1"></div><button class="btn" data-x style="width:auto">Kapat</button></div>
    </div>`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]');
      if (b && !b.disabled) {
        const code = b.dataset.b;
        const n = s.buy(code, +b.dataset.q, buyPrice(code, city, s.day));
        if (n) { s.boughtIn = city; onChange && onChange(`${n} birim ${GOODS[code].tr} alındı`); this.mode.sfx && this.mode.sfx('coin'); }
        render();
      }
      if (e.target.closest('[data-back]')) this.mode.openNpc(npc);
    });
    this._show(el);
    render();
  }

  /** Yukteki mallari sat. */
  shopSell(npc, s, city, onChange) {
    const render = () => {
      const codes = Object.keys(s.cargo);
      el.querySelector('tbody').innerHTML = codes.length ? codes.map((code) => {
        const p = sellPrice(code, city, s.day, s.traderLevel);
        const unit = (s.cost[code] || 0) / s.cargo[code];
        const pr = (p - unit) * s.cargo[code];
        return `<tr><td><img src="${icon(code)}" alt=""></td><td><b>${GOODS[code].tr}</b><small>${cityById(GOODS[code].city).name} malı · alış ${fmt(unit)}</small></td>
          <td class="num">${fmt(p)}</td><td class="num">${s.cargo[code]}</td><td class="num ${pr >= 0 ? 'pos' : 'neg'}">${pr >= 0 ? '+' : ''}${fmt(pr)}</td>
          <td><button class="btn mini" data-s="${code}" data-q="1">1</button><button class="btn mini" data-s="${code}" data-q="${s.cargo[code]}">Hepsi</button></td></tr>`;
      }).join('') : '<tr><td colspan="6" class="empty">Yükünde satılacak mal yok.</td></tr>';
      el.querySelector('.foot').innerHTML = `Altın <b>${fmt(s.gold)}</b> · Tüccar seviyesi <b>${s.traderLevel}</b> (satış primi %${Math.round(TRADER_LEVELS[s.traderLevel - 1].bonus * 100)})`;
    };
    const el = h(`<div class="panel dialog interactive kDialog wide">
      <h2>${npc.name} — Mal Sat</h2>
      <table class="kTable"><thead><tr><th></th><th>Mal</th><th>Burada</th><th>Adet</th><th>Kâr</th><th></th></tr></thead><tbody></tbody></table>
      <div class="foot"></div>
      <div class="row"><button class="btn secondary" data-back style="width:auto">← Geri</button><div style="flex:1"></div><button class="btn" data-sellall style="width:auto">Hepsini sat</button><button class="btn" data-x style="width:auto;margin-left:8px">Kapat</button></div>
    </div>`);
    const sell = (code, q) => {
      const p = sellPrice(code, city, s.day, s.traderLevel);
      const profit = s.sell(code, q, p);
      return profit;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (b) { const pr = sell(b.dataset.s, +b.dataset.q); onChange && onChange(`Satıldı · kâr ${pr >= 0 ? '+' : ''}${fmt(pr)}`); this.mode.sfx && this.mode.sfx('coin'); render(); }
      if (e.target.closest('[data-sellall]')) {
        let total = 0;
        for (const code of Object.keys(s.cargo)) total += sell(code, s.cargo[code]);
        if (total) { s.stats.trips++; onChange && onChange(`Bütün yük satıldı · kâr ${total >= 0 ? '+' : ''}${fmt(total)} altın`, true); this.mode.sfx && this.mode.sfx('coin'); }
        render();
      }
      if (e.target.closest('[data-back]')) this.mode.openNpc(npc);
    });
    this._show(el);
    render();
  }

  /** Ahir: binek al / degistir. */
  stable(npc, s, onBuy) {
    const render = () => {
      el.querySelector('.list').innerHTML = Object.entries(TRANSPORTS).filter(([k]) => k !== 'none').map(([k, t]) => {
        const own = s.transport === k;
        const cant = s.gold < t.price || own;
        return `<div class="card ${own ? 'sel' : ''}"><b>${t.tr}</b><span>Kapasite ${t.capacity} · hız ${t.speed.toFixed(1)} m/sn · dayanıklılık ${fmt(t.hp)}</span>
          <div class="row" style="margin-top:8px"><span class="price">${fmt(t.price)} altın</span><div style="flex:1"></div>
          <button class="btn mini" data-t="${k}" ${cant ? 'disabled' : ''}>${own ? 'Sende' : 'Satın al'}</button></div></div>`;
      }).join('');
      el.querySelector('.foot').innerHTML = `Altın <b>${fmt(s.gold)}</b>${s.transport !== 'none' ? ` · Eski binek yarı fiyatına geri alınır.` : ''}`;
    };
    const el = h(`<div class="panel dialog interactive kDialog">
      <h2>${npc.name} — Ahır</h2><div class="list grid1"></div><div class="foot"></div>
      <div class="row"><button class="btn secondary" data-back style="width:auto">← Geri</button><div style="flex:1"></div><button class="btn" data-x style="width:auto">Kapat</button></div></div>`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]');
      if (b && !b.disabled) { onBuy(b.dataset.t); render(); }
      if (e.target.closest('[data-back]')) this.mode.openNpc(npc);
    });
    this._show(el);
    render();
  }

  /** Sifaci: iksir ve tedavi. */
  healer(npc, s, onChange) {
    const render = () => {
      el.querySelector('.foot').innerHTML = `Altın <b>${fmt(s.gold)}</b> · İksir ×${s.potions} · Can ${fmt(s.hp)}/${fmt(s.maxHp)}`;
    };
    const el = h(`<div class="panel dialog interactive kDialog">
      <h2>${npc.name} — Şifa</h2>
      <div class="grid1">
        <div class="card"><b>Can İksiri</b><span>Yolda <kbd>Q</kbd> ile içilir, canın %45'ini doldurur.</span>
          <div class="row" style="margin-top:8px"><span class="price">60 altın</span><div style="flex:1"></div><button class="btn mini" data-p="1">1 al</button><button class="btn mini" data-p="5">5 al</button></div></div>
        <div class="card"><b>Tedavi</b><span>Canını ve bineğinin dayanıklılığını tamamen yeniler.</span>
          <div class="row" style="margin-top:8px"><span class="price">120 altın</span><div style="flex:1"></div><button class="btn mini" data-heal>Tedavi ol</button></div></div>
      </div><div class="foot"></div>
      <div class="row"><button class="btn secondary" data-back style="width:auto">← Geri</button><div style="flex:1"></div><button class="btn" data-x style="width:auto">Kapat</button></div></div>`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]');
      if (b) { const n = Math.min(+b.dataset.p, Math.floor(s.gold / 60)); if (n) { s.gold -= n * 60; s.potions += n; onChange(`${n} iksir alındı`); } render(); }
      if (e.target.closest('[data-heal]') && s.gold >= 120) { s.gold -= 120; s.hp = s.maxHp; if (s.transport !== 'none') s.transportHp = TRANSPORTS[s.transport].hp; onChange('İyileştin'); render(); }
      if (e.target.closest('[data-back]')) this.mode.openNpc(npc);
    });
    this._show(el);
    render();
  }

  /** Demirci / zirhci: silah ve zirh kademesi yukselt. */
  upgrade(npc, s, kind, onChange) {
    const label = kind === 'weapon' ? 'Silah' : 'Zırh';
    const render = () => {
      const lvl = s[kind];
      const cost = Math.round(900 * (lvl + 1) ** 1.6);
      el.querySelector('.info').innerHTML = `${label} kademesi <b>${lvl}</b> → <b>${lvl + 1}</b><br>${kind === 'weapon' ? `Hasar ${s.damage[0]}–${s.damage[1]}` : `Savunma ${s.defense}`}`;
      const btn = el.querySelector('[data-up]');
      btn.textContent = `Yükselt — ${fmt(cost)} altın`;
      btn.disabled = s.gold < cost || lvl >= 10;
      btn.dataset.cost = cost;
    };
    const el = h(`<div class="panel dialog interactive kDialog">
      <h2>${npc.name} — ${label}</h2><p class="speech info"></p>
      <div class="row"><button class="btn secondary" data-back style="width:auto">← Geri</button><div style="flex:1"></div><button class="btn" data-up style="width:auto"></button><button class="btn" data-x style="width:auto;margin-left:8px">Kapat</button></div></div>`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-up]');
      if (b && !b.disabled) {
        s.gold -= +b.dataset.cost; s[kind]++; onChange(`${label} güçlendirildi`); render();
        if (kind === 'weapon' && this.mode.equipWeapon) this.mode.equipWeapon();
        this.mode.sfx && this.mode.sfx('coin');
      }
      if (e.target.closest('[data-back]')) this.mode.openNpc(npc);
    });
    this._show(el);
    render();
  }

  dispose() {
    this.close();
    this.status.remove();
    this.target.remove();
  }
}
