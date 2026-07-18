// PORTFOLIO CONSTRUCTION (Layer 2). Combines engine exposures into per-(engine,
// instrument) target weights (fractions of equity, BEFORE the vol-target scalar).
//
// v1 policy — deliberately simple, not mean-variance (noisy covariances overfit
// worse than the strategies did):
//   - EQUAL RISK BUDGET across engines: each active engine gets 1/N of the book.
//   - INVERSE-VOL within an engine: the engine splits its budget across the
//     instruments it wants, weighting each ∝ 1/σ (lower-vol names get more).
// An engine that is flat this bar contributes nothing (its budget is simply not
// deployed — we do NOT redistribute it, so gross falls when engines sit out;
// the vol-target scalar then decides whether to lever the rest).
//
// `budgets` lets a future Regime/allocator layer override the equal split (e.g.
// starve a decaying engine) without touching this code.

// engineTargetsAt: { engineId: { instrument: exposure ∈ [0,1] } }   at ONE bar
// sigmasAt:        { instrument: annualizedVol }                    at the same bar
// returns:         [{ engine, instrument, weight }]  weights are fractions of equity
export function construct(engineTargetsAt, sigmasAt, { budgets } = {}) {
  const engines = Object.keys(engineTargetsAt);
  if (!engines.length) return [];
  const b = budgets || Object.fromEntries(engines.map((e) => [e, 1 / engines.length]));
  const out = [];
  for (const e of engines) {
    const exposures = engineTargetsAt[e] || {};
    // inverse-vol raw weights within this engine
    const raw = {};
    let sum = 0;
    for (const [instrument, x] of Object.entries(exposures)) {
      const sigma = sigmasAt[instrument];
      if (!(x > 0) || !(sigma > 0)) continue;         // no exposure or no vol estimate → skip
      const r = x / sigma;
      raw[instrument] = r; sum += r;
    }
    if (sum <= 0) continue;                            // engine flat this bar → deploys nothing
    const budget = b[e] || 0;
    for (const [instrument, r] of Object.entries(raw)) {
      out.push({ engine: e, instrument, weight: budget * (r / sum) });
    }
  }
  return out;
}
