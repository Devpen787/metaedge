import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';
import { FastPerpEvidenceStore } from '../../server/discovery/fast_perp_store.js';
import {
  FastPerpResearchBridge,
  createFastPerpEvidenceExport,
  executeFastPerpResearchBatch,
} from '../../server/discovery/fast_perp_research_bridge.js';
import type { FastPerpBookEvent, FastPerpTradeEvent } from '../../server/discovery/fast_perp_types.js';

function book(index: number): FastPerpBookEvent {
  const eventTime = index * 5_000; const midPrice = 100 * (1.0008 ** index);
  const bestBid = midPrice - 0.005; const bestAsk = midPrice + 0.005;
  return { id: `book_${index}`, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'bridge-test', symbol: 'SOL',
    eventTime, receivedAt: eventTime + 1, bids: [{ price: bestBid, size: 100, orders: 1 }],
    asks: [{ price: bestAsk, size: 100, orders: 1 }], bestBid, bestAsk, midPrice,
    spreadBps: (bestAsk - bestBid) / midPrice * 10_000, bidDepthUsd: bestBid * 100,
    askDepthUsd: bestAsk * 100, imbalance: 0.8, liveExecution: 'locked' };
}

function trade(index: number): FastPerpTradeEvent {
  const eventTime = index * 5_000;
  return { id: `trade_${index}`, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'bridge-test', symbol: 'SOL',
    eventTime, receivedAt: eventTime + 2, tradeId: index, sourceHash: null, side: index % 2 ? 'buy' : 'sell',
    price: 100, size: 10, notionalUsd: 1_000, liquidation: null, liveExecution: 'locked' };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-research-bridge-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'canonical-evidence'));
  const economics = new EconomicOperationStore(path.join(root, 'canonical-economics'));
  evidence.appendBooks(Array.from({ length: 140 }, (_, index) => book(index)));
  evidence.appendTrades(Array.from({ length: 140 }, (_, index) => trade(index)));
  evidence.flush();
  return { root, evidence, economics, bridge: new FastPerpResearchBridge(path.join(root, 'bridge')) };
}

test('research batch consumes an immutable export without mutating canonical stores', () => {
  const { root, evidence, economics } = fixture();
  const before = { research: evidence.readResearchRuns().length, contracts: economics.readContracts().length };
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  const proposal = executeFastPerpResearchBatch(exported, path.join(root, 'research-work'));
  assert.equal(evidence.readResearchRuns().length, before.research);
  assert.equal(economics.readContracts().length, before.contracts);
  assert.equal(proposal.evidenceExportId, exported.id);
  assert.equal(proposal.liveExecution, 'locked');
});

test('proposal publication is hash-verified and atomic', () => {
  const { root, evidence, economics, bridge } = fixture();
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  const proposal = executeFastPerpResearchBatch(exported, path.join(root, 'research-work'));
  const file = bridge.publishProposal(proposal);
  assert.equal(bridge.readProposal(file).id, proposal.id);
  const corrupt = JSON.parse(fs.readFileSync(file, 'utf8')); corrupt.payload.run.id = 'tampered';
  fs.writeFileSync(file, JSON.stringify(corrupt));
  assert.throws(() => bridge.readProposal(file), /BUNDLE_HASH_MISMATCH/);
});

test('killed evidence publication exposes no bundle and leaves no staging directory', () => {
  const { root, evidence, economics, bridge } = fixture();
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  assert.throws(() => bridge.publishEvidence(exported, { failAfterChunks: 1 }), /PUBLICATION_FAILURE/);
  const evidenceRoot = path.join(root, 'bridge', 'evidence');
  assert.equal(fs.existsSync(path.join(evidenceRoot, exported.id)), false);
  assert.deepEqual(fs.existsSync(evidenceRoot) ? fs.readdirSync(evidenceRoot) : [], []);
});

test('batch parent reads bounded metadata without hydrating evidence chunks', () => {
  const { evidence, economics, bridge } = fixture();
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  const directory = bridge.publishEvidence(exported); const metadata = bridge.readEvidenceMetadata(directory);
  assert.equal(metadata.id, exported.id); assert.equal(metadata.payloadHash, exported.payloadHash);
  assert.equal('payload' in metadata, false);
});

test('evidence manifest cannot traverse outside its immutable bundle directory', () => {
  const { evidence, economics, bridge } = fixture();
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  const directory = bridge.publishEvidence(exported); const manifestFile = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.payload.trades[0].file = '../../outside.jsonl'; fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  assert.throws(() => bridge.readEvidence(directory), /CHUNK_MANIFEST_INVALID/);
});

