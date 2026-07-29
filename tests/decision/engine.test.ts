import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVersionedFeatures } from '../../server/decision/features.js';
import { DECISION_LAYER_ORDER } from '../../server/decision/gates.js';
import { evaluateLayeredDecision } from '../../server/decision/engine.js';
import { rsiMeanReversionV1 } from '../../server/decision/plugins.js';
import { compileFrozenStrategy } from '../../server/decision/specs.js';
import type { DecisionContext, ValidationRecord } from '../../server/decision/types.js';

const now = 1_784_044_000_000;

function oversoldUptrendCloses() {
  const values = Array.from({ length: 205 }, (_, i) => 70 + i * 0.15);
  for (let i = 0; i < 15; i++) values.push(100 - i * 1.2);
  return values;
}

function context(overrides: Partial<DecisionContext> = {}): DecisionContext {
  const closes = oversoldUptrendCloses();
  const features = buildVersionedFeatures({
    symbol: 'DOT', price: 120, change24hPct: -5, volume24hUsd: 100_000_000,
    high24h: 123, low24h: 115, hourlyCloses: closes, fundingHourly: 0.0000125,
    openInterestUsd: 80_000_000,
    sources: {
      market: { provider: 'fixture', dataset: 'market', observedAt: now - 1_000, retrievedAt: now },
      history: { provider: 'fixture', dataset: 'history', observedAt: now - 60_000, retrievedAt: now },
      funding: { provider: 'fixture', dataset: 'funding', observedAt: now - 60_000, retrievedAt: now },
    },
    staleBudgets: { market: 300_000, history: 5_400_000, funding: 5_400_000 },
  });
  return {
    cycleId: 'cycle_test', evaluatedAt: now, symbol: 'DOT', instrument: 'spot',
    universe: { tier: 1, included: true, reason: 'criterion', observedAt: now, quality: 'good' }, features,
    position: { holding: false, openNotionalUsd: 0, averageEntryPrice: 0 },
    limits: {
      liquidityFloorUsd: 50_000_000, staleBudgetMs: 300_000,
      modeledRoundTripCostBps: 20, maxRoundTripCostBps: 40,
      requestedNotionalUsd: 250, riskBudgetUsd: 250,
      portfolioOpenNotionalUsd: 0, portfolioMaxNotionalUsd: 2_500,
    },
    ...overrides,
  };
}

function validation(hash: string, status: ValidationRecord['status']): ValidationRecord {
  return {
    id: `validation_${status}`, strategyHash: hash, status,
    datasetId: 'fixture', datasetHash: 'abc', codeCommit: 'test', folds: 9,
    costBpsPerSide: 10, benchmark: 'buy_hold', reasons: ['fixture'], validatedAt: now, symbols: ['DOT'],
  };
}

test('strategy compilation is content-addressed and independent of creation time', () => {
  const a = compileFrozenStrategy(rsiMeanReversionV1, now);
  const b = compileFrozenStrategy(rsiMeanReversionV1, now + 1000);
  assert.equal(a.hash, b.hash);
  assert.equal(a.id, b.id);
});

test('all decision layers are recorded in stable order and portfolio can veto a signal', () => {
  const spec = compileFrozenStrategy(rsiMeanReversionV1, now);
  const base = context();
  const capped = context({ limits: { ...base.limits, portfolioOpenNotionalUsd: 2_500 } });
  const decision = evaluateLayeredDecision(capped, rsiMeanReversionV1, spec, validation(spec.hash, 'forward_paper_candidate'));
  assert.deepEqual(decision.gates.map((gate) => gate.layer), DECISION_LAYER_ORDER);
  assert.equal(decision.outcome, 'decline');
  assert.equal(decision.reason, 'POSITION_CAP');
});

test('an unvalidated signal becomes a research hypothesis, never a paper candidate', () => {
  const spec = compileFrozenStrategy(rsiMeanReversionV1, now);
  const decision = evaluateLayeredDecision(context(), rsiMeanReversionV1, spec);
  assert.equal(decision.signal?.action, 'buy');
  assert.equal(decision.outcome, 'research_hypothesis');
  assert.equal(decision.queueStatus, 'not_queued');
});

test('only a matching forward-paper validation promotes the signal to the candidate queue', () => {
  const spec = compileFrozenStrategy(rsiMeanReversionV1, now);
  const decision = evaluateLayeredDecision(context(), rsiMeanReversionV1, spec, validation(spec.hash, 'forward_paper_candidate'));
  assert.equal(decision.outcome, 'paper_trade_candidate');
  assert.equal(decision.queueStatus, 'queued');
});

test('a rejected strategy remains declined even when market conditions trigger', () => {
  const spec = compileFrozenStrategy(rsiMeanReversionV1, now);
  const decision = evaluateLayeredDecision(context(), rsiMeanReversionV1, spec, validation(spec.hash, 'rejected'));
  assert.equal(decision.outcome, 'decline');
  assert.equal(decision.reason, 'VALIDATION_REJECTED');
});

test('a passing validation cannot authorize a symbol outside its recorded scope', () => {
  const spec = compileFrozenStrategy(rsiMeanReversionV1, now);
  const scoped = validation(spec.hash, 'forward_paper_candidate');
  scoped.symbols = ['BTC'];
  const decision = evaluateLayeredDecision(context(), rsiMeanReversionV1, spec, scoped);
  assert.equal(decision.outcome, 'research_hypothesis');
  assert.equal(decision.reason, 'VALIDATION_SCOPE_MISMATCH');
  assert.equal(decision.queueStatus, 'not_queued');
});
