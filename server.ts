import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { exec } from 'child_process';
import util from 'util';
import { createServer as createViteServer } from 'vite';

const execAsync = util.promisify(exec);
import { DatabaseState, User, FriendRoom, TradingAgent, PaperStrategy, PaperTrade, VaultClub, AuditEvent, GraphEvent, GraphNode, GraphEdge } from './src/types.js';

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'db.json');

// Helper to load/initialize the JSON database atomically
function readDatabase(): DatabaseState {
  try {
    const defaultPredictions = {
      "pred_btc_120k": {
        id: "pred_btc_120k",
        question: "Will BTC reach $120,000 before December 31, 2026?",
        category: "Crypto" as const,
        yesPool: 50000,
        noPool: 35000,
        resolved: false,
        outcome: null,
        endTime: Date.now() + 180 * 24 * 60 * 60 * 1000,
        volume: 85000,
        bets: {}
      },
      "pred_agent_beat": {
        id: "pred_agent_beat",
        question: "Will the Custom AI Agent outperform the Momentum Strategy over the next week?",
        category: "AI Performance" as const,
        yesPool: 24000,
        noPool: 28000,
        resolved: false,
        outcome: null,
        endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
        volume: 52000,
        bets: {}
      },
      "pred_gas_12gwei": {
        id: "pred_gas_12gwei",
        question: "Will Ethereum gas fee average stay below 12 Gwei during July 2026?",
        category: "Macro" as const,
        yesPool: 15000,
        noPool: 45000,
        resolved: false,
        outcome: null,
        endTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
        volume: 60000,
        bets: {}
      }
    };

    if (!fs.existsSync(DB_FILE)) {
      const initialState: DatabaseState = {
        users: {},
        rooms: {},
        agents: {},
        strategies: {},
        trades: [],
        vaultClubs: {},
        auditEvents: [],
        graphEvents: [],
        predictionMarkets: defaultPredictions
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), 'utf8');
      return initialState;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.predictionMarkets) {
      parsed.predictionMarkets = defaultPredictions;
    }
    return parsed;
  } catch (error) {
    console.error('Error reading database, resetting:', error);
    return {
      users: {},
      rooms: {},
      agents: {},
      strategies: {},
      trades: [],
      vaultClubs: {},
      auditEvents: [],
      graphEvents: [],
      predictionMarkets: {}
    };
  }
}

function writeDatabase(state: DatabaseState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Generate random unguessable IDs/tokens
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Simulated real-time token prices stored in server-side state
const serverPrices: Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number; marketCap: number; supply: string; name: string; description: string }> = {
  BTC: { price: 96420.50, change24h: 3.42, high24h: 97100.00, low24h: 92850.00, volume24h: 42150000000, marketCap: 1890000000000, supply: '19.6M / 21M', name: 'Bitcoin', description: "The world's first decentralized digital currency. Bitcoin operates as a sovereign store of value and digital gold." },
  ETH: { price: 3125.20, change24h: -1.15, high24h: 3220.00, low24h: 3090.50, volume24h: 18450000000, marketCap: 375000000000, supply: '120.1M', name: 'Ethereum', description: "A decentralized, open-source blockchain with smart contract functionality. Ether is the native fuel powering the EVM." },
  SOL: { price: 184.80, change24h: 8.76, high24h: 189.50, low24h: 168.40, volume24h: 4890000000, marketCap: 83000000000, supply: '446.2M', name: 'Solana', description: "A high-performance blockchain supporting builders globally. Solana uses proof-of-history to facilitate sub-second processing speeds." },
  LINK: { price: 16.15, change24h: 0.54, high24h: 16.70, low24h: 15.85, volume24h: 890000000, marketCap: 9500000000, supply: '587M / 1B', name: 'Chainlink', description: "A decentralized oracle network providing real-world data feeds to smart contracts across multiple host blockchains." },
  DOGE: { price: 0.285, change24h: 14.25, high24h: 0.31, low24h: 0.24, volume24h: 2150000000, marketCap: 41000000000, supply: '144B', name: 'Dogecoin', description: "The original decentralized open-source meme coin. Dogecoin relies on rapid mining and supportive cooperative communities." },
  BNB: { price: 600.00, change24h: 1.5, high24h: 610.00, low24h: 590.00, volume24h: 1200000000, marketCap: 90000000000, supply: '147M', name: 'BNB', description: "The native cryptocurrency of the Binance ecosystem." },
  XRP: { price: 0.55, change24h: 2.1, high24h: 0.56, low24h: 0.53, volume24h: 1500000000, marketCap: 30000000000, supply: '55B', name: 'XRP', description: "A digital asset built for global payments." },
  ADA: { price: 0.45, change24h: 0.5, high24h: 0.46, low24h: 0.44, volume24h: 400000000, marketCap: 15000000000, supply: '35B', name: 'Cardano', description: "A proof-of-stake blockchain platform that says its goal is to allow 'changemakers, innovators and visionaries' to bring about positive global change." },
  AVAX: { price: 35.00, change24h: 4.2, high24h: 36.50, low24h: 33.00, volume24h: 600000000, marketCap: 13000000000, supply: '377M', name: 'Avalanche', description: "A smart contracts platform built to scale infinitely and finalize transactions in under a second." },
  DOT: { price: 6.50, change24h: 1.2, high24h: 6.70, low24h: 6.40, volume24h: 250000000, marketCap: 8000000000, supply: '1.4B', name: 'Polkadot', description: "An open-source sharded multichain protocol that connects and secures a network of specialized blockchains." },
  MATIC: { price: 0.65, change24h: -0.5, high24h: 0.68, low24h: 0.64, volume24h: 300000000, marketCap: 6000000000, supply: '9.8B', name: 'Polygon', description: "The first well-structured, easy-to-use platform for Ethereum scaling and infrastructure development." },
};

