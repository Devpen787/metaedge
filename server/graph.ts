import { Router } from 'express';
import { readDatabase } from './storage.js';
import type { GraphNode, GraphEdge } from '../src/types';

export const graphRouter = Router();

// --- KNOWLEDGE GRAPH PROJECTION ENGINE ---
graphRouter.get('/api/graph', (req, res) => {
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
