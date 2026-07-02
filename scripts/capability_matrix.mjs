#!/usr/bin/env node
/**
 * MetaMask Agent-Wallet capability -> UI reachability matrix.
 *
 * Goal 2 of MetaEdge: every MetaMask agent/wallet capability must be not just
 * PRESENT (a backend route) but REACHABLE through the UI (a user can trigger it).
 *
 * This script is self-verifying so the matrix can't silently rot:
 *   - "present" is re-checked by grepping server/metamask.ts for the route.
 *   - "direct UI" is re-checked by grepping src/ for a fetch to that path.
 *   - "orchestration" reachability (a capability a natural-language endpoint runs
 *     under the hood) is re-checked by grepping the mm CLI subcommand in the
 *     orchestration handlers.
 * If any assumption breaks, the row flips and the summary counts change.
 *
 * Run: node scripts/capability_matrix.mjs   (exit 0; --strict fails on regressions)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mmSrc = fs.readFileSync(path.join(root, 'server', 'metamask.ts'), 'utf8');

// Every file under src/ concatenated once — this is the UI surface a user can reach.
function readAll(dir) {
  let out = '';
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out += readAll(p);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out += `\n/*FILE:${p}*/\n` + fs.readFileSync(p, 'utf8');
  }
  return out;
}
const uiSrc = readAll(path.join(root, 'src'));

// Which src files fetch a given endpoint path (direct UI reachability).
function uiCallers(routePath) {
  const callers = new Set();
  // Boundary at the end so a route can't match a longer sibling
  // (e.g. /api/mm/login must not match /api/mm/login-browser).
  const re = new RegExp(routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w/-])');
  let file = 'src';
  for (const line of uiSrc.split('\n')) {
    const m = line.match(/\/\*FILE:(.+?)\*\//);
    if (m) { file = path.relative(root, m[1]); continue; }
    if (re.test(line)) callers.add(file);
  }
  return [...callers];
}

// The natural-language endpoints and the mm CLI subcommands each runs (read-only).
// Detected by grepping the handler bodies so it stays truthful if they change.
const orchestrators = [
  { name: 'Intent Solver', tab: 'intent', body: mmSrc.slice(mmSrc.indexOf("'/api/mm/intent/solve'"), mmSrc.indexOf("'/api/mm/chat'")) },
  { name: 'Autopilot', tab: 'autopilot', body: mmSrc.slice(mmSrc.indexOf("'/api/mm/autopilot/execute'")) },
];
function orchestratedBy(cliSubcmd) {
  return orchestrators.filter(o => o.body.includes(cliSubcmd)).map(o => o.name);
}

// The capability catalogue. `cli` is the mm subcommand the route runs, used to
// detect orchestration reachability. `kind`: readonly | execute | auth | ai | removed.
// Execute paths simulate in paper mode and run for real when LIVE_EXECUTION_ENABLED,
// so they're reachable (DIRECT) from the wallet modal in both modes.
// `planned` marks capabilities whose UI forms were deliberately removed from
// the wallet modal (it's a connection card now, not a second trading app) and
// whose real home is a product surface integration still to be built.
const CAPS = [
  { cap: 'Wallet readiness',   route: '/api/mm/readiness',        kind: 'readonly' },
  { cap: 'Wallet status',      route: '/api/mm/status',           kind: 'readonly', planned: 'superseded by connect/status' },
  { cap: 'Connect (login link)', route: '/api/mm/connect/start',  kind: 'auth' },
  { cap: 'Connect status poll',  route: '/api/mm/connect/status', kind: 'auth' },
  { cap: 'Connect (CLI token)',  route: '/api/mm/connect/token',  kind: 'auth' },
  { cap: 'Disconnect wallet',    route: '/api/mm/connect/disconnect', kind: 'auth' },
  { cap: 'Wallet address',     route: '/api/mm/address',          kind: 'readonly', cli: "'address'", planned: 'shown via connect/status in the wallet card' },
  { cap: 'Wallet balance',     route: '/api/mm/balance',          kind: 'readonly', cli: "'balance'", planned: 'Trading Desk (live-mode balance strip)' },
  { cap: 'Transfer / send',    route: '/api/mm/transfer',         kind: 'execute', planned: 'live-mode path; no paper UI by design' },
  { cap: 'Swap quote',         route: '/api/mm/swap/quote',       kind: 'readonly', cli: "'swap', 'quote'" },
  { cap: 'Swap execute',       route: '/api/mm/swap/execute',     kind: 'execute', planned: 'Trading Desk (live-mode execution)' },
  { cap: 'Perps balance',      route: '/api/mm/perps/balance',    kind: 'readonly', planned: 'Trading Desk (perps margin strip)' },
  { cap: 'Perps quote',        route: '/api/mm/perps/quote',      kind: 'readonly', planned: 'Trading Desk (order ticket preview)' },
  { cap: 'Perps open',         route: '/api/mm/perps/open',       kind: 'execute', planned: 'Trading Desk (live-mode execution)' },
  { cap: 'Predict markets',    route: '/api/mm/predict/markets',  kind: 'readonly', cli: "'predict', 'markets'" },
  { cap: 'Predict quote',      route: '/api/mm/predict/quote',    kind: 'readonly', planned: 'Predictions tab (real-market quotes)' },
  { cap: 'Predict place',      route: '/api/mm/predict/place',    kind: 'execute', planned: 'Predictions tab (live-mode placement)' },
  { cap: 'Intent solver',      route: '/api/mm/intent/solve',     kind: 'ai' },
  { cap: 'Swarm copilot chat', route: '/api/mm/chat',             kind: 'ai' },
  { cap: 'Autopilot planner',  route: '/api/mm/autopilot/execute',kind: 'ai' },
];

const rows = CAPS.map((c) => {
  const present = mmSrc.includes(`'${c.route}'`);
  const direct = uiCallers(c.route);
  const orch = c.cli ? orchestratedBy(c.cli) : [];
  let status;
  if (c.kind === 'removed') status = 'REMOVED';
  else if (direct.length) status = 'DIRECT';
  else if (orch.length) status = 'ORCHESTRATED';
  else if (c.planned) status = 'PLANNED';
  else status = 'UNREACHABLE';
  return { ...c, present, direct, orch, status };
});

const pad = (s, n) => String(s).padEnd(n);
console.log('\nMetaMask Agent-Wallet capability -> UI reachability\n');
console.log(pad('CAPABILITY', 20), pad('KIND', 10), pad('PRESENT', 9), pad('REACHABLE', 13), 'UI ENTRY');
console.log('-'.repeat(96));
for (const r of rows) {
  const entry = r.direct.length ? r.direct.join(', ')
    : r.orch.length ? `via ${r.orch.join(' / ')} (read-only)`
    : r.status === 'REMOVED' ? (r.note || 'intentionally removed')
    : r.status === 'PLANNED' ? `planned: ${r.planned}`
    : '—';
  console.log(pad(r.cap, 20), pad(r.kind, 10), pad(r.present ? 'yes' : 'NO', 9), pad(r.status, 13), entry);
}

const present = rows.filter(r => r.present).length;
// "Surfaced" = a user can reach it in the UI (direct or orchestrated).
// PLANNED = present in the backend with a declared product home still to be
// integrated (the wallet modal is a connection card, not a trading panel).
const surfaced = rows.filter(r => ['DIRECT', 'ORCHESTRATED'].includes(r.status));
const planned = rows.filter(r => r.status === 'PLANNED');
const unreachable = rows.filter(r => r.status === 'UNREACHABLE');
console.log('-'.repeat(96));
console.log(`\nPresent: ${present}/${rows.length}   Surfaced in UI: ${surfaced.length}/${rows.length}   Planned home declared: ${planned.length}   Unreachable gaps: ${unreachable.length}`);
if (planned.length) {
  console.log('\nPLANNED (backend ready, product-surface integration pending):');
  for (const r of planned) console.log(`  - ${r.cap} → ${r.planned}`);
}
if (unreachable.length) {
  console.log('\nUNREACHABLE (present in backend, no UI path and no declared home):');
  for (const r of unreachable) console.log(`  - ${r.cap} (${r.route}) [${r.kind}]`);
} else {
  console.log('\nNo unreachable gaps: every capability is surfaced, planned with a declared home, or removed by design.');
}

// --strict: fail if any present capability is UNREACHABLE. REMOVED (410) and
// GATED-UI (visible-but-locked execute) both count as intentionally handled.
if (process.argv.includes('--strict')) {
  const regressions = unreachable.filter(r => r.present);
  if (regressions.length) {
    console.error(`\nSTRICT FAIL: ${regressions.length} capabilit(ies) present but with no UI path.`);
    process.exit(1);
  }
  console.log('STRICT OK: no capability is present-but-unreachable.');
}
