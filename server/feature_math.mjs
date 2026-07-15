/** Pure feature math shared by live decisions and historical validation. */

export function wilderRsiSeries(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let averageGain = 0;
  let averageLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    averageGain += Math.max(change, 0);
    averageLoss += Math.max(-change, 0);
  }
  averageGain /= period;
  averageLoss /= period;
  out[period] = 100 - 100 / (1 + averageGain / (averageLoss || 1e-9));
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    out[i] = 100 - 100 / (1 + averageGain / (averageLoss || 1e-9));
  }
  return out;
}

export function simpleMovingAverageSeries(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function realizedVolPctPerHour(closes, windowSize = 25) {
  if (closes.length < windowSize) return null;
  const window = closes.slice(-windowSize);
  const returns = window.slice(1).map((value, index) => Math.log(value / window[index]));
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * 100;
}

