import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../server/canonical_json.js';

test('canonical state hashing is independent of JSONB object-key order', () => {
  assert.equal(
    canonicalJson({ z: 1, nested: { b: 2, a: 1 }, rows: [{ y: 2, x: 1 }] }),
    canonicalJson({ rows: [{ x: 1, y: 2 }], nested: { a: 1, b: 2 }, z: 1 }),
  );
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
