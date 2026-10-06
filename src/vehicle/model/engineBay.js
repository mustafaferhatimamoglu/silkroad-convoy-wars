import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeInto } from './carkit.js';

// Motor bolmesi: kaput kapaliyken gorunmez; kaput acilinca ya da kopunca motor blogu, supap
// kapaklari, emme manifoldu, radyator, aku, hava filtresi ve ic camurluklar gorunur.
//   o: { z0 (on, radyator), z1 (arka, torpido duvari), halfW, yTop (kaput alti), yLow (motor alti),
//        layout: 'i4' | 'v8' | 'i4d', archTop, axF, archR }

const box = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99);

export function buildEngineBay(o) {
  const g = new THREE.Group();
  g.name = 'engineBay';
  const metal = new THREE.MeshStandardMaterial({ color: 0x4d5054, metalness: 0.7, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.75 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color: o.accent ?? 0x8a1c14, metalness: 0.3, roughness: 0.4 });
  const len = o.z1 - o.z0;
  const yc = o.yLow;
  // ic camurluklar (teker yuvalarinin ustu) ve torpido duvari
  const darkGeos = [];
  for (const s of [-1, 1]) darkGeos.push(box(0.26, 0.02, len * 0.9, 0.005).translate(s * (o.halfW - 0.15), o.archTop + 0.03, (o.z0 + o.z1) / 2));
  darkGeos.push(box(o.halfW * 2 - 0.1, o.yTop - yc, 0.03, 0.01).translate(0, (o.yTop + yc) / 2, o.z1 - 0.02));
  // radyator (izgaranin arkasi) ve fan
  darkGeos.push(box(o.halfW * 1.35, Math.max(0.18, (o.yTop - yc) * 0.75), 0.06, 0.01).translate(0, (o.yTop + yc) / 2 - 0.03, o.z0 + 0.04));
  g.add(new THREE.Mesh(mergeInto(darkGeos), dark));
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20), black);
  fan.rotation.x = Math.PI / 2; fan.position.set(0, (o.yTop + yc) / 2 - 0.03, o.z0 + 0.1); g.add(fan);
  // motor blogu + supap kapaklari
  const ez = o.z0 + len * 0.52;
  const eh = Math.max(0.2, (o.yTop - yc) - 0.12);
  const metalGeos = [box(o.layout === 'v8' ? 0.62 : 0.5, eh, Math.min(0.62, len * 0.55), 0.04).translate(0, yc + eh / 2, ez)];
  g.add(new THREE.Mesh(mergeInto(metalGeos), metal));
  const covers = [];
  const ty = yc + eh;
  if (o.layout === 'v8') {
    for (const s of [-1, 1]) {
      const c = box(0.16, 0.08, Math.min(0.58, len * 0.5), 0.03);
      c.rotateZ(-s * 0.55); c.translate(s * 0.2, ty - 0.01, ez); covers.push(c);
    }
    covers.push(box(0.28, 0.1, Math.min(0.52, len * 0.45), 0.03).translate(0, ty + 0.02, ez));  // emme
  } else {
    covers.push(box(0.2, 0.08, Math.min(0.56, len * 0.5), 0.03).translate(o.layout === 'i4d' ? 0 : -0.06, ty + 0.02, ez));
    covers.push(box(0.12, 0.08, Math.min(0.5, len * 0.45), 0.02).translate(o.layout === 'i4d' ? 0.2 : 0.16, ty - 0.04, ez));
  }
  g.add(new THREE.Mesh(mergeInto(covers), accent));
  // aku ve hava filtresi kutusu
  const bat = new THREE.Mesh(box(0.2, 0.18, 0.24, 0.015), black); bat.position.set(-o.halfW + 0.33, yc + 0.17, o.z0 + 0.3); g.add(bat);
  const af = new THREE.Mesh(box(0.24, 0.16, 0.32, 0.03), dark); af.position.set(o.halfW - 0.35, ty - 0.05, o.z0 + 0.32); g.add(af);
  for (const m of g.children) { m.castShadow = false; m.receiveShadow = true; m.userData.keep = true; }
  return g;
}
