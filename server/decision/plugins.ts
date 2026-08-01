import { FEATURE_VERSIONS } from './features.js';
import type { DecisionContext, StrategyPlugin } from './types.js';

interface RsiMeanReversionParams extends Record<string, unknown> {
  rsiEntry: number;
  rsiExit: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldHours: number;
}

export const rsiMeanReversionV5: StrategyPlugin<RsiMeanReversionParams> = {
  authorityVersion: 5,
  schema: 'strategy-plugin.v5',
  id: 'rsi_mean_reversion',
  version: '5.0.0',
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

export const fundingCarryV5: StrategyPlugin<FundingCarryParams> = {
  authorityVersion: 5,
  schema: 'strategy-plugin.v5',
  id: 'funding_carry',
  version: '5.0.0',
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
    authorityVersion: 5,
    schema: 'strategy-plugin.v5',
    id,
    version: '5.0.0',
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

export const momentum24hV5 = directional24hPlugin(
  'momentum_24h',
  'follow a sufficiently large positive 24-hour move and exit on reversal',
  (change) => change >= 0.75,
  (change) => change <= -0.75,
);

export const meanReversion24hV5 = directional24hPlugin(
  'mean_reversion_24h',
  'fade a sufficiently large negative 24-hour move and exit on reversion',
  (change) => change <= -0.75,
  (change) => change >= 0.75,
);

export const gridDeviationV5: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5',
  id: 'grid_deviation', version: '5.0.0', mechanism: 'trade a fixed band around the 200-hour mean', instrument: 'spot',
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

interface GoldenCrossParams extends Record<string, unknown> {
  minimumVolumeRatio: number;
  requireFreshCross: boolean;
  requirePositive30dReturn: boolean;
}

function goldenCrossPlugin(
  id: 'golden_cross_strict' | 'golden_cross_participate',
  parameters: GoldenCrossParams,
): StrategyPlugin<GoldenCrossParams> {
  return {
    authorityVersion: 5,
    schema: 'strategy-plugin.v5',
    id,
    version: '5.0.0',
    mechanism: parameters.requireFreshCross
      ? 'enter only when the daily 50-SMA crosses above the daily 200-SMA with strong volume'
      : 'participate while the daily 50-SMA remains above the daily 200-SMA with positive medium-term momentum',
    instrument: 'spot',
    requiredFeatures: [
      FEATURE_VERSIONS.price,
      FEATURE_VERSIONS.volume24h,
      FEATURE_VERSIONS.dailySma50,
      FEATURE_VERSIONS.dailySma200,
      FEATURE_VERSIONS.dailySma50Previous,
      FEATURE_VERSIONS.dailySma200Previous,
      FEATURE_VERSIONS.dailyVolume50Average,
      FEATURE_VERSIONS.return30d,
    ],
    parameters,
    benchmark: 'buy_hold_same_symbol_same_window',
    falsifier: 'post-cost forward expectancy <= 0 within eligible golden-cross regimes',
    expectedFailureRegimes: ['late_cycle_breakout', 'low_volume_whipsaw', 'market_wide_deleveraging'],
    regimeGate(context) {
      if (context.position.holding) {
        return { eligible: true, reason: 'OPEN_POSITION_EXIT_RULE_EVALUATION' };
      }
      const sma50 = Number(context.features[FEATURE_VERSIONS.dailySma50]?.value);
      const sma200 = Number(context.features[FEATURE_VERSIONS.dailySma200]?.value);
      const return30d = Number(context.features[FEATURE_VERSIONS.return30d]?.value);
      const eligible = sma50 > sma200 && (!parameters.requirePositive30dReturn || return30d > 0);
      return {
        eligible,
        reason: eligible ? 'DAILY_GOLDEN_CROSS_REGIME' : 'GOLDEN_CROSS_REGIME_NOT_ELIGIBLE',
      };
    },
    generateSignal(context) {
      const sma50 = Number(context.features[FEATURE_VERSIONS.dailySma50]?.value);
      const sma200 = Number(context.features[FEATURE_VERSIONS.dailySma200]?.value);
      const previous50 = Number(context.features[FEATURE_VERSIONS.dailySma50Previous]?.value);
      const previous200 = Number(context.features[FEATURE_VERSIONS.dailySma200Previous]?.value);
      const volume24h = Number(context.features[FEATURE_VERSIONS.volume24h]?.value);
      const volumeAverage = Number(context.features[FEATURE_VERSIONS.dailyVolume50Average]?.value);
      const volumeRatio = volumeAverage > 0 ? volume24h / volumeAverage : 0;
      const freshCross = previous50 <= previous200 && sma50 > sma200;
      const entryEligible = (!parameters.requireFreshCross || freshCross)
        && volumeRatio >= parameters.minimumVolumeRatio;
      if (!context.position.holding && entryEligible) {
        return {
          action: 'buy',
          strength: Math.min(1, Math.max(0, volumeRatio / Math.max(parameters.minimumVolumeRatio, 0.01) - 0.5)),
          setup: `daily SMA50 ${sma50.toFixed(2)} above SMA200 ${sma200.toFixed(2)}`,
          trigger: `${parameters.requireFreshCross ? 'fresh cross' : 'participation'} with ${volumeRatio.toFixed(2)}x 50-day volume`,
          invalidation: 'daily SMA50 closes below daily SMA200',
          regime: parameters.requireFreshCross ? 'golden_cross_strict' : 'golden_cross_participate',
        };
      }
      if (context.position.holding && sma50 <= sma200) {
        return {
          action: 'sell',
          strength: 1,
          setup: 'open daily golden-cross position',
          trigger: 'daily SMA50 no longer exceeds daily SMA200',
          invalidation: 'position closed by the frozen trend-exit rule',
          regime: 'golden_cross_exit',
        };
      }
      return {
        action: 'hold',
        strength: 0,
        setup: 'daily golden-cross features observed',
        trigger: entryEligible ? 'position already open' : 'frozen entry conditions not met',
        invalidation: 'none',
        regime: sma50 > sma200 ? 'golden_cross_watch' : 'golden_cross_inactive',
      };
    },
  };
}

export const goldenCrossStrictV5 = goldenCrossPlugin('golden_cross_strict', {
  minimumVolumeRatio: 1.5,
  requireFreshCross: true,
  requirePositive30dReturn: false,
});

export const goldenCrossParticipateV5 = goldenCrossPlugin('golden_cross_participate', {
  minimumVolumeRatio: 0.8,
  requireFreshCross: false,
  requirePositive30dReturn: true,
});

export const volatilityBreakoutV5: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5', id: 'volatility_breakout', version: '5.0.0',
  mechanism: 'enter upside expansion only when realized hourly volatility and the 24-hour move jointly confirm', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.change24h, FEATURE_VERSIONS.realizedVol],
  parameters: { minimumChange24hPct: 1.5, minimumVolPctPerHour: 0.8, exitChange24hPct: 0 },
  benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'post-cost forward breakout expectancy <= 0 after 20 independent high-volatility episodes',
  expectedFailureRegimes: ['news_reversal', 'gap_after_breakout', 'liquidity_withdrawal'],
  regimeGate(context) {
    const vol = Number(context.features[FEATURE_VERSIONS.realizedVol]?.value);
    return { eligible: vol >= Number(this.parameters.minimumVolPctPerHour), reason: vol >= Number(this.parameters.minimumVolPctPerHour) ? 'VOLATILITY_EXPANSION_REGIME' : 'VOLATILITY_TOO_LOW' };
  },
  generateSignal(context) {
    const change = Number(context.features[FEATURE_VERSIONS.change24h]?.value);
    if (!context.position.holding && change >= Number(this.parameters.minimumChange24hPct)) return { action: 'buy', strength: Math.min(1, change / 5), setup: 'realized volatility expansion', trigger: `24h change >= ${this.parameters.minimumChange24hPct}%`, invalidation: `24h change <= ${this.parameters.exitChange24hPct}%`, regime: 'upside_volatility_expansion' };
    if (context.position.holding && change <= Number(this.parameters.exitChange24hPct)) return { action: 'sell', strength: 1, setup: 'open volatility breakout', trigger: 'breakout momentum reversed', invalidation: 'position closed by frozen reversal rule', regime: 'volatility_breakout_exit' };
    return { action: 'hold', strength: 0, setup: 'volatility observed', trigger: 'breakout threshold not met', invalidation: 'none', regime: 'volatility_watch' };
  },
};

