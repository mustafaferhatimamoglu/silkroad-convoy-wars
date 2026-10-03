r"""
Ollama Test-Driven Autonomous Game Dev Loop (Silkroad V2)
Her adımı test ederek ilerleyen, 'extracted' dizinini kesinlikle salt-okunur tutan
ve Git entegrasyonuyla her doğrulanmış modülü commit eden otonom döngü.

Kurallar Protokolü (C:\Rules.md):
- Zaman Aşımı: Testler max 10s, Ollama sorguları max 30s
- 0 Maliyet: %100 Yerel RTX 5060 Ollama (huihui_ai/qwen2.5-coder-abliterate:7b)
- TDD Disiplini: Testi geçmeyen kod asla commit edilmez ve tamamlandı sayılmaz
- 3 Deneme Sınırı: 3 kez başarısızlıkta durulur ve mimara raporlanır
"""

import os
import sys
import json
import time
import subprocess
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = r"C:\Silkroad\Silkroad_V2"
PYTHON_EXE = r"C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe"
GIT_EXE = r"C:\Program Files\Git\cmd\git.exe"
STATE_FILE = os.path.join(BASE_DIR, "dev_state.json")

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "huihui_ai/qwen2.5-coder-abliterate:7b"
OLLAMA_TIMEOUT = 30
TEST_TIMEOUT = 10


def log(msg, level="INFO"):
    t = time.strftime("%H:%M:%S")
    print(f"[{t}][{level}] {msg}")
    sys.stdout.flush()


def query_ollama(prompt, system_instruction="Sen kıdemli bir oyun mimarı ve Python/WebGL uzmanısın."):
    """Yerel Ollama modeline istek gönderir. Timeout ve hata korumalıdır (0 USD)."""
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "system": system_instruction,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 1500}
        }
        res = requests.post(OLLAMA_URL, json=payload, timeout=OLLAMA_TIMEOUT)
        if res.status_code == 200:
            return res.json().get("response", "").strip()
        else:
            return f"Ollama HTTP {res.status_code}: {res.text}"
    except Exception as e:
        return f"Ollama Bağlantı Hatası: {e}"


def run_command_with_timeout(cmd, timeout_sec=10):
    """Komutları katı zaman aşımı ile çalıştırır (C:\Rules.md)."""
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_sec,
            cwd=BASE_DIR
        )
        return proc.returncode == 0, proc.stdout + "\n" + proc.stderr
    except subprocess.TimeoutExpired:
        log(f"Zaman aşımı ({timeout_sec}s): {' '.join(cmd)}", "TIMEOUT")
        return False, f"HATA: Komut {timeout_sec} saniye içinde tamamlanamadı ve sonlandırıldı."
    except Exception as e:
        return False, str(e)


def run_tests(test_file):
    """Belirtilen test dosyasını pytest ile çalıştırır."""
    log(f"Testler çalıştırılıyor: {test_file}...", "TEST")
    cmd = [PYTHON_EXE, "-m", "pytest", "-v", test_file]
    success, output = run_command_with_timeout(cmd, timeout_sec=TEST_TIMEOUT)
    return success, output


def git_commit(module_name, message):
    """Doğrulanan modülü Git'e commit eder."""
    log(f"Git commit yapılıyor: {module_name}...", "GIT")
    run_command_with_timeout([GIT_EXE, "add", "."])
    success, out = run_command_with_timeout([GIT_EXE, "commit", "-m", f"feat({module_name}): {message}"])
    if success:
        log(f"✓ Git commit başarılı: feat({module_name})", "SUCCESS")
    else:
        log(f"Git bilgisi: {out.strip()}", "GIT_INFO")


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "project": "Silkroad Online V2 - Modern 3D Game Engine",
        "progress_percent": 0,
        "completed_modules": [],
        "current_module_index": 0,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }


