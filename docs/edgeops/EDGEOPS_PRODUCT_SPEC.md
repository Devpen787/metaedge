# EdgeOps Product Spec

Date: 2026-07-07

## Change Name

`edgeops-paper-trade-thesis-v1`

## Product Boundary

MetaEdge SHALL remain paper-first. EdgeOps records research evidence and paper
trade theses. It SHALL NOT present live execution, live pooling, yield, or real
profit claims unless separately proven by code and deployment state.

## User Job

I am a MetaEdge operator or paper trader. I need each paper trade to capture why
it was taken, what would invalidate it, and what evidence it produced, so that
MetaEdge can learn which signals deserve more testing and which are noise.

## Current Truth To Preserve

- Paper fills and P&L accounting already flow through `server/trades.ts`.
- Autopilot already places real paper trades through the same ledger in
  `server/autotrader.ts`.
- Quant Engine already has a real 100-day Binance backtest in `server/quant.ts`.
- Alternative data in Quant Engine is simulated and must stay labeled that way
  until real feeds exist.
- Agent UI and arena competition should not claim strategy quality from rank
  alone.

## Scope In

- Add a paper-trade thesis object to manual, copilot, intent, and Autopilot
  paper fills.
- Add research-card IDs and signal tags to paper trades.
- Add post-trade review fields.
- Add weekly evidence reporting.
- Preserve existing paper-trade execution path and ownership checks.

## Scope Out

- No live trading.
- No automatic real-money execution.
- No paid signal recommendations.
- No strategy marketplace claim.
- No hidden localStorage state for canonical trade thesis data.

## Data Model Draft

```ts
type EdgeOpsSignalFamily =
  | 'regime'
  | 'technical'
  | 'liquidity'
  | 'catalyst'
  | 'sentiment'
  | 'manipulation_risk'
  | 'execution'
  | 'risk_management';

type EdgeOpsTradeThesis = {
  id: string;
  tradeId?: string;
  agentId: string;
  userId: string;
  cardId?: string;
  createdAt: number;
  source: 'manual' | 'copilot' | 'intent_solver' | 'autopilot' | 'arena_bot';
  assetSymbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  setup: string;
  trigger: string;
  exitThesis?: string;
  plannedExitReason?: 'target' | 'stop' | 'invalidation' | 'time_stop' | 'regime_shift' | 'manual_review';
  regime: {
    trend: 'up' | 'down' | 'sideways' | 'mixed' | 'unknown';
    volatility: 'low' | 'normal' | 'high' | 'extreme' | 'unknown';
    liquidity: 'healthy' | 'thin' | 'wide_spread' | 'unknown';
  };
  signalFamilies: EdgeOpsSignalFamily[];
  catalyst?: {
    type: string;
    summary: string;
    sourceUrl?: string;
    eventStage?: 'pre_event' | 'event_release' | 'post_event' | 'none' | 'unknown';
    evidenceQuality: 'official' | 'credible_media' | 'onchain' | 'social_only' | 'rumor' | 'none';
  };
  sentiment?: {
    classification: 'organic_attention' | 'catalyst_followthrough' | 'pump_risk' | 'rumor' | 'unusable' | 'none';
    sourceUrl?: string;
    manipulationRisk: 'low' | 'medium' | 'high' | 'unknown';
  };
  liquidity?: {
    spreadBps?: number;
    volumeZScore?: number;
    depthUsd?: number;
    notes?: string;
  };
  orderFlowState?: 'confirmed' | 'divergent' | 'absorption' | 'unavailable' | 'unknown';
  invalidation: string;
  invalidationsOverridden?: string[];
  riskUnit?: number;
  plannedR?: number;
  holdingWindow: string;
  executionAssumption?: {
    orderType?: 'market' | 'limit' | 'paper_mid' | 'unknown';
    slippageBudgetBps?: number;
    liveFillRisk?: 'low' | 'medium' | 'high' | 'unknown';
  };
  benchmarkFamily?: 'current_autopilot' | 'random_entry' | 'buy_hold' | 'htf_momentum' | 'relative_strength' | 'other';
  approvalRequired?: boolean;
  confidence: 'low' | 'medium' | 'high';
  disqualifiers: string[];
  allowedClaim: 'not_enough_evidence' | 'paper_test' | 'backtest_only' | 'paper_promising' | 'killed';
};

type EdgeOpsPostTradeReview = {
  id: string;
  tradeId: string;
  thesisId: string;
  reviewedAt: number;
  outcome: 'win' | 'loss' | 'scratch' | 'open';
  pnl?: number;
  realizedR?: number;
  maxFavorableExcursionPct?: number;
  maxAdverseExcursionPct?: number;
  thesisFollowed: boolean;
  planAdherence?: 'followed' | 'partial' | 'violated' | 'unknown';
  invalidationHit: boolean;
  primaryOutcomeDriver: 'signal' | 'market_beta' | 'execution' | 'regime_shift' | 'manipulation_noise' | 'luck' | 'unknown';
  lesson: string;
  mistakeTags: string[];
  nextDecision: 'keep_testing' | 'modify' | 'kill' | 'promote_paper_only';
};
```

