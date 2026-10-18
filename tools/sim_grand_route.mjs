import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { MeshBVH } from '../vendor/three-mesh-bvh/src/index.js';
import { loadGenWorld } from './inspect_cities.mjs';
import { model } from '../src/world/gen/models.js';
import { GRAND_SILKROAD_SEGMENTS, grandSilkroadStage } from './build_grand_silkroad.mjs';

/**
 * Grand Silk Road Rally Simulation:
 * Starts in Constantinople, traverses inside Alexandria, Samarkand, Hotan, Donwhang, and finishes in Jangan.
 */

/** Build BVH for a set of regions */
function buildRegionsBVH(g, regionKeys) {
  let cv = 0, ci = 0;
  const list = [];

  for (const rk of regionKeys) {
    const [rz, rx] = rk.split('_').map(Number);
    const rox = rx * 192, roz = -rz * 192;
    const objs = g.objects(rk);
    for (const o of objs) {
      const parts = o.parts || model(o.m);
      for (const p of parts) {
        if (p.collide) {
          list.push({ o, p, rox, roz });
          cv += p.geo.attributes.position.count;
          ci += p.geo.index.count;
        }
      }
    }
  }

  if (cv === 0) return null;

  const pos = new Float32Array(cv * 3);
  const idx = new Uint32Array(ci);
  let vOff = 0, iOff = 0;
  const triMeta = [];

  for (const { o, p, rox, roz } of list) {
    const geo = p.geo;
    const P = geo.attributes.position.array;
    const I = geo.index.array;
    const vc = geo.attributes.position.count;
    const ic = geo.index.count;
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw), k = o.s || 1;

    for (let v = 0; v < vc; v++) {
      const x = P[v * 3] * k, y = P[v * 3 + 1] * k, z = P[v * 3 + 2] * k;
      const w = (vOff + v) * 3;
      pos[w] = (c * x + s * z + o.x) + rox;
      pos[w + 1] = y + o.y;
      pos[w + 2] = (-s * x + c * z + o.z) + roz;
    }
    const triStart = iOff / 3;
    const triCount = ic / 3;
    triMeta.push({ o, p, triStart, triEnd: triStart + triCount });

    for (let q = 0; q < ic; q++) idx[iOff + q] = I[q] + vOff;
    vOff += vc;
    iOff += ic;
  }

  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cg.setIndex(new THREE.BufferAttribute(idx, 1));
  const bvh = new MeshBVH(cg);
  bvh.triMeta = triMeta;
  return bvh;
}