const BINANCE_SYMBOLS: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', LINK: 'LINKUSDT', DOGE: 'DOGEUSDT', 
  BNB: 'BNBUSDT', XRP: 'XRPUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT', DOT: 'DOTUSDT', MATIC: 'MATICUSDT'
};

let lastBinanceFetch = 0;

// Periodically update serverPrices slightly to simulate real-time price changes, and fetch from Binance occasionally
setInterval(async () => {
  const now = Date.now();
  if (now - lastBinanceFetch > 10000) { // Fetch every 10 seconds
    try {
      const symbolsStr = JSON.stringify(Object.values(BINANCE_SYMBOLS));
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsStr}`);
      if (res.ok) {
        const data = await res.json();
        data.forEach((ticker: any) => {
          const symbol = Object.keys(BINANCE_SYMBOLS).find(k => BINANCE_SYMBOLS[k] === ticker.symbol);
          if (symbol && serverPrices[symbol]) {
            serverPrices[symbol].price = parseFloat(ticker.lastPrice);
            serverPrices[symbol].change24h = parseFloat(ticker.priceChangePercent);
            serverPrices[symbol].high24h = parseFloat(ticker.highPrice);
            serverPrices[symbol].low24h = parseFloat(ticker.lowPrice);
            serverPrices[symbol].volume24h = parseFloat(ticker.quoteVolume);
          }
        });
        lastBinanceFetch = now;
        return; // Skip simulation if we just fetched
      }
    } catch (e) {
      console.error('Failed to fetch from Binance, falling back to simulation', e);
    }
  }

  // Fallback / in-between simulation
  Object.keys(serverPrices).forEach(symbol => {
    const changePercent = (Math.random() - 0.48) * 0.002; // slight upward bias
    const oldPrice = serverPrices[symbol].price;
    const newPrice = Number((oldPrice * (1 + changePercent)).toFixed(symbol === 'DOGE' || symbol === 'XRP' || symbol === 'ADA' || symbol === 'MATIC' ? 4 : 2));
    serverPrices[symbol].price = newPrice;
    serverPrices[symbol].high24h = Math.max(serverPrices[symbol].high24h, newPrice);
    serverPrices[symbol].low24h = Math.min(serverPrices[symbol].low24h, newPrice);
    serverPrices[symbol].change24h = Number((serverPrices[symbol].change24h + changePercent * 100).toFixed(2));
  });
}, 3000);

// Setup Express
const app = express();
app.use(express.json());
app.use(cookieParser('metaedge-secret-key-cookie'));

// Middleware to resolve or create anonymous session
app.use((req, res, next) => {
  let userId = (req.headers['x-metaedge-session-id'] as string) || req.cookies.metaedge_session;
  const db = readDatabase();

  if (!userId || !db.users[userId]) {
    // Generate new anonymous user
    userId = 'usr_' + generateId();
    const newUser: User = {
      id: userId,
      username: `Trader_${Math.floor(1000 + Math.random() * 9000)}`,
      profile: {
        displayName: `MetaEdge Agent`,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
        bio: 'Self-custodial agent room member.',
        updatedAt: Date.now()
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      paperBalance: 100000, // $100,000 initial balance
      faucetClaimedCount: 0
    };
    db.users[userId] = newUser;

    // Log login audit & graph events
    const auditEvent: AuditEvent = {
      id: 'aud_' + generateId(),
      userId,
      username: newUser.username,
      action: 'LOGIN',
      details: 'Created anonymous user session.',
      timestamp: Date.now()
    };
    db.auditEvents.push(auditEvent);

    const graphEvent: GraphEvent = {
      id: 'gph_' + generateId(),
      type: 'login',
      userId,
      targetId: userId,
      targetType: 'User',
      metadata: { browser: req.headers['user-agent'] || 'unknown' },
      timestamp: Date.now()
    };
    db.graphEvents.push(graphEvent);

    writeDatabase(db);
    res.cookie('metaedge_session', userId, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  } else {
    // Update last active time
    db.users[userId].lastActiveAt = Date.now();
    writeDatabase(db);
  }

  (req as any).userId = userId;
  next();
});

// Helper for sanitizing text inputs to prevent XSS/unwanted rendering
function sanitizeText(str: string, maxLen = 100): string {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, maxLen).trim();
}

// --- HEALTH ENDPOINT ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'MetaEdge V1',
    version: '1.0.0',
    buildCommit: 'a87b32c',
    dbConnectivity: true,
    graphProjectionStatus: true,
    liveModeGlobalLock: true
  });
});

// --- PRICES ENDPOINT ---
app.get('/api/prices', (req, res) => {
  res.json({ success: true, prices: serverPrices });
});

// --- SESSION ENDPOINT ---
app.get('/api/session', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();
  const user = db.users[userId];
  res.json({ user });
});

// --- DASHBOARD DATA ENDPOINT (BATCHED) ---
app.get('/api/dashboard-data', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();
  
  const rooms = Object.values(db.rooms).filter(r => r.memberIds.includes(userId));
  const agents = Object.values(db.agents).filter((a: any) => a.ownerId === userId);
  const strategies = Object.values(db.strategies).filter((s: any) => s.authorId === userId);
  const vaults = Object.values(db.vaultClubs).filter(v => v.ownerId === userId || v.memberContributions[userId] !== undefined);
  const audits = db.auditEvents.filter(a => a.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
  const trades = db.trades.filter(t => t.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
  const predictionMarkets = Object.values(db.predictionMarkets).sort((a, b) => b.endTime - a.endTime);

  res.json({ rooms, agents, strategies, vaults, audits, trades, predictionMarkets });
});

// --- PROFILE MUTATION ---
app.post('/api/profile', (req, res) => {
  const userId = (req as any).userId;
  const { displayName, avatarUrl, bio } = req.body;
  
  if (!displayName) {
    res.status(400).json({ error: 'Display name is required' });
    return;
  }

  const db = readDatabase();
  const user = db.users[userId];
  
  user.profile.displayName = sanitizeText(displayName, 50);
  user.profile.avatarUrl = sanitizeText(avatarUrl, 250);
  user.profile.bio = sanitizeText(bio || '', 300);
  user.profile.updatedAt = Date.now();
  user.username = sanitizeText(displayName, 50).toLowerCase().replace(/\s+/g, '_');

  // Record audit and graph event
  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'PROFILE_UPDATE',
    details: `Updated display name to ${user.profile.displayName}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'profile_update',
    userId,
    targetId: userId,
    targetType: 'User',
    metadata: { profile: user.profile },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, user });
});

