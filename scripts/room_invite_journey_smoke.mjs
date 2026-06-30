import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:3000';
const tmpDir = await mkdtemp(path.join(tmpdir(), 'metaedge-room-'));
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
    COOKIE_SECRET: 'room-invite-journey-smoke-secret'
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
  assert(owner?.id?.startsWith('usr_'), 'Owner session did not create a server user.');

  const blankRoom = await request('/api/rooms', {
    cookie: ownerSession.cookie,
    method: 'POST',
    body: { name: '   ', description: 'blank room should fail' }
  });
  assert(blankRoom.response.status === 400, 'Whitespace-only room name should be rejected.');

  const created = await request('/api/rooms', {
    cookie: ownerSession.cookie,
    method: 'POST',
    body: {
      name: ' Alpha <Room> ',
      description: 'Invite-only paper room <script>alert(1)</script>',
      ownerId: 'attacker_supplied_owner'
    }
  });
  assert(created.response.ok, 'Room creation failed.');
  const room = created.body.room;
  assert(room.id?.startsWith('rm_'), 'Room id was not server-generated.');
  assert(room.ownerId === owner.id, 'Room owner was not derived from the server session.');
  assert(room.inviteToken?.startsWith('inv_'), 'Invite token was not generated.');
  assert(room.inviteToken.length > 25, 'Invite token is too short to be treated as unguessable.');
  assert(room.memberIds.length === 1 && room.memberIds[0] === owner.id, 'Owner was not the initial member.');
  assert(!room.name.includes('<') && !room.description.includes('<'), 'Room text was not sanitized.');

  const ownerRooms = await request('/api/rooms', { cookie: ownerSession.cookie });
  assert(ownerRooms.body.rooms.length === 1, 'Owner room list did not include created room.');

  const ownerDetails = await request(`/api/rooms/${room.id}`, { cookie: ownerSession.cookie });
  assert(ownerDetails.response.ok, 'Owner could not read room details.');
  assert(ownerDetails.body.members.length === 1, 'Owner room details should start with one member.');

  const outsiderSession = await request('/api/session');
  const outsiderBeforeJoin = await request(`/api/rooms/${room.id}`, { cookie: outsiderSession.cookie });
  assert(outsiderBeforeJoin.response.status === 403, 'Non-member could read room details before joining.');

  const randomJoin = await request('/api/rooms/join', {
    cookie: outsiderSession.cookie,
    method: 'POST',
    body: { inviteToken: 'inv_not-a-real-token' }
  });
  assert(randomJoin.response.status === 404, 'Invalid invite token should be rejected.');

  const inviteUrl = `${baseUrl}/rooms/join?token=${encodeURIComponent(room.inviteToken)}&utm=smoke`;
  const joined = await request('/api/rooms/join', {
    cookie: outsiderSession.cookie,
    method: 'POST',
    body: { inviteToken: inviteUrl, userId: owner.id }
  });
  assert(joined.response.ok, 'Second user could not join via invite URL.');
  assert(joined.body.roomId === room.id, 'Join response returned the wrong room id.');

  const secondUserRooms = await request('/api/rooms', { cookie: outsiderSession.cookie });
  assert(secondUserRooms.body.rooms.length === 1, 'Second user room list did not include joined room.');
  assert(secondUserRooms.body.rooms[0].memberIds.includes(outsiderSession.body.user.id), 'Second user was not persisted as a member.');

  const secondUserDetails = await request(`/api/rooms/${room.id}`, { cookie: outsiderSession.cookie });
  assert(secondUserDetails.response.ok, 'Second user could not read joined room details.');
  assert(secondUserDetails.body.members.length === 2, 'Joined room details should show two members.');

  const duplicateJoin = await request('/api/rooms/join', {
    cookie: outsiderSession.cookie,
    method: 'POST',
    body: { inviteToken: room.inviteToken }
  });
  assert(duplicateJoin.response.ok, 'Duplicate join should be idempotent.');

  const nonOwnerToggle = await request(`/api/rooms/${room.id}/invite/toggle`, {
    cookie: outsiderSession.cookie,
    method: 'POST'
  });
  assert(nonOwnerToggle.response.status === 403, 'Non-owner should not be able to manage invites.');

  const disabled = await request(`/api/rooms/${room.id}/invite/toggle`, {
    cookie: ownerSession.cookie,
    method: 'POST'
  });
  assert(disabled.response.ok && disabled.body.room.isInviteDisabled === true, 'Owner could not disable invite.');

  const thirdSession = await request('/api/session');
  const blockedJoin = await request('/api/rooms/join', {
    cookie: thirdSession.cookie,
    method: 'POST',
    body: { inviteToken: room.inviteToken }
  });
  assert(blockedJoin.response.status === 400, 'Disabled invite still accepted a new member.');

  const stillBlockedDetails = await request(`/api/rooms/${room.id}`, { cookie: thirdSession.cookie });
  assert(stillBlockedDetails.response.status === 403, 'Blocked join user could read room details.');

  const db = JSON.parse(await readFile(dbPath, 'utf8'));
  const savedRoom = db.rooms[room.id];
  assert(savedRoom.ownerId === owner.id, 'Persisted room owner mismatch.');
  assert(savedRoom.memberIds.length === 2, 'Persisted room should have exactly two members after duplicate join.');
  assert(savedRoom.memberIds.includes(owner.id), 'Persisted room is missing owner.');
  assert(savedRoom.memberIds.includes(outsiderSession.body.user.id), 'Persisted room is missing invited user.');
  assert(!savedRoom.memberIds.includes(thirdSession.body.user.id), 'Disabled invite added a blocked user.');

  const createAudits = db.auditEvents.filter((event) => event.action === 'CREATE_ROOM');
  const joinAudits = db.auditEvents.filter((event) => event.action === 'JOIN_ROOM');
  const toggleAudits = db.auditEvents.filter((event) => event.action === 'TOGGLE_INVITE');
  const roomGraphEvents = db.graphEvents.filter((event) => event.type === 'room_join' && event.targetId === room.id);
  assert(createAudits.length === 1, 'Expected exactly one CREATE_ROOM audit.');
  assert(joinAudits.length === 1, 'Expected exactly one JOIN_ROOM audit.');
  assert(toggleAudits.length === 1, 'Expected exactly one TOGGLE_INVITE audit.');
  assert(roomGraphEvents.length === 2, 'Expected owner and invited user graph room_join events.');
  assert(roomGraphEvents.some((event) => event.userId === owner.id && event.metadata.isOwner === true), 'Owner graph room event missing.');
  assert(roomGraphEvents.some((event) => event.userId === outsiderSession.body.user.id && event.metadata.isOwner === false), 'Invited user graph room event missing.');

  console.log(JSON.stringify({
    ok: true,
    roomId: room.id,
    owner: owner.id,
    invitedUser: outsiderSession.body.user.id,
    blockedUser: thirdSession.body.user.id,
    members: savedRoom.memberIds.length,
    createAudits: createAudits.length,
    joinAudits: joinAudits.length,
    roomGraphEvents: roomGraphEvents.length,
    inviteDisabled: savedRoom.isInviteDisabled
  }, null, 2));
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  await rm(tmpDir, { recursive: true, force: true });
}
