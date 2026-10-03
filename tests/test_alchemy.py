"""
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
