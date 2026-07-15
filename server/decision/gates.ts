import { FEATURE_VERSIONS } from './features.js';
import type { DecisionContext, DecisionLayer, GateResult, StrategyPlugin } from './types.js';

export const DECISION_LAYER_ORDER: DecisionLayer[] = [
  'data_quality',
  'universe',
  'liquidity',
  'regime',
  'cost',
  'risk',
  'portfolio',
];

function result(layer: DecisionLayer, status: GateResult['status'], reason: string, evidence: GateResult['evidence']): GateResult {
  return { layer, status, reason, evidence };
}

export function evaluateDecisionGates(context: DecisionContext, plugin: StrategyPlugin): GateResult[] {
  const results: GateResult[] = [];
  let declined = false;

  const push = (gate: GateResult) => {
    const next = declined
      ? result(gate.layer, 'skipped', 'UPSTREAM_DECLINE', gate.evidence)
      : gate;
    results.push(next);
    if (next.status === 'decline') declined = true;
  };

  const badFeatures = plugin.requiredFeatures
    .map((id) => context.features[id])
    .filter((f) => !f || f.quality !== 'good');
  push(result('data_quality', badFeatures.length ? 'decline' : 'pass', badFeatures.length ? 'REQUIRED_FEATURE_UNAVAILABLE' : 'FEATURES_GOOD', {
    requiredCount: plugin.requiredFeatures.length,
    unavailable: badFeatures.map((f) => f?.id || 'missing').join(','),
  }));

  const universeGood = context.universe.included && context.universe.quality === 'good';
  const universeReason = !context.universe.included
    ? 'NOT_IN_UNIVERSE'
    : context.universe.quality === 'stale' ? 'STALE_UNIVERSE' : context.universe.quality === 'missing' ? 'UNIVERSE_UNAVAILABLE' : 'IN_UNIVERSE';
  push(result('universe', universeGood ? 'pass' : 'decline', universeReason, {
    tier: context.universe.tier,
    membershipReason: context.universe.reason,
    membershipObservedAt: context.universe.observedAt,
    membershipQuality: context.universe.quality,
  }));

  const volume = Number(context.features[FEATURE_VERSIONS.volume24h]?.value);
  const liquid = Number.isFinite(volume) && volume >= context.limits.liquidityFloorUsd;
  push(result('liquidity', liquid ? 'pass' : 'decline', liquid ? 'LIQUIDITY_OK' : 'LIQUIDITY_FLOOR', {
    volume24hUsd: Number.isFinite(volume) ? volume : null,
    floorUsd: context.limits.liquidityFloorUsd,
  }));

  const regime = plugin.regimeGate(context);
  push(result('regime', regime.eligible ? 'pass' : 'decline', regime.reason, { pluginId: plugin.id }));

  const costOk = context.limits.modeledRoundTripCostBps <= context.limits.maxRoundTripCostBps;
  push(result('cost', costOk ? 'pass' : 'decline', costOk ? 'COST_OK' : 'COST_TOO_HIGH', {
    modeledRoundTripCostBps: context.limits.modeledRoundTripCostBps,
    maxRoundTripCostBps: context.limits.maxRoundTripCostBps,
  }));

  const riskOk = context.limits.requestedNotionalUsd <= context.limits.riskBudgetUsd;
  push(result('risk', riskOk ? 'pass' : 'decline', riskOk ? 'RISK_OK' : 'RISK_BUDGET', {
    requestedNotionalUsd: context.limits.requestedNotionalUsd,
    riskBudgetUsd: context.limits.riskBudgetUsd,
  }));

  const projected = context.limits.portfolioOpenNotionalUsd + (context.position.holding ? 0 : context.limits.requestedNotionalUsd);
  const portfolioOk = projected <= context.limits.portfolioMaxNotionalUsd;
  push(result('portfolio', portfolioOk ? 'pass' : 'decline', portfolioOk ? 'PORTFOLIO_OK' : 'POSITION_CAP', {
    projectedOpenNotionalUsd: projected,
    portfolioMaxNotionalUsd: context.limits.portfolioMaxNotionalUsd,
  }));

  return results;
}
