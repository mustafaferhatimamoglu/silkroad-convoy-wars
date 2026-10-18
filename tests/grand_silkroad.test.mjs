import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RALLY_STAGES } from '../src/data/rally.js';
import { Course, regionToThree } from '../src/race/Course.js';
import { simulateGrandRoute } from '../tools/sim_grand_route.mjs';

const mockWorld = {
  toThree(rx, rz, lx, y, lz, out = new THREE.Vector3()) {
    return out.set(rx * 192 + lx / 10, y, -(rz * 192 + lz / 10));
  },
  isLoadedAt() { return true; },
  heightAt() { return 0; },
  surfaceAt() { return 1; },
};

test('grand_silkroad etabi: veri butunlugu ve 5 kitalararasi portal kapisi', () => {
  const st = RALLY_STAGES.grand_silkroad;
  assert.ok(st, 'grand_silkroad RALLY_STAGES icinde tanimli olmali');
  assert.ok(st.path.length > 500, 'grand_silkroad rotasi yeterli dugum icermeli');
  assert.equal(st.wl.length, st.path.length, 'wl uzunlugu path ile ayni olmali');
  assert.equal(st.wr.length, st.path.length, 'wr uzunlugu path ile ayni olmali');
  assert.equal(st.cps.length, 30, '6 sehirde toplam 30 kontrol noktasi olmali');

  const warpCps = st.cps.filter((c) => c.warp);
  assert.equal(warpCps.length, 5, '5 sehir gecis kapisi (warp) olmali');
  const expectedCities = ['alexandria', 'samarkand', 'hotan', 'donwhang', 'jangan'];
  assert.deepEqual(warpCps.map((c) => c.warp.city), expectedCities);

  let prevI = -1;
  for (const cp of st.cps) {
    assert.ok(cp.i > prevI && cp.i < st.path.length, `Kontrol noktasi indeksi sirali olmali: ${cp.name} (${cp.i})`);
    prevI = cp.i;
    if (cp.warp) {
      assert.equal(cp.warp.toIdx, cp.i + 1, `Portal hedef indeksi bir sonraki sehir baslangici olmali (${cp.name})`);
      assert.ok(Number.isFinite(cp.warp.rx) && Number.isFinite(cp.warp.rz) && Number.isFinite(cp.warp.yaw));
    }
  }
});

test('Course ve Track: kitalararasi portal sicramalarinda mesafe, egrilik ve kapi gecisi', () => {
  const st = RALLY_STAGES.grand_silkroad;
  const course = new Course(mockWorld, st, 'grand_silkroad');

  // Mesafe yalniz sehir ici surus toplamini yansitmali (~4.17 km), kitalararasi kus ucusu mesafeyi degil
  assert.ok(course.length > 3800 && course.length < 4800, `Course uzunlugu sehir ici toplam olmali: ${course.length}`);

  // Portal sicrama noktalarinda egrilik (kap) sifir olmali
  for (const g of course.gates) {
    if (g.warp) {
      assert.equal(course.route.kap[g.i], 0, `Portal cikisinda egrilik 0 olmali (i=${g.i})`);
      assert.equal(course.route.kap[g.warp.toIdx], 0, `Portal varisinda egrilik 0 olmali (i=${g.warp.toIdx})`);
    }
  }

  // Bir araci tum 30 kapidan (ve 5 portaldan) sirayla gecirerek Course.track davranisini dogrula
  const state = { idx: 0, gate: 0, progress: 0, lat: 0 };
  let prev = course.pts[0].clone();
  let warpsTriggered = 0;

  for (let k = 0; k < course.gates.length; k++) {
    const gate = course.gates[k];
    const pos = gate.pos.clone();
    const passed = course.track(state, pos, prev);
    assert.ok(passed, `${k + 1}. kapi (${gate.name}) gecilmeli`);
    assert.equal(passed.idx, k);
    assert.equal(state.gate, k + 1);
    if (passed.warp) {
      warpsTriggered++;
      assert.equal(state.idx, passed.warp.toIdx, 'Portal gecisinde state.idx yeni sehrin baslangicina atlamali');
      assert.ok(Math.abs(state.progress - course.cum[passed.warp.toIdx]) < 1e-3);
      prev = regionToThree(mockWorld, passed.warp.rx, passed.warp.rz);
    } else {
      prev = pos.clone();
    }
  }
  assert.equal(warpsTriggered, 5);
  assert.equal(state.gate, 30);
});

test('Grand Silk Road 6 sehir BVH carpisma simulasyonu: 0 engel ve %100 temiz gecis', async () => {
  const report = await simulateGrandRoute();
  assert.equal(report.segmentsRun, 6);
  assert.equal(report.checkpointsPassed, 30);
  assert.equal(report.collisionsDetected, 0, '6 sehrin hicbirinde duvar/engel carpismasi olmamali');
});
