import { makeContacts, makeHit } from '../world/Collision.js';

// Arac fiziginin bekledigi zemin arayuzu: raycast + kure temaslari, Silkroad dunyasi uzerinden.

export class WorldGround {
  constructor(collision) {
    this.col = collision;
    this.hit = makeHit();
    this.contacts = makeContacts(8);
    this.list = [];
  }

  raycast(o, d, far) {
    return this.col.raycast(o, d, far, this.hit) ? this.hit : null;
  }

  sphereContacts(p, r) {
    const n = this.col.sphereContacts(p, r, this.contacts, 6);
    this.list.length = 0;
    for (let i = 0; i < n; i++) this.list.push(this.contacts[i]);
    return this.list;
  }
}
