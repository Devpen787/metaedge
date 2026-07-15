import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { readDatabase } from './storage.js';
import { decisionRuntimeSnapshot } from './decision/store.js';

export const researchRouter = Router();

researchRouter.get('/api/decision-runtime', (req: any, res) => {
  res.json(decisionRuntimeSnapshot(req.userId));
});

// Read-only window into the edge factory: every thesis-tagged trade grouped by
// signal family, plus the declined-opportunity counters. Transparency is the
// product here — the fleet's wins, losses, and restraint are all shown as-is.
researchRouter.get('/api/research-fleet', (_req, res) => {
  const db = readDatabase();
  const tagged = db.trades.filter((t: any) => t.thesis?.signalFamily);

  const fams: Record<string, any> = {};
  for (const t of tagged) {
    const f = (fams[t.thesis.signalFamily] ||= {
      family: t.thesis.signalFamily, cardId: t.thesis.cardId || null,
      trades: 0, closed: 0, wins: 0, realizedPnl: 0, lastTradeAt: 0, lastTrigger: ''
    });
    f.trades++;
    if (typeof t.pnl === 'number') { f.closed++; f.realizedPnl += t.pnl; if (t.pnl > 0) f.wins++; }
    if (t.timestamp > f.lastTradeAt) { f.lastTradeAt = t.timestamp; f.lastTrigger = t.thesis.trigger || ''; f.cardId = t.thesis.cardId || f.cardId; }
  }

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

  const recent = tagged.slice(-20).reverse().map((t: any) => ({
    // Every trade carries an id; projecting it away forced the client to key
    // this newest-first list by array index.
    id: t.id,
    t: t.timestamp, family: t.thesis.signalFamily, side: t.side, size: t.size,
    symbol: t.assetSymbol, price: t.price, pnl: typeof t.pnl === 'number' ? t.pnl : null,
    trigger: t.thesis.trigger || '', setup: t.thesis.setup || ''
  }));

  res.json({
    families: Object.values(fams).sort((a: any, b: any) => b.trades - a.trades),
    declined,
    recent,
    totals: {
      trades: tagged.length,
      closed: tagged.filter((t: any) => typeof t.pnl === 'number').length,
      realizedPnl: Number(tagged.reduce((s: number, t: any) => s + (typeof t.pnl === 'number' ? t.pnl : 0), 0).toFixed(2))
    }
  });
});
