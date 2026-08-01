import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildResearchFleetTradeView } from '../../server/research.js';
import { ResearchFleetFamilyCard, ResearchFleetOperatorTruth, type Family, type OperatorTruthData } from '../../src/components/ResearchFleet.js';

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
  assert.equal(view.v5Totals.trades, 0);
  assert.equal(view.legacyTotals.trades, 2);
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

test('legacy history never enters V5 Research Fleet metrics', () => {
  const db = {
    agents: {},
    trades: [
      { id: 'v5', agentId: 'a', timestamp: 2, assetSymbol: 'BTC', side: 'buy', size: 1, price: 100,
        experimentId: 'exp_v5', experimentLabel: 'V5', thesis: { signalFamily: 'momentum_24h' } },
      { id: 'legacy', agentId: 'b', timestamp: 1, assetSymbol: 'BTC', side: 'buy', size: 1, price: 100,
        thesis: { signalFamily: 'momentum_24h' } },
    ],
    experimentsV5: { specs: {}, states: {}, budgets: {}, observations: [], lifecycleEvents: [] },
  } as any;
  const view = buildResearchFleetTradeView(db);
  assert.equal(view.totals.trades, 2);
  assert.equal(view.v5Totals.trades, 1);
  assert.equal(view.legacyTotals.trades, 1);
  assert.equal(view.recent.find((trade: any) => trade.id === 'v5')?.legacy, false);
  assert.equal(view.recent.find((trade: any) => trade.id === 'legacy')?.legacy, true);
});

function family(state: string, overrides: Partial<Family> = {}): Family {
  return {
    key: `exp_${state}`,
    family: 'golden_cross',
    label: state === 'strict' ? 'Golden Cross · Strict V5' : state === 'participate' ? 'Golden Cross · Participate V5' : 'Fixture V5',
    experimentId: `exp_${state}`,
    cardId: 'fixture',
    trades: 0,
    closed: 0,
    wins: 0,
    realizedPnl: 0,
    lastTradeAt: 0,
    lastTrigger: '',
    authorityVersion: 5,
    legacy: false,
    lifecycleState: state,
    permission: 'paper_discovery',
    health: 'healthy',
    regime: 'fixture_regime',
    orders: { total: 0, active: 0, unresolved: 0, latestStatus: 'none', latestIntentId: null, latestReason: null },
    lineage: {
      experimentId: `exp_${state}`, strategyHash: 'strategy_hash', specHash: 'spec_hash', trialId: 'trial_id', parentExperimentId: null,
      opportunityObservationIds: ['opportunity_id'], reservationIds: ['reservation_id'], orderIntentIds: [], fillIds: [], outcomeIds: [],
    },
    outcomes: [],
    ...overrides,
  };
}

test('every V5 lifecycle state renders in the responsive existing-list card', () => {
  const states = ['draft', 'research-only', 'discovery', 'confirmed', 'dormant', 'probation', 'reduced', 'retired', 'live-review-locked'];
  for (const state of states) {
    const html = renderToStaticMarkup(React.createElement(ResearchFleetFamilyCard, { family: family(state) }));
    assert.match(html, new RegExp(state.toUpperCase()));
    assert.match(html, /V5/);
    assert.match(html, /min-w-0/);
    assert.match(html, /Lineage and recent outcomes/);
  }
});

test('Golden Cross variants remain distinct and unresolved orders are impossible to miss', () => {
  const strict = renderToStaticMarkup(React.createElement(ResearchFleetFamilyCard, { family: family('strict') }));
  const participate = renderToStaticMarkup(React.createElement(ResearchFleetFamilyCard, { family: family('participate', {
    orders: { total: 1, active: 1, unresolved: 1, latestStatus: 'UNRESOLVED', latestIntentId: 'intent', latestReason: 'uncertain' },
  }) }));
  assert.match(strict, /Golden Cross · Strict V5/);
  assert.match(participate, /Golden Cross · Participate V5/);
  assert.match(participate, /role="alert"/);
  assert.match(participate, /unresolved order/);
  assert.match(participate, /still reserve portfolio risk/);
});

test('operator truth keeps mechanics, economics, fixtures, incidents, and live authority separate in the existing view', () => {
  const truth: OperatorTruthData = {
    mechanics: { status: 'go_local_paper_operation', reasons: [] },
    economics: { status: 'unproven_no_organic_outcomes', edgeProven: false, organicOutcomes: 0, reviewCandidates: 0 },
    deployment: { authorized: false, status: 'not_authorized' },
    liveExecution: 'locked',
    latestCycle: { cycleId: 'cycle', organicEvaluated: 5418, organicRouted: 0, assuranceExcluded: 2,
      noRouteClassification: 'expected_no_trade', explanation: 'No valid trigger was present.',
      blockingReasons: [{ category: 'regime', reason: 'REGIME_NOT_ELIGIBLE', count: 30 }] },
    forwardOperation: { totalCheckpoints: 10, activeIncidents: [{ code: 'EVIDENCE_PIPELINE_BLOCKED', severity: 'attention', message: 'Evidence missing.' }], latestCheckpoint: { consecutiveZeroRouteCycles: 10 } },
    latestAcceptanceBundle: { bundleId: 'bundle', bundleHash: '123456789012345678901234567890', generatedAt: 1, scope: 'isolated' },
    boundaries: ['PAPER_ONLY'],
  };
  const html = renderToStaticMarkup(React.createElement(ResearchFleetOperatorTruth, { truth }));
  assert.match(html, /GO · paper operation/);
  assert.match(html, /This does not prove an edge/);
  assert.match(html, /0 organic routes \/ 5418 checks/);
  assert.match(html, /Assurance excluded: 2/);
  assert.match(html, /Deployment: not authorized/);
  assert.match(html, /Live locked/);
  assert.match(html, /REGIME_NOT_ELIGIBLE/);
  assert.match(html, /EVIDENCE_PIPELINE_BLOCKED/);
});
