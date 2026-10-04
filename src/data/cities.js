// Sehirler ve baslangic noktalari (Silkroad bolge + bolge-yerel koordinat).
// heading: araci baslatirken bakis yonu (radyan, 0 = kuzey, pozitif = bati yonune donus).

export const CITIES = [
  { id: 'jangan', name: 'Jangan', desc: 'Çin İmparatorluğu başkenti', rx: 168, rz: 97, lx: 960, lz: 960, heading: 0, music: 'jangan_town.ogg' },
  { id: 'donwhang', name: 'Donwhang', desc: 'Çölün kapısındaki vaha şehri', rx: 157, rz: 98, lx: 960, lz: 960, heading: 0, music: 'donwhang_town.ogg' },
  { id: 'hotan', name: 'Hotan', desc: 'Taklamakan kıyısındaki kale şehir', rx: 135, rz: 92, lx: 1136, lz: 680, heading: 0, music: 'hotan_field.ogg' },
  { id: 'samarkand', name: 'Samarkand', desc: 'Orta Asya ticaret merkezi', rx: 107, rz: 107, lx: 960, lz: 960, heading: 0, music: 'centralasia_town.ogg' },
  { id: 'constantinople', name: 'Konstantiniyye', desc: 'Batının büyük başkenti', rx: 78, rz: 106, lx: 960, lz: 960, heading: 0, music: 'easterneurope_town.ogg' },
  { id: 'alexandria', name: 'İskenderiye', desc: 'Mısır liman şehri', rx: 53, rz: 90, lx: 960, lz: 960, heading: 0, music: 'egypt_town_alexandria1.ogg' },
];

export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[2];