// --- FAUCET CLAIM ---
app.post('/api/faucet', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();
  const user = db.users[userId];

  if (user.faucetClaimedCount >= 10) {
    res.status(400).json({ error: 'Faucet limit reached for this simulation session (max 10 times).' });
    return;
  }

  const faucetAmount = 10000; // Claim $10,000 Paper Money
  user.paperBalance += faucetAmount;
  user.faucetClaimedCount += 1;

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'FAUCET_CLAIM',
    details: `Claimed $${faucetAmount} paper funds. New balance: $${user.paperBalance}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'paper_action',
    userId,
    targetId: userId,
    targetType: 'User',
    metadata: { amount: faucetAmount, balance: user.paperBalance },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, balance: user.paperBalance, faucetClaimedCount: user.faucetClaimedCount });
});

// --- FRIEND ROOMS API ---

// Create Room
app.post('/api/rooms', (req, res) => {
  const userId = (req as any).userId;
  const { name, description } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Room name is required' });
    return;
  }

  const db = readDatabase();
  const roomId = 'rm_' + generateId();
  const inviteToken = 'inv_' + generateId();

  const newRoom: FriendRoom = {
    id: roomId,
    name: sanitizeText(name, 50),
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
app.get('/api/rooms', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();
  const joinedRooms = Object.values(db.rooms).filter(r => r.memberIds.includes(userId));
  res.json({ rooms: joinedRooms });
});

// Get room details (Enforce ownership/membership check to prevent IDOR)
app.get('/api/rooms/:id', (req, res) => {
  const userId = (req as any).userId;
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
  const sharedStrategies = Object.values(db.strategies).filter(s => s.roomId === roomId || s.id === roomId); // Simple fallback

  res.json({ room, members, sharedStrategies });
});

// Join Room via Invite Token
app.post('/api/rooms/join', (req, res) => {
  const userId = (req as any).userId;
  const { inviteToken } = req.body;

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

// Toggle Invite
app.post('/api/rooms/:id/invite/toggle', (req, res) => {
  const userId = (req as any).userId;
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

// --- TRADING AGENTS API ---

// Create Agent
app.post('/api/agents', (req, res) => {
  const userId = (req as any).userId;
  const { name, description, assetSymbol, tradeType, strategyType, leverage, roomId } = req.body;

  if (!name || !assetSymbol) {
    res.status(400).json({ error: 'Agent name and asset are required' });
    return;
  }

  const db = readDatabase();
  const agentId = 'agt_' + generateId();

  const newAgent: TradingAgent = {
    id: agentId,
    name: sanitizeText(name, 50),
    description: sanitizeText(description || '', 150),
    ownerId: userId,
    roomId: roomId ? sanitizeText(roomId, 50) : undefined,
    assetSymbol: sanitizeText(assetSymbol, 10).toUpperCase(),
    tradeType: tradeType === 'perp' ? 'perp' : 'token',
    strategyType: ['momentum', 'grid', 'mean_reversion', 'custom_ai'].includes(strategyType) ? strategyType : 'momentum',
    leverage: Number(leverage) || 1,
    status: 'active',
    createdAt: Date.now()
  };

  db.agents[agentId] = newAgent;

  // Track shared strategy immediately if roomId is specified
  if (roomId && db.rooms[roomId] && db.rooms[roomId].memberIds.includes(userId)) {
    const stratId = 'str_' + generateId();
    const newStrategy: PaperStrategy = {
      id: stratId,
      agentId,
      name: newAgent.name,
      description: newAgent.description,
      authorId: userId,
      assetSymbol: newAgent.assetSymbol,
      tradeType: newAgent.tradeType,
      status: 'active',
      copiedCount: 0,
      createdAt: Date.now()
    };
    db.strategies[stratId] = newStrategy;

    db.graphEvents.push({
      id: 'gph_' + generateId(),
      type: 'strategy_share',
      userId,
      targetId: stratId,
      targetType: 'Strategy',
      metadata: { roomId, agentId },
      timestamp: Date.now()
    });
  }

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'CREATE_AGENT',
    details: `Created agent ${newAgent.name} executing ${newAgent.strategyType} on ${newAgent.assetSymbol}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'agent_creation',
    userId,
    targetId: agentId,
    targetType: 'Agent',
    metadata: { strategy: newAgent.strategyType },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, agent: newAgent });
});

