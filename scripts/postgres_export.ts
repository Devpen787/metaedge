import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readPostgresState, sha256, withAdminClient } from './postgres_state_common.js';

const destination = path.resolve(process.argv[2] || '');
if (!destination) throw new Error('POSTGRES_EXPORT_DESTINATION_REQUIRED');
assert.equal(fs.existsSync(destination), false, 'refusing to overwrite an existing export');

const state = await withAdminClient((client) => readPostgresState(client));
const payload = `${JSON.stringify(state, null, 2)}\n`;
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, payload, { flag: 'wx', mode: 0o600 });

console.log(JSON.stringify({
  destination,
  bytes: Buffer.byteLength(payload),
  semanticHash: sha256(JSON.stringify(state)),
  users: Object.keys((state.users || {}) as object).length,
  trades: Array.isArray(state.trades) ? state.trades.length : 0,
  liveExecution: 'locked',
}, null, 2));
