import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  chooseExecutionPolicy,
  compilePointInTimeState,
  estimateBinaryTransition,
  evidenceFingerprint,
  portfolioRiskGate,
  transitionLifecycle,
} from '../../server/discovery/flywheel.js';
import { FlywheelLedger } from '../../server/discovery/flywheel_store.js';
import type { AlphaTrial, FlywheelCoverage, ForwardObservation } from '../../server/discovery/flywheel_types.js';

test('point-in-time state compilation rejects late features and unstable provenance', () => {
  const valid = compilePointInTimeState({
    lane: 'spot_crypto', symbol: 'SOL', observedAt: 100, decisionAt: 110,
    features: [
      { key: 'momentum_24h', value: 0.02, observedAt: 100, availableAt: 101, pointInTime: true },
      { key: 'funding', value: -0.0001, observedAt: 105, availableAt: 106, pointInTime: true },
    ],
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.blockers.length, 0);
  assert.ok(valid.contentHash.length === 64);

  const invalid = compilePointInTimeState({
    lane: 'perpetuals', symbol: 'SOL-PERP', observedAt: 100, decisionAt: 110,
    features: [
      { key: 'future_open_interest', value: 1, observedAt: 120, availableAt: 121, pointInTime: true },
      { key: 'unversioned_social', value: 3, observedAt: 100, availableAt: 105, pointInTime: false },
    ],
  });
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.blockers, ['FEATURE_AFTER_DECISION:future_open_interest', 'NON_POINT_IN_TIME:unversioned_social']);
});

test('state-transition estimation shrinks tiny samples and counts the declared search family', () => {
  const tiny = estimateBinaryTransition([true, true], { alpha: 0.05, declaredTrials: 12, minimumSupport: 20 });
  assert.equal(tiny.support, 2);
  assert.equal(tiny.posteriorProbability, 0.75);
  assert.equal(tiny.disposition, 'blocked');
  assert.equal(tiny.reason, 'INSUFFICIENT_STATE_SUPPORT');
  assert.equal(tiny.declaredTrials, 12);

  const robust = estimateBinaryTransition([...Array(90).fill(true), ...Array(30).fill(false)],
    { alpha: 0.05, declaredTrials: 12, minimumSupport: 20, baselineProbability: 0.5 });
  assert.equal(robust.support, 120);
  assert.ok(robust.adjustedLowerBound > 0.5);
  assert.equal(robust.disposition, 'candidate');
});

