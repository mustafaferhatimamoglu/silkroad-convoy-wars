import math

# Vector along bridge length is +X: (1, 0)
# We want:
# East bridge (yaw = 0): should point +X (East).
# West bridge (yaw = pi): should point -X (West).
# South bridge (yaw = 3pi/2 = 4.7124): should point +Z (South in Three.js).
# North bridge: should point -Z (North in Three.js).

v = (1.0, 0.0) # +X

def rot_three(rotY, vx, vz):
    # Three.js rotation matrix around Y:
    # X' = vx*cos(rotY) + vz*sin(rotY)
    # Z' = -vx*sin(rotY) + vz*cos(rotY)
    x_prime = vx * math.cos(rotY) + vz * math.sin(rotY)
    z_prime = -vx * math.sin(rotY) + vz * math.cos(rotY)
    return round(x_prime, 3), round(z_prime, 3)

cases = [
    ("East bridge", 0.0, "+X (East)"),
    ("West bridge", math.pi, "-X (West)"),
    ("South bridge", 3 * math.pi / 2, "+Z (South)"),
]

print("--- Testing clone.rotation.y = -yaw ---")
for name, yaw, expected in cases:
    res = rot_three(-yaw, 1.0, 0.0)
    print(f"{name} (yaw={yaw:.3f}): result = {res}, expected = {expected}")

print("\n--- Testing clone.rotation.y = +yaw ---")
for name, yaw, expected in cases:
    res = rot_three(+yaw, 1.0, 0.0)
    print(f"{name} (yaw={yaw:.3f}): result = {res}, expected = {expected}")