export const trendPullbackV5: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5', id: 'trend_pullback', version: '5.0.0',
  mechanism: 'buy a bounded short-horizon pullback while price remains above its 200-hour trend', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.sma200, FEATURE_VERSIONS.rsi14, FEATURE_VERSIONS.change24h],
  parameters: { entryRsi: 45, exitRsi: 55, minimumPullbackPct: -0.5 }, benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'post-cost forward expectancy <= 0 in above-SMA pullback episodes',
  expectedFailureRegimes: ['trend_break', 'persistent_selloff', 'gap_through_invalidation'],
  regimeGate(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    return { eligible: price > sma, reason: price > sma ? 'ABOVE_LONG_TREND' : 'LONG_TREND_BROKEN' };
  },
  generateSignal(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    const rsi = Number(context.features[FEATURE_VERSIONS.rsi14]?.value);
    const change = Number(context.features[FEATURE_VERSIONS.change24h]?.value);
    if (!context.position.holding && rsi <= Number(this.parameters.entryRsi) && change <= Number(this.parameters.minimumPullbackPct)) return { action: 'buy', strength: Math.min(1, (50 - rsi) / 25), setup: 'pullback above the 200-hour trend', trigger: `RSI <= ${this.parameters.entryRsi} and 24h change <= ${this.parameters.minimumPullbackPct}%`, invalidation: 'price below SMA200 or RSI recovery exit', regime: 'trend_pullback' };
    if (context.position.holding && (rsi >= Number(this.parameters.exitRsi) || price <= sma)) return { action: 'sell', strength: 1, setup: 'open trend-pullback position', trigger: price <= sma ? 'long trend broke' : `RSI >= ${this.parameters.exitRsi}`, invalidation: 'position closed by frozen exit', regime: 'trend_pullback_exit' };
    return { action: 'hold', strength: 0, setup: 'trend and pullback observed', trigger: 'pullback threshold not met', invalidation: 'none', regime: 'trend_pullback_watch' };
  },
};

