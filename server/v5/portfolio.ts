import crypto from 'node:crypto';
import { readDatabase, writeDatabase } from '../storage.js';
import type {
  DatabaseState,
  PortfolioAllocationDecisionV5,
  PortfolioAllocatorPolicyV5,
  PortfolioExposureLineV5,
  PortfolioFactorV5,
  PortfolioLiquidityBucketV5,
  PortfolioRegimeBucketV5,
  PortfolioReservationV5,
  PortfolioRiskSnapshotV5,
} from '../../src/types.js';

const ACTIVE_ORDER_STATUSES = new Set([
  'PENDING',
  'RISK_ACCEPTED',
  'BROKER_PENDING',
  'PARTIALLY_FILLED',
  'UNRESOLVED',
]);

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function rounded(value: number): number {
  return Number(value.toFixed(8));
}

const POLICY_BODY = {
  authorityVersion: 5 as const,
  schema: 'portfolio-allocator-policy.v5' as const,
  id: 'paper-portfolio-allocator-v5',
  semanticVersion: '5.0.0',
  maximumGrossExposureUsd: 10_000,
  maximumAbsoluteNetExposureUsd: 6_000,
  maximumSymbolGrossExposureUsd: 2_000,
  maximumFamilyGrossExposureUsd: 3_000,
  maximumFactorGrossExposureUsd: 4_000,
  maximumRegimeGrossExposureUsd: 5_000,
  maximumThinLiquidityGrossExposureUsd: 1_000,
  maximumPerpGrossExposureUsd: 5_000,
  maximumAggregateRolling24hLossUsd: 500,
  maximumFamilyRolling24hLossUsd: 200,
  maximumUnresolvedOrders: 4,
  maximumInformationUnits: 40,
  maximumFamilyInformationUnits: 12,
  informationUnitNotionalUsd: 250,
  maximumDailyVolumeParticipationRate: 0.0001,
  unboundReservationLeaseMs: 60_000,
  liveExecution: 'locked' as const,
};

export const DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5: PortfolioAllocatorPolicyV5 = {
  ...POLICY_BODY,
  policyHash: digest(POLICY_BODY),
};

function store(db: DatabaseState) {
  const current = (db.portfolioAllocatorV5 ||= {
    policy: DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5,
    reservations: {},
    decisions: [],
  });
  if (current.policy.policyHash !== DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5.policyHash
    || digest({
      authorityVersion: current.policy.authorityVersion,
      schema: current.policy.schema,
      id: current.policy.id,
      semanticVersion: current.policy.semanticVersion,
      maximumGrossExposureUsd: current.policy.maximumGrossExposureUsd,
      maximumAbsoluteNetExposureUsd: current.policy.maximumAbsoluteNetExposureUsd,
      maximumSymbolGrossExposureUsd: current.policy.maximumSymbolGrossExposureUsd,
      maximumFamilyGrossExposureUsd: current.policy.maximumFamilyGrossExposureUsd,
      maximumFactorGrossExposureUsd: current.policy.maximumFactorGrossExposureUsd,
      maximumRegimeGrossExposureUsd: current.policy.maximumRegimeGrossExposureUsd,
      maximumThinLiquidityGrossExposureUsd: current.policy.maximumThinLiquidityGrossExposureUsd,
      maximumPerpGrossExposureUsd: current.policy.maximumPerpGrossExposureUsd,
      maximumAggregateRolling24hLossUsd: current.policy.maximumAggregateRolling24hLossUsd,
      maximumFamilyRolling24hLossUsd: current.policy.maximumFamilyRolling24hLossUsd,
      maximumUnresolvedOrders: current.policy.maximumUnresolvedOrders,
      maximumInformationUnits: current.policy.maximumInformationUnits,
      maximumFamilyInformationUnits: current.policy.maximumFamilyInformationUnits,
      informationUnitNotionalUsd: current.policy.informationUnitNotionalUsd,
      maximumDailyVolumeParticipationRate: current.policy.maximumDailyVolumeParticipationRate,
      unboundReservationLeaseMs: current.policy.unboundReservationLeaseMs,
      liveExecution: current.policy.liveExecution,
    }) !== DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5.policyHash) {
    throw new Error('PORTFOLIO_ALLOCATOR_POLICY_IMMUTABLE');
  }
  return current;
}

