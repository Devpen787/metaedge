import crypto from 'node:crypto';
import { readDatabase } from '../storage.js';
import {
  captureMarketObservationsOnce,
  configureRecorderUniverseV5,
  getHourlyEvidenceState,
  getHourlySeries,
} from '../recorder.js';
import { resolveUniverse } from '../opportunity/universe.js';
import { readLatestFunding } from '../opportunity/snapshot.js';
import { agentPosition } from '../trades.js';
import { getPriceObservation, registerResearchObservation } from '../prices.js';
import { placePaperTrade } from '../trades.js';
import { buildVersionedFeatures } from './features.js';
import { dailyIndicators } from './daily_features.js';
import { evaluateLayeredDecision } from './engine.js';
import { compileFrozenStrategy } from './specs.js';
import {
  STRATEGY_PLUGINS,
  gridDeviationV5,
  meanReversion24hV5,
  momentum24hV5,
  rsiMeanReversionV5,
} from './plugins.js';
import {
  decisionWasExecuted,
  latestValidation,
  markDecisionRouted,
  persistCycleSummary,
  persistDecision,
  persistDecisions,
  persistStrategySpec,
} from './store.js';
import type { DecisionContext, FrozenStrategySpec, LayeredDecision, StrategyPlugin, ValidationRecord } from './types.js';
import type { FeedRow } from '../opportunity/feed.js';
import type { TradingAgent } from '../../src/types.js';
import {
  activateUniverseVersionV5,
  coverageEntryV5,
  createUniverseVersionV5,
  persistCoverageMatrixV5,
} from '../market_data_v5.js';
import type { MarketCoverageEntryV5, MarketObservationV5 } from '../../src/types.js';
import { v5AuthorityFlags } from '../v5/authority.js';
import {
  buildOpportunityObservationV5,
  ensureExperimentPopulationV5,
  persistOpportunityObservationsV5,
  reconcileExperimentEligibilityV5,
  routeExperimentObservationV5,
  type RegisteredExperimentV5,
} from '../v5/experiments.js';
import { ensureExperimentTrialsV5 } from '../v5/outcomes.js';

const CYCLE_MS = Math.max(60_000, Number(process.env.DECISION_RUNTIME_INTERVAL_MS) || 5 * 60_000);
const STALE_BUDGET_MS = 5 * 60_000;
const PAPER_NOTIONAL_USD = 250;
// custom_ai is intentionally absent: its old mapping was the composite plugin,
// which was removed for trading a blended score. An agent with no honest
// mechanism routes nothing rather than trading theatre.
export const AGENT_STRATEGY_PLUGIN: Partial<Record<TradingAgent['strategyType'], StrategyPlugin>> = {
  rsi_meanrev: rsiMeanReversionV5,
  momentum: momentum24hV5,
  mean_reversion: meanReversion24hV5,
  grid: gridDeviationV5,
};

let running = false;

function source(
  provider: string,
  dataset: string,
  observedAt: number,
  retrievedAt: number,
  venue?: string,
  observation?: MarketObservationV5,
) {
  return {
    provider,
    dataset,
    observedAt,
    receivedAt: observation?.receivedAt,
    retrievedAt,
    venue,
    observationHash: observation?.observationHash,
  };
}

