import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:3000';
const tmpDir = await mkdtemp(path.join(tmpdir(), 'metaedge-agent-'));
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
    COOKIE_SECRET: 'agent-strategy-journey-smoke-secret'
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

  const ownerSession = await request('/api/session');
  const owner = ownerSession.body.user;
  const blankAgent = await request('/api/agents', {
    cookie: ownerSession.cookie,
    method: 'POST',
    body: { name: '   ', assetSymbol: 'BTC' }
  });
  assert(blankAgent.response.status === 400, 'Whitespace-only agent name should be rejected.');

  const createdRoom = await request('/api/rooms', {
    cookie: ownerSession.cookie,
    method: 'POST',
    body: { name: 'Agent Share Room', description: 'Paper strategy sharing' }
  });
  assert(createdRoom.response.ok, 'Owner could not create room.');
  const room = createdRoom.body.room;

  const invitedSession = await request('/api/session');
  const joined = await request('/api/rooms/join', {
    cookie: invitedSession.cookie,
    method: 'POST',
    body: { inviteToken: `${baseUrl}/rooms/join?token=${room.inviteToken}` }
  });
  assert(joined.response.ok, 'Invited user could not join room.');

  const outsiderSession = await request('/api/session');
  const outsiderPrivateRoom = await request('/api/rooms', {
    cookie: outsiderSession.cookie,
    method: 'POST',
    body: { name: 'Outsider Private Room', description: 'Should not be shareable by owner' }
  });
  assert(outsiderPrivateRoom.response.ok, 'Outsider could not create private room.');

  const forgedRoomAgent = await request('/api/agents', {
    cookie: ownerSession.cookie,
    method: 'POST',
    body: {
      name: 'Forged room bot',
      assetSymbol: 'BTC',
      roomId: outsiderPrivateRoom.body.room.id
    }
  });
  assert(forgedRoomAgent.response.status === 403, 'User created an agent inside a room they do not belong to.');

  const createdAgent = await request('/api/agents', {
    cookie: ownerSession.cookie,
    method: 'POST',
    body: {
      name: ' ETH <Momentum> ',
      description: 'Breakout room strategy <script>alert(1)</script>',
      assetSymbol: ' eth ',
      tradeType: 'perp',
      strategyType: 'momentum',
      leverage: 5,
      roomId: room.id,
      ownerId: 'attacker_supplied_owner'
    }
  });
  assert(createdAgent.response.ok, 'Owner could not create room-scoped paper agent.');
  const agent = createdAgent.body.agent;
  assert(agent.id?.startsWith('agt_'), 'Agent id was not server-generated.');
  assert(agent.ownerId === owner.id, 'Agent owner was not derived from server session.');
  assert(agent.roomId === room.id, 'Agent was not scoped to the selected room.');
  assert(agent.assetSymbol === 'ETH', 'Agent asset symbol was not normalized.');
  assert(!agent.name.includes('<') && !agent.description.includes('<'), 'Agent text was not sanitized.');

  const ownerAgents = await request('/api/agents', { cookie: ownerSession.cookie });
  assert(ownerAgents.body.agents.length === 1, 'Owner agent list did not include created agent.');
  assert(ownerAgents.body.agents[0].id === agent.id, 'Owner agent list returned the wrong agent.');

  const invitedAgents = await request('/api/agents', { cookie: invitedSession.cookie });
  assert(invitedAgents.body.agents.length === 0, 'Invited user should not own the source agent.');

  const ownerRoomDetails = await request(`/api/rooms/${room.id}`, { cookie: ownerSession.cookie });
  assert(ownerRoomDetails.response.ok, 'Owner could not load room details after sharing strategy.');
  assert(ownerRoomDetails.body.sharedStrategies.length === 1, 'Room did not expose the shared strategy.');
  const sharedStrategy = ownerRoomDetails.body.sharedStrategies[0];
  assert(sharedStrategy.agentId === agent.id, 'Shared strategy was not linked to the created agent.');
  assert(sharedStrategy.authorId === owner.id, 'Shared strategy author mismatch.');
  assert(sharedStrategy.roomId === room.id, 'Shared strategy was not scoped to the room.');
  assert(sharedStrategy.tradeType === 'perp', 'Shared strategy did not preserve trade type.');

  const invitedRoomDetails = await request(`/api/rooms/${room.id}`, { cookie: invitedSession.cookie });
  assert(invitedRoomDetails.response.ok, 'Invited user could not read joined room details.');
  assert(invitedRoomDetails.body.sharedStrategies.some((strategy) => strategy.id === sharedStrategy.id), 'Invited user could not see room shared strategy.');

  const outsiderRoomDetails = await request(`/api/rooms/${room.id}`, { cookie: outsiderSession.cookie });
  assert(outsiderRoomDetails.response.status === 403, 'Non-member could read room strategy details.');

  const outsiderStrategies = await request('/api/strategies', { cookie: outsiderSession.cookie });
  assert(outsiderStrategies.body.strategies.every((strategy) => strategy.id !== sharedStrategy.id), 'Non-member strategy list leaked room strategy.');

  const outsiderCopy = await request('/api/strategies/copy', {
    cookie: outsiderSession.cookie,
    method: 'POST',
    body: { strategyId: sharedStrategy.id }
  });
  assert(outsiderCopy.response.status === 403, 'Non-member copied a private room strategy.');

  const invitedStrategies = await request('/api/strategies', { cookie: invitedSession.cookie });
  assert(invitedStrategies.body.strategies.some((strategy) => strategy.id === sharedStrategy.id), 'Room member strategy list did not include shared strategy.');

  const copied = await request('/api/strategies/copy', {
    cookie: invitedSession.cookie,
    method: 'POST',
    body: { strategyId: sharedStrategy.id, ownerId: owner.id }
  });
  assert(copied.response.ok, 'Invited user could not copy shared room strategy.');
  const copiedAgent = copied.body.agent;
  assert(copiedAgent.ownerId === invitedSession.body.user.id, 'Copied agent owner was not derived from copier session.');
  assert(copiedAgent.status === 'paused', 'Copied strategy should start paused for review.');
  assert(copiedAgent.assetSymbol === sharedStrategy.assetSymbol, 'Copied agent did not preserve strategy asset.');
  assert(copiedAgent.tradeType === sharedStrategy.tradeType, 'Copied agent did not preserve strategy trade type.');

  const invitedAgentsAfterCopy = await request('/api/agents', { cookie: invitedSession.cookie });
  assert(invitedAgentsAfterCopy.body.agents.some((ownedAgent) => ownedAgent.id === copiedAgent.id), 'Copied agent did not persist in invited user book.');

  const refreshedRoomDetails = await request(`/api/rooms/${room.id}`, { cookie: ownerSession.cookie });
  const refreshedStrategy = refreshedRoomDetails.body.sharedStrategies.find((strategy) => strategy.id === sharedStrategy.id);
  assert(refreshedStrategy.copiedCount === 1, 'Strategy copied count did not increment once.');

  const db = JSON.parse(await readFile(dbPath, 'utf8'));
  const savedSourceAgent = db.agents[agent.id];
  const savedCopiedAgent = db.agents[copiedAgent.id];
  const savedStrategy = db.strategies[sharedStrategy.id];
  assert(savedSourceAgent.ownerId === owner.id && savedSourceAgent.roomId === room.id, 'Persisted source agent scope mismatch.');
  assert(savedCopiedAgent.ownerId === invitedSession.body.user.id, 'Persisted copied agent owner mismatch.');
  assert(savedStrategy.roomId === room.id && savedStrategy.copiedCount === 1, 'Persisted shared strategy mismatch.');

  const createAudits = db.auditEvents.filter((event) => event.action === 'CREATE_AGENT');
  const copyAudits = db.auditEvents.filter((event) => event.action === 'COPY_STRATEGY');
  const agentGraphEvents = db.graphEvents.filter((event) => event.type === 'agent_creation' && event.targetId === agent.id);
  const shareGraphEvents = db.graphEvents.filter((event) => event.type === 'strategy_share' && event.targetId === sharedStrategy.id);
  const copyGraphEvents = db.graphEvents.filter((event) => event.type === 'strategy_copy' && event.targetId === sharedStrategy.id);
  assert(createAudits.length === 1, 'Expected exactly one CREATE_AGENT audit.');
  assert(copyAudits.length === 1, 'Expected exactly one COPY_STRATEGY audit.');
  assert(agentGraphEvents.length === 1, 'Expected one agent creation graph event.');
  assert(shareGraphEvents.length === 1 && shareGraphEvents[0].metadata.roomId === room.id, 'Expected one room-scoped strategy share graph event.');
  assert(copyGraphEvents.length === 1 && copyGraphEvents[0].metadata.newAgentId === copiedAgent.id, 'Expected one strategy copy graph event.');

  console.log(JSON.stringify({
    ok: true,
    roomId: room.id,
    sourceAgent: agent.id,
    sharedStrategy: sharedStrategy.id,
    copiedAgent: copiedAgent.id,
    owner: owner.id,
    invitedUser: invitedSession.body.user.id,
    copiedCount: savedStrategy.copiedCount,
    createAudits: createAudits.length,
    copyAudits: copyAudits.length,
    shareGraphEvents: shareGraphEvents.length,
    copyGraphEvents: copyGraphEvents.length
  }, null, 2));
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  await rm(tmpDir, { recursive: true, force: true });
}
