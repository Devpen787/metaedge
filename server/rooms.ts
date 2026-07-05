import { Router } from 'express';
import { readDatabase, writeDatabase, generateId, sanitizeText } from './storage.js';
import type { FriendRoom } from '../src/types';

export const roomsRouter = Router();

// Create Room
roomsRouter.post('/api/rooms', (req: any, res) => {
  const userId = req.userId;
  const { name, description } = req.body;
  const roomName = sanitizeText(name || '', 50);

  if (!roomName) {
    res.status(400).json({ error: 'Room name is required' });
    return;
  }

  const db = readDatabase();
  const ROOM_CAP = 25;
  if (Object.values(db.rooms).filter((r) => r.ownerId === userId).length >= ROOM_CAP) {
    res.status(400).json({ error: `You've reached the maximum of ${ROOM_CAP} rooms.` });
    return;
  }
  const roomId = 'rm_' + generateId();
  const inviteToken = 'inv_' + generateId();

  const newRoom: FriendRoom = {
    id: roomId,
    name: roomName,
    description: sanitizeText(description || '', 200),
    ownerId: userId,
    inviteToken,
    isInviteDisabled: false,
    memberIds: [userId],
    createdAt: Date.now()
  };

  db.rooms[roomId] = newRoom;

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'CREATE_ROOM',
    details: `Created room ${newRoom.name}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'room_join',
    userId,
    targetId: roomId,
    targetType: 'Room',
    metadata: { isOwner: true },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, room: newRoom });
});

// List rooms I'm a member of
roomsRouter.get('/api/rooms', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const joinedRooms = Object.values(db.rooms).filter(r => r.memberIds.includes(userId));
  res.json({ rooms: joinedRooms });
});

// Get room details (Enforce ownership/membership check to prevent IDOR)
roomsRouter.get('/api/rooms/:id', (req: any, res) => {
  const userId = req.userId;
  const roomId = req.params.id;
  const db = readDatabase();
  const room = db.rooms[roomId];

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (!room.memberIds.includes(userId)) {
    res.status(403).json({ error: 'You are not a member of this room' });
    return;
  }

  // Enrich members info
  const members = room.memberIds.map(mId => {
    const usr = db.users[mId];
    return {
      id: mId,
      displayName: usr?.profile.displayName || 'Unknown user',
      avatarUrl: usr?.profile.avatarUrl || '',
      username: usr?.username || ''
    };
  });

  // Get strategies shared with this room
  const sharedStrategies = Object.values(db.strategies).filter(s => s.roomId === roomId);

  res.json({ room, members, sharedStrategies });
});

// Join Room via Invite Token
roomsRouter.post('/api/rooms/join', (req: any, res) => {
  const userId = req.userId;
  const inviteToken = normalizeInviteToken(req.body?.inviteToken);

  if (!inviteToken) {
    res.status(400).json({ error: 'Invite token is required' });
    return;
  }

  const db = readDatabase();
  const room = Object.values(db.rooms).find(r => r.inviteToken === inviteToken);

  if (!room) {
    res.status(404).json({ error: 'Invalid invite link or invite token' });
    return;
  }

  if (room.isInviteDisabled) {
    res.status(400).json({ error: 'This invite link has been disabled by the room owner.' });
    return;
  }

  if (room.memberIds.includes(userId)) {
    res.json({ success: true, roomId: room.id, message: 'Already a member.' });
    return;
  }

  room.memberIds.push(userId);

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'JOIN_ROOM',
    details: `Joined room ${room.name} via invite token.`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'room_join',
    userId,
    targetId: room.id,
    targetType: 'Room',
    metadata: { isOwner: false },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, roomId: room.id });
});

function normalizeInviteToken(rawToken: unknown): string {
  if (typeof rawToken !== 'string') return '';
  const trimmed = rawToken.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    return sanitizeText(url.searchParams.get('token') || '', 100);
  } catch {
    const tokenMatch = trimmed.match(/[?&]token=([^&]+)/);
    return sanitizeText(decodeURIComponent(tokenMatch?.[1] || trimmed), 100);
  }
}

// Toggle Invite
roomsRouter.post('/api/rooms/:id/invite/toggle', (req: any, res) => {
  const userId = req.userId;
  const roomId = req.params.id;
  const db = readDatabase();
  const room = db.rooms[roomId];

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (room.ownerId !== userId) {
    res.status(403).json({ error: 'Only the room owner can manage invites.' });
    return;
  }

  room.isInviteDisabled = !room.isInviteDisabled;

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'TOGGLE_INVITE',
    details: `${room.isInviteDisabled ? 'Disabled' : 'Enabled'} invites for room ${room.name}`,
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, room });
});
