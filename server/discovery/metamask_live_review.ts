import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { EvidenceMode, PaperLifecycleState, PaperTradeContract, PaperTradeLifecycleEvidence } from './economic_types.js';
import { readJsonlTolerant } from './jsonl_recovery.js';

export const LIVE_REVIEW_CONFIRMATION = 'I AUTHORIZE THIS EXACT REVIEWED TRADE';
export const LIVE_REVIEW_PREPARATION_TTL_MS = 2 * 60_000;
export const LIVE_REVIEW_AUTHORIZATION_TTL_MS = 2 * 60_000;

export function liveExecutionRuntimeEnabled(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.LIVE_EXECUTION_ENABLED === 'true' && environment.LIVE_REVIEW_EXECUTION_CERTIFIED === 'true';
}

export interface MetaMaskReadinessCheck {
  id: string;
  status: 'ready' | 'blocked' | 'unknown';
  summary: string;
}

export interface LiveReviewTradeRequest {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  orderType: 'market';
}

export interface LiveReviewPreparation {
  id: string;
  schemaVersion: 1;
  packetDigest: string;
  contractId: string;
  candidateId: string;
  userId: string;
  lifecycleState: PaperLifecycleState;
  signal: {
    decisionId: string;
    evidenceMode: EvidenceMode;
    decidedAt: number;
    expiresAt: number;
    sourceEventIds: string[];
    symbol: string;
    side: 'long' | 'short';
  };
  venue: 'hyperliquid';
  trade: LiveReviewTradeRequest;
  quote: {
    quoteReference: string;
    quotedAt: number;
    quoteLatencyMs: number;
    notionalUsd: number;
    entryPrice: number | null;
    estimatedFeeUsd: number | null;
    estimatedLiquidationPrice: number | null;
  };
  executionBounds: {
    maximumNotionalUsd: number;
    maximumFeeUsd: number;
    referenceEntryPrice: number | null;
    maximumSlippageBps: number;
  };
  contractLimits: {
    deployableUsd: number;
    maximumPositionUsd: number;
    maximumLossPerTradeUsd: number;
    maximumStrategyDrawdownUsd: number;
    killRule: PaperTradeContract['killRule'];
  };
  evidence: {
    evidenceCutoffAt: number;
    edgeHalfLifeMs: number;
    lowerBoundNetEdgeBps: number | null;
    costStressedNetEdgeLowerBoundBps: number | null;
    untouchedForwardSamples: number;
    fundedPaperSamples: number;
    sourceObservationIds: string[];
  };
  readinessChecks: MetaMaskReadinessCheck[];
  blockers: string[];
  executableAfterHumanApproval: boolean;
  preparedAt: number;
  expiresAt: number;
  liveExecution: 'locked_until_explicit_runtime_authorization';
}

export interface LiveReviewAuthorization {
  id: string;
  schemaVersion: 1;
  packetDigest: string;
  preparationId: string;
  contractId: string;
  signalId: string;
  quoteReference: string;
  userId: string;
  trade: LiveReviewTradeRequest;
  executionBounds: LiveReviewPreparation['executionBounds'];
  approvedAt: number;
  expiresAt: number;
  confirmation: typeof LIVE_REVIEW_CONFIRMATION;
  oneTime: true;
  state: 'approved';
}

export interface LiveReviewExecutionState {
  id: string;
  schemaVersion: 1;
  authorizationId: string;
  state: 'approved' | 'reserved' | 'consumed' | 'failed' | 'cancelled';
  at: number;
  executionReference: string | null;
  failureReason: string | null;
}

export interface ExecutionAuthorization extends Omit<LiveReviewAuthorization, 'state'> {
  atomicState: LiveReviewExecutionState['state'];
  executionReference: string | null;
  failureReason: string | null;
}

export interface LiveReviewConsumption {
  id: string;
  schemaVersion: 1;
  authorizationId: string;
  packetDigest: string;
  contractId: string;
  userId: string;
  consumedAt: number;
  executionReference: string;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}

function normalizedSymbol(contract: PaperTradeContract, requested: string): string {
  const fromContract = contract.instrument.toUpperCase().replace(/[-_/]?(PERP|USD|USDC|USDT)$/i, '');
  const symbol = requested.trim().toUpperCase();
  if (!symbol || symbol !== fromContract) throw new Error('LIVE_REVIEW_SYMBOL_CONTRACT_MISMATCH');
  return symbol;
}