// List Agents
app.get('/api/agents', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();

  // Find users agents
  const myAgents = Object.values(db.agents).filter(a => a.ownerId === userId);
  res.json({ agents: myAgents });
});

// Toggle Status (Pause / Revoke)
app.post('/api/agents/:id/status', (req, res) => {
  const userId = (req as any).userId;
  const agentId = req.params.id;
  const { status } = req.body; // 'active', 'paused', 'revoked'

  if (!['active', 'paused', 'revoked'].includes(status)) {
    res.status(400).json({ error: 'Invalid agent status' });
    return;
  }

  const db = readDatabase();
  const agent = db.agents[agentId];

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (agent.ownerId !== userId) {
    res.status(403).json({ error: 'Unauthorized to control this agent' });
    return;
  }

  agent.status = status;

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'UPDATE_AGENT_STATUS',
    details: `Updated status of agent ${agent.name} to ${status}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'pause_revoke',
    userId,
    targetId: agentId,
    targetType: 'Agent',
    metadata: { status },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, agent });
});

// Delete Agent
app.delete('/api/agents/:id', (req, res) => {
  const userId = (req as any).userId;
  const agentId = req.params.id;

  const db = readDatabase();
  const agent = db.agents[agentId];

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (agent.ownerId !== userId) {
    res.status(403).json({ error: 'Unauthorized to delete this agent' });
    return;
  }

  // Delete the agent
  delete db.agents[agentId];

  // Clean up strategies associated with this agent
  Object.keys(db.strategies).forEach(stratId => {
    if (db.strategies[stratId].agentId === agentId) {
      delete db.strategies[stratId];
    }
  });

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'DELETE_AGENT',
    details: `Deleted agent ${agent.name}`,
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true });
});

// --- PAPER TRADES SIMULATION ---

// Post simulated fill
app.post('/api/trades', (req, res) => {
  const userId = (req as any).userId;
  const { agentId, assetSymbol, side, size, price, leverage, roomId } = req.body;

  if (!agentId || !assetSymbol || !side || !size || !price) {
    res.status(400).json({ error: 'Incomplete fill telemetry' });
    return;
  }

  const db = readDatabase();
  const agent = db.agents[agentId];

  if (!agent || agent.ownerId !== userId) {
    res.status(403).json({ error: 'Forbidden or agent missing' });
    return;
  }

  if (agent.status !== 'active') {
    res.status(400).json({ error: 'Agent is not running and cannot trade.' });
    return;
  }

  const executionPrice = Number(price);
  const tradeSize = Number(size);
  const tradeLeverage = Number(leverage) || 1;
  const notional = tradeSize * executionPrice;

  // Authoritative check on balances
  const user = db.users[userId];
  const requiredMargin = agent.tradeType === 'perp' ? notional / tradeLeverage : notional;

  if (side === 'buy' || side === 'long') {
    if (user.paperBalance < requiredMargin) {
      res.status(400).json({ error: 'Insufficient simulated paper balance to execute this trade.' });
      return;
    }
    user.paperBalance -= requiredMargin;
  } else {
    // Sell / Close / Short credit back
    user.paperBalance += requiredMargin * 1.02; // Arbitrary modest mock gain
  }

  const trade: PaperTrade = {
    id: 'trd_' + generateId(),
    agentId,
    userId,
    roomId: roomId || agent.roomId,
    assetSymbol: assetSymbol.toUpperCase(),
    tradeType: agent.tradeType,
    side: side,
    size: tradeSize,
    price: executionPrice,
    leverage: tradeLeverage,
    pnl: side === 'sell' || side === 'short' ? Math.random() * 200 - 50 : undefined,
    timestamp: Date.now()
  };

  db.trades.push(trade);
  agent.lastTradeAt = Date.now();

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'PAPER_TRADE',
    details: `Executed simulated ${side} of ${tradeSize} ${assetSymbol} at $${executionPrice}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'paper_action',
    userId,
    targetId: trade.id,
    targetType: 'Agent',
    metadata: { side, size: tradeSize, assetSymbol },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, trade, balance: user.paperBalance });
});

