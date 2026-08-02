import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type {
  ExperimentEpisodeOutcomeV5,
  ExperimentSpecV5,
  OrderIntentV5,
  PaperFillV5,
  PaperTrade,
} from '../../src/types.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-outcomes-v5-'));
process.env.DATABASE_URL = path.join(root, 'db.json');

function spec(overrides: Partial<ExperimentSpecV5> = {}): ExperimentSpecV5 {
  return {
    authorityVersion: 5,
    schema: 'experiment-spec.v5',
    experimentId: 'exp_v5_outcome_fixture',
    specHash: 'experiment_spec_hash',
    strategyHash: 'strategy_hash',
    pluginId: 'momentum_24h',
    family: 'momentum_24h',
    label: 'Momentum outcome fixture',
    version: 1,
    instrument: 'spot',
    initialPermission: 'paper_discovery',
    initialLifecycleState: 'discovery',
    maximumDiscoveryNotionalUsd: 2_000,
    maximumDiscoveryOrders: 8,
    maximumConcurrentIntents: 1,
    lifecyclePolicy: {
      minimumDwellMs: 1_000,
      failuresBeforeReduced: 2,
      failuresBeforeRetired: 5,
      minimumEligibleOutcomesBeforeRetired: 5,
      probationSuccessesRequired: 2,
    },
    createdAt: 100,
    ...overrides,
  };
}

function trade(input: {
  id: string;
  experimentId: string;
  strategyHash: string;
  agentId: string;
  symbol?: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  size?: number;
  price: number;
  referencePrice: number;
  timestamp: number;
  feeUsd?: number;
  lineage?: boolean;
}): PaperTrade {
  const lineage = input.lineage !== false;
  return {
    id: input.id,
    agentId: input.agentId,
    userId: 'usr_v5_paper_discovery',
    assetSymbol: input.symbol || 'BTC',
    tradeType: input.side === 'long' || input.side === 'short' ? 'perp' : 'token',
    side: input.side,
    size: input.size || 1,
    price: input.price,
    leverage: 1,
    timestamp: input.timestamp,
    status: 'open',
    orderIntentId: lineage ? `intent_${input.id}` : undefined,
    paperFillId: lineage ? `fill_${input.id}` : undefined,
    brokerPolicyId: lineage ? 'paper-broker-conservative-v5' : undefined,
    referencePrice: lineage ? input.referencePrice : undefined,
    referenceObservationHash: lineage ? `observation_${input.id}` : undefined,
    feeUsd: input.feeUsd ?? 0.05,
    spreadCostUsd: 0.1,
    slippageUsd: 0.1,
    fundingUsd: 0,
    borrowUsd: 0,
    experimentId: input.experimentId,
    experimentLabel: 'Fixture',
    opportunityObservationId: `opportunity_${input.id}`,
    paperPermission: 'paper_discovery',
    thesis: {
      strategyHash: input.strategyHash,
      signalFamily: 'momentum_24h',
      setup: 'fixture',
      trigger: 'fixture',
      invalidation: 'fixture',
    },
  };
}

function executionLineage(trades: PaperTrade[]): {
  intents: Record<string, OrderIntentV5>;
  fills: Record<string, PaperFillV5>;
} {
  const intents: Record<string, OrderIntentV5> = {};
  const fills: Record<string, PaperFillV5> = {};
  for (const row of trades) {
    if (!row.orderIntentId || !row.paperFillId || !row.referenceObservationHash) continue;
    intents[row.orderIntentId] = {
      authorityVersion: 5,
      schema: 'order-intent.v5',
      intentId: row.orderIntentId,
      idempotencyKey: `key_${row.id}`,
      userId: row.userId,
      agentId: row.agentId,
      assetSymbol: row.assetSymbol,
      side: row.side,
      size: row.size,
      tradeType: row.tradeType,
      leverage: row.leverage,
      positionEffect: row.side === 'buy' || row.side === 'long' ? 'increase' : 'reduce',
      status: 'EXECUTED',
      createdAt: row.timestamp - 10,
      updatedAt: row.timestamp,
      nonce: `nonce_${row.id}`,
      experimentId: row.experimentId,
      paperPermission: row.paperPermission,
    };
    fills[row.paperFillId] = {
      authorityVersion: 5,
      schema: 'paper-fill.v5',
      fillId: row.paperFillId,
      intentId: row.orderIntentId,
      sequence: 1,
      brokerPolicyId: 'paper-broker-conservative-v5',
      observationHash: row.referenceObservationHash,
      provider: 'fixture',
      venue: 'fixture',
      referencePrice: row.referencePrice!,
      fillPrice: row.price,
      quantity: row.size,
      notionalUsd: row.size * row.price,
      feeUsd: row.feeUsd || 0,
      spreadCostUsd: row.spreadCostUsd || 0,
      slippageUsd: row.slippageUsd || 0,
      filledAt: row.timestamp,
      partial: false,
    };
  }
  return { intents, fills };
}

