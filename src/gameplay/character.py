"""
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
