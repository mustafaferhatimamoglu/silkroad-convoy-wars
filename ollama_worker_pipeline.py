r"""
Ollama Autonomous Dispatcher & Lead Architect Supervisor
Silkroad: Convoy Wars
Kullanıcı Direktifi: "bunların hiçbirini sen yapma ver ollamaya çalışsın sen kontrollerini yap eksiklerini bul devam etmesini sağla"
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
OLLAMA_TIMEOUT = 30  # C:\Rules.md kuralı


def log(msg, level="INFO"):
    t = time.strftime("%H:%M:%S")
    print(f"[{t}][{level}] {msg}")
    sys.stdout.flush()


def query_ollama(prompt, system="Sen Three.js ve Cannon.js konusunda uzman kıdemli bir 3D oyun motoru geliştiricisisin."):
    """Ollama RTX 5060 işçisine iş emri gönderir."""
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 1500}
        }
        res = requests.post(OLLAMA_URL, json=payload, timeout=OLLAMA_TIMEOUT)
        if res.status_code == 200:
            return res.json().get("response", "").strip()
        else:
            return f"Ollama HTTP {res.status_code}: {res.text}"
    except Exception as e:
        return f"Ollama Hatası: {e}"


def task_1_physics_wheels():
    log("=== GÖREV 1: FİZİK MOTORU & TEKERLEK BAĞLANTISI (OLLAMA ÇALIŞTIRILIYOR) ===", "TASK")
    prompt = """
Three.js ve Cannon.js ile 6 tekerlekli zırhlı bir tır yapıyoruz.
SORUN: Tekerlekler arabaya bağlı kalmadı, dünya koordinatları yanlış atanarak arabadan kopup gitti ('kaptırdı gittiler').
Ayrıca araç yere batık görünmemeli, tekerleklerin amortisör ve yay süspansiyonu olmalı.

Bize Three.js içinde tekerleklerin şasiye (chassis) ASLA KOPMAYACAK şekilde bağlanmasını ve tekerleklerin bağımsız süspansiyonla (suspension) zemini takip etmesini sağlayan JavaScript fonksiyonunu yaz.
Gereksinimler:
1. Tekerlek mesh'leri `truckChassis` veya `truckRoot` içinde lokal koordinatlarla tanımlanmalı veya dünya koordinatları şasiye kesinlikle bağlı kalmalı (asla ayrılıp gidemez).
2. Her tekerlek için getTerrainElevation(wx, wz) ile zemin yüksekliği okunmalı.
3. Amortisör yaylanması (suspensionTravel) hesaplanmalı: tekerlek göbeği zemin yüksekliğinde kalırken şasi süspansiyon yüksekliğinde (amortisör payı ile) havada durmalı.
4. Tekerlekler araba hızlandıkça kendi dönüş ekseninde dönmeli (roll), ön tekerlekler direksiyonla dönmeli (steer).

Sadece temiz, doğrudan entegre edilebilir JavaScript kodunu ve açıklamasını ver.
"""
    response = query_ollama(prompt)
    log(f"Ollama Yanıtı (Görev 1):\n{response}\n", "OLLAMA")
    return response


def task_2_aim_crosshair():
    log("=== GÖREV 2: DOĞRU AİM & CROSSHAIR RAYCASTING (OLLAMA ÇALIŞTIRILIYOR) ===", "TASK")
    prompt = """
Three.js TPS (Third Person Shooter) araç savaş oyunumuzda ekranın ortasında crosshair (nişangah) var.
SORUN: Kullanıcı 'aimin yeri yanlış' dedi. Çünkü kamera araca doğru baktığı için mermiler crosshair'ın gösterdiği yere değil, aracın tavanına veya rastgele bir yöne gidiyordu.

Crosshair ile %100 örtüşen, AAA oyunlardaki (World of Tanks / Crossout) gibi çalışan taret nişan alma ve mermi ateşleme sistemini yaz:
1. Kamera ekran ortasından (0, 0 normalize koordinat) bir THREE.Raycaster fırlatsın.
2. Bu ışın sahnedeki zemini, düşmanları veya en az 300 metre uzaktaki hedef noktasını (targetPoint) bulsun.
3. Çift taret kaidesi (turretBase) ve namlular (leftBarrel, rightBarrel) hedef noktasına (targetPoint) doğru baksın (turret yaw ve barrel pitch).
4. Sol tık yapıldığında mermi namlu ucundan çıksın ve DOĞRUDAN bu targetPoint noktasına doğru uçsun.
5. Böylece crosshair hedefin üzerindeyken ateş edildiğinde mermi tam hedefe isabet etsin.

Sadece temiz, doğrudan entegre edilebilir JavaScript kodunu ver.
"""
    response = query_ollama(prompt)
    log(f"Ollama Yanıtı (Görev 2):\n{response}\n", "OLLAMA")
    return response


def task_3_silkroad_map():
    log("=== GÖREV 3: SİLKROAD HARİTASI, RENKLİ GİYDİRME & ÇEVRE (OLLAMA ÇALIŞTIRILIYOR) ===", "TASK")
    prompt = """
Silkroad Online atmosferinde zengin, renkli ve detaylı bir 3D çöl & ipek yolu haritası oluşturuyoruz.
Kullanıcı 'halen haritayı tam olarak yapmamışsın, gerçek bir oyun haritası istiyorum' dedi.

Three.js için şunları içeren zengin bir harita üretim modülü yaz:
1. Canvas ile prosedürel çöl kumu dokusu (sand texture - dalgalı sarı/altın çöl kumları) ve antik ipek yolu taş kaplama dokusu (cobblestone road texture) üretip Three.js materyallerine bağlama.
2. Jangan Şehir Kapısı: Geleneksel Çin pagodası çatılı, kırmızı sütunlu, altın süslemeli devasa sur kapısı.
3. Taklamakan Çölü Kanyonları & Kaya Oluşumları: Haritaya serpiştirilmiş detaylı çöl kayaları, sarp tepeler.
4. Hotan Kalesi & Kervansaray: Çöl ortasında kerpiç surlar, pazar çadırları, kervan sandıkları.
5. Vaha: Canlı yeşil palmiyeler, su birikintisi ve kervan dinlenme alanı.
6. Yol kenarı fenerleri ve gözetleme kuleleri (watchtowers).

Sadece temiz, doğrudan Three.js sahnesine eklenebilir JavaScript fonksiyonlarını ver.
"""
    response = query_ollama(prompt)
    log(f"Ollama Yanıtı (Görev 3):\n{response}\n", "OLLAMA")
    return response


def main():
    log("OLLAMA İŞÇİ DÖNGÜSÜ BAŞLATILIYOR...", "START")
    r1 = task_1_physics_wheels()
    r2 = task_2_aim_crosshair()
    r3 = task_3_silkroad_map()
    
    with open(os.path.join(BASE_DIR, "ollama_solutions.json"), "w", encoding="utf-8") as f:
        json.dump({
            "physics_wheels": r1,
            "aim_crosshair": r2,
            "silkroad_map": r3
        }, f, ensure_ascii=False, indent=2)
    
    log("Ollama'nın ürettiği çözümler 'ollama_solutions.json' dosyasına kaydedildi.", "SUCCESS")


if __name__ == "__main__":
    main()
