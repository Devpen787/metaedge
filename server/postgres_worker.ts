import { MessagePort, workerData } from 'node:worker_threads';
import { Pool, type PoolClient } from 'pg';

interface RequestMessage {
  id: number;
  command: 'ping' | 'read' | 'write';
  payload: Record<string, any>;
  signal: SharedArrayBuffer;
}

const port = workerData.port as MessagePort;
const pool = new Pool({
  connectionString: String(workerData.connectionString),
  max: Number(workerData.poolMax) || 2,
  idleTimeoutMillis: Number(workerData.idleTimeoutMs) || 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: Number(workerData.statementTimeoutMs) || 60_000,
  application_name: 'metaedge-v5-state-worker',
});

async function withTransaction<T>(mode: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query(`begin ${mode}`);
    await client.query("set local lock_timeout = '5s'");
    const result = await operation(client);
    await client.query('commit');
    committed = true;
    return result;
  } catch (error) {
    if (!committed) await client.query('rollback').catch(() => undefined);
    (error as any).commitState = committed ? 'possibly_committed' : 'not_committed';
    throw error;
  } finally {
    client.release();
  }
}

async function handle(message: RequestMessage): Promise<unknown> {
  if (message.command === 'ping') {
    const result = await pool.query(`
      select m.schema_version, m.revision,
        (extract(epoch from clock_timestamp()) * 1000)::bigint as server_time
      from metaedge.state_meta m where m.id = 1
    `);
    if (result.rowCount !== 1) throw new Error('POSTGRES_STATE_NOT_INITIALIZED');
    return {
      schemaVersion: Number(result.rows[0].schema_version),
      revision: Number(result.rows[0].revision),
      serverTime: Number(result.rows[0].server_time),
    };
  }

  if (message.command === 'read') {
    return withTransaction('isolation level repeatable read read only', async (client) => {
      await client.query("set local statement_timeout = '60s'");
      const meta = await client.query(
        'select revision, schema_version, state_hash from metaedge.state_meta where id = 1',
      );
      if (meta.rowCount !== 1) return { missing: true };
      const revision = Number(meta.rows[0].revision);
      if (message.payload.expectedRevision != null
        && Number(message.payload.expectedRevision) === revision) {
        return { unchanged: true, revision, schemaVersion: Number(meta.rows[0].schema_version), stateHash: meta.rows[0].state_hash };
      }
      const segments = await client.query(`
        select segment_key, value, value_hash, value_bytes
        from metaedge.state_segments
        order by segment_key
      `);
      return {
        revision,
        schemaVersion: Number(meta.rows[0].schema_version),
        stateHash: meta.rows[0].state_hash,
        segments: segments.rows.map((row) => ({
          key: row.segment_key,
          value: row.value,
          valueHash: row.value_hash,
          valueBytes: Number(row.value_bytes),
        })),
      };
    });
  }

  if (message.command === 'write') {
    const input = message.payload;
    return withTransaction('', async (client) => {
      await client.query("set local statement_timeout = '15s'");
      const meta = await client.query('select revision from metaedge.state_meta where id = 1 for update');
      if (meta.rowCount !== 1) throw new Error('POSTGRES_STATE_NOT_INITIALIZED');
      const currentRevision = Number(meta.rows[0].revision);
      if (currentRevision !== Number(input.expectedRevision)) {
        const stale = new Error(`STALE_DATABASE_REVISION:${input.expectedRevision}:${currentRevision}`) as Error & { code?: string };
        stale.code = 'STALE_DATABASE_REVISION';
        throw stale;
      }
      const revision = currentRevision + 1;
      const changed = Array.isArray(input.changedSegments) ? input.changedSegments : [];
      const deleted = Array.isArray(input.deletedKeys) ? input.deletedKeys : [];
      await client.query(
        `insert into metaedge.state_commits
          (revision, state_hash, state_bytes, writer_id, changed_keys, deleted_keys)
         values ($1, $2, $3, $4, $5::text[], $6::text[])`,
        [revision, input.stateHash, input.stateBytes, input.writerId, changed.map((row: any) => row.key), deleted],
      );
      for (const segment of changed) {
        const valueJson = String(segment.valueJson || '');
        const valueBytes = Buffer.byteLength(valueJson);
        if (valueBytes !== Number(segment.valueBytes)) throw new Error(`POSTGRES_SEGMENT_BYTES_MISMATCH:${segment.key}`);
        await client.query(
          `insert into metaedge.state_segments
            (segment_key, value, value_hash, value_bytes, last_revision)
           values ($1, $2::jsonb, $3, $4, $5)
           on conflict (segment_key) do update set
             value = excluded.value,
             value_hash = excluded.value_hash,
             value_bytes = excluded.value_bytes,
             last_revision = excluded.last_revision,
             updated_at = clock_timestamp()`,
          [segment.key, valueJson, segment.valueHash, valueBytes, revision],
        );
      }
      if (deleted.length > 0) {
        await client.query('delete from metaedge.state_segments where segment_key = any($1::text[])', [deleted]);
      }
      await client.query(
        `update metaedge.state_meta set
          revision = $1, state_hash = $2, state_bytes = $3,
          updated_at = clock_timestamp()
         where id = 1`,
        [revision, input.stateHash, input.stateBytes],
      );
      return { revision, committedAt: Date.now() };
    });
  }

  throw new Error(`POSTGRES_WORKER_UNKNOWN_COMMAND:${message.command}`);
}

let chain = Promise.resolve();
port.on('message', (message: RequestMessage) => {
  chain = chain.then(async () => {
    let reply: Record<string, unknown>;
    try {
      reply = { id: message.id, ok: true, result: await handle(message) };
    } catch (error: any) {
      reply = {
        id: message.id,
        ok: false,
        error: {
          message: error?.message || String(error),
          code: error?.code,
          commitState: error?.commitState || 'not_committed',
        },
      };
    }
    port.postMessage(reply);
    const flag = new Int32Array(message.signal);
    Atomics.store(flag, 0, 1);
    Atomics.notify(flag, 0, 1);
  });
});
