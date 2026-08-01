import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { readFactoryStatus, readOpportunityCards, readRelationships } from './store.js';
import { FlywheelLedger } from './flywheel_store.js';
import { controlPlaneSnapshot } from './control_cycle.js';
import { DataWorldStore } from './data_world_store.js';
import { WorldStore } from './world_store.js';
import { SignalResearchStore } from './signal_store.js';
import { LaneSignalStore } from './lane_signal_store.js';
import { CouncilStore } from './council_store.js';
import { ValidationStore } from './validation_store.js';
import { PortfolioOperationStore } from './portfolio_operation_store.js';
import { ForwardLearningStore } from './forward_learning_store.js';
import { LegacyV3OperatorSummaryStore, V5OperatorSummaryStore } from './operator_snapshot.js';
import { EconomicOperationStore } from './economic_store.js';
import { FastPerpEvidenceStore } from './fast_perp_store.js';
import { fastPerpRecorderStatus } from './fast_perp_recorder.js';
import { MetaMaskLiveReviewStore } from './metamask_live_review.js';
import { FAST_PERP_CLOCKS, enabledFastPerpClocks, evaluateFastPerpClockHeartbeat,
  recorderEvidenceIsOperational } from './fast_perp_scheduler.js';
import { FastPerpResearchBridge } from './fast_perp_research_bridge.js';
import type { OperatorHealth } from './fast_perp_types.js';
import { adaptLegacyArtifact } from '../v5/authority.js';

export const discoveryRouter = Router();
const operatorSummary = new V5OperatorSummaryStore();
const legacyV3OperatorSummary = new LegacyV3OperatorSummaryStore();

