import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:3000';
const tmpDir = await mkdtemp(path.join(tmpdir(), 'metaedge-profile-'));
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
    COOKIE_SECRET: 'profile-journey-smoke-secret'
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
  assert(sessionA.cookie?.startsWith('mes_'), 'Session A did not receive an opaque cookie.');
  assert(!userA.profile.claimedAt, 'Fresh user should not be profile-claimed yet.');

  const defaultClaim = await request('/api/profile', {
    cookie: sessionA.cookie,
    method: 'POST',
    body: {
      displayName: 'MetaEdge Agent',
      bio: 'Default name should still complete onboarding.',
      avatarUrl: userA.profile.avatarUrl
    }
  });
  assert(defaultClaim.response.ok, 'Default profile claim failed.');
  assert(defaultClaim.body.user.profile.claimedAt, 'Profile claim did not set claimedAt.');
  assert(defaultClaim.body.user.profile.displayName === 'MetaEdge Agent', 'Default profile claim changed the display name unexpectedly.');

  const namedClaim = await request('/api/profile', {
    cookie: sessionA.cookie,
    method: 'POST',
    body: {
      displayName: 'Journey Agent',
      bio: 'Session-bound profile.',
      avatarUrl: 'https://example.com/avatar-a.svg',
      userId: 'attacker_supplied_user'
    }
  });
  assert(namedClaim.response.ok, 'Named profile claim failed.');
  assert(namedClaim.body.user.id === userA.id, 'Profile update returned the wrong user.');
  assert(namedClaim.body.user.profile.displayName === 'Journey Agent', 'Named profile was not saved.');

  const refreshA = await request('/api/session', { cookie: sessionA.cookie });
  assert(refreshA.body.user.id === userA.id, 'Refresh did not preserve user A.');
  assert(refreshA.body.user.profile.displayName === 'Journey Agent', 'Refresh did not preserve user A profile.');

  const emptyName = await request('/api/profile', {
    cookie: sessionA.cookie,
    method: 'POST',
    body: { displayName: '   ', bio: 'Bad update', avatarUrl: 'https://example.com/bad.svg' }
  });
  assert(emptyName.response.status === 400, 'Blank display name should be rejected.');

  const sessionB = await request('/api/session');
  const userB = sessionB.body.user;
  assert(userB.id !== userA.id, 'Second isolated context reused user A.');

  const spoofFromB = await request('/api/profile', {
    cookie: sessionB.cookie,
    method: 'POST',
    body: {
      userId: userA.id,
      profileId: userA.id,
      displayName: 'Spoof Attempt',
      bio: 'This must bind only to session B.',
      avatarUrl: 'https://example.com/avatar-b.svg'
    }
  });
  assert(spoofFromB.response.ok, 'Session B profile update failed.');
  assert(spoofFromB.body.user.id === userB.id, 'Spoofed body userId changed acting user.');

  const finalA = await request('/api/session', { cookie: sessionA.cookie });
  const finalB = await request('/api/session', { cookie: sessionB.cookie });
  assert(finalA.body.user.profile.displayName === 'Journey Agent', 'Session B spoof changed user A profile.');
  assert(finalB.body.user.profile.displayName === 'Spoof Attempt', 'Session B own profile was not updated.');

  const db = JSON.parse(await readFile(dbPath, 'utf8'));
  const profileAudits = db.auditEvents.filter((event) => event.action === 'PROFILE_UPDATE');
  assert(profileAudits.some((event) => event.userId === userA.id && event.details.includes('Journey Agent')), 'Missing user A profile audit.');
  assert(profileAudits.some((event) => event.userId === userB.id && event.details.includes('Spoof Attempt')), 'Missing user B profile audit.');
  assert(!profileAudits.some((event) => event.userId === userA.id && event.details.includes('Spoof Attempt')), 'Spoof attempt was audited against user A.');

  console.log(JSON.stringify({
    ok: true,
    userA: finalA.body.user.id,
    userAName: finalA.body.user.profile.displayName,
    userB: finalB.body.user.id,
    userBName: finalB.body.user.profile.displayName,
    profileAuditCount: profileAudits.length
  }, null, 2));
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  await rm(tmpDir, { recursive: true, force: true });
}
