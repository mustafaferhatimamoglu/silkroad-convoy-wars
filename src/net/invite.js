import { PAGES_URL } from '../version.js';

// Internet daveti: arkadasa gonderilen tek dosyalik HTML. Acilinca davet edenin oyununa (tunel
// adresi) ulasilabildigini sinar, oyuncu adini sorar; "Yarisa katil" oyunun GitHub Pages kopyasini
// acar ve odaya otomatik baglanir. Lobide etabin Silkroad dosyalari davet edenden iner (bir kez;
// tarayicida surumuyle saklanir), bitmeden "Hazirim" acilmaz.

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Katilma adresi. Internetten (https tunel): oyunun GitHub Pages kopyasi + davet edenin adresi
 * (kod Pages'ten, Silkroad dosyalari davet edenden bir kez iner, sonra tarayicida kalir).
 * Yerel ag: dogrudan davet edenin sunucusu.
 */
export function joinUrl({ url, code, stage = '', name = '' }) {
  const q = `join=${encodeURIComponent(code)}${stage ? `&stage=${encodeURIComponent(stage)}` : ''}${name ? `&name=${encodeURIComponent(name)}` : ''}`;
  if (PAGES_URL && /^https:/.test(url)) return `${PAGES_URL}?host=${encodeURIComponent(url)}&${q}`;
  return `${url}/?${q}`;
}

export function inviteHtml({ url, code, host, stageName = '', stage = '' }) {
  const pages = PAGES_URL && /^https:/.test(url) ? PAGES_URL : '';
  const data = JSON.stringify({ url, code, stage, pages }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Silkroad yarış daveti — ${esc(host)}</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { display: grid; place-items: center; background: radial-gradient(ellipse at 50% 30%, #3a2c18 0%, #15110b 70%); color: #eadfc6; font: 16px/1.5 Georgia, 'Times New Roman', serif; }
  .card { width: min(460px, 92vw); padding: 28px 30px; background: rgba(20, 16, 11, 0.86); border: 1px solid rgba(232, 193, 112, 0.45); border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); text-align: center; }
  h1 { margin: 0; font-size: 34px; letter-spacing: 6px; color: #f2c46d; font-weight: 500; }
  .sub { font-size: 11px; letter-spacing: 4px; color: #a8987a; margin-bottom: 18px; }
  .who { font-size: 18px; margin: 6px 0 4px; }
  .room { color: #c9b996; margin-bottom: 18px; }
  .room b { letter-spacing: 4px; color: #f2c46d; }
  label { display: block; text-align: left; font-size: 13px; color: #a8987a; margin-bottom: 4px; }
  input { width: 100%; box-sizing: border-box; padding: 10px 12px; font: inherit; color: #fff; background: #0e0b07; border: 1px solid rgba(232, 193, 112, 0.35); border-radius: 6px; margin-bottom: 14px; }
  button { width: 100%; padding: 12px; font: 600 17px Georgia, serif; color: #1a1208; background: linear-gradient(#f2c46d, #c8913a); border: 0; border-radius: 6px; cursor: pointer; }
  button:disabled { opacity: 0.55; cursor: default; }
  #msg { min-height: 22px; margin-top: 10px; font-size: 14px; color: #ff9a80; }
  .small { font-size: 12px; color: #8d806a; margin-top: 14px; }
  a { color: #f2c46d; }
</style>
</head>
<body>
<div class="card">
  <h1>SILKROAD</h1>
  <div class="sub">CONVOY WARS · V4</div>
  <div class="who"><b>${esc(host)}</b> seni yarışa çağırıyor</div>
  <div class="room">Oda <b>${esc(code)}</b>${stageName ? ` · ${esc(stageName)}` : ''}</div>
  <label for="n">Adın</label>
  <input id="n" maxlength="20" placeholder="Oyuncu">
  <button id="go" disabled>Bağlantı kontrol ediliyor…</button>
  <div id="msg"></div>
  <div class="small">Chrome ya da Edge önerilir. Oyun açılınca etabın dosyaları hemen inmeye başlar ve
  bu bilgisayarda saklanır; sonraki yarışlarda yalnız değişen dosyalar iner. Dosyalar bitmeden yarış başlamaz.<br>
  <a id="link" href="#">Bağlantı</a> (düğme çalışmazsa)</div>
</div>
<script>
const D = ${data};
const n = document.getElementById('n'), go = document.getElementById('go'), msg = document.getElementById('msg'), link = document.getElementById('link');
try { n.value = localStorage.getItem('sroName') || ''; } catch (e) {}
const target = () => {
  const q = 'join=' + encodeURIComponent(D.code) + '&name=' + encodeURIComponent((n.value || 'Oyuncu').trim().slice(0, 20)) + (D.stage ? '&stage=' + encodeURIComponent(D.stage) : '');
  return D.pages ? D.pages + '?host=' + encodeURIComponent(D.url) + '&' + q : D.url + '/?' + q;
};
const upd = () => { link.href = target(); };
upd(); n.addEventListener('input', upd);
const ready = (ok) => {
  go.disabled = false;
  go.textContent = ok ? 'Yarışa katıl →' : 'Yine de dene';
  if (!ok) msg.textContent = 'Davet eden oyuna şu an ulaşılamıyor: oyun kapanmış ya da adres değişmiş olabilir. Yeni bir davet dosyası iste.';
};
fetch(D.url + '/api/info', { cache: 'no-store' }).then((r) => r.json()).then(() => ready(true)).catch(() => ready(false));
go.onclick = () => { try { localStorage.setItem('sroName', (n.value || '').trim()); } catch (e) {} location.href = target(); };
n.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !go.disabled) go.click(); });
</script>
</body>
</html>
`;
}

/** Davet dosyasini indir (tarayici indirme olarak). */
export function downloadInvite(opts) {
  const blob = new Blob([inviteHtml(opts)], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `silkroad-davet-${opts.code}.html`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/** Dogrudan katilma baglantisi (mesajla gondermek icin). */
export function inviteLink({ url, code, stage = '' }) {
  return joinUrl({ url, code, stage });
}
