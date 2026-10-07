// Internet daveti: arkadasa gonderilen tek dosyalik HTML. Acilinca davet edenin oyununa (tunel
// adresi) ulasilabildigini sinar, oyuncu adini sorar ve "Yarisa katil" ile oyunu o adresten
// acip odaya otomatik baglanir. Oyun dosyalari ilk giriste davet edenin bilgisayarindan iner.

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function inviteHtml({ url, code, host, stageName = '', stage = '' }) {
  const data = JSON.stringify({ url, code, stage }).replace(/</g, '\\u003c');
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
  <div class="small">Chrome ya da Edge önerilir. İlk girişte oyun dosyaları ${esc(host)} adlı oyuncunun
  bilgisayarından iner; bağlantı hızına göre birkaç dakika sürebilir.<br>
  Doğrudan adres: <a id="link" href="#"></a></div>
</div>
<script>
const D = ${data};
const n = document.getElementById('n'), go = document.getElementById('go'), msg = document.getElementById('msg'), link = document.getElementById('link');
try { n.value = localStorage.getItem('sroName') || ''; } catch (e) {}
const target = () => D.url + '/?join=' + encodeURIComponent(D.code) + '&name=' + encodeURIComponent((n.value || 'Oyuncu').trim().slice(0, 20)) + (D.stage ? '&stage=' + encodeURIComponent(D.stage) : '');
link.textContent = D.url; link.href = D.url;
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
  return `${url}/?join=${encodeURIComponent(code)}${stage ? `&stage=${encodeURIComponent(stage)}` : ''}`;
}