test('continuous importer is exactly-once and resumes safely after an interrupted import', () => {
  const { root, evidence, economics, bridge } = fixture();
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  const proposal = executeFastPerpResearchBatch(exported, path.join(root, 'research-work'));
  bridge.publishProposal(proposal);
  assert.throws(() => bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics,
    failAfter: 'research_run', now: 700_001 }), /INJECTED_IMPORT_FAILURE/);
  const completed = bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics, now: 700_001 });
  const duplicate = bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics, now: 700_001 });
  assert.equal(completed.status, 'imported');
  assert.equal(duplicate.status, 'already_imported');
  assert.equal(evidence.readResearchRuns().filter((row) => row.id === proposal.payload.run.id).length, 1);
  assert.equal(economics.readContracts().length, new Set(proposal.payload.contracts.map((row) => row.id)).size);
});

test('stale authority and live-unlocked bundles fail closed', () => {
  const { root, evidence, economics, bridge } = fixture();
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  const proposal = executeFastPerpResearchBatch(exported, path.join(root, 'research-work'));
  bridge.publishProposal(proposal);
  evidence.appendResearchRuns([{ ...proposal.payload.run, id: 'independent-authority-change' }]);
  assert.throws(() => bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics, now: 700_001 }),
    /STALE_AUTHORITY/);
  assert.throws(() => bridge.publishProposal({ ...proposal, liveExecution: 'enabled' as never }), /LIVE_NOT_LOCKED/);
});

test('expired evidence and proposals are rejected without canonical writes', () => {
  const { root, evidence, economics, bridge } = fixture();
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  assert.throws(() => executeFastPerpResearchBatch(exported, path.join(root, 'late-work'), exported.expiresAt + 1),
    /EVIDENCE_EXPORT_EXPIRED/);
  const proposal = executeFastPerpResearchBatch(exported, path.join(root, 'research-work'));
  bridge.publishProposal(proposal);
  assert.throws(() => bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics,
    now: proposal.expiresAt + 1 }), /PROPOSAL_EXPIRED/);
  assert.equal(evidence.readResearchRuns().length, 0);
  assert.equal(economics.readContracts().length, 0);
});

test('a killed batch attempt is abandoned at its deadline and the next batch can start', () => {
  const { bridge } = fixture(); const first = bridge.beginAttempt('export-one', 1_000, 500);
  assert.equal(bridge.researchBatchHealth(true, 1_200).status, 'running');
  assert.equal(bridge.researchBatchHealth(true, 1_501).status, 'abandoned');
  const second = bridge.beginAttempt('export-two', 2_000, 500);
  assert.notEqual(second.id, first.id);
  assert.equal(bridge.researchBatchHealth(true, 2_100).status, 'running');
  assert.equal(bridge.researchBatchHealth(false, 2_100).status, 'disabled');
});

test('unchanged evidence imports as an idempotent no-op instead of false stale authority', () => {
  const { root, evidence, economics, bridge } = fixture();
  const firstExport = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  const first = executeFastPerpResearchBatch(firstExport, path.join(root, 'first-work'));
  bridge.publishProposal(first); bridge.importProposal(first.id, { evidenceStore: evidence, economicStore: economics, now: 700_001 });
  const before = { runs: evidence.readResearchRuns().length, contracts: economics.readContracts().length };
  const unchangedExport = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_100 });
  const unchanged = executeFastPerpResearchBatch(unchangedExport, path.join(root, 'unchanged-work'));
  assert.equal(unchanged.payload.runIsNew, false); bridge.publishProposal(unchanged);
  assert.equal(bridge.importProposal(unchanged.id, { evidenceStore: evidence, economicStore: economics,
    now: 700_101 }).status, 'imported');
  assert.deepEqual({ runs: evidence.readResearchRuns().length, contracts: economics.readContracts().length }, before);
});

test('fresh overlap and import locks reject competitors while stale import locks recover', () => {
  const { root, evidence, economics, bridge } = fixture();
  const attempt = bridge.beginAttempt('one', 1_000, 10_000);
  assert.throws(() => bridge.beginAttempt('two', 1_001, 10_000), /ALREADY_RUNNING/);
  bridge.finishAttempt(attempt.id, 'completed', { completedAt: 1_002 });
  const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: 700_000 });
  const proposal = executeFastPerpResearchBatch(exported, path.join(root, 'work')); bridge.publishProposal(proposal);
  const lock = path.join(root, 'bridge', 'imports', `${proposal.id}.json.lock`);
  fs.mkdirSync(path.dirname(lock), { recursive: true }); fs.writeFileSync(lock, 'active');
  assert.throws(() => bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics,
    now: 700_001 }), /ALREADY_RUNNING/);
  fs.utimesSync(lock, new Date(0), new Date(0));
  assert.equal(bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics,
    now: 700_001 }).status, 'imported');
});