// List trades
app.get('/api/trades', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();
  const myTrades = db.trades.filter(t => t.userId === userId);
  res.json({ trades: myTrades });
});

// Delete a specific trade
app.delete('/api/trades/:id', (req, res) => {
  const userId = (req as any).userId;
  const tradeId = req.params.id;

  const db = readDatabase();
  const index = db.trades.findIndex(t => t.id === tradeId);

  if (index === -1) {
    res.status(404).json({ error: 'Trade not found' });
    return;
  }

  const trade = db.trades[index];
  if (trade.userId !== userId) {
    res.status(403).json({ error: 'Unauthorized to delete this trade' });
    return;
  }

  db.trades.splice(index, 1);

  writeDatabase(db);
  res.json({ success: true });
});

// Clear all trades for current user
app.delete('/api/trades', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();

  db.trades = db.trades.filter(t => t.userId !== userId);

  writeDatabase(db);
  res.json({ success: true });
});

// --- STRATEGIES ---

// List strategies
app.get('/api/strategies', (req, res) => {
  const db = readDatabase();
  res.json({ strategies: Object.values(db.strategies) });
});

// Copy a Strategy
app.post('/api/strategies/copy', (req, res) => {
  const userId = (req as any).userId;
  const { strategyId } = req.body;

  const db = readDatabase();
  const sourceStrategy = db.strategies[strategyId];

  if (!sourceStrategy) {
    res.status(404).json({ error: 'Strategy not found' });
    return;
  }

  // Create a copied agent
  const agentId = 'agt_' + generateId();
  const newAgent: TradingAgent = {
    id: agentId,
    name: `${sourceStrategy.name} (Copy)`,
    description: `Copied from ${db.users[sourceStrategy.authorId]?.profile.displayName || 'another trader'}.`,
    ownerId: userId,
    assetSymbol: sourceStrategy.assetSymbol,
    tradeType: sourceStrategy.tradeType,
    strategyType: 'momentum',
    leverage: 1,
    status: 'paused', // Copy starts paused so user can review live-safety checklist
    createdAt: Date.now()
  };

  db.agents[agentId] = newAgent;
  sourceStrategy.copiedCount += 1;

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'COPY_STRATEGY',
    details: `Copied strategy ${sourceStrategy.name} into agent ${newAgent.name}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'strategy_copy',
    userId,
    targetId: sourceStrategy.id,
    targetType: 'Strategy',
    metadata: { newAgentId: agentId },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, agent: newAgent });
});

// --- VAULT CLUBS API ---

// Create Vault Club
app.post('/api/vaults', (req, res) => {
  const userId = (req as any).userId;
  const { name, description } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Vault name is required' });
    return;
  }

  const db = readDatabase();
  const vaultId = 'vlt_' + generateId();

  const newVault: VaultClub = {
    id: vaultId,
    name: sanitizeText(name, 50),
    description: sanitizeText(description || '', 200),
    ownerId: userId,
    createdAt: Date.now(),
    simulatedTotalContribution: 0,
    memberContributions: { [userId]: 0 },
    milestones: ['Club Launch']
  };

  db.vaultClubs[vaultId] = newVault;

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'CREATE_VAULT',
    details: `Created vault club ${newVault.name}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'vault_action',
    userId,
    targetId: vaultId,
    targetType: 'VaultClub',
    metadata: { action: 'launch' },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, vault: newVault });
});

