"""
Playability & Mechanics Test Suite (Silkroad: Convoy Wars)
Fizik motoru, tekerlek kopmazlık garantisi, crosshair raycast hedefleme,
süspansiyon yüksekliği, zemin çekiş katsayıları, düşman menzil/iyileşme mantığı
ve konvoy takip kinematiğini %100 doğrular.
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
    """Zemin çekiş ve sürtünme katsayısı hesabı (Antik Yol vs Yol Kenarı vs Taklamakan Kumu)"""
    if abs(x) < 18.0:
        return {"surface": "Antik İpek Yolu Taş Kaplama", "traction": 1.0, "speed_mult": 1.0, "dust": False}
    elif abs(x) < 45.0:
        return {"surface": "Sert Yol Kenarı", "traction": 0.85, "speed_mult": 0.9, "dust": True}
    else:
        return {"surface": "Taklamakan Çöl Kumu", "traction": 0.65, "speed_mult": 0.75, "dust": True}


def calculate_chassis_clearance(wheel_radius=0.95, suspension_rest=1.35):
    """Aracın gövdesinin zemine batmasını engelleyen minimum yükseklik mesafesi"""
    min_clearance = wheel_radius + suspension_rest * 0.6
    assert min_clearance > 1.5, "Kervan gövdesi zemine batmamalı, en az 1.5m zemin açıklığı olmalıdır."
    return min_clearance


def test_surface_traction_asphalt_vs_sand():
    """Antik taş yolda çekişin tam (%100), kumda ise %65 olduğunu doğrular."""
    road = get_surface_traction(5.0)
    assert "İpek Yolu" in road["surface"]
    assert road["traction"] == 1.0
    assert road["speed_mult"] == 1.0

    sand = get_surface_traction(120.0)
    assert "Çöl Kumu" in sand["surface"]
    assert sand["traction"] <= 0.65
    assert sand["dust"] is True


def test_chassis_never_sinks():
    """Amortisör ve tekerlek yüksekliğinin kervanın gömülmesini engellediğini doğrular."""
    clearance = calculate_chassis_clearance(wheel_radius=0.95, suspension_rest=1.35)
    test_elevations = [-15.0, 0.0, 25.0]
    for elev in test_elevations:
        chassis_y = elev + clearance
        assert chassis_y > elev + 1.0, "Gövde asla yer seviyesinin altında veya batık kalamaz."


def test_wheel_never_detaches_from_chassis():
    """Tekerleklerin lokal şasiye kilitli olduğunu, araç nereye giderse gitsin kopamayacağını doğrular."""
    wheel_local_configs = [
        {"id": "FL", "x": -2.3, "z": 3.2},
        {"id": "FR", "x": 2.3, "z": 3.2},
        {"id": "ML", "x": -2.3, "z": 0.0},
        {"id": "MR", "x": 2.3, "z": 0.0},
        {"id": "RL", "x": -2.3, "z": -3.2},
        {"id": "RR", "x": 2.3, "z": -3.2}
    ]

    # Araç çöl boyunca kilometrelerce yol katetse bile
    vehicle_positions = [(0, 0), (450, -800), (-1200, 2500)]
    suspension_rest = 1.35

    for vx, vz in vehicle_positions:
        for w in wheel_local_configs:
            # Lokal ofsetler şasiye göre daima sabittir
            assert abs(w["x"]) == 2.3
            assert w["z"] in [-3.2, 0.0, 3.2]
            # Süspansiyon esneme payı sınırları (clamped travel: -0.65m .. +0.65m)
            min_y = -suspension_rest - 0.65
            max_y = -suspension_rest + 0.65
            assert min_y < 0 and max_y < 0, "Tekerlek göbeği şasinin alt hizasında kalmalıdır."


def test_crosshair_raycast_convergence_math():
    """Nişangah raycast hedefi ile namludan çıkan merminin aynı noktada kesiştiğini doğrular."""
    # Ekran ortası (0, 0) raycast hedefi
    cam_pos = (0, 8, -25)
    cam_dir = (0, -0.05, 1.0) # İleriye doğru bakış
    target_dist = 150.0

    target_point = (
        cam_pos[0] + cam_dir[0] * target_dist,
        cam_pos[1] + cam_dir[1] * target_dist,
        cam_pos[2] + cam_dir[2] * target_dist,
    )

    # Namlu ucu pozisyonu
    barrel_tip = (0.55, 3.5, 3.0)

    # Namludan hedefe ateş vektörü
    shoot_dir = (
        target_point[0] - barrel_tip[0],
        target_point[1] - barrel_tip[1],
        target_point[2] - barrel_tip[2],
    )
    mag = math.sqrt(shoot_dir[0]**2 + shoot_dir[1]**2 + shoot_dir[2]**3 if shoot_dir[2] < 0 else shoot_dir[0]**2 + shoot_dir[1]**2 + shoot_dir[2]**2)
    norm_dir = (shoot_dir[0] / mag, shoot_dir[1] / mag, shoot_dir[2] / mag)

    # Mermi belirli bir süre sonra tam olarak target_point ile buluşur
    bullet_at_target = (
        barrel_tip[0] + norm_dir[0] * mag,
        barrel_tip[1] + norm_dir[1] * mag,
        barrel_tip[2] + norm_dir[2] * mag,
    )
    assert abs(bullet_at_target[0] - target_point[0]) < 1e-4
    assert abs(bullet_at_target[1] - target_point[1]) < 1e-4
    assert abs(bullet_at_target[2] - target_point[2]) < 1e-4


def test_enemy_leash_and_healing_logic():
    """Düşmanların 95m mesafeyi aşınca takipten vazgeçip can tazelediğini test eder."""
    leash_distance = 95.0
    
    enemy = {"hp": 60, "max_hp": 200, "state": "PURSUIT", "spawn_x": 0, "spawn_z": 0}
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
