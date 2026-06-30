import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:3000';
const tmpDir = await mkdtemp(path.join(tmpdir(), 'metaedge-paper-'));
const dbPath = path.join(tmpDir, 'db.json');

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

async function request(pathname, { cookie, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { cookie: `metaedge_session=${cookie}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers
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
      if (res.ok) return;
    } catch {
      // Keep polling until the dev server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('MetaEdge server did not become ready on port 3000.');
}

const child = spawn('npm', ['run', 'dev'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: dbPath,
    COOKIE_SECRET: 'paper-balance-journey-smoke-secret'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
child.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForServer();

  const sessionA = await request('/api/session');
  const userA = sessionA.body.user;
  assert(userA.paperBalance === 100000, 'Initial paper balance must be server-created at 100000.');
  assert(userA.faucetClaimedCount === 0, 'Initial faucet count must be zero.');

  const maliciousClaim = await request('/api/faucet', {
    cookie: sessionA.cookie,
    method: 'POST',
    body: {
      amount: 999999999,
      paperBalance: 999999999,
      faucetClaimedCount: -999,
      userId: 'attacker_supplied_user'
    }
  });
  assert(maliciousClaim.response.ok, 'First faucet claim failed.');
  assert(maliciousClaim.body.balance === 110000, 'Faucet ignored body amount incorrectly.');
  assert(maliciousClaim.body.faucetClaimedCount === 1, 'Faucet count ignored server increment incorrectly.');

  for (let i = 0; i < 9; i += 1) {
    const claim = await request('/api/faucet', {
      cookie: sessionA.cookie,
      method: 'POST',
      body: { amount: 1_000_000 + i }
    });
    assert(claim.response.ok, `Faucet claim ${i + 2} failed before limit.`);
  }

  const refreshA = await request('/api/session', { cookie: sessionA.cookie });
  assert(refreshA.body.user.id === userA.id, 'Refresh did not preserve paper user A.');
  assert(refreshA.body.user.paperBalance === 200000, 'Ten faucet claims should leave user A at 200000.');
  assert(refreshA.body.user.faucetClaimedCount === 10, 'Ten faucet claims should leave count at 10.');

  const limitClaim = await request('/api/faucet', {
    cookie: sessionA.cookie,
    method: 'POST',
    body: { amount: 10000 }
  });
  assert(limitClaim.response.status === 400, 'Eleventh faucet claim should be rejected.');

  const afterLimitA = await request('/api/session', { cookie: sessionA.cookie });
  assert(afterLimitA.body.user.paperBalance === 200000, 'Rejected faucet claim changed balance.');
  assert(afterLimitA.body.user.faucetClaimedCount === 10, 'Rejected faucet claim changed claim count.');

  const sessionB = await request('/api/session');
  const userB = sessionB.body.user;
  assert(userB.id !== userA.id, 'Second isolated session reused user A.');
  assert(userB.paperBalance === 100000, 'Second session did not receive isolated initial balance.');
  assert(userB.faucetClaimedCount === 0, 'Second session inherited user A faucet count.');

  const db = JSON.parse(await readFile(dbPath, 'utf8'));
  const savedA = db.users[userA.id];
  const savedB = db.users[userB.id];
  assert(savedA.paperBalance === 200000, 'Persisted user A balance mismatch.');
  assert(savedA.faucetClaimedCount === 10, 'Persisted user A faucet count mismatch.');
  assert(savedB.paperBalance === 100000, 'Persisted user B balance mismatch.');
  assert(savedB.faucetClaimedCount === 0, 'Persisted user B faucet count mismatch.');

  const faucetAudits = db.auditEvents.filter((event) => event.action === 'FAUCET_CLAIM');
  const faucetGraphs = db.graphEvents.filter((event) => event.type === 'paper_action' && event.targetType === 'User');
  assert(faucetAudits.length === 10, 'Expected exactly ten faucet audit events.');
  assert(faucetAudits.every((event) => event.userId === userA.id), 'Faucet audit event bound to wrong user.');
  assert(faucetGraphs.length === 10, 'Expected exactly ten faucet graph events.');
  assert(faucetGraphs.every((event) => event.userId === userA.id && event.metadata.amount === 10000), 'Faucet graph event metadata is not server-authoritative.');

  console.log(JSON.stringify({
    ok: true,
    userA: userA.id,
    userABalance: savedA.paperBalance,
    userAFaucetCount: savedA.faucetClaimedCount,
    userB: userB.id,
    userBBalance: savedB.paperBalance,
    faucetAudits: faucetAudits.length,
    faucetGraphEvents: faucetGraphs.length
  }, null, 2));
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  await rm(tmpDir, { recursive: true, force: true });
}
