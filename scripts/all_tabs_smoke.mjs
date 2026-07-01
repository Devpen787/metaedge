// Data-layer smoke for every MetaEdge tab: confirms each tab's backend endpoint
// is reachable and does not 5xx. Repo-native (no browser deps). Happy-path by
// design — it verifies the data layer, not in-tab UI flows.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:3000';
const tmpDir = await mkdtemp(path.join(tmpdir(), 'metaedge-tabs-'));
const dbPath = path.join(tmpDir, 'db.json');

function parseCookie(header) {
  const match = header?.match(/metaedge_session=([^;]+)/);
  return match?.[1] ?? null;
}

async function req(pathname, { method = 'GET', cookie, body, timeoutMs = 8_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${pathname}`, {
      method,
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie: `metaedge_session=${cookie}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, cookie: parseCookie(res.headers.get('set-cookie')) };
  } catch (err) {
    return { status: err.name === 'AbortError' ? 'timeout' : 0, cookie: null };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try { const res = await fetch(`${baseUrl}/api/health`); if (res.ok) return; } catch { /* keep polling */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('MetaEdge server did not become ready on port 3000.');
}

// tab -> primary data endpoint. `wallet: true` = needs a live Agent Wallet, so a
// non-5xx rejection in this walletless smoke is expected (reachable, no wallet).
const checks = [
  { tab: 'Dashboard / Platform Data', method: 'GET', path: '/api/dashboard-data' },
  { tab: 'Trading Agents / Arena', method: 'GET', path: '/api/agents' },
  { tab: 'Market Charts (prices)', method: 'GET', path: '/api/prices' },
  { tab: 'Trading Desk (trades)', method: 'GET', path: '/api/trades' },
  { tab: 'Predictions', method: 'GET', path: '/api/predictions' },
  { tab: 'Rooms', method: 'GET', path: '/api/rooms' },
  { tab: 'Vaults', method: 'GET', path: '/api/vaults' },
  { tab: 'Evidence Map (graph)', method: 'GET', path: '/api/graph' },
  { tab: 'Profile', method: 'GET', path: '/api/profile' },
  { tab: 'Quant Engine', method: 'POST', path: '/api/quant/backtest', body: { symbol: 'BTC', indicators: { sma: true } } },
  // These run real `npx mm` enrichment (slow), so verify the route is registered +
  // validating with an empty body (fast 4xx) rather than triggering the CLI.
  { tab: 'Intent Solver', method: 'POST', path: '/api/mm/intent/solve', registered: true },
  { tab: 'Autopilot', method: 'POST', path: '/api/mm/autopilot/execute', registered: true },
  { tab: 'Swarm Copilot', method: 'POST', path: '/api/mm/chat', body: { model: 'claude-3-5' } },
  { tab: 'MM · wallet status', method: 'GET', path: '/api/mm/status', wallet: true },
  { tab: 'MM · wallet balance', method: 'GET', path: '/api/mm/balance', wallet: true },
  { tab: 'MM · predict markets', method: 'GET', path: '/api/mm/predict/markets', wallet: true },
];

import { existsSync } from 'node:fs';
if (!existsSync(path.join(process.cwd(), 'dist', 'server.cjs'))) {
  console.error('dist/server.cjs not found — run `npm run build` first.');
  process.exit(1);
}
// Spawn the built server directly: a single process that kills cleanly (unlike the
// npm -> tsx -> vite tree, whose orphans keep the smoke from exiting).
const child = spawn('node', ['dist/server.cjs'], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: dbPath, COOKIE_SECRET: 'all-tabs-smoke', LIVE_EXECUTION_ENABLED: 'false', NODE_ENV: 'production' },
  stdio: ['ignore', 'ignore', 'ignore'],
});

try {
  await waitForServer();

  const session = await req('/api/session');
  const cookie = session.cookie;
  if (!cookie) throw new Error('Could not establish a session.');

  const results = [];
  for (const c of checks) {
    let status = 0;
    try {
      ({ status } = await req(c.path, { method: c.method, cookie, body: c.body }));
    } catch {
      status = 0;
    }
    let verdict;
    if (status === 'timeout') verdict = 'SLOW (>8s)';
    else if (c.registered) verdict = status === 404 ? 'MISSING (404)' : (status === 0 || status >= 500 ? 'BROKEN' : 'OK (registered)');
    else if (c.wallet) {
      // Wallet-capability endpoints return 503 (graceful) when the mm capability is
      // unavailable — that's the external CLI, not a MetaEdge failure.
      if (status >= 200 && status < 300) verdict = 'OK';
      else if (status === 503) verdict = 'REACHABLE (mm unavailable)';
      else if (status === 0 || status >= 500) verdict = 'BROKEN';
      else verdict = 'REACHABLE (no wallet)';
    } else if (status >= 200 && status < 300) verdict = 'OK';
    else if (status === 0 || status >= 500) verdict = 'BROKEN';
    else verdict = `HTTP ${status}`;
    results.push({ ...c, status, verdict });
  }

  console.log('\nMetaEdge tab data-layer smoke\n');
  for (const r of results) {
    const mark = r.verdict === 'OK' ? '✅' : r.verdict === 'BROKEN' ? '❌' : '⚠️ ';
    console.log(`  ${mark} ${r.tab.padEnd(28)} ${String(r.status).padStart(3)}  ${r.path}${r.verdict === 'OK' ? '' : `  (${r.verdict})`}`);
  }
  const ok = results.filter((r) => r.verdict === 'OK' || r.verdict === 'OK (registered)').length;
  const broken = results.filter((r) => r.verdict === 'BROKEN');
  console.log(`\n${ok}/${results.length} OK · ${broken.length} broken · ${results.length - ok - broken.length} needs attention\n`);
  if (broken.length) {
    console.log('BROKEN:', broken.map((b) => `${b.tab} (${b.path})`).join(', '));
    process.exitCode = 1;
  }
} catch (err) {
  console.error('Tab smoke failed:', err.message);
  process.exitCode = 1;
} finally {
  child.kill('SIGKILL');
  await rm(tmpDir, { recursive: true, force: true });
}
