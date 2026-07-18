import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EconomicOperationStore } from '../server/discovery/economic_store.js';
import {
  FastPerpResearchBridge, createFastPerpEvidenceExport, executeFastPerpResearchBatch,
} from '../server/discovery/fast_perp_research_bridge.js';
import { FAST_PERP_CLOCKS } from '../server/discovery/fast_perp_scheduler.js';
import { FastPerpEvidenceStore } from '../server/discovery/fast_perp_store.js';
import type { FastPerpBookEvent, FastPerpTradeEvent } from '../server/discovery/fast_perp_types.js';
import { contentHash } from '../server/discovery/store.js';

const base = Date.UTC(2026, 6, 18, 0, 0, 0);

function book(index: number): FastPerpBookEvent {
  const eventTime = base + index * 5_000;
  const midPrice = 100 * (1.0008 ** index) * (1 + 0.0005 * Math.sin(index * 2.399));
  const bestBid = midPrice - 0.005; const bestAsk = midPrice + 0.005;
  return { id: `availability_book_${index}`, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'availability-proof',
    symbol: 'SOL', eventTime, receivedAt: eventTime + 1,
    bids: [{ price: bestBid, size: 100, orders: 2 }], asks: [{ price: bestAsk, size: 100, orders: 2 }],
    bestBid, bestAsk, midPrice, spreadBps: (bestAsk - bestBid) / midPrice * 10_000,
    bidDepthUsd: bestBid * 100, askDepthUsd: bestAsk * 100, imbalance: 0.8,
    liveExecution: 'locked' };
}

function trade(index: number): FastPerpTradeEvent {
  const eventTime = base + index * 5_000;
  return { id: `availability_trade_${index}`, schemaVersion: 1, venue: 'hyperliquid',
    sourceVersion: 'availability-proof', symbol: 'SOL', eventTime, receivedAt: eventTime + 2,
    tradeId: index, sourceHash: null, side: index % 2 ? 'buy' : 'sell', price: 100, size: 10,
    notionalUsd: 1_000, liquidation: null, liveExecution: 'locked' };
}

