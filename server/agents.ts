import { Router } from 'express';
import { readDatabase, writeDatabase, generateId, sanitizeText } from './storage.js';
import type { TradingAgent, PaperStrategy } from '../src/types';

export const agentsRouter = Router();

// Create Agent
agentsRouter.post('/api/agents', (req: any, res) => {
  const userId = req.userId;
  const { name, description, assetSymbol, tradeType, strategyType, leverage, roomId } = req.body;
  const agentName = sanitizeText(name || '', 50);
  const agentAssetSymbol = sanitizeText(assetSymbol || '', 10).toUpperCase();

  if (!agentName || !agentAssetSymbol) {
    res.status(400).json({ error: 'Agent name and asset are required' });
    return;
  }

  const db = readDatabase();
  // Per-user cap: prevents unbounded agent creation from bloating the db.
  const AGENT_CAP = 50;
  const owned = Object.values(db.agents).filter((a: any) => a.ownerId === userId && a.status !== 'revoked').length;
  if (owned >= AGENT_CAP) {
    res.status(400).json({ error: `You already have the maximum of ${AGENT_CAP} agents. Retire some to create more.` });
    return;
  }
  const sharedRoomId = sanitizeText(roomId || '', 50);
  if (sharedRoomId) {
    const room = db.rooms[sharedRoomId];
    if (!room || !room.memberIds.includes(userId)) {
      res.status(403).json({ error: 'Join the room before sharing an agent there.' });
      return;
    }
  }

  const agentId = 'agt_' + generateId();

  const newAgent: TradingAgent = {
    id: agentId,
    name: agentName,
    description: sanitizeText(description || '', 150),
    ownerId: userId,
    roomId: sharedRoomId || undefined,
    assetSymbol: agentAssetSymbol,
    tradeType: tradeType === 'perp' ? 'perp' : 'token',
    strategyType: ['momentum', 'grid', 'mean_reversion', 'custom_ai', 'rsi_meanrev'].includes(strategyType) ? strategyType : 'momentum',
    leverage: Number(leverage) || 1,
    status: 'active',
    createdAt: Date.now()
  };

  db.agents[agentId] = newAgent;

  // Track shared strategy immediately if roomId is specified
  if (sharedRoomId) {
    const stratId = 'str_' + generateId();
    const newStrategy: PaperStrategy = {
      id: stratId,
      agentId,
      name: newAgent.name,
      description: newAgent.description,
      authorId: userId,
      roomId: sharedRoomId,
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
      metadata: { roomId: sharedRoomId, agentId },
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
agentsRouter.get('/api/agents', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();

  // Find users agents
  const myAgents = Object.values(db.agents).filter(a => a.ownerId === userId);
  res.json({ agents: myAgents });
});

// Toggle Status (Pause / Revoke)
// Toggle per-agent Autopilot: opt-in server-side self-trading (paper only).
agentsRouter.post('/api/agents/:id/autopilot', (req: any, res) => {
  const userId = req.userId;
  const agentId = req.params.id;
  const enabled = req.body?.enabled === true;

  const db = readDatabase();
  const agent = db.agents[agentId];
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
  if (agent.ownerId !== userId) { res.status(403).json({ error: 'Unauthorized to control this agent' }); return; }

  // Cap concurrent autopilot agents per user so the server-side engine stays
  // bounded no matter how many agents someone spins up.
  const AUTOPILOT_CAP = 8;
  if (enabled && !agent.autopilot) {
    const active = Object.values(db.agents).filter((a) => a.ownerId === userId && a.autopilot && a.status === 'active').length;
    if (active >= AUTOPILOT_CAP) {
      res.status(400).json({ error: `You can run at most ${AUTOPILOT_CAP} agents on autopilot at once.` });
      return;
    }
  }

  agent.autopilot = enabled;
  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId].username,
    action: 'AGENT_AUTOPILOT',
    details: `${enabled ? 'Enabled' : 'Disabled'} autopilot for agent ${agent.name}`,
    timestamp: Date.now()
  });
  writeDatabase(db);
  res.json({ success: true, agent });
});

agentsRouter.post('/api/agents/:id/status', (req: any, res) => {
  const userId = req.userId;
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
agentsRouter.delete('/api/agents/:id', (req: any, res) => {
  const userId = req.userId;
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

// List strategies
agentsRouter.get('/api/strategies', (req, res) => {
  const userId = (req as any).userId;
  const db = readDatabase();
  const strategies = Object.values(db.strategies).filter(strategy => canAccessStrategy(db, userId, strategy));
  res.json({ strategies });
});

// Copy a Strategy
agentsRouter.post('/api/strategies/copy', (req: any, res) => {
  const userId = req.userId;
  const { strategyId } = req.body;

  const db = readDatabase();
  const sourceStrategy = db.strategies[strategyId];

  if (!sourceStrategy) {
    res.status(404).json({ error: 'Strategy not found' });
    return;
  }

  if (!canAccessStrategy(db, userId, sourceStrategy)) {
    res.status(403).json({ error: 'Join the room before copying this strategy.' });
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

function canAccessStrategy(db: ReturnType<typeof readDatabase>, userId: string, strategy: PaperStrategy): boolean {
  if (strategy.authorId === userId) return true;
  if (!strategy.roomId) return false;
  return Boolean(db.rooms[strategy.roomId]?.memberIds.includes(userId));
}
