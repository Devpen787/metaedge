export function alphaSpending(statisticalLookNumber: number): number {
  const look = Math.max(1, Math.floor(statisticalLookNumber));
  return 0.05 / (look * (look + 1));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function measuredAutocorrelationCutoff(values: number[], maximumLag = 100): number {
  if (values.length < 3) return 1;
  const average = mean(values); const denominator = values.reduce((sum, value) => sum + (value - average) ** 2, 0);
  if (!(denominator > 0)) return 1;
  for (let lag = 1; lag <= Math.min(maximumLag, values.length - 2); lag++) {
    let numerator = 0;
    for (let index = lag; index < values.length; index++) numerator += (values[index] - average) * (values[index - lag] - average);
    if (Math.abs(numerator / denominator) < 0.1) return lag;
  }
  return Math.min(maximumLag, values.length - 1);
}

export function chooseBlockLength(input: { values: number[]; times: number[]; edgeHalfLifeMs: number }): {
  blockLengthMs: number; blockLengthSamples: number; independentBlockCount: number; autocorrelationCutoff: number } {
  const orderedTimes = [...input.times].sort((left, right) => left - right);
  const gaps = orderedTimes.slice(1).map((value, index) => Math.max(1, value - orderedTimes[index])).sort((a, b) => a - b);
  const medianGapMs = gaps.length ? gaps[Math.floor(gaps.length / 2)] : Math.max(1, input.edgeHalfLifeMs);
  const autocorrelationCutoff = measuredAutocorrelationCutoff(input.values);
  const blockLengthMs = Math.max(5 * input.edgeHalfLifeMs, autocorrelationCutoff * medianGapMs);
  const blockLengthSamples = Math.max(1, Math.ceil(blockLengthMs / medianGapMs));
  const durationMs = orderedTimes.length > 1 ? orderedTimes.at(-1)! - orderedTimes[0] + medianGapMs : medianGapMs;
  return { blockLengthMs, blockLengthSamples, independentBlockCount: Math.max(1, Math.floor(durationMs / blockLengthMs)),
    autocorrelationCutoff };
}

export function blockBootstrapLowerBound(values: number[], blockLengthSamples: number, alpha: number,
  resamples = 2_000): number | null {
  if (!values.length) return null;
  if (values.length === 1) return Number.NEGATIVE_INFINITY;
  const block = Math.max(1, Math.min(values.length, Math.floor(blockLengthSamples)));
  let state = 0x9e3779b9; const next = () => {
    state = (Math.imul(state ^ (state >>> 16), 0x45d9f3b) + 0x27100001) >>> 0; return state / 0x1_0000_0000;
  };
  const estimates: number[] = [];
  for (let sample = 0; sample < resamples; sample++) {
    const drawn: number[] = [];
    while (drawn.length < values.length) {
      const start = Math.floor(next() * values.length);
      for (let offset = 0; offset < block && drawn.length < values.length; offset++) drawn.push(values[(start + offset) % values.length]);
    }
    estimates.push(mean(drawn));
  }
  estimates.sort((left, right) => left - right);
  return estimates[Math.max(0, Math.min(estimates.length - 1, Math.floor(Math.max(0, Math.min(1, alpha)) * estimates.length)))] ?? null;
}
