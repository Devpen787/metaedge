import { readDatabase, writeDatabase } from './storage.js';
import { evaluateKill, aggregateClosedTradesByFamily } from './killrule.mjs';

// KILL-RULE ENFORCEMENT, in-process.
//
// The rule lives in killrule.mjs and is shared with scripts/kill_check.mjs. This
// module is what makes it BIND: a strategy family that crosses the survivor bar
// downward gets its autopilot switched off instead of bleeding until a human
// notices. (`grid` reached 542 trades at -$0.48 each before Devin saw it.)
//
// Why in-process and not cron: enforcement must read-modify-write data/db.json.
// Node's single thread makes a synchronous read->mutate->write atomic WITHIN this
// process, but a cron script doing the same from a second process would clobber
// concurrent server writes. So the CLI reports; only the server enforces.
//
// FAIL-SAFE INVARIANT: the only mutation permitted here is `autopilot = false`.
// This guard can stop a strategy. It can never start one, size one up, or trade.

const INTERVAL_MS = 60 * 60 * 1000; // hourly

// Armed by default: an unenforced enforcer is the original bug one level up.
// Set KILL_GUARD_ENFORCE=false to downgrade to warn-only.
const ENFORCE = process.env.KILL_GUARD_ENFORCE !== 'false';

export function runKillGuard(): { violations: number; disabled: number } {
  // Synchronous read -> mutate -> write. Do NOT introduce an `await` between
  // readDatabase() and writeDatabase(): that opens a lost-update race.
  const db = readDatabase();
  const verdicts = aggregateClosedTradesByFamily(db).map(evaluateKill);
  const violations = verdicts.filter((v) => v.verdict === 'KILL');
  if (violations.length === 0) return { violations: 0, disabled: 0 };

  let disabled = 0;
  for (const v of violations) {
    console.warn(`[killguard] KILL-RULE VIOLATION — ${v.family}: ${v.reason}`);
    if (!ENFORCE) continue;

    for (const agent of Object.values(db.agents)) {
      if (agent.strategyType !== v.family || !agent.autopilot) continue;
      agent.autopilot = false; // the ONLY mutation this module may make
      disabled++;
      db.auditEvents.push({
        id: 'aud_killguard_' + agent.id + '_' + Date.now(),
        userId: agent.ownerId,
        username: 'system',
        action: 'CARD_KILLED',
        details: `Autopilot disabled by kill rule — ${v.family}: ${v.reason}`,
        timestamp: Date.now(),
      });
      console.warn(`[killguard] disabled autopilot on agent ${agent.id} (${agent.name})`);
    }
  }

  if (disabled > 0) writeDatabase(db);
  else if (!ENFORCE) console.warn('[killguard] KILL_GUARD_ENFORCE=false — violations logged, nothing disabled');

  return { violations: violations.length, disabled };
}

export function startKillGuard() {
  try { runKillGuard(); } catch (e: any) { console.warn('[killguard] first run failed:', e?.message); }
  setInterval(() => {
    try { runKillGuard(); } catch (e: any) { console.warn('[killguard] failed:', e?.message); }
  }, INTERVAL_MS).unref();
  console.log(`[killguard] armed — kill rule checked hourly (enforce=${ENFORCE})`);
}