test('evidence fingerprints change only when evidence or the research contract changes', () => {
  const a = evidenceFingerprint({ sourceHashes: ['b', 'a'], resolvedLabelIds: ['2', '1'], contractHash: 'contract' });
  const b = evidenceFingerprint({ sourceHashes: ['a', 'b'], resolvedLabelIds: ['1', '2'], contractHash: 'contract' });
  const c = evidenceFingerprint({ sourceHashes: ['a', 'b'], resolvedLabelIds: ['1', '2', '3'], contractHash: 'contract' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('execution policy chooses no-trade unless conservative net EV clears all costs', () => {
  const noTrade = chooseExecutionPolicy({
    predictedGrossEdgeBps: 18, uncertaintyBufferBps: 10, minimumNetEdgeBps: 5,
    taker: { enabled: true, feeBps: 5, halfSpreadBps: 3, slippageBps: 2, impactBps: 1, fundingBps: 0 },
    maker: { enabled: true, feeBps: 1, adverseSelectionBps: 6, impactBps: 1, fundingBps: 0, fillProbability: 0.4 },
  });
  assert.equal(noTrade.policy, 'no_trade');

  const trade = chooseExecutionPolicy({
    predictedGrossEdgeBps: 60, uncertaintyBufferBps: 8, minimumNetEdgeBps: 5,
    taker: { enabled: true, feeBps: 4, halfSpreadBps: 2, slippageBps: 2, impactBps: 1, fundingBps: 0 },
    maker: { enabled: true, feeBps: 0, adverseSelectionBps: 4, impactBps: 1, fundingBps: 0, fillProbability: 0.7 },
  });
  assert.equal(trade.policy, 'taker');
  assert.ok(trade.conservativeNetEdgeBps > 5);
  assert.equal(trade.liveExecution, 'locked');
});

test('execution policy can delay when retained edge beats immediate maker and taker choices', () => {
  const decision = chooseExecutionPolicy({
    predictedGrossEdgeBps: 80, uncertaintyBufferBps: 10, minimumNetEdgeBps: 5,
    taker: { enabled: true, feeBps: 20, halfSpreadBps: 15, slippageBps: 10, impactBps: 10, fundingBps: 0 },
    maker: { enabled: true, feeBps: 1, adverseSelectionBps: 8, impactBps: 2, fundingBps: 0, fillProbability: 0.2 },
    delayed: { enabled: true, feeBps: 4, halfSpreadBps: 3, slippageBps: 2, impactBps: 1, fundingBps: 0, edgeRetention: 0.8, delayBars: 1 },
  });
  assert.equal(decision.policy, 'delayed');
  assert.equal(decision.liveExecution, 'locked');
});

test('portfolio risk can veto an attractive standalone edge for crowding or tail loss', () => {
  const decision = portfolioRiskGate({
    conservativeNetEdgeBps: 40, maximumExistingCorrelation: 0.91, crowdingScore: 0.8,
    stressedLossBps: 900, remainingTailBudgetBps: 400, currentDrawdownBps: 100,
    maximumDrawdownBps: 600, maximumAllowedCorrelation: 0.75, maximumCrowdingScore: 0.7,
  });
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.blockers, ['DUPLICATE_OR_CORRELATED_ALPHA', 'CROWDING_LIMIT', 'TAIL_BUDGET_EXCEEDED', 'DRAWDOWN_LIMIT']);
  assert.equal(decision.paperOnly, true);
});

test('lifecycle moves from shadow to decay, kill, or re-research using explicit evidence', () => {
  assert.equal(transitionLifecycle('validated', { forwardResolved: 0, netEdgeLcbBps: null, decayRatio: null, hardRiskBreach: false }), 'paper_shadow');
  assert.equal(transitionLifecycle('paper_shadow', { forwardResolved: 40, netEdgeLcbBps: -2, decayRatio: 0.4, hardRiskBreach: false }), 're_research');
  assert.equal(transitionLifecycle('paper_shadow', { forwardResolved: 10, netEdgeLcbBps: 5, decayRatio: 0.9, hardRiskBreach: true }), 'killed');
});

test('durable ledger retains declined trials, forward observations, and honest lane coverage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-flywheel-'));
  const ledger = new FlywheelLedger(dir);
  const state = compilePointInTimeState({ lane: 'stocks', symbol: 'AAPL', observedAt: 1, decisionAt: 2,
    features: [{ key: 'close', value: 100, observedAt: 1, availableAt: 2, pointInTime: true }] });
  ledger.appendStates([state]);
  const trial: AlphaTrial = {
    id: 'trial_declined', candidateHash: 'candidate', evidenceFingerprint: 'evidence', lane: 'stocks',
    family: 'signed_event_drift', startedAt: 1, completedAt: 2, status: 'declined', reason: 'UNSIGNED_CATALYST',
    declaredTrials: 1, support: 100, liveExecution: 'locked',
  };
  ledger.appendTrials([trial]);
  ledger.appendTrials([trial]);
  const observation: ForwardObservation = {
    id: 'forward_1', trialId: trial.id, forecastAt: 10, resolveAt: 20, status: 'pending',
    predictedValue: 0.6, realizedValue: null, netPaperPnlBps: null, executionQuality: null,
  };
  ledger.appendForwardObservations([observation]);
  const coverage: FlywheelCoverage = {
    generatedAt: 30, lanes: {
      stocks: { status: 'blocked', observations: 100, trials: 1, blockers: ['UNSIGNED_CATALYST'] },
      spot_crypto: { status: 'implemented', observations: 200, trials: 2, blockers: [] },
      perpetuals: { status: 'partial', observations: 20, trials: 1, blockers: ['OPEN_INTEREST_HISTORY_MISSING'] },
      memecoins: { status: 'blocked', observations: 20, trials: 1, blockers: ['HOLDER_GRAPH_MISSING'] },
      prediction_markets: { status: 'partial', observations: 12, trials: 1, blockers: ['RESOLVED_LABELS_MISSING'] },
      cross_chain: { status: 'blocked', observations: 0, trials: 0, blockers: ['EXECUTABLE_QUOTES_MISSING'] },
    }, liveExecution: 'locked',
  };
  ledger.writeCoverage(coverage);
  const snapshot = ledger.snapshot();
  assert.equal(snapshot.states.length, 1);
  assert.equal(snapshot.candidates.length, 0);
  assert.equal(snapshot.validations.length, 0);
  assert.equal(snapshot.novelty.length, 0);
  assert.equal(snapshot.executionDecisions.length, 0);
  assert.equal(snapshot.portfolioDecisions.length, 0);
  assert.equal(snapshot.attributions.length, 0);
  assert.equal(snapshot.lifecycle.length, 0);
  assert.equal(snapshot.researchQueue.length, 0);
  assert.equal(snapshot.trials.length, 1);
  assert.equal(snapshot.trials[0].status, 'declined');
  assert.equal(snapshot.forwardObservations.length, 1);
  assert.equal(snapshot.coverage?.lanes.cross_chain.status, 'blocked');
  assert.deepEqual(snapshot.integrity.orphanTrialIds, ['trial_declined']);
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
  assert.equal(snapshot.liveExecution, 'locked');
});
