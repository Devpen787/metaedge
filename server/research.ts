import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { readDatabase } from './storage.js';
import { decisionRuntimeSnapshot } from './decision/store.js';
import { experimentPopulationSnapshotV5 } from './v5/experiments.js';
import { experimentLearningSnapshotV5 } from './v5/outcomes.js';
import { portfolioAllocatorSnapshotV5 } from './v5/portfolio.js';
import { populationOperationSnapshotV5 } from './v5/population.js';
import { operatorTruthSnapshotV5 } from './v5/operator_truth.js';

export const researchRouter = Router();

researchRouter.get('/api/decision-runtime', (req: any, res) => {
  res.json(decisionRuntimeSnapshot(req.userId));
});

function researchTradeFamily(trade: any, agents: Record<string, any>): string | null {
  const explicit = trade.thesis?.signalFamily;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();

  // The Golden Cross book predates signalFamily tagging. Derive its provenance
  // from the canonical system agent so its existing fills appear beside the
  // other research trades without rewriting the immutable paper ledger.
  if (trade.agentId === 'gc_book' || agents[trade.agentId]?.strategyType === 'golden_cross') {
    return 'golden_cross';
  }
  return null;
}

export function buildResearchFleetTradeView(db: ReturnType<typeof readDatabase>) {
  const portfolio = portfolioAllocatorSnapshotV5();
  const tagged = db.trades
    .map((trade: any) => ({ trade, family: researchTradeFamily(trade, db.agents) }))
    .filter((entry): entry is { trade: any; family: string } => Boolean(entry.family));

  const fams: Record<string, any> = {};
  for (const { trade, family } of tagged) {
    const key = trade.experimentId || family;
    const f = (fams[key] ||= {
      key,
      family,
      label: trade.experimentLabel || family,
      experimentId: trade.experimentId || null,
      cardId: trade.thesis?.cardId || null,
      trades: 0, closed: 0, wins: 0, realizedPnl: 0, lastTradeAt: 0, lastTrigger: '',
      authorityVersion: trade.experimentId ? 5 : null,
      legacy: !trade.experimentId,
    });
    f.trades++;
    if (typeof trade.pnl === 'number') {
      f.closed++;
      f.realizedPnl += trade.pnl;
      if (trade.pnl > 0) f.wins++;
    }
    if (trade.timestamp > f.lastTradeAt) {
      f.lastTradeAt = trade.timestamp;
      f.lastTrigger = trade.thesis?.trigger || '';
      f.cardId = trade.thesis?.cardId || f.cardId;
    }
  }
  const experimentRegistry = db.experimentsV5;
  for (const spec of Object.values(experimentRegistry?.specs || {})) {
    const state = experimentRegistry?.states[spec.experimentId];
    const budget = experimentRegistry?.budgets[spec.experimentId];
    const f = (fams[spec.experimentId] ||= {
      key: spec.experimentId,
      family: spec.family,
      label: spec.label,
      experimentId: spec.experimentId,
      cardId: spec.pluginId,
      trades: 0,
      closed: 0,
      wins: 0,
      realizedPnl: 0,
      lastTradeAt: 0,
      lastTrigger: '',
      authorityVersion: 5,
      legacy: false,
    });
    f.lifecycleState = state?.lifecycleState || spec.initialLifecycleState;
    f.lifecycleReason = state?.lifecycleReason || 'FROZEN_EXPERIMENT_REGISTERED';
    f.permission = state?.permission || spec.initialPermission;
    f.eligibility = state?.eligibility || 'unknown';
    f.health = state?.health || 'healthy';
    f.strategyHash = spec.strategyHash;
    f.specHash = spec.specHash;
    f.pluginId = spec.pluginId;
    f.instrument = spec.instrument;
    f.version = spec.version;
    f.parentExperimentId = spec.parentExperimentId || null;
    f.budget = budget ? {
      admittedNotionalUsd: budget.admittedNotionalUsd,
      maximumNotionalUsd: budget.maximumNotionalUsd,
      admittedOrders: budget.admittedOrders,
      maximumOrders: budget.maximumOrders,
    } : null;
    const trial = Object.values(db.experimentLearningV5?.trials || {})
      .find((item) => item.experimentId === spec.experimentId);
    const assessment = trial ? db.experimentLearningV5?.assessments[trial.trialId] : undefined;
    f.learning = assessment ? {
      trialId: assessment.trialId,
      disposition: assessment.disposition,
      promotable: assessment.promotable,
      validOutcomes: assessment.validOutcomeCount,
      invalidOutcomes: assessment.invalidOutcomeCount,
      quarantinedOutcomes: assessment.quarantinedOutcomeCount,
      independentEpisodes: assessment.independentEpisodeCount,
      declaredFamilyTrials: assessment.declaredFamilyTrials,
      meanEvidenceNetBps: assessment.meanEvidenceNetBps,
      meanBenchmarkRelativeBps: assessment.meanBenchmarkRelativeBps,
      lowerConfidenceNoTradeRelativeBps: assessment.lowerConfidenceNoTradeRelativeBps,
      cumulativeEvidencePnlUsd: assessment.cumulativeEvidencePnlUsd,
      continuousBuyHoldControlPnlUsd: assessment.continuousBuyHoldControlPnlUsd,
      reasons: assessment.reasons,
    } : null;
    const reservations = portfolio.reservations.filter((item) => item.experimentId === spec.experimentId);
    const exposure = portfolio.risk.exposures.filter((item) => item.experimentId === spec.experimentId);
    f.portfolio = {
      grossExposureUsd: Number(exposure.reduce((sum, item) => sum + item.grossNotionalUsd, 0).toFixed(2)),
      netExposureUsd: Number(exposure.reduce((sum, item) => sum + item.signedNotionalUsd, 0).toFixed(2)),
      pendingExposureUsd: Number(exposure.filter((item) => item.source === 'pending')
        .reduce((sum, item) => sum + item.grossNotionalUsd, 0).toFixed(2)),
      activeReservations: reservations.filter((item) => item.status === 'reserved' || item.status === 'bound').length,
      deniedReservations: reservations.filter((item) => item.status === 'denied').length,
      lastAllocationReasons: reservations[0]?.reasons || [],
      liveExecution: 'locked',
    };
    const opportunities = (experimentRegistry?.observations || [])
      .filter((item) => item.experimentId === spec.experimentId)
      .sort((left, right) => right.evaluatedAt - left.evaluatedAt);
    const intents = Object.values(db.orderIntentsV5 || {})
      .filter((item) => item.experimentId === spec.experimentId)
      .sort((left, right) => right.createdAt - left.createdAt);
    const outcomes = Object.values(db.experimentLearningV5?.outcomes || {})
      .filter((item) => item.experimentId === spec.experimentId)
      .sort((left, right) => right.resolvedAt - left.resolvedAt);
    const latestOpportunity = opportunities[0];
    const latestIntent = intents[0];
    const activeStatuses = new Set(['PENDING', 'RISK_ACCEPTED', 'BROKER_PENDING', 'PARTIALLY_FILLED', 'UNRESOLVED']);
    f.regime = latestOpportunity?.regime || 'not_observed';
    f.lastOpportunity = latestOpportunity ? {
      observationId: latestOpportunity.observationId,
      disposition: latestOpportunity.disposition,
      reasons: latestOpportunity.reasons,
      evaluatedAt: latestOpportunity.evaluatedAt,
    } : null;
    f.orders = {
      total: intents.length,
      active: intents.filter((item) => activeStatuses.has(item.status)).length,
      unresolved: intents.filter((item) => item.status === 'UNRESOLVED').length,
      latestStatus: latestIntent?.status || 'none',
      latestIntentId: latestIntent?.intentId || null,
      latestReason: latestIntent?.failureReason || latestIntent?.noTradeReason || null,
    };
    f.lineage = {
      experimentId: spec.experimentId,
      strategyHash: spec.strategyHash,
      specHash: spec.specHash,
      trialId: trial?.trialId || null,
      parentExperimentId: spec.parentExperimentId || null,
      opportunityObservationIds: opportunities.slice(0, 5).map((item) => item.observationId),
      reservationIds: reservations.slice(0, 5).map((item) => item.reservationId),
      orderIntentIds: intents.slice(0, 5).map((item) => item.intentId),
      fillIds: intents.flatMap((item) => item.fillIds || []).slice(0, 10),
      outcomeIds: outcomes.slice(0, 5).map((item) => item.outcomeId),
    };
    f.outcomes = outcomes.slice(0, 5).map((item) => ({
      outcomeId: item.outcomeId,
      symbol: item.symbol,
      classification: item.classification,
      operationalStatus: item.operationalStatus,
      evidencePostCostPnlUsd: item.evidencePostCostPnlUsd,
      resolvedAt: item.resolvedAt,
      reasons: item.reasons,
    }));
  }

  const recent = [...tagged]
    .sort((a, b) => b.trade.timestamp - a.trade.timestamp)
    .slice(0, 20)
    .map(({ trade, family }) => {
      const variant = family === 'golden_cross' && ['strict', 'participate'].includes(trade.thesis?.regime)
        ? trade.thesis.regime
        : null;
      return {
        id: trade.id,
        t: trade.timestamp,
        family,
        label: trade.experimentLabel || family,
        experimentId: trade.experimentId || null,
        variant,
        paperPermission: trade.paperPermission || null,
        authorityVersion: trade.experimentId ? 5 : null,
        legacy: !trade.experimentId,
        side: trade.side,
        size: trade.size,
        symbol: trade.assetSymbol,
        price: trade.price,
        pnl: typeof trade.pnl === 'number' ? trade.pnl : null,
        trigger: trade.thesis?.trigger || '',
        setup: trade.thesis?.setup || ''
      };
    });

  const metrics = (rows: typeof tagged) => ({
    trades: rows.length,
    closed: rows.filter(({ trade }) => typeof trade.pnl === 'number').length,
    realizedPnl: Number(rows.reduce((sum, { trade }) =>
      sum + (typeof trade.pnl === 'number' ? trade.pnl : 0), 0).toFixed(2)),
  });
  const v5Tagged = tagged.filter(({ trade }) => Boolean(trade.experimentId));
  const legacyTagged = tagged.filter(({ trade }) => !trade.experimentId);
  return {
    families: Object.values(fams).sort((a: any, b: any) => b.trades - a.trades),
    recent,
    totals: metrics(tagged),
    v5Totals: metrics(v5Tagged),
    legacyTotals: metrics(legacyTagged),
  };
}

