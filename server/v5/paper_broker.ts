import crypto from 'node:crypto';
import type {
  MarketObservationV5,
  OrderIntentV5,
  PaperBrokerPolicyV5,
  PaperFillV5,
} from '../../src/types.js';
import { verifyMarketObservationV5 } from '../market_data_v5.js';
import { assertAuthorityV5Contract } from './authority.js';

export const DEFAULT_PAPER_BROKER_POLICY_V5: Readonly<PaperBrokerPolicyV5> = Object.freeze({
  authorityVersion: 5,
  schema: 'paper-broker-policy.v5',
  id: 'paper-broker-conservative-v5',
  semanticVersion: '5.0.0',
  executionTiming: 'next_observation',
  liquidityModel: 'volume_participation_proxy',
  sameObservationFill: 'forbidden',
  feeBps: 6,
  halfSpreadBps: 3,
  baseSlippageBps: 2,
  maximumSlippageBps: 40,
  maximumQuoteAgeMs: 120_000,
  defaultTimeInForceMs: 5 * 60_000,
  observationIntervalMs: 12_000,
  volumeParticipationRate: 0.001,
  minimumFillNotionalUsd: 1,
  perpFundingBpsPerDay: 1,
  shortBorrowBpsPerDay: 2,
  liveExecution: 'locked',
});

export type PaperBrokerEvaluationV5 =
  | { action: 'wait'; reason: string; stopTriggered: boolean }
  | { action: 'reject'; reason: string; stopTriggered: boolean }
  | { action: 'expire'; reason: string; stopTriggered: boolean }
  | { action: 'fill'; fill: PaperFillV5; stopTriggered: boolean };

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function assertPaperBrokerPolicyV5(policy: PaperBrokerPolicyV5): void {
  assertAuthorityV5Contract(policy);
  const finiteNonnegative = [
    policy.feeBps,
    policy.halfSpreadBps,
    policy.baseSlippageBps,
    policy.maximumSlippageBps,
    policy.maximumQuoteAgeMs,
    policy.defaultTimeInForceMs,
    policy.observationIntervalMs,
    policy.volumeParticipationRate,
    policy.minimumFillNotionalUsd,
    policy.perpFundingBpsPerDay,
    policy.shortBorrowBpsPerDay,
  ].every((value) => Number.isFinite(value) && value >= 0);
  if (!finiteNonnegative
    || policy.executionTiming !== 'next_observation'
    || policy.liquidityModel !== 'volume_participation_proxy'
    || policy.sameObservationFill !== 'forbidden'
    || policy.maximumSlippageBps < policy.baseSlippageBps
    || policy.maximumQuoteAgeMs <= 0
    || policy.defaultTimeInForceMs <= 0
    || policy.observationIntervalMs <= 0
    || policy.volumeParticipationRate <= 0
    || policy.volumeParticipationRate > 1
    || policy.liveExecution !== 'locked') {
    throw new Error(`PAPER_BROKER_POLICY_INVALID:${policy.id}`);
  }
}

function marketSide(intent: OrderIntentV5): 1 | -1 {
  return intent.side === 'buy' || intent.side === 'long' ? 1 : -1;
}

function orderIsTriggered(intent: OrderIntentV5, referencePrice: number): boolean {
  if (intent.orderType !== 'stop' && intent.orderType !== 'stop_limit') return true;
  if (intent.stopTriggered) return true;
  const stop = Number(intent.stopPrice);
  if (!(stop > 0)) return false;
  return marketSide(intent) === 1 ? referencePrice >= stop : referencePrice <= stop;
}

