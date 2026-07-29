import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { readDatabase } from './storage.js';
import { decisionRuntimeSnapshot } from './decision/store.js';

export const researchRouter = Router();

researchRouter.get('/api/decision-runtime', (req: any, res) => {
  res.json(decisionRuntimeSnapshot(req.userId));
});

function researchTradeFamily(trade: any, agents: Record<string, any>): string | null {
  const explicit = trade.thesis?.signalFamily;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();

  // The Golden Cross book predates signalFamily tagging. Derive its provenance
  // from the canonical system agent so its existing fills appear beside the
  // other research trades without rewriting the immutable paper ledger.
  if (trade.agentId === 'gc_book' || agents[trade.agentId]?.strategyType === 'golden_cross') {
    return 'golden_cross';
  }
  return null;
}

export function buildResearchFleetTradeView(db: ReturnType<typeof readDatabase>) {
  const tagged = db.trades
    .map((trade: any) => ({ trade, family: researchTradeFamily(trade, db.agents) }))
    .filter((entry): entry is { trade: any; family: string } => Boolean(entry.family));

  const fams: Record<string, any> = {};
  for (const { trade, family } of tagged) {
    const f = (fams[family] ||= {
      family, cardId: trade.thesis?.cardId || null,
      trades: 0, closed: 0, wins: 0, realizedPnl: 0, lastTradeAt: 0, lastTrigger: ''
    });
    f.trades++;
    if (typeof trade.pnl === 'number') {
      f.closed++;
      f.realizedPnl += trade.pnl;
      if (trade.pnl > 0) f.wins++;
    }
    if (trade.timestamp > f.lastTradeAt) {
      f.lastTradeAt = trade.timestamp;
      f.lastTrigger = trade.thesis?.trigger || '';
      f.cardId = trade.thesis?.cardId || f.cardId;
    }
  }

  const recent = [...tagged]
    .sort((a, b) => b.trade.timestamp - a.trade.timestamp)
    .slice(0, 20)
    .map(({ trade, family }) => {
      const variant = family === 'golden_cross' && ['strict', 'participate'].includes(trade.thesis?.regime)
        ? trade.thesis.regime
        : null;
      return {
        id: trade.id,
        t: trade.timestamp,
        family,
        variant,
        side: trade.side,
        size: trade.size,
        symbol: trade.assetSymbol,
        price: trade.price,
        pnl: typeof trade.pnl === 'number' ? trade.pnl : null,
        trigger: trade.thesis?.trigger || '',
        setup: trade.thesis?.setup || ''
      };
    });

  return {
    families: Object.values(fams).sort((a: any, b: any) => b.trades - a.trades),
    recent,
    totals: {
      trades: tagged.length,
      closed: tagged.filter(({ trade }) => typeof trade.pnl === 'number').length,
      realizedPnl: Number(tagged.reduce((sum, { trade }) =>
        sum + (typeof trade.pnl === 'number' ? trade.pnl : 0), 0).toFixed(2))
    }
  };
}

// Read-only window into the edge factory: every thesis-tagged trade grouped by
// signal family, plus the declined-opportunity counters. Transparency is the
// product here — the fleet's wins, losses, and restraint are all shown as-is.
researchRouter.get('/api/research-fleet', (_req, res) => {
  const db = readDatabase();
  const tradeView = buildResearchFleetTradeView(db);

  // Declined counters (last 7 days) — restraint is evidence too.
  const declined: Record<string, number> = {};
  try {
    const daily = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'edgeops', 'declined-daily.json'), 'utf8'));
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    for (const [k, n] of Object.entries(daily)) {
      const [date, , family, reason] = k.split('|');
      if (date >= cutoff) declined[`${family}|${reason}`] = (declined[`${family}|${reason}`] || 0) + (n as number);
    }
  } catch { /* no counters yet */ }

  res.json({
    declined,
    ...tradeView
  });
});