export function portfolioFactorV5(family: string): PortfolioFactorV5 {
  const normalized = family.toLowerCase();
  if (normalized.includes('momentum') || normalized.includes('golden_cross') || normalized.includes('trend')) return 'trend';
  if (normalized.includes('mean_reversion') || normalized.includes('rsi') || normalized.includes('grid')) return 'mean_reversion';
  if (normalized.includes('carry') || normalized.includes('funding')) return 'carry';
  return 'other';
}

export function portfolioRegimeBucketV5(regime: string): PortfolioRegimeBucketV5 {
  const normalized = regime.toLowerCase();
  if (normalized.includes('trend') || normalized.includes('momentum') || normalized.includes('bull') || normalized.includes('cross')) return 'trend';
  if (normalized.includes('mean') || normalized.includes('reversion') || normalized.includes('range') || normalized.includes('oversold') || normalized.includes('grid')) return 'mean_reverting';
  if (normalized.includes('carry') || normalized.includes('funding')) return 'carry';
  return 'other';
}

export function portfolioLiquidityBucketV5(dailyVolumeUsd: number): PortfolioLiquidityBucketV5 {
  if (dailyVolumeUsd >= 1_000_000_000) return 'deep';
  if (dailyVolumeUsd >= 100_000_000) return 'standard';
  return 'thin';
}

function instrumentForTrade(tradeType: 'token' | 'perp'): 'spot' | 'perp' {
  return tradeType === 'perp' ? 'perp' : 'spot';
}

function reconcileInPlace(db: DatabaseState, now: number): number {
  const ledger = store(db);
  let changed = 0;
  for (const reservation of Object.values(ledger.reservations)) {
    if (reservation.status === 'reserved') {
      if (now - reservation.createdAt > ledger.policy.unboundReservationLeaseMs) {
        reservation.status = 'released';
        reservation.releasedReason = 'UNBOUND_RESERVATION_LEASE_EXPIRED';
        reservation.updatedAt = now;
        changed += 1;
      }
      continue;
    }
    if (reservation.status !== 'bound' || !reservation.intentId) continue;
    const intent = db.orderIntentsV5?.[reservation.intentId];
    if (!intent) {
      reservation.status = 'released';
      reservation.releasedReason = 'BOUND_INTENT_MISSING';
      reservation.updatedAt = now;
      changed += 1;
    } else if (intent.status === 'EXECUTED') {
      reservation.status = 'converted';
      reservation.updatedAt = now;
      changed += 1;
    } else if (intent.status === 'REJECTED' || intent.status === 'EXPIRED') {
      reservation.status = 'released';
      reservation.releasedReason = `ORDER_${intent.status}`;
      reservation.updatedAt = now;
      changed += 1;
    }
  }
  ledger.lastReconciledAt = now;
  return changed;
}