// Read-only window into the edge factory: every thesis-tagged trade grouped by
// signal family, plus the declined-opportunity counters. Transparency is the
// product here — the fleet's wins, losses, and restraint are all shown as-is.
researchRouter.get('/api/research-fleet', (_req, res) => {
  const db = readDatabase();
  const tradeView = buildResearchFleetTradeView(db);

  // Declined counters (last 7 days) — restraint is evidence too.
  const declined: Record<string, number> = {};
  try {
    const daily = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'edgeops', 'declined-daily.json'), 'utf8'));
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    for (const [k, n] of Object.entries(daily)) {
      const [date, , family, reason] = k.split('|');
      if (date >= cutoff) declined[`${family}|${reason}`] = (declined[`${family}|${reason}`] || 0) + (n as number);
    }
  } catch { /* no counters yet */ }

  res.json({
    declined,
    experimentPopulation: experimentPopulationSnapshotV5(),
    experimentLearning: experimentLearningSnapshotV5(),
    portfolioAllocator: portfolioAllocatorSnapshotV5(),
    operatorTruth: operatorTruthSnapshotV5(),
    ...tradeView
  });
});

researchRouter.get('/api/experiments-v5', (_req, res) => {
  res.json(experimentPopulationSnapshotV5());
});

researchRouter.get('/api/experiment-outcomes-v5', (_req, res) => {
  res.json(experimentLearningSnapshotV5());
});