test('trial declarations freeze both mandatory controls and reject post-outcome control deletion', async () => {
  const {
    compileExperimentTrialV5,
    validateExperimentTrialV5,
  } = await import('../../server/v5/outcomes.js');
  const trial = compileExperimentTrialV5(spec(), 1, 1_000);
  assert.deepEqual(trial.controls.map((control) => control.kind), [
    'no_trade',
    'buy_hold_same_symbol_same_window',
  ]);
  assert.doesNotThrow(() => validateExperimentTrialV5(trial));
  const tampered = structuredClone(trial);
  tampered.controls = tampered.controls.filter((control) => control.kind !== 'no_trade');
  assert.throws(() => validateExperimentTrialV5(tampered), /CONTROLS_INCOMPLETE/);
});

test('episode attribution records controls and costs, and favorable execution cannot improve evidence', async () => {
  const {
    compileEpisodeOutcomeV5,
    compileExperimentTrialV5,
  } = await import('../../server/v5/outcomes.js');
  const trial = compileExperimentTrialV5(spec(), 1, 1_000);
  // The fills are deliberately better than their references. Actual PnL may
  // benefit, but evidence is capped at reference PnL before explicit costs.
  const rows = [
    trade({ id: 'favorable_open', experimentId: trial.experimentId, strategyHash: trial.strategyHash,
      agentId: 'agent', side: 'buy', price: 99.5, referencePrice: 100, timestamp: 2_000 }),
    trade({ id: 'favorable_close', experimentId: trial.experimentId, strategyHash: trial.strategyHash,
      agentId: 'agent', side: 'sell', price: 106, referencePrice: 105, timestamp: 3_000 }),
  ];
  const lineage = executionLineage(rows);
  const outcome = compileEpisodeOutcomeV5({
    trial,
    episode: { experimentId: trial.experimentId, symbol: 'BTC', trades: rows },
    ...lineage,
  });
  assert.equal(outcome.operationalStatus, 'valid');
  assert.ok(outcome.actualPostCostPnlUsd > outcome.evidencePostCostPnlUsd);
  assert.ok(outcome.evidencePostCostPnlUsd < outcome.grossReferencePnlUsd);
  assert.ok(outcome.costStressedPnlUsd <= outcome.evidencePostCostPnlUsd);
  assert.equal(outcome.noTradeControlPnlUsd, 0);
  assert.equal(outcome.buyHoldControlPnlUsd, 5);
  assert.equal(outcome.reconciliationErrorUsd, 0);
});

test('same-family same-asset episodes in one declared window count as one independent cluster', async () => {
  const {
    assessExperimentEvidenceV5,
    compileEpisodeOutcomeV5,
    compileExperimentTrialV5,
  } = await import('../../server/v5/outcomes.js');
  const trial = compileExperimentTrialV5(spec(), 1, 1_000);
  const make = (suffix: string, openedAt: number) => {
    const rows = [
      trade({ id: `${suffix}_open`, experimentId: trial.experimentId, strategyHash: trial.strategyHash,
        agentId: 'agent', side: 'buy', price: 100.2, referencePrice: 100, timestamp: openedAt }),
      trade({ id: `${suffix}_close`, experimentId: trial.experimentId, strategyHash: trial.strategyHash,
        agentId: 'agent', side: 'sell', price: 104.8, referencePrice: 105, timestamp: openedAt + 1_000 }),
    ];
    return compileEpisodeOutcomeV5({ trial,
      episode: { experimentId: trial.experimentId, symbol: 'BTC', trades: rows },
      ...executionLineage(rows) });
  };
  const first = make('first', 2_000);
  const second = make('second', 5_000);
  assert.equal(first.independentClusterId, second.independentClusterId);
  const assessment = assessExperimentEvidenceV5({
    trial,
    outcomes: [first, second],
    declaredFamilyTrials: 1,
    assessedAt: 10_000,
  });
  assert.equal(assessment.validOutcomeCount, 2);
  assert.equal(assessment.independentEpisodeCount, 1);
  assert.equal(assessment.disposition, 'collecting');
});