function positionExposures(db: DatabaseState): PortfolioExposureLineV5[] {
  const grouped = new Map<string, {
    experimentId: string;
    agentId: string;
    symbol: string;
    signedSize: number;
    price: number;
    tradeType: 'token' | 'perp';
    latestAt: number;
    regime: string;
  }>();
  for (const trade of db.trades) {
    if (!trade.experimentId) continue;
    const key = `${trade.experimentId}:${trade.agentId}:${trade.assetSymbol}`;
    const current = grouped.get(key) || {
      experimentId: trade.experimentId,
      agentId: trade.agentId,
      symbol: trade.assetSymbol,
      signedSize: 0,
      price: trade.referencePrice || trade.price,
      tradeType: trade.tradeType,
      latestAt: 0,
      regime: trade.thesis?.regime || 'other',
    };
    current.signedSize += (trade.side === 'buy' || trade.side === 'long' ? 1 : -1) * trade.size;
    if (trade.timestamp >= current.latestAt) {
      current.latestAt = trade.timestamp;
      current.price = trade.referencePrice || trade.price;
      current.regime = trade.thesis?.regime || current.regime;
    }
    grouped.set(key, current);
  }
  const reservations = Object.values(db.portfolioAllocatorV5?.reservations || {});
  return [...grouped.values()].flatMap((position): PortfolioExposureLineV5[] => {
    if (Math.abs(position.signedSize) <= 1e-9 || !(position.price > 0)) return [];
    const spec = db.experimentsV5?.specs[position.experimentId];
    const matchingReservation = reservations
      .filter((item) => item.experimentId === position.experimentId && item.symbol === position.symbol)
      .sort((left, right) => right.createdAt - left.createdAt)[0];
    const family = spec?.family || matchingReservation?.family || 'unknown';
    const signedNotionalUsd = position.signedSize * position.price;
    return [{
      source: 'position',
      experimentId: position.experimentId,
      strategyHash: spec?.strategyHash || matchingReservation?.strategyHash || 'unknown',
      agentId: position.agentId,
      symbol: position.symbol,
      family,
      factor: matchingReservation?.factor || portfolioFactorV5(family),
      regime: matchingReservation?.regime || portfolioRegimeBucketV5(position.regime),
      liquidityBucket: matchingReservation?.liquidityBucket || 'standard',
      instrument: instrumentForTrade(position.tradeType),
      signedNotionalUsd: rounded(signedNotionalUsd),
      grossNotionalUsd: rounded(Math.abs(signedNotionalUsd)),
      informationKey: `${position.experimentId}:${position.symbol}`,
    }];
  });
}

function pendingExposures(db: DatabaseState, now: number): PortfolioExposureLineV5[] {
  const ledger = store(db);
  return Object.values(ledger.reservations).flatMap((reservation): PortfolioExposureLineV5[] => {
    if (reservation.positionEffect === 'reduce') return [];
    if (reservation.status === 'reserved') {
      if (now - reservation.createdAt > ledger.policy.unboundReservationLeaseMs) return [];
    } else if (reservation.status === 'bound') {
      const intent = reservation.intentId ? db.orderIntentsV5?.[reservation.intentId] : undefined;
      if (!intent || !ACTIVE_ORDER_STATUSES.has(intent.status)) return [];
    } else {
      return [];
    }
    const intent = reservation.intentId ? db.orderIntentsV5?.[reservation.intentId] : undefined;
    const remainingRatio = intent && intent.size > 0
      ? Math.max(0, Math.min(1, Number(intent.remainingSize ?? intent.size) / intent.size))
      : 1;
    const grossNotionalUsd = reservation.authorizedNotionalUsd * remainingRatio;
    const sign = reservation.side === 'buy' || reservation.side === 'long' ? 1 : -1;
    const instrument = intent
      ? instrumentForTrade(intent.tradeType)
      : db.experimentsV5?.specs[reservation.experimentId]?.instrument === 'perp' ? 'perp' : 'spot';
    return [{
      source: 'pending',
      experimentId: reservation.experimentId,
      strategyHash: reservation.strategyHash,
      agentId: reservation.agentId,
      symbol: reservation.symbol,
      family: reservation.family,
      factor: reservation.factor,
      regime: reservation.regime,
      liquidityBucket: reservation.liquidityBucket,
      instrument,
      signedNotionalUsd: rounded(sign * grossNotionalUsd),
      grossNotionalUsd: rounded(grossNotionalUsd),
      informationKey: `${reservation.experimentId}:${reservation.symbol}`,
      intentId: reservation.intentId,
      reservationId: reservation.reservationId,
    }];
  });
}

function totals(lines: PortfolioExposureLineV5[], key: keyof Pick<PortfolioExposureLineV5,
  'symbol' | 'family' | 'factor' | 'regime' | 'liquidityBucket' | 'instrument'>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of lines) result[String(line[key])] = rounded((result[String(line[key])] || 0) + line.grossNotionalUsd);
  return result;
}

