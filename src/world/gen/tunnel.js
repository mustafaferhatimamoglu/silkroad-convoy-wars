import * as THREE from 'three';
import { REGION_M, TUNNEL } from './plan.js';
import { boxUV } from './models.js';

// Tunel: yol cizgisi boyunca ic kesit (tasli zemin, duz duvar, kemer tavan) + iki agizda tas
// portal cephesi. Bolge bolge uretilir (her bolge kendi parcasini carpisma agaciyla birlikte
// yukler). Cikti place.js ogesi: { parts, x, y, z, yaw: 0 } - geometri zaten bolge-yerel
// Three.js koordinatlarinda (x dogu, z = -kuzey).

const ARCH = 8;   // kemer dilimi

/** Kesit noktalari (u: yanal, v: yukseklik), zeminden zemine saat yonunun tersine: duvar + kemer. */
function section() {
  const { halfW: W, wallH, roofH } = TUNNEL;
  const pts = [[W, 0], [W, wallH]];
  for (let k = 1; k < ARCH; k++) {
    const a = (k / ARCH) * Math.PI;
    pts.push([Math.cos(a) * W, wallH + Math.sin(a) * (roofH - wallH)]);
  }
  pts.push([-W, wallH], [-W, 0]);
  return pts;
}
const SECTION = section();

