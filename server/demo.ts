import type { AuditEvent, DatabaseState, GraphEvent, PaperTrade, TradingAgent, User } from '../src/types';

const DAY = 24 * 60 * 60 * 1000;

export function defaultPredictionMarkets(now = Date.now()): DatabaseState['predictionMarkets'] {
  return {
    pred_btc_120k: {
      id: 'pred_btc_120k',
      question: 'Will BTC reach $120,000 before December 31, 2026?',
      category: 'Crypto',
      yesPool: 50000,
      noPool: 35000,
      resolved: false,
      outcome: null,
      endTime: now + 180 * DAY,
      volume: 85000,
      bets: {},
    },
    pred_agent_beat: {
      id: 'pred_agent_beat',
      question: 'Will the Custom AI Agent outperform the Momentum Strategy over the next week?',
      category: 'AI Performance',
      yesPool: 24000,
      noPool: 28000,
      resolved: false,
      outcome: null,
      endTime: now + 7 * DAY,
      volume: 52000,
      bets: {},
    },
    pred_gas_12gwei: {
      id: 'pred_gas_12gwei',
      question: 'Will Ethereum gas fee average stay below 12 Gwei during July 2026?',
      category: 'Macro',
      yesPool: 15000,
      noPool: 45000,
      resolved: false,
      outcome: null,
      endTime: now + 30 * DAY,
      volume: 60000,
      bets: {},
    },
  };
}

function demoUser(id: string, username: string, displayName: string, bio: string, balance: number, createdAt: number): User {
  return {
    id,
    username,
    profile: {
      displayName,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
      bio,
      updatedAt: createdAt,
    },
    createdAt,
    lastActiveAt: createdAt,
    paperBalance: balance,
    faucetClaimedCount: 4,
  };
}

function demoAgent(
  id: string,
  ownerId: string,
  roomId: string,
  name: string,
  description: string,
  assetSymbol: string,
  tradeType: 'token' | 'perp',
  strategyType: TradingAgent['strategyType'],
  leverage: number,
  createdAt: number,
): TradingAgent {
  return {
    id,
    name,
    description,
    ownerId,
    roomId,
    assetSymbol,
    tradeType,
    strategyType,
    leverage,
    status: 'active',
    createdAt,
    lastTradeAt: createdAt + 2 * 60 * 60 * 1000,
  };
}

function demoAudit(id: string, user: User, action: string, details: string, timestamp: number): AuditEvent {
  return {
    id,
    userId: user.id,
    username: user.username,
    action,
    details,
    timestamp,
  };
}

function demoGraph(id: string, type: GraphEvent['type'], userId: string, targetId: string, targetType: GraphEvent['targetType'], timestamp: number, metadata: Record<string, unknown> = {}): GraphEvent {
  return {
    id,
    type,
    userId,
    targetId,
    targetType,
    metadata,
    timestamp,
  };
}

