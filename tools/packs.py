"""Etap dosya paketleri (cok oyunculu: arkadasin tarayicisi etabin dosyalarini yaris oncesi indirir).

  python tools/packs.py record jangan hotan ...   oyunu etapta bastan sona sur, istenen dosyalari kaydet
  python tools/packs.py write                     kayitlardan assets/packs/<etap>.json yaz (boyut + ozet)
  python tools/packs.py all                       hepsini kaydet ve yaz

record: oyun (python server.py) ve test kosum takimi (node tools/devharness.mjs) acik olmali.
Etap en yuksek grafik kalitesinde (en genis gorus) otomatik pilotla bastan sona surulur; sayfanin
istedigi butun assets/ dosyalari (acilis, menu sahnesi, yaris) tarayici kaynak kayitlarindan
alinir: tools/rally/work/<etap>/files.json.

write: her dosya icin boyut ve SHA-1 ozeti (ilk 16 hane). Paket surumu dosya ozetlerinden
turetilir; bir dosya degisince yalniz o dosya yeniden iner (net/AssetSync.js). Ozetler
tools/rally/work/hashes.json'da onbellekte (boyut + degisme zamani ayniysa yeniden hesaplanmaz).

Oyun sunucusu (server.py) listeyi her istekte guncel ozetlerle verir: bir dosyayi degistirmek
icin yeniden write gerekmez. Etap rotasi degisirse (yeni bolgeler) record ile yeniden kaydedin.
"""
import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'tools', 'rally', 'work')
PACKS = os.path.join(ROOT, 'assets', 'packs')
HARNESS = os.environ.get('SRO_HARNESS', 'http://127.0.0.1:9400')
GAME = os.environ.get('SRO_GAME', 'http://localhost:5070')
STAGES = ['jangan', 'donwhang', 'hotan', 'samarkand', 'constantinople', 'alexandria']


def ev(js, timeout=600):
    req = urllib.request.Request(f'{HARNESS}/eval', data=js.encode('utf-8'), method='POST')
    r = json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8'))
    if 'error' in r:
        raise RuntimeError(r['error'])
    return r.get('value')


def nav(url):
    urllib.request.urlopen(f'{HARNESS}/nav?url={urllib.parse.quote(url, safe="")}', timeout=60).read()


def wait_for(js, secs):
    t0 = time.time()
    while time.time() - t0 < secs:
        try:
            v = ev(js, 30)
            if v:
                return v
        except Exception:
            pass
        time.sleep(2)
    return None


COLLECT = """(() => {
  const out = new Set();
  for (const e of performance.getEntriesByType('resource')) {
    const u = new URL(e.name, location.href);
    if (u.origin !== location.origin) continue;
    const p = decodeURIComponent(u.pathname.replace(/^\\//, ''));
    if (p.startsWith('assets/') && !p.startsWith('assets/packs/')) out.add(p);
  }
  return [...out];
})()"""


def cmd_record(stages):
    # ayarlar oyunun kendi adresinde (localStorage) tutulur: once oyunu ac
    nav(f'{GAME}/')
    wait_for('!!(window.app && window.game)', 120)
    # en genis gorus: ultra (yakin 3, uzak 6 bolge) - tum kalite ayarlarinin dosyalarini kapsar
    ev("(() => { const k = 'sro-v4-settings'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.quality = 'ultra'; s.lastCity = 'hotan'; localStorage.setItem(k, JSON.stringify(s)); return 1; })()")
    try:
        for st in stages:
            t0 = time.time()
            nav(f'{GAME}/?mode=race&stage={st}&city={st}&bots=0&auto=1&level=zor&seed=1')
            time.sleep(3)
            ok = wait_for("app.mode && app.mode.raceState === 'run'", 240)
            if not ok:
                print(f'{st}: yaris baslamadi'); continue
            fin = wait_for("app.mode.me.state.finished ? Math.round(app.mode.me.state.time) : 0", 600)
            # finisten sonra kacis yoluna da gitsin: biraz bekle
            time.sleep(6)
            files = ev(COLLECT)
            os.makedirs(os.path.join(WORK, st), exist_ok=True)
            json.dump(sorted(files), open(os.path.join(WORK, st, 'files.json'), 'w'))
            print(f'{st}: {len(files)} dosya, finis {fin or "yok"} sn ({time.time() - t0:.0f} sn)')
    finally:
        ev("(() => { const k = 'sro-v4-settings'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.quality = 'yuksek'; localStorage.setItem(k, JSON.stringify(s)); return 1; })()")


def file_hash(path, cache):
    full = os.path.join(ROOT, path)
    stt = os.stat(full)
    key = f'{stt.st_size}:{int(stt.st_mtime)}'
    c = cache.get(path)
    if c and c[0] == key:
        return stt.st_size, c[1]
    h = hashlib.sha1()
    with open(full, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    d = h.hexdigest()[:16]
    cache[path] = [key, d]
    return stt.st_size, d


def cmd_write():
    hp = os.path.join(WORK, 'hashes.json')
    cache = json.load(open(hp)) if os.path.exists(hp) else {}
    os.makedirs(PACKS, exist_ok=True)
    for st in STAGES:
        fp = os.path.join(WORK, st, 'files.json')
        if not os.path.exists(fp):
            print(f'{st}: kayit yok (once: python tools/packs.py record {st})'); continue
        files = []
        for p in json.load(open(fp)):
            if os.path.exists(os.path.join(ROOT, p)):
                size, d = file_hash(p, cache)
                files.append([p, size, d])
        files.sort()
        ver = hashlib.sha1(''.join(f[2] for f in files).encode()).hexdigest()[:12]
        total = sum(f[1] for f in files)
        json.dump({'stage': st, 'version': ver, 'total': total, 'files': files},
                  open(os.path.join(PACKS, f'{st}.json'), 'w'), separators=(',', ':'))
        print(f'{st}: {len(files)} dosya, {total / 1048576:.1f} MB, surum {ver}')
    json.dump(cache, open(hp, 'w'))


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('record', 'write', 'all'):
        print(__doc__); return
    if sys.argv[1] in ('record', 'all'):
        cmd_record(sys.argv[2:] or STAGES)
    if sys.argv[1] in ('write', 'all'):
        cmd_write()


if __name__ == '__main__':
    main()
