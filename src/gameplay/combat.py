"""
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