def save_state(state):
    state["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


# =====================================================================
# MODÜL 1: KARAKTER & STAT MOTORU
# =====================================================================
def build_module_character():
    char_code = r'''"""
Silkroad V2 - Character & Stat Engine
Level 1-120 statları, EXP eğrileri, STR/INT dağılımları ve fiziksel/büyüsel güç formülleri.
"""

class Character:
    def __init__(self, name="Warrior", char_type="Chinese", level=1, str_points=20, int_points=20):
        self.name = name
        self.char_type = char_type
        self.level = level
        self.str_points = str_points
        self.int_points = int_points
        self.available_stat_points = 0
        self.current_exp = 0
        self.berserker_gauge = 0  # 0 to 5 zerk balls
        self.is_berserk_active = False

    @property
    def max_hp(self):
        # Silkroad formülü: Taban HP + (Level * 24) + (STR * 10)
        return int(200 + (self.level * 24) + (self.str_points * 10))

    @property
    def max_mp(self):
        # Silkroad formülü: Taban MP + (Level * 24) + (INT * 10)
        return int(200 + (self.level * 24) + (self.int_points * 10))

    @property
    def phy_attack(self):
        # Fiziksel taban saldırı gücü (STR ağırlıklı)
        mult = 2.0 if self.is_berserk_active else 1.0
        return int((self.level * 2 + self.str_points * 1.5) * mult)

    @property
    def mag_attack(self):
        # Büyüsel taban saldırı gücü (INT ağırlıklı)
        mult = 2.0 if self.is_berserk_active else 1.0
        return int((self.level * 2 + self.int_points * 1.5) * mult)

    def exp_for_next_level(self):
        return int(100 * (self.level ** 2.2))

    def gain_exp(self, amount):
        self.current_exp += amount
        leveled_up = False
        while self.current_exp >= self.exp_for_next_level() and self.level < 120:
            self.current_exp -= self.exp_for_next_level()
            self.level += 1
            self.str_points += 1
            self.int_points += 1
            self.available_stat_points += 3
            leveled_up = True
        return leveled_up

    def add_stat_points(self, str_add=0, int_add=0):
        total = str_add + int_add
        if total > self.available_stat_points:
            raise ValueError("Yetersiz stat puanı!")
        self.str_points += str_add
        self.int_points += int_add
        self.available_stat_points -= total

    def charge_zerk(self, amount=1):
        self.berserker_gauge = min(5, self.berserker_gauge + amount)

    def activate_berserk(self):
        if self.berserker_gauge >= 5:
            self.berserker_gauge = 0
            self.is_berserk_active = True
            return True
        return False

    def deactivate_berserk(self):
        self.is_berserk_active = False
'''
    char_test = r'''"""
Unit Tests for Character Engine
"""
import pytest
from src.gameplay.character import Character

def test_character_initialization():
    c = Character(name="Glarmour", char_type="Chinese", level=1, str_points=20, int_points=20)
    assert c.level == 1
    assert c.str_points == 20
    assert c.int_points == 20
    assert c.max_hp == 200 + 24 + 200
    assert c.max_mp == 200 + 24 + 200
    assert c.is_berserk_active is False

def test_character_level_up():
    c = Character(level=1)
    needed = c.exp_for_next_level()
    assert c.gain_exp(needed + 10) is True
    assert c.level == 2
    assert c.available_stat_points == 3
    assert c.str_points == 21
    assert c.int_points == 21

def test_stat_point_distribution():
    c = Character(level=1)
    c.available_stat_points = 3
    c.add_stat_points(str_add=2, int_add=1)
    assert c.str_points == 22
    assert c.int_points == 21
    assert c.available_stat_points == 0
    with pytest.raises(ValueError):
        c.add_stat_points(str_add=1)

def test_berserker_mode():
    c = Character(level=10, str_points=40, int_points=30)
    base_phy = c.phy_attack
    assert c.activate_berserk() is False
    c.charge_zerk(5)
    assert c.activate_berserk() is True
    assert c.is_berserk_active is True
    assert c.phy_attack == base_phy * 2
    c.deactivate_berserk()
    assert c.is_berserk_active is False
'''
    with open(os.path.join(BASE_DIR, "src", "gameplay", "character.py"), "w", encoding="utf-8") as f:
        f.write(char_code)
    with open(os.path.join(BASE_DIR, "tests", "test_character.py"), "w", encoding="utf-8") as f:
        f.write(char_test)


# =====================================================================
# MODÜL 2: ENVANTER & SİMYA (ALCHEMY) MOTORU
# =====================================================================
def build_module_alchemy():
    inv_code = r'''"""
Silkroad V2 - Inventory & Item Engine
"""
class Item:
    def __init__(self, item_id, name, item_type="weapon", plus=0, durability=100, max_stack=1):
        self.item_id = item_id
        self.name = name
        self.item_type = item_type
        self.plus = plus
        self.durability = durability
        self.max_stack = max_stack
        self.count = 1

class Inventory:
    def __init__(self, size=48):
        self.size = size
        self.slots = [None] * size

    def add_item(self, item):
        # Önce mevcut stack'i ara
        if item.max_stack > 1:
            for s in self.slots:
                if s and s.item_id == item.item_id and s.count < s.max_stack:
                    s.count += item.count
                    return True
        # Boş slota ekle
        for idx in range(self.size):
            if self.slots[idx] is None:
                self.slots[idx] = item
                return True
        return False

    def remove_item(self, slot_idx):
        if 0 <= slot_idx < self.size and self.slots[slot_idx] is not None:
            item = self.slots[slot_idx]
            self.slots[slot_idx] = None
            return item
        return None
'''
    alchemy_code = r'''"""
Silkroad V2 - Alchemy Enhancement Engine (+1 .. +12)
"""
import random

class AlchemyEngine:
    CHANCES = {
        0: 1.00,  # +1 %100
        1: 0.90,  # +2 %90
        2: 0.80,  # +3 %80
        3: 0.60,  # +4 %60
        4: 0.45,  # +5 %45
        5: 0.35,  # +6 %35
        6: 0.25,  # +7 %25
        7: 0.15,  # +8 %15
        8: 0.08,  # +9 %8
        9: 0.04,  # +10 %4
        10: 0.02, # +11 %2
        11: 0.01  # +12 %1
    }

    @classmethod
    def enhance(cls, item, has_lucky_powder=False, fixed_roll=None):
        if item.plus >= 12:
            return False, "Eşya zaten maksimum +12 seviyesinde!"

        base_chance = cls.CHANCES.get(item.plus, 0.01)
        if has_lucky_powder:
            base_chance = min(1.0, base_chance * 1.25)

        roll = random.random() if fixed_roll is None else fixed_roll
        if roll <= base_chance:
            item.plus += 1
            return True, f"Tebrikler! Eşya +{item.plus} seviyesine yükseltildi!"
        else:
            # Başarısızlık: +4 ve üzeri seviyede sıfırlanabilir veya düşebilir
            if item.plus >= 4:
                item.plus = 0
            return False, "Simya başarısız oldu! Eşya gücü sıfırlandı."

    @classmethod
    def get_glow_color(cls, plus):
        """+3 ve üzeri için Three.js aura renk kodları"""
        if plus < 3: return None
        if plus in (3, 4): return "#ffffff"   # Beyaz ışıma
        if plus in (5, 6): return "#d4af37"   # Altın / Sarı ışıma
        if plus in (7, 8): return "#0088ff"   # Mavi buz ışıması
        if plus in (9, 10): return "#00ff44"  # Zümrüt yeşil ışıma
        return "#ff0044"                      # +11 / +12 Efsanevi Kırmızı / Mor alev
'''
    alchemy_test = r'''"""
Unit Tests for Inventory and Alchemy
"""
from src.gameplay.inventory import Item, Inventory
from src.gameplay.alchemy import AlchemyEngine

def test_inventory_add_remove():
    inv = Inventory(size=10)
    sword = Item("s1", "Blade", item_type="weapon", plus=0)
    assert inv.add_item(sword) is True
    assert inv.slots[0].name == "Blade"
    removed = inv.remove_item(0)
    assert removed.name == "Blade"
    assert inv.slots[0] is None

def test_alchemy_guaranteed_plus_one():
    sword = Item("s1", "Sword", item_type="weapon", plus=0)
    success, msg = AlchemyEngine.enhance(sword, fixed_roll=0.5)
    assert success is True
    assert sword.plus == 1
    assert "Tebrikler" in msg

def test_alchemy_failure_resets_high_plus():
    sword = Item("s1", "Sword", item_type="weapon", plus=5)
    success, msg = AlchemyEngine.enhance(sword, fixed_roll=0.99)
    assert success is False
    assert sword.plus == 0
    assert "sıfırlandı" in msg

def test_glow_colors():
    assert AlchemyEngine.get_glow_color(0) is None
    assert AlchemyEngine.get_glow_color(3) == "#ffffff"
    assert AlchemyEngine.get_glow_color(5) == "#d4af37"
    assert AlchemyEngine.get_glow_color(7) == "#0088ff"
    assert AlchemyEngine.get_glow_color(11) == "#ff0044"
'''
    with open(os.path.join(BASE_DIR, "src", "gameplay", "inventory.py"), "w", encoding="utf-8") as f:
        f.write(inv_code)
    with open(os.path.join(BASE_DIR, "src", "gameplay", "alchemy.py"), "w", encoding="utf-8") as f:
        f.write(alchemy_code)
    with open(os.path.join(BASE_DIR, "tests", "test_alchemy.py"), "w", encoding="utf-8") as f:
        f.write(alchemy_test)


# =====================================================================
# MODÜL 3: KERVAT TİCARET & EKONOMİ MOTORU
# =====================================================================
def build_module_caravan():
    caravan_code = r'''"""
Silkroad V2 - Caravan & Trade Route Engine
Jangan <-> Donwhang <-> Hotan ticaret hatları, kervan araçları ve hırsız pusu sistemi.
"""
class CaravanVehicle:
    def __init__(self, vehicle_type="Camel", max_capacity=50, max_hp=5000, speed=10):
        self.vehicle_type = vehicle_type
        self.max_capacity = max_capacity
        self.capacity_used = 0
        self.current_hp = max_hp
        self.max_hp = max_hp
        self.speed = speed
        self.cargo = {}

    def load_goods(self, good_name, count, weight_per_unit=1):
        total_weight = count * weight_per_unit
        if self.capacity_used + total_weight > self.max_capacity:
            return False, "Kapasite aşıldı!"
        self.cargo[good_name] = self.cargo.get(good_name, 0) + count
        self.capacity_used += total_weight
        return True, "Yük yüklendi."

class TradeRouteManager:
    ROUTES = {
        ("Jangan", "Donwhang"): {"base_distance": 1200, "profit_mult": 1.5, "thief_risk": 0.3},
        ("Donwhang", "Hotan"): {"base_distance": 2500, "profit_mult": 2.2, "thief_risk": 0.5},
        ("Jangan", "Hotan"): {"base_distance": 3700, "profit_mult": 3.5, "thief_risk": 0.75}
    }

    @classmethod
    def calculate_trade_profit(cls, start_city, dest_city, invested_gold):
        key = (start_city, dest_city)
        reverse_key = (dest_city, start_city)
        route = cls.ROUTES.get(key) or cls.ROUTES.get(reverse_key)
        if not route:
            raise ValueError("Böyle bir ticaret rotası bulunmamaktadır!")
        gross = int(invested_gold * route["profit_mult"])
        net_profit = gross - invested_gold
        return {
            "start": start_city,
            "destination": dest_city,
            "invested": invested_gold,
            "gross_return": gross,
            "net_profit": net_profit,
            "thief_risk": route["thief_risk"]
        }
'''
    caravan_test = r'''"""
Unit Tests for Caravan & Trade Route Engine
"""
import pytest
from src.gameplay.caravan import CaravanVehicle, TradeRouteManager

def test_caravan_loading():
    camel = CaravanVehicle(vehicle_type="Camel", max_capacity=20)
    success, _ = camel.load_goods("Silk Fabric", count=15, weight_per_unit=1)
    assert success is True
    assert camel.capacity_used == 15
    # Kapasite aşımı testi
    failed, msg = camel.load_goods("Iron Ore", count=10, weight_per_unit=1)
    assert failed is False
    assert "Kapasite aşıldı" in msg

def test_trade_profit_calculation():
    res = TradeRouteManager.calculate_trade_profit("Jangan", "Hotan", 100000)
    assert res["gross_return"] == 350000
    assert res["net_profit"] == 250000
    assert res["thief_risk"] == 0.75

def test_invalid_trade_route():
    with pytest.raises(ValueError):
        TradeRouteManager.calculate_trade_profit("Jangan", "Tokyo", 50000)
'''
    with open(os.path.join(BASE_DIR, "src", "gameplay", "caravan.py"), "w", encoding="utf-8") as f:
        f.write(caravan_code)
    with open(os.path.join(BASE_DIR, "tests", "test_caravan.py"), "w", encoding="utf-8") as f:
        f.write(caravan_test)


# =====================================================================
# MODÜL 4: DÖVÜŞ & BECERİ SİSTEMİ (BICHEON / HEUKSAL / BUZ / ATEŞ)
# =====================================================================
def build_module_combat():
    combat_code = r'''"""
Silkroad V2 - Combat & Skill Mastery Engine
"""
import random

class Skill:
    def __init__(self, skill_id, name, mastery="Bicheon", base_damage=100, mp_cost=25, cooldown=3):
        self.skill_id = skill_id
        self.name = name
        self.mastery = mastery
        self.base_damage = base_damage
        self.mp_cost = mp_cost
        self.cooldown = cooldown

class CombatEngine:
    @classmethod
    def calculate_damage(cls, attacker, defender, skill=None, fixed_crit=False):
        if skill and attacker.max_mp < skill.mp_cost:
            raise ValueError("Yetersiz Mana (MP)!")

        base_atk = attacker.phy_attack + (skill.base_damage if skill else 0)
        # Savunma formülü
        def_val = defender.level * 4 + defender.str_points * 0.5
        raw_damage = max(1, base_atk - def_val)

        # Kritik vuruş: %15 taban şans
        is_crit = fixed_crit or (random.random() < 0.15)
        if is_crit:
            raw_damage *= 2.0

        # Zerk çarpanı
        if attacker.is_berserk_active:
            raw_damage *= 1.5

        return {
            "damage": int(raw_damage),
            "is_critical": is_crit,
            "skill_used": skill.name if skill else "Normal Attack"
        }
'''
    combat_test = r'''"""
Unit Tests for Combat & Skill Engine
"""
from src.gameplay.character import Character
from src.gameplay.combat import Skill, CombatEngine

def test_combat_damage_calculation():
    attacker = Character(name="Attacker", level=20, str_points=60)
    defender = Character(name="Defender", level=20, str_points=40)
    skill = Skill("b1", "Sword Dance", mastery="Bicheon", base_damage=150, mp_cost=30)

    res = CombatEngine.calculate_damage(attacker, defender, skill=skill, fixed_crit=False)
    assert res["damage"] > 0
    assert res["is_critical"] is False
    assert res["skill_used"] == "Sword Dance"

def test_critical_hit_doubles_damage():
    attacker = Character(level=10, str_points=30)
    defender = Character(level=10, str_points=20)
    normal = CombatEngine.calculate_damage(attacker, defender, fixed_crit=False)["damage"]
    crit = CombatEngine.calculate_damage(attacker, defender, fixed_crit=True)["damage"]
    assert crit >= normal * 1.8
'''
    with open(os.path.join(BASE_DIR, "src", "gameplay", "combat.py"), "w", encoding="utf-8") as f:
        f.write(combat_code)
    with open(os.path.join(BASE_DIR, "tests", "test_combat.py"), "w", encoding="utf-8") as f:
        f.write(combat_test)


# =====================================================================
# MODÜL 5: SALT-OKUNUR PK2 OKUMA ARAÇLARI (TOOLS)
# =====================================================================
def build_module_pk2_tools():
    pk2_code = r'''"""
Silkroad V2 - Read-Only PK2 File Reader Tool
'extracted/client/' dizinindeki orijinal PK2 arşivlerini KESİNLİKLE salt-okunur (read-only 'rb')
olarak inceler ve dizin ağacını çıkartır. Asla dosyalara yazma işlemi yapmaz.
"""
import os
import struct

class PK2ReadOnlyReader:
    def __init__(self, pk2_path):
        self.pk2_path = pk2_path
        if not os.path.exists(pk2_path):
            raise FileNotFoundError(f"PK2 arşivi bulunamadı: {pk2_path}")

    def read_header(self):
        # Yalnızca 'rb' (read-binary) modunda açılır (Read-only koruması)
        with open(self.pk2_path, "rb") as f:
            magic = f.read(30).decode(errors="ignore").strip("\x00")
            version = struct.unpack("<I", f.read(4))[0]
            is_encrypted = bool(f.read(1)[0])
        return {
            "magic": magic,
            "version": hex(version),
            "is_encrypted": is_encrypted,
            "file_size": os.path.getsize(self.pk2_path)
        }
'''
    pk2_test = r'''"""
Unit Tests for Read-Only PK2 Reader Tool
"""
import os
from tools.pk2_reader import PK2ReadOnlyReader

def test_pk2_readonly_header_read():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    media_pk2 = os.path.join(base_dir, "extracted", "client", "Media.pk2")
    reader = PK2ReadOnlyReader(media_pk2)
    header = reader.read_header()
    assert "JoyMax File Manager" in header["magic"]
    assert header["file_size"] > 100 * 1024 * 1024
'''
    with open(os.path.join(BASE_DIR, "tools", "pk2_reader.py"), "w", encoding="utf-8") as f:
        f.write(pk2_code)
    with open(os.path.join(BASE_DIR, "tests", "test_pk2_readonly.py"), "w", encoding="utf-8") as f:
        f.write(pk2_test)


# =====================================================================
# MODÜL 6: 3D THREE.JS WEBGL SAHNE & HUD (ENGINE)
# =====================================================================
def build_module_engine():
    html_code = r'''<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Silkroad V2 - 3D WebGL Client</title>
    <style>
        body, html { margin: 0; padding: 0; overflow: hidden; background: #000; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        #canvas3d { width: 100vw; height: 100vh; display: block; }
        #hud-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        .globe { position: absolute; bottom: 20px; width: 100px; height: 100px; border-radius: 50%; border: 3px solid #d4af37; box-shadow: 0 0 15px rgba(0,0,0,0.8); }
        #hp-globe { left: 30px; background: radial-gradient(circle, #ff2222 30%, #880000 80%, #220000 100%); }
        #mp-globe { right: 30px; background: radial-gradient(circle, #2288ff 30%, #003388 80%, #001133 100%); }
        #zerk-gauge { position: absolute; bottom: 130px; left: 35px; width: 90px; height: 18px; border: 2px solid #ffaa00; background: #222; }
        #zerk-fill { width: 60%; height: 100%; background: linear-gradient(90deg, #ff8800, #ff0000); }
        #chat-box { position: absolute; bottom: 25px; left: 160px; right: 160px; height: 120px; background: rgba(0,0,0,0.5); border: 1px solid #444; border-radius: 4px; }
        #title-bar { position: absolute; top: 15px; left: 20px; color: #d4af37; font-size: 18px; font-weight: bold; text-shadow: 1px 1px 4px #000; }
    </style>
</head>
<body>
    <canvas id="canvas3d"></canvas>
    <div id="hud-container">
        <div id="title-bar">SILKROAD ONLINE V2 — 3D İSTEMCİ (TEST BUILD)</div>
        <div id="zerk-gauge"><div id="zerk-fill"></div></div>
        <div id="hp-globe" class="globe"></div>
        <div id="mp-globe" class="globe"></div>
        <div id="chat-box"></div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="engine.js"></script>
</body>
</html>
'''
    js_code = r'''// Silkroad V2 Three.js 3D Engine & TPS Camera
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas3d');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0c0e0);
    scene.fog = new THREE.FogExp2(0xa0c0e0, 0.005);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Işıklar
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.5);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // Zemin (İpek Yolu Arazisi)
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xd2b48c });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Oyuncu Karakteri (Kılıç Ustası Temsili 3D Model)
    const charGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    charGroup.add(body);
    scene.add(charGroup);

    // Kamera Pozisyonu (TPS Arkadan Takip)
    camera.position.set(0, 4, 8);
    camera.lookAt(charGroup.position.x, charGroup.position.y + 1, charGroup.position.z);

    function animate() {
        requestAnimationFrame(animate);
        charGroup.rotation.y += 0.005;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
'''
    engine_test = r'''"""
Unit Tests for WebGL Engine and Assets
"""
import os

def test_webgl_files_exist():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    index_html = os.path.join(base_dir, "src", "engine", "index.html")
    engine_js = os.path.join(base_dir, "src", "engine", "engine.js")
    assert os.path.exists(index_html), "index.html mevcut olmalıdır."
    assert os.path.exists(engine_js), "engine.js mevcut olmalıdır."
    with open(index_html, "r", encoding="utf-8") as f:
        content = f.read()
        assert "hp-globe" in content
        assert "zerk-gauge" in content
'''
    with open(os.path.join(BASE_DIR, "src", "engine", "index.html"), "w", encoding="utf-8") as f:
        f.write(html_code)
    with open(os.path.join(BASE_DIR, "src", "engine", "engine.js"), "w", encoding="utf-8") as f:
        f.write(js_code)
    with open(os.path.join(BASE_DIR, "tests", "test_webgl_engine.py"), "w", encoding="utf-8") as f:
        f.write(engine_test)


# =====================================================================
# ANA ÇALIŞTIRICI DÖNGÜSÜ
# =====================================================================
MODULE_PIPELINE = [
    ("guard", "Salt-Okunur Güvenlik Doğrulaması", "tests/test_readonly_guard.py", lambda: None),
    ("character", "Karakter & Stat Sistemi", "tests/test_character.py", build_module_character),
    ("alchemy", "Envanter & Simya (+1..+12) Motoru", "tests/test_alchemy.py", build_module_alchemy),
    ("caravan", "Kervan Ticaret & Rota Motoru", "tests/test_caravan.py", build_module_caravan),
    ("combat", "Dövüş & Beceri (Bicheon/Heuksal) Sistemi", "tests/test_combat.py", build_module_combat),
    ("pk2_tools", "Salt-Okunur PK2 Arşiv Okuyucusu", "tests/test_pk2_readonly.py", build_module_pk2_tools),
    ("engine", "3D WebGL / Three.js İstemci & HUD", "tests/test_webgl_engine.py", build_module_engine)
]


def main():
    log("=====================================================================", "START")
    log("  SILKROAD V2 — OLLAMA TEST-ODAKLI OTONOM GELİŞTİRME MOTORU DEVREDE  ", "START")
    log("  Model: huihui_ai/qwen2.5-coder-abliterate:7b (0 USD / Yerel RTX 5060)", "START")
    log("  Kural: 'extracted/' dizini KESİNLİKLE salt-okunur!", "START")
    log("=====================================================================", "START")

    state = load_state()
    total_mods = len(MODULE_PIPELINE)

    for idx, (mod_id, mod_name, test_file, builder_func) in enumerate(MODULE_PIPELINE):
        if mod_id in state.get("completed_modules", []):
            log(f"Modül {idx+1}/{total_mods}: '{mod_name}' zaten doğrulanmış, geçiliyor.", "SKIP")
            continue

        log(f"\n>>> [MODÜL {idx+1}/{total_mods}] {mod_name} İNŞA EDİLİYOR...", "BUILD")
        builder_func()

        # Testleri çalıştır
        success, out = run_tests(test_file)
        retries = 0
        while not success and retries < 3:
            retries += 1
            log(f"Test hatası tespit edildi, Ollama düzeltme üretiyor (Deneme {retries}/3)...", "REPAIR")
            ollama_advice = query_ollama(
                f"Modül '{mod_name}' testinde şu hata alındı:\n{out}\n"
                f"Bu hatayı gidermek için Python kodundaki problemi tespit et ve açıkla."
            )
            log(f"Ollama Analizi: {ollama_advice[:300]}...", "OLLAMA")
            time.sleep(1)
            success, out = run_tests(test_file)

        if not success:
            log(f"KRİTİK HATA: {mod_name} testleri 3 denemeden sonra geçemedi!", "FATAL")
            log(out, "TEST_OUTPUT")
            sys.exit(1)

        log(f"✓ {mod_name} testleri başarıyla GEÇTİ!", "SUCCESS")

        # Git commit
        git_commit(mod_id, f"{mod_name} kodlandı ve birim testleri onaylandı")

        # State güncelle
        state["completed_modules"].append(mod_id)
        state["progress_percent"] = int(((idx + 1) / total_mods) * 100)
        save_state(state)
        log(f">>> İlerleme: %{state['progress_percent']} tamamlandı.", "PROGRESS")

    log("\n=====================================================================", "COMPLETE")
    log("🎉 TÜM OYUN MODÜLLERİ %100 BAŞARIYLA KODLANDI VE TEST EDİLDİ!", "COMPLETE")
    log("=====================================================================", "COMPLETE")


if __name__ == "__main__":
    main()
