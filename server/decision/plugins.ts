import { FEATURE_VERSIONS } from './features.js';
import type { DecisionContext, StrategyPlugin } from './types.js';

interface RsiMeanReversionParams extends Record<string, unknown> {
  rsiEntry: number;
  rsiExit: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldHours: number;
}

export const rsiMeanReversionV1: StrategyPlugin<RsiMeanReversionParams> = {
  id: 'rsi_mean_reversion',
  version: '1.0.0',
  mechanism: 'oversold mean reversion while the long trend remains positive',
  instrument: 'spot',
  requiredFeatures: [
    FEATURE_VERSIONS.price,
    FEATURE_VERSIONS.volume24h,
    FEATURE_VERSIONS.rsi14,
    FEATURE_VERSIONS.sma200,
  ],
  parameters: { rsiEntry: 35, rsiExit: 50, stopLossPct: 3, takeProfitPct: 6, maxHoldHours: 48 },
  benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'post-cost forward expectancy <= 0 or win rate < 55% after 30 closed paper trades',
  expectedFailureRegimes: ['persistent_downtrend', 'gap_through_stop', 'illiquid_tail'],
  regimeGate(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma200 = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    const eligible = Number.isFinite(price) && Number.isFinite(sma200) && price > sma200;
    return { eligible, reason: eligible ? 'UPTREND_REGIME' : 'REGIME_NOT_ELIGIBLE' };
  },
  generateSignal(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const rsi = Number(context.features[FEATURE_VERSIONS.rsi14]?.value);
    const { rsiEntry, rsiExit, stopLossPct, takeProfitPct, maxHoldHours } = this.parameters;
    if (!context.position.holding && rsi <= rsiEntry) {
      return {
        action: 'buy', strength: Math.min(1, Math.max(0, (rsiEntry - rsi) / rsiEntry)),
        setup: `RSI14=${rsi.toFixed(1)} in an uptrend`,
        trigger: `RSI14 <= ${rsiEntry}`,
        invalidation: `-${stopLossPct}% stop, +${takeProfitPct}% target, RSI >= ${rsiExit}, or ${maxHoldHours}h time stop`,
        regime: 'uptrend_oversold',
      };
    }
    if (context.position.holding) {
      const heldHours = context.position.heldSince ? (context.evaluatedAt - context.position.heldSince) / 3_600_000 : 0;
      const stop = context.position.averageEntryPrice > 0 && price <= context.position.averageEntryPrice * (1 - stopLossPct / 100);
      const target = context.position.averageEntryPrice > 0 && price >= context.position.averageEntryPrice * (1 + takeProfitPct / 100);
      if (rsi >= rsiExit || stop || target || heldHours >= maxHoldHours) {
        return {
          action: 'sell', strength: 1,
          setup: `open mean-reversion position at ${context.position.averageEntryPrice}`,
          trigger: stop ? 'stop loss' : target ? 'profit target' : rsi >= rsiExit ? `RSI14 >= ${rsiExit}` : `${maxHoldHours}h time stop`,
          invalidation: 'position closed by the precommitted exit rule',
          regime: 'position_exit',
        };
      }
    }
    return { action: 'hold', strength: 0, setup: 'conditions observed', trigger: 'entry/exit threshold not met', invalidation: 'none', regime: 'no_signal' };
  },
};

interface FundingCarryParams extends Record<string, unknown> {
  minimumFundingAprPct: number;
}

export const fundingCarryV1: StrategyPlugin<FundingCarryParams> = {
  id: 'funding_carry',
  version: '1.0.0',
  mechanism: 'receive positive perp funding with a delta-neutral hedge',
  instrument: 'perp',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.fundingApr, FEATURE_VERSIONS.openInterest],
  parameters: { minimumFundingAprPct: 20 },
  benchmark: 'always_on_delta_neutral_carry',
  falsifier: 'out-of-sample APR on deployed capital <= 5% after costs',
  expectedFailureRegimes: ['negative_funding_flip', 'basis_expansion', 'thin_spot_hedge'],
  regimeGate(context) {
    const fundingApr = Number(context.features[FEATURE_VERSIONS.fundingApr]?.value);
    const eligible = Number.isFinite(fundingApr) && fundingApr > 0;
    return { eligible, reason: eligible ? 'POSITIVE_FUNDING_REGIME' : 'REGIME_NOT_ELIGIBLE' };
  },
  generateSignal(context) {
    const fundingApr = Number(context.features[FEATURE_VERSIONS.fundingApr]?.value);
    if (fundingApr >= this.parameters.minimumFundingAprPct) {
      return {
        action: 'short', strength: Math.min(1, fundingApr / 100),
        setup: `positive funding APR ${fundingApr.toFixed(1)}% with spot hedge required`,
        trigger: `funding APR >= ${this.parameters.minimumFundingAprPct}%`,
        invalidation: 'funding flips negative, basis expands beyond cost envelope, or validation remains rejected',
        regime: 'positive_funding',
      };
    }
    return { action: 'hold', strength: 0, setup: 'funding observed', trigger: 'funding threshold not met', invalidation: 'none', regime: 'baseline_funding' };
  },
};