test('operationally invalid outcomes are quarantined and block promotion', async () => {
  const {
    assessExperimentEvidenceV5,
    compileEpisodeOutcomeV5,
    compileExperimentTrialV5,
  } = await import('../../server/v5/outcomes.js');
  const trial = compileExperimentTrialV5(spec(), 1, 1_000);
  const rows = [
    trade({ id: 'invalid_open', experimentId: trial.experimentId, strategyHash: trial.strategyHash,
      agentId: 'agent', side: 'buy', price: 100, referencePrice: 100, timestamp: 2_000, lineage: false }),
    trade({ id: 'invalid_close', experimentId: trial.experimentId, strategyHash: trial.strategyHash,
      agentId: 'agent', side: 'sell', price: 105, referencePrice: 105, timestamp: 3_000, lineage: false }),
  ];
  const outcome = compileEpisodeOutcomeV5({
    trial,
    episode: { experimentId: trial.experimentId, symbol: 'BTC', trades: rows },
    intents: {},
    fills: {},
  });
  assert.equal(outcome.classification, 'quarantined');
  const assessment = assessExperimentEvidenceV5({ trial, outcomes: [outcome], declaredFamilyTrials: 1 });
  assert.equal(assessment.promotable, false);
  assert.equal(assessment.disposition, 'blocked');
  assert.ok(assessment.reasons.some((reason) => reason.startsWith('OPERATIONALLY_INVALID_OUTCOMES_PRESENT')));
});

test('pre-declaration history is visible but cannot poison or enter forward evidence', async () => {
  const {
    assessExperimentEvidenceV5,
    compileEpisodeOutcomeV5,
    compileExperimentTrialV5,
  } = await import('../../server/v5/outcomes.js');
  const trial = compileExperimentTrialV5(spec(), 1, 10_000);
  const rows = [
    trade({ id: 'historical_open', experimentId: trial.experimentId, strategyHash: trial.strategyHash,
      agentId: 'agent', side: 'buy', price: 100.2, referencePrice: 100, timestamp: 2_000 }),
    trade({ id: 'historical_close', experimentId: trial.experimentId, strategyHash: trial.strategyHash,
      agentId: 'agent', side: 'sell', price: 104.8, referencePrice: 105, timestamp: 3_000 }),
  ];
  const outcome = compileEpisodeOutcomeV5({ trial,
    episode: { experimentId: trial.experimentId, symbol: 'BTC', trades: rows },
    ...executionLineage(rows) });
  assert.equal(outcome.operationalStatus, 'valid');
  assert.equal(outcome.classification, 'quarantined');
  assert.deepEqual(outcome.reasons, ['EPISODE_NOT_FORWARD_OF_TRIAL_CUTOFF']);
  const assessment = assessExperimentEvidenceV5({ trial, outcomes: [outcome], declaredFamilyTrials: 1 });
  assert.equal(assessment.validOutcomeCount, 0);
  assert.equal(assessment.invalidOutcomeCount, 0);
  assert.equal(assessment.quarantinedOutcomeCount, 1);
  assert.equal(assessment.disposition, 'collecting');
});

test('multiplicity uses every declared family variant and cannot ignore discarded trials', async () => {
  const {
    assessExperimentEvidenceV5,
    compileExperimentTrialV5,
  } = await import('../../server/v5/outcomes.js');
  const trial = compileExperimentTrialV5(spec(), 1, 1_000);
  const base: ExperimentEpisodeOutcomeV5 = {
    authorityVersion: 5,
    schema: 'experiment-episode-outcome.v5',
    outcomeId: 'base',
    episodeId: 'base',
    independentClusterId: 'base',
    trialId: trial.trialId,
    experimentId: trial.experimentId,
    strategyHash: trial.strategyHash,
    family: trial.family,
    symbol: 'BTC',
    direction: 'long',
    openedAt: 2_000,
    resolvedAt: 3_000,
    tradeIds: ['open', 'close'],
    orderIntentIds: ['open', 'close'],
    fillIds: ['open', 'close'],
    sourceObservationHashes: ['open', 'close'],
    entryReferenceNotionalUsd: 100,
    entryReferencePrice: 100,
    exitReferencePrice: 100,
    grossReferencePnlUsd: 2,
    executionGrossPnlUsd: 2,
    signedImplementationShortfallUsd: 0,
    conservativeImplementationDragUsd: 0,
    feeUsd: 0.1,
    spreadCostUsd: 0.1,
    slippageUsd: 0.1,
    fundingUsd: 0,
    borrowUsd: 0,
    actualPostCostPnlUsd: 1.9,
    evidencePostCostPnlUsd: 1.9,
    costStressedPnlUsd: 1.85,
    noTradeControlPnlUsd: 0,
    buyHoldControlPnlUsd: 0.5,
    evidenceNetBps: 190,
    costStressedNetBps: 185,
    noTradeRelativeBps: 190,
    benchmarkRelativeBps: 140,
    reconciliationErrorUsd: 0,
    operationalStatus: 'valid',
    classification: 'evidence_eligible',
    reasons: [],
    liveExecution: 'locked',
  };
  const outcomes = Array.from({ length: 20 }, (_, index) => ({
    ...base,
    outcomeId: `outcome_${index}`,
    episodeId: `episode_${index}`,
    independentClusterId: `cluster_${index}`,
    benchmarkRelativeBps: 120 + (index % 3),
    openedAt: 2_000 + index * 86_400_000,
    resolvedAt: 3_000 + index * 86_400_000,
  }));
  const assessment = assessExperimentEvidenceV5({
    trial,
    outcomes,
    declaredFamilyTrials: 4,
    assessedAt: 50_000,
  });
  assert.equal(assessment.declaredFamilyTrials, 4);
  assert.equal(assessment.multiplicityAdjustedAlpha, 0.0125);
  assert.equal(assessment.independentEpisodeCount, 20);
  assert.equal(assessment.promotable, true);
  assert.equal(assessment.disposition, 'review_candidate');
});

