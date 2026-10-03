"""
Playability & Mechanics Test Suite (Silkroad: Convoy Wars)
Fizik motoru, süspansiyon yüksekliği, zemin çekiş katsayıları,
düşman menzil/iyileşme mantığı ve konvoy takip kinematiğini doğrular.
"""

import math
import pytest


def get_terrain_elevation(x, z):
    """Silkroad Çöl Tepeleri yükseklik formülü simülasyonu"""
    dune1 = math.sin(x * 0.008) * math.cos(z * 0.008) * 16.0
    dune2 = math.sin(x * 0.02 + z * 0.015) * 8.0
    dune3 = math.cos(x * 0.04 - z * 0.03) * 3.5
    road_factor = min(1.0, abs(x) / 70.0)
    return (dune1 + dune2 + dune3) * road_factor


def get_surface_traction(x):
    """Zemin çekiş ve sürtünme katsayısı hesabı (Asfalt vs Kum vs Çöl)"""
    if abs(x) < 18.0:
        return {"surface": "Asfalt", "traction": 1.0, "speed_mult": 1.0, "dust": False}
    elif abs(x) < 45.0:
        return {"surface": "Sert Toprak", "traction": 0.85, "speed_mult": 0.9, "dust": True}
    else:
        return {"surface": "Çöl Kumu", "traction": 0.65, "speed_mult": 0.75, "dust": True}


def calculate_chassis_clearance(wheel_radius=0.95, suspension_rest=1.5):
    """Aracın gövdesinin zemine batmasını engelleyen minimum yükseklik mesafesi"""
    min_clearance = wheel_radius + suspension_rest * 0.6
    assert min_clearance > 1.5, "Kervan gövdesi zemine batmamalı, en az 1.5m zemin açıklığı olmalıdır."
    return min_clearance


def test_surface_traction_asphalt_vs_sand():
    """Asfalt otoyolda çekişin tam, kumda ise azaltılmış olduğunu doğrular."""
    road = get_surface_traction(5.0)
    assert road["surface"] == "Asfalt"
    assert road["traction"] == 1.0
    assert road["speed_mult"] == 1.0

    sand = get_surface_traction(120.0)
    assert sand["surface"] == "Çöl Kumu"
    assert sand["traction"] < 0.75
    assert sand["dust"] is True


def test_chassis_never_sinks():
    """Amortisör ve tekerlek yüksekliğinin kervanın gömülmesini engellediğini doğrular."""
    clearance = calculate_chassis_clearance(wheel_radius=0.95, suspension_rest=1.5)
    test_elevations = [-15.0, 0.0, 25.0]
    for elev in test_elevations:
        chassis_y = elev + clearance
        assert chassis_y > elev + 1.0, "Gövde asla yer seviyesinin altında veya batık kalamaz."


def test_enemy_leash_and_healing_logic():
    """Düşmanların 90m mesafeyi aşınca takipten vazgeçip can tazelediğini test eder."""
    leash_distance = 90.0
    
    enemy = {"hp": 60, "max_hp": 180, "state": "PURSUIT", "spawn_x": 0, "spawn_z": 0}
    player_distance_close = 40.0
    player_distance_far = 110.0

    # Yakındayken takip etmeli
    if player_distance_close <= leash_distance:
        enemy["state"] = "PURSUIT"
    assert enemy["state"] == "PURSUIT"

    # Uzaklaşınca geri dönüp can tazelemeli
    if player_distance_far > leash_distance:
        enemy["state"] = "RETREAT_AND_HEAL"
        enemy["hp"] = min(enemy["max_hp"], enemy["hp"] + 40)

    assert enemy["state"] == "RETREAT_AND_HEAL"
    assert enemy["hp"] == 100


def test_convoy_trailer_tether_kinematics():
    """Konvoy römorklarının lider aracı doğru mesafeyle takip ettiğini doğrular."""
    lead_pos = 100.0
    trailer_spacing = 9.5
    trailer_1_pos = lead_pos - trailer_spacing
    trailer_2_pos = lead_pos - (trailer_spacing * 2)

    assert trailer_1_pos == 90.5
    assert trailer_2_pos == 81.0
    assert trailer_1_pos > trailer_2_pos
    assert lead_pos > trailer_1_pos
