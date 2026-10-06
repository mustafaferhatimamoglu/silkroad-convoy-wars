// Rota koridoru ince engel taramasi (kaktus, hurma govdesi, direk: 4 m'lik tarama izgarasinda kacar).
// Yol boyunca 1 m adimla, yola dik +-W m (1 m) noktalarda zemin+0.9 ve +1.7 m'de r=0.6 kure temasi.
// Cikti: [[yol indeksi, ornek, yanal m (+ sol), x, z], ...] (Three.js koordinati)
// Yer tutucular: __STAGE__ (etap kimligi), __W__ (yari genislik, m), __KEY__ (path: rota, line: hizli cizgi)
(async () => {
  const STAGE = '__STAGE__', W = __W__, KEY = '__KEY__';
  const { RALLY_STAGES } = await import('/src/data/rally.js?v=' + Date.now());
  const st = RALLY_STAGES[STAGE], w = app.world, col = app.collision;
  const V = (x = 0, y = 0, z = 0) => app.camera.position.clone().set(x, y, z);
  const P = ([rx, rz]) => { const ix = Math.floor(rx), iz = Math.floor(rz); return w.toThree(ix, iz, (rx - ix) * 1920, 0, (rz - iz) * 1920, V()); };
  const pts = st[KEY].map(P);
  const contacts = [];
  for (let i = 0; i < 8; i++) contacts.push({ depth: 0, normal: V(), point: V(), object: false });
  const c = V(), obs = [], down = V(0, -1, 0);
  const hit = { distance: 0, point: V(), normal: V(), object: false, surface: 0 };
  const CH = 24;
  let s = 0;
  for (let c0 = 0; c0 < pts.length - 1; c0 += CH) {
    const mid = pts[Math.min(pts.length - 1, c0 + (CH >> 1))];
    await game.loadArea(V(mid.x, 0, mid.z), 'koridor');
    for (let k = 0; k < 10; k++) await new Promise((r) => requestAnimationFrame(r));
    for (let i = c0; i < Math.min(pts.length - 1, c0 + CH); i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(L));
      const px = -(b.z - a.z) / L, pz = (b.x - a.x) / L;
      for (let k = 0; k < n; k++, s++) {
        const t = k / n, x0 = a.x + (b.x - a.x) * t, z0 = a.z + (b.z - a.z) * t;
        for (let l = -W; l <= W; l++) {
          const x = x0 + px * l, z = z0 + pz * l;
          const h = w.heightAt(x, z);
          if (h === null || h === undefined) continue;
          // ince su (hendek, kanal): 4 m'lik taramada kacabilir; engel say
          const wl = w.waterAt(x, z);
          let hitObj = wl !== null && wl !== undefined && wl > h + 0.2;
          // kopru: su ustunde surulebilir obje yuzeyi varsa su degil
          if (hitObj && col.raycast(c.set(x, wl + 30, z), down, 40, hit) && hit.object && hit.point.y > wl) hitObj = false;
          for (const dy of [0.9, 1.7]) {
            if (hitObj) break;
            c.set(x, h + dy, z);
            const cnt = col.sphereContacts(c, 0.6, contacts, 8);
            for (let q = 0; q < cnt; q++) if (contacts[q].object && Math.abs(contacts[q].normal.y) < 0.75) { hitObj = true; break; }
            if (hitObj) break;
          }
          if (hitObj) obs.push([i, s, l, +x.toFixed(1), +z.toFixed(1)]);
        }
      }
    }
  }
  return JSON.stringify(obs);
})()
