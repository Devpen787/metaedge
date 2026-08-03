import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-storage-durability-'));
process.env.DATABASE_URL = path.join(dir, 'db.json');

test('canonical writes acknowledge file and directory durability', async () => {
  const { DB_FILE, readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  (db as any).durabilityMarker = 'persisted';

  const receipt = writeDatabase(db);

  assert.equal(receipt.file, DB_FILE);
  assert.equal(receipt.durability, 'file_and_directory_synced');
  assert.ok(receipt.bytes > 0);
  assert.ok(receipt.mtimeMs > 0);
  assert.ok(receipt.committedAt > 0);
  assert.equal(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')).durabilityMarker, 'persisted');
});

test('a failed write throws, cleans staging, and cannot leak cached mutations', async () => {
  const { DB_FILE, DatabaseWriteError, readDatabase, writeDatabase } = await import('../../server/storage.js');
  const before = fs.readFileSync(DB_FILE, 'utf8');
  const db = readDatabase();
  (db as any).uncommittedMarker = 'must-not-leak';
  (db as any).cycle = db;

  let failure: unknown;
  try {
    writeDatabase(db);
  } catch (error) {
    failure = error;
  }

  assert.ok(failure instanceof DatabaseWriteError);
  assert.equal(failure.commitState, 'not_committed');
  assert.equal(fs.readFileSync(DB_FILE, 'utf8'), before);
  assert.equal((readDatabase() as any).uncommittedMarker, undefined);
  assert.deepEqual(
    fs.readdirSync(dir).filter((name) => name.startsWith(`${path.basename(DB_FILE)}.tmp-`)),
    [],
  );
});

test('batched writes become durable together and discard mutations when the final commit fails', async () => {
  const {
    DatabaseWriteError,
    readDatabase,
    runDatabaseWriteBatch,
    writeDatabase,
  } = await import('../../server/storage.js');
  const durable = readDatabase();
  runDatabaseWriteBatch(() => {
    (durable as any).batchMarker = 'first';
    assert.equal(writeDatabase(durable).durability, 'pending_batch');
    (durable as any).batchMarker = 'complete';
    assert.equal(writeDatabase(durable).durability, 'pending_batch');
  });
  assert.equal((readDatabase() as any).batchMarker, 'complete');

  const failing = readDatabase();
  (failing as any).failedBatchMarker = 'must-not-leak';
  assert.throws(() => runDatabaseWriteBatch(() => {
    writeDatabase(failing);
    (failing as any).cycle = failing;
    writeDatabase(failing);
  }), DatabaseWriteError);
  assert.equal((readDatabase() as any).failedBatchMarker, undefined);
});

test('paper trade execution cannot report success when its canonical commit fails', async () => {
  const { DatabaseWriteError, readDatabase, writeDatabase } = await import('../../server/storage.js');
  const { placePaperTrade } = await import('../../server/trades.js');
  const now = Date.now();
  const db = readDatabase();
  db.users.persistence_user = {
    id: 'persistence_user',
    username: 'persistence-test',
    profile: { displayName: 'Persistence Test', avatarUrl: '', updatedAt: now },
    createdAt: now,
    lastActiveAt: now,
    paperBalance: 10_000,
    faucetClaimedCount: 0,
  };
  db.agents.persistence_agent = {
    authorityVersion: 5, schema: 'trading-agent.v5',
    id: 'persistence_agent',
    name: 'Persistence test',
    description: 'fixture',
    ownerId: 'persistence_user',
    assetSymbol: 'WRITEFAIL',
    tradeType: 'token',
    strategyType: 'momentum',
    leverage: 1,
    status: 'active',
    createdAt: now,
  };
  writeDatabase(db);
  const before = readDatabase();
  const balanceBefore = before.users.persistence_user.paperBalance;
  const tradeCountBefore = before.trades.length;
  (before as any).cycle = before;

  const result = placePaperTrade('persistence_user', {
    agentId: 'persistence_agent',
    assetSymbol: 'WRITEFAIL',
    side: 'buy',
    size: 1,
    price: 100,
    leverage: 1,
    nonce: 'persistence_failure_fixture',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.match(result.error || '', /not durably accepted/);
  const after = readDatabase();
  assert.equal(after.trades.length, tradeCountBefore);
  assert.equal(after.users.persistence_user.paperBalance, balanceBefore);
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
