import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { explicitUniverse, readUniverseFile } from '../../scripts/lib/universe.mjs';

test('research tools require an explicit universe authority', () => {
  assert.throws(() => explicitUniverse([], 'symbols'), /Explicit universe required/);
  assert.deepEqual(explicitUniverse(['--symbols', 'dot,ETH,dot'], 'symbols'), ['DOT', 'ETH']);
});

test('criterion feed files resolve included symbols without a convenience list', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-universe-'));
  const file = path.join(dir, 'universe.json');
  fs.writeFileSync(file, JSON.stringify({ included: [{ symbol: 'near' }, { symbol: 'uni' }], excluded: [{ symbol: 'usd', reason: 'stable' }] }));
  assert.deepEqual(readUniverseFile(file), ['NEAR', 'UNI']);
  fs.rmSync(dir, { recursive: true, force: true });
});

