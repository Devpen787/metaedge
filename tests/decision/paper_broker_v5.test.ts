import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarketObservationV5 } from '../../server/market_data_v5.js';
import {
  DEFAULT_PAPER_BROKER_POLICY_V5,
  evaluatePaperBrokerV5,
} from '../../server/v5/paper_broker.js';
import type { MarketObservationV5, OrderIntentV5, PaperBrokerPolicyV5 } from '../../src/types.js';

function observation(receivedAt: number, price = 100, volume24hUsd = 10_000_000): MarketObservationV5 {
  return createMarketObservationV5({
    symbol: 'BTC',
    price,
    change24hPct: 0,
    volume24hUsd,
    high24h: price,
    low24h: price,
    marketCapUsd: 1_000_000_000,
    provider: 'test-feed',
    venue: 'test-venue',
    dataset: 'paper_broker_test',
    observedAt: receivedAt,
    receivedAt,
  });
}

function intent(overrides: Partial<OrderIntentV5> = {}): OrderIntentV5 {
  return {
    authorityVersion: 5,
    schema: 'order-intent.v5',
    intentId: 'broker_intent_fixture',
    idempotencyKey: 'user:broker',
    userId: 'user',
    agentId: 'agent',
    assetSymbol: 'BTC',
    side: 'buy',
    size: 1,
    tradeType: 'token',
    leverage: 1,
    orderType: 'market',
    expiresAt: 100_000,
    brokerPolicyId: DEFAULT_PAPER_BROKER_POLICY_V5.id,
    submissionObservationHash: observation(1_000).observationHash,
    stopTriggered: false,
    filledSize: 0,
    remainingSize: 1,
    fillIds: [],
    tradeIds: [],
    positionEffect: 'increase',
    status: 'BROKER_PENDING',
    createdAt: 1_000,
    updatedAt: 1_001,
    nonce: 'broker',
    ...overrides,
  };
}

test('paper broker requires a different observation received after submission', () => {
  const submitted = observation(1_000);
  const waiting = evaluatePaperBrokerV5({
    intent: intent({ submissionObservationHash: submitted.observationHash }),
    observation: submitted,
    now: 1_001,
  });
  assert.equal(waiting.action, 'wait');
  assert.equal(waiting.reason, 'NEXT_OBSERVATION_REQUIRED');

  const filled = evaluatePaperBrokerV5({
    intent: intent({ submissionObservationHash: submitted.observationHash }),
    observation: observation(2_000, 101),
    now: 2_001,
  });
  assert.equal(filled.action, 'fill');
  if (filled.action !== 'fill') return;
  assert.equal(filled.fill.referencePrice, 101);
  assert.ok(filled.fill.fillPrice > filled.fill.referencePrice);
  assert.ok(filled.fill.feeUsd > 0);
  assert.ok(filled.fill.spreadCostUsd > 0);
  assert.ok(filled.fill.slippageUsd > 0);
});

test('stale observations are rejected instead of becoming claimed fills', () => {
  const quote = observation(2_000);
  const result = evaluatePaperBrokerV5({
    intent: intent({ expiresAt: 1_000_000 }),
    observation: quote,
    now: quote.receivedAt + DEFAULT_PAPER_BROKER_POLICY_V5.maximumQuoteAgeMs + 1,
  });
  assert.deepEqual(result, {
    action: 'reject',
    reason: 'STALE_MARKET_OBSERVATION',
    stopTriggered: false,
  });
});

test('volume participation creates durable-sized partials across different observations', () => {
  const policy: PaperBrokerPolicyV5 = {
    ...DEFAULT_PAPER_BROKER_POLICY_V5,
    observationIntervalMs: 86_400_000,
    volumeParticipationRate: 0.1,
    baseSlippageBps: 2,
    maximumSlippageBps: 2,
  };
  const first = evaluatePaperBrokerV5({
    intent: intent({ size: 2, remainingSize: 2 }),
    observation: observation(2_000, 100, 1_000),
    now: 2_001,
    policy,
  });
  assert.equal(first.action, 'fill');
  if (first.action !== 'fill') return;
  assert.equal(first.fill.quantity, 1);
  assert.equal(first.fill.partial, true);

  const secondIntent = intent({
    size: 2,
    status: 'PARTIALLY_FILLED',
    filledSize: 1,
    remainingSize: 1,
    fillIds: [first.fill.fillId],
    lastBrokerObservationHash: first.fill.observationHash,
  });
  const sameObservation = evaluatePaperBrokerV5({
    intent: secondIntent,
    observation: observation(2_000, 100, 1_000),
    now: 2_002,
    policy,
  });
  assert.equal(sameObservation.action, 'wait');
  const second = evaluatePaperBrokerV5({
    intent: secondIntent,
    observation: observation(3_000, 100, 1_000),
    now: 3_001,
    policy,
  });
  assert.equal(second.action, 'fill');
  if (second.action === 'fill') assert.equal(second.fill.partial, false);
});

test('limit and stop orders use conservative executable prices', () => {
  const quote = observation(2_000, 100);
  const passiveLimit = evaluatePaperBrokerV5({
    intent: intent({ orderType: 'limit', limitPrice: 100 }),
    observation: quote,
    now: 2_001,
  });
  assert.equal(passiveLimit.action, 'wait');
  assert.equal(passiveLimit.reason, 'LIMIT_NOT_EXECUTABLE');

  const executableLimit = evaluatePaperBrokerV5({
    intent: intent({ orderType: 'limit', limitPrice: 101 }),
    observation: quote,
    now: 2_001,
  });
  assert.equal(executableLimit.action, 'fill');

  const untriggeredStop = evaluatePaperBrokerV5({
    intent: intent({ orderType: 'stop', stopPrice: 105 }),
    observation: quote,
    now: 2_001,
  });
  assert.equal(untriggeredStop.action, 'wait');
  assert.equal(untriggeredStop.reason, 'STOP_NOT_TRIGGERED');

  const triggeredStop = evaluatePaperBrokerV5({
    intent: intent({ orderType: 'stop', stopPrice: 105 }),
    observation: observation(3_000, 106),
    now: 3_001,
  });
  assert.equal(triggeredStop.action, 'fill');
  assert.equal(triggeredStop.stopTriggered, true);
});

test('time in force expires without inventing a trade', () => {
  assert.deepEqual(evaluatePaperBrokerV5({
    intent: intent({ expiresAt: 2_000 }),
    observation: null,
    now: 2_000,
  }), {
    action: 'expire',
    reason: 'TIME_IN_FORCE_EXPIRED',
    stopTriggered: false,
  });
});