export function buildLiveReviewPreparation(input: {
  contract: PaperTradeContract;
  lifecycleState: PaperLifecycleState;
  userId: string;
  trade: LiveReviewTradeRequest;
  signal: LiveReviewPreparation['signal'];
  promotionEvidence: PaperTradeLifecycleEvidence;
  quote: LiveReviewPreparation['quote'];
  readinessChecks: MetaMaskReadinessCheck[];
  now?: number;
}): LiveReviewPreparation {
  const now = input.now ?? Date.now();
  const contract = input.contract;
  const trade: LiveReviewTradeRequest = {
    symbol: normalizedSymbol(contract, input.trade.symbol),
    side: input.trade.side,
    size: input.trade.size,
    leverage: input.trade.leverage,
    orderType: 'market',
  };
  if (!Number.isFinite(trade.size) || trade.size <= 0) throw new Error('LIVE_REVIEW_INVALID_SIZE');
  if (!Number.isFinite(trade.leverage) || trade.leverage < 1 || trade.leverage > 20) throw new Error('LIVE_REVIEW_INVALID_LEVERAGE');
  if (contract.side !== 'both' && contract.side !== trade.side) throw new Error('LIVE_REVIEW_SIDE_CONTRACT_MISMATCH');
  if (contract.venue.toLowerCase() !== 'hyperliquid') throw new Error('LIVE_REVIEW_UNSUPPORTED_VENUE');
  if (contract.executionPolicy !== 'taker_market') throw new Error('LIVE_REVIEW_EXECUTION_POLICY_MISMATCH');
  if (!input.signal.decisionId || !input.signal.sourceEventIds.length) throw new Error('LIVE_REVIEW_FRESH_SIGNAL_PROVENANCE_MISSING');
  if (input.signal.evidenceMode !== 'paper_forward') throw new Error('LIVE_REVIEW_SIGNAL_NOT_PAPER_FORWARD');
  if (input.signal.decidedAt <= contract.evidenceCutoffAt) throw new Error('LIVE_REVIEW_SIGNAL_NOT_FORWARD_ONLY');
  if (input.signal.symbol.toUpperCase() !== trade.symbol || input.signal.side !== trade.side) {
    throw new Error('LIVE_REVIEW_TRADE_DOES_NOT_MATCH_FRESH_SIGNAL');
  }

  const blockers: string[] = [];
  if (input.lifecycleState !== 'live_review') blockers.push('CONTRACT_NOT_IN_LIVE_REVIEW');
  if (input.promotionEvidence.forwardNetEdgeLowerBoundBps == null || input.promotionEvidence.forwardNetEdgeLowerBoundBps <= 0) {
    blockers.push('POSITIVE_FORWARD_EDGE_LOWER_BOUND_MISSING');
  }
  if (input.promotionEvidence.costStressedNetEdgeLowerBoundBps == null
    || input.promotionEvidence.costStressedNetEdgeLowerBoundBps <= 0) blockers.push('POSITIVE_COST_STRESSED_EDGE_MISSING');
  if (!input.promotionEvidence.sourceObservationIds.length) blockers.push('PROMOTION_EVIDENCE_PROVENANCE_MISSING');
  if (!Number.isFinite(input.quote.notionalUsd) || input.quote.notionalUsd <= 0) blockers.push('QUOTE_NOTIONAL_UNAVAILABLE');
  const maximumAuthorizedUsd = Math.min(contract.capacity.deployableUsd, contract.riskLimits.maximumPositionUsd);
  if (input.quote.notionalUsd > maximumAuthorizedUsd + 1e-9) blockers.push('QUOTE_EXCEEDS_CONTRACT_POSITION_LIMIT');
  if (input.quote.quotedAt < now - LIVE_REVIEW_PREPARATION_TTL_MS) blockers.push('QUOTE_STALE');
  if (input.signal.expiresAt <= now) blockers.push('FRESH_SIGNAL_EXPIRED');
  if (contract.edgeHalfLifeMs < Math.max(5_000, input.quote.quoteLatencyMs * 3)) {
    blockers.push('EXECUTION_LATENCY_TOO_LARGE_FOR_EDGE_HALF_LIFE');
  }
  for (const check of input.readinessChecks) {
    if (check.id !== 'live_lock' && check.status !== 'ready') blockers.push(`METAMASK_${check.id.toUpperCase()}_${check.status.toUpperCase()}`);
  }

  const core = {
    contractId: contract.id,
    candidateId: contract.candidateId,
    userId: input.userId,
    venue: 'hyperliquid' as const,
    trade,
    signal: input.signal,
    quote: input.quote,
    executionBounds: { maximumNotionalUsd: maximumAuthorizedUsd,
      maximumFeeUsd: Math.max(0.01, Number(input.quote.estimatedFeeUsd ?? 0) * 1.25),
      referenceEntryPrice: input.quote.entryPrice, maximumSlippageBps: 50 },
    evidenceCutoffAt: contract.evidenceCutoffAt,
    promotionEvidence: {
      forwardNetEdgeLowerBoundBps: input.promotionEvidence.forwardNetEdgeLowerBoundBps,
      costStressedNetEdgeLowerBoundBps: input.promotionEvidence.costStressedNetEdgeLowerBoundBps,
      fundedPaperSamples: input.promotionEvidence.fundedPaperSamples,
      sourceObservationIds: input.promotionEvidence.sourceObservationIds,
    },
    killRule: contract.killRule,
    preparedAt: now,
    expiresAt: Math.min(now + LIVE_REVIEW_PREPARATION_TTL_MS, input.signal.expiresAt),
  };
  const packetDigest = digest(core);
  return {
    id: `lrp_${packetDigest.slice(0, 24)}`,
    schemaVersion: 1,
    packetDigest,
    contractId: contract.id,
    candidateId: contract.candidateId,
    userId: input.userId,
    lifecycleState: input.lifecycleState,
    signal: input.signal,
    venue: 'hyperliquid',
    trade,
    quote: input.quote,
    executionBounds: core.executionBounds,
    contractLimits: {
      deployableUsd: contract.capacity.deployableUsd,
      maximumPositionUsd: contract.riskLimits.maximumPositionUsd,
      maximumLossPerTradeUsd: contract.riskLimits.maximumLossPerTradeUsd,
      maximumStrategyDrawdownUsd: contract.riskLimits.maximumStrategyDrawdownUsd,
      killRule: contract.killRule,
    },
    evidence: {
      evidenceCutoffAt: contract.evidenceCutoffAt,
      edgeHalfLifeMs: contract.edgeHalfLifeMs,
      lowerBoundNetEdgeBps: input.promotionEvidence.forwardNetEdgeLowerBoundBps,
      costStressedNetEdgeLowerBoundBps: input.promotionEvidence.costStressedNetEdgeLowerBoundBps,
      untouchedForwardSamples: input.promotionEvidence.untouchedForwardSamples,
      fundedPaperSamples: input.promotionEvidence.fundedPaperSamples,
      sourceObservationIds: input.promotionEvidence.sourceObservationIds,
    },
    readinessChecks: input.readinessChecks,
    blockers: [...new Set(blockers)],
    executableAfterHumanApproval: blockers.length === 0,
    preparedAt: now,
    expiresAt: core.expiresAt,
    liveExecution: 'locked_until_explicit_runtime_authorization',
  };
}