export function evaluatePaperBrokerV5(input: {
  intent: OrderIntentV5;
  observation: MarketObservationV5 | null;
  now: number;
  policy?: PaperBrokerPolicyV5;
}): PaperBrokerEvaluationV5 {
  const { intent, observation, now } = input;
  const policy = input.policy ?? DEFAULT_PAPER_BROKER_POLICY_V5;
  assertPaperBrokerPolicyV5(policy);
  assertAuthorityV5Contract(intent);
  const stopTriggered = Boolean(intent.stopTriggered);
  if (intent.status !== 'BROKER_PENDING' && intent.status !== 'PARTIALLY_FILLED') {
    return { action: 'reject', reason: `BROKER_INTENT_STATE_INVALID:${intent.status}`, stopTriggered };
  }
  if (intent.brokerPolicyId !== policy.id) {
    return { action: 'reject', reason: 'BROKER_POLICY_MISMATCH', stopTriggered };
  }
  if (Number(intent.expiresAt) <= now) {
    return { action: 'expire', reason: 'TIME_IN_FORCE_EXPIRED', stopTriggered };
  }
  if (!observation) return { action: 'wait', reason: 'MARKET_OBSERVATION_UNAVAILABLE', stopTriggered };
  if (!verifyMarketObservationV5(observation)) {
    return { action: 'reject', reason: 'MARKET_OBSERVATION_INTEGRITY_FAILED', stopTriggered };
  }
  if (observation.provenance !== 'observed') {
    return { action: 'wait', reason: 'OBSERVED_MARKET_QUOTE_REQUIRED', stopTriggered };
  }
  if (observation.receivedAt <= intent.createdAt
    || observation.observationHash === intent.submissionObservationHash
    || observation.observationHash === intent.lastBrokerObservationHash) {
    return { action: 'wait', reason: 'NEXT_OBSERVATION_REQUIRED', stopTriggered };
  }
  if (now - observation.receivedAt > policy.maximumQuoteAgeMs) {
    return { action: 'reject', reason: 'STALE_MARKET_OBSERVATION', stopTriggered };
  }

  const orderType = intent.orderType ?? 'market';
  const triggered = orderIsTriggered(intent, observation.price);
  if ((orderType === 'stop' || orderType === 'stop_limit') && !triggered) {
    return { action: 'wait', reason: 'STOP_NOT_TRIGGERED', stopTriggered: false };
  }

  const side = marketSide(intent);
  const remainingSize = Math.max(0, intent.remainingSize ?? intent.size - (intent.filledSize ?? 0));
  if (!(remainingSize > 0)) {
    return { action: 'reject', reason: 'BROKER_REMAINING_SIZE_INVALID', stopTriggered: triggered };
  }
  const volume24hUsd = Number(observation.volume24hUsd);
  if (!(volume24hUsd > 0)) {
    return { action: 'reject', reason: 'BROKER_LIQUIDITY_UNAVAILABLE', stopTriggered: triggered };
  }
  const capacityNotionalUsd = volume24hUsd
    * (policy.observationIntervalMs / 86_400_000)
    * policy.volumeParticipationRate;
  const capacityQuantity = capacityNotionalUsd / observation.price;
  const quantity = Math.min(remainingSize, capacityQuantity);
  if (!(quantity > 0) || quantity * observation.price < policy.minimumFillNotionalUsd) {
    return { action: 'reject', reason: 'BROKER_MINIMUM_EXECUTABLE_LIQUIDITY_NOT_MET', stopTriggered: triggered };
  }

  const participation = Math.min(1, quantity / Math.max(capacityQuantity, Number.EPSILON));
  const slippageBps = policy.baseSlippageBps
    + participation * (policy.maximumSlippageBps - policy.baseSlippageBps);
  const spreadAdjusted = observation.price * (1 + side * policy.halfSpreadBps / 10_000);
  const fillPrice = spreadAdjusted * (1 + side * slippageBps / 10_000);
  const limitPrice = Number(intent.limitPrice);
  if ((orderType === 'limit' || orderType === 'stop_limit') && (!(limitPrice > 0)
    || (side === 1 ? fillPrice > limitPrice : fillPrice < limitPrice))) {
    return { action: 'wait', reason: 'LIMIT_NOT_EXECUTABLE', stopTriggered: triggered };
  }

  const sequence = (intent.fillIds?.length ?? 0) + 1;
  const notionalUsd = quantity * fillPrice;
  const spreadCostUsd = Math.abs(quantity * (spreadAdjusted - observation.price));
  const slippageUsd = Math.abs(quantity * (fillPrice - spreadAdjusted));
  const feeUsd = notionalUsd * policy.feeBps / 10_000;
  const fillIdentity = {
    intentId: intent.intentId,
    sequence,
    observationHash: observation.observationHash,
    quantity,
    fillPrice,
    brokerPolicyId: policy.id,
  };
  const fill: PaperFillV5 = {
    authorityVersion: 5,
    schema: 'paper-fill.v5',
    fillId: `paper_fill_v5_${digest(fillIdentity).slice(0, 24)}`,
    intentId: intent.intentId,
    sequence,
    brokerPolicyId: policy.id,
    observationHash: observation.observationHash,
    provider: observation.provider,
    venue: observation.venue,
    referencePrice: observation.price,
    fillPrice: Number(fillPrice.toPrecision(12)),
    quantity: Number(quantity.toPrecision(12)),
    notionalUsd: Number(notionalUsd.toPrecision(12)),
    feeUsd: Number(feeUsd.toPrecision(12)),
    spreadCostUsd: Number(spreadCostUsd.toPrecision(12)),
    slippageUsd: Number(slippageUsd.toPrecision(12)),
    filledAt: now,
    partial: quantity < remainingSize - 1e-12,
  };
  return { action: 'fill', fill, stopTriggered: triggered };
}
