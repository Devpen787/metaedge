import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createMarketObservationV5 } from '../server/market_data_v5.js';
import { STRATEGY_PLUGINS } from '../server/decision/plugins.js';
import { compileFrozenStrategy } from '../server/decision/specs.js';
import { readDatabase, writeDatabase } from '../server/storage.js';
import { processPaperBrokerOnce } from '../server/trades.js';
import { initializeV5Authority } from '../server/v5/authority.js';
import { applyExperimentLifecycleEventV5, ensureExperimentPopulationV5 } from '../server/v5/experiments.js';
import { ensureExperimentTrialsV5, reconcileExperimentOutcomesV5 } from '../server/v5/outcomes.js';
import { DEFAULT_PAPER_BROKER_POLICY_V5 } from '../server/v5/paper_broker.js';
import { recordPopulationAssuranceV5 } from '../server/v5/population.js';
import { reservePortfolioRiskV5 } from '../server/v5/portfolio.js';
import {
  createOrderIntent,
  getOrderEvents,
  markOrderIntentRiskAccepted,
  prepareOrderExecution,
  reconcileOrderIntents,
  submitOrderIntentToBroker,
} from '../src/secure-core/trading/intents.js';
import type { MarketObservationV5, OrderIntentV5, PaperFillV5, PaperTrade } from '../src/types.js';

const databaseUrl = path.resolve(process.env.DATABASE_URL || '');
if (process.env.METAEDGE_RESILIENCE_ISOLATED !== 'true'
  || !databaseUrl.includes('metaedge-v5-resilience.')
  || !databaseUrl.endsWith(`${path.sep}db.json`)) {
  throw new Error('V5_RESILIENCE_REQUIRES_ISOLATED_TEMP_DATABASE');
}

const phase = process.argv[2];
const FIXTURE_USER = 'usr_v5_resilience';
const FIXTURE_AGENT = 'agt_v5_resilience';

function observation(symbol: string, receivedAt: number, volume24hUsd = 1_000): MarketObservationV5 {
  return createMarketObservationV5({
    symbol,
    price: 100,
    change24hPct: 0,
    volume24hUsd,
    high24h: 100,
    low24h: 100,
    marketCapUsd: 1_000_000,
    provider: 'v5-resilience-harness',
    venue: 'isolated-local',
    dataset: 'v5_resilience_assurance',
    observedAt: receivedAt,
    receivedAt,
  });
}

function findIntent(nonce: string): OrderIntentV5 {
  const intent = Object.values(readDatabase().orderIntentsV5 || {}).find((row) => row.nonce === nonce);
  assert.ok(intent, `missing intent for ${nonce}`);
  return intent;
}

function result(scenario: string, evidenceIds: string[]) {
  console.log(JSON.stringify({ phase, scenario, passed: true, evidenceIds }));
}

