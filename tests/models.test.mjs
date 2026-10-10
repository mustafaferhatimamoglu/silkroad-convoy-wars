import test from 'node:test';
import assert from 'node:assert/strict';
import { model } from '../src/world/gen/models.js';

test('prosedurel modeller: bank, heykeller, aslan, obelisk, havuz, selale', () => {
  const keys = [
    'bench:2.5',
    'bench:byzantine:2.5',
    'bench:persian:2.0',
    'statue:china:3.5:6.5',
    'statue:egypt:6.0:4.5',
    'statue:egypt:2.5:8.0',
    'statue:byzantine:3.0:5.5',
    'lion:0',
    'obelisk:egypt:24',
    'fountain:persian:9.5:3.5',
    'fountain:byzantine:12:4.5',
    'waterfall:10:16',
    'milestone:desert:1.4',
    'milestone:china:1.6',
    'milestone:byzantine:1.2',
  ];
  for (const k of keys) {
    const parts = model(k);
    assert.ok(Array.isArray(parts) && parts.length > 0, `${k} parca uretmedi`);
    for (const p of parts) {
      assert.ok(p.geo, `${k} geometrisi yok`);
      assert.ok(p.tex, `${k} dokusu yok`);
    }
  }
});
