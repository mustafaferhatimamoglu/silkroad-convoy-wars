// Orijinal Silkroad dunyasindaki yerler (sablonla ayni koordinatlar: X dogu, Z kuzey, metre;
// X = bolge_x * 192 + yerel). Sehir dogus noktalari oyunun isinlanma tablosundaki (teleportdata)
// varis noktalaridir; yaricap sehrin surlari/yerlesimi kadar (bitki ortusu ve muzik icin).

const P = (rx, rz, lx, lz) => ({ x: rx * 192 + lx * 0.1, z: rz * 192 + lz * 0.1 });

export const CITIES = [
  { id: 'jangan', name: 'Jangan', desc: 'Çin İmparatorluğu başkenti', culture: 'china', ...P(168, 97, 969, 1369), r: 430, heading: 0 },
  { id: 'donwhang', name: 'Donwhang', desc: 'Çölün kapısındaki vaha şehri', culture: 'china', ...P(153, 102, 957, 1508), r: 330, heading: 0 },
  { id: 'hotan', name: 'Hotan', desc: 'Taklamakan kıyısındaki kale şehir', culture: 'desert', ...P(135, 92, 1136, 680), r: 360, heading: 0 },
  { id: 'samarkand', name: 'Semerkant', desc: 'Orta Asya ticaret merkezi', culture: 'persian', ...P(108, 106, 270, 1421), r: 340, heading: 0 },
  { id: 'constantinople', name: 'Konstantiniyye', desc: 'Batının büyük başkenti', culture: 'byzantine', ...P(79, 105, 950, 1070), r: 430, heading: 0 },
  { id: 'alexandria', name: 'İskenderiye', desc: 'Mısır liman şehri', culture: 'egypt', ...P(48, 90, 612, 1089), r: 380, heading: 0 },
];

// Orijinal feribot / ucan gemi iskeleleri (GATE_NPC_*: bilet satan NPC'nin yeri) ve hatlar.
export const DOCKS = {
  CH_FERRY: P(161, 97, 560, 1460), WC_FERRY: P(161, 100, 636, 1482),
  CH_FERRY2: P(158, 96, 523, 1267), WC_FERRY2: P(156, 98, 1025, 601),
  KT_FERRY2: P(140, 91, 904, 1412), WC_FERRY3: P(143, 91, 583, 1858),
  KT_FERRY3: P(140, 90, 1413, 769), WC_FERRY4: P(143, 90, 464, 879),
  KT_FLYSHIP1: P(121, 93, 862, 1623), KT_FLYSHIP2: P(121, 86, 1168, 824),
  RM_FLYSHIP1: P(118, 95, 888, 538), RM_FLYSHIP2: P(118, 87, 909, 267), RM_FLYSHIP3: P(104, 95, 1902, 657),
  CA_FLYSHIP: P(119, 101, 1367, 1626), AM_FLYSHIP: P(102, 97, 1279, 92),
  EU_FERRY2: P(75, 98, 734, 168), AM_FERRY1: P(89, 103, 1254, 1114), AM_FERRY2: P(89, 101, 1246, 1210),
  SD_FERRY: P(48, 93, 1525, 1688),
};
