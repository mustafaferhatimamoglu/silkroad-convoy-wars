import * as THREE from 'three';
import { CharacterMover } from './CharacterMover.js';
import { TRANSPORTS } from './Economy.js';

// Kervan bineği: oyuncuyu birkac metre geriden izler, yuk tasir. Takilirsa (uzak kalirsa)
// oyuncunun arkasina isinlanir. Haydutlarin hedefidir.

const _d = new THREE.Vector3();
const _w = new THREE.Vector3();

export class Caravan {
  constructor(app, lib, kind) {
    this.app = app;
    this.lib = lib;
    this.kind = kind;
    this.t = TRANSPORTS[kind];
    this.mover = new CharacterMover(app, { radius: 0.55, stepUp: 0.5, spheres: [0.9] });
    this.yaw = 0;
    this.char = null;
    this.ready = false;
    this.alive = true;
    this.stuckT = 0;
    this.name = this.t.tr;
    this.kindTag = 'caravan';
  }

  async spawn(behind, yaw) {
    this.char = await this.lib.create(this.t.model);
    this.mover.place(behind.x, behind.z, behind.y);
    this.yaw = yaw;
    this.char.root.position.copy(this.mover.pos);
    this.char.root.rotation.y = yaw;
    this.app.scene.add(this.char.root);
    this.char.play('idle');
    this.ready = true;
  }

  get pos() { return this.mover.pos; }

  update(dt, player, playerYaw) {
    if (!this.ready) return;
    const p = this.mover.pos;
    _d.subVectors(player, p); _d.y = 0;
    const dist = _d.length();
    const follow = 3.2;
    _w.set(0, 0, 0);
    if (!this.alive) {
      this.char.update(dt);
      return;
    }
    if (dist > 45 || Math.abs(player.y - p.y) > 8) {
      // cok geride kaldi: oyuncunun arkasina gel
      this.mover.place(player.x - Math.sin(playerYaw) * 3, player.z - Math.cos(playerYaw) * 3, player.y);
      this.stuckT = 0;
    } else if (dist > follow) {
      const sp = Math.min(this.t.speed * 1.15, (dist - follow) * 2.2 + 0.6);
      _w.copy(_d).multiplyScalar(sp / dist);
      const want = Math.atan2(_d.x, _d.z);
      let da = want - this.yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.yaw += da * Math.min(1, dt * 5);
    }
    this.mover.move(dt, _w, { accel: 12 });
    // takilma: istedigi halde ilerleyemiyorsa yana kaydir
    const v = Math.hypot(this.mover.vel.x, this.mover.vel.z);
    if (dist > follow + 2 && v < 0.3) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 2.5) { this.mover.place(player.x - Math.sin(playerYaw) * 2.5, player.z - Math.cos(playerYaw) * 2.5, player.y); this.stuckT = 0; }
    this.char.root.position.copy(this.mover.pos);
    this.char.root.rotation.y = this.yaw;
    if (v > 3.2) this.char.play('run', { timeScale: v / 5.5 });
    else if (v > 0.25) this.char.play('walk', { timeScale: Math.max(0.6, v / 1.8) });
    else this.char.play('idle');
    this.char.update(dt);
  }

  hit() { if (this.char && this.alive) this.char.play('hit', { once: true, then: 'idle', fade: 0.08 }); }

  knockOut() {
    this.alive = false;
    if (this.char) this.char.play('die', { once: true, fade: 0.1 });
  }

  revive() {
    this.alive = true;
    if (this.char) this.char.play('idle', { fade: 0.3 });
  }

  dispose() { if (this.char) this.char.dispose(); }
}