export function createDemoState(now = Date.now()): DatabaseState {
  const base = now - 2 * DAY;
  const owner = demoUser('usr_demo_owner', 'metaedge_agent_2', 'MetaEdge Agent 2', 'Self-custodial agent room member.', 159208.12, base);
  const scout = demoUser('usr_demo_signal', 'signal_scout', 'Signal Scout', 'Tracks mispriced narratives before the room reacts.', 132450, base + 30 * 60 * 1000);
  const risk = demoUser('usr_demo_risk', 'risk_sentinel', 'Risk Sentinel', 'Keeps the room honest when leverage gets loud.', 117980, base + 60 * 60 * 1000);

  const agents = {
    agt_money_maker: demoAgent('agt_money_maker', owner.id, 'rm_t1', 'money maker', 'Perp momentum bot watching BTC breakout pressure.', 'BTC', 'perp', 'momentum', 10, base + 2 * 60 * 60 * 1000),
    agt_test: demoAgent('agt_test', scout.id, 'rm_t1', 'test', 'Spot rotation bot comparing ETH and SOL strength.', 'ETH', 'token', 'mean_reversion', 1, base + 3 * 60 * 60 * 1000),
    agt_btc_bot: demoAgent('agt_btc_bot', owner.id, 'rm_power', 'BTC bot', 'Grid and momentum hybrid for paper-only BTC fills.', 'BTC', 'token', 'grid', 1, base + 5 * 60 * 60 * 1000),
  };

  const trades: PaperTrade[] = [
    {
      id: 'trd_demo_1',
      agentId: 'agt_money_maker',
      userId: owner.id,
      roomId: 'rm_t1',
      assetSymbol: 'BTC',
      tradeType: 'perp',
      side: 'long',
      size: 0.08,
      price: 59620.42,
      leverage: 10,
      pnl: 6200.4,
      timestamp: base + 6 * 60 * 60 * 1000,
    },
    {
      id: 'trd_demo_2',
      agentId: 'agt_btc_bot',
      userId: owner.id,
      roomId: 'rm_power',
      assetSymbol: 'BTC',
      tradeType: 'token',
      side: 'buy',
      size: 0.12,
      price: 60240.18,
      leverage: 1,
      pnl: 1307.72,
      timestamp: base + 18 * 60 * 60 * 1000,
    },
    {
      id: 'trd_demo_3',
      agentId: 'agt_test',
      userId: scout.id,
      roomId: 'rm_t1',
      assetSymbol: 'ETH',
      tradeType: 'token',
      side: 'buy',
      size: 1.8,
      price: 3122.4,
      leverage: 1,
      pnl: 842.5,
      timestamp: base + 21 * 60 * 60 * 1000,
    },
  ];

  const audits = [
    demoAudit('aud_demo_login', owner, 'LOGIN', 'Created anonymous user session.', base),
    demoAudit('aud_demo_room', owner, 'CREATE_ROOM', 'Created room t1', base + 20 * 60 * 1000),
    demoAudit('aud_demo_agent', owner, 'CREATE_AGENT', 'Created agent money maker executing momentum on BTC', base + 2 * 60 * 60 * 1000),
    demoAudit('aud_demo_trade_1', owner, 'PAPER_TRADE', 'Executed simulated long of 0.08 BTC at $59620.42', trades[0].timestamp),
    demoAudit('aud_demo_trade_2', owner, 'PAPER_TRADE', 'Executed simulated buy of 0.12 BTC at $60240.18', trades[1].timestamp),
    demoAudit('aud_demo_vault', risk, 'CREATE_VAULT', 'Created vault club Test', base + 26 * 60 * 60 * 1000),
  ];

  return {
    users: {
      [owner.id]: owner,
      [scout.id]: scout,
      [risk.id]: risk,
    },
    rooms: {
      rm_t1: {
        id: 'rm_t1',
        name: 't1',
        description: 'lounge',
        ownerId: owner.id,
        inviteToken: 'inv_t1_demo_lounge',
        isInviteDisabled: false,
        memberIds: [owner.id, scout.id, risk.id],
        createdAt: base + 20 * 60 * 1000,
      },
      rm_power: {
        id: 'rm_power',
        name: 'The Power',
        description: 'High-conviction paper trading lab.',
        ownerId: owner.id,
        inviteToken: 'inv_power_demo_room',
        isInviteDisabled: false,
        memberIds: [owner.id, risk.id],
        createdAt: base + 4 * 60 * 60 * 1000,
      },
    },
    agents,
    strategies: {
      str_money_maker: {
        id: 'str_money_maker',
        agentId: 'agt_money_maker',
        name: 'money maker',
        description: 'Room-shared BTC momentum strategy for paper-only perp practice.',
        authorId: owner.id,
        roomId: 'rm_t1',
        assetSymbol: 'BTC',
        tradeType: 'perp',
        status: 'active',
        copiedCount: 3,
        createdAt: base + 2 * 60 * 60 * 1000,
      },
      str_btc_bot: {
        id: 'str_btc_bot',
        agentId: 'agt_btc_bot',
        name: 'BTC bot',
        description: 'Spot BTC accumulation with room evidence and paper fills.',
        authorId: owner.id,
        roomId: 'rm_power',
        assetSymbol: 'BTC',
        tradeType: 'token',
        status: 'active',
        copiedCount: 1,
        createdAt: base + 5 * 60 * 60 * 1000,
      },
    },
    trades,
    vaultClubs: {
      vlt_test: {
        id: 'vlt_test',
        name: 'Test',
        description: 'Paper-only savings club for simulated contributions and room discipline.',
        ownerId: risk.id,
        createdAt: base + 26 * 60 * 60 * 1000,
        simulatedTotalContribution: 5240,
        memberContributions: {
          [owner.id]: 3200,
          [scout.id]: 1240,
          [risk.id]: 800,
        },
        milestones: ['Club Launch', '$5k Simulated Threshold'],
      },
    },
    auditEvents: audits,
    graphEvents: [
      demoGraph('gph_demo_login', 'login', owner.id, owner.id, 'User', base),
      demoGraph('gph_demo_room_owner', 'room_join', owner.id, 'rm_t1', 'Room', base + 20 * 60 * 1000, { isOwner: true }),
      demoGraph('gph_demo_room_scout', 'room_join', scout.id, 'rm_t1', 'Room', base + 45 * 60 * 1000, { isOwner: false }),
      demoGraph('gph_demo_agent', 'agent_creation', owner.id, 'agt_money_maker', 'Agent', base + 2 * 60 * 60 * 1000, { strategy: 'momentum' }),
      demoGraph('gph_demo_trade', 'paper_action', owner.id, 'trd_demo_1', 'Agent', trades[0].timestamp, { side: 'long', assetSymbol: 'BTC' }),
      demoGraph('gph_demo_strategy', 'strategy_share', owner.id, 'str_money_maker', 'Strategy', base + 8 * 60 * 60 * 1000, { roomId: 'rm_t1' }),
      demoGraph('gph_demo_vault', 'vault_action', risk.id, 'vlt_test', 'VaultClub', base + 26 * 60 * 60 * 1000, { action: 'launch' }),
    ],
    predictionMarkets: defaultPredictionMarkets(now),
  };
}