function rollingRealizedPnl(db: DatabaseState, now: number): { total: number; byFamily: Record<string, number> } {
  const cutoff = now - 24 * 60 * 60_000;
  const byFamily: Record<string, number> = {};
  let total = 0;
  for (const trade of db.trades) {
    if (!trade.experimentId || trade.timestamp < cutoff || trade.timestamp > now) continue;
    const pnl = typeof trade.pnl === 'number' ? trade.pnl : -(trade.feeUsd || 0);
    const family = db.experimentsV5?.specs[trade.experimentId]?.family || trade.thesis?.signalFamily || 'unknown';
    total += pnl;
    byFamily[family] = (byFamily[family] || 0) + pnl;
  }
  return {
    total: rounded(total),
    byFamily: Object.fromEntries(Object.entries(byFamily).map(([family, pnl]) => [family, rounded(pnl)])),
  };
}

function buildSnapshot(db: DatabaseState, now: number): PortfolioRiskSnapshotV5 {
  const policy = store(db).policy;
  const exposures = [...positionExposures(db), ...pendingExposures(db, now)]
    .sort((left, right) => `${left.source}:${left.experimentId}:${left.symbol}:${left.reservationId || ''}`
      .localeCompare(`${right.source}:${right.experimentId}:${right.symbol}:${right.reservationId || ''}`));
  const informationGross = new Map<string, { family: string; gross: number }>();
  for (const line of exposures) {
    const current = informationGross.get(line.informationKey) || { family: line.family, gross: 0 };
    current.gross += line.grossNotionalUsd;
    informationGross.set(line.informationKey, current);
  }
  const informationUnits = [...informationGross.values()].reduce((sum, item) =>
    sum + Math.ceil(item.gross / policy.informationUnitNotionalUsd), 0);
  const familyInformationUnits: Record<string, number> = {};
  for (const item of informationGross.values()) {
    familyInformationUnits[item.family] = (familyInformationUnits[item.family] || 0)
      + Math.ceil(item.gross / policy.informationUnitNotionalUsd);
  }
  const realized = rollingRealizedPnl(db, now);
  const body = {
    authorityVersion: 5 as const,
    schema: 'portfolio-risk-snapshot.v5' as const,
    policyId: policy.id,
    generatedAt: now,
    grossExposureUsd: rounded(exposures.reduce((sum, line) => sum + line.grossNotionalUsd, 0)),
    netExposureUsd: rounded(exposures.reduce((sum, line) => sum + line.signedNotionalUsd, 0)),
    openGrossExposureUsd: rounded(exposures.filter((line) => line.source === 'position').reduce((sum, line) => sum + line.grossNotionalUsd, 0)),
    pendingGrossExposureUsd: rounded(exposures.filter((line) => line.source === 'pending').reduce((sum, line) => sum + line.grossNotionalUsd, 0)),
    unresolvedOrders: Object.values(db.orderIntentsV5 || {}).filter((intent) => intent.experimentId && intent.status === 'UNRESOLVED').length,
    rolling24hPostCostRealizedPnlUsd: realized.total,
    familyRolling24hPostCostRealizedPnlUsd: realized.byFamily,
    informationUnits,
    familyInformationUnits,
    symbolGrossExposureUsd: totals(exposures, 'symbol'),
    familyGrossExposureUsd: totals(exposures, 'family'),
    factorGrossExposureUsd: totals(exposures, 'factor'),
    regimeGrossExposureUsd: totals(exposures, 'regime'),
    liquidityGrossExposureUsd: totals(exposures, 'liquidityBucket'),
    instrumentGrossExposureUsd: totals(exposures, 'instrument'),
    exposures,
    liveExecution: 'locked' as const,
  };
  return { ...body, snapshotHash: digest(body) };
}

