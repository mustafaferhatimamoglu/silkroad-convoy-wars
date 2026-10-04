// Fizik testleri/izleri icin zemin saglayicilari (oyunla ayni kaynak).
import { flatGround } from '../src/vehicle/physics/FlatGround.js';

/** Egimli duzlem: -z (ileri) yonunde yukselir. surface: tiles.json bayragi. */
export function plane(slopeDeg = 0, surface = 3) {
  return flatGround({ slopeDeg, surface });
}
