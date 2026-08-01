import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { FEATURE_VERSIONS } from '../../server/decision/features.js';
import { compileFrozenStrategy } from '../../server/decision/specs.js';
import type { StrategyPlugin } from '../../server/decision/types.js';
import { validateFrozenStrategy, type HistoricalDataset } from '../../server/decision/validator.js';

const plugin: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5',
  id: 'fixture_next_bar', version: '1.0.0', mechanism: 'test next-bar causality', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price], parameters: {}, benchmark: 'fixture',
  falsifier: 'fixture turns negative', expectedFailureRegimes: [],
  regimeGate: () => ({ eligible: true, reason: 'FIXTURE' }),
  generateSignal(context) {
    return context.position.holding
      ? { action: 'sell', strength: 1, setup: 'fixture', trigger: 'next exit', invalidation: 'closed', regime: 'fixture' }
      : { action: 'buy', strength: 1, setup: 'fixture', trigger: 'next entry', invalidation: 'next bar', regime: 'fixture' };
  },
};

function dataset(): HistoricalDataset {
  const bars = Array.from({ length: 260 }, (_, i) => {
    const o = 100 * 1.002 ** i;
    const c = o * 1.001;
    return { t: i * 3_600_000, o, h: c * 1.001, l: o * 0.999, c, v: 1_000, qv: 100_000_000 };
  });
  const body = JSON.stringify(bars);
  return { id: 'fixture:TEST:1h', hash: crypto.createHash('sha256').update(body).digest('hex'), provider: 'fixture', venue: 'spot', symbol: 'TEST', bars };
}

test('walk-forward validation is reproducible, finite, and promotes only after precommitted gates pass', () => {
  const spec = compileFrozenStrategy(plugin, 10);
  const options = {
    codeCommit: 'fixture-commit', validatedAt: 20,
    config: {
      warmupBars: 20, foldBars: 40, embargoBars: 2, costBpsPerSide: 1,
      minimumTrades: 20, minimumProfitFactor: 1.01, minimumPositiveFoldRatio: 0.8,
      minimumTstat: 1, requireBenchmarkOutperformance: false,
    },
  };
  const first = validateFrozenStrategy(spec, plugin, [dataset()], options);
  const second = validateFrozenStrategy(spec, plugin, [dataset()], { ...options, validatedAt: 999 });
  assert.equal(first.id, second.id);
  assert.equal(first.status, 'forward_paper_candidate');
  assert.deepEqual(first.reasons, ['ALL_PRECOMMITTED_GATES_PASSED']);
  assert.ok((first.metrics?.trades || 0) >= 20);
  assert.ok(Number.isFinite(first.metrics?.profitFactor));
  assert.doesNotThrow(() => JSON.stringify(first));
});

test('insufficient samples remain inconclusive rather than being promoted', () => {
  const spec = compileFrozenStrategy(plugin, 10);
  const result = validateFrozenStrategy(spec, plugin, [dataset()], {
    codeCommit: 'fixture-commit',
    config: { warmupBars: 20, foldBars: 40, embargoBars: 2, minimumTrades: 10_000 },
  });
  assert.equal(result.status, 'inconclusive');
  assert.ok(result.reasons.includes('SAMPLE_INSUFFICIENT'));
});
