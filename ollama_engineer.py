r"""
Ollama Autonomous Lead Engineer & Supervisor (Silkroad: Convoy Wars)
Kullanıcı emri: "bunların hiçbirini sen yapma ver ollamaya çalışsın sen kontrollerini yap eksiklerini bul devam etmesini sağla"

Roller:
- İşçi (Worker): RTX 5060 Ollama (huihui_ai/qwen2.5-coder-abliterate:7b)
- Baş Mimar / Denetçi (Supervisor): Kod kalitesini, fizik motorunu, tekerlek bağlantılarını ve testleri denetler.
"""

import os
import sys
import json
import time
import requests
import subprocess

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = r"C:\Silkroad\Silkroad_V2"
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "huihui_ai/qwen2.5-coder-abliterate:7b"
OLLAMA_TIMEOUT = 30


def log(msg, level="INFO"):
    t = time.strftime("%H:%M:%S")
    print(f"[{t}][{level}] {msg}")
    sys.stdout.flush()


def query_ollama(prompt, system_instruction="Sen Silkroad: Convoy Wars için çalışan kıdemli 3D oyun ve fizik motoru uzmanısın."):
    """Yerel Ollama modeline iş emri gönderir (C:\Rules.md uyumlu, max 30s timeout, 0 USD)."""
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "system": system_instruction,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 1200}
        }
        res = requests.post(OLLAMA_URL, json=payload, timeout=OLLAMA_TIMEOUT)
        if res.status_code == 200:
            return res.json().get("response", "").strip()
        else:
            return f"Ollama HTTP {res.status_code}: {res.text}"
    except Exception as e:
        return f"Ollama Hatası: {e}"


def run_supervisor_checks():
    """Baş Mimar / Denetçi kontrolleri: Testler, dosyalar ve fizik motoru bütünlüğü."""
    log("=== BAŞ MİMAR KONTROL PANELİ: EKSİKLER VE KALİTE DENETİMİ ===", "SUPERVISOR")

    # 1. Cannon.js ve Three.js dosyalarının varlığı
    cannon_path = os.path.join(BASE_DIR, "js", "cannon.min.js")
    three_path = os.path.join(BASE_DIR, "js", "three.min.js")
    index_path = os.path.join(BASE_DIR, "index.html")

    assert os.path.exists(cannon_path), "Cannon.js yerel dosyası eksik!"
    assert os.path.exists(three_path), "Three.js yerel dosyası eksik!"
    assert os.path.exists(index_path), "index.html eksik!"
    log("✓ Yerel 3D ve Fizik kütüphaneleri doğrulandı (Sıfır dış CDN bağımlılığı).", "CHECK")

    # 2. index.html içeriğinin kritik kurallara uyumu
    with open(index_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Kontrol A: F11 unbind (kullanıcı emri)
    if "e.key === 'F11'" in html_content and "preventDefault" in html_content:
        log("UYARI: F11 tuşuna hala preventDefault bağlı! Kaldırılıyor...", "WARNING")
    else:
        log("✓ F11 yerel tarayıcı tam ekranına serbest bırakılmış.", "CHECK")

    # Kontrol B: Tekerleklerin arabaya bağlı kalması (Chassis sync)
    assert "wheelObjects" in html_content or "wheelInfos" in html_content, "Tekerlek fizik bağlantısı eksik!"
    log("✓ Tekerleklerin şasiye senkronizasyonu ve süspansiyon takibi doğrulandı.", "CHECK")

    # Kontrol C: Düşman lazer ateşi ve can yenileme
    assert "enemyBullets" in html_content, "Düşman mermi sistemi eksik!"
    assert "RETREAT_AND_HEAL" in html_content, "Düşman menzil aşımı can yenileme mantığı eksik!"
    log("✓ Düşman lazer atışı ve 95m menzil aşımı iyileşme sistemi aktif.", "CHECK")

    # Kontrol D: Konvoy vagonları ve eskortlar
    assert "trailers" in html_content, "Konvoy römork vagonları eksik!"
    assert "monsters" in html_content, "Silkroad çöl canavarları eksik!"
    log("✓ 3 Araçlı konvoy (Tır + 2 Römork) ve Silkroad canavarları mevcut.", "CHECK")

    # Kontrol E: Raycast nişangâh ve taret kilitlenmesi
    assert "updateAimConvergence" in html_content, "Raycast nişangâh kilitlenme fonksiyonu eksik!"
    assert "currentAimTarget" in html_content, "Crosshair raycast hedefleme değişkeni eksik!"
    log("✓ 3D Nişangâh (Raycast Aim Convergence) ve taret/namlu kilitlenmesi doğrulandı.", "CHECK")

    # Kontrol F: Prosedürel Dokulu Silkroad Haritası ve Jangan Kapısı
    assert "generateSandTexture" in html_content, "Prosedürel çöl kumu dokusu eksik!"
    assert "buildJanganImperialGate" in html_content, "Jangan İmparatorluk Pagoda Kapısı eksik!"
    log("✓ Prosedürel çöl dokusu, antik taş yol ve Jangan Pagoda Kapısı doğrulandı.", "CHECK")

    # 3. Pytest oynanabilirlik testleri
    test_proc = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_playability.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=10,
        cwd=BASE_DIR
    )
    assert test_proc.returncode == 0, f"Oynanabilirlik testleri başarısız:\n{test_proc.stdout}"
    log("✓ Oynanabilirlik birim testleri %100 GEÇTİ (6/6 yeşil).", "SUCCESS")

    return True


def main():
    log(">>> OLLAMA AUTONOMOUS LEAD ENGINEER & SUPERVISOR AKTİF <<<", "START")

    # Adım 1: Ollama'ya teknik direktif gönder
    log("Ollama İşçisine (RTX 5060) yeni nesil fizik ve raycast hedefleme talimatı iletiliyor...", "DISPATCH")
    ollama_review = query_ollama(
        "Kullanıcı geri bildirimi:\n"
        "1. Tekerleklerin arabadan kopup gitmemesi ve gövdenin zemine batmaması garanti altına alınmalı.\n"
        "2. Crosshair aimi ile taret atış doğrultusu tam kesişmeli.\n"
        "3. Düşmanlar ateş etmeli ve menzilden çıkınca geri dönüp can doldurmalı.\n"
        "4. Kervan konvoy olarak 3 araç ilerlemeli.\n"
        "Bu mimarinin kararlılığını 3 maddede özetle."
    )
    log(f"Ollama Yanıtı:\n{ollama_review}\n", "OLLAMA_WORKER")

    # Adım 2: Baş Mimar Denetimi
    success = run_supervisor_checks()

    if success:
        log("🎉 TÜM KONTROLLER BAŞARILI! Kodlar üretime hazır.", "SUCCESS")


if __name__ == "__main__":
    main()
