import { Router } from 'express';
import { readDatabase, writeDatabase, generateId, sanitizeText } from './storage.js';
import type { TradingAgent, PaperStrategy } from '../src/types';

export const agentsRouter = Router();

// Create Agent
agentsRouter.post('/api/agents', (req: any, res) => {
  const userId = req.userId;
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
agentsRouter.get('/api/agents', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();

  // Find users agents
  const myAgents = Object.values(db.agents).filter(a => a.ownerId === userId);
  res.json({ agents: myAgents });
});

// Toggle Status (Pause / Revoke)
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
  const db = readDatabase();
  res.json({ strategies: Object.values(db.strategies) });
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
