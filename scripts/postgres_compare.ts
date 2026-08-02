import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { semanticHash } from './postgres_state_common.js';
import { normalizePersistedState } from '../server/state_normalization.js';

const sourcePath = path.resolve(process.argv[2] || '');
const exportedPath = path.resolve(process.argv[3] || '');
if (!sourcePath || !exportedPath) throw new Error('POSTGRES_COMPARE_REQUIRES_SOURCE_AND_EXPORT');
const source = normalizePersistedState(JSON.parse(fs.readFileSync(sourcePath, 'utf8')));
const exported = normalizePersistedState(JSON.parse(fs.readFileSync(exportedPath, 'utf8')));
assert.deepEqual(exported, source, 'PostgreSQL export is not semantically identical to the source state');

console.log(JSON.stringify({
  equal: true,
  source: sourcePath,
  exported: exportedPath,
  sourceSemanticHash: semanticHash(source),
  exportedSemanticHash: semanticHash(exported),
  users: Object.keys(source.users || {}).length,
  trades: Array.isArray(source.trades) ? source.trades.length : 0,
  liveExecution: 'locked',
}, null, 2));