discoveryRouter.get('/api/opportunity-factory/status', (_req, res) => res.json(readFactoryStatus()));
discoveryRouter.get('/api/opportunity-factory/cards', (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
  res.json({ mode: 'Paper research', liveExecution: 'locked', cards: readOpportunityCards(limit) });
});
discoveryRouter.get('/api/opportunity-factory/relationships', (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
  res.json({ mode: 'Paper research', liveExecution: 'locked', relationships: readRelationships(limit) });
});
discoveryRouter.get('/api/opportunity-factory/flywheel', (_req, res) => res.json(new FlywheelLedger().snapshot()));
discoveryRouter.get('/api/opportunity-factory/control', (_req, res) => res.json(controlPlaneSnapshot()));
discoveryRouter.get('/api/opportunity-factory/data-world', (_req, res) => res.json(new DataWorldStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/world', (_req, res) => res.json(new WorldStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/signals', (_req, res) => res.json(new SignalResearchStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/lane-signals', (_req, res) => res.json(new LaneSignalStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/council', (_req, res) => res.json(new CouncilStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/validation', (_req, res) => res.json(new ValidationStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/portfolio-execution', (_req, res) => res.json(new PortfolioOperationStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/forward-learning', (_req, res) => res.json(new ForwardLearningStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/economics', (_req, res) => res.json(new EconomicOperationStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/fast-perps', (_req, res) => res.json({
  ...new FastPerpEvidenceStore().snapshot(), recorder: fastPerpRecorderStatus(),
}));
discoveryRouter.get('/api/opportunity-factory/fast-perps/evidence/:kind', (req, res) => {
  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : '';
  const fromReceivedAt = Number(req.query.from); const toReceivedAt = Number(req.query.to);
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
  if (!symbol || !Number.isFinite(fromReceivedAt) || !Number.isFinite(toReceivedAt) || toReceivedAt < fromReceivedAt) {
    res.status(400).json({ error: 'BOUNDED_SYMBOL_AND_TIME_RANGE_REQUIRED' }); return;
  }
  const store = new FastPerpEvidenceStore(); const query = { symbol, fromReceivedAt, toReceivedAt, limit };
  const rows = req.params.kind === 'trades' ? store.readTrades(query) : req.params.kind === 'books' ? store.readBooks(query)
    : req.params.kind === 'contexts' ? store.readContexts(query) : null;
  if (!rows) { res.status(404).json({ error: 'EVIDENCE_KIND_NOT_FOUND' }); return; }
  res.json({ mode: 'Paper money', kind: req.params.kind, symbol, fromReceivedAt, toReceivedAt, limit,
    count: rows.length, rows, liveExecution: 'locked' });
});
discoveryRouter.get('/api/opportunity-factory/live-review', (_req, res) => res.json(new MetaMaskLiveReviewStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/v5', (_req, res) => {
  const cached = operatorSummary.read();
  if (cached.snapshot.generatedAt == null) { res.status(503).json({ error: 'OPERATOR_SUMMARY_NOT_MATERIALIZED',
    stale: true, liveExecution: 'locked' }); return; }
  res.json({ ...cached.snapshot, stale: cached.stale, operatorSummaryAgeMs: cached.ageMs });
});
discoveryRouter.get('/api/opportunity-factory/v3', (_req, res) => {
  const legacy = legacyV3OperatorSummary.read();
  if (!legacy) { res.status(404).json({ error: 'LEGACY_V3_SNAPSHOT_NOT_FOUND', readOnly: true,
    routable: false, liveExecution: 'locked' }); return; }
  res.json(adaptLegacyArtifact(legacy, 'v3'));
});
discoveryRouter.get('/api/opportunity-factory/health', (_req, res) => {
  const now = Date.now(); const cached = operatorSummary.read(now); const enabled = new Set(enabledFastPerpClocks());
  const heartbeatRoot = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'heartbeats');
  const clocks = FAST_PERP_CLOCKS.filter((clock) => enabled.has(clock.id)).map((clock) => {
    try {
      const heartbeat = JSON.parse(fs.readFileSync(path.join(heartbeatRoot, `${clock.id}.json`), 'utf8'));
      return evaluateFastPerpClockHeartbeat(clock, heartbeat, now);
    } catch { return { id: clock.id, cadenceMs: clock.cadenceMs, ageMs: null, queueDepth: null,
      queueLagMs: null, fresh: false, bounded: false, status: 'missing' as const }; }
  });
  const evidence = new FastPerpEvidenceStore().snapshot(now); const recorder = fastPerpRecorderStatus();
  const recorderRequired = process.env.FAST_PERP_RECORDER_ENABLED === 'true';
  const recorderHealthy = recorderEvidenceIsOperational({ required: recorderRequired, running: recorder.running,
    connected: recorder.connected, evidenceCurrent: evidence.freshness.current });
  const liveLocked = cached.snapshot.liveExecution === 'locked'
    && cached.snapshot.integrity?.allLiveExecutionLocked === true;
  const pauseRoot = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'pauses');
  let storage = { sampledAt: 0, diskGrowthBytesPerDay: null as number | null, healthy: false };
  try { storage = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator',
    'storage-health.json'), 'utf8')); } catch { /* materializer has not run yet */ }
  const storageHealthy = !fs.existsSync(path.join(pauseRoot, 'global.json')) && storage.healthy
    && now - Number(storage.sampledAt) <= 30_000;
  const economicCounts = cached.snapshot.economics?.counts ?? {};
  const unresolvedDecisions = Number(economicCounts.expiredOpenDecisions ?? 0);
  const unresolvedOutcomes = Number(economicCounts.unresolvedOutcomes ?? 0);
  const queueLagMs = Math.max(0, ...clocks.map((clock) => Number(clock.queueLagMs ?? 0)));
  const operational = process.env.FAST_PERP_OPERATION_ENABLED === 'true' && clocks.length > 0
    && clocks.every((clock) => clock.fresh && clock.bounded && clock.status === 'healthy') && recorderHealthy
    && !cached.stale && evidence.integrity.allLiveExecutionLocked && liveLocked && storageHealthy;
  const researchBatch = new FastPerpResearchBridge().researchBatchHealth(
    process.env.FAST_PERP_RESEARCH_ENABLED === 'true', now);
  const health: OperatorHealth = { schemaVersion: 1, generatedAt: now, operational, status: operational ? 'operational'
    : process.env.FAST_PERP_OPERATION_ENABLED === 'true' ? 'degraded' : 'disabled', recorder,
    eventAgeMs: evidence.freshness.newestEventAgeMs, apiSummaryAgeMs: cached.ageMs, apiSummaryStale: cached.stale,
    queueLagMs, diskGrowthBytesPerDay: storage.diskGrowthBytesPerDay,
    contractChurn: Number(economicCounts.contractsCreatedLast24h ?? 0), unresolvedDecisions, unresolvedOutcomes,
    storageHealthy, clocks, researchBatch, currentLiveLock: liveLocked,
    liveExecution: liveLocked ? 'locked' : 'enabled' };
  res.json(health);
});
