import { contentHash } from './store.js';
import type { ForwardObservation } from './flywheel_types.js';

export interface PredictionSnapshotRow {
  t: number;
  id: string;
  prices: number[];
  endDate?: string | null;
}

export interface PredictionResolutionRow {
  t: number;
  id: string;
  prices: number[];
  resolvedAt?: number | null;
  resolutionStatus?: string | null;
}

function binaryOutcome(prices: number[]): number | null {
  if (prices.length !== 2 || prices.some((value) => !Number.isFinite(value))) return null;
  if (prices[0] >= 0.999 && prices[1] <= 0.001) return 1;
  if (prices[1] >= 0.999 && prices[0] <= 0.001) return 0;
  return null;
}

export function buildPredictionForwardObservations(input: {
  snapshots: PredictionSnapshotRow[];
  resolutions: PredictionResolutionRow[];
  candidateHash: string;
  trialId: string;
  now?: number;
  expiryGraceMs?: number;
}): ForwardObservation[] {
  const now = input.now ?? Date.now();
  const expiryGraceMs = input.expiryGraceMs ?? 30 * 86_400_000;
  const first = new Map<string, PredictionSnapshotRow>();
  for (const row of [...input.snapshots].sort((a, b) => a.t - b.t)) {
    const p = Number(row.prices?.[0]);
    if (!first.has(String(row.id)) && p >= 0 && p <= 1) first.set(String(row.id), row);
  }
  const resolved = new Map<string, PredictionResolutionRow>();
  for (const row of [...input.resolutions].sort((a, b) => a.t - b.t)) {
    if (row.resolutionStatus === 'resolved' && binaryOutcome(row.prices) != null) resolved.set(String(row.id), row);
  }
  return [...first.values()].map((row) => {
    const resolution = resolved.get(String(row.id));
    const realizedValue = resolution ? binaryOutcome(resolution.prices) : null;
    const contractualEnd = row.endDate ? Date.parse(row.endDate) : NaN;
    const resolveAt = resolution?.resolvedAt && Number.isFinite(resolution.resolvedAt) ? resolution.resolvedAt
      : Number.isFinite(contractualEnd) ? contractualEnd : row.t + expiryGraceMs;
    const status: ForwardObservation['status'] = realizedValue != null ? 'resolved'
      : Number.isFinite(contractualEnd) && now > contractualEnd + expiryGraceMs ? 'expired' : 'pending';
    const payload = { candidateHash: input.candidateHash, marketId: String(row.id), forecastAt: row.t,
      predictedValue: Number(row.prices[0]), status, realizedValue };
    return {
      id: `forward_prediction_${contentHash(payload).slice(0, 20)}`,
      trialId: input.trialId,
      candidateHash: input.candidateHash,
      lane: 'prediction_markets',
      kind: 'calibration_forecast',
      forecastAt: row.t,
      resolveAt,
      status,
      predictedValue: Number(row.prices[0]),
      realizedValue,
      netPaperPnlBps: null,
      executionQuality: null,
    };
  });
}
