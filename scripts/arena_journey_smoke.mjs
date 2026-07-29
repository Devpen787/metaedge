#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Could not allocate an isolated Arena smoke port.'));
        return;
      }
      const freePort = address.port;
      probe.close((error) => error ? reject(error) : resolve(freePort));
    });
  });
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 2000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

const port = process.env.ARENA_SMOKE_PORT ? Number(process.env.ARENA_SMOKE_PORT) : await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const expectedCommit = `arena-smoke-${process.pid}-${Date.now()}`;
const tmpDir = await mkdtemp(path.join(tmpdir(), 'metaedge-arena-'));
const dbPath = path.join(tmpDir, 'db.json');

function cookieFrom(res) {
  return res.headers.get('set-cookie')?.match(/metaedge_session=([^;]+)/)?.[1] || '';
}

async function request(pathname, { method = 'GET', cookie, body } = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie: `metaedge_session=${cookie}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: res.status,
    body: await res.json().catch(() => ({})),
    cookie: cookieFrom(res),
  };
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        const health = await res.json().catch(() => ({}));
        if (health.commit === expectedCommit) return;
      }
    } catch { /* keep polling */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`MetaEdge server did not become ready on port ${port}.`);
}

if (!existsSync(path.join(process.cwd(), 'dist', 'server.cjs'))) {
  throw new Error('dist/server.cjs not found — run `npm run build` first.');
}

const child = spawn('node', ['dist/server.cjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: dbPath,
    COOKIE_SECRET: 'arena-journey-smoke-not-production',
    LIVE_EXECUTION_ENABLED: 'false',
    NODE_ENV: 'production',
    GIT_COMMIT: expectedCommit,
    AUTOTRADER_DISABLED: 'true',
    RECORDER_DISABLED: 'true',
    PREDICTION_SCOUT_DISABLED: 'true',
    DECISION_RUNTIME_DISABLED: 'true',
    OPPORTUNITY_FACTORY_DISABLED: 'true',
    PORT: String(port),
  },
  stdio: ['ignore', 'ignore', 'inherit'],
});

try {
  await waitForServer();

  const session = await request('/api/session');
  assert.equal(session.status, 200);
  assert.ok(session.cookie, 'session cookie is required');
  const cookie = session.cookie;
  const userId = session.body.user.id;

  const profile = await request('/api/profile', {
    method: 'POST', cookie,
    body: { displayName: 'Arena Smoke', bio: 'paper competitor' },
  });
  assert.equal(profile.status, 200);

  const walletlessLeagues = await request('/api/arena/leagues', { cookie });
  const activeSeed = walletlessLeagues.body.leagues.find((league) => league.status === 'active');
  assert.ok(activeSeed, 'an active seeded league is required');

  const walletlessJoin = await request(`/api/arena/leagues/${activeSeed.id}/join`, { method: 'POST', cookie });
  assert.equal(walletlessJoin.status, 403);
  assert.equal(walletlessJoin.body.error, 'wallet_required');

  const db = JSON.parse(await readFile(dbPath, 'utf8'));
  db.users[userId].walletAddress = '0x000000000000000000000000000000000000a11e';
  db.users[userId].walletConnectedAt = Date.now();
  db.arenaLeagues.lg_expired_smoke = {
    id: 'lg_expired_smoke', name: 'Expired Smoke League', creatorId: 'system', creatorName: 'MetaEdge',
    startBalance: 10000, durationDays: 1, createdAt: Date.now() - 172800000,
    endsAt: Date.now() - 86400000, risk: 'Low', prize: 'Paper Badge', status: 'active',
  };
  db.arenaLeagues.lg_inactive_smoke = {
    id: 'lg_inactive_smoke', name: 'Inactive Smoke League', creatorId: 'system', creatorName: 'MetaEdge',
    startBalance: 10000, durationDays: 7, createdAt: Date.now(),
    endsAt: Date.now() + 604800000, risk: 'Low', prize: 'Paper Badge', status: 'ended',
  };
  await writeFile(dbPath, JSON.stringify(db, null, 2));

  const listed = await request('/api/arena/leagues', { cookie });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.leagues.find((league) => league.id === 'lg_expired_smoke').status, 'ended');
  assert.equal(listed.body.leagues.find((league) => league.id === 'lg_inactive_smoke').status, 'ended');

  const beforeBlocked = JSON.parse(await readFile(dbPath, 'utf8')).arenaMembers.length;
  const expiredJoin = await request('/api/arena/leagues/lg_expired_smoke/join', { method: 'POST', cookie });
  assert.equal(expiredJoin.status, 410);
  assert.equal(expiredJoin.body.error, 'league_ended');

  const inactiveJoin = await request('/api/arena/leagues/lg_inactive_smoke/join', { method: 'POST', cookie });
  assert.equal(inactiveJoin.status, 409);
  assert.equal(inactiveJoin.body.error, 'league_inactive');

  const missingJoin = await request('/api/arena/leagues/lg_missing_smoke/join', { method: 'POST', cookie });
  assert.equal(missingJoin.status, 404);
  const afterBlocked = JSON.parse(await readFile(dbPath, 'utf8')).arenaMembers.length;
  assert.equal(afterBlocked, beforeBlocked, 'blocked joins must not write memberships');

  const activeJoin = await request(`/api/arena/leagues/${activeSeed.id}/join`, { method: 'POST', cookie });
  assert.equal(activeJoin.status, 200);
  const duplicateJoin = await request(`/api/arena/leagues/${activeSeed.id}/join`, { method: 'POST', cookie });
  assert.equal(duplicateJoin.status, 409);
  assert.equal(duplicateJoin.body.error, 'Already joined this league.');

  const created = await request('/api/arena/leagues', {
    method: 'POST', cookie,
    body: { name: 'Smoke Cup', startBalance: 25000, durationDays: 7, risk: 'Medium', prize: 'Paper Trophy' },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.league.name, 'Smoke Cup');

  // Build two deterministic competitors. Arena scoring must reconstruct these
  // fills, expose every metric, and rank the high-turnover player differently
  // from the higher-return player.
  const scoredAt = Date.now();
  const volumeUserId = 'usr_volume_smoke';
  const scoredDb = JSON.parse(await readFile(dbPath, 'utf8'));
  scoredDb.users[volumeUserId] = {
    id: volumeUserId, username: 'Volume Runner',
    profile: { displayName: 'Volume Runner', avatarUrl: '', updatedAt: scoredAt },
    createdAt: scoredAt, lastActiveAt: scoredAt, paperBalance: 10000, faucetClaimedCount: 0,
    walletAddress: '0x000000000000000000000000000000000000b0b0', walletConnectedAt: scoredAt,
  };
  scoredDb.agents.agt_return_smoke = {
    id: 'agt_return_smoke', name: 'Return Agent', description: 'Arena metric fixture', ownerId: userId,
    assetSymbol: 'BTC', tradeType: 'token', strategyType: 'momentum', leverage: 1,
    status: 'active', createdAt: scoredAt,
  };
  scoredDb.agents.agt_volume_smoke = {
    id: 'agt_volume_smoke', name: 'Volume Agent', description: 'Arena metric fixture', ownerId: volumeUserId,
    assetSymbol: 'ETH', tradeType: 'token', strategyType: 'grid', leverage: 1,
    status: 'active', createdAt: scoredAt,
  };
  scoredDb.agents.agt_carry_smoke = {
    id: 'agt_carry_smoke', name: 'Carry Agent', description: 'Period floor fixture', ownerId: userId,
    assetSymbol: 'LINK', tradeType: 'token', strategyType: 'mean_reversion', leverage: 1,
    status: 'active', createdAt: scoredAt,
  };
  const trade = (id, owner, agentId, symbol, type, side, size, price, timestamp, extra = {}) => ({
    id, userId: owner, agentId, assetSymbol: symbol, tradeType: type, side, size, price,
    leverage: type === 'perp' ? 5 : 1, timestamp, ...extra,
  });
  scoredDb.trades.push(
    trade('tr_return_buy', userId, 'agt_return_smoke', 'BTC', 'token', 'buy', 1, 100, scoredAt + 10),
    trade('tr_return_sell', userId, 'agt_return_smoke', 'BTC', 'token', 'sell', 1, 120, scoredAt + 20),
    trade('tr_return_perp', userId, 'wallet', 'SOL', 'perp', 'long', 1, 50, scoredAt + 30, { source: 'wallet', status: 'closed', pnl: 10 }),
    trade('tr_volume_buy', volumeUserId, 'agt_volume_smoke', 'ETH', 'token', 'buy', 10, 100, scoredAt + 10),
    trade('tr_volume_sell', volumeUserId, 'agt_volume_smoke', 'ETH', 'token', 'sell', 10, 101, scoredAt + 20),
  );
  await writeFile(dbPath, JSON.stringify(scoredDb, null, 2));

  const predictionStake = await request('/api/predictions/pred_btc_120k/bet', {
    method: 'POST', cookie, body: { side: 'yes', amount: 100 },
  });
  assert.equal(predictionStake.status, 200);
  const afterPrediction = JSON.parse(await readFile(dbPath, 'utf8'));
  assert.equal(afterPrediction.predictionBetEvents.filter((event) => event.userId === userId).length, 1, 'prediction stake must append a scoring event');

  const roiBoard = await request('/api/arena/leaderboard?leagueId=global&metric=roi', { cookie });
  const pnlBoard = await request('/api/arena/leaderboard?leagueId=global&metric=pnl', { cookie });
  const volumeBoard = await request('/api/arena/leaderboard?leagueId=global&metric=volume', { cookie });
  assert.equal(roiBoard.status, 200);
  assert.equal(pnlBoard.status, 200);
  assert.equal(volumeBoard.status, 200);
  assert.equal(roiBoard.body.board.metric, 'roi');
  assert.equal(pnlBoard.body.board.metric, 'pnl');
  assert.equal(volumeBoard.body.board.metric, 'volume');
  assert.equal(roiBoard.body.leaderboard[0].userId, userId, 'higher return must win the return board');
  assert.equal(pnlBoard.body.leaderboard[0].userId, userId, 'higher P&L must win the P&L board');
  assert.equal(volumeBoard.body.leaderboard[0].userId, volumeUserId, 'higher turnover must win the volume board');
  const returnRow = roiBoard.body.leaderboard.find((row) => row.userId === userId);
  assert.ok(returnRow.lanes.find((lane) => lane.key === 'spot' && lane.events === 2));
  assert.ok(returnRow.lanes.find((lane) => lane.key === 'perps' && lane.events === 1));
  assert.ok(returnRow.lanes.find((lane) => lane.key === 'predictions' && lane.events === 1));
  assert.equal(returnRow.volumeUsd, returnRow.lanes.reduce((sum, lane) => sum + lane.volumeUsd, 0));
  assert.equal(returnRow.pnlValue, returnRow.lanes.reduce((sum, lane) => sum + lane.realizedPnl + lane.unrealizedPnl, 0));

  // A pre-join lot closed after joining must not import its old gain.
  const boundary = Date.now() + 10_000;
  const floorDb = JSON.parse(await readFile(dbPath, 'utf8'));
  floorDb.arenaLeagues.lg_period_floor = {
    id: 'lg_period_floor', name: 'Period Floor', creatorId: 'system', creatorName: 'MetaEdge',
    startBalance: 10000, durationDays: 1, createdAt: scoredAt, endsAt: boundary + 86400000,
    risk: 'Low', prize: 'Paper Badge', status: 'active',
  };
  floorDb.arenaMembers.push({ id: 'lm_period_floor', leagueId: 'lg_period_floor', userId, username: 'Arena Smoke', joinedAt: boundary, startBalance: 10000 });
  floorDb.trades.push(
    trade('tr_carry_buy', userId, 'agt_carry_smoke', 'LINK', 'token', 'buy', 1, 10, boundary - 1000),
    trade('tr_carry_sell', userId, 'agt_carry_smoke', 'LINK', 'token', 'sell', 1, 1000, boundary + 1000, { pnl: 990 }),
  );
  await writeFile(dbPath, JSON.stringify(floorDb, null, 2));
  const floorBoard = await request('/api/arena/leaderboard?leagueId=lg_period_floor&metric=pnl', { cookie });
  assert.equal(floorBoard.status, 200);
  assert.equal(floorBoard.body.leaderboard[0].pnlValue, 0, 'pre-join position P&L must be floored out');

  const beforeDelete = JSON.parse(await readFile(dbPath, 'utf8')).trades.length;
  const deleteOne = await request('/api/trades/tr_return_sell', { method: 'DELETE', cookie });
  const deleteAll = await request('/api/trades', { method: 'DELETE', cookie });
  assert.equal(deleteOne.status, 409);
  assert.equal(deleteAll.status, 409);
  const afterDelete = JSON.parse(await readFile(dbPath, 'utf8')).trades.length;
  assert.equal(afterDelete, beforeDelete, 'blocked deletion must preserve every scored fill');
  const invalidMetric = await request('/api/arena/leaderboard?leagueId=global&metric=sharpe', { cookie });
  assert.equal(invalidMetric.status, 400);

  const finalBoard = await request('/api/arena/leaderboard?leagueId=lg_expired_smoke', { cookie });
  assert.equal(finalBoard.status, 200, 'ended league standings remain readable');
  const missingBoard = await request('/api/arena/leaderboard?leagueId=lg_missing_smoke', { cookie });
  assert.equal(missingBoard.status, 404);

  console.log(JSON.stringify({
    ok: true,
    walletGate: walletlessJoin.status,
    activeJoin: activeJoin.status,
    duplicateJoin: duplicateJoin.status,
    expiredJoin: expiredJoin.status,
    inactiveJoin: inactiveJoin.status,
    missingJoin: missingJoin.status,
    endedStandings: finalBoard.status,
    blockedMembershipWrites: afterBlocked - beforeBlocked,
    rankingViews: [roiBoard.body.board.metric, pnlBoard.body.board.metric, volumeBoard.body.board.metric],
    scoredLanes: returnRow.lanes.map((lane) => lane.key),
    predictionEvents: afterPrediction.predictionBetEvents.length,
    periodFloorPnl: floorBoard.body.leaderboard[0].pnlValue,
    immutableLedger: [deleteOne.status, deleteAll.status],
  }, null, 2));
} finally {
  await stopChild(child);
  await rm(tmpDir, { recursive: true, force: true });
}
