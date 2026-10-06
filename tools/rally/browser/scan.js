// Surulebilirlik taramasi: merkez bolge (RX, RZ) etrafindaki 3x3 bolgeyi 4 m hucrelerle orneklar.
// Cikti: { rx, rz, n, h (int16 dm, base64), s (egim derece u8), f (bayrak u8), m (zemin u8) }
// bayraklar: 1 su, 2 engel (duvar/kaya/agac govdesi), 4 obje ustu (kopru/meydan), 128 bilinmiyor
(async () => {
  const RX = __RX__, RZ = __RZ__;
  const w = app.world, col = app.collision;
  const V = (x = 0, y = 0, z = 0) => app.camera.position.clone().set(x, y, z);
  const center = w.toThree(RX, RZ, 960, 0, 960, V());
  await game.loadArea(center, 'tarama');
  // BVH'larin tamamlanmasi icin birkac kare bekle
  for (let k = 0; k < 30; k++) await new Promise((r) => requestAnimationFrame(r));
  const N = 144, STEP = 40; // 3 bolge * 1920 / 40 = 144
  const H = new Int16Array(N * N), S = new Uint8Array(N * N), F = new Uint8Array(N * N), M = new Uint8Array(N * N);
  const hit = { distance: 0, point: V(), normal: V(), object: false, surface: 0 };
  const contacts = [];
  for (let i = 0; i < 8; i++) contacts.push({ depth: 0, normal: V(), point: V(), object: false });
  const n = V(), o = V(), d = V(0, -1, 0), c = V();
  let blocked = 0, water = 0, unknown = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const lx = (i + 0.5) * STEP, lz = (j + 0.5) * STEP;
      const p = w.toThree(RX - 1, RZ - 1, lx, 0, lz, V());
      const k = j * N + i;
      const h = w.heightAt(p.x, p.z);
      if (h === null) { F[k] = 128; unknown++; continue; }
      let top = h, onObj = false;
      o.set(p.x, h + 40, p.z);
      if (col.raycast(o, d, 80, hit) && hit.point.y > h + 0.3) {
        top = hit.point.y; onObj = true;
        n.copy(hit.normal);
      } else w.normalAt(p.x, p.z, n);
      H[k] = Math.round(top * 10);
      S[k] = Math.min(90, Math.round((Math.acos(Math.min(1, Math.abs(n.y))) * 180) / Math.PI));
      let f = onObj ? 4 : 0;
      const wl = w.waterAt(p.x, p.z);
      if (wl !== null && wl > top + 0.25) { f |= 1; water++; }
      c.set(p.x, top + 1.1, p.z);
      const cnt = col.sphereContacts(c, 1.0, contacts, 8);
      for (let q = 0; q < cnt; q++) if (contacts[q].object && Math.abs(contacts[q].normal.y) < 0.7) { f |= 2; blocked++; break; }
      F[k] = f;
      M[k] = w.surfaceAt(p.x, p.z);
    }
  }
  const b64 = (arr) => {
    const u8 = new Uint8Array(arr.buffer);
    let s = '';
    for (let q = 0; q < u8.length; q += 8192) s += String.fromCharCode.apply(null, u8.subarray(q, q + 8192));
    return btoa(s);
  };
  return { rx: RX, rz: RZ, n: N, blocked, water, unknown, h: b64(H), s: b64(S), f: b64(F), m: b64(M) };
})()
