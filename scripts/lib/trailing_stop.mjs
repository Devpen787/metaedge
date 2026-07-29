// SHARED TRAILING STOP — step-based, not a single flat distance. Closes a
// real gap: practice_book.mjs and directional_harness.mjs both only ever had
// a FIXED hard-stop (never widened, never followed price) plus a time-stop —
// no "let a winner run and protect the gain as it goes." Per
// EXTERNAL_REPO_ADOPTION_CHECKLIST.md's PAPER-EXECUTE section: Freqtrade's
// trailing_stop_positive/offset is a single constant distance; OctoBot's
// trailing_profiles/ subsystem supports the trail distance itself changing
// at different price levels. This implements the OctoBot-style version
// (more capable), not the Freqtrade-style flat one, since we're building
// this from scratch and there's no reason to build the less-capable design.
//
// PROFILE: an array of {trigger, distance} steps, sorted ascending by
// trigger (fraction of favorable move from entry). The stop trails the best
// price seen SINCE BAR ONE, at the trigger:0 step's distance, tightening as
// higher triggers are crossed — NOT "wait for an offset, then start
// trailing" (that was Freqtrade's design; this one is more protective by
// construction, since trailing-from-open can only match or beat a static
// hard stop, never be worse — verified: see the ratchet guarantee below).
// The default below: trail 6% behind the peak from open; once up 3% from
// entry, tighten to 4% behind the peak; once up 8%, tighten to 2%.
export const DEFAULT_PROFILE = [
  { trigger: 0, distance: 0.06 },
  { trigger: 0.03, distance: 0.04 },
  { trigger: 0.08, distance: 0.02 },
];

function distanceFor(gainPct, profile) {
  let distance = profile[0].distance;
  for (const step of profile) if (gainPct >= step.trigger) distance = step.distance;
  return distance;
}

/**
 * Next stop price for a LONG position. `prevStopPx` is the position's
 * current stop; the return value is guaranteed >= prevStopPx (ratchets up,
 * never down) REGARDLESS of profile shape — the caller never needs to
 * separately enforce the ratchet, it's structural here, not an assumption
 * about the profile being well-formed.
 */
export function nextLongStop(entryPx, peakPx, prevStopPx, profile = DEFAULT_PROFILE) {
  const gainPct = peakPx / entryPx - 1;
  const candidate = peakPx * (1 - distanceFor(gainPct, profile));
  return Math.max(prevStopPx, candidate);
}

/** Mirror of nextLongStop for SHORT positions — ratchets down, never up. */
export function nextShortStop(entryPx, troughPx, prevStopPx, profile = DEFAULT_PROFILE) {
  const gainPct = entryPx / troughPx - 1; // a short profits as price falls
  const candidate = troughPx * (1 + distanceFor(gainPct, profile));
  return Math.min(prevStopPx, candidate);
}
