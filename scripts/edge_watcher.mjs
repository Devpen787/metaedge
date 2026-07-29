#!/usr/bin/env node
/**
 * EDGE WATCHER — the generic "don't miss it" layer. verdict_board.mjs requires
 * a human to remember to run it; Kalshi's FLAGS=2 sat unacted-on for days until
 * someone happened to ask. This watches ALL lanes automatically, detects a NEW
 * flip to FLAGS>0 (not a re-alert on one already known), and:
 *   - writes a loud, persistent record to data/edgeops/alerts.jsonl (never
 *     silently overwritten — an audit trail of every edge candidate ever found)
 *   - for 'binary' lanes (Kalshi-style), just notes whether a forward harness
 *     already exists (kalshi_paper_harness.mjs does)
 *   - for 'directional' lanes (momentum/memecoin/stocks/perps/fx), calls
 *     directional_harness.mjs's spinUp() so a real forward paper position starts
 *     automatically, instead of waiting for someone to notice and hand-build one
 *     (which is exactly what happened with Kalshi before this existed).
 *
 * Idempotent: a lane already known-flagged does not re-trigger every run; only
 * a 0->>0 or first-ever-seen transition counts as "new." State lives in
 * data/edgeops/watcher_state.json.
 *
 * Shares LANES/parsing with verdict_board.mjs (imported, not duplicated) so the
 * two can never silently drift apart.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LANES, countRows, lastVerdict, flagsOf } from './verdict_board.mjs';
import { spinUp } from './directional_harness.mjs';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Watches every lane in verdict_board.mjs\'s LANES array for a 0->>0 (first-ever or newly-flagged) FLAGS transition, logs it to alerts.jsonl, and auto-spins-up a forward paper harness for \'directional\' lanes.',
  notYet: [
    'Only reacts to a FLAGS flip, not to any other kind of change (e.g., a lane going stale/no-longer-accruing is not detected or alerted on).',
    'Auto-harness only exists for lane kind==\'directional\' (via directional_harness.spinUp) — \'binary\' lanes (Kalshi-style) get a log note to verify a bespoke harness exists, and lanes with kind==null get no automated action at all, by design (mm/xvenue/carry have bespoke measurement, not a sizeable directional bet).',
    'One alerts.jsonl sink only — no external notification channel (Slack/webhook/etc.) exists yet; see the RPC typed-notification-fan-out item in EXTERNAL_REPO_ADOPTION_CHECKLIST.md for the planned upgrade.',
  ],
  why: [
    'Exists specifically because Kalshi\'s FLAGS=2 sat unacted-on for days before anyone happened to check — this automates "don\'t miss the opportunity we already found," not just "record the opportunity."',
    'Idempotent by design (state in watcher_state.json) — a lane already known-flagged does not re-trigger every run; only a genuine 0->>0 transition counts as new, so this cannot spam duplicate alerts or duplicate harness spin-ups.',
    'Imports (not duplicates) LANES/helpers from verdict_board.mjs specifically so the two can never silently drift apart on what a lane\'s FLAGS or kind actually is.',
  ],
};

const E = path.join(process.cwd(), 'data', 'edgeops');
const STATE_FP = path.join(E, 'watcher_state.json');
const ALERTS_FP = path.join(E, 'alerts.jsonl');

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FP, 'utf8')); } catch { return {}; } }
function saveState(s) { fs.mkdirSync(E, { recursive: true }); fs.writeFileSync(STATE_FP, JSON.stringify(s, null, 1)); }

async function run() {
  const state = loadState();
  const newFlips = [];

  for (const L of LANES) {
    const v = L.log ? lastVerdict(path.join(...L.log), L.tag) : null;
    const flags = flagsOf(v);
    const prevFlags = state[L.name]?.flags ?? 0;
    state[L.name] = { flags: flags ?? 0, lastCheckedAt: Date.now(), lastVerdictLine: v || state[L.name]?.lastVerdictLine || null };
    if (flags > 0 && prevFlags === 0) newFlips.push({ lane: L, verdict: v, flags });
  }
  saveState(state);

  if (!newFlips.length) {
    console.log(`[watcher] ${new Date().toISOString()} checked ${LANES.length} lanes, no new flips.`);
    return;
  }

  for (const { lane, verdict, flags } of newFlips) {
    const alert = { t: Date.now(), lane: lane.name, kind: lane.kind, flags, verdict };
    fs.appendFileSync(ALERTS_FP, JSON.stringify(alert) + '\n');
    console.log(`\n*** NEW EDGE FLAG — ${lane.name} (FLAGS=${flags}) ***`);
    console.log(`  ${verdict}`);

    if (lane.kind === 'binary') {
      console.log(`  action: binary-payout lane — verify a bespoke forward harness exists (Kalshi has kalshi_paper_harness.mjs); build one by hand if not.`);
    } else if (lane.kind === 'directional') {
      console.log(`  action: spinning up a forward paper harness automatically via directional_harness.mjs...`);
      try {
        const res = await spinUp(lane.name);
        console.log(`  harness: ${res.opened} position(s) opened, tracking on the portfolio ledger + Risk OS.`);
        if (res.blocked?.length) console.log(`  cooldown/low-profit guard skipped ${res.blocked.length} candidate(s): ${res.blocked.map((b) => `${b.symbol} (${b.reason})`).join(', ')}`);
      } catch (e) {
        console.error(`  harness FAILED to spin up: ${e.message} — flag stays logged in alerts.jsonl for manual follow-up.`);
      }
    } else {
      console.log(`  action: no auto-harness defined for this lane kind — needs a hand-built one, same as Kalshi originally did.`);
    }
  }
}
run().catch((e) => console.error('[watcher] failed:', e.message));
