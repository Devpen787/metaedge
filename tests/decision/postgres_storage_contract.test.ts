import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../server/canonical_json.js';
import { normalizePersistedState } from '../../server/state_normalization.js';

test('canonical state hashing is independent of JSONB object-key order', () => {
  assert.equal(
    canonicalJson({ z: 1, nested: { b: 2, a: 1 }, rows: [{ y: 2, x: 1 }] }),
    canonicalJson({ rows: [{ x: 1, y: 2 }], nested: { a: 1, b: 2 }, z: 1 }),
  );
});

test('migration normalization is deterministic and removes first-write schema drift', () => {
  const source: any = {
    users: {}, trades: [],
    decisionRuntime: { strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {} },
  };
  const normalized = normalizePersistedState(source);
  const first = canonicalJson(normalized);
  assert.deepEqual(normalized.decisionRuntime.cycleDiagnostics, []);
  assert.deepEqual(normalized.decisionRuntime.forwardCheckpoints, []);
  assert.deepEqual(normalized.experimentsV5, {
    specs: {}, states: {}, budgets: {}, observations: [], lifecycleEvents: [],
  });
  assert.equal(canonicalJson(normalizePersistedState(normalized)), first);
});

test('production refuses file-backed canonical state unless an isolated smoke explicitly opts in', () => {
  const databaseUrl = path.join(os.tmpdir(), `metaedge-production-file-${process.pid}.json`);
  const command = ['--import', 'tsx', '--input-type=module', '--eval', "await import('./server/storage.ts')"];
  const blocked = spawnSync(process.execPath, command, {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: databaseUrl,
      METAEDGE_ALLOW_PRODUCTION_SQLITE: '' },
    encoding: 'utf8',
  });
  assert.notEqual(blocked.status, 0);
  assert.match(`${blocked.stdout}${blocked.stderr}`, /PRODUCTION_POSTGRES_REQUIRED/);

  const smoke = spawnSync(process.execPath, command, {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: databaseUrl,
      METAEDGE_ALLOW_PRODUCTION_SQLITE: 'true' },
    encoding: 'utf8',
  });
  assert.equal(smoke.status, 0, smoke.stderr);
});

test('PostgreSQL canonical schema is constrained, versioned, and commit-audited', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '001_v5_canonical_state.sql'), 'utf8');
  assert.match(sql, /state_commits\s*\(/);
  assert.match(sql, /revision bigint primary key/);
  assert.match(sql, /schema_version integer not null check \(schema_version = 5\)/);
  assert.match(sql, /value jsonb not null/);
  assert.match(sql, /state_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
});

test('production cutover gives cold PostgreSQL reads time and explicitly enables only the V5 paper decision writer', () => {
  const cutover = fs.readFileSync(path.join(process.cwd(), 'scripts', 'gcp_v5_postgres_cutover.sh'), 'utf8');
  assert.match(cutover, /METAEDGE_POSTGRES_SYNC_TIMEOUT_MS=90000/);
  assert.match(cutover, /Environment=DECISION_RUNTIME_DISABLED=false/);
  assert.match(cutover, /Environment=V5_DECISION_WRITER_ENABLED=true/);
  assert.match(cutover, /for _ in \$\(seq 1 90\)/);
  assert.match(cutover, /Environment=OPPORTUNITY_FACTORY_DISABLED=true/);
  assert.match(cutover, /Environment=FAST_PERP_OPERATION_ENABLED=false/);
  assert.ok(
    cutover.indexOf('sudo systemctl stop metaedge')
      < cutover.indexOf('cp "$metaedge_source_db" "$metaedge_shared_dir\/backups\/db-before-postgres-'),
    'the final migration snapshot must be taken only after the legacy writer stops',
  );
});
