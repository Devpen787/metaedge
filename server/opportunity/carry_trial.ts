import { readFundingSeries } from './snapshot.js';
import { annualizedReturnPercent } from '../units.mjs';

// FORWARD PAPER TRIAL — funding-basis-v2 variant B (hedged spot-perp carry).
// Card: docs/edgeops/cards/funding-basis-v2.md
//
// Accrues hypothetical carry from OUR OWN recorder's funding capture. Nothing
// here trades, quotes, or touches a wallet. It exists to run the card's
// pre-committed falsifier against live evidence.
//
// THE DENOMINATOR IS PRE-COMMITTED (resolved 2026-07-09, BEFORE data accrued):
// the historical study reported APR on NOTIONAL (`pos.acc += rows[i].funding`
// accrues a fraction of notional). But a hedged carry funds BOTH legs, so the
// capital actually at risk is 2x notional. The falsifier is therefore evaluated
// on RETURN ON DEPLOYED CAPITAL — the stricter, capital-honest reading. Choosing
// the looser denominator after seeing the numbers would be post-hoc selection.

export interface CarryTrialConfig {
  id: string;
  coins: string[];
  notionalUsdPerCoin: number;
  capitalMultiple: number;
  roundTripCostFraction: number;
  killFloorAprOnCapital: number;
  trialDays: number;
  trialStart: string;
  minimumCaptureCoverage: number;
}

export interface CarryLeg {
  symbol: string;
  hoursAccrued: number;
  hoursElapsed: number;
  captureCoverage: number;          // hoursAccrued / hoursElapsed
  accruedFundingFraction: number;   // fraction of notional
  basisPnlFraction: number | null;  // null when premium was never captured
  basisMeasured: boolean;
  netFraction: number;              // of notional, after cost (+ basis when known)
  netUsd: number;
  aprOnNotional: number;
  aprOnCapital: number;             // THE falsifier metric
  breakevenHours: number | null;    // hours of carry needed to repay the round trip
}

export interface CarryTrial {
  t: number;
  daysElapsed: number;
  trialDays: number;
  killFloorAprOnCapital: number;
  minCaptureCoverage: number;
  legs: CarryLeg[];
  portfolioAprOnCapital: number | null;
  verdict: 'ACCRUING' | 'KILL' | 'HOLD' | 'INSUFFICIENT_DATA';
  reason: string;
}

function computeLeg(symbol: string, config: CarryTrialConfig, now: number): CarryLeg | null {
  const trialStartMs = Date.parse(config.trialStart);
  const rows = readFundingSeries(symbol, trialStartMs);
  if (rows.length < 2) return null;

  // Each captured row represents one hour of funding. Recorder gaps simply do
  // not accrue — this UNDERSTATES carry rather than inventing hours we didn't see.
  const hoursAccrued = rows.length;
  const hoursElapsed = Math.max(1, (now - trialStartMs) / 3_600_000);
  const captureCoverage = Math.min(1, hoursAccrued / hoursElapsed);
  const accruedFundingFraction = rows.reduce((s, r) => s + r.fundingHourly, 0);

  // Short perp gains when the premium falls: basis PnL = premium(entry) - premium(now).
  const pIn = rows[0].premium;
  const pNow = rows[rows.length - 1].premium;
  const basisMeasured = pIn !== null && pNow !== null;
  const basisPnlFraction = basisMeasured ? (pIn as number) - (pNow as number) : null;

  const netFraction = accruedFundingFraction + (basisPnlFraction ?? 0) - config.roundTripCostFraction;

  // How many hours of carry, at the CURRENT hourly rate, merely repay the round trip?
  const latestHourly = rows[rows.length - 1].fundingHourly;
  const breakevenHours = latestHourly > 0 ? config.roundTripCostFraction / latestHourly : null;

  return {
    symbol,
    hoursAccrued,
    hoursElapsed,
    captureCoverage,
    accruedFundingFraction,
    basisPnlFraction,
    basisMeasured,
    netFraction,
    netUsd: netFraction * config.notionalUsdPerCoin,
    aprOnNotional: annualizedReturnPercent(netFraction, hoursAccrued),
    aprOnCapital: annualizedReturnPercent(netFraction / config.capitalMultiple, hoursAccrued),
    breakevenHours,
  };
}

export function computeCarryTrial(config: CarryTrialConfig, now = Date.now()): CarryTrial {
  const daysElapsed = (now - Date.parse(config.trialStart)) / 86_400_000;
  const legs = config.coins.map((coin) => computeLeg(coin, config, now)).filter((leg): leg is CarryLeg => leg !== null);
  const minCoverage = legs.length ? Math.min(...legs.map((l) => l.captureCoverage)) : 0;

  const base: Omit<CarryTrial, 'verdict' | 'reason'> = {
    t: now,
    daysElapsed,
    trialDays: config.trialDays,
    killFloorAprOnCapital: config.killFloorAprOnCapital,
    minCaptureCoverage: minCoverage,
    legs,
    portfolioAprOnCapital: legs.length ? legs.reduce((s, l) => s + l.aprOnCapital, 0) / legs.length : null,
  };

  if (legs.length === 0) {
    return { ...base, verdict: 'INSUFFICIENT_DATA', reason: 'no captured funding rows since the trial start date' };
  }
  if (daysElapsed < config.trialDays) {
    return {
      ...base,
      verdict: 'ACCRUING',
      reason: `day ${daysElapsed.toFixed(1)} of ${config.trialDays} — the falsifier is evaluated at day ${config.trialDays}, not before`,
    };
  }
  // Gaps understate carry, so a recorder outage must never be allowed to look
  // like a failed strategy. Refuse the verdict instead of rendering a false KILL.
  if (minCoverage < config.minimumCaptureCoverage) {
    return {
      ...base,
      verdict: 'INSUFFICIENT_DATA',
      reason: `capture coverage ${(minCoverage * 100).toFixed(1)}% < ${config.minimumCaptureCoverage * 100}% — missing hours understate carry; a recorder outage cannot be read as a kill`,
    };
  }
  const apr = base.portfolioAprOnCapital as number;
  return apr < config.killFloorAprOnCapital
    ? { ...base, verdict: 'KILL', reason: `${apr.toFixed(2)}% APR on capital < ${config.killFloorAprOnCapital}% floor over ${config.trialDays} days` }
    : { ...base, verdict: 'HOLD', reason: `${apr.toFixed(2)}% APR on capital clears the ${config.killFloorAprOnCapital}% floor (survival, not proof)` };
}

/** What the trial WILL yield at a given sustained funding APR, given the card's cost model. */
export function projectAprOnCapital(fundingAprOnNotional: number, config: CarryTrialConfig): number {
  const hours = config.trialDays * 24;
  const hourly = fundingAprOnNotional / 100 / (24 * 365);
  const netFraction = hourly * hours - config.roundTripCostFraction;
  return annualizedReturnPercent(netFraction / config.capitalMultiple, hours);
}