export const mediumTermTrendV5: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5', id: 'medium_term_trend', version: '5.0.0',
  mechanism: 'participate in positive 30-day drift only when price remains above the 200-hour trend', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.sma200, FEATURE_VERSIONS.return30d, FEATURE_VERSIONS.change24h],
  parameters: { minimumReturn30dPct: 3, minimumChange24hPct: 0, exitReturn30dPct: 0 }, benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'timed medium-term trend exposure does not beat continuous buy-and-hold after costs',
  expectedFailureRegimes: ['late_cycle_trend', 'sharp_reversal', 'sideways_chop'],
  regimeGate(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    const ret = Number(context.features[FEATURE_VERSIONS.return30d]?.value);
    const eligible = price > sma && ret >= Number(this.parameters.minimumReturn30dPct);
    return { eligible, reason: eligible ? 'POSITIVE_MEDIUM_TERM_TREND' : 'MEDIUM_TERM_TREND_INELIGIBLE' };
  },
  generateSignal(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    const ret = Number(context.features[FEATURE_VERSIONS.return30d]?.value);
    const change = Number(context.features[FEATURE_VERSIONS.change24h]?.value);
    if (!context.position.holding && change >= Number(this.parameters.minimumChange24hPct)) return { action: 'buy', strength: Math.min(1, ret / 20), setup: `${ret.toFixed(2)}% 30-day trend above SMA200`, trigger: 'non-negative daily confirmation', invalidation: `30-day return <= ${this.parameters.exitReturn30dPct}% or price below SMA200`, regime: 'medium_term_trend' };
    if (context.position.holding && (ret <= Number(this.parameters.exitReturn30dPct) || price <= sma)) return { action: 'sell', strength: 1, setup: 'open medium-term trend position', trigger: 'medium-term trend invalidated', invalidation: 'position closed by frozen trend rule', regime: 'medium_term_trend_exit' };
    return { action: 'hold', strength: 0, setup: 'medium-term trend observed', trigger: 'confirmation absent', invalidation: 'none', regime: 'medium_term_trend_watch' };
  },
};

