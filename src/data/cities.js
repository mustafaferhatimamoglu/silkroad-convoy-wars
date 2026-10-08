import { CITIES as PLAN, REGION_M } from '../world/gen/plan.js';

// Sehirler ve baslangic noktalari (V5 dunya plani: world/gen/plan.js). Bolge + bolge-yerel koordinat
// (bolge 192 m = 1920 birim): motorun koordinat donusumleriyle uyumlu.
// heading: aracin tercih edilen bakis yonu (radyan, 0 = kuzey); dogma noktasi bulucu en acik yonu secer.

const DESC = {
  jangan: 'İmparatorluğun başkenti, nehrin doğusunda',
  donwhang: 'Çölün kapısındaki vaha şehri, kızıl mesalar',
  hotan: 'Kum denizinin kıyısında kale şehir',
  samarkand: 'Dağların batısında ticaret merkezi',
  constantinople: 'Boğazın kıyısındaki büyük başkent',
  alexandria: 'Denizin öte yakasında liman şehri',
};

export const CITIES = PLAN.map((c) => {
  // dogma: meydanin dogu kenari (yol ve kapi tarafi)
  const x = c.x + c.r * 0.42, z = c.z;
  const rx = Math.floor(x / REGION_M), rz = Math.floor(z / REGION_M);
  return {
    id: c.id, name: c.name, desc: DESC[c.id] || '', culture: c.culture,
    rx, rz, lx: (x - rx * REGION_M) * 10, lz: (z - rz * REGION_M) * 10, heading: c.heading,
    cx: c.x, cz: c.z, r: c.r,
  };
});

export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[2];
