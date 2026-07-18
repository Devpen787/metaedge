import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import { FastPerpEvidenceStore } from '../../server/discovery/fast_perp_store.js';
import type { FastPerpTradeEvent } from '../../server/discovery/fast_perp_types.js';

function trade(id: string, receivedAt: number, symbol = 'SOL'): FastPerpTradeEvent {
  return { id, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'test', symbol,
    eventTime: receivedAt - 1, receivedAt, tradeId: null, sourceHash: null, side: 'buy',
    price: 100, size: 1, notionalUsd: 100, liquidation: null, liveExecution: 'locked' };
}

test('raw evidence is buffered and partitioned by receive date, hour, symbol, and kind', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-partitioned-store-'));
  const store = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000, maximumBatchEvents: 500 });
  store.appendTrades([trade('a', Date.UTC(2026, 6, 16, 8, 0), 'SOL'),
    trade('b', Date.UTC(2026, 6, 16, 9, 0), 'BTC')]);

  assert.equal(fs.existsSync(path.join(root, 'raw')), false);
  store.flush();
  assert.equal(fs.existsSync(path.join(root, 'raw', '2026-07-16', '08', 'SOL', 'trades.jsonl')), true);
  assert.equal(fs.existsSync(path.join(root, 'raw', '2026-07-16', '09', 'BTC', 'trades.jsonl')), true);
  assert.deepEqual(store.readTrades().map((row) => row.id), ['a', 'b']);
  store.close();
});

test('500 queued events force a batch flush before the timer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-batch-store-'));
  const store = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000, maximumBatchEvents: 500 });
  store.appendTrades(Array.from({ length: 500 }, (_, index) => trade(`t${index}`, 1_000 + index)));
  assert.equal(store.readTrades().length, 500);
  store.close();
});

test('one malformed JSONL row preserves valid rows and emits a hashed quarantine record', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-tolerant-store-'));
  const store = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000 });
  store.appendTrades([trade('valid-before', 1_000), trade('valid-after', 1_001)]);
  store.flush();
  const file = path.join(root, 'raw', '1970-01-01', '00', 'SOL', 'trades.jsonl');
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  fs.writeFileSync(file, `${lines[0]}\n{malformed\n${lines[1]}\n`);

  assert.deepEqual(store.readTrades().map((row) => row.id), ['valid-before', 'valid-after']);
  const quarantineFile = path.join(root, 'quarantine', 'malformed-jsonl.jsonl');
  const quarantined = fs.readFileSync(quarantineFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(quarantined.length, 1);
  assert.equal(quarantined[0].file, file);
  assert.equal(quarantined[0].line, 2);
  assert.equal(quarantined[0].reason, 'MALFORMED_JSONL_ROW');
  assert.match(quarantined[0].contentHash, /^[a-f0-9]{64}$/);
  assert.equal('content' in quarantined[0], false);
  store.close();
});

test('completed hourly partitions are gzipped and retention deletions are manifest logged', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-retention-store-'));
  const now = Date.UTC(2026, 6, 16, 12, 30);
  const store = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000 });
  store.appendTrades([trade('completed', Date.UTC(2026, 6, 16, 10, 15)),
    trade('expired', Date.UTC(2026, 5, 1, 10, 15)),
    trade('current', Date.UTC(2026, 6, 16, 12, 15))]);
  store.flush();
  const result = store.maintainPartitions(now, 30);

  assert.equal(fs.existsSync(path.join(root, 'raw', '2026-07-16', '10', 'SOL', 'trades.jsonl.gz')), true);
  assert.equal(fs.existsSync(path.join(root, 'raw', '2026-07-16', '12', 'SOL', 'trades.jsonl')), true);
  assert.equal(fs.existsSync(path.join(root, 'raw', '2026-06-01', '10', 'SOL', 'trades.jsonl')), false);
  assert.equal(result.compressedFiles, 1);
  assert.equal(result.deletedFiles, 1);
  const manifest = fs.readFileSync(path.join(root, 'manifests', 'partition-maintenance.jsonl'), 'utf8');
  assert.match(manifest, /"action":"compressed"/);
  assert.match(manifest, /"action":"retention_deleted"/);
  store.close();
});