export const capitulationReboundV5: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5', id: 'capitulation_rebound', version: '5.0.0',
  mechanism: 'test rebound after jointly extreme downside, RSI, and volatility conditions', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.change24h, FEATURE_VERSIONS.return30d, FEATURE_VERSIONS.rsi14, FEATURE_VERSIONS.realizedVol],
  parameters: { maximumRsi: 28, maximumChange24hPct: -2, minimumVolPctPerHour: 1, exitRsi: 48 }, benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'post-cost rebound expectancy <= 0 after independent capitulation episodes',
  expectedFailureRegimes: ['structural_collapse', 'liquidity_crisis', 'continued_deleveraging'],
  regimeGate(context) {
    const ret = Number(context.features[FEATURE_VERSIONS.return30d]?.value);
    const vol = Number(context.features[FEATURE_VERSIONS.realizedVol]?.value);
    const eligible = ret < 0 && vol >= Number(this.parameters.minimumVolPctPerHour);
    return { eligible, reason: eligible ? 'NEGATIVE_HIGH_VOLATILITY_REGIME' : 'CAPITULATION_REGIME_INELIGIBLE' };
  },
  generateSignal(context) {
    const rsi = Number(context.features[FEATURE_VERSIONS.rsi14]?.value);
    const change = Number(context.features[FEATURE_VERSIONS.change24h]?.value);
    if (!context.position.holding && rsi <= Number(this.parameters.maximumRsi) && change <= Number(this.parameters.maximumChange24hPct)) return { action: 'buy', strength: Math.min(1, Math.abs(change) / 8), setup: 'high-volatility downside capitulation', trigger: `RSI <= ${this.parameters.maximumRsi} and 24h <= ${this.parameters.maximumChange24hPct}%`, invalidation: 'continued loss beyond the frozen risk budget or RSI recovery', regime: 'capitulation' };
    if (context.position.holding && rsi >= Number(this.parameters.exitRsi)) return { action: 'sell', strength: 1, setup: 'open capitulation rebound', trigger: `RSI >= ${this.parameters.exitRsi}`, invalidation: 'position closed by frozen rebound exit', regime: 'capitulation_rebound_exit' };
    return { action: 'hold', strength: 0, setup: 'capitulation features observed', trigger: 'joint extreme absent', invalidation: 'none', regime: 'capitulation_watch' };
  },
};

