/**
 * MetaEdge V1 Schema and Types Definition
 */

import type { FrozenStrategySpec, LayeredDecision, ValidationRecord } from '../server/decision/types';

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
  // The wallet all live actions are pinned to. server/metamask.ts reads and writes
  // this in three places via `(user as any).canonicalWallet` because the field was
  // never declared — so the canonical-wallet guard, a live-money safety check, was
  // entirely untyped.
  canonicalWallet?: string;
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
  // Strategy labels map to deterministic plugins in server/decision/plugins.ts.
  // A label alone never authorizes execution; the frozen plugin hash must pass
  // validation and every layered runtime gate.
  strategyType: 'momentum' | 'grid' | 'mean_reversion' | 'custom_ai' | 'rsi_meanrev' | 'golden_cross';
  leverage: number; // For perps (1x to 20x)
  status: AgentStatus;
  createdAt: number;
  lastTradeAt?: number;
  // Autopilot: when true (and status active), the server-side autotrader makes
  // this agent trade by itself on live prices via its strategy. Opt-in.
  autopilot?: boolean;
  lastAutoTradeAt?: number;
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

// EdgeOps trade thesis: makes a trade explainable BEFORE it happens, so the
// weekly report can separate signal failure from execution failure. A trade
// only counts as edgeops_complete when the core fields (signalFamily, setup,
// trigger, invalidation) are present — no invalidation, no confidence.
export interface TradeThesis {
  cardId?: string;          // research card this trade tests (e.g. 'momentum-24h-v1')
  decisionId?: string;      // layered decision that authorized this paper candidate
  strategyHash?: string;    // immutable strategy specification used for the decision
  signalFamily: string;     // momentum | mean_reversion | grid | custom_ai | manual | ...
  setup: string;            // the condition that existed
  trigger: string;          // what fired now
  invalidation: string;     // what proves the thesis wrong
  plannedR?: number;        // planned risk unit
  holdingWindow?: string;   // e.g. 'until opposite signal', '1h', '1d'
  regime?: string;          // trending | choppy | unknown
  benchmark?: string;       // benchmark family for the report
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
  thesis?: TradeThesis;                      // EdgeOps: why this trade
  edgeops?: 'complete' | 'thesis_missing';   // EdgeOps: counts toward reports only when complete
  review?: TradeReview;                      // EdgeOps Loop 5: post-trade review (closed trades)
}

// EdgeOps post-trade review — separates signal failure from execution failure,
// regime shift, or plan violation. Only closed trades can be reviewed.
export interface TradeReview {
  thesisFollowed: boolean;
  invalidationHit: boolean;
  outcomeDriver: 'signal' | 'execution' | 'regime' | 'liquidity' | 'behavior';
  lesson: string;
  nextDecision: 'keep_testing' | 'modify' | 'kill' | 'promote_paper_only';
  reviewedAt: number;
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
      firstBetAt?: number; // for fair season/league flooring in the arena
    }
  };
}

// Append-only stake ledger used by seasons and leagues. The aggregate stored on
// PredictionMarket remains the market view; these events are the competition
// authority for deciding which stake belongs inside a player's scoring window.
export interface PredictionBetEvent {
  id: string;
  marketId: string;
  userId: string;
  side: 'yes' | 'no';
  amount: number;
  shares: number;
  timestamp: number;
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
  predictionBetEvents?: PredictionBetEvent[];
  arenaLeagues?: { [id: string]: ArenaLeague };
  arenaMembers?: ArenaMember[];
  arenaBadges?: ArenaBadge[];
  arenaRankSnapshots?: { [boardId: string]: ArenaRankSnapshot };
  // Persisted trailing-stop high-water marks, keyed by `${agentId}:${symbol}`. Survives
  // process restarts so the Risk-OS's trailing peak is never reset to the current price.
  trailingState?: { [key: string]: { highWaterMark: number; trailPct: number; updatedAt: number } };
  // Per-symbol cooldown after an exit, keyed `${agentId}:${symbol}` → epoch ms until which the
  // scanner must not re-enter that symbol (prevents churning back into a fresh loser).
  cooldowns?: { [key: string]: number };
  decisionRuntime?: {
    strategySpecs: { [hash: string]: FrozenStrategySpec };
    validations: { [id: string]: ValidationRecord };
    decisions: LayeredDecision[];
    executedDecisionIds: { [decisionId: string]: string };
    lastCycle?: {
      cycleId: string;
      startedAt: number;
      completedAt: number;
      evaluated: number;
      declines: number;
      hypotheses: number;
      paperCandidates: number;
      routed: number;
      error?: string;
    };
  };
}
