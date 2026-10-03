"""
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