## SHALL Requirements

- The system SHALL store paper-trade thesis data server-side, tied to the
  session user and paper trade.
- The system SHALL support trades without a complete thesis only when explicitly
  tagged `thesis_missing`.
- The system SHALL require an invalidation field before a trade can be counted
  as EdgeOps-complete.
- The system SHALL separate backtest evidence from paper-forward evidence.
- The system SHALL preserve paper-only labeling across EdgeOps UI.
- The system SHALL show when signal, catalyst, sentiment, or liquidity data is
  missing.
- The system SHALL make manipulation risk a first-class field, not a footnote.
- The system SHALL prevent social sentiment from being treated as a standalone
  high-confidence trigger.
- The system SHALL compare any promoted strategy against current Autopilot,
  random entry, and buy/hold baselines.
- The system SHALL include a post-trade review path before a signal can be
  promoted beyond `paper_test`.
- The system SHALL capture planned exit logic, not only entry logic.
- The system SHALL record liquidity or execution assumptions when a paper fill
  depends on conditions that may not transfer to live markets.
- The system SHALL allow users or agents to mark invalidations that were
  knowingly overridden, so post-trade review can distinguish edge failure from
  discipline failure.
- The system SHALL keep autonomous-agent actions bounded by paper mode, exposure
  caps, and explicit approval requirements before any future live/wallet surface.
- The system SHALL represent missing order-flow data honestly instead of
  pretending CVD, depth, or absorption signals exist.
- The system SHALL classify event stage for catalysts so "good news" can be
  tested as pre-event continuation, event-release sell pressure, or post-event
  digestion.
- The system SHALL support R-multiple review so raw P&L does not hide bad risk
  structure or poor plan adherence.

## GIVEN / WHEN / THEN

### Manual Trade With Complete Thesis

GIVEN a user is placing a paper trade
WHEN setup, trigger, regime, invalidation, and holding window are present
THEN the trade may be tagged `edgeops_complete` and included in signal-family
reports.

### Sentiment Without Confirmation

GIVEN a proposed trade is justified only by X/Twitter or Telegram attention
WHEN no catalyst or liquidity confirmation exists
THEN the trade SHALL be blocked from high-confidence status and tagged
`sentiment_unconfirmed`.

### Autopilot Baseline

GIVEN Autopilot places a paper trade from its current 24h-change strategy
WHEN no thesis generator is available
THEN the system SHALL attach a baseline thesis that names the strategy rule and
marks the evidence grade as `baseline`.

### Quant Backtest Result

GIVEN Quant Engine returns a strong in-sample result
WHEN out-of-sample, benchmark, or trial-count evidence is weak or missing
THEN the result SHALL remain `backtest_only` and SHALL NOT be deploy-promoted.

### Post-Trade Review

GIVEN a paper trade closes
WHEN the user or agent reviews the outcome
THEN the review SHALL classify outcome driver and decide whether to keep,
modify, kill, or continue testing the signal.

## Acceptance Criteria

- Every EdgeOps-complete trade has setup, trigger, regime, invalidation, holding
  window, and signal family.
- Every signal card has a falsifier.
- Every weekly EdgeOps report includes incomplete-thesis counts.
- No UI claims alpha, profitability, or live-readiness.
- Any "deploy" language in Quant Engine is backed by a real API path or changed
  to "save research card" / "create paper test".

## First Smallest Implementation Step

Add server-side thesis storage and attach optional thesis payloads to
`/api/trades` and `/api/copilot/execute`, while preserving the existing
`placePaperTrade` path. Do not modify Autopilot logic yet. The first UI can be a
compact "Trade thesis" panel on the manual Trading Desk, with incomplete thesis
trades still allowed but clearly excluded from EdgeOps reports.