function geometry(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Bolgeye dusen tunel parcalari (tup + agiz cepheleri). */
export function tunnelItems(plan, rx, rz) {
  const out = [];
  const x0 = rx * REGION_M, z0 = rz * REGION_M;
  for (const T of plan.tunnels || []) {
    if (T.x1 < x0 || T.x0 > x0 + REGION_M || T.z1 < z0 || T.z0 > z0 + REGION_M) continue;
    const r = T.r, P = r.dense, H = r.h;
    // kesit cercevesi: nokta, yanal birim (sola), yukseklik
    const frame = (i) => {
      const a = P[Math.max(r.ta, i - 1)], b = P[Math.min(r.tb, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      return { x: P[i][0], z: P[i][1], h: H[i], tx: dx / L, tz: dz / L, nx: -dz / L, nz: dx / L };
    };
    const inside = (i) => {
      const mx = (P[i][0] + P[i + 1][0]) / 2, mz = (P[i][1] + P[i + 1][1]) / 2;
      return mx >= x0 && mx < x0 + REGION_M && mz >= z0 && mz < z0 + REGION_M;
    };
    // bolge-yerel Three koordinati
    const L3 = (X, y, Z) => [X - x0, y, -(Z - z0)];
    const shell = { pos: [], uv: [], idx: [] }, floor = { pos: [], uv: [], idx: [] };
    const lamps = [];
    let s = 0, nextLamp = 12;
    for (let i = r.ta; i < r.tb; i++) {
      const seg = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
      if (inside(i)) {
        const A = frame(i), B = frame(i + 1);
        // duvar + kemer: kesit seritleri (ic yuzler gorunur)
        let per = 0;
        for (let k = 0; k < SECTION.length - 1; k++) {
          const [u0, v0] = SECTION[k], [u1, v1] = SECTION[k + 1];
          const len = Math.hypot(u1 - u0, v1 - v0);
          const base = shell.pos.length / 3;
          for (const [F, sv] of [[A, s], [B, s + seg]]) {
            shell.pos.push(...L3(F.x + F.nx * u0, F.h + v0, F.z + F.nz * u0), ...L3(F.x + F.nx * u1, F.h + v1, F.z + F.nz * u1));
            shell.uv.push(per / 3, sv / 3, (per + len) / 3, sv / 3);
          }
          // a0 a1 (A), b0 b1 (B): ic tarafa bakan ucgenler
          shell.idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
          per += len;
        }
        // zemin
        const fb = floor.pos.length / 3, W = TUNNEL.halfW;
        for (const [F, sv] of [[A, s], [B, s + seg]]) {
          floor.pos.push(...L3(F.x - F.nx * W, F.h + 0.02, F.z - F.nz * W), ...L3(F.x + F.nx * W, F.h + 0.02, F.z + F.nz * W));
          floor.uv.push(0, sv / 6, 2, sv / 6);
        }
        floor.idx.push(fb, fb + 2, fb + 1, fb + 1, fb + 2, fb + 3);
        // tavan lambalari (24 m arayla)
        while (nextLamp < s + seg) {
          const k = (nextLamp - s) / seg;
          const X = A.x + (B.x - A.x) * k, Z = A.z + (B.z - A.z) * k, y = A.h + (B.h - A.h) * k + TUNNEL.roofH - 0.25;
          const lamp = new THREE.BoxGeometry(2.4, 0.18, 0.5);
          lamp.rotateY(Math.atan2(A.tz, A.tx));
          lamp.translate(...L3(X, y, Z));
          lamps.push(boxUV(lamp, 1));
          nextLamp += 24;
        }
      }
      else while (nextLamp < s + seg) nextLamp += 24;
      s += seg;
    }
    const parts = [];
    if (shell.idx.length) parts.push({ geo: geometry(shell.pos, shell.uv, shell.idx), tex: 'build/stone_wall', alpha: false, collide: true });
    if (floor.idx.length) parts.push({ geo: geometry(floor.pos, floor.uv, floor.idx), tex: 'terrain/cobble', alpha: false, collide: true });
    for (const g of lamps) parts.push({ geo: g, tex: 'build/plaster_white', alpha: false, collide: false });
    // agiz cepheleri: tas sutunlar + lento (arazi deligini kapatir)
    for (const [i, dir] of [[r.ta, 1], [r.tb, -1]]) {
      const F = frame(i);
      if (F.x < x0 || F.x >= x0 + REGION_M || F.z < z0 || F.z >= z0 + REGION_M) continue;
      // cephe yuksekligi: delik bolgesindeki dogal arazinin tepesi
      let top = F.h + TUNNEL.roofH + 2;
      for (let a = -TUNNEL.halfW - 4; a <= TUNNEL.halfW + 4; a += 2) {
        for (let d = 0; d <= TUNNEL.mouth + 4; d += 2) {
          const X = F.x + F.nx * a + F.tx * d * dir, Z = F.z + F.nz * a + F.tz * d * dir;
          top = Math.max(top, plan._natural(X, Z, true) + 1.5);
        }
      }
      const yaw = Math.atan2(F.tz, F.tx);      // model +X = yol yonu (dunya acisi)
      const depth = TUNNEL.mouth + 3, cx = (TUNNEL.mouth / 2 + 0.5) * dir;
      const hgt = top - F.h + 1, pw = 6;
      const g = [];
      const box = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y + h / 2, z); return boxUV(b, 3); };
      // model ekseni: x = yol boyu, z = yanal (Three z = -sol)
      g.push(box(depth, hgt, pw, cx, -1, -(TUNNEL.halfW + pw / 2)));
      g.push(box(depth, hgt, pw, cx, -1, TUNNEL.halfW + pw / 2));
      g.push(box(depth, hgt - TUNNEL.wallH - 1, TUNNEL.halfW * 2 + 0.2, cx, TUNNEL.wallH, 0));
      // kemer bandi (cephe onunde)
      g.push(box(1.2, 1.4, TUNNEL.halfW * 2 + pw * 2, cx - (depth / 2 + 0.6) * dir, TUNNEL.wallH - 0.2, 0));
      for (const geo of g) {
        const [lx, ly, lz] = L3(F.x, F.h, F.z);
        out.push({ parts: [{ geo, tex: 'build/sandstone_blocks', alpha: false, collide: true }], x: lx, y: ly, z: lz, yaw, s: 1 });
      }
    }
    if (parts.length) out.push({ parts, x: 0, y: 0, z: 0, yaw: 0, s: 1 });
  }
  return out;
}
