import { spawn } from 'node:child_process';
import { once } from 'node:events';

const baseUrl = process.env.METAEDGE_URL || 'http://127.0.0.1:3000';
const shouldSpawn = process.env.METAEDGE_USE_EXISTING_SERVER !== 'true';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const first = setCookieHeader.split(',').find((part) => part.includes('metaedge_session='));
  if (!first) return null;
  const match = first.match(/metaedge_session=([^;]+)/);
  return match?.[1] ?? null;
}

async function request(pathname, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { cookie: `metaedge_session=${cookie}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const json = await response.json();
  return {
    response,
    body: json,
    cookie: parseCookie(response.headers.get('set-cookie')) || cookie
  };
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // Poll until ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

let child = null;
let serverOutput = '';

if (shouldSpawn) {
  child = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COOKIE_SECRET: 'metamask-readiness-smoke-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
}

try {
  const ready = await waitForServer();
  assert(ready, 'MetaEdge server did not become ready on port 3000.');

  const session = await request('/api/session');
  assert(session.response.ok && session.cookie, 'Session was not established.');

  // Current connect flow (the old /api/mm/login* routes are gone): a bogus
  // token must be rejected (400 malformed / 401 login failed) and NEVER echoed.
  const tokenLogin = await request('/api/mm/connect/token', {
    cookie: session.cookie,
    method: 'POST',
    body: { token: 'secret_that_must_not_be_accepted' }
  });
  assert([400, 401].includes(tokenLogin.response.status), 'connect/token accepted a bogus token.');
  assert(!JSON.stringify(tokenLogin.body).includes('secret_that_must_not_be_accepted'), 'connect/token echoed a secret.');

  // A fresh session must report not-connected as JSON.
  const connStatus = await request('/api/mm/connect/status', { cookie: session.cookie });
  assert(connStatus.response.ok && connStatus.body && connStatus.body.connected === false, 'connect/status should report connected:false for a fresh session.');

  const readiness = await request('/api/mm/readiness', { cookie: session.cookie });
  assert(readiness.response.ok, 'Readiness endpoint failed.');
  assert(readiness.body.loginCommand === 'mm login browser', 'Readiness should point to browser login.');
  assert(readiness.body.liveModeGlobalLock === true, 'Live execution should remain locked by default.');
  assert(Array.isArray(readiness.body.checks), 'Readiness checks missing.');
  for (const id of ['cli_v3', 'wallet_connected', 'trading_mode', 'policy', 'outflow_24h', 'two_factor', 'live_lock']) {
    assert(readiness.body.checks.some((check) => check.id === id), `Missing readiness check: ${id}`);
  }
  assert(!JSON.stringify(readiness.body).toLowerCase().includes('yaml:'), 'Readiness leaked raw policy internals.');

  const lockedTransfer = await request('/api/mm/transfer', {
    cookie: session.cookie,
    method: 'POST',
    body: { to: '0x0000000000000000000000000000000000000000', amount: '0.1', token: 'native', chainId: '8453' }
  });
  assert(lockedTransfer.response.status === 403, 'Live transfer was not locked by default.');

  const badSwap = await request('/api/mm/swap/quote', {
    cookie: session.cookie,
    method: 'POST',
    body: { from: 'ETH; rm -rf /', to: 'USDC', amount: '1', fromChain: '8453' }
  });
  assert(badSwap.response.status === 400, 'Unsafe swap input was not rejected.');

  console.log(JSON.stringify({
    ok: true,
    liveModeGlobalLock: readiness.body.liveModeGlobalLock,
    loginCommand: readiness.body.loginCommand,
    checkCount: readiness.body.checks.length,
    tokenLoginStatus: tokenLogin.response.status,
    connectStatusOk: connStatus.response.ok,
    lockedTransferStatus: lockedTransfer.response.status,
    badSwapStatus: badSwap.response.status
  }, null, 2));
} catch (error) {
  if (serverOutput) console.error(serverOutput);
  throw error;
} finally {
  if (child) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        once(child, 'exit'),
        new Promise((resolve) => setTimeout(resolve, 2_000))
      ]);
    }
  }
}
