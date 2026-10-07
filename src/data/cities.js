// Sehirler ve baslangic noktalari (Silkroad bolge + bolge-yerel koordinat).
// Konumlar oyunun kendi isinlanma tablosundan (Media.pk2 teleportdata.txt) alinmistir:
// bolge kimligi = z * 256 + x; yerel koordinatlar oyuncunun sehir portalina vardigi nokta.
// heading: aracin tercih edilen bakis yonu (radyan, 0 = kuzey); dogma noktasi bulucu en acik yonu secer.

export const CITIES = [
  { id: 'jangan', name: 'Jangan', desc: 'Çin İmparatorluğu başkenti', rx: 168, rz: 97, lx: 969, lz: 1369, heading: 0, music: 'jangan_town.ogg' },
  { id: 'donwhang', name: 'Donwhang', desc: 'Çölün kapısındaki vaha şehri', rx: 153, rz: 102, lx: 957, lz: 1508, heading: 0, music: 'donwhang_town.ogg' },
  { id: 'hotan', name: 'Hotan', desc: 'Taklamakan kıyısındaki kale şehir', rx: 135, rz: 92, lx: 1136, lz: 680, heading: 0, music: 'hotan_field.ogg' },
  { id: 'samarkand', name: 'Samarkand', desc: 'Orta Asya ticaret merkezi', rx: 108, rz: 106, lx: 270, lz: 1421, heading: 0, music: 'centralasia_town.ogg' },
  { id: 'constantinople', name: 'Konstantiniyye', desc: 'Batının büyük başkenti', rx: 79, rz: 105, lx: 950, lz: 1070, heading: 0, music: 'easterneurope_town.ogg' },
  { id: 'alexandria', name: 'İskenderiye', desc: 'Mısır liman şehri', rx: 48, rz: 90, lx: 612, lz: 1089, heading: 0, music: 'egypt_town_alexandria1.ogg' },
];

export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[2];
