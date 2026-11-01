import math

# Let's test a point (px, pz) and angle theta in DirectX
# In DirectX (left-handed, Y up, looking down +Y axis: +X is right, +Z is up/forward):
# Angle theta: usually 0 is along +Z, or counter-clockwise/clockwise?
# Joymax standard:
# Let's test both standard rotation conventions:

def dx_rot(px, pz, theta):
    # Standard 2D rotation:
    # x' = x*cos(t) + z*sin(t) (or -sin)
    # z' = -x*sin(t) + z*cos(t) (or +sin)
    # Let's test: if theta = +pi/2 (90 deg):
    # If point is (0, 1), does it rotate to (1, 0) or (-1, 0)?
    pass

for yaw in [0.0, math.pi/2, math.pi, -math.pi/2]:
    print(f"yaw = {yaw:.3f}")
    # In Three.js:
    # Three.js Object3D.rotation.y = rotY:
    # Three.js matrix for rotation around Y:
    # [ cos(rotY)   0   sin(rotY) ]
    # [    0        1       0     ]
    # [ -sin(rotY)  0   cos(rotY) ]
    # applied to vector [vx, vy, vz]^T:
    # vx' = vx*cos(rotY) + vz*sin(rotY)
    # vz' = -vx*sin(rotY) + vz*cos(rotY)
    # Since our model vertex was (px, py, -pz), so vx = px, vz = -pz:
    # vx' = px*cos(rotY) - pz*sin(rotY)
    # vz' = -px*sin(rotY) - pz*cos(rotY) = -(px*sin(rotY) + pz*cos(rotY))
    # Notice that -vz' = px*sin(rotY) + pz*cos(rotY)!
    # In Silkroad world coords, Three.js coordinates are X = X_sr, Z = -Z_sr!
    # So vx' = X_sr' and -vz' = Z_sr'!
    # Thus:
    # X_sr' = px*cos(rotY) - pz*sin(rotY)
    # Z_sr' = px*sin(rotY) + pz*cos(rotY)
    #
    # Now look at:
    # If rotY = +yaw:
    # X_sr' = px*cos(yaw) - pz*sin(yaw)
    # Z_sr' = px*sin(yaw) + pz*cos(yaw)
    # This is EXACTLY the standard 2D rotation matrix by angle +yaw:
    # [ cos(yaw)  -sin(yaw) ] [ px ]
    # [ sin(yaw)   cos(yaw) ] [ pz ]
    #
    # BUT IN SILKROADMAP.JS:
    # rotY = -yaw was used!
    # If rotY = -yaw:
    # vx' = px*cos(-yaw) - pz*sin(-yaw) = px*cos(yaw) + pz*sin(yaw)  <-- WRONG SINE SIGN!
    # -vz' = px*sin(-yaw) + pz*cos(-yaw) = -px*sin(yaw) + pz*cos(yaw) <-- WRONG SINE SIGN!
