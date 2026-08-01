import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function stateSegments(state: Record<string, unknown>) {
  return Object.keys(state).sort().map((key) => {
    const json = JSON.stringify(state[key]);
    if (json === undefined) throw new Error(`UNSERIALIZABLE_STATE_SEGMENT:${key}`);
    return { key, value: state[key], valueHash: sha256(json), valueBytes: Buffer.byteLength(json) };
  });
}

export function requiredAdminUrl(): string {
  const url = process.env.METAEDGE_POSTGRES_ADMIN_URL || '';
  if (!/^postgres(?:ql)?:\/\//i.test(url)) throw new Error('METAEDGE_POSTGRES_ADMIN_URL_REQUIRED');
  return url;
}

export async function withAdminClient<T>(operation: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: requiredAdminUrl(), application_name: 'metaedge-v5-admin' });
  await client.connect();
  try { return await operation(client); }
  finally { await client.end(); }
}

export function migrationSql(): string {
  return fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '001_v5_canonical_state.sql'), 'utf8');
}

export async function readPostgresState(client: Client): Promise<Record<string, unknown>> {
  await client.query('begin isolation level repeatable read read only');
  try {
    const meta = await client.query('select revision from metaedge.state_meta where id = 1');
    if (meta.rowCount !== 1) throw new Error('POSTGRES_STATE_NOT_INITIALIZED');
    const rows = await client.query('select segment_key, value from metaedge.state_segments order by segment_key');
    await client.query('commit');
    return Object.fromEntries(rows.rows.map((row) => [row.segment_key, row.value]));
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
}