test('durable reconciliation counts retired challengers, resolves once, and applies lifecycle once', async () => {
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const { goldenCrossParticipateV5, goldenCrossStrictV5 } = await import('../../server/decision/plugins.js');
  const { ensureExperimentPopulationV5, proposeExperimentChallengerV5 } = await import('../../server/v5/experiments.js');
  const { reconcileExperimentOutcomesV5 } = await import('../../server/v5/outcomes.js');
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const entries = [goldenCrossStrictV5, goldenCrossParticipateV5]
    .map((plugin) => ({ plugin, strategy: compileFrozenStrategy(plugin, 100) }));
  const registered = ensureExperimentPopulationV5(entries, 100);
  const challengerStrategy = compileFrozenStrategy({
    ...goldenCrossStrictV5,
    version: '5.0.1',
    parameters: { ...goldenCrossStrictV5.parameters, minimumVolumeRatio: 1.75 },
  }, 200);
  proposeExperimentChallengerV5({
    parentExperimentId: registered[0].spec.experimentId,
    challengerStrategy,
    label: 'Golden Cross strict 1.75x challenger',
    reason: 'fixture discarded variant',
    actor: 'system',
    now: 200,
  });
  const before = readDatabase();
  before.experimentsV5!.states[registered[1].spec.experimentId].lifecycleState = 'retired';
  before.experimentsV5!.states[registered[1].spec.experimentId].permission = 'observe_only';
  writeDatabase(before);
  reconcileExperimentOutcomesV5(10_000);
  const declared = readDatabase().experimentLearningV5!;
  const familyTrials = Object.values(declared.trials).filter((trial) => trial.family === 'golden_cross');
  assert.equal(familyTrials.length, 3);
  assert.ok(Object.values(declared.assessments).every((assessment) => assessment.declaredFamilyTrials === 3));

  const trial = familyTrials.find((item) => item.experimentId === registered[0].spec.experimentId)!;
  const rows = [
    trade({ id: 'durable_open', experimentId: trial.experimentId, strategyHash: trial.strategyHash,
      agentId: registered[0].execution.agent.id, symbol: 'ETH', side: 'buy', price: 100.2, referencePrice: 100, timestamp: 20_000 }),
    trade({ id: 'durable_close', experimentId: trial.experimentId, strategyHash: trial.strategyHash,
      agentId: registered[0].execution.agent.id, symbol: 'ETH', side: 'sell', price: 104.8, referencePrice: 105, timestamp: 30_000 }),
  ];
  const lineage = executionLineage(rows);
  const db = readDatabase();
  db.trades.push(...rows);
  Object.assign(db.orderIntentsV5!, lineage.intents);
  db.paperFillsV5!.push(...Object.values(lineage.fills));
  writeDatabase(db);
  const first = reconcileExperimentOutcomesV5(40_000);
  assert.equal(first.newOutcomes, 1);
  assert.equal(first.validOutcomes, 1);
  const afterFirst = readDatabase();
  assert.equal(Object.keys(afterFirst.experimentLearningV5!.lifecycleAppliedOutcomeIds).length, 1);
  assert.equal(afterFirst.experimentsV5!.states[trial.experimentId].eligibleOutcomeCount, 1);
  const second = reconcileExperimentOutcomesV5(50_000);
  assert.equal(second.newOutcomes, 0);
  const afterSecond = readDatabase();
  assert.equal(afterSecond.experimentsV5!.states[trial.experimentId].eligibleOutcomeCount, 1);
  assert.equal(afterSecond.experimentLearningV5!.lastReconciledAt, 40_000);
  assert.ok(Object.values(afterSecond.experimentLearningV5!.assessments)
    .every((assessment) => assessment.assessedAt === 40_000));
});

test.after(() => fs.rmSync(root, { recursive: true, force: true }));