export const liquidityExpansionV5: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5', id: 'liquidity_expansion', version: '5.0.0',
  mechanism: 'enter positive medium-term drift only when daily turnover expands far above its 50-day baseline', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.dailyVolume50Average, FEATURE_VERSIONS.return30d],
  parameters: { minimumVolumeRatio: 2, minimumReturn30dPct: 0, exitVolumeRatio: 1 }, benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'volume expansion does not improve post-cost forward returns versus the same-symbol control',
  expectedFailureRegimes: ['one_day_pump', 'wash_volume', 'liquidity_evaporation'],
  regimeGate(context) {
    const volume = Number(context.features[FEATURE_VERSIONS.volume24h]?.value);
    const average = Number(context.features[FEATURE_VERSIONS.dailyVolume50Average]?.value);
    const ratio = average > 0 ? volume / average : 0;
    return { eligible: ratio >= Number(this.parameters.minimumVolumeRatio), reason: ratio >= Number(this.parameters.minimumVolumeRatio) ? 'LIQUIDITY_EXPANSION_REGIME' : 'LIQUIDITY_EXPANSION_ABSENT' };
  },
  generateSignal(context) {
    const volume = Number(context.features[FEATURE_VERSIONS.volume24h]?.value);
    const average = Number(context.features[FEATURE_VERSIONS.dailyVolume50Average]?.value);
    const ratio = average > 0 ? volume / average : 0;
    const ret = Number(context.features[FEATURE_VERSIONS.return30d]?.value);
    if (!context.position.holding && ret > Number(this.parameters.minimumReturn30dPct)) return { action: 'buy', strength: Math.min(1, ratio / 4), setup: `${ratio.toFixed(2)}x daily turnover with positive 30-day drift`, trigger: 'frozen liquidity expansion threshold', invalidation: `volume ratio < ${this.parameters.exitVolumeRatio} or 30-day drift turns negative`, regime: 'liquidity_expansion' };
    if (context.position.holding && (ratio < Number(this.parameters.exitVolumeRatio) || ret < 0)) return { action: 'sell', strength: 1, setup: 'open liquidity-expansion position', trigger: 'liquidity or drift confirmation ended', invalidation: 'position closed by frozen exit', regime: 'liquidity_expansion_exit' };
    return { action: 'hold', strength: 0, setup: 'liquidity expansion observed', trigger: 'directional confirmation absent', invalidation: 'none', regime: 'liquidity_expansion_watch' };
  },
};

export const lowVolatilityDriftV5: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5', id: 'low_volatility_drift', version: '5.0.0',
  mechanism: 'test gradual positive drift above the long trend while hourly volatility remains compressed', instrument: 'spot',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.sma200, FEATURE_VERSIONS.realizedVol, FEATURE_VERSIONS.change24h],
  parameters: { maximumVolPctPerHour: 0.8, minimumChange24hPct: 0.2, maximumEntryChange24hPct: 1.5, exitVolPctPerHour: 1.5 }, benchmark: 'buy_hold_same_symbol_same_window',
  falsifier: 'low-volatility drift fails to survive costs or volatility expansion in forward paper',
  expectedFailureRegimes: ['volatility_shock', 'trend_break', 'crowded_carry_unwind'],
  regimeGate(context) {
    const price = Number(context.features[FEATURE_VERSIONS.price]?.value);
    const sma = Number(context.features[FEATURE_VERSIONS.sma200]?.value);
    const vol = Number(context.features[FEATURE_VERSIONS.realizedVol]?.value);
    const eligible = price > sma && vol <= Number(this.parameters.maximumVolPctPerHour);
    return { eligible, reason: eligible ? 'LOW_VOLATILITY_UPTREND' : 'LOW_VOLATILITY_DRIFT_INELIGIBLE' };
  },
  generateSignal(context) {
    const vol = Number(context.features[FEATURE_VERSIONS.realizedVol]?.value);
    const change = Number(context.features[FEATURE_VERSIONS.change24h]?.value);
    const entry = change >= Number(this.parameters.minimumChange24hPct) && change <= Number(this.parameters.maximumEntryChange24hPct);
    if (!context.position.holding && entry) return { action: 'buy', strength: Math.min(1, change / Number(this.parameters.maximumEntryChange24hPct)), setup: 'compressed volatility above long trend', trigger: 'bounded positive daily drift', invalidation: `hourly volatility >= ${this.parameters.exitVolPctPerHour}% or daily drift negative`, regime: 'low_volatility_drift' };
    if (context.position.holding && (vol >= Number(this.parameters.exitVolPctPerHour) || change < 0)) return { action: 'sell', strength: 1, setup: 'open low-volatility drift position', trigger: 'volatility expanded or drift reversed', invalidation: 'position closed by frozen exit', regime: 'low_volatility_drift_exit' };
    return { action: 'hold', strength: 0, setup: 'low-volatility drift observed', trigger: 'bounded drift absent', invalidation: 'none', regime: 'low_volatility_watch' };
  },
};

