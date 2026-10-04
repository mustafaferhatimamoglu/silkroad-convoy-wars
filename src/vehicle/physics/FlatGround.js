// Duz/egimli sonsuz zemin (testler, garaj). Arac fiziginin zemin arayuzunu saglar.
// slopeDeg: -z (ileri) yonunde yukselen egim; baseY: zemin yuksekligi; surface: tiles.json bayragi.

export function flatGround({ slopeDeg = 0, surface = 3, baseY = 0 } = {}) {
  const a = (slopeDeg * Math.PI) / 180;
  const n = { x: 0, y: Math.cos(a), z: Math.sin(a) };
  const c = baseY * n.y;
  const cs = [];
  const hit = { distance: 0, point: { x: 0, y: 0, z: 0 }, normal: n, surface, object: false };
  return {
    height: (x, z) => baseY + Math.tan(a) * -z,
    raycast(o, d, far) {
      const den = n.x * d.x + n.y * d.y + n.z * d.z;
      if (den >= -1e-6) return null;
      const t = (c - (n.x * o.x + n.y * o.y + n.z * o.z)) / den;
      if (t < 0 || t > far) return null;
      hit.distance = t;
      hit.point.x = o.x + d.x * t; hit.point.y = o.y + d.y * t; hit.point.z = o.z + d.z * t;
      return hit;
    },
    sphereContacts(p, r) {
      cs.length = 0;
      const dist = n.x * p.x + n.y * p.y + n.z * p.z - c;
      if (dist < r) cs.push({ depth: r - dist, normal: n, point: { x: p.x - n.x * dist, y: p.y - n.y * dist, z: p.z - n.z * dist }, object: false });
      return cs;
    },
  };
}