export interface PortfolioReservationRequestV5 {
  userId: string;
  agentId: string;
  experimentId: string;
  strategyHash: string;
  opportunityObservationId: string;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  positionEffect: 'increase' | 'reduce';
  requestedSize: number;
  referencePrice: number;
  requestedNotionalUsd: number;
  family: string;
  regime: string;
  dailyVolumeUsd: number;
}

export function reservePortfolioRiskV5(
  raw: PortfolioReservationRequestV5,
  now = Date.now(),
): { accepted: boolean; reservation: PortfolioReservationV5; decision: PortfolioAllocationDecisionV5 } {
  const request = {
    ...raw,
    symbol: raw.symbol.toUpperCase(),
    family: raw.family.trim() || 'unknown',
    requestedSize: Number(raw.requestedSize),
    referencePrice: Number(raw.referencePrice),
    requestedNotionalUsd: Number(raw.requestedNotionalUsd),
    dailyVolumeUsd: Number(raw.dailyVolumeUsd),
  };
  const impliedNotionalUsd = request.requestedSize * request.referencePrice;
  if (!(request.requestedSize > 0)
    || !(request.referencePrice > 0)
    || !(request.requestedNotionalUsd > 0)
    || Math.abs(impliedNotionalUsd - request.requestedNotionalUsd) > Math.max(0.01, request.requestedNotionalUsd * 1e-6)
    || !(request.dailyVolumeUsd >= 0)) {
    throw new Error('PORTFOLIO_RESERVATION_INPUT_INVALID');
  }
  const db = readDatabase();
  const ledger = store(db);
  reconcileInPlace(db, now);
  const factor = portfolioFactorV5(request.family);
  const regime = portfolioRegimeBucketV5(request.regime);
  const liquidityBucket = portfolioLiquidityBucketV5(request.dailyVolumeUsd);
  const idempotencyKey = `${request.experimentId}:${request.opportunityObservationId}`;
  const reservationId = `portfolio_res_v5_${digest({ idempotencyKey }).slice(0, 24)}`;
  const existing = ledger.reservations[reservationId];
  if (existing) {
    const matches = existing.idempotencyKey === idempotencyKey
      && existing.userId === request.userId
      && existing.agentId === request.agentId
      && existing.strategyHash === request.strategyHash
      && existing.symbol === request.symbol
      && existing.side === request.side
      && existing.positionEffect === request.positionEffect
      && Math.abs(existing.requestedSize - request.requestedSize) <= 1e-9
      && Math.abs(existing.referencePrice - request.referencePrice) <= 1e-9
      && Math.abs(existing.requestedNotionalUsd - request.requestedNotionalUsd) <= 1e-6;
    if (!matches) throw new Error('PORTFOLIO_RESERVATION_IDEMPOTENCY_CONFLICT');
    const decision = [...ledger.decisions].reverse().find((item) => item.reservationId === reservationId);
    if (!decision) throw new Error('PORTFOLIO_RESERVATION_DECISION_MISSING');
    return { accepted: decision.accepted, reservation: existing, decision };
  }

  const snapshot = buildSnapshot(db, now);
  const policy = ledger.policy;
  const reasons: string[] = [];
  const informationKey = `${request.experimentId}:${request.symbol}`;
  const currentInformationGross = snapshot.exposures
    .filter((line) => line.informationKey === informationKey)
    .reduce((sum, line) => sum + line.grossNotionalUsd, 0);
  const currentInformationUnits = Math.ceil(currentInformationGross / policy.informationUnitNotionalUsd);
  const projectedInformationUnits = Math.ceil(
    (currentInformationGross + request.requestedNotionalUsd) / policy.informationUnitNotionalUsd,
  );
  const additionalInformationUnits = Math.max(0, projectedInformationUnits - currentInformationUnits);
  const familyUnits = snapshot.familyInformationUnits[request.family] || 0;
  const sign = request.side === 'buy' || request.side === 'long' ? 1 : -1;
  if (request.positionEffect === 'increase') {
    if (snapshot.grossExposureUsd + request.requestedNotionalUsd > policy.maximumGrossExposureUsd + 1e-9) reasons.push('PORTFOLIO_GROSS_CAP');
    if (Math.abs(snapshot.netExposureUsd + sign * request.requestedNotionalUsd) > policy.maximumAbsoluteNetExposureUsd + 1e-9) reasons.push('PORTFOLIO_NET_CAP');
    if ((snapshot.symbolGrossExposureUsd[request.symbol] || 0) + request.requestedNotionalUsd > policy.maximumSymbolGrossExposureUsd + 1e-9) reasons.push('PORTFOLIO_SYMBOL_CAP');
    if ((snapshot.familyGrossExposureUsd[request.family] || 0) + request.requestedNotionalUsd > policy.maximumFamilyGrossExposureUsd + 1e-9) reasons.push('PORTFOLIO_FAMILY_CAP');
    if ((snapshot.factorGrossExposureUsd[factor] || 0) + request.requestedNotionalUsd > policy.maximumFactorGrossExposureUsd + 1e-9) reasons.push('PORTFOLIO_FACTOR_CAP');
    if ((snapshot.regimeGrossExposureUsd[regime] || 0) + request.requestedNotionalUsd > policy.maximumRegimeGrossExposureUsd + 1e-9) reasons.push('PORTFOLIO_REGIME_CAP');
    if (liquidityBucket === 'thin'
      && (snapshot.liquidityGrossExposureUsd.thin || 0) + request.requestedNotionalUsd > policy.maximumThinLiquidityGrossExposureUsd + 1e-9) reasons.push('PORTFOLIO_THIN_LIQUIDITY_CAP');
    if ((request.side === 'long' || request.side === 'short')
      && (snapshot.instrumentGrossExposureUsd.perp || 0) + request.requestedNotionalUsd > policy.maximumPerpGrossExposureUsd + 1e-9) reasons.push('PORTFOLIO_PERP_CAP');
    if (snapshot.unresolvedOrders >= policy.maximumUnresolvedOrders) reasons.push('PORTFOLIO_UNRESOLVED_ORDER_CAP');
    if (snapshot.rolling24hPostCostRealizedPnlUsd <= -policy.maximumAggregateRolling24hLossUsd) reasons.push('PORTFOLIO_ROLLING_24H_LOSS_CAP');
    if ((snapshot.familyRolling24hPostCostRealizedPnlUsd[request.family] || 0) <= -policy.maximumFamilyRolling24hLossUsd) reasons.push('PORTFOLIO_FAMILY_ROLLING_24H_LOSS_CAP');
    if (snapshot.informationUnits + additionalInformationUnits > policy.maximumInformationUnits) reasons.push('PORTFOLIO_INFORMATION_BUDGET');
    if (familyUnits + additionalInformationUnits > policy.maximumFamilyInformationUnits) reasons.push('PORTFOLIO_FAMILY_INFORMATION_BUDGET');
    if (request.requestedNotionalUsd > request.dailyVolumeUsd * policy.maximumDailyVolumeParticipationRate + 1e-9) reasons.push('PORTFOLIO_LIQUIDITY_PARTICIPATION_CAP');
  } else {
    reasons.push('REDUCTION_PRIORITY');
  }
  const accepted = request.positionEffect === 'reduce' || reasons.length === 0;
  const reservation: PortfolioReservationV5 = {
    authorityVersion: 5,
    schema: 'portfolio-reservation.v5',
    reservationId,
    idempotencyKey,
    policyId: policy.id,
    policyHash: policy.policyHash,
    userId: request.userId,
    agentId: request.agentId,
    experimentId: request.experimentId,
    strategyHash: request.strategyHash,
    opportunityObservationId: request.opportunityObservationId,
    symbol: request.symbol,
    side: request.side,
    positionEffect: request.positionEffect,
    requestedSize: request.requestedSize,
    referencePrice: request.referencePrice,
    requestedNotionalUsd: rounded(request.requestedNotionalUsd),
    authorizedNotionalUsd: accepted ? rounded(request.requestedNotionalUsd) : 0,
    family: request.family,
    factor,
    regime,
    liquidityBucket,
    dailyVolumeUsd: request.dailyVolumeUsd,
    informationUnits: accepted && request.positionEffect === 'increase' ? additionalInformationUnits : 0,
    status: accepted ? 'reserved' : 'denied',
    reasons: accepted && request.positionEffect === 'increase' ? ['PORTFOLIO_LIMITS_PASSED'] : reasons,
    snapshotHash: snapshot.snapshotHash,
    createdAt: now,
    updatedAt: now,
  };
  const decision: PortfolioAllocationDecisionV5 = {
    authorityVersion: 5,
    schema: 'portfolio-allocation-decision.v5',
    decisionId: `portfolio_decision_v5_${digest({ reservationId, accepted, reasons, now }).slice(0, 24)}`,
    reservationId,
    experimentId: request.experimentId,
    opportunityObservationId: request.opportunityObservationId,
    accepted,
    requestedNotionalUsd: reservation.requestedNotionalUsd,
    authorizedNotionalUsd: reservation.authorizedNotionalUsd,
    positionEffect: request.positionEffect,
    reasons: reservation.reasons,
    snapshotBeforeHash: snapshot.snapshotHash,
    policyHash: policy.policyHash,
    decidedAt: now,
  };
  ledger.reservations[reservationId] = reservation;
  ledger.decisions.push(decision);
  if (ledger.decisions.length > 20_000) ledger.decisions.splice(0, ledger.decisions.length - 20_000);
  writeDatabase(db);
  return { accepted, reservation, decision };
}