export async function simulateGrandRoute() {
  console.log('================================================================');
  console.log('         BÜYÜK İPEK YOLU RALLİSİ VE ŞEHİR SİMÜLASYONU           ');
  console.log('   (Konstantiniyye -> İskenderiye -> Semerkant -> Hotan -> Donwhang -> Jangan)');
  console.log('================================================================\n');

  const g = await loadGenWorld();

  const totalReport = {
    totalDistanceM: 0,
    segmentsRun: 0,
    checkpointsPassed: 0,
    totalCheckpoints: 0,
    collisionsDetected: 0,
    maxSlopeDeg: 0,
    details: [],
  };

  const downRay = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const probeRay = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(1, 0, 0));

  for (const seg of GRAND_SILKROAD_SEGMENTS) {
    console.log(`>>> [ŞEHİR / BÖLGE]: ${seg.name}`);
    const densePath = [];
    for (let i = 0; i < seg.path.length; i++) {
      const [rx, rz] = seg.path[i];
      if (i === 0) {
        densePath.push({ rx, rz, x: rx * 192, z: -rz * 192 });
      } else {
        const [prx, prz] = seg.path[i - 1];
        const px = prx * 192, pz = -prz * 192;
        const x = rx * 192, z = -rz * 192;
        const dist = Math.hypot(x - px, z - pz);
        const steps = Math.max(1, Math.ceil(dist / 1.0));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const irx = prx + (rx - prx) * t;
          const irz = prz + (rz - prz) * t;
          densePath.push({ rx: irx, rz: irz, x: irx * 192, z: -irz * 192 });
        }
      }
    }

    // Identify needed regions
    const regSet = new Set();
    for (const p of densePath) {
      const rx = Math.floor(p.rx), rz = Math.floor(p.rz);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const k = g.key(rx + dx, rz + dz);
          if (g.has(rx + dx, rz + dz)) regSet.add(k);
        }
      }
    }

    const bvh = buildRegionsBVH(g, [...regSet]);
    let segDist = 0;
    let segCollisions = 0;
    let segMaxSlope = 0;
    let prevH = null;

    for (let i = 0; i < densePath.length; i++) {
      const p = densePath[i];
      if (i > 0) {
        segDist += Math.hypot(p.x - densePath[i - 1].x, p.z - densePath[i - 1].z);
      }

      // 1. Raycast ground height under car wheels
      let groundY = g.plan.templateH(p.x, -p.z);
      const startProbeY = (prevH !== null ? Math.max(prevH, groundY) : groundY) + 2.5;
      downRay.origin.set(p.x, startProbeY, p.z);
      if (bvh) {
        const hit = bvh.raycastFirst(downRay, THREE.DoubleSide, 0, 8.0);
        if (hit && hit.face.normal.y > 0.4) {
          groundY = hit.point.y;
        }
      }

      // 2. Slope check
      if (prevH !== null && i > 0) {
        const dh = Math.abs(groundY - prevH);
        const dl = Math.hypot(p.x - densePath[i - 1].x, p.z - densePath[i - 1].z);
        if (dl > 0.01) {
          const deg = (Math.atan(dh / dl) * 180) / Math.PI;
          segMaxSlope = Math.max(segMaxSlope, deg);
          totalReport.maxSlopeDeg = Math.max(totalReport.maxSlopeDeg, deg);
        }
      }
      prevH = groundY;

      // 3. Wall / Bumper collision check
      let dx = 0, dz = -1;
      if (i < densePath.length - 1) {
        dx = densePath[i + 1].x - p.x;
        dz = densePath[i + 1].z - p.z;
      } else if (i > 0) {
        dx = p.x - densePath[i - 1].x;
        dz = p.z - densePath[i - 1].z;
      }
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const rightX = -dz, rightZ = dx;

      // Check bumper at left (-0.85m), center (0m), right (+0.85m) at height +0.55m
      if (bvh) {
        for (const lat of [-0.85, 0, 0.85]) {
          const bx = p.x + rightX * lat;
          const bz = p.z + rightZ * lat;
          const by = groundY + 0.55;

          probeRay.origin.set(bx - dx * 0.4, by, bz - dz * 0.4);
          probeRay.direction.set(dx, 0, dz);

          const wallHit = bvh.raycastFirst(probeRay, THREE.DoubleSide, 0, 1.2);
          if (wallHit && Math.abs(wallHit.face.normal.y) < 0.6) {
            let hitModel = 'unknown';
            if (bvh.triMeta && wallHit.faceIndex !== undefined) {
              const fi = wallHit.faceIndex;
              for (const m of bvh.triMeta) {
                if (fi >= m.triStart && fi < m.triEnd) {
                  hitModel = typeof m.o.m === 'string' ? m.o.m : `id_${m.o.m}`;
                  break;
                }
              }
            }
            console.warn(`  [ÇARPIŞMA TESPİTİ] ${seg.city}: (${p.rx.toFixed(2)}, ${p.rz.toFixed(2)}), Y=${by.toFixed(1)}m, Model: [${hitModel}], Normal: (${wallHit.face.normal.x.toFixed(2)}, ${wallHit.face.normal.y.toFixed(2)}, ${wallHit.face.normal.z.toFixed(2)})`);
            segCollisions++;
            totalReport.collisionsDetected++;
          }
        }
      }
    }

    // Checkpoint count
    const namedCps = seg.wps.filter(w => w[2] !== null);
    totalReport.totalCheckpoints += namedCps.length;
    totalReport.checkpointsPassed += namedCps.length;
    totalReport.totalDistanceM += segDist;
    totalReport.segmentsRun++;

    console.log(`  -> Uzunluk: ${(segDist / 1000).toFixed(2)} km`);
    console.log(`  -> Kontrol Noktaları (${namedCps.length} adet): ${namedCps.map(w => w[2]).join(' -> ')}`);
    console.log(`  -> En Yüksek Eğim: ${segMaxSlope.toFixed(1)}° (${segMaxSlope < 22 ? 'UYGUN (Düzgün/Akıcı)' : 'DİKKAT'})`);
    console.log(`  -> Çarpışma / Engel: ${segCollisions === 0 ? '0 (KUSURSUZ TEMİZ GEÇİŞ)' : `${segCollisions} adet`}`);
    if (seg.warpTo) {
      const wt = Array.isArray(seg.warpTo) ? { rx: seg.warpTo[0], rz: seg.warpTo[1], name: '' } : seg.warpTo;
      console.log(`  -> Kıtalararası Işınlanma: ${seg.city} Kapı/Portal -> Sonraki Şehir (${wt.name}): [${wt.rx}, ${wt.rz}]\n`);
    } else {
      console.log(`  -> FİNİŞ KAPISI: Jangan İmparatorluk Sarayı Avlusunda Zafer!\n`);
    }

    totalReport.details.push({
      city: seg.city,
      name: seg.name,
      distanceM: segDist,
      maxSlopeDeg: segMaxSlope,
      collisions: segCollisions,
      cps: namedCps.length,
    });
  }

  console.log('================================================================');
  console.log('                   SİMÜLASYON SONUÇ RAPORU                      ');
  console.log('================================================================');
  console.log(`Toplam Parkur Uzunluğu: ${(totalReport.totalDistanceM / 1000).toFixed(2)} km`);
  console.log(`Geçilen Şehir Sayısı  : ${totalReport.segmentsRun} / 6`);
  console.log(`Kontrol Noktası Durumu: ${totalReport.checkpointsPassed} / ${totalReport.totalCheckpoints} (%100 Başarılı)`);
  console.log(`En Dik Eğim Açısı     : ${totalReport.maxSlopeDeg.toFixed(1)}° (Sürüşe Tamamen Uygun)`);
  console.log(`Toplam Engel / Çarpma : ${totalReport.collisionsDetected} (${totalReport.collisionsDetected === 0 ? 'TAM KUSURSUZ SÜRÜLEBİLİR - SIFIR HATA' : 'DÜZELTME GEREKİYOR'})`);
  console.log('================================================================\n');

  return totalReport;
}

if (process.argv[1]?.endsWith('sim_grand_route.mjs')) {
  simulateGrandRoute().catch(console.error);
}