function buildContext(
  cycleId: string,
  row: FeedRow,
  observedAt: number,
  plugin: StrategyPlugin,
  universeStale: boolean,
  routing?: { ownerId: string; agent: TradingAgent },
): DecisionContext {
  const evaluatedAt = Date.now();
  const hourly = getHourlySeries(row.symbol);
  const hourlyEvidence = getHourlyEvidenceState(row.symbol);
  const funding = readLatestFunding(row.symbol);
  // Use one coherent source row for price/change/volume/range. A fresher venue
  // price may be used later by the broker, but it must not silently overwrite
  // only one field inside this research feature packet.
  const marketObservation = registerResearchObservation(row, observedAt, evaluatedAt);
  const price = marketObservation.price;
  const daily = plugin.instrument === 'spot'
    ? dailyIndicators(row.symbol, price, row.volume24h)
    : null;
  const position = routing
    ? agentPosition(routing.ownerId, routing.agent.id, row.symbol)
    : { size: 0, avgEntry: 0 };
  const holding = position.size > 0.000001;
  const openNotionalUsd = holding ? position.size * price : 0;
  // Research-only evaluations do not need user state. Reading the entire flat
  // database for every symbol/plugin pair pinned the event loop for ~1 minute.
  const ownerBalance = routing ? readDatabase().users[routing.ownerId]?.paperBalance || 0 : PAPER_NOTIONAL_USD;
  const features = buildVersionedFeatures({
    symbol: row.symbol,
    price,
    change24hPct: row.change24h,
    volume24hUsd: row.volume24h,
    high24h: row.high24h,
    low24h: row.low24h,
    hourlyCloses: hourly.map((point) => point.close),
    fundingHourly: funding.fundingHourly,
    openInterestUsd: funding.openInterestUsd,
    daily: daily ? {
      sma50: daily.sma50,
      sma200: daily.sma200,
      sma50Previous: daily.sma50Prev,
      sma200Previous: daily.sma200Prev,
      volume50AverageUsd: daily.vol50dAvg,
      return30dPct: daily.return30dPct,
      source: source(
        'metaedge',
        'daily_series_v5_with_named_bootstrap',
        daily.lastSettledAt,
        evaluatedAt,
        'recorded-spot',
      ),
      staleBudgetMs: 48 * 60 * 60_000,
    } : undefined,
    sources: {
      market: source(
        marketObservation.provider,
        marketObservation.dataset,
        marketObservation.observedAt,
        evaluatedAt,
        marketObservation.venue,
        marketObservation,
      ),
      history: {
        ...source(
          hourlyEvidence?.provider || 'metaedge',
          'recorder_hourly_closes',
          hourlyEvidence?.observedAt || hourly.at(-1)?.t || 0,
          evaluatedAt,
          hourlyEvidence?.venue || 'recorded-spot',
        ),
        receivedAt: hourlyEvidence?.receivedAt,
        observationHash: hourlyEvidence?.observationHash,
      },
      funding: source('hyperliquid', 'metaAndAssetCtxs', funding.fundingHourly == null ? 0 : funding.t, evaluatedAt, 'perp'),
    },
    staleBudgets: { market: STALE_BUDGET_MS, history: 90 * 60_000, funding: 90 * 60_000 },
  });

  return {
    cycleId: routing ? `${cycleId}:${routing.agent.id}` : cycleId,
    evaluatedAt,
    symbol: row.symbol,
    instrument: plugin.instrument,
    universe: {
      tier: 1,
      included: true,
      reason: 'criterion-selected research universe',
      observedAt,
      quality: universeStale ? 'stale' : observedAt ? 'good' : 'missing',
    },
    features,
    position: {
      holding,
      openNotionalUsd,
      averageEntryPrice: position.avgEntry,
      heldSince: routing?.agent.lastTradeAt,
    },
    limits: {
      liquidityFloorUsd: 50_000_000,
      staleBudgetMs: STALE_BUDGET_MS,
      modeledRoundTripCostBps: 20,
      maxRoundTripCostBps: 40,
      requestedNotionalUsd: PAPER_NOTIONAL_USD,
      riskBudgetUsd: routing ? Math.max(0, Math.min(PAPER_NOTIONAL_USD, ownerBalance - 100)) : PAPER_NOTIONAL_USD,
      portfolioOpenNotionalUsd: openNotionalUsd,
      portfolioMaxNotionalUsd: 2_500,
    },
    routing: routing ? { ownerId: routing.ownerId, agentId: routing.agent.id } : undefined,
  };
}

function evaluate(context: DecisionContext, plugin: StrategyPlugin, spec: FrozenStrategySpec, validation?: ValidationRecord): LayeredDecision {
  return evaluateLayeredDecision(context, plugin, spec, validation);
}

