import fs from 'node:fs';
import zlib from 'node:zlib';
import { BlueprintPlan } from '../src/world/gen/blueprint.js';
import { GenWorldData } from '../src/world/gen/GenData.js';
import { CITIES } from '../src/world/gen/features.js';
import { setMassing } from '../src/world/gen/models.js';
import { setPbr } from '../src/world/gen/build.js';
import { setupTransport } from '../src/world/gen/docks.js';
import { setTrackHeights } from '../src/world/gen/tracks.js';
import { Simplex } from '../src/world/gen/noise.js';

export async function loadGenWorld() {
  const meta = JSON.parse(fs.readFileSync('content/world/blueprint.json', 'utf-8'));
  const names = ['heights', 'ground', 'water', 'objects', 'massing', 'vegclusters', 'color'];
  const files = {};
  for (const n of names) {
    const p = 'content/world/' + n + '.dat';
    if (fs.existsSync(p)) files[n] = zlib.gunzipSync(fs.readFileSync(p));
  }
  const plan = await BlueprintPlan.load(null, { meta, files });
  const g = new GenWorldData();
  g.tiles = JSON.parse(fs.readFileSync('content/textures/terrain.json', 'utf-8'));
  g.tileByName = Object.fromEntries(g.tiles.map(t => [t.name, t]));
  g.plan = plan;
  try { setPbr(JSON.parse(fs.readFileSync('content/textures/pbr.json', 'utf-8'))); } catch {}
  let avg = {};
  try { avg = JSON.parse(fs.readFileSync('content/textures/avg.json', 'utf-8')); } catch {}
  setMassing(g.plan.massing, avg, g.plan.objModels ? g.plan.objModels.map(m => m[8]) : null);
  g.plan.cities = CITIES.map(c => ({ ...c, h: g.plan.templateH(c.x, c.z) }));
  setupTransport(g.plan);
  try { setTrackHeights(JSON.parse(fs.readFileSync('content/world/trackh.json', 'utf-8'))); } catch {}
  g.n = new Simplex(g.plan.seed + 7);
  g.regions = new Map();
  for (let rz = plan.rz0; rz <= plan.rz1; rz++) {
    for (let rx = plan.rx0; rx <= plan.rx1; rx++) {
      if (plan.hasRegion(rx, rz)) g.regions.set(g.key(rx, rz), { key: g.key(rx, rz), x: rx, z: rz, objects: true, minH: 0, maxH: 400 });
    }
  }
  return g;
}

if (process.argv[1]?.endsWith('inspect_cities.mjs')) {
  const g = await loadGenWorld();
  for (const [cname, rx, rz] of [
    ['Constantinople', 79, 105],
    ['Alexandria', 48, 90],
    ['Samarkand', 108, 106],
    ['Hotan', 135, 92],
    ['Donwhang', 153, 102],
    ['Jangan', 168, 97],
  ]) {
    const objs = g.objects(g.key(rx, rz));
    console.log(`=== ${cname} (${rx}, ${rz}) === Objs: ${objs.length}`);
    const models = {};
    for (const o of objs) {
      const k = typeof o.m === 'string' ? o.m.split(':')[0] : o.m;
      models[k] = (models[k] || 0) + 1;
    }
    console.log('  Models sample:', Object.entries(models).slice(0, 10).map(([k, v]) => `${k}:${v}`).join(', '));
  }
}
