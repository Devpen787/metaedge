import { readPostgresState, semanticHash, withAdminClient } from './postgres_state_common.js';

const report = await withAdminClient(async (client) => {
  const meta = await client.query(`
    select m.schema_version, m.revision, m.state_hash, m.state_bytes, m.updated_at,
      (select count(*) from metaedge.state_segments)::bigint as segment_count,
      (select count(*) from metaedge.state_commits)::bigint as commit_count
    from metaedge.state_meta m where m.id = 1
  `);
  if (meta.rowCount !== 1) throw new Error('POSTGRES_STATE_NOT_INITIALIZED');
  const state = await readPostgresState(client);
  return {
    schemaVersion: Number(meta.rows[0].schema_version),
    revision: Number(meta.rows[0].revision),
    storedStateHash: meta.rows[0].state_hash,
    semanticHash: semanticHash(state),
    stateBytes: Number(meta.rows[0].state_bytes),
    segmentCount: Number(meta.rows[0].segment_count),
    commitCount: Number(meta.rows[0].commit_count),
    updatedAt: meta.rows[0].updated_at,
    users: Object.keys((state.users || {}) as object).length,
    trades: Array.isArray(state.trades) ? state.trades.length : 0,
    liveExecution: 'locked',
  };
});

console.log(JSON.stringify(report, null, 2));
