// Ralli otomatik pilotu v2 (test araci): model tabanli "pure pursuit" (teker acisi = atan(2 L sin a / Ld),
// hiza bagli direksiyon siniriyla normalize), viraj egriligi + tepe/cukur (dikey egrilik) hiz plani,
// takilmada geri/rotaya donus. window._ap ile durum okunur.
(async () => {
  for (let i = 0; i < 240; i++) {
    if (window.app && app.mode && app.mode.constructor.name === 'RallyMode' && app.mode.pts && app.mode.vehicle) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const mode = app.mode, v = mode.vehicle, sim = v.sim, pts = mode.pts, w = app.world, col = app.collision;
  const N = pts.length;
  const cum = new Float64Array(N), kap = new Float64Array(N);
  for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  for (let i = 0; i < N; i++) {
    const a = pts[Math.max(0, i - 2)], b = pts[i], c = pts[Math.min(N - 1, i + 2)];
    const a1 = Math.atan2(b.z - a.z, b.x - a.x), a2 = Math.atan2(c.z - b.z, c.x - b.x);
    let da = a2 - a1; da = Math.atan2(Math.sin(da), Math.cos(da));
    kap[i] = Math.abs(da) / Math.max(1, Math.hypot(c.x - a.x, c.z - a.z) / 2);
  }
  // 2 m'lik dikey profil (bolge yuklendikce doldurulur)
  const SS = 2, sx = [], sz = [], sc = [], si = [];
  for (let i = 0; i < N - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = cum[i + 1] - cum[i], n = Math.max(1, Math.round(L / SS));
    for (let k = 0; k < n; k++) { const t = k / n; sx.push(a.x + (b.x - a.x) * t); sz.push(a.z + (b.z - a.z) * t); sc.push(cum[i] + L * t); si.push(i); }
  }
  const M = sx.length, sh = new Float64Array(M).fill(NaN), smu = new Float64Array(M).fill(NaN);
  const MU = { 0: 0.78, 1: 0.66, 3: 1.0, 6: 0.55, 7: 0.52, 9: 0.42, 10: 0.72, 11: 0.72, 12: 0.72, 100: 1.0 };
  const muAt = (k) => {
    if (Number.isNaN(smu[k]) && w.isLoadedAt(sx[k], sz[k])) smu[k] = MU[w.surfaceAt(sx[k], sz[k])] ?? 0.78;
    return Number.isNaN(smu[k]) ? 0.78 : smu[k];
  };
  const hit = { distance: 0, point: app.camera.position.clone(), normal: app.camera.position.clone(), object: false, surface: 0 };
  const down = app.camera.position.clone().set(0, -1, 0), o = app.camera.position.clone();
  const hAt = (k) => {
    if (k < 0 || k >= M) return NaN;
    if (Number.isNaN(sh[k]) && w.isLoadedAt(sx[k], sz[k])) {
      const h = w.heightAt(sx[k], sz[k]);
      if (h !== null && h !== undefined) {
        o.set(sx[k], h + 3, sz[k]);
        sh[k] = col.raycast(o, down, 10, hit) ? Math.max(h, hit.point.y) : h;
      }
    }
    return sh[k];
  };
  const AP = (window._ap = { log: [], trail: [], impacts: [], stuck: [], resets: [], recoveries: 0, idx: 0, done: false, maxOff: 0, offSum: 0, offN: 0, maxV: 0 });
  const ALAT = window._apLat || 4.2, ABRK = window._apBrk || 4.5, VMAX = window._apVmax || 36;
  const G = 9.81;
  let stuckT = 0, revT = 0, offT = 0, lastLog = 0, sinceRec = 99, sk = 0;
  const origApply = v.applyImpacts.bind(v);
  v.applyImpacts = (list) => {
    for (const im of list || []) if (im.speed > 3) AP.impacts.push({ t: +mode.time.toFixed(1), s: +im.speed.toFixed(1), i: AP.idx, x: +im.point.x.toFixed(1), z: +im.point.z.toFixed(1) });
    return origApply(list);
  };
  const reset = (why) => { AP.resets.push({ t: +mode.time.toFixed(1), i: AP.idx, why }); mode.toRoute(); stuckT = 0; offT = 0; revT = 0; };
  mode.autopilot = (dt) => {
    const p = v.position, f = v.forward;
    const speed = sim.forwardSpeed, sp = Math.abs(speed);
    let best = 1e9, bi = AP.idx;
    for (let i = Math.max(0, AP.idx - 5); i < Math.min(N, AP.idx + 40); i++) {
      const d = (pts[i].x - p.x) ** 2 + (pts[i].z - p.z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    AP.idx = bi;
    const off = Math.sqrt(best);
    AP.maxOff = Math.max(AP.maxOff, off); AP.offSum += off; AP.offN++; AP.maxV = Math.max(AP.maxV, speed * 3.6);
    while (sk < M - 1 && sc[sk + 1] <= cum[bi]) sk++;
    // ileri bakis noktasi (yol uzerinde enterpolasyonlu)
    const Ld = Math.min(32, Math.max(8, 6 + 0.7 * sp));
    let ti = bi;
    while (ti < N - 1 && cum[ti + 1] - cum[bi] < Ld) ti++;
    const rem = Ld - (cum[ti] - cum[bi]), segL = ti < N - 1 ? cum[ti + 1] - cum[ti] : 1;
    const tt = ti < N - 1 ? Math.min(1, Math.max(0, rem / segL)) : 0;
    const tx = pts[ti].x + (ti < N - 1 ? (pts[ti + 1].x - pts[ti].x) * tt : 0), tz = pts[ti].z + (ti < N - 1 ? (pts[ti + 1].z - pts[ti].z) * tt : 0);
    const dx = tx - p.x, dz = tz - p.z;
    const yT = f.x * dz - f.z * dx, xT = f.x * dx + f.z * dz;   // yT + = sag
    const kappa = (2 * yT) / Math.max(1, xT * xT + yT * yT);
    const wb = sim.p.dims.wheelbase, S = sim.p.steering;
    const delta = Math.atan(kappa * wb);
    const grip = (6.6 * sim.p.tire.mu) / 0.9;
    const maxA = Math.min(S.maxAngle, (wb * grip) / Math.max(sp * sp, 1) + 0.02 + 0.02 * Math.min(1, Math.max(0, 1 - sp / 20)));
    // hiz hedefi: viraj + dikey egrilik (tepe: havalanmasin, cukur: sert oturmasin)
    let vt = VMAX;
    for (let i = bi; i < N && cum[i] - cum[bi] < 170; i++) {
      // zemin tutusu: toprak (0.78) referans; kumda/camurda viraj hizi duser
      let kk = sk; while (kk < M - 1 && sc[kk] < cum[i]) kk++;
      const vk = Math.sqrt((ALAT * muAt(kk)) / 0.78 / Math.max(kap[i], 1e-4));
      vt = Math.min(vt, Math.sqrt(vk * vk + 2 * ABRK * (cum[i] - cum[bi])));
    }
    for (let k = sk + 3; k < M - 3 && sc[k] - sc[sk] < 140; k++) {
      const h0 = hAt(k - 3), h1 = hAt(k), h2 = hAt(k + 3);
      if (Number.isNaN(h0) || Number.isNaN(h1) || Number.isNaN(h2)) continue;
      const kv = (h2 - 2 * h1 + h0) / 36;
      let vl = VMAX;
      if (kv < -0.004) vl = Math.sqrt((0.8 * G) / -kv);
      else if (kv > 0.01) vl = Math.sqrt((2.2 * G) / kv);
      vt = Math.min(vt, Math.sqrt(vl * vl + 2 * ABRK * (sc[k] - sc[sk])));
    }
    if (bi >= N - 3) vt = Math.max(vt, 15);
    const c = { accel: 0, decel: 0, steer: 0, handbrake: 0, shiftUp: false, shiftDown: false };
    if (revT > 0) {
      revT -= dt;
      c.decel = 1; c.steer = -Math.sign(yT) * 0.8;
      return c;
    }
    sinceRec += dt;
    if (mode.state === 'run' && sp < 1.0) stuckT += dt; else stuckT = 0;
    if (mode.state === 'run' && off > 22) offT += dt; else offT = 0;
    if (offT > 3) { reset('rotadan uzak'); return c; }
    if (stuckT > 2.5) {
      AP.stuck.push({ t: +mode.time.toFixed(1), i: bi, x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
      stuckT = 0;
      const n = AP.stuck.length;
      if (n > 1 && AP.stuck[n - 2].i === bi && sinceRec > 3) {
        if (n > 2 && AP.stuck[n - 3].i === bi) reset('takildi'); else { v.recover(); AP.recoveries++; }
        sinceRec = 0;
      } else revT = 1.5;
      return c;
    }
    c.steer = Math.max(-1, Math.min(1, delta / maxA));
    const dv = vt - speed;
    if (dv > 0) c.accel = Math.min(1, 0.3 + dv * 0.3);
    else if (dv < -1.0 && speed > 2.5) c.decel = Math.min(1, -dv * 0.35);
    else c.accel = 0.1;
    if (mode.time - lastLog > 0.5) {
      lastLog = mode.time;
      AP.log.push([+mode.time.toFixed(1), bi, +(speed * 3.6).toFixed(0), +off.toFixed(1), mode.cpIndex, +(vt * 3.6).toFixed(0)]);
      AP.trail.push([+p.x.toFixed(1), +p.z.toFixed(1)]);
    }
    if (mode.state === 'done') AP.done = true;
    return c;
  };
  return 'pilot v2 hazir: ' + N + ' nokta, ' + (cum[N - 1] / 1000).toFixed(2) + ' km, profil ' + M;
})()