researchRouter.get('/api/portfolio-allocator-v5', (_req, res) => {
  res.json(portfolioAllocatorSnapshotV5());
});

researchRouter.get('/api/population-operation-v5', (_req, res) => {
  res.json(populationOperationSnapshotV5());
});

export function verifyResearchFleetLedgerParityV5(db: ReturnType<typeof readDatabase>) {
  const view = buildResearchFleetTradeView(db);
  const experimentIds = new Set(Object.keys(db.experimentsV5?.specs || {}));
  const familyIds = new Set(view.families.filter((family: any) => !family.legacy).map((family: any) => family.experimentId));
  const v5Trades = db.trades.filter((trade) => trade.experimentId);
  const visibleV5Trades = view.recent.filter((trade: any) => !trade.legacy);
  const reasons: string[] = [];
  if ([...experimentIds].some((id) => !familyIds.has(id))) reasons.push('REGISTERED_EXPERIMENT_MISSING_FROM_FLEET');
  if (view.v5Totals.trades !== v5Trades.length) reasons.push('V5_TRADE_TOTAL_MISMATCH');
  if (visibleV5Trades.some((trade: any) => !trade.experimentId)) reasons.push('LEGACY_TRADE_IN_V5_RECENT_VIEW');
  return { verified: reasons.length === 0, reasons, registeredExperiments: experimentIds.size, visibleV5Families: familyIds.size,
    v5LedgerTrades: v5Trades.length, v5MetricTrades: view.v5Totals.trades, recentWindowV5Trades: visibleV5Trades.length };
}