export function hydrateNewUserDemoState(db: DatabaseState, user: User, now = Date.now()) {
  if (process.env.METAEDGE_DEMO_AUTOSTART === 'false') return;

  if (!db.rooms.rm_t1) {
    const seeded = createDemoState(now);
    db.rooms = { ...seeded.rooms, ...db.rooms };
    db.agents = { ...seeded.agents, ...db.agents };
    db.strategies = { ...seeded.strategies, ...db.strategies };
    db.vaultClubs = { ...seeded.vaultClubs, ...db.vaultClubs };
    db.auditEvents.push(...seeded.auditEvents);
    db.graphEvents.push(...seeded.graphEvents);
  }

  const room = db.rooms.rm_t1;
  if (room && !room.memberIds.includes(user.id)) {
    room.memberIds.push(user.id);
    db.auditEvents.push(demoAudit(`aud_${user.id}_join_t1`, user, 'JOIN_ROOM', 'Joined room t1 via seeded preview.', now + 1));
    db.graphEvents.push(demoGraph(`gph_${user.id}_join_t1`, 'room_join', user.id, room.id, 'Room', now + 1, { seededPreview: true }));
  }

  const agentId = `agt_${user.id}_starter`;
  if (!db.agents[agentId]) {
    db.agents[agentId] = demoAgent(
      agentId,
      user.id,
      'rm_t1',
      'BTC bot',
      'Starter paper bot for the current preview session.',
      'BTC',
      'perp',
      'momentum',
      10,
      now + 2,
    );
    db.strategies[`str_${user.id}_starter`] = {
      id: `str_${user.id}_starter`,
      agentId,
      name: 'BTC bot',
      description: 'Current-session paper strategy seeded so the room is not empty.',
      authorId: user.id,
      roomId: 'rm_t1',
      assetSymbol: 'BTC',
      tradeType: 'perp',
      status: 'active',
      copiedCount: 0,
      createdAt: now + 2,
    };
    const trade: PaperTrade = {
      id: `trd_${user.id}_starter`,
      agentId,
      userId: user.id,
      roomId: 'rm_t1',
      assetSymbol: 'BTC',
      tradeType: 'perp',
      side: 'long',
      size: 0.05,
      price: 60163.71,
      leverage: 10,
      pnl: 9208.12,
      timestamp: now + 3,
    };
    db.trades.push(trade);
    user.paperBalance = 159208.12;
    user.faucetClaimedCount = Math.max(user.faucetClaimedCount, 4);
    db.auditEvents.push(
      demoAudit(`aud_${user.id}_agent`, user, 'CREATE_AGENT', 'Created agent BTC bot executing momentum on BTC', now + 2),
      demoAudit(`aud_${user.id}_trade`, user, 'PAPER_TRADE', 'Executed simulated long of 0.05 BTC at $60163.71', now + 3),
    );
    db.graphEvents.push(
      demoGraph(`gph_${user.id}_agent`, 'agent_creation', user.id, agentId, 'Agent', now + 2, { strategy: 'momentum' }),
      demoGraph(`gph_${user.id}_trade`, 'paper_action', user.id, trade.id, 'Agent', now + 3, { side: 'long', assetSymbol: 'BTC' }),
    );
  }
}
