// Rota boyunca 1 m aralikla zemin yuksekligi (kopru gibi obje ustleri dahil) ve zemin turu.
// Cikti: { H: [cm], I: [yol indeksi], S: [zemin; 99 = obje ustu] }   Yer tutucu: __STAGE__
(async () => {
  const STAGE = '__STAGE__';
  const { RALLY_STAGES } = await import('/src/data/rally.js?v=' + Date.now());
  const st = RALLY_STAGES[STAGE], w = app.world, col = app.collision;
  const V = (x = 0, y = 0, z = 0) => app.camera.position.clone().set(x, y, z);
  const P = ([rx, rz]) => { const ix = Math.floor(rx), iz = Math.floor(rz); return w.toThree(ix, iz, (rx - ix) * 1920, 0, (rz - iz) * 1920, V()); };
  const pts = st.path.map(P);
  const hit = { distance: 0, point: V(), normal: V(), object: false, surface: 0 };
  const d = V(0, -1, 0), o = V();
  const H = [], I = [], S = [];
  const CH = 24;
  for (let c0 = 0; c0 < pts.length - 1; c0 += CH) {
    const mid = pts[Math.min(pts.length - 1, c0 + (CH >> 1))];
    await game.loadArea(V(mid.x, 0, mid.z), 'profil');
    for (let k = 0; k < 10; k++) await new Promise((r) => requestAnimationFrame(r));
    for (let i = c0; i < Math.min(pts.length - 1, c0 + CH); i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z)));
      for (let k = 0; k < n; k++) {
        const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const h = w.heightAt(x, z);
        if (h === null || h === undefined) { H.push(-99900); I.push(i); S.push(0); continue; }
        let top = h, surf = w.surfaceAt(x, z);
        o.set(x, h + 40, z);
        if (col.raycast(o, d, 80, hit) && hit.point.y > h + 0.3) { top = hit.point.y; surf = 99; }
        H.push(Math.round(top * 100)); I.push(i); S.push(surf);
      }
    }
  }
  return JSON.stringify({ H, I, S });
})()
