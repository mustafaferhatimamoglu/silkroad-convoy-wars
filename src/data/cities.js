import { CITIES as WORLD_CITIES } from '../world/gen/features.js';
import { REGION_M } from '../world/gen/blueprint.js';

// Sehirler ve baslangic noktalari: orijinal haritadaki yerleri (world/gen/features.js, oyunun
// isinlanma tablosundaki varis noktalari). Bolge + bolge-yerel koordinat (bolge 192 m = 1920
// birim): motorun koordinat donusumleriyle uyumlu. heading: aracin tercih edilen bakis yonu
// (radyan, 0 = kuzey); dogma noktasi bulucu en acik yonu secer.

export const CITIES = WORLD_CITIES.map((c) => {
  const rx = Math.floor(c.x / REGION_M), rz = Math.floor(c.z / REGION_M);
  return {
    id: c.id, name: c.name, desc: c.desc, culture: c.culture,
    rx, rz, lx: (c.x - rx * REGION_M) * 10, lz: (c.z - rz * REGION_M) * 10, heading: c.heading,
    cx: c.x, cz: c.z, r: c.r,
  };
});

export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[2];