if (phase === 'setup') {
  assert.equal(fs.existsSync(databaseUrl), false, 'assurance database must start absent');
  const now = Date.now();
  const populationAt = now - 8 * 60 * 60_000;
  initializeV5Authority(now - 200_000);
  const db = readDatabase();
  db.users[FIXTURE_USER] = {
    id: FIXTURE_USER,
    username: 'v5-resilience',
    profile: { displayName: 'V5 Resilience', avatarUrl: '', updatedAt: now },
    createdAt: now,
    lastActiveAt: now,
    paperBalance: 100_000,
    faucetClaimedCount: 0,
  };
  db.agents[FIXTURE_AGENT] = {
    authorityVersion: 5,
    schema: 'trading-agent.v5',
    id: FIXTURE_AGENT,
    ownerId: FIXTURE_USER,
    name: 'V5 resilience fixture',
    description: 'Isolated restart and fault-injection assurance only',
    assetSymbol: 'BTC',
    tradeType: 'token',
    strategyType: 'momentum',
    leverage: 1,
    status: 'active',
    createdAt: now,
  };
  writeDatabase(db);
  ensureExperimentPopulationV5(STRATEGY_PLUGINS.map((plugin) => ({
    plugin,
    strategy: compileFrozenStrategy(plugin, populationAt),
  })), populationAt);
  ensureExperimentTrialsV5(populationAt + 60_000);
  result('setup', [readDatabase().authorityV5!.legacySnapshotHash]);
} else if (phase === 'lifecycle_prepare') {
  const db = readDatabase();
  const spec = Object.values(db.experimentsV5!.specs).find((row) => row.pluginId === 'grid_deviation');
  assert.ok(spec);
  const at = Date.now() - 7 * 60 * 60_000;
  const event = {
    authorityVersion: 5 as const, schema: 'experiment-lifecycle-event.v5' as const,
    eventId: 'lifecycle_v5_resilience_ineligible', experimentId: spec.experimentId,
    type: 'regime_ineligible' as const, actor: 'system' as const,
    reason: 'ASSURANCE_REGIME_INELIGIBLE', evidenceIds: ['assurance_regime_absent'], at,
  };
  const state = applyExperimentLifecycleEventV5(event);
  assert.equal(state.lifecycleState, 'dormant');
  assert.equal(state.eligibility, 'ineligible');
  result('lifecycle_reactivation', [spec.experimentId, event.eventId]);
} else if (phase === 'lifecycle_verify') {
  const db = readDatabase();
  const spec = Object.values(db.experimentsV5!.specs).find((row) => row.pluginId === 'grid_deviation');
  assert.ok(spec);
  assert.equal(db.experimentsV5!.states[spec.experimentId].lifecycleState, 'dormant');
  const event = {
    authorityVersion: 5 as const, schema: 'experiment-lifecycle-event.v5' as const,
    eventId: 'lifecycle_v5_resilience_eligible', experimentId: spec.experimentId,
    type: 'regime_eligible' as const, actor: 'system' as const,
    reason: 'ASSURANCE_REGIME_RETURNED_AFTER_DWELL', evidenceIds: ['assurance_regime_returned'], at: Date.now(),
  };
  const state = applyExperimentLifecycleEventV5(event);
  assert.equal(state.lifecycleState, 'probation');
  assert.equal(state.eligibility, 'eligible');
  const ineligible = readDatabase().experimentsV5!.lifecycleEvents.find((row) => row.eventId === 'lifecycle_v5_resilience_ineligible');
  assert.ok(ineligible);
  assert.ok(event.at - ineligible.at >= spec.lifecyclePolicy.minimumDwellMs);
  recordPopulationAssuranceV5('lifecycle_reactivation', [spec.experimentId, ineligible.eventId, event.eventId]);
  result('lifecycle_reactivation', [spec.experimentId, ineligible.eventId, event.eventId]);
} else if (phase === 'portfolio_veto_verify') {
  const db = readDatabase();
  const first = Object.values(db.experimentsV5!.specs).find((row) => row.pluginId === 'momentum_24h');
  const second = Object.values(db.experimentsV5!.specs).find((row) => row.pluginId === 'mean_reversion_24h');
  assert.ok(first && second);
  const now = Date.now();
  const request = (spec: typeof first, opportunityObservationId: string, requestedNotionalUsd: number) => ({
    userId: 'usr_v5_paper_discovery', agentId: `agt_exp_v5_${spec.strategyHash.slice(0, 20)}`,
    experimentId: spec.experimentId, strategyHash: spec.strategyHash, opportunityObservationId,
    symbol: 'VETOCAP', side: 'buy' as const, positionEffect: 'increase' as const,
    requestedSize: requestedNotionalUsd / 100, referencePrice: 100, requestedNotionalUsd,
    family: spec.family, regime: 'trend', dailyVolumeUsd: 1_000_000_000,
  });
  const accepted = reservePortfolioRiskV5(request(first, 'opp_v5_veto_capacity', 1_800), now);
  assert.equal(accepted.accepted, true);
  const denied = reservePortfolioRiskV5(request(second, 'opp_v5_veto_challenger', 300), now + 1);
  assert.equal(denied.accepted, false);
  assert.deepEqual(denied.decision.reasons, ['PORTFOLIO_SYMBOL_CAP']);
  assert.equal(denied.reservation.status, 'denied');
  assert.equal(denied.reservation.authorizedNotionalUsd, 0);
  const evidenceIds = [denied.decision.decisionId, denied.decision.reservationId,
    denied.decision.snapshotBeforeHash, denied.decision.policyHash, ...denied.decision.reasons];
  recordPopulationAssuranceV5('portfolio_allocator_veto', evidenceIds);
  result('portfolio_allocator_veto', evidenceIds);
} else if (phase === 'intent_prepare') {
  const intent = createOrderIntent(FIXTURE_USER, {
    agentId: FIXTURE_AGENT,
    assetSymbol: 'INTENTRST',
    side: 'buy',
    size: 1,
    tradeType: 'token',
    leverage: 1,
    nonce: 'v5-intent-restart',
  });
  markOrderIntentRiskAccepted(intent.intentId, 'increase');
  const durableTrade = prepareOrderExecution(intent.intentId, 100);
  const db = readDatabase();
  db.trades.push(durableTrade);
  writeDatabase(db);
  assert.equal(findIntent('v5-intent-restart').status, 'RISK_ACCEPTED');
  result('intent_restart_recovery', [intent.intentId, durableTrade.id]);
} else if (phase === 'intent_verify') {
  const reconciliation = reconcileOrderIntents();
  const intent = findIntent('v5-intent-restart');
  assert.equal(reconciliation.recoveredExecuted, 1);
  assert.equal(intent.status, 'EXECUTED');
  assert.ok(intent.tradeId);
  assert.deepEqual(getOrderEvents(intent.intentId).map((event) => event.type), ['CREATED', 'RISK_ACCEPTED', 'EXECUTED']);
  const audit = readDatabase().auditEvents.find((event) => event.action === 'RECONCILE_ORDER_EXECUTED_V5'
    && event.details.includes(intent.tradeId!));
  assert.ok(audit);
  recordPopulationAssuranceV5('intent_restart_recovery', [intent.intentId, intent.tradeId!, audit.id]);
  result('intent_restart_recovery', [intent.intentId, intent.tradeId!, audit.id]);
} else if (phase === 'partial_prepare') {
  const base = Date.now();
  const submitted = observation('PARTIALRST', base - 1, 1_000);
  const intent = createOrderIntent(FIXTURE_USER, {
    agentId: FIXTURE_AGENT,
    assetSymbol: 'PARTIALRST',
    side: 'buy',
    size: 2,
    tradeType: 'token',
    leverage: 1,
    nonce: 'v5-partial-restart',
    submissionObservationHash: submitted.observationHash,
  });
  markOrderIntentRiskAccepted(intent.intentId, 'increase');
  submitOrderIntentToBroker(intent.intentId);
  const policy = { ...DEFAULT_PAPER_BROKER_POLICY_V5, observationIntervalMs: 86_400_000,
    volumeParticipationRate: 0.1, baseSlippageBps: 2, maximumSlippageBps: 2 };
  const first = observation('PARTIALRST', base + 1_000, 1_000);
  assert.equal(processPaperBrokerOnce(base + 1_001, () => first, policy).partial, 1);
  const partial = findIntent('v5-partial-restart');
  assert.equal(partial.status, 'PARTIALLY_FILLED');
  assert.equal(partial.fillIds?.length, 1);
  result('partial_fill_restart_recovery', [partial.intentId, partial.fillIds![0]]);
} else if (phase === 'partial_verify') {
  const intentBefore = findIntent('v5-partial-restart');
  assert.equal(intentBefore.status, 'PARTIALLY_FILLED');
  assert.equal(intentBefore.fillIds?.length, 1);
  reconcileOrderIntents();
  assert.equal(findIntent('v5-partial-restart').status, 'PARTIALLY_FILLED');
  const policy = { ...DEFAULT_PAPER_BROKER_POLICY_V5, observationIntervalMs: 86_400_000,
    volumeParticipationRate: 0.1, baseSlippageBps: 2, maximumSlippageBps: 2 };
  const receivedAt = Date.now() + 1_000;
  const second = observation('PARTIALRST', receivedAt, 1_000);
  assert.equal(processPaperBrokerOnce(receivedAt + 1, () => second, policy).filled, 1);
  const completed = findIntent('v5-partial-restart');
  assert.equal(completed.status, 'EXECUTED');
  assert.equal(completed.filledSize, 2);
  assert.equal(completed.remainingSize, 0);
  assert.equal(completed.fillIds?.length, 2);
  recordPopulationAssuranceV5('partial_fill_restart_recovery', [completed.intentId, ...completed.fillIds!]);
  result('partial_fill_restart_recovery', [completed.intentId, ...completed.fillIds!]);
} else if (phase === 'outcome_prepare') {
  const db = readDatabase();
  const spec = Object.values(db.experimentsV5!.specs).find((row) => row.pluginId === 'momentum_24h');
  assert.ok(spec);
  const trial = Object.values(db.experimentLearningV5!.trials).find((row) => row.experimentId === spec.experimentId);
  assert.ok(trial);
  const agentId = `agt_exp_v5_${spec.strategyHash.slice(0, 20)}`;
  const now = Date.now();
  const inputs = [
    { id: 'resilience_open', side: 'buy' as const, price: 100.2, referencePrice: 100, timestamp: now - 4_000 },
    { id: 'resilience_close', side: 'sell' as const, price: 104.8, referencePrice: 105, timestamp: now - 3_000 },
  ];
  for (const input of inputs) {
    const intentId = `intent_${input.id}`;
    const fillId = `fill_${input.id}`;
    const trade: PaperTrade = {
      id: `trade_${input.id}`, orderIntentId: intentId, paperFillId: fillId,
      brokerPolicyId: DEFAULT_PAPER_BROKER_POLICY_V5.id,
      agentId, userId: 'usr_v5_paper_discovery', assetSymbol: 'OUTCOMERST', tradeType: 'token',
      side: input.side, size: 1, price: input.price, referencePrice: input.referencePrice,
      referenceObservationHash: `observation_${input.id}`, leverage: 1, timestamp: input.timestamp,
      status: 'open', feeUsd: 0.05, spreadCostUsd: 0.1, slippageUsd: 0.1, fundingUsd: 0, borrowUsd: 0,
      experimentId: spec.experimentId, experimentLabel: spec.label,
      opportunityObservationId: `opportunity_${input.id}`, paperPermission: 'paper_discovery',
      thesis: { strategyHash: spec.strategyHash, signalFamily: spec.family, setup: 'restart fixture',
        trigger: 'durable closed episode', invalidation: 'lineage mismatch' },
    };
    const intent: OrderIntentV5 = {
      authorityVersion: 5, schema: 'order-intent.v5', intentId, idempotencyKey: `key_${input.id}`,
      userId: trade.userId, agentId, assetSymbol: trade.assetSymbol, side: input.side, size: 1,
      tradeType: 'token', leverage: 1, positionEffect: input.side === 'buy' ? 'increase' : 'reduce',
      status: 'EXECUTED', createdAt: input.timestamp - 10, updatedAt: input.timestamp,
      nonce: `nonce_${input.id}`, experimentId: spec.experimentId, paperPermission: 'paper_discovery',
      fillIds: [fillId], tradeIds: [trade.id], tradeId: trade.id, filledSize: 1, remainingSize: 0,
    };
    const fill: PaperFillV5 = {
      authorityVersion: 5, schema: 'paper-fill.v5', fillId, intentId, sequence: 1,
      brokerPolicyId: DEFAULT_PAPER_BROKER_POLICY_V5.id, observationHash: trade.referenceObservationHash!,
      provider: 'v5-resilience-harness', venue: 'isolated-local', referencePrice: input.referencePrice,
      fillPrice: input.price, quantity: 1, notionalUsd: input.price, feeUsd: 0.05,
      spreadCostUsd: 0.1, slippageUsd: 0.1, filledAt: input.timestamp, partial: false,
    };
    db.trades.push(trade);
    db.orderIntentsV5![intentId] = intent;
    db.paperFillsV5!.push(fill);
  }
  writeDatabase(db);
  assert.equal(Object.keys(readDatabase().experimentLearningV5!.outcomes).length, 0);
  result('outcome_restart_recovery', [trial.trialId, 'trade_resilience_open', 'trade_resilience_close']);
} else if (phase === 'outcome_verify') {
  // Exercise the same startup reconciliation that runs before the continuous
  // outcome clock. The assurance is invalid if restart rewrites either source
  // intent from EXECUTED to UNRESOLVED and makes the frozen outcome drift.
  reconcileOrderIntents();
  assert.equal(readDatabase().orderIntentsV5!.intent_resilience_open.status, 'EXECUTED');
  assert.equal(readDatabase().orderIntentsV5!.intent_resilience_close.status, 'EXECUTED');
  const first = reconcileExperimentOutcomesV5(Date.now());
  assert.equal(first.newOutcomes, 1);
  assert.equal(first.validOutcomes, 1);
  const db = readDatabase();
  const outcome = Object.values(db.experimentLearningV5!.outcomes).find((row) => row.symbol === 'OUTCOMERST');
  assert.ok(outcome);
  assert.equal(outcome.noTradeControlPnlUsd, 0);
  assert.ok(Number.isFinite(outcome.buyHoldControlPnlUsd));
  assert.ok(db.experimentLearningV5!.lifecycleAppliedOutcomeIds[outcome.outcomeId]);
  assert.equal(reconcileExperimentOutcomesV5(Date.now() + 1).newOutcomes, 0);
  assert.equal(Object.keys(readDatabase().experimentLearningV5!.outcomes).length, 1);
  recordPopulationAssuranceV5('outcome_restart_recovery', [outcome.outcomeId, outcome.trialId]);
  result('outcome_restart_recovery', [outcome.outcomeId, outcome.trialId]);
} else if (phase === 'stale_verify') {
  const intent = createOrderIntent(FIXTURE_USER, {
    agentId: FIXTURE_AGENT, assetSymbol: 'STALERST', side: 'buy', size: 1,
    tradeType: 'token', leverage: 1, nonce: 'v5-stale-rejection', submissionObservationHash: 'submission_hash',
  });
  markOrderIntentRiskAccepted(intent.intentId, 'increase');
  submitOrderIntentToBroker(intent.intentId);
  const receivedAt = intent.createdAt + 1;
  const stale = observation('STALERST', receivedAt, 10_000_000);
  const now = receivedAt + DEFAULT_PAPER_BROKER_POLICY_V5.maximumQuoteAgeMs + 1;
  assert.equal(processPaperBrokerOnce(now, () => stale).rejected, 1);
  const rejected = findIntent('v5-stale-rejection');
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(rejected.failureReason, 'STALE_MARKET_OBSERVATION');
  const event = getOrderEvents(rejected.intentId).find((row) => row.type === 'BROKER_REJECTED');
  assert.ok(event);
  recordPopulationAssuranceV5('stale_data_rejection', [rejected.intentId, event.eventId, stale.observationHash]);
  result('stale_data_rejection', [rejected.intentId, event.eventId, stale.observationHash]);
} else if (phase === 'write_failure_verify') {
  const before = fs.readFileSync(databaseUrl, 'utf8');
  const broken = readDatabase();
  (broken as any).resilienceUncommittedMarker = 'must-not-leak';
  (broken as any).cycle = broken;
  assert.throws(() => writeDatabase(broken), /Canonical database write failed/);
  assert.equal(fs.readFileSync(databaseUrl, 'utf8'), before);
  assert.equal((readDatabase() as any).resilienceUncommittedMarker, undefined);
  assert.deepEqual(fs.readdirSync(path.dirname(databaseUrl))
    .filter((name) => name.startsWith(`${path.basename(databaseUrl)}.tmp-`)), []);
  const recovered = readDatabase();
  (recovered as any).resilienceRecoveryMarker = 'committed-after-injected-failure';
  const receipt = writeDatabase(recovered);
  assert.equal(receipt.durability, 'file_and_directory_synced');
  assert.equal((readDatabase() as any).resilienceRecoveryMarker, 'committed-after-injected-failure');
  recordPopulationAssuranceV5('write_failure_injection', [String(receipt.committedAt), receipt.durability]);
  result('write_failure_injection', [String(receipt.committedAt), receipt.durability]);
} else {
  throw new Error(`UNKNOWN_V5_RESILIENCE_PHASE:${phase}`);
}