export function routePaperDecision(decision: LayeredDecision, context: DecisionContext): boolean {
  if (decision.outcome !== 'paper_trade_candidate' || !decision.signal || !context.routing) return false;
  if (decisionWasExecuted(decision.id)) return false;
  const db = readDatabase();
  const agent = db.agents[context.routing.agentId];
  if (!agent || agent.ownerId !== context.routing.ownerId || !agent.autopilot || agent.status !== 'active') return false;
  if (decision.signal.action !== 'buy' && decision.signal.action !== 'sell') return false;
  const price = Number(context.features['price.v5']?.value);
  if (!(price > 0)) return false;
  const position = agentPosition(agent.ownerId, agent.id, decision.symbol);
  const size = decision.signal.action === 'sell'
    ? position.size
    : Number((context.limits.requestedNotionalUsd / price).toFixed(6));
  if (!(size > 0)) return false;
  const result = placePaperTrade(agent.ownerId, {
    agentId: agent.id,
    assetSymbol: decision.symbol,
    side: decision.signal.action,
    size,
    price,
    nonce: `decision_${decision.id}`,
    thesis: {
      cardId: decision.pluginId,
      decisionId: decision.id,
      strategyHash: decision.strategyHash,
      signalFamily: decision.pluginId,
      setup: decision.signal.setup,
      trigger: decision.signal.trigger,
      invalidation: decision.signal.invalidation,
      regime: decision.signal.regime,
      benchmark: 'frozen_strategy_benchmark',
      holdingWindow: 'plugin-defined',
    },
  }, { action: 'LAYERED_PAPER_TRADE', detailsPrefix: `Layered decision ${decision.id} executed paper` });
  if (!result.ok || (!result.trade && !result.intent)) return false;
  markDecisionRouted(decision.id, result.trade?.id ?? result.intent!.intentId);
  return true;
}

