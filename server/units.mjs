// SINGLE SOURCE OF TRUTH for unit conversions.
//
// Why this file exists: a rule that lives in a document does not constrain.
// Every conversion below used to be re-derived by hand in each script that
// needed it, and twice that produced a real bug:
//
//   2026-07-08  funding compared as an HOURLY FRACTION against PERCENT
//               thresholds → zero episodes, two study runs invalidated.
//   2026-07-09  open interest in BASE-COIN units labeled USD → the scanner
//               ranked BTC (~$2.38B OI) LAST, behind SOL (~$412M).
//
// Both bugs were "prevented" by prose in data_requirements_and_contracts.md.
// Prose prevented nothing. Import these functions. Never re-derive them.
//
// Plain .mjs so BOTH the TypeScript server (allowJs) and the .mjs scripts can
// import the same implementation. One rule, one place, one chance to be wrong.

export const HOURS_PER_YEAR = 24 * 365;

/**
 * Hyperliquid funding is an HOURLY FRACTION (e.g. 1.25e-05 = 0.00125%/hr).
 * Returns the annualized rate as a PERCENT (e.g. 10.95), or null if unusable.
 *
 * Never compare the raw hourly fraction against a percent threshold.
 * @param {unknown} fundingHourly hourly funding rate, as a fraction
 * @returns {number|null} annualized percent
 */
export function fundingAprPercent(fundingHourly) {
  if (typeof fundingHourly !== 'number' || !Number.isFinite(fundingHourly)) return null;
  return fundingHourly * HOURS_PER_YEAR * 100;
}

/**
 * Hyperliquid `openInterest` is denominated in BASE-COIN units, not USD.
 * Coin counts are NOT comparable across symbols (38k BTC vs 5.3M SOL).
 * Only the notional is. Returns null when the mark price is missing — absence
 * of data must DECLINE, never score as zero.
 * @param {unknown} openInterestCoin open interest in base-coin units
 * @param {unknown} markPx mark price in USD
 * @returns {number|null} notional USD
 */
export function openInterestUsd(openInterestCoin, markPx) {
  if (typeof openInterestCoin !== 'number' || !Number.isFinite(openInterestCoin)) return null;
  if (typeof markPx !== 'number' || !Number.isFinite(markPx) || markPx <= 0) return null;
  return openInterestCoin * markPx;
}

/**
 * Annualize a realized return earned over a number of hours DEPLOYED.
 * Distinct from fundingAprPercent: that converts a per-hour RATE; this converts
 * a total RETURN over an elapsed window. Conflating the two is its own bug.
 * @param {number} totalReturnFraction total return as a fraction (0.013 = 1.3%)
 * @param {number} hoursDeployed hours capital was actually deployed
 * @returns {number} annualized percent (0 when never deployed)
 */
export function annualizedReturnPercent(totalReturnFraction, hoursDeployed) {
  if (!Number.isFinite(totalReturnFraction) || !Number.isFinite(hoursDeployed) || hoursDeployed <= 0) return 0;
  return (totalReturnFraction / (hoursDeployed / HOURS_PER_YEAR)) * 100;
}
