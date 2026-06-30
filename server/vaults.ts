import { Router } from 'express';
import { readDatabase, writeDatabase, generateId, sanitizeText } from './storage.js';
import type { VaultClub } from '../src/types';

export const vaultsRouter = Router();

// Create Vault Club
vaultsRouter.post('/api/vaults', (req: any, res) => {
  const userId = req.userId;
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
vaultsRouter.get('/api/vaults', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  // Return vaults where user is a contributor or owner
  const myVaults = Object.values(db.vaultClubs).filter(v => v.ownerId === userId || v.memberContributions[userId] !== undefined);
  res.json({ vaults: myVaults });
});

// Simulate contribution to Vault
vaultsRouter.post('/api/vaults/:id/contribute', (req: any, res) => {
  const userId = req.userId;
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