export const negativeFundingReversalV5: StrategyPlugin = {
  authorityVersion: 5, schema: 'strategy-plugin.v5', id: 'negative_funding_reversal', version: '5.0.0',
  mechanism: 'take a small directional perp long when funding is extremely negative and exit as funding normalizes', instrument: 'perp',
  requiredFeatures: [FEATURE_VERSIONS.price, FEATURE_VERSIONS.volume24h, FEATURE_VERSIONS.fundingApr, FEATURE_VERSIONS.openInterest],
  parameters: { maximumEntryFundingAprPct: -20, exitFundingAprPct: 0 }, benchmark: 'no_trade',
  falsifier: 'post-cost forward expectancy <= 0 after funding, fees, borrow, and adverse execution',
  expectedFailureRegimes: ['persistent_downtrend', 'funding_remains_negative', 'liquidation_cascade'],
  regimeGate(context) {
    const funding = Number(context.features[FEATURE_VERSIONS.fundingApr]?.value);
    return { eligible: funding <= Number(this.parameters.maximumEntryFundingAprPct), reason: funding <= Number(this.parameters.maximumEntryFundingAprPct) ? 'EXTREME_NEGATIVE_FUNDING' : 'NEGATIVE_FUNDING_EXTREME_ABSENT' };
  },
  generateSignal(context) {
    const funding = Number(context.features[FEATURE_VERSIONS.fundingApr]?.value);
    if (!context.position.holding && funding <= Number(this.parameters.maximumEntryFundingAprPct)) return { action: 'long', strength: Math.min(1, Math.abs(funding) / 100), setup: `funding APR ${funding.toFixed(1)}%`, trigger: `funding <= ${this.parameters.maximumEntryFundingAprPct}% APR`, invalidation: 'funding fails to normalize or frozen position-risk exit fires', regime: 'negative_funding_extreme' };
    if (context.position.holding && funding >= Number(this.parameters.exitFundingAprPct)) return { action: 'short', strength: 1, setup: 'open negative-funding reversal long', trigger: `funding >= ${this.parameters.exitFundingAprPct}%`, invalidation: 'position closed by frozen funding normalization', regime: 'negative_funding_exit' };
    return { action: 'hold', strength: 0, setup: 'funding observed', trigger: 'extreme absent', invalidation: 'none', regime: 'negative_funding_watch' };
  },
};

// REMOVED: deterministicCompositeV1. It traded a blended score
// `(price>sma) + (rsi<=40)`, which is two things at once: a violation of the
// decision record's R3 ("SHALL NOT trade a generic composite score"), and a
// re-expression of rsiMeanReversionV5's own ingredients — so if both fired we
// would be double-counting one exposure as two strategies. A "mechanism" that
// reads "combine evidence with a score" describes a method, not a market edge.
// The custom_ai agent family (its only consumer) has no honest mechanism and is
// intentionally left unmapped: it evaluates to nothing rather than to theatre.

export const STRATEGY_PLUGINS: StrategyPlugin[] = [
  rsiMeanReversionV5,
  momentum24hV5,
  meanReversion24hV5,
  gridDeviationV5,
  fundingCarryV5,
  goldenCrossStrictV5,
  goldenCrossParticipateV5,
  volatilityBreakoutV5,
  trendPullbackV5,
  mediumTermTrendV5,
  capitulationReboundV5,
  liquidityExpansionV5,
  lowVolatilityDriftV5,
  negativeFundingReversalV5,
];