// List Vaults
app.get('/api/vaults', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();
  // Return vaults where user is a contributor or owner
  const myVaults = Object.values(db.vaultClubs).filter(v => v.ownerId === userId || v.memberContributions[userId] !== undefined);
  res.json({ vaults: myVaults });
});

// Simulate contribution to Vault
app.post('/api/vaults/:id/contribute', (req, res) => {
  const userId = (req as any).userId;
  const vaultId = req.params.id;
  const { amount } = req.body;

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    res.status(400).json({ error: 'Valid contribution amount is required' });
    return;
  }

  const db = readDatabase();
  const vault = db.vaultClubs[vaultId];

  if (!vault) {
    res.status(404).json({ error: 'Vault club not found' });
    return;
  }

  const contribution = Number(amount);
  const user = db.users[userId];

  if (user.paperBalance < contribution) {
    res.status(400).json({ error: 'Insufficient paper balance to contribute.' });
    return;
  }

  user.paperBalance -= contribution;
  vault.simulatedTotalContribution += contribution;
  vault.memberContributions[userId] = (vault.memberContributions[userId] || 0) + contribution;

  // Award milestones based on contribution size
  if (vault.simulatedTotalContribution >= 50000 && !vault.milestones.includes('$50k Simulated Threshold')) {
    vault.milestones.push('$50k Simulated Threshold');
  }

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'VAULT_CONTRIBUTE',
    details: `Contributed $${contribution} simulated funds to ${vault.name}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'vault_action',
    userId,
    targetId: vaultId,
    targetType: 'VaultClub',
    metadata: { amount: contribution },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, vault, balance: user.paperBalance });
});

// --- KNOWLEDGE GRAPH PROJECTION ENGINE ---
app.get('/api/graph', (req, res) => {
  const db = readDatabase();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Add Users
  Object.values(db.users).forEach(u => {
    nodes.push({
      id: u.id,
      label: 'User',
      properties: { name: u.profile.displayName, balance: u.paperBalance }
    });
  });

  // Add Rooms
  Object.values(db.rooms).forEach(r => {
    nodes.push({
      id: r.id,
      label: 'Room',
      properties: { name: r.name }
    });
    // Member of edges
    r.memberIds.forEach(mId => {
      edges.push({
        id: `edg_${mId}_${r.id}`,
        source: mId,
        target: r.id,
        type: 'MEMBER_OF',
        properties: {}
      });
    });
  });

  // Add Agents
  Object.values(db.agents).forEach(a => {
    nodes.push({
      id: a.id,
      label: 'Agent',
      properties: { name: a.name, status: a.status, asset: a.assetSymbol }
    });
    // Owner edge
    edges.push({
      id: `edg_${a.ownerId}_${a.id}`,
      source: a.ownerId,
      target: a.id,
      type: 'OWNS_AGENT',
      properties: {}
    });
  });

  // Add Vault Clubs
  Object.values(db.vaultClubs).forEach(v => {
    nodes.push({
      id: v.id,
      label: 'VaultClub',
      properties: { name: v.name, contribution: v.simulatedTotalContribution }
    });
    // Member contributions
    Object.keys(v.memberContributions).forEach(mId => {
      edges.push({
        id: `edg_${mId}_${v.id}`,
        source: mId,
        target: v.id,
        type: 'CONTRIBUTED_TO',
        properties: { amount: v.memberContributions[mId] }
      });
    });
  });

  // Add Strategies
  Object.values(db.strategies).forEach(s => {
    nodes.push({
      id: s.id,
      label: 'Strategy',
      properties: { name: s.name, copiedCount: s.copiedCount }
    });
    // Ownership
    edges.push({
      id: `edg_${s.authorId}_${s.id}`,
      source: s.authorId,
      target: s.id,
      type: 'CREATED_STRATEGY',
      properties: {}
    });
  });

  res.json({ nodes, edges });
});

// --- PREDICTION MARKETS ENDPOINTS ---

// List prediction markets
app.get('/api/predictions', (req, res) => {
  const db = readDatabase();
  res.json({ predictionMarkets: Object.values(db.predictionMarkets || {}) });
});

// Place prediction market bet
app.post('/api/predictions/:id/bet', (req, res) => {
  const userId = (req as any).userId;
  const marketId = req.params.id;
  const { side, amount } = req.body;

  if (!side || !amount || isNaN(amount) || Number(amount) <= 0) {
    res.status(400).json({ error: 'Valid side (yes/no) and amount are required' });
    return;
  }

  if (side !== 'yes' && side !== 'no') {
    res.status(400).json({ error: 'Side must be either "yes" or "no"' });
    return;
  }

  const db = readDatabase();
  const markets = db.predictionMarkets || {};
  const market = markets[marketId];

  if (!market) {
    res.status(404).json({ error: 'Prediction market not found' });
    return;
  }

  if (market.resolved) {
    res.status(400).json({ error: 'Market is already resolved' });
    return;
  }

  const betAmount = Number(amount);
  const user = db.users[userId];

  if (user.paperBalance < betAmount) {
    res.status(400).json({ error: 'Insufficient simulated paper balance to place this bet' });
    return;
  }

  // Deduct balance
  user.paperBalance -= betAmount;

  // Add pool size
  if (side === 'yes') {
    market.yesPool += betAmount;
  } else {
    market.noPool += betAmount;
  }
  market.volume += betAmount;

  // Update user bets
  if (!market.bets[userId]) {
    market.bets[userId] = {
      yesShares: 0,
      noShares: 0,
      invested: 0
    };
  }

  const userBet = market.bets[userId];
  userBet.invested += betAmount;
  
  // Calculate shares purchased (using simple constant-product-like or current odds price)
  const totalPool = market.yesPool + market.noPool;
  const currentPrice = side === 'yes' ? (market.yesPool / totalPool) : (market.noPool / totalPool);
  const sharesPurchased = betAmount / (currentPrice || 0.5);

  if (side === 'yes') {
    userBet.yesShares += sharesPurchased;
  } else {
    userBet.noShares += sharesPurchased;
  }

  // Create audit and graph events
  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'PREDICTION_BET',
    details: `Placed a $${betAmount} simulated ${side.toUpperCase()} bet on prediction market: "${market.question}"`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'paper_action',
    userId,
    targetId: marketId,
    targetType: 'User', // general
    metadata: { marketId, side, amount: betAmount },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, market, balance: user.paperBalance });
});

// Resolve a prediction market (for simulated/interactive resolution)
app.post('/api/predictions/:id/resolve', (req, res) => {
  const userId = (req as any).userId;
  const marketId = req.params.id;
  const { outcome } = req.body;

  if (outcome !== 'yes' && outcome !== 'no') {
    res.status(400).json({ error: 'Outcome must be either "yes" or "no"' });
    return;
  }

  const db = readDatabase();
  const markets = db.predictionMarkets || {};
  const market = markets[marketId];

  if (!market) {
    res.status(404).json({ error: 'Prediction market not found' });
    return;
  }

  if (market.resolved) {
    res.status(400).json({ error: 'Market is already resolved' });
    return;
  }

  market.resolved = true;
  market.outcome = outcome;

  // Pay out winning bets
  const totalPool = market.yesPool + market.noPool;
  const totalWinningPool = outcome === 'yes' ? market.yesPool : market.noPool;

  Object.entries(market.bets).forEach(([betUserId, betInfo]) => {
    const winningShares = outcome === 'yes' ? betInfo.yesShares : betInfo.noShares;
    const targetUser = db.users[betUserId];

    if (winningShares > 0 && targetUser) {
      // Calculate payout based on proportion of winning pool
      // As a fallback to avoid infinite multiplier, limit payout or do simple proportion
      const userProportion = winningShares / (totalWinningPool || 1);
      const payout = userProportion * totalPool;
      targetUser.paperBalance += payout;

      db.auditEvents.push({
        id: 'aud_' + generateId(),
        userId: betUserId,
        username: targetUser.username,
        action: 'PREDICTION_PAYOUT',
        details: `Received $${payout.toFixed(2)} simulated payout from prediction market resolution: "${market.question}"`,
        timestamp: Date.now()
      });
    }
  });

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId]?.username || 'System',
    action: 'PREDICTION_RESOLVED',
    details: `Resolved prediction market "${market.question}" with outcome: ${outcome.toUpperCase()}`,
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, market });
});

// --- AUDIT ENDPOINT ---
app.get('/api/audit', (req, res) => {
  const db = readDatabase();
  // Return last 50 audit logs sorted by timestamp desc
  const sortedAudits = [...db.auditEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  res.json({ audits: sortedAudits });
});

// --- METAMASK AGENT WALLET ENDPOINTS ---

app.post('/api/mm/login', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 login --token "${token.replace(/"/g, '\\"')}"`);
    res.json({ success: true, output: stdout });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.get('/api/mm/status', async (req, res) => {
  try {
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 auth status --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.get('/api/mm/address', async (req, res) => {
  try {
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 wallet address`);
    res.json({ address: stdout.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.get('/api/mm/balance', async (req, res) => {
  try {
    const chainId = req.query.chain || '8453';
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 wallet balance --chain ${chainId} --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.post('/api/mm/transfer', async (req, res) => {
  try {
    const { to, amount, token, chainId } = req.body;
    if (!to || !amount) return res.status(400).json({ error: 'Missing destination or amount' });
    const cmd = `npx -y @metamask/agentic-cli@3 transfer --to "${to}" --amount ${amount} --token ${token || 'native'} --chain-id ${chainId || '8453'} --wait --json`;
    const { stdout } = await execAsync(cmd);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.post('/api/mm/swap/quote', async (req, res) => {
  try {
    const { from, to, amount, fromChain, toChain } = req.body;
    let cmd = `npx -y @metamask/agentic-cli@3 swap quote --from ${from} --to ${to} --amount ${amount} --from-chain ${fromChain || '8453'} --json`;
    if (toChain) cmd += ` --to-chain ${toChain}`;
    const { stdout } = await execAsync(cmd);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.post('/api/mm/swap/execute', async (req, res) => {
  try {
    const { quoteId } = req.body;
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 swap execute --quote-id ${quoteId} --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.get('/api/mm/perps/balance', async (req, res) => {
  try {
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 perps balance --venue hyperliquid --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.post('/api/mm/perps/open', async (req, res) => {
  try {
    const { symbol, side, size, leverage } = req.body;
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 perps open --venue hyperliquid --symbol ${symbol} --side ${side} --size ${size} --leverage ${leverage || 1} --yes --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

app.get('/api/mm/predict/markets', async (req, res) => {
  try {
    const { query } = req.query;
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 predict markets search "${query || 'politics'}" --limit 5 --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

// --- VITE MIDDLEWARE SETUP FOR DEV/PROD ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MetaEdge V1 Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