test('partition maintenance is bounded per invocation and reports remaining compression work', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-bounded-maintenance-'));
  const now = Date.UTC(2026, 6, 16, 12, 30);
  const store = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000 });
  store.appendTrades([trade('sol', Date.UTC(2026, 6, 16, 10, 15), 'SOL'),
    trade('btc', Date.UTC(2026, 6, 16, 10, 15), 'BTC'),
    trade('eth', Date.UTC(2026, 6, 16, 10, 15), 'ETH')]);
  store.flush();

  const first = store.maintainPartitions(now, 30, 1);
  assert.equal(first.compressedFiles, 1);
  assert.equal(first.remainingCompressionFiles, 2);
  assert.equal(fs.readFileSync(path.join(root, 'manifests', 'partition-maintenance.jsonl'), 'utf8')
    .trim().split('\n').length, 1);
  const second = store.maintainPartitions(now + 60_000, 30, 1);
  assert.equal(second.compressedFiles, 1);
  assert.equal(second.remainingCompressionFiles, 1);
  store.close();
});

test('each compressed partition is manifest durable before a later file can fail', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-maintenance-crash-'));
  const now = Date.UTC(2026, 6, 16, 12, 30); let calls = 0;
  const store = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000,
    compressPartition: (input) => { calls += 1; if (calls === 2) throw new Error('INJECTED_COMPRESSION_FAILURE');
      return zlib.gzipSync(input, { level: 1 }); } });
  store.appendTrades([trade('sol', Date.UTC(2026, 6, 16, 10, 15), 'SOL'),
    trade('btc', Date.UTC(2026, 6, 16, 10, 15), 'BTC')]);
  store.flush();

  assert.throws(() => store.maintainPartitions(now, 30, 2), /INJECTED_COMPRESSION_FAILURE/);
  const manifest = fs.readFileSync(path.join(root, 'manifests', 'partition-maintenance.jsonl'), 'utf8')
    .trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].action, 'compressed');
  assert.equal(fs.existsSync(manifest[0].target), true);
  assert.equal(fs.existsSync(manifest[0].file), false);
  store.close();
});

test('maintenance reconciles a valid compressed target left before its manifest append', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-maintenance-reconcile-'));
  const now = Date.UTC(2026, 6, 16, 12, 30);
  const store = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000,
    compressPartition: () => { throw new Error('SHOULD_NOT_RECOMPRESS_VALID_TARGET'); } });
  store.appendTrades([trade('sol', Date.UTC(2026, 6, 16, 10, 15), 'SOL')]); store.flush();
  const source = path.join(root, 'raw', '2026-07-16', '10', 'SOL', 'trades.jsonl');
  const target = `${source}.gz`; fs.writeFileSync(target, zlib.gzipSync(fs.readFileSync(source), { level: 1 }));

  const result = store.maintainPartitions(now, 30, 1);
  assert.equal(result.recoveredFiles, 1);
  assert.equal(fs.existsSync(source), false);
  assert.equal(fs.existsSync(target), true);
  const manifest = fs.readFileSync(path.join(root, 'manifests', 'partition-maintenance.jsonl'), 'utf8');
  assert.match(manifest, /"recoveredAfterInterruptedManifest":true/);
  store.close();
});

test('bounded symbol/time reads do not scan unrelated historical partitions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-bounded-read-'));
  const store = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000 });
  const currentAt = Date.UTC(2026, 6, 16, 12, 0); const oldAt = Date.UTC(2026, 5, 1, 12, 0);
  store.appendTrades([trade('old', oldAt), trade('current', currentAt)]); store.flush();
  const oldFile = path.join(root, 'raw', '2026-06-01', '12', 'SOL', 'trades.jsonl');
  fs.writeFileSync(oldFile, '{malformed historical partition\n');
  const rows = store.readTrades({ symbol: 'SOL', fromReceivedAt: currentAt - 1_000, toReceivedAt: currentAt + 1_000, limit: 10 });
  assert.deepEqual(rows.map((row) => row.id), ['current']);
  assert.equal(fs.existsSync(path.join(root, 'quarantine', 'malformed-jsonl.jsonl')), false);
  store.close();
});

test('stale store instances merge materialized counters instead of losing another writer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-summary-multiwriter-'));
  const trades = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000 });
  const books = new FastPerpEvidenceStore(root, { flushIntervalMs: 60_000 });
  const at = Date.UTC(2026, 6, 16, 12, 0);
  trades.appendTrades([trade('trade-writer', at)]); trades.flush();
  books.appendBooks([{ id: 'book-writer', schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'test', symbol: 'SOL',
    eventTime: at - 1, receivedAt: at, bids: [{ price: 99, size: 1, orders: 1 }],
    asks: [{ price: 101, size: 1, orders: 1 }], bestBid: 99, bestAsk: 101, midPrice: 100,
    spreadBps: 200, bidDepthUsd: 99, askDepthUsd: 101, imbalance: 0, liveExecution: 'locked' }]);
  books.flush();
  const merged = new FastPerpEvidenceStore(root).snapshot(at);
  assert.equal(merged.counts.trades, 1);
  assert.equal(merged.counts.books, 1);
  trades.close(); books.close();
});
