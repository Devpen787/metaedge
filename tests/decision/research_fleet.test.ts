import assert from 'node:assert/strict';
import test from 'node:test';
import { buildResearchFleetTradeView } from '../../server/research.js';

test('Research Fleet includes the legacy Golden Cross book in the existing trade list', () => {
  const db = {
    agents: {
      gc_book: { id: 'gc_book', strategyType: 'golden_cross' },
      baseline: { id: 'baseline', strategyType: 'momentum' }
    },
    trades: [
      {
        id: 'baseline-trade',
        agentId: 'baseline',
        timestamp: 100,
        assetSymbol: 'ETH',
        side: 'buy',
        size: 1,
        price: 1_800,
        thesis: { signalFamily: 'momentum', trigger: 'baseline trigger' }
      },
      {
        id: 'legacy-golden-cross-trade',
        agentId: 'gc_book',
        timestamp: 200,
        assetSymbol: 'BANK',
        side: 'buy',
        size: 2_930.145335,
        price: 0.17081064,
        thesis: { setup: '50/200 daily golden cross', trigger: 'vol 6.7x 50d-avg' }
      }
    ]
  } as any;

  const view = buildResearchFleetTradeView(db);
  assert.equal(view.totals.trades, 2);
  assert.equal(view.recent[0].family, 'golden_cross');
  assert.equal(view.recent[0].symbol, 'BANK');
  assert.equal(view.recent[0].variant, null);
  assert.equal(view.families.find((family: any) => family.family === 'golden_cross')?.trades, 1);
});

test('Research Fleet labels newly tagged Golden Cross entries by mode', () => {
  const db = {
    agents: { gc_book: { id: 'gc_book', strategyType: 'golden_cross' } },
    trades: [{
      id: 'tagged-golden-cross-trade',
      agentId: 'gc_book',
      timestamp: 300,
      assetSymbol: 'SOL',
      side: 'buy',
      size: 1,
      price: 100,
      thesis: {
        signalFamily: 'golden_cross',
        regime: 'strict',
        setup: '50/200 daily golden cross',
        trigger: 'fresh cross'
      }
    }]
  } as any;

  const view = buildResearchFleetTradeView(db);
  assert.equal(view.recent[0].family, 'golden_cross');
  assert.equal(view.recent[0].variant, 'strict');
});
