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
// detect orchestration reachability. `kind`: readonly | execute | auth | ai.
const CAPS = [
  { cap: 'Wallet readiness',   route: '/api/mm/readiness',        kind: 'readonly' },
  { cap: 'Wallet status',      route: '/api/mm/status',           kind: 'readonly' },
  { cap: 'Browser login',      route: '/api/mm/login-browser',    kind: 'auth' },
  { cap: 'Token login',        route: '/api/mm/login',            kind: 'auth' },
  { cap: 'Wallet address',     route: '/api/mm/address',          kind: 'readonly', cli: "'address'" },
  { cap: 'Wallet balance',     route: '/api/mm/balance',          kind: 'readonly', cli: "'balance'" },
  { cap: 'Transfer / send',    route: '/api/mm/transfer',         kind: 'execute' },
  { cap: 'Swap quote',         route: '/api/mm/swap/quote',       kind: 'readonly', cli: "'swap', 'quote'" },
  { cap: 'Swap execute',       route: '/api/mm/swap/execute',     kind: 'execute' },
  { cap: 'Perps balance',      route: '/api/mm/perps/balance',    kind: 'readonly' },
  { cap: 'Perps quote',        route: '/api/mm/perps/quote',      kind: 'readonly' },
  { cap: 'Perps open',         route: '/api/mm/perps/open',       kind: 'execute' },
  { cap: 'Predict markets',    route: '/api/mm/predict/markets',  kind: 'readonly', cli: "'predict', 'markets'" },
  { cap: 'Predict quote',      route: '/api/mm/predict/quote',    kind: 'readonly' },
  { cap: 'Intent solver',      route: '/api/mm/intent/solve',     kind: 'ai' },
  { cap: 'Swarm copilot chat', route: '/api/mm/chat',             kind: 'ai' },
  { cap: 'Autopilot planner',  route: '/api/mm/autopilot/execute',kind: 'ai' },
];

const rows = CAPS.map((c) => {
  const present = mmSrc.includes(`'${c.route}'`);
  const direct = uiCallers(c.route);
  const orch = c.cli ? orchestratedBy(c.cli) : [];
  let status;
  if (direct.length) status = 'DIRECT';
  else if (orch.length) status = 'ORCHESTRATED';
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
    : '—';
  console.log(pad(r.cap, 20), pad(r.kind, 10), pad(r.present ? 'yes' : 'NO', 9), pad(r.status, 13), entry);
}

const present = rows.filter(r => r.present).length;
const reachable = rows.filter(r => r.status !== 'UNREACHABLE').length;
const unreachable = rows.filter(r => r.status === 'UNREACHABLE');
console.log('-'.repeat(96));
console.log(`\nPresent: ${present}/${rows.length}   Reachable: ${reachable}/${rows.length}   Unreachable: ${unreachable.length}`);
if (unreachable.length) {
  console.log('\nUNREACHABLE (present in backend, no UI path):');
  for (const r of unreachable) console.log(`  - ${r.cap} (${r.route}) [${r.kind}]`);
}

// --strict: fail if a capability is present but unreachable AND read-only/auth
// (execute paths are intentionally gated, so they don't fail the gate).
if (process.argv.includes('--strict')) {
  const regressions = unreachable.filter(r => r.present && r.kind !== 'execute');
  if (regressions.length) {
    console.error(`\nSTRICT FAIL: ${regressions.length} reachable-safe capabilit(ies) have no UI path.`);
    process.exit(1);
  }
}
