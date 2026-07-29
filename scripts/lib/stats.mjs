// SHARED STATISTICAL SIGNIFICANCE CHECK — closes a real gap found via the
// system-legibility pass: every forward-paper grader's FLAGS verdict was
// n >= threshold && mean(returns) > 0, with no check on whether that mean is
// actually distinguishable from noise. A positive mean over 30 small, noisy
// samples can easily be luck. This is the one shared implementation every
// grader imports, so the significance bar can never silently drift between
// lanes the way the underlying cost models already had.

/**
 * One-sample t-test against zero (H0: true mean return is 0).
 * @param {number[]} values
 * @returns {{n:number, mean:number, sd:number, t:number}}
 */
export function tStat(values) {
  const n = values.length;
  if (n < 2) return { n, mean: n ? values[0] : 0, sd: 0, t: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const t = se > 0 ? mean / se : (mean > 0 ? Infinity : 0);
  return { n, mean, sd, t };
}

// t>=2 is roughly a one-sided 95%+ confidence bar at the sample sizes these
// graders actually reach (n=20-60) — NOT a new standard invented for this
// file: it matches the t>=2-on-OOS-only bar already stated in
// docs/trading_research_operating_model.md for walk-forward survivors. This
// applies the same bar to forward-paper FLAGS verdicts, which previously had
// no significance test at all.
export const T_BAR = 2;
