import crypto from 'node:crypto';
import { readDatabase } from '../storage.js';
import { getHourlySeries } from '../recorder.js';
import { resolveUniverse } from '../opportunity/universe.js';
import { readLatestFunding } from '../opportunity/snapshot.js';
import { agentPosition } from '../trades.js';
import { getPriceFeedState, getSpotPrice } from '../prices.js';
import { placePaperTrade } from '../trades.js';
import { buildVersionedFeatures } from './features.js';
import { evaluateLayeredDecision } from './engine.js';
import { compileFrozenStrategy } from './specs.js';
import {
  STRATEGY_PLUGINS,
  gridDeviationV1,
  meanReversion24hV1,
  momentum24hV1,
  rsiMeanReversionV1,
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

const CYCLE_MS = Math.max(60_000, Number(process.env.DECISION_RUNTIME_INTERVAL_MS) || 5 * 60_000);
const STALE_BUDGET_MS = 5 * 60_000;
const PAPER_NOTIONAL_USD = 250;
// custom_ai is intentionally absent: its old mapping was the composite plugin,
// which was removed for trading a blended score. An agent with no honest
// mechanism routes nothing rather than trading theatre.
const AGENT_STRATEGY_PLUGIN: Partial<Record<TradingAgent['strategyType'], StrategyPlugin>> = {
  rsi_meanrev: rsiMeanReversionV1,
  momentum: momentum24hV1,
  mean_reversion: meanReversion24hV1,
  grid: gridDeviationV1,
};

let running = false;

function source(provider: string, dataset: string, observedAt: number, retrievedAt: number, venue?: string) {
  return { provider, dataset, observedAt, retrievedAt, venue };
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
  const funding = readLatestFunding(row.symbol);
  const priceFeed = getPriceFeedState();
  const livePrice = getSpotPrice(row.symbol);
  const price = livePrice ?? row.price;
  const position = routing
    ? agentPosition(routing.ownerId, routing.agent.id, row.symbol)
    : { size: 0, avgEntry: 0 };
  const holding = position.size > 0.000001;
  const openNotionalUsd = holding ? position.size * price : 0;
  // Research-only evaluations do not need user state. Reading the entire flat
  // database for every symbol/plugin pair pinned the event loop for ~1 minute.
  const ownerBalance = routing ? readDatabase().users[routing.ownerId]?.paperBalance || 0 : PAPER_NOTIONAL_USD;
  const marketObservedAt = livePrice != null && priceFeed.observedAt ? priceFeed.observedAt : observedAt;
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
    sources: {
      market: source(livePrice != null ? priceFeed.source : 'coingecko', 'market_snapshot', marketObservedAt, evaluatedAt, 'spot'),
      history: source('metaedge', 'recorder_hourly_closes', hourly.at(-1)?.t || 0, evaluatedAt, 'spot'),
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
  const price = Number(context.features['price.v1']?.value);
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
  if (!result.ok || !result.trade) return false;
  markDecisionRouted(decision.id, result.trade.id);
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
    const rowsBySymbol = new Map(resolved.rows.map((row) => [row.symbol, row]));
    const researchDecisions: LayeredDecision[] = [];
    for (const plugin of STRATEGY_PLUGINS) {
      const spec = persistStrategySpec(compileFrozenStrategy(plugin));
      const validation = latestValidation(spec.hash);
      for (const row of resolved.rows) {
        const decision = evaluate(buildContext(cycleId, row, resolved.observedAt, plugin, resolved.stale), plugin, spec, validation);
        researchDecisions.push(decision);
        evaluated++;
        if (decision.outcome === 'decline') declines++;
        else if (decision.outcome === 'research_hypothesis') hypotheses++;
        else paperCandidates++;
      }
    }
    persistDecisions(researchDecisions);

    const db = readDatabase();
    const agents = Object.values(db.agents).filter((agent) => agent.autopilot && agent.status === 'active');
    for (const agent of agents) {
      const plugin = AGENT_STRATEGY_PLUGIN[agent.strategyType];
      const row = rowsBySymbol.get(agent.assetSymbol.toUpperCase());
      if (!plugin || !row) continue;
      const spec = persistStrategySpec(compileFrozenStrategy(plugin));
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
