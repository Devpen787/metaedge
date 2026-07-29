import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPaperTradeContract, evaluatePaperKillRule, evaluatePaperLifecycle } from '../server/discovery/economic_runtime.js';
import { EconomicOperationStore } from '../server/discovery/economic_store.js';
import { FastPerpEvidenceStore } from '../server/discovery/fast_perp_store.js';
import { commitFastForwardDecisions, resolveFastForwardOutcomes } from '../server/discovery/fast_shadow_runtime.js';
import { contentHash } from '../server/discovery/store.js';
import type { FastPerpBookEvent } from '../server/discovery/fast_perp_types.js';
import type { FastPerpResearchRun } from '../server/discovery/fast_perp_research_types.js';

const archive = path.join(process.cwd(), 'data', 'archive', 'flywheel-v3-runaway-2026-07-16',
  'fast-perps-legacy', 'books-2026-07-16.jsonl');
const proofRoot = path.join(process.cwd(), 'output', 'proof', 'flywheel-recovery');
fs.mkdirSync(proofRoot, { recursive: true });

function digest(value: unknown): string { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function archivedBooks(): FastPerpBookEvent[] {
  const parsed = fs.readFileSync(archive, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { const row = JSON.parse(line) as FastPerpBookEvent; return row.symbol === 'SOL' ? [row] : []; } catch { return []; }
  }).sort((left, right) => left.receivedAt - right.receivedAt);
  const first = parsed[0]?.eventTime ?? 0; const base = 1_000_000;
  return parsed.map((row) => {
    const eventTime = base + Math.round((row.eventTime - first) / 10);
    const receivedAt = Math.max(eventTime, base + Math.round((row.receivedAt - first) / 10));
    const identity = { archivedId: row.id, eventTime, receivedAt, replaySpeed: 10 };
    return { ...row, id: `canary_book_${contentHash(identity).slice(0, 20)}`, sourceVersion: 'archived-canary-10x',
      eventTime, receivedAt, liveExecution: 'locked' };
  });
}

