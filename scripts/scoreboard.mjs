#!/usr/bin/env node
// The Edge Portfolio OS scoreboard (docs/EDGE_PORTFOLIO_OS.md).
//
// One fixed set of counters, generated from stored state — never hand-typed.
// A number that cannot be produced from the database is shown as "— (not wired)"
// rather than faked, because a capability that can't be measured isn't real yet.
//
// Usage: npm run scoreboard  [--json]
import fs from 'node:fs';
import path from 'node:path';

const DB = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'db.json');
const REGISTRY = path.join(process.cwd(), 'data', 'edgeops', 'hypothesis-registry.jsonl');
const asJson = process.argv.includes('--json');

const db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : {};
const rt = db.decisionRuntime || { strategySpecs: {}, validations: {}, decisions: [] };
const decisions = rt.decisions || [];
const validations = Object.values(rt.validations || {});
const trades = db.trades || [];

// Decisions this cycle-window, by terminal outcome.
const byOutcome = { decline: 0, research_hypothesis: 0, paper_trade_candidate: 0 };
for (const d of decisions) if (d.outcome in byOutcome) byOutcome[d.outcome]++;

// Validated = a validation that actually authorizes forward paper (names symbols).
const validated = validations.filter((v) => v.status === 'forward_paper_candidate');

// Routed decisions → real paper trades. P&L is the ledger truth for those trades.
const routedDecisionIds = new Set(decisions.filter((d) => d.queueStatus === 'routed').map((d) => d.id));
const decisionTrades = trades.filter((t) => t.thesis?.decisionId && routedDecisionIds.has(t.thesis.decisionId));
const closed = decisionTrades.filter((t) => typeof t.pnl === 'number');
const paperPnl = closed.reduce((s, t) => s + t.pnl, 0);

// Max drawdown across the closed decision-trade equity curve (chronological).
let eq = 0, peak = 0, mdd = 0;
for (const t of [...closed].sort((a, b) => a.timestamp - b.timestamp)) {
  eq += t.pnl; peak = Math.max(peak, eq); mdd = Math.max(mdd, peak - eq);
}

// Historically-screened hypotheses = walk-forward test rows in the registry.
let screened = 0;
if (fs.existsSync(REGISTRY)) {
  for (const line of fs.readFileSync(REGISTRY, 'utf8').split('\n')) {
    if (line.includes('"phase":"test"') || line.includes('"phase": "test"')) screened++;
  }
}

// Active paper strategies = distinct (agent, strategy) pairs the runtime is trading.
const activePairs = new Set(decisionTrades.map((t) => `${t.agentId}:${t.thesis?.strategyHash || t.thesis?.cardId}`));

const board = {
  generatedAt: new Date().toISOString(),
  lane_status: {
    spot: 'live · candidates found',
    perps: 'data live · no tenant (carry killed)',
    predictions: 'not recording yet',
    cross_chain: 'not recording yet',
    quant_meta: 'embryonic',
  },
  observed: decisions.length,
  hypotheses_generated: byOutcome.research_hypothesis,
  historically_screened: screened,
  validated_candidates: validated.length,
  active_paper_strategies: activePairs.size,
  paper_trades_routed: decisionTrades.length,
  post_cost_paper_pnl_usd: Number(paperPnl.toFixed(2)),
  max_drawdown_usd: Number(mdd.toFixed(2)),
  killed: '— (kill events not yet persisted as a stream)',
  promoted: '— (promotion events not yet persisted as a stream)',
  cross_lane_correlation: '— (needs ≥2 lanes producing)',
  last_cycle: rt.lastCycle || null,
};

if (asJson) { console.log(JSON.stringify(board, null, 2)); process.exit(0); }

const line = (k, v) => console.log(`  ${String(k).padEnd(26)} ${v}`);
console.log('\n=== Edge Portfolio OS — scoreboard ===');
console.log(`  ${board.generatedAt}\n`);
console.log('  Lanes:');
for (const [k, v] of Object.entries(board.lane_status)) console.log(`    ${k.padEnd(13)} ${v}`);
console.log('\n  Pipeline (from stored state):');
line('observed (decisions)', board.observed);
line('hypotheses generated', board.hypotheses_generated);
line('historically screened', board.historically_screened);
line('validated candidates', board.validated_candidates);
line('active paper strategies', board.active_paper_strategies);
line('paper trades routed', board.paper_trades_routed);
line('post-cost paper P&L', `$${board.post_cost_paper_pnl_usd}`);
line('max drawdown', `$${board.max_drawdown_usd}`);
line('killed', board.killed);
line('promoted', board.promoted);
line('cross-lane correlation', board.cross_lane_correlation);
if (board.last_cycle) {
  const c = board.last_cycle;
  console.log(`\n  Last cycle ${c.cycleId || ''}: evaluated=${c.evaluated} declines=${c.declines} hypotheses=${c.hypotheses} candidates=${c.paperCandidates} routed=${c.routed}${c.error ? ` error=${c.error}` : ''}`);
}
console.log('');
