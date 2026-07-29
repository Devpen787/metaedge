import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

export const quantRouter = Router();

// --- Indicators -----------------------------------------------------------
function calculateRSI(prices: number[], period: number = 14) {
  const rsi = new Array(prices.length).fill(50);
  if (prices.length <= period) return rsi;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function calculateEMA(prices: number[], period: number) {
  const k = 2 / (period + 1);
  const ema = new Array(prices.length).fill(prices[0]);
  for (let i = 1; i < prices.length; i++) {
    ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calculateMACD(prices: number[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  const shortEma = calculateEMA(prices, shortPeriod);
  const longEma = calculateEMA(prices, longPeriod);
  const macdLine = prices.map((_, i) => shortEma[i] - longEma[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((val, i) => val - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

function sma(closes: number[], end: number, period: number): number {
  return closes.slice(end - period, end).reduce((a, b) => a + b, 0) / period;
}

interface BtResult {
  netReturnPct: number;
  grossReturnPct: number;
  costPct: number;
  trades: number;
  winRate: number;
  expectancyPct: number;
  profitFactor: number | null;
  maxDrawdownPct: number;
  sharpe: number;
  equity: number[];
  finalBalance: number;
}

// Honest backtest over closes[from..to). Charges `costRate` on EVERY fill (fee + slippage),
// and runs a parallel cost-free book so we can report the real cost drag.
function runBacktest(
  closes: number[], from: number, to: number,
  short: number, long: number,
  indicators: any, rsiArr: number[], macd: { histogram: number[] },
  costRate: number,
): BtResult {
  const initial = 10000;
  let balance = initial;
  let position = 0;
  let costBasis = 0;
  let grossBalance = initial;
  let grossPos = 0;
  const tradeReturns: number[] = [];
  const equity: number[] = [];
  let peak = initial;
  let maxDD = 0;
  const start = Math.max(long, from);

  for (let i = start; i < to; i++) {
    const shortSma = sma(closes, i, short);
    const longSma = sma(closes, i, long);
    const price = closes[i];

    let buy = false;
    let sell = false;
    if (indicators.sma !== false) {
      buy = shortSma > longSma;
      sell = shortSma < longSma;
    } else {
      const s20 = sma(closes, i, 20);
      buy = price > s20;
      sell = price < s20;
    }
    if (indicators.rsi) {
      if (rsiArr[i] > 70) buy = false;
      if (rsiArr[i] < 30) sell = false;
    }
    if (indicators.macd) {
      if (macd.histogram[i] <= 0) buy = false;
      if (macd.histogram[i] >= 0) sell = false;
    }

    if (buy && position === 0) {
      costBasis = balance;
      position = (balance * (1 - costRate)) / price;
      balance = 0;
      grossPos = grossBalance / price;
      grossBalance = 0;
    } else if (sell && position > 0) {
      balance = position * price * (1 - costRate);
      tradeReturns.push((balance - costBasis) / costBasis);
      position = 0;
      grossBalance = grossPos * price;
      grossPos = 0;
    }

    const eq = balance > 0 ? balance : position * price;
    equity.push(eq);
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? (peak - eq) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  if (position > 0) {
    const price = closes[to - 1];
    balance = position * price * (1 - costRate);
    tradeReturns.push((balance - costBasis) / costBasis);
    grossBalance = grossPos * price;
    position = 0;
  }

  const finalBalance = balance;
  const netReturnPct = ((finalBalance - initial) / initial) * 100;
  const grossReturnPct = ((grossBalance - initial) / initial) * 100;
  const trades = tradeReturns.length;
  const wins = tradeReturns.filter((r) => r > 0).length;
  const winRate = trades ? (wins / trades) * 100 : 0;
  const expectancyPct = trades ? (tradeReturns.reduce((a, b) => a + b, 0) / trades) * 100 : 0;
  const grossWin = tradeReturns.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const grossLoss = -tradeReturns.filter((r) => r < 0).reduce((a, b) => a + b, 0);
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? null : 0);

  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) rets.push(equity[i] / equity[i - 1] - 1);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance = rets.length > 1 ? rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1) : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(365) : 0;

  return {
    netReturnPct, grossReturnPct, costPct: grossReturnPct - netReturnPct,
    trades, winRate, expectancyPct, profitFactor,
    maxDrawdownPct: maxDD * 100, sharpe, equity, finalBalance,
  };
}

quantRouter.post('/api/quant/backtest', async (req, res) => {
  try {
    const { symbol, indicators = {}, feeds = {}, feeBps, slippageBps } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });

    const feeVal = Number.isFinite(Number(feeBps)) && Number(feeBps) >= 0 ? Number(feeBps) : 10;
    const slipVal = Number.isFinite(Number(slippageBps)) && Number(slippageBps) >= 0 ? Number(slippageBps) : 5;
    const costRate = Math.min(0.1, (feeVal + slipVal) / 10000); // charged on every fill; capped for safety

    const marketSymbol = symbol.toUpperCase().replace(/[^A-Z]/g, '') + 'USDT';
    const url = `https://api.binance.com/api/v3/klines?symbol=${marketSymbol}&interval=1d&limit=100`;
    const binanceRes = await fetch(url);
    if (!binanceRes.ok) throw new Error(`Failed to fetch market data for ${marketSymbol} from Binance`);
    const rawData = await binanceRes.json();
    const closes: number[] = rawData.map((d: any[]) => parseFloat(d[4]));
    if (closes.length < 40) throw new Error('Not enough history to backtest honestly.');

    const rsiArr = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);

    // Optimize params IN-SAMPLE (first 70%), judge OUT-OF-SAMPLE (last 30%) — no in-sample cheating.
    const splitIdx = Math.floor(closes.length * 0.7);
    const shortOptions = [5, 7, 9, 10, 12, 14];
    const longOptions = [20, 21, 25, 30, 40, 50];
    let bestShort = 10;
    let bestLong = 20;
    let bestIsNet = -Infinity;
    for (const s of shortOptions) {
      for (const l of longOptions) {
        if (s >= l) continue;
        const r = runBacktest(closes, 0, splitIdx, s, l, indicators, rsiArr, macd, costRate);
        if (r.netReturnPct > bestIsNet) { bestIsNet = r.netReturnPct; bestShort = s; bestLong = l; }
      }
    }

    const full = runBacktest(closes, 0, closes.length, bestShort, bestLong, indicators, rsiArr, macd, costRate);
    const inSample = runBacktest(closes, 0, splitIdx, bestShort, bestLong, indicators, rsiArr, macd, costRate);
    const outSample = runBacktest(closes, splitIdx, closes.length, bestShort, bestLong, indicators, rsiArr, macd, costRate);

    // Deterministic robustness score from OUT-OF-SAMPLE net metrics (no randomness).
    let score = 50;
    score += Math.max(-25, Math.min(25, outSample.expectancyPct * 6));
    score += outSample.profitFactor == null ? 6 : (outSample.profitFactor >= 1.3 ? 12 : outSample.profitFactor >= 1 ? 4 : -12);
    score += Math.min(10, outSample.trades * 2);
    score -= Math.max(0, Math.min(20, (inSample.netReturnPct - outSample.netReturnPct) / 5)); // overfit penalty
    const horizonScore = Math.round(Math.max(1, Math.min(100, score)));

    // Alt-data feeds can't be sourced for real → label as simulated; they never affect the score.
    const enabledFeeds = Object.keys(feeds).filter((k) => feeds[k]);
    const sentimentSignal = enabledFeeds.length
      ? `${enabledFeeds.join(', ')} (simulated — not live data feeds)`
      : 'No alternative feeds enabled';

    // Honest robustness breakdown, kept in the {timeframe, return} shape the UI renders.
    const pct = (v: number) => `${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(2)}%`;
    const matrix = [
      { timeframe: 'Gross', return: pct(full.grossReturnPct) },
      { timeframe: 'Net', return: pct(full.netReturnPct) },
      { timeframe: 'In-Smpl', return: pct(inSample.netReturnPct) },
      { timeframe: 'Out-Smpl', return: pct(outSample.netReturnPct) },
      { timeframe: 'Cost', return: pct(-full.costPct) },
    ];

    // Optional AI commentary from the HONEST numbers — never sets the score.
    let aiCommentary: string | undefined;
    try {
      if (process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `In two sentences, honestly assess this SMA-crossover backtest for ${symbol} (params ${bestShort}/${bestLong}), NET of fees+slippage. `
          + `Out-of-sample: return ${outSample.netReturnPct.toFixed(2)}%, win rate ${outSample.winRate.toFixed(1)}%, expectancy ${outSample.expectancyPct.toFixed(2)}%/trade over ${outSample.trades} trades. `
          + `In-sample return ${inSample.netReturnPct.toFixed(2)}%. Flag overfitting if out-of-sample lags in-sample. Do not exaggerate or invent signals.`;
        const aiRes = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        aiCommentary = aiRes.text?.trim();
      }
    } catch (err: any) {
      // Commentary is optional and the metrics stand on their own, so the request
      // still succeeds — but swallowing this silently hides a revoked API key, an
      // exhausted quota, or an SDK change for as long as nobody looks.
      console.warn('[quant] AI commentary unavailable:', err?.message ?? err);
    }

    res.json({
      // Headline = full period, NET of real cost.
      sharpe: full.sharpe.toFixed(2),
      maxDrawdown: `-${full.maxDrawdownPct.toFixed(2)}%`,
      winRate: `${full.winRate.toFixed(1)}%`,
      horizonScore,
      totalTrades: full.trades,
      pnl: (full.finalBalance - 10000).toFixed(2),
      matrix,
      curve: full.equity.length ? full.equity : [10000],
      optimizedParams: { short: bestShort, long: bestLong },
      sentimentSignal,
      // Honest transparency (extra fields; frontend ignores what it doesn't use).
      netReturnPct: Number(full.netReturnPct.toFixed(2)),
      grossReturnPct: Number(full.grossReturnPct.toFixed(2)),
      costDragPct: Number(full.costPct.toFixed(2)),
      expectancyPct: Number(full.expectancyPct.toFixed(3)),
      profitFactor: full.profitFactor == null ? null : Number(full.profitFactor.toFixed(2)),
      inSample: { netReturnPct: Number(inSample.netReturnPct.toFixed(2)), winRate: Number(inSample.winRate.toFixed(1)), trades: inSample.trades },
      outOfSample: { netReturnPct: Number(outSample.netReturnPct.toFixed(2)), winRate: Number(outSample.winRate.toFixed(1)), expectancyPct: Number(outSample.expectancyPct.toFixed(3)), trades: outSample.trades },
      cost: { feeBps: feeVal, slippageBps: slipVal, note: 'Round-trip cost charged on every fill (fee + slippage).' },
      dataDisclaimer: 'Backtest on 100 daily Binance candles. Params optimized in-sample (first 70%), judged out-of-sample (last 30%). Alt-data feeds are simulated. Past performance is not predictive.',
      aiCommentary,
    });
  } catch (err: any) {
    console.error('[Quant Engine Error]', err);
    res.status(500).json({ error: err.message || 'Quant engine simulation failed' });
  }
});
