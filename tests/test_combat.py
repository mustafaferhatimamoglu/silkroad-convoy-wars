"""
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
