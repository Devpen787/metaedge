/**
 * MetaEdge V1 Schema and Types Definition
 */

export interface Profile {
  displayName: string;
  avatarUrl: string;
  bio?: string;
  claimedAt?: number;
  updatedAt: number;
}

export interface User {
  id: string; // Server-authoritative anonymous userId
  username: string;
  profile: Profile;
  createdAt: number;
  lastActiveAt: number;
  paperBalance: number; // Defaults to e.g. 100,000 USD for paper trading
  faucetClaimedCount: number;
  // Set when the user connects THEIR OWN MetaMask Agent Wallet (per-user CLI
  // profile on the server). Connecting is required to compete in the Arena.
  walletAddress?: string;
  walletConnectedAt?: number;
}

export interface SessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

export interface WalletState {
  isInstalled: boolean;
  isConnected: boolean;
  address?: string;
  chainId?: number;
  balanceEth?: number;
}

export interface FriendRoom {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  inviteToken: string; // Signed/unguessable token for joining
  isInviteDisabled: boolean;
  memberIds: string[];
  createdAt: number;
}

export type AgentStatus = 'active' | 'paused' | 'revoked';

export interface TradingAgent {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  roomId?: string; // Optional room scope
  assetSymbol: string; // e.g., 'BTC', 'ETH', 'SOL'
  tradeType: 'token' | 'perp';
  strategyType: 'momentum' | 'grid' | 'mean_reversion' | 'custom_ai';
  leverage: number; // For perps (1x to 20x)
  status: AgentStatus;
  createdAt: number;
  lastTradeAt?: number;
}

export interface PaperStrategy {
  id: string;
  agentId: string;
  name: string;
  description: string;
  authorId: string;
  roomId?: string; // Room context
  assetSymbol: string;
  tradeType: 'token' | 'perp';
  status: 'active' | 'paused';
  copiedCount: number;
  originalStrategyId?: string; // If copied from another
  createdAt: number;
}

export interface PaperTrade {
  id: string;
  agentId: string;
  userId: string;
  roomId?: string;
  assetSymbol: string;
  tradeType: 'token' | 'perp';
  side: 'buy' | 'sell' | 'long' | 'short';
  size: number; // Amount of asset
  price: number; // Executed paper price
  leverage: number;
  pnl?: number; // Realized PnL for closed trades, or current unrealized
  status?: 'open' | 'closed';
  source?: 'agent' | 'wallet'; // 'wallet' = a MetaMask paper action; marked-to-market live in the arena
  timestamp: number;
}

export interface VaultClub {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: number;
  simulatedTotalContribution: number;
  memberContributions: { [userId: string]: number }; // Map of userId -> simulated funds contribution
  milestones: string[];
}

export interface GraphNode {
  id: string;
  label: string; // 'User' | 'Room' | 'Agent' | 'Strategy' | 'VaultClub'
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string; // 'MEMBER_OF' | 'OWNS' | 'COPIED_FROM' | 'SHARED_IN' | 'CONTRIBUTED_TO'
  properties: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  userId: string;
  username: string;
  action: string; // e.g., 'LOGIN', 'CREATE_ROOM', 'PAPER_TRADE', 'PAUSE_AGENT', 'SWITCH_MODE'
  details: string;
  timestamp: number;
}

export interface GraphEvent {
  id: string;
  type: 'login' | 'profile_update' | 'room_join' | 'agent_creation' | 'paper_action' | 'strategy_share' | 'strategy_copy' | 'vault_action' | 'evaluation' | 'blocked_action' | 'metamask_check' | 'mode_switch' | 'pause_revoke';
  userId: string;
  targetId: string;
  targetType: 'User' | 'Room' | 'Agent' | 'Strategy' | 'VaultClub';
  metadata: Record<string, any>;
  timestamp: number;
}

export interface PredictionMarket {
  id: string;
  question: string;
  category: 'Crypto' | 'Macro' | 'Tech' | 'AI Performance';
  yesPool: number;
  noPool: number;
  resolved: boolean;
  outcome: 'yes' | 'no' | null;
  endTime: number;
  volume: number;
  bets: {
    [userId: string]: {
      yesShares: number;
      noShares: number;
      invested: number;
    }
  };
}

// A competition league in the Agent Arena. The leaderboard is COMPUTED from real
// agent P&L (never stored/faked), so it stays truthful and consistent across users.
export interface ArenaLeague {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  startBalance: number;
  durationDays: number;
  createdAt: number;
  endsAt: number;
  risk: 'Low' | 'Medium' | 'High';
  prize: string;
  status: 'active' | 'ended';
}

export interface ArenaMember {
  id: string;
  leagueId: string;
  userId: string;
  username: string;
  joinedAt: number;
  startBalance: number;
}

// An earned achievement. Badges are derived from real activity (trades, wins,
// streaks, leagues created) and awarded idempotently — never decorative.
export interface ArenaBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: number;
}

// Periodic rank snapshot per board (global or league) powering ▲/▼ movement.
export interface ArenaRankSnapshot {
  at: number;
  ranks: { [userId: string]: number };
  prevAt?: number;
  prevRanks?: { [userId: string]: number };
}

export interface DatabaseState {
  users: { [id: string]: User };
  sessions?: { [tokenHash: string]: SessionRecord };
  rooms: { [id: string]: FriendRoom };
  agents: { [id: string]: TradingAgent };
  strategies: { [id: string]: PaperStrategy };
  trades: PaperTrade[];
  vaultClubs: { [id: string]: VaultClub };
  auditEvents: AuditEvent[];
  graphEvents: GraphEvent[];
  predictionMarkets?: { [id: string]: PredictionMarket };
  arenaLeagues?: { [id: string]: ArenaLeague };
  arenaMembers?: ArenaMember[];
  arenaBadges?: ArenaBadge[];
  arenaRankSnapshots?: { [boardId: string]: ArenaRankSnapshot };
}