function runOnce(root: string) {
  const evidence = new FastPerpEvidenceStore(path.join(root, 'evidence'), { flushIntervalMs: 60_000 });
  const economics = new EconomicOperationStore(path.join(root, 'economics')); const books = archivedBooks();
  evidence.appendBooks(books); evidence.flush(); const cutoff = books[0].receivedAt - 1;
  const contract = buildPaperTradeContract({ candidateId: 'canary-evaluation', strategyFamilyId: 'book_imbalance_continuation:microstructure',
    lane: 'perpetuals', speedTier: 'microstructure', mechanism: 'archived L2 imbalance canary',
    trigger: 'book_imbalance_continuation:{"horizonMs":1000,"lookbackMs":0,"threshold":0.2}', instrument: 'SOL-PERP',
    venue: 'hyperliquid', side: 'both', executionPolicy: 'taker_market', decisionAt: cutoff, evidenceCutoffAt: cutoff,
    edgeHalfLifeMs: 1_000, entryRule: 'canary forward trigger', exitRule: 'one replay second', expiresAt: cutoff + 1_000,
    predictedGrossEdgeBps: 20, costs: { feeBps: 3.5, spreadBps: 0, slippageBps: 1, impactBps: 1,
      fundingBps: 0, borrowBps: 0, adverseSelectionBps: 1, latencyBps: 1 }, uncertaintyBufferBps: 2,
    confidence: { confidenceLevel: 0.95, predictedWinProbability: 0.6, lowerBoundNetEdgeBps: 4,
      independentHistoricalSamples: 500, untouchedForwardSamples: 0, fundedPaperSamples: 0 },
    capacity: { requestedPaperUsd: 50, deployableUsd: 1_000, participationRate: 0.01 }, opportunitiesPerDay: 100,
    maximumExistingCorrelation: 0, tailRiskPenaltyUsdPerDay: 0.1, drawdownPenaltyUsdPerDay: 0.1,
    riskLimits: { maximumPositionUsd: 50, maximumLossPerTradeUsd: 5, maximumStrategyDrawdownUsd: 100,
      maximumGrossExposureUsd: 100, maximumConsecutiveLosses: 8 }, provenance: { datasetVersionId: 'archived-canary-dataset',
      universeVersionId: 'archived-canary-universe', worldContractId: 'archived-canary-world', sourceEventIds: [books[0].id],
      signalArtifactIds: ['canary-evaluation'], validationEvaluationIds: [], sourceVenue: 'hyperliquid',
      sourceVersion: 'archived-canary-10x' }, killRule: { maximumForwardLossBps: 40, maximumDrawdownUsd: 100,
      maximumConsecutiveLosses: 8, minimumForwardNetEdgeBps: 0, minimumForwardFillRate: 0.4,
      action: 'kill_and_research', immutable: true }, createdAt: cutoff });
  economics.appendContracts([contract]);
  const declinedLifecycle = evaluatePaperLifecycle({ contract, currentState: 'research_candidate',
    requestedState: 'shadow_paper', evidence: { historicalSamples: 0, untouchedForwardSamples: 0, fundedPaperSamples: 0,
      forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
      realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null, maximumDrawdownUsd: 0,
      consecutiveLosses: 0, sourceObservationIds: [books[0].id] }, evaluatedAt: cutoff - 1 });
  const passedLifecycle = evaluatePaperLifecycle({ contract, currentState: 'research_candidate',
    requestedState: 'shadow_paper', evidence: { historicalSamples: 500, untouchedForwardSamples: 0, fundedPaperSamples: 0,
      forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
      realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null, maximumDrawdownUsd: 0,
      consecutiveLosses: 0, sourceObservationIds: [books[0].id] }, evaluatedAt: cutoff });
  economics.appendLifecycleEvents([passedLifecycle]);
  const evaluation = { id: 'canary-evaluation', schemaVersion: 1 as const, symbol: 'SOL',
    family: 'book_imbalance_continuation' as const, speedTier: 'microstructure' as const,
    selectedParameters: { horizonMs: 1_000, lookbackMs: 0, threshold: 0.2 }, declaredTrials: 2_800,
    training: { samples: 0, meanGrossReturnBps: null, meanNetReturnBps: null, lowerBoundNetEdgeBps: null, winRate: null },
    validation: { samples: 0, meanGrossReturnBps: null, meanNetReturnBps: null, lowerBoundNetEdgeBps: null, winRate: null },
    holdout: { samples: 0, meanGrossReturnBps: null, meanNetReturnBps: null, lowerBoundNetEdgeBps: null, winRate: null },
    independentSamples: 0, opportunitiesPerDay: 0, estimatedCapacityUsd: 1_000, disposition: 'insufficient' as const,
    blockers: ['CANARY_ONLY'], sourceEventIds: [books[0].id], evidenceCutoffAt: cutoff, liveExecution: 'locked' as const };
  const research: FastPerpResearchRun = { id: 'canary-research', schemaVersion: 1, sourceVersion: 'archived-canary-10x',
    researchPolicyVersion: 'recovery-canary-v1', evidenceFingerprint: digest(books.map((row) => row.id)),
    datasetVersionId: 'archived-canary-dataset', universeVersionId: 'archived-canary-universe',
    worldContractId: 'archived-canary-world', createdAt: cutoff, symbols: ['SOL'], speedTiers: ['microstructure'],
    declaredTrials: 2_800, evaluations: [evaluation], candidateContractIds: [contract.id], shadowContractIds: [contract.id],
    missingMechanismBlockers: [], datasetManifest: { tradeCount: 0, bookCount: books.length, contextCount: 0,
      sampleDigest: digest(books.map((row) => row.id)) }, liveExecution: 'locked' };
  evidence.appendResearchRuns([research]);
  for (const book of books) {
    commitFastForwardDecisions({ evidenceStore: evidence, economicStore: economics, now: book.receivedAt, evidenceMode: 'canary' });
    resolveFastForwardOutcomes({ evidenceStore: evidence, economicStore: economics, now: book.receivedAt });
  }
  const finalNow = books.at(-1)!.receivedAt + 5_000;
  resolveFastForwardOutcomes({ evidenceStore: evidence, economicStore: economics, now: finalNow });
  const decisionsBeforeRestart = economics.readShadowDecisions(); const outcomesBeforeRestart = economics.readShadowOutcomes();
  fs.appendFileSync(path.join(root, 'economics', 'shadow-decisions.jsonl'), '{malformed-recovery-canary\n');
  const restarted = new EconomicOperationStore(path.join(root, 'economics'));
  const decisions = restarted.readShadowDecisions(); const outcomes = restarted.readShadowOutcomes();
  if (decisions.length < 100 || outcomes.length < 100) throw new Error(`CANARY_SUPPORT_TOO_LOW:${decisions.length}:${outcomes.length}`);
  if (decisions.length !== decisionsBeforeRestart.length || outcomes.length !== outcomesBeforeRestart.length) throw new Error('RESTART_LOST_EVIDENCE');
  if (outcomes.some((row) => row.promotable)) throw new Error('CANARY_ENTERED_PROMOTABLE_LEDGER');
  if (decisions.some((decision) => outcomes.filter((row) => row.decisionId === decision.id)
    .some((row) => row.sourceEventIds.filter((id) => !decision.sourceSignalEventIds.includes(id))
      .some((id) => (books.find((book) => book.id === id)?.receivedAt ?? 0) <= decision.recordedAt)))) {
    throw new Error('OUTCOME_DID_NOT_FOLLOW_DECISION');
  }
  const kill = evaluatePaperKillRule({ contract, evidence: { historicalSamples: 500, untouchedForwardSamples: 0,
    fundedPaperSamples: 0, forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null,
    worstNetReturnBps: -100, realizedNetPnlUsd: -1, fillRate: 0, costCalibrationErrorFraction: null,
    maximumDrawdownUsd: 101, consecutiveLosses: 8, sourceObservationIds: outcomes.slice(0, 10).map((row) => row.id) },
    evaluatedAt: finalNow });
  economics.appendKillEvents([kill]);
  const malformedRowRecovered = fs.existsSync(path.join(root, 'economics', 'quarantine', 'malformed-jsonl.jsonl'));
  if (!malformedRowRecovered) throw new Error('MALFORMED_ROW_RECOVERY_NOT_EXERCISED');
  const paths = { lifecyclePass: passedLifecycle.passed, lifecycleDecline: !declinedLifecycle.passed,
    filled: outcomes.some((row) => row.status === 'filled'), unresolved: outcomes.some((row) => row.status === 'unresolved'),
    riskRejected: outcomes.some((row) => row.status === 'risk_rejected'), killTriggered: kill.triggered,
    restartPreserved: true, malformedRowRecovered };
  if (Object.values(paths).some((value) => !value)) throw new Error(`REPLAY_PATH_NOT_EXERCISED:${JSON.stringify(paths)}`);
  const canonical = { decisions, outcomes, declinedLifecycle, passedLifecycle, kill, counts: restarted.snapshot().counts };
  return { canonical, hash: digest(canonical), decisions: decisions.length, outcomes: outcomes.length,
    statuses: outcomes.reduce<Record<string, number>>((counts, row) => { counts[row.status] = (counts[row.status] ?? 0) + 1; return counts; }, {}),
    promotable: outcomes.filter((row) => row.promotable).length, restartPreserved: true, paths };
}

const rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-replay-a-'));
const rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-replay-b-'));
const first = runOnce(rootA); const second = runOnce(rootB);
if (first.hash !== second.hash) throw new Error(`NON_DETERMINISTIC_REPLAY:${first.hash}:${second.hash}`);
const proof = { schemaVersion: 1, generatedAt: Date.now(), archive, archiveSha256: crypto.createHash('sha256')
  .update(fs.readFileSync(archive)).digest('hex'), replaySpeed: 10, evidenceMode: 'canary', first: { ...first, canonical: undefined },
  secondHash: second.hash, deterministic: true, allLiveExecutionLocked: true };
const proofFile = path.join(proofRoot, 'deterministic-replay.json'); fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ proofFile, ...proof }, null, 2));