function directional24hPlugin(
  id: string,
  mechanism: string,
  entryWhen: (change24h: number) => boolean,
  exitWhen: (change24h: number) => boolean,
): StrategyPlugin {
  return {
    id,
    version: '1.0.0',
    mechanism,
    instrument: 'spot',
    requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.change24h, FEATURE_VERSIONS.volume24h],
    parameters: { thresholdPct: 0.75 },
    benchmark: 'buy_hold_same_symbol_same_window',
    falsifier: 'post-cost walk-forward expectancy <= 0 or the frozen benchmark is not beaten',
    expectedFailureRegimes: ['gap_risk', 'whipsaw', 'illiquid_tail'],
    regimeGate(context) {
      const change24h = Number(context.features[FEATURE_VERSIONS.change24h]?.value);
      const eligible = Number.isFinite(change24h);
      return { eligible, reason: eligible ? 'DIRECTIONAL_FEATURE_AVAILABLE' : 'REGIME_FEATURE_UNAVAILABLE' };
    },
    generateSignal(context) {
      const change24h = Number(context.features[FEATURE_VERSIONS.change24h]?.value);
      if (!context.position.holding && entryWhen(change24h)) {
        return { action: 'buy', strength: Math.min(1, Math.abs(change24h) / 5), setup: `24h change ${change24h.toFixed(2)}%`, trigger: `${id} entry threshold`, invalidation: 'opposite frozen exit threshold', regime: 'directional_24h' };
      }
      if (context.position.holding && exitWhen(change24h)) {
        return { action: 'sell', strength: Math.min(1, Math.abs(change24h) / 5), setup: `open ${id} position`, trigger: `${id} exit threshold`, invalidation: 'position closed by frozen rule', regime: 'directional_24h_exit' };
      }
      return { action: 'hold', strength: 0, setup: '24h change observed', trigger: 'threshold not met', invalidation: 'none', regime: 'no_signal' };
    },
  };
}

export const momentum24hV1 = directional24hPlugin(
  'momentum_24h',
  'follow a sufficiently large positive 24-hour move and exit on reversal',
  (change) => change >= 0.75,
  (change) => change <= -0.75,
);

export const meanReversion24hV1 = directional24hPlugin(
  'mean_reversion_24h',
  'fade a sufficiently large negative 24-hour move and exit on reversion',
  (change) => change <= -0.75,
  (change) => change >= 0.75,
);

export const gridDeviationV1: StrategyPlugin = {
  id: 'grid_deviation', version: '1.0.0', mechanism: 'trade a fixed band around the 200-hour mean', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.sma200],
  parameters: { bandPct: 1 }, benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'post-cost walk-forward expectancy <= 0 or turnover costs consume the band',
  expectedFailureRegimes: ['persistent_trend', 'gap_risk', 'high_fee_regime'],
  regimeGate(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    const eligible = price > 0 && sma > 0;
    return { eligible, reason: eligible ? 'GRID_ANCHOR_AVAILABLE' : 'GRID_ANCHOR_UNAVAILABLE' };
  },
  generateSignal(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    const band = Number(this.parameters.bandPct) / 100;
    if (!context.position.holding && price <= sma * (1 - band)) return { action: 'buy', strength: 1, setup: 'price below frozen lower band', trigger: `price <= SMA200 - ${this.parameters.bandPct}%`, invalidation: 'persistent trend beyond risk budget', regime: 'range_below_mean' };
    if (context.position.holding && price >= sma * (1 + band)) return { action: 'sell', strength: 1, setup: 'open grid inventory', trigger: `price >= SMA200 + ${this.parameters.bandPct}%`, invalidation: 'position closed by frozen upper band', regime: 'range_above_mean' };
    return { action: 'hold', strength: 0, setup: 'band observed', trigger: 'band not crossed', invalidation: 'none', regime: 'inside_grid' };
  },
};

export const deterministicCompositeV1: StrategyPlugin = {
  id: 'deterministic_composite', version: '1.0.0', mechanism: 'combine trend and oversold evidence with a deterministic score', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.rsi14, FEATURE_VERSIONS.sma200, FEATURE_VERSIONS.realizedVol],
  parameters: { entryScore: 2, exitRsi: 55, maximumVolPctPerHour: 4 }, benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'post-cost walk-forward expectancy <= 0 or feature ablation removes the edge',
  expectedFailureRegimes: ['volatility_shock', 'persistent_downtrend', 'correlated_feature_failure'],
  regimeGate(context) {
    const vol = Number(context.features[FEATURE_VERSIONS.realizedVol]?.value);
    const eligible = Number.isFinite(vol) && vol <= Number(this.parameters.maximumVolPctPerHour);
    return { eligible, reason: eligible ? 'COMPOSITE_VOL_REGIME' : 'COMPOSITE_VOL_REJECTED' };
  },
  generateSignal(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    const rsi = Number(context.features[FEATURE_VERSIONS.rsi14]?.value);
    const score = Number(price > sma) + Number(rsi <= 40);
    if (!context.position.holding && score >= Number(this.parameters.entryScore)) return { action: 'buy', strength: score / 2, setup: `deterministic score ${score}/2`, trigger: 'trend plus oversold score passed', invalidation: `RSI >= ${this.parameters.exitRsi} or trend failure`, regime: 'composite_entry' };
    if (context.position.holding && (rsi >= Number(this.parameters.exitRsi) || price < sma)) return { action: 'sell', strength: 1, setup: 'open composite position', trigger: 'frozen exit score', invalidation: 'position closed by frozen rule', regime: 'composite_exit' };
    return { action: 'hold', strength: 0, setup: `deterministic score ${score}/2`, trigger: 'score not met', invalidation: 'none', regime: 'composite_no_signal' };
  },
};

export const STRATEGY_PLUGINS: StrategyPlugin[] = [
  rsiMeanReversionV1,
  momentum24hV1,
  meanReversion24hV1,
  gridDeviationV1,
  deterministicCompositeV1,
  fundingCarryV1,
];
