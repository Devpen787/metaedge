// CRYPTO STRATEGY ENGINES (Layer 1) — adapters that turn the strategy_core
// families into portfolio ENGINES.
//
// ENGINE INTERFACE (functional, minimal):
//   { id, family, params, targets(barsByInstrument) -> { instrument: number[] } }
//   - targets() returns, per instrument, a LONG exposure path in [0,1], ONE value
//     per bar. v1 engines are long/flat. The value is the mean of the ensemble's
//     0/1 position paths, so a fractional target (e.g. 0.5 = half the ensemble is
//     in) is a natural confidence-weighted exposure — the Construct/Risk layers
//     turn it into dollars.
//   - Causal by construction (positionPath uses only bars <= k-1).
//
// CONSTRAINT (ironclad): these run on ROBUST, SIMPLE, NON-OPTIMIZED defaults —
// small ensembles of round parameterizations, deliberately DIFFERENT from the
// swept survivors that failed robustness (e.g. rsi_meanrev here is 25/30, never
// the swept 35/0.03). Averaging over an ensemble is itself an anti-overfit device:
// no single lucky parameter drives an engine.
import { computeFeatures, positionPath } from '../lib/strategy_core.mjs';

// Robust ensembles. Round numbers spanning a sensible range; none tuned to results.
export const ENSEMBLES = {
  rsi_meanrev:      [{ rsiBuy: 25, stop: 0.05, maxHold: 48 }, { rsiBuy: 30, stop: 0.05, maxHold: 72 }],
  meanrev_stab:     [{ dropPct: 0.10, maxHold: 72 }, { dropPct: 0.15, maxHold: 72 }],
  vol_squeeze:      [{ rankMax: 0.20, breakN: 24, maxHold: 72 }, { rankMax: 0.20, breakN: 72, maxHold: 72 }],
  momentum_breakout:[{ lookback: 24, minVolR: 1.5, stop: 0.05, maxHold: 48 }, { lookback: 72, minVolR: 2.0, stop: 0.05, maxHold: 48 }],
  trend_atr:        [{ smaN: 72, atrMult: 3, maxHold: 500 }, { smaN: 168, atrMult: 4, maxHold: 500 }],
  volume_surge:     [{ minVolR: 2.0, stop: 0.05, maxHold: 48 }, { minVolR: 3.0, stop: 0.05, maxHold: 24 }],
};

// Build one engine from a family + its ensemble.
export function makeCryptoEngine(family, params = ENSEMBLES[family]) {
  if (!params) throw new Error(`no ensemble for family ${family}`);
  return {
    id: `crypto_${family}`,
    family,
    params,
    // barsByInstrument: { SYM: bars[] }  ->  { SYM: number[] } exposure in [0,1] per bar
    targets(barsByInstrument) {
      const out = {};
      for (const [sym, bars] of Object.entries(barsByInstrument)) {
        if (!Array.isArray(bars) || bars.length < 210) { out[sym] = new Array(bars?.length || 0).fill(0); continue; }
        const F = computeFeatures(bars);
        // cost=0 here: the ENGINE only decides WHAT to hold; the ledger owns fills
        // and costs. Baking a cost into the position path would double-count it.
        const paths = params.map((p) => positionPath(family, p, bars, F, 200, bars.length, 0));
        out[sym] = bars.map((_, i) => paths.reduce((s, path) => s + path[i], 0) / paths.length);
      }
      return out;
    },
  };
}

// The default engine set for v1: all six families, each on its robust ensemble.
export function allCryptoEngines() {
  return Object.keys(ENSEMBLES).map((f) => makeCryptoEngine(f));
}