function append(file: string, row: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`);
}

export class MetaMaskLiveReviewStore {
  private readonly preparationsFile: string;
  private readonly authorizationsFile: string;
  private readonly consumptionsFile: string;
  private readonly executionStatesFile: string;
  private readonly locksRoot: string;
  private readonly quarantineRoot: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'live-review')) {
    this.preparationsFile = path.join(root, 'preparations.jsonl');
    this.authorizationsFile = path.join(root, 'authorizations.jsonl');
    this.consumptionsFile = path.join(root, 'consumptions.jsonl');
    this.executionStatesFile = path.join(root, 'execution-states.jsonl');
    this.locksRoot = path.join(root, 'locks');
    this.quarantineRoot = path.join(root, 'quarantine');
  }
  appendPreparation(row: LiveReviewPreparation): void {
    if (this.readPreparations().some((item) => item.id === row.id)) return;
    append(this.preparationsFile, row);
  }
  authorize(input: { preparationId: string; packetDigest: string; userId: string; confirmation: string; now?: number }): LiveReviewAuthorization {
    return this.withAuthorizationLock(`preparation_${input.preparationId}`, () => {
      const now = input.now ?? Date.now();
      const preparation = this.readPreparations().find((row) => row.id === input.preparationId);
      if (!preparation || preparation.userId !== input.userId || preparation.packetDigest !== input.packetDigest) {
        throw new Error('LIVE_REVIEW_PREPARATION_NOT_FOUND');
      }
      if (!preparation.executableAfterHumanApproval || preparation.blockers.length) throw new Error('LIVE_REVIEW_PREPARATION_BLOCKED');
      if (preparation.expiresAt <= now) throw new Error('LIVE_REVIEW_PREPARATION_EXPIRED');
      if (input.confirmation !== LIVE_REVIEW_CONFIRMATION) throw new Error('LIVE_REVIEW_EXPLICIT_CONFIRMATION_REQUIRED');
      const existing = this.readAuthorizations().find((row) => row.preparationId === preparation.id && row.userId === input.userId);
      if (existing) return existing;
      const approvalDigest = digest({ preparationId: preparation.id, packetDigest: preparation.packetDigest,
        userId: input.userId, approvedAt: now });
      const row: LiveReviewAuthorization = { id: `lra_${approvalDigest.slice(0, 24)}`, schemaVersion: 1,
        packetDigest: preparation.packetDigest, preparationId: preparation.id, contractId: preparation.contractId,
        signalId: preparation.signal.decisionId, quoteReference: preparation.quote.quoteReference, userId: input.userId,
        trade: preparation.trade, executionBounds: preparation.executionBounds, approvedAt: now,
        expiresAt: Math.min(preparation.expiresAt, now + LIVE_REVIEW_AUTHORIZATION_TTL_MS),
        confirmation: LIVE_REVIEW_CONFIRMATION, oneTime: true, state: 'approved' };
      append(this.authorizationsFile, row);
      this.appendExecutionState({ id: `lrs_${digest({ authorizationId: row.id, state: 'approved', now }).slice(0, 24)}`,
        schemaVersion: 1, authorizationId: row.id, state: 'approved', at: now, executionReference: null, failureReason: null });
      return row;
    });
  }
  validateForConsumption(input: { authorizationId: string; packetDigest: string; userId: string; trade: LiveReviewTradeRequest; now?: number }): LiveReviewAuthorization {
    const now = input.now ?? Date.now();
    const authorization = this.readAuthorizations().find((row) => row.id === input.authorizationId);
    if (!authorization || authorization.userId !== input.userId || authorization.packetDigest !== input.packetDigest) {
      throw new Error('LIVE_REVIEW_AUTHORIZATION_NOT_FOUND');
    }
    if (authorization.expiresAt <= now) throw new Error('LIVE_REVIEW_AUTHORIZATION_EXPIRED');
    if (stable(authorization.trade) !== stable(input.trade)) throw new Error('LIVE_REVIEW_TRADE_MUTATED_AFTER_APPROVAL');
    if (this.readConsumptions().some((row) => row.authorizationId === authorization.id)) throw new Error('LIVE_REVIEW_AUTHORIZATION_ALREADY_USED');
    return authorization;
  }
  private appendExecutionState(row: LiveReviewExecutionState): void { append(this.executionStatesFile, row); }
  readExecutionStates(): LiveReviewExecutionState[] { return readJsonlTolerant(this.executionStatesFile, this.quarantineRoot); }
  private withAuthorizationLock<T>(authorizationId: string, action: () => T): T {
    fs.mkdirSync(this.locksRoot, { recursive: true }); const lock = path.join(this.locksRoot, `${authorizationId}.lock`);
    let handle: number;
    try { handle = fs.openSync(lock, 'wx'); } catch { throw new Error('LIVE_REVIEW_AUTHORIZATION_RESERVATION_BUSY'); }
    try { return action(); } finally { fs.closeSync(handle); try { fs.unlinkSync(lock); } catch { /* already cleared */ } }
  }
  reserveForExecution(input: { authorizationId: string; packetDigest: string; userId: string;
    trade: LiveReviewTradeRequest; now?: number }): LiveReviewExecutionState {
    return this.withAuthorizationLock(input.authorizationId, () => {
      const authorization = this.validateForConsumption(input); const now = input.now ?? Date.now();
      const latest = this.readExecutionStates().filter((row) => row.authorizationId === authorization.id)
        .sort((left, right) => left.at - right.at || left.id.localeCompare(right.id)).at(-1);
      if (!latest || latest.state !== 'approved') throw new Error('LIVE_REVIEW_AUTHORIZATION_TERMINAL_OR_ALREADY_RESERVED');
      const row: LiveReviewExecutionState = { id: `lrs_${digest({ authorizationId: authorization.id,
        state: 'reserved', now }).slice(0, 24)}`, schemaVersion: 1, authorizationId: authorization.id,
        state: 'reserved', at: now, executionReference: null, failureReason: null };
      this.appendExecutionState(row); return row;
    });
  }
  consume(authorization: LiveReviewAuthorization, executionReference: string, now = Date.now(),
    reservationId?: string): LiveReviewConsumption {
    return this.withAuthorizationLock(authorization.id, () => {
      if (this.readConsumptions().some((row) => row.authorizationId === authorization.id)) throw new Error('LIVE_REVIEW_AUTHORIZATION_ALREADY_USED');
      const latest = this.readExecutionStates().filter((row) => row.authorizationId === authorization.id)
        .sort((left, right) => left.at - right.at || left.id.localeCompare(right.id)).at(-1);
      if (!latest || latest.id !== reservationId || latest.state !== 'reserved') throw new Error('LIVE_REVIEW_EXECUTION_RESERVATION_REQUIRED');
      const row: LiveReviewConsumption = { id: `lrc_${digest({ authorizationId: authorization.id, executionReference, now }).slice(0, 24)}`,
        schemaVersion: 1, authorizationId: authorization.id, packetDigest: authorization.packetDigest,
        contractId: authorization.contractId, userId: authorization.userId, consumedAt: now, executionReference };
      append(this.consumptionsFile, row);
      this.appendExecutionState({ id: `lrs_${digest({ authorizationId: authorization.id, state: 'consumed', now,
        executionReference }).slice(0, 24)}`, schemaVersion: 1, authorizationId: authorization.id, state: 'consumed',
        at: now, executionReference, failureReason: null });
      return row;
    });
  }
  failReservation(authorizationId: string, reason: string, now = Date.now()): LiveReviewExecutionState {
    return this.withAuthorizationLock(authorizationId, () => {
      const latest = this.readExecutionStates().filter((row) => row.authorizationId === authorizationId)
        .sort((left, right) => left.at - right.at || left.id.localeCompare(right.id)).at(-1);
      if (latest?.state === 'failed') return latest;
      if (!latest || latest.state !== 'reserved') throw new Error('LIVE_REVIEW_AUTHORIZATION_TERMINAL');
      const row: LiveReviewExecutionState = { id: `lrs_${digest({ authorizationId, state: 'failed', now, reason }).slice(0, 24)}`,
        schemaVersion: 1, authorizationId, state: 'failed', at: now, executionReference: null, failureReason: reason };
      this.appendExecutionState(row); return row;
    });
  }
  readPreparations(): LiveReviewPreparation[] { return readJsonlTolerant(this.preparationsFile, this.quarantineRoot); }
  readAuthorizations(): LiveReviewAuthorization[] { return readJsonlTolerant(this.authorizationsFile, this.quarantineRoot); }
  readConsumptions(): LiveReviewConsumption[] { return readJsonlTolerant(this.consumptionsFile, this.quarantineRoot); }
  snapshot() {
    const preparations = this.readPreparations();
    const authorizations = this.readAuthorizations();
    const consumptions = this.readConsumptions();
    const executionStates = this.readExecutionStates();
    return {
      mode: 'Live review',
      counts: { preparations: preparations.length, authorizations: authorizations.length, consumptions: consumptions.length,
        approved: executionStates.filter((row) => row.state === 'approved').length,
        reserved: executionStates.filter((row) => row.state === 'reserved').length,
        failed: executionStates.filter((row) => row.state === 'failed').length,
        cancelled: executionStates.filter((row) => row.state === 'cancelled').length },
      recentPreparations: preparations.slice(-20).reverse().map((row) => ({ ...row, userId: 'redacted' })),
      integrity: {
        orphanAuthorizationIds: authorizations.filter((row) => !preparations.some((item) => item.id === row.preparationId)).map((row) => row.id),
        orphanConsumptionIds: consumptions.filter((row) => !authorizations.some((item) => item.id === row.authorizationId)).map((row) => row.id),
        reusedAuthorizationIds: [...new Set(consumptions.filter((row, index) => consumptions.findIndex((item) => item.authorizationId === row.authorizationId) !== index)
          .map((row) => row.authorizationId))],
        allExplicitAndOneTime: authorizations.every((row) => row.confirmation === LIVE_REVIEW_CONFIRMATION && row.oneTime),
        allLiveExecutionLocked: !liveExecutionRuntimeEnabled(),
      },
      liveExecution: liveExecutionRuntimeEnabled() ? 'enabled' as const : 'locked' as const,
    };
  }
}