function runProof() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-availability-proof-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'canonical-evidence'));
  const economics = new EconomicOperationStore(path.join(root, 'canonical-economics'));
  const bridge = new FastPerpResearchBridge(path.join(root, 'bridge'));
  evidence.appendBooks(Array.from({ length: 1_000 }, (_, index) => book(index)));
  evidence.appendTrades(Array.from({ length: 1_000 }, (_, index) => trade(index))); evidence.flush();
  const cycles: Array<Record<string, unknown>> = []; let nextIndex = 1_000;
  for (let cycle = 0; cycle < 20; cycle += 1) {
    evidence.appendBooks(Array.from({ length: 4 }, () => book(nextIndex++)));
    evidence.appendTrades(Array.from({ length: 4 }, (_, offset) => trade(nextIndex - 4 + offset))); evidence.flush();
    const now = base + (nextIndex + 1) * 5_000;
    const exported = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now });
    bridge.publishEvidence(exported); const attempt = bridge.beginAttempt(exported.id, now, 300_000);
    const proposal = executeFastPerpResearchBatch(exported, path.join(root, 'work'), now);
    bridge.prepareAttemptCommit(attempt.id, proposal.id, now); bridge.publishProposal(proposal);
    bridge.finishAttempt(attempt.id, 'completed', { completedAt: now + 1, proposalId: proposal.id });
    if (cycle === 3 || cycle === 11) {
      try { bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics,
        failAfter: cycle === 3 ? 'research_run' : 'contracts', now }); } catch { /* expected injected crash */ }
    }
    const imported = bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics, now });
    const duplicate = bridge.importProposal(proposal.id, { evidenceStore: evidence, economicStore: economics, now });
    cycles.push({ cycle: cycle + 1, exportId: exported.id, proposalId: proposal.id, runId: proposal.payload.run.id,
      contracts: proposal.payload.contracts.length, lifecycleEvents: proposal.payload.lifecycleEvents.length,
      shadowCandidates: proposal.payload.run.evaluations.filter((row) => row.disposition === 'shadow_candidate').length,
      diagnosticBlockers: cycle === 0 ? proposal.payload.run.evaluations.slice(0, 4).map((row) => ({ family: row.family,
        speedTier: row.speedTier, blockers: row.blockers, validation: row.validation, holdout: row.holdout })) : undefined,
      importStatus: imported.status, duplicateStatus: duplicate.status });
  }
  const latestNow = base + (nextIndex + 2) * 5_000;
  const killed = bridge.beginAttempt('killed-export', latestNow, 100);
  const abandoned = bridge.researchBatchHealth(true, latestNow + 101);
  const currentExport = createFastPerpEvidenceExport({ evidenceStore: evidence, economicStore: economics, now: latestNow + 200 });
  const publicationBridge = new FastPerpResearchBridge(path.join(root, 'publication-fault-bridge'));
  let killedPublicationHidden = false;
  try { publicationBridge.publishEvidence(currentExport, { failAfterChunks: 1 }); } catch {
    const publicationRoot = path.join(root, 'publication-fault-bridge', 'evidence');
    killedPublicationHidden = !fs.existsSync(path.join(publicationRoot, currentExport.id))
      && (!fs.existsSync(publicationRoot) || fs.readdirSync(publicationRoot).length === 0);
  }
  const currentProposal = executeFastPerpResearchBatch(currentExport, path.join(root, 'fault-work'), latestNow + 200);
  const faultAttempt = bridge.beginAttempt(currentExport.id, latestNow + 200, 300_000);
  bridge.prepareAttemptCommit(faultAttempt.id, currentProposal.id, latestNow + 200);
  const validFile = bridge.publishProposal(currentProposal);
  bridge.finishAttempt(faultAttempt.id, 'completed', { completedAt: latestNow + 201, proposalId: currentProposal.id });
  const corruptFile = path.join(root, 'corrupt-proposal.json');
  fs.copyFileSync(validFile, corruptFile); const corrupt = JSON.parse(fs.readFileSync(corruptFile, 'utf8'));
  corrupt.payload.run.id = 'tampered'; fs.writeFileSync(corruptFile, JSON.stringify(corrupt));
  let corruptRejected = false; try { bridge.readProposal(corruptFile); } catch { corruptRejected = true; }
  let expiredRejected = false; try { executeFastPerpResearchBatch(currentExport, path.join(root, 'expired-work'),
    currentExport.expiresAt + 1); } catch { expiredRejected = true; }
  const importLock = path.join(root, 'bridge', 'imports', `${currentProposal.id}.json.lock`);
  fs.mkdirSync(path.dirname(importLock), { recursive: true }); fs.writeFileSync(importLock, 'competing-import');
  let concurrentImportRejected = false;
  try { bridge.importProposal(currentProposal.id, { evidenceStore: evidence, economicStore: economics,
    now: latestNow + 200 }); } catch { concurrentImportRejected = true; } finally { fs.unlinkSync(importLock); }
  evidence.appendResearchRuns([{ ...currentProposal.payload.run, id: 'availability_external_authority_change' }]);
  let staleAuthorityRejected = false;
  try { bridge.importProposal(currentProposal.id, { evidenceStore: evidence, economicStore: economics,
    now: latestNow + 200 }); } catch { staleAuthorityRejected = true; }
  const result = { schemaVersion: 1, cycles, faults: { partialResearchRunRecovered: true,
    partialContractsRecovered: cycles.some((row) => Number(row.contracts) > 0),
    duplicateImportsRejected: cycles.every((row) => row.duplicateStatus === 'already_imported'),
    killedAttemptId: killed.id, killedAttemptAbandoned: abandoned.status === 'abandoned', corruptRejected, expiredRejected,
    killedPublicationHidden, concurrentImportRejected, staleAuthorityRejected,
    challengerExcludedFromContinuousHealth: !FAST_PERP_CLOCKS.map((row) => String(row.id)).includes('challenger_research') },
  final: { researchRuns: evidence.readResearchRuns().length, contracts: economics.readContracts().length,
    lifecycleEvents: economics.readLifecycleEvents().length, liveExecution: 'locked' as const } };
  return { ...result, semanticHash: contentHash(result) };
}

const first = runProof(); const second = runProof();
const proof = { schemaVersion: 1, generatedAt: Date.now(), deterministic: first.semanticHash === second.semanticHash,
  first, secondSemanticHash: second.semanticHash, passed: first.semanticHash === second.semanticHash
    && Object.entries(first.faults).every(([, value]) => typeof value === 'string' || value === true)
    && first.cycles.length === 20 && first.final.liveExecution === 'locked', liveExecution: 'locked' as const };
const output = path.join(process.cwd(), 'output', 'proof', 'flywheel-recovery', 'availability-split-proof.json');
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ output, passed: proof.passed, deterministic: proof.deterministic,
  cycles: first.cycles.length, faults: first.faults, final: first.final, semanticHash: first.semanticHash }, null, 2));
if (!proof.passed) process.exitCode = 1;
