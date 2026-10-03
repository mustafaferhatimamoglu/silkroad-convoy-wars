"""
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