export async function runDecisionCycle(): Promise<NonNullable<ReturnType<typeof readDatabase>['decisionRuntime']>['lastCycle']> {
  if (running) throw new Error('DECISION_CYCLE_OVERLAP');
  running = true;
  const startedAt = Date.now();
  const cycleId = `cycle_${crypto.createHash('sha256').update(String(startedAt)).digest('hex').slice(0, 16)}`;
  let evaluated = 0;
  let declines = 0;
  let hypotheses = 0;
  let paperCandidates = 0;
  let routed = 0;
  try {
    const resolved = await resolveUniverse(1, { allowStaleForDeclines: true });
    if (resolved.rows.length === 0) throw new Error('UNIVERSE_UNAVAILABLE');
    const universeVersion = activateUniverseVersionV5(
      createUniverseVersionV5(resolved.rows.map((row) => row.symbol), resolved.observedAt),
    );
    configureRecorderUniverseV5(universeVersion);
    // Capture immediately instead of waiting up to one minute after a new
    // universe becomes authoritative.
    captureMarketObservationsOnce();
    const rowsBySymbol = new Map(resolved.rows.map((row) => [row.symbol, row]));
    const researchDecisions: LayeredDecision[] = [];
    const opportunityObservations: ReturnType<typeof buildOpportunityObservationV5>[] = [];
    const experimentRoutes: Array<{
      registered: RegisteredExperimentV5;
      observation: ReturnType<typeof buildOpportunityObservationV5>;
      decision: LayeredDecision;
      context: DecisionContext;
    }> = [];
    const coverageByStrategySymbol = new Map<string, MarketCoverageEntryV5>();
    const experimentEntries = STRATEGY_PLUGINS.map((plugin) => ({
      plugin,
      strategy: persistStrategySpec(compileFrozenStrategy(plugin)),
    }));
    const registeredExperiments = ensureExperimentPopulationV5(experimentEntries);
    // Trial controls and the forward evidence cutoff must exist before any
    // observation can be admitted to the broker in this cycle.
    ensureExperimentTrialsV5(Date.now());
    const experimentByPlugin = new Map(registeredExperiments.map((item) => [item.spec.pluginId, item]));
    for (const { plugin, strategy: spec } of experimentEntries) {
      const registered = experimentByPlugin.get(plugin.id);
      if (!registered) throw new Error(`EXPERIMENT_REGISTRATION_MISSING:${plugin.id}`);
      const validation = latestValidation(spec.hash);
      for (const row of resolved.rows) {
        const context = buildContext(
          cycleId,
          row,
          resolved.observedAt,
          plugin,
          resolved.stale,
          registered.execution,
        );
        const coverage = coverageEntryV5({
          strategyHash: spec.hash,
          pluginId: plugin.id,
          symbol: row.symbol,
          requiredFeatures: plugin.requiredFeatures,
          features: context.features,
        });
        coverageByStrategySymbol.set(`${spec.hash}:${row.symbol}`, coverage);
        const decision = evaluate(context, plugin, spec, validation);
        const observation = buildOpportunityObservationV5(registered, decision, plugin, context);
        researchDecisions.push(decision);
        opportunityObservations.push(observation);
        if (decision.signal && decision.signal.action !== 'hold') {
          experimentRoutes.push({ registered, observation, decision, context });
        }
        evaluated++;
        if (decision.outcome === 'decline') declines++;
        else if (decision.outcome === 'research_hypothesis') hypotheses++;
        else paperCandidates++;
      }
    }
    persistDecisions(researchDecisions);
    persistOpportunityObservationsV5(opportunityObservations);
    reconcileExperimentEligibilityV5(opportunityObservations, Date.now());
    persistCoverageMatrixV5(universeVersion.universeId, [...coverageByStrategySymbol.values()]);
    // Free shared exposure first. A valid reduction is never queued behind a
    // new entry that could consume the capacity the reduction is releasing.
    experimentRoutes.sort((left, right) => {
      const rank = (candidate: typeof left) => {
        const position = agentPosition(
          candidate.registered.execution.ownerId,
          candidate.registered.execution.agent.id,
          candidate.decision.symbol,
        );
        const action = candidate.decision.signal?.action;
        const sign = action === 'buy' || action === 'long' ? 1 : -1;
        return position.signedSize !== 0 && Math.sign(position.signedSize) !== sign ? 0 : 1;
      };
      return rank(left) - rank(right);
    });
    for (const candidate of experimentRoutes) {
      const result = routeExperimentObservationV5(candidate);
      if (result.routed && result.intentId) {
        markDecisionRouted(candidate.decision.id, result.intentId);
        routed++;
      }
    }

    const db = readDatabase();
    const agents = Object.values(db.agents).filter((agent) => agent.autopilot && agent.status === 'active');
    for (const agent of agents) {
      const plugin = AGENT_STRATEGY_PLUGIN[agent.strategyType];
      const row = rowsBySymbol.get(agent.assetSymbol.toUpperCase());
      if (!plugin || !row) continue;
      const spec = persistStrategySpec(compileFrozenStrategy(plugin));
      const coverage = coverageByStrategySymbol.get(`${spec.hash}:${row.symbol}`);
      // Missing/stale evidence is a visible unarmed state in the coverage
      // matrix. It does not throw, poison cycle health, or endlessly request
      // features from a recorder that never captured this symbol.
      if (!coverage?.armed) continue;
      const context = buildContext(cycleId, row, resolved.observedAt, plugin, resolved.stale, { ownerId: agent.ownerId, agent });
      const decision = persistDecision(evaluate(context, plugin, spec, latestValidation(spec.hash)));
      evaluated++;
      if (decision.outcome === 'decline') declines++;
      else if (decision.outcome === 'research_hypothesis') hypotheses++;
      else {
        paperCandidates++;
        if (routePaperDecision(decision, context)) routed++;
      }
    }

    const summary = { cycleId, startedAt, completedAt: Date.now(), evaluated, declines, hypotheses, paperCandidates, routed };
    persistCycleSummary(summary);
    return summary;
  } catch (error: any) {
    const summary = { cycleId, startedAt, completedAt: Date.now(), evaluated, declines, hypotheses, paperCandidates, routed, error: error?.message || String(error) };
    persistCycleSummary(summary);
    return summary;
  } finally {
    running = false;
  }
}

export function startDecisionRuntime() {
  if (!v5AuthorityFlags().decisionWriterEnabled) {
    console.log('[decision-runtime-v5] canonical writer disabled via V5_DECISION_WRITER_ENABLED');
    return;
  }
  if (process.env.DECISION_RUNTIME_DISABLED === 'true') {
    console.log('[decision-runtime] disabled via DECISION_RUNTIME_DISABLED');
    return;
  }
  const run = () => runDecisionCycle()
    .then((summary) => console.log(`[decision-runtime] ${summary.cycleId}: evaluated=${summary.evaluated} declines=${summary.declines} hypotheses=${summary.hypotheses} candidates=${summary.paperCandidates} routed=${summary.routed}${summary.error ? ` error=${summary.error}` : ''}`))
    .catch((error) => console.warn('[decision-runtime] cycle failed:', error.message));
  setTimeout(run, 15_000).unref();
  setInterval(run, CYCLE_MS).unref();
  console.log(`[decision-runtime] running every ${Math.round(CYCLE_MS / 1000)}s — live-market decisions, paper routing only`);
}
