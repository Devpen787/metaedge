import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sha256, stateSegments, withAdminClient } from './postgres_state_common.js';

const source = path.resolve(process.argv[2] || '');
if (!source || !fs.existsSync(source)) throw new Error('POSTGRES_IMPORT_SOURCE_FILE_REQUIRED');
const raw = fs.readFileSync(source, 'utf8');
const state = JSON.parse(raw) as Record<string, unknown>;
assert.equal(Array.isArray(state.trades), true, 'source is not a MetaEdge state document');
assert.equal(typeof state.users, 'object', 'source is not a MetaEdge state document');
const segments = stateSegments(state);
const stateHash = sha256(JSON.stringify(state));
const stateBytes = Buffer.byteLength(JSON.stringify(state));

const imported = await withAdminClient(async (client) => {
  await client.query('begin');
  try {
    const existing = await client.query('select revision from metaedge.state_meta where id = 1 for update');
    if (existing.rowCount !== 0) throw new Error('POSTGRES_IMPORT_REFUSES_NONEMPTY_STATE');
    await client.query(
      `insert into metaedge.state_commits
        (revision, state_hash, state_bytes, writer_id, changed_keys, deleted_keys)
       values (1, $1, $2, 'migration-import', $3::text[], '{}')`,
      [stateHash, stateBytes, segments.map((segment) => segment.key)],
    );
    for (const segment of segments) {
      await client.query(
        `insert into metaedge.state_segments
          (segment_key, value, value_hash, value_bytes, last_revision)
         values ($1, $2::jsonb, $3, $4, 1)`,
        [segment.key, JSON.stringify(segment.value), segment.valueHash, segment.valueBytes],
      );
    }
    await client.query(
      `insert into metaedge.state_meta
        (id, schema_version, revision, state_hash, state_bytes)
       values (1, 5, 1, $1, $2)`,
      [stateHash, stateBytes],
    );
    await client.query('commit');
    return { revision: 1, segments: segments.length, stateHash, stateBytes };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
});

console.log(JSON.stringify({ source, ...imported, liveExecution: 'locked' }, null, 2));
