import crypto from 'node:crypto';
import { evaluateDecisionGates } from './gates.js';
import type { DecisionContext, FrozenStrategySpec, LayeredDecision, StrategyPlugin, ValidationRecord } from './types.js';

export function evaluateLayeredDecision(
  context: DecisionContext,
  plugin: StrategyPlugin,
  spec: FrozenStrategySpec,
  validation?: ValidationRecord,
): LayeredDecision {
  if (spec.hash !== validation?.strategyHash && validation) {
    throw new Error('Validation record does not match the frozen strategy specification');
  }
  const gates = evaluateDecisionGates(context, plugin);
  const declinedGate = gates.find((gate) => gate.status === 'decline');
  const validationInScope = !!validation?.symbols?.includes(context.symbol);
  const validationStatus = validation?.status === 'forward_paper_candidate' && !validationInScope
    ? 'unvalidated'
    : validation?.status || 'unvalidated';
  let signal = null;
  let outcome: LayeredDecision['outcome'] = 'decline';
  let reason = declinedGate?.reason || 'NO_SIGNAL';

  if (!declinedGate) {
    signal = plugin.generateSignal(context);
    if (signal.action === 'hold') {
      reason = 'NO_SIGNAL';
    } else if (validationStatus !== 'forward_paper_candidate') {
      outcome = validationStatus === 'rejected' ? 'decline' : 'research_hypothesis';
      reason = validationStatus === 'rejected'
        ? 'VALIDATION_REJECTED'
        : validation?.status === 'forward_paper_candidate' ? 'VALIDATION_SCOPE_MISMATCH' : 'VALIDATION_REQUIRED';
    } else {
      outcome = 'paper_trade_candidate';
      reason = 'VALIDATED_SIGNAL';
    }
  }

  const idSource = `${context.cycleId}|${context.symbol}|${spec.hash}|${context.evaluatedAt}`;
  return {
    authorityVersion: 5,
    schema: 'layered-decision.v5',
    id: `decision_${crypto.createHash('sha256').update(idSource).digest('hex').slice(0, 20)}`,
    cycleId: context.cycleId,
    evaluatedAt: context.evaluatedAt,
    symbol: context.symbol,
    instrument: context.instrument,
    strategyHash: spec.hash,
    pluginId: plugin.id,
    outcome,
    reason,
    gates,
    signal,
    featureEvidence: Object.values(context.features),
    validationStatus,
    paperPermission: validationStatus === 'forward_paper_candidate'
      ? 'paper_confirmed'
      : validationStatus === 'rejected'
        ? 'observe_only'
        : 'paper_discovery',
    queueStatus: outcome === 'paper_trade_candidate' ? 'queued' : 'not_queued',
    ownerId: context.routing?.ownerId,
    agentId: context.routing?.agentId,
  };
}
