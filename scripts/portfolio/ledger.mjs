// PAPER PORTFOLIO LEDGER (Layer 5, accounting core) — the single source of P&L
// truth. Positions are tagged by (engine, instrument) so per-engine attribution is
// FIRST-CLASS from the first run. One shared cash pool. Every rebalance:
//   1. applies a NO-TRADE BAND (skip adjustments too small to be worth the cost),
//   2. charges realistic taker fee + slippage on the executed notional,
//   3. fills at the provided mark price (NO idealized stop/target prices — those
//      never leak in; the engines say WHAT to hold, the ledger says what it COST).
//
// Long or short (qty may be negative). v1 crypto engines are long-only, but the
// accounting is sign-general so shorting engines drop in later without a rewrite.
//
// Attribution invariant, asserted every mark: sum of per-engine P&L == equity
// minus start capital. If that ever breaks, the ledger is lying and must stop.

const key = (engine, instrument) => `${engine}|${instrument}`;

export function createLedger({ startCash = 100000, takerBps = 10, slipBps = 5, noTradeBand = 0.15 } = {}) {
  return {
    startCash, cash: startCash,
    costBps: (takerBps + slipBps) / 1e4,   // charged on |traded notional|
    noTradeBand,                            // fraction: skip if |Δnotional| < band*max(|target|,|current|)
    pos: new Map(),                         // key -> { engine, instrument, qty, avgPx }
    eng: new Map(),                         // engine -> { realized, costPaid, tradedNotional }
    curve: [],                              // [{ t, equity, gross, net, cash, byEngine }]

    engineOf(e) { if (!this.eng.has(e)) this.eng.set(e, { realized: 0, costPaid: 0, tradedNotional: 0 }); return this.eng.get(e); },

    // targets: [{ engine, instrument, targetNotional }] — desired SIGNED dollar
    //   exposure per (engine, instrument). Any existing (engine, instrument) NOT
    //   present is treated as target 0 (close it). prices: { instrument: px }.
    rebalance(t, targets, prices) {
      const want = new Map(targets.map((x) => [key(x.engine, x.instrument), x]));
      // include existing positions so vanished targets get closed to 0
      const keys = new Set([...want.keys(), ...this.pos.keys()]);
      for (const k of keys) {
        const cur = this.pos.get(k) || null;
        const spec = want.get(k);
        const engine = spec ? spec.engine : cur.engine;
        const instrument = spec ? spec.instrument : cur.instrument;
        const px = prices[instrument];
        if (!(px > 0)) continue;                                   // no price → cannot trade honestly
        const curQty = cur ? cur.qty : 0;
        const curNotional = curQty * px;
        const targetNotional = spec ? spec.targetNotional : 0;
        const delta = targetNotional - curNotional;
        const band = this.noTradeBand * Math.max(Math.abs(targetNotional), Math.abs(curNotional), 1);
        if (Math.abs(delta) < band) continue;                      // NO-TRADE BAND: not worth the cost
        const tradeQty = delta / px;
        const e = this.engineOf(engine);
        const cost = Math.abs(delta) * this.costBps;               // fee + slippage on executed notional
        this.cash -= cost; e.costPaid += cost; e.realized -= cost; e.tradedNotional += Math.abs(delta);
        // realized P&L on any portion that reduces/closes an existing position
        if (cur && curQty !== 0 && Math.sign(tradeQty) !== Math.sign(curQty)) {
          const closedQty = Math.min(Math.abs(tradeQty), Math.abs(curQty));
          e.realized += (px - cur.avgPx) * closedQty * Math.sign(curQty);
        }
        this.cash -= delta;                                        // buy (delta>0) spends cash; sell returns it
        // update position + average price
        const newQty = curQty + tradeQty;
        let avgPx = cur ? cur.avgPx : px;
        if (Math.sign(newQty) !== Math.sign(curQty) && curQty !== 0) avgPx = px;       // flipped: reset basis
        else if (Math.abs(newQty) > Math.abs(curQty)) avgPx = ((cur ? cur.avgPx : px) * Math.abs(curQty) + px * Math.abs(tradeQty)) / Math.abs(newQty); // added: weighted
        // reduced (not flipped): avgPx unchanged
        if (Math.abs(newQty) < 1e-12) this.pos.delete(k);
        else this.pos.set(k, { engine, instrument, qty: newQty, avgPx });
      }
    },

    // Mark to market at prices; record the equity point + per-engine breakdown.
    mark(t, prices) {
      let posValue = 0, gross = 0;
      const unrealByEngine = new Map();
      for (const { engine, instrument, qty, avgPx } of this.pos.values()) {
        const px = prices[instrument]; if (!(px > 0)) continue;
        const val = qty * px; posValue += val; gross += Math.abs(val);
        unrealByEngine.set(engine, (unrealByEngine.get(engine) || 0) + qty * (px - avgPx));
      }
      const equity = this.cash + posValue;
      const byEngine = {};
      let sumEnginePnl = 0;
      for (const [name, e] of this.eng) {
        const pnl = e.realized + (unrealByEngine.get(name) || 0);
        byEngine[name] = { pnl, realized: e.realized, unrealized: unrealByEngine.get(name) || 0, costPaid: e.costPaid, tradedNotional: e.tradedNotional };
        sumEnginePnl += pnl;
      }
      // ATTRIBUTION INVARIANT — the ledger refuses to lie about who made the money
      const drift = Math.abs(sumEnginePnl - (equity - this.startCash));
      if (drift > 1e-6 * Math.max(1, equity)) throw new Error(`ledger attribution drift ${drift.toFixed(6)} — accounting is inconsistent`);
      const point = { t, equity, gross, net: posValue, cash: this.cash, byEngine };
      this.curve.push(point);
      return point;
    },
  };
}
