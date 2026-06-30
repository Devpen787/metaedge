import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:3000';
const tmpDir = await mkdtemp(path.join(tmpdir(), 'metaedge-session-'));
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

async function request(pathname, { cookie, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      ...(cookie ? { cookie: `metaedge_session=${cookie}` } : {}),
      ...headers
    }
  });
  const body = await response.json();
  return {
    response,
    body,
    cookie: parseCookie(response.headers.get('set-cookie'))
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
    COOKIE_SECRET: 'session-journey-smoke-secret'
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

  const first = await request('/api/session');
  assert(first.response.ok, 'First session request failed.');
  assert(first.body.user?.id?.startsWith('usr_'), 'First session did not return a server user.');
  assert(first.cookie?.startsWith('mes_'), 'Session cookie is not an opaque MetaEdge token.');
  assert(first.cookie !== first.body.user.id, 'Session cookie must not equal the user id.');

  const second = await request('/api/session', { cookie: first.cookie });
  assert(second.body.user.id === first.body.user.id, 'Opaque cookie did not preserve the session across refresh.');

  const spoofedHeader = await request('/api/session', {
    headers: { 'x-metaedge-session-id': first.body.user.id }
  });
  assert(spoofedHeader.body.user.id !== first.body.user.id, 'Header spoofing impersonated an existing user.');

  const rawCookie = await request('/api/session', { cookie: first.body.user.id });
  assert(rawCookie.body.user.id !== first.body.user.id, 'Raw user-id cookie impersonated an existing user.');
  assert(rawCookie.cookie?.startsWith('mes_'), 'Invalid cookie did not receive a fresh opaque session token.');

  const db = JSON.parse(await readFile(dbPath, 'utf8'));
  const sessionRecords = Object.values(db.sessions ?? {});
  assert(sessionRecords.length >= 3, 'Expected persisted session records for smoke contexts.');
  assert(sessionRecords.every((session) => session.tokenHash && !session.tokenHash.startsWith('mes_')), 'Session storage must use token hashes, not raw tokens.');
  assert(sessionRecords.every((session) => db.users[session.userId]), 'Every session record must point to a persisted user.');

  console.log(JSON.stringify({
    ok: true,
    firstUser: first.body.user.id,
    refreshedUser: second.body.user.id,
    spoofedHeaderUser: spoofedHeader.body.user.id,
    rawCookieUser: rawCookie.body.user.id,
    persistedSessions: sessionRecords.length
  }, null, 2));
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  await rm(tmpDir, { recursive: true, force: true });
}