export function releasePortfolioReservationV5(reservationId: string, reason: string, now = Date.now()): void {
  const db = readDatabase();
  const reservation = store(db).reservations[reservationId];
  if (!reservation || reservation.status === 'released' || reservation.status === 'denied' || reservation.status === 'converted') return;
  reservation.status = 'released';
  reservation.releasedReason = reason.slice(0, 500);
  reservation.updatedAt = now;
  writeDatabase(db);
}

export function reconcilePortfolioReservationsV5(now = Date.now()): { inspected: number; changed: number } {
  const db = readDatabase();
  const ledger = store(db);
  const inspected = Object.keys(ledger.reservations).length;
  const changed = reconcileInPlace(db, now);
  writeDatabase(db);
  return { inspected, changed };
}

export function portfolioAllocatorSnapshotV5(now = Date.now()) {
  const db = readDatabase();
  const ledger = store(db);
  return {
    mode: 'Paper money',
    liveExecution: 'locked',
    policy: ledger.policy,
    risk: buildSnapshot(db, now),
    reservations: Object.values(ledger.reservations).slice(-500).reverse(),
    decisions: ledger.decisions.slice(-500).reverse(),
    lastReconciledAt: ledger.lastReconciledAt || null,
  };
}

const RECONCILE_MS = Math.max(1_000, Number(process.env.PORTFOLIO_RECONCILE_INTERVAL_MS) || 5_000);
let lastCompletedAt: number | null = null;
let reconcilerStarted = false;

export function runPortfolioAllocatorReconcilerOnceV5(now = Date.now()) {
  const result = reconcilePortfolioReservationsV5(now);
  lastCompletedAt = Date.now();
  return result;
}

export function portfolioReconcilerClockV5() {
  return {
    id: 'portfolio_allocator_reconciler_v5',
    cadenceMs: RECONCILE_MS,
    enabled: reconcilerStarted,
    lastCompletedAt,
  };
}

export function startPortfolioAllocatorReconcilerV5(): void {
  if (reconcilerStarted) return;
  reconcilerStarted = true;
  const run = () => {
    try {
      runPortfolioAllocatorReconcilerOnceV5(Date.now());
    } catch (error: any) {
      console.warn('[portfolio-allocator-v5] reconciliation failed:', error?.message || String(error));
    }
  };
  run();
  setInterval(run, RECONCILE_MS).unref();
  console.log(`[portfolio-allocator-v5] durable paper portfolio authority every ${RECONCILE_MS}ms — live locked`);
}
