import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical, RefreshCw, ShieldOff, Activity, Radio, Layers, Wallet, AlertTriangle, ChevronDown } from 'lucide-react';
import { apiFetch, safeJson } from '../lib/api';

// The edge factory, visible: which strategy families are running, every
// thesis-tagged trade with its reasoning, and what the system DECLINED.
// Everything shown as-is — wins, losses, and restraint alike.

export interface Family {
  key: string; family: string; label: string; experimentId: string | null; cardId: string | null;
  trades: number; closed: number; wins: number; realizedPnl: number; lastTradeAt: number; lastTrigger: string;
  lifecycleState?: string; lifecycleReason?: string; permission?: string; eligibility?: string; health?: string;
  budget?: { admittedNotionalUsd: number; maximumNotionalUsd: number; admittedOrders: number; maximumOrders: number } | null;
  learning?: { trialId: string; disposition: string; promotable: boolean; validOutcomes: number; invalidOutcomes: number; quarantinedOutcomes: number;
    independentEpisodes: number; declaredFamilyTrials: number; meanEvidenceNetBps: number | null;
    meanBenchmarkRelativeBps: number | null; lowerConfidenceNoTradeRelativeBps: number | null;
    cumulativeEvidencePnlUsd: number; continuousBuyHoldControlPnlUsd: number; reasons: string[] } | null;
  authorityVersion?: number | null; legacy?: boolean; strategyHash?: string; specHash?: string; pluginId?: string;
  instrument?: string; version?: number; parentExperimentId?: string | null; regime?: string;
  lastOpportunity?: { observationId: string; disposition: string; reasons: string[]; evaluatedAt: number } | null;
  orders?: { total: number; active: number; unresolved: number; latestStatus: string; latestIntentId: string | null; latestReason: string | null };
  portfolio?: { grossExposureUsd: number; netExposureUsd: number; pendingExposureUsd: number; activeReservations: number;
    deniedReservations: number; lastAllocationReasons: string[]; liveExecution: string };
  lineage?: { experimentId: string; strategyHash: string; specHash: string; trialId: string | null; parentExperimentId: string | null;
    opportunityObservationIds: string[]; reservationIds: string[]; orderIntentIds: string[]; fillIds: string[]; outcomeIds: string[] };
  outcomes?: Array<{ outcomeId: string; symbol: string; classification: string; operationalStatus: string;
    evidencePostCostPnlUsd: number; resolvedAt: number; reasons: string[] }>;
}
interface Recent { t: number; family: string; label: string; experimentId: string | null; variant: string | null; paperPermission: string | null; side: string; size: number; symbol: string; price: number; pnl: number | null; trigger: string; setup: string; authorityVersion?: number | null; legacy?: boolean; }
interface FleetTotals { trades: number; closed: number; realizedPnl: number }
export interface OperatorTruthData {
  mechanics: { status: string; reasons: string[] };
  economics: { status: string; edgeProven: boolean; organicOutcomes: number; reviewCandidates: number };
  deployment: { authorized: boolean; status: string };
  liveExecution: string;
  latestCycle: null | { cycleId: string; organicEvaluated: number; organicRouted: number; assuranceExcluded: number;
    noRouteClassification: string; explanation: string; blockingReasons: Array<{ category: string; reason: string; count: number }> };
  forwardOperation: { totalCheckpoints: number; activeIncidents: Array<{ code: string; severity: string; message: string }>;
    latestCheckpoint: null | { consecutiveZeroRouteCycles: number } };
  latestAcceptanceBundle: null | { bundleId: string; bundleHash: string; generatedAt: number; scope: string };
  boundaries: string[];
}
interface FleetData { families: Family[]; declined: Record<string, number>; recent: Recent[]; totals: FleetTotals; v5Totals: FleetTotals; legacyTotals: FleetTotals; operatorTruth: OperatorTruthData; }
interface V5Data {
  generatedAt: number;
  stale: boolean;
  operatorSummaryAgeMs: number | null;
  verdict: { operationStatus: string; economicResult: string; capitalStatus: string; conclusion: string };
  fastPerps: { recorder: { running: boolean; connected: boolean; symbols: string[]; lastMessageAt: number | null };
    counts: Record<string, number>; freshness: { newestEventAgeMs: number | null }; recentGaps: Array<{ reason: string }> };
  economics: { objective: string; counts: Record<string, number>; topCandidates: any[];
    recentShadowDecisions: any[]; recentShadowOutcomes: any[] };
  metaMaskLiveReview: { counts: Record<string, number>; authorizationModel: string; executionDestination: string; liveExecution: string };
  speedTiers: { microstructure: { activeContracts: number }; fastEvent: { activeContracts: number };
    hourlyDaily: { activeSignalArtifacts: number } };
  control: { configuredLoops: number; completedLoops: number; activeLocks: number; openEscalations: number };
}
interface HealthData { status: 'operational' | 'degraded' | 'disabled'; operational: boolean; generatedAt: number;
  storageHealthy: boolean; currentLiveLock: boolean; }

const FAMILY_DESC: Record<string, string> = {
  momentum: 'Baseline: follow the 24h move (±0.75% threshold)',
  mean_reversion: 'Baseline: fade the 24h move (±0.75% threshold)',
  grid: 'Baseline: alternating buy/sell ticks — a cost-bleed benchmark',
  custom_ai: 'Baseline: momentum sign + exploration coin-flip',
  rsi_meanrev: 'CANDIDATE on trial: RSI14(1h) ≤ 35 dip-buy in uptrend (card rsi-meanrev-dot-v5, screened OOS PF 2.08)',
  manual: 'Your own Trading Desk fills with trade notes',
  copilot: 'Swarm Copilot natural-language fills',
  intent: 'Intent Solver fills',
  golden_cross: 'Volume-confirmed 50/200 Golden Cross paper book',
};

function ago(ts: number) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 0) return `${Math.ceil(-s)}s left`;
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
}

function shortId(value: string | null | undefined) {
  if (!value) return '—';
  return value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export function ResearchFleetFamilyCard({ family: f }: { family: Family; key?: React.Key }) {
  const winRate = f.closed ? Math.round((f.wins / f.closed) * 100) : null;
  const unresolved = f.orders?.unresolved || 0;
  return (
    <article data-testid={`fleet-family-${f.key}`} className={`min-w-0 bg-slate-900/60 border rounded-2xl p-4 space-y-2 ${unresolved ? 'border-rose-500/50' : 'border-slate-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-bold text-white font-mono">{f.label || f.family}</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${f.legacy ? 'bg-slate-700/30 text-slate-400 border-slate-600' : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25'}`}>{f.legacy ? 'LEGACY' : `V${f.authorityVersion || 5}`}</span>
          {f.lifecycleState ? <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">{f.lifecycleState.toUpperCase()}</span> : null}
          {f.permission ? <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">{f.permission}</span> : null}
          {f.health ? <span className={`text-[9px] font-mono ${f.health === 'healthy' ? 'text-emerald-400' : 'text-rose-400'}`}>{f.health}</span> : null}
        </div>
        <span className={`shrink-0 text-sm font-bold font-mono ${f.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{f.realizedPnl >= 0 ? '+' : ''}${f.realizedPnl.toFixed(2)}</span>
      </div>
      {unresolved ? <div role="alert" className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-mono text-rose-300"><AlertTriangle className="h-3 w-3 shrink-0" /> {unresolved} unresolved order{unresolved === 1 ? '' : 's'} still reserve portfolio risk</div> : null}
      <p className="text-[11px] text-slate-500 leading-relaxed">{FAMILY_DESC[f.family] || 'Versioned strategy experiment'}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
        <span>{f.trades} trades</span><span>{f.closed} closed{f.closed < 30 ? ' · n<30' : ''}</span>
        {winRate != null ? <span>{winRate}% wins</span> : null}<span>last: {ago(f.lastTradeAt)}</span>
        {f.regime ? <span className="text-violet-300">regime: {f.regime}</span> : null}
      </div>
      {f.orders ? <div className="flex flex-wrap gap-x-3 text-[10px] font-mono text-slate-500">
        <span>orders {f.orders.total}</span><span>active {f.orders.active}</span><span>latest {f.orders.latestStatus}</span>
        {f.portfolio ? <span>gross ${f.portfolio.grossExposureUsd.toFixed(0)} · pending ${f.portfolio.pendingExposureUsd.toFixed(0)}</span> : null}
      </div> : null}
      {f.budget ? <p className="text-[10px] text-slate-600 font-mono">discovery budget: ${f.budget.admittedNotionalUsd.toFixed(0)} / ${f.budget.maximumNotionalUsd.toFixed(0)} · {f.budget.admittedOrders} / {f.budget.maximumOrders} entries · {f.eligibility || 'unknown'}</p> : null}
      {f.lifecycleReason ? <p className="text-[10px] text-slate-600 break-words">state reason: {f.lifecycleReason}</p> : null}
      {f.learning ? <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-[10px] font-mono text-slate-500 space-y-1">
        <div className="flex items-center justify-between gap-2"><span>learning: {f.learning.disposition}</span><span className={f.learning.promotable ? 'text-emerald-400' : 'text-amber-400'}>{f.learning.promotable ? 'REVIEW CANDIDATE' : 'NOT PROMOTABLE'}</span></div>
        <div>{f.learning.independentEpisodes} independent · {f.learning.validOutcomes} eligible / {f.learning.quarantinedOutcomes} quarantined / {f.learning.invalidOutcomes} invalid · {f.learning.declaredFamilyTrials} family trials</div>
        <div>net {f.learning.meanEvidenceNetBps == null ? '—' : `${f.learning.meanEvidenceNetBps.toFixed(2)} bps`} · buy/hold relative {f.learning.meanBenchmarkRelativeBps == null ? '—' : `${f.learning.meanBenchmarkRelativeBps.toFixed(2)} bps`} · adjusted LCB {f.learning.lowerConfidenceNoTradeRelativeBps == null ? '—' : `${f.learning.lowerConfidenceNoTradeRelativeBps.toFixed(2)} bps`}</div>
        {f.learning.reasons.length ? <div className="break-words">blocked: {f.learning.reasons.join(' · ')}</div> : null}
      </div> : null}
      {f.lastTrigger ? <p className="text-[11px] text-slate-600 font-mono break-words">↳ {f.lastTrigger}</p> : null}
      {!f.legacy && f.lineage ? <details className="group rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-2 text-[10px] text-slate-500">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-mono text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><span>Lineage and recent outcomes</span><ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" /></summary>
        <dl className="mt-2 grid min-w-0 grid-cols-1 gap-1 font-mono sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt>experiment</dt><dd className="break-all text-slate-400" title={f.lineage.experimentId}>{shortId(f.lineage.experimentId)}</dd>
          <dt>strategy</dt><dd className="break-all text-slate-400" title={f.lineage.strategyHash}>{shortId(f.lineage.strategyHash)}</dd>
          <dt>trial</dt><dd className="break-all text-slate-400" title={f.lineage.trialId || ''}>{shortId(f.lineage.trialId)}</dd>
          <dt>opportunities</dt><dd className="break-words text-slate-400">{f.lineage.opportunityObservationIds.map(shortId).join(' · ') || '—'}</dd>
          <dt>reservations</dt><dd className="break-words text-slate-400">{f.lineage.reservationIds.map(shortId).join(' · ') || '—'}</dd>
          <dt>intents / fills</dt><dd className="break-words text-slate-400">{f.lineage.orderIntentIds.map(shortId).join(' · ') || '—'} / {f.lineage.fillIds.map(shortId).join(' · ') || '—'}</dd>
        </dl>
        <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
          {(f.outcomes || []).map((outcome) => <div key={outcome.outcomeId} className="flex flex-wrap justify-between gap-2"><span>{outcome.symbol} · {outcome.classification} · {outcome.operationalStatus}</span><span className={outcome.evidencePostCostPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${outcome.evidencePostCostPnlUsd.toFixed(2)}</span></div>)}
          {!f.outcomes?.length ? <span>No resolved V5 outcome yet.</span> : null}
        </div>
      </details> : null}
    </article>
  );
}

export function ResearchFleetOperatorTruth({ truth }: { truth: OperatorTruthData }) {
  const mechanicsGo = truth.mechanics.status === 'go_local_paper_operation';
  const latest = truth.latestCycle;
  const incidents = truth.forwardOperation.activeIncidents;
  return <section aria-label="V5 operator truth" data-testid="research-fleet-operator-truth" className="border-y border-slate-800 py-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div><div className="text-[9px] uppercase tracking-wider text-slate-600">Current paper operation</div>
        <div className={`text-xs font-mono font-bold ${mechanicsGo ? 'text-emerald-400' : 'text-amber-400'}`}>{mechanicsGo ? 'GO · paper operation' : 'NO-GO'}</div>
        <div className="text-[10px] text-slate-500">This does not prove an edge.</div></div>
      <div><div className="text-[9px] uppercase tracking-wider text-slate-600">Economic evidence</div>
        <div className="text-xs font-mono font-bold text-amber-300">{truth.economics.status.replaceAll('_', ' ')}</div>
        <div className="text-[10px] text-slate-500">{truth.economics.organicOutcomes} organic outcomes · edge proven: no</div></div>
      <div><div className="text-[9px] uppercase tracking-wider text-slate-600">Latest V5 cycle</div>
        <div className="text-xs font-mono text-cyan-300">{latest ? `${latest.organicRouted} organic routes / ${latest.organicEvaluated} checks` : 'Awaiting checkpoint'}</div>
        <div className="text-[10px] text-slate-500">{latest?.explanation || 'No durable cycle diagnostic yet.'}</div></div>
      <div><div className="text-[9px] uppercase tracking-wider text-slate-600">Forward operation</div>
        <div className={`text-xs font-mono font-bold ${incidents.length ? 'text-rose-400' : 'text-emerald-400'}`}>{incidents.length ? `${incidents.length} active incident${incidents.length === 1 ? '' : 's'}` : 'No active incident'}</div>
        <div className="text-[10px] text-slate-500">{truth.forwardOperation.totalCheckpoints} checkpoints · {truth.forwardOperation.latestCheckpoint?.consecutiveZeroRouteCycles || 0} zero-route cycles</div></div>
    </div>
    {latest?.blockingReasons.length ? <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Latest no-route reasons">
      {latest.blockingReasons.slice(0, 5).map((row) => <span key={`${row.category}:${row.reason}`} className="rounded-md bg-slate-900 px-2 py-1 text-[9px] font-mono text-slate-400">{row.category} · {row.reason} × {row.count}</span>)}
    </div> : null}
    {incidents.length ? <div className="mt-2 flex flex-wrap gap-1.5" role="alert" aria-label="Active V5 incidents">
      {incidents.map((incident) => <span key={`${incident.code}:${incident.message}`} title={incident.message} className={`rounded-md px-2 py-1 text-[9px] font-mono ${incident.severity === 'critical' ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300'}`}>{incident.code}</span>)}
    </div> : null}
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-mono text-slate-600">
      <span>Assurance excluded: {latest?.assuranceExcluded || 0}</span>
      <span>Acceptance: {truth.latestAcceptanceBundle ? shortId(truth.latestAcceptanceBundle.bundleHash) : 'not recorded'}</span>
      <span>Deployment: not authorized</span><span>Live locked</span>
    </div>
  </section>;
}

export default function ResearchFleet() {
  const [data, setData] = useState<FleetData | null>(null);
  const [v5, setV5] = useState<V5Data | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSize, setReviewSize] = useState('');
  const [reviewLeverage, setReviewLeverage] = useState('1');
  const [reviewPacket, setReviewPacket] = useState<any>(null);
  const [reviewAuthorization, setReviewAuthorization] = useState<any>(null);
  const [reviewConfirmation, setReviewConfirmation] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [fleetFilter, setFleetFilter] = useState<'v5' | 'legacy' | 'all'>('v5');

  async function load() {
    try {
      setLoading(true);
      const [res, v5Res, healthRes] = await Promise.all([apiFetch('/api/research-fleet'),
        apiFetch('/api/opportunity-factory/v5'), apiFetch('/api/opportunity-factory/health')]);
      // A failed poll used to leave the last-good data on screen with no
      // indication it had gone stale — the fleet looked healthy while blind.
      const failures: string[] = [];
      if (res.ok) setData(await safeJson(res));
      else failures.push((await safeJson<{ error?: string }>(res)).error || `fleet HTTP ${res.status}`);
      if (v5Res.ok) setV5(await safeJson(v5Res));
      else failures.push((await safeJson<{ error?: string }>(v5Res)).error || `flywheel HTTP ${v5Res.status}`);
      if (healthRes.ok) setHealth(await safeJson(healthRes));
      else failures.push((await safeJson<{ error?: string }>(healthRes)).error || `health HTTP ${healthRes.status}`);
      setError(failures.length ? failures.join(' · ') : null);
    } catch (err: any) {
      setError(err?.message || 'Could not reach the fleet API.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, []);

  // `data?.declined || {}` widened to `{}`, so Object.entries produced `unknown`
  // values and the sort/reduce below could not typecheck.
  const declined: Record<string, number> = data?.declined ?? {};
  const declinedRows = Object.entries(declined).sort((a, b) => b[1] - a[1]);
  const declinedTotal = declinedRows.reduce((s, [, n]) => s + n, 0);
  const liveReviewCandidate = v5?.economics.topCandidates.find((candidate) => candidate.currentState === 'live_review'
    && !candidate.killed && Number(candidate.edgeHalfLifeMs) >= 5 * 60_000);
  const liveReviewDecision = liveReviewCandidate && v5?.economics.recentShadowDecisions
    .find((decision) => decision.contractId === liveReviewCandidate.id && decision.evidenceMode === 'paper_forward'
      && decision.expiresAt > Date.now());
  const operationStatus = health?.status ?? v5?.verdict.operationStatus ?? 'degraded';
  const displayedFamilies = useMemo(() => (data?.families || []).filter((family) =>
    fleetFilter === 'all' || (fleetFilter === 'legacy' ? family.legacy : !family.legacy)), [data?.families, fleetFilter]);
  const displayedRecent = useMemo(() => (data?.recent || []).filter((trade) =>
    fleetFilter === 'all' || (fleetFilter === 'legacy' ? trade.legacy : !trade.legacy)), [data?.recent, fleetFilter]);
  const visibleTotals = data ? fleetFilter === 'v5' ? data.v5Totals : fleetFilter === 'legacy' ? data.legacyTotals : data.totals : null;

  async function prepareReviewedTrade() {
    if (!liveReviewCandidate || !liveReviewDecision) return;
    setReviewBusy(true); setReviewError(null); setReviewPacket(null); setReviewAuthorization(null);
    try {
      const res = await apiFetch('/api/mm/live-review/perps/prepare', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contractId: liveReviewCandidate.id, decisionId: liveReviewDecision.id,
          symbol: liveReviewDecision.symbol, side: liveReviewDecision.side, size: Number(reviewSize), leverage: Number(reviewLeverage) }) });
      const body = await safeJson<any>(res); if (!res.ok) throw new Error(body.error || `Prepare failed (HTTP ${res.status})`);
      setReviewPacket(body.packet);
    } catch (err: any) { setReviewError(err.message || 'Could not prepare reviewed trade.'); }
    finally { setReviewBusy(false); }
  }

  async function approveReviewedTrade() {
    if (!reviewPacket) return;
    setReviewBusy(true); setReviewError(null);
    try {
      const res = await apiFetch('/api/mm/live-review/perps/approve', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preparationId: reviewPacket.id, packetDigest: reviewPacket.packetDigest,
          confirmation: reviewConfirmation }) });
      const body = await safeJson<any>(res); if (!res.ok) throw new Error(body.error || `Approval failed (HTTP ${res.status})`);
      setReviewAuthorization(body.authorization);
    } catch (err: any) { setReviewError(err.message || 'Could not authorize reviewed trade.'); }
    finally { setReviewBusy(false); }
  }

  async function executeReviewedTrade() {
    if (!reviewPacket || !reviewAuthorization) return;
    setReviewBusy(true); setReviewError(null);
    try {
      const res = await apiFetch('/api/mm/live-review/perps/open', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ authorizationId: reviewAuthorization.id, packetDigest: reviewPacket.packetDigest,
          ...reviewPacket.trade }) });
      const body = await safeJson<any>(res); if (!res.ok) throw new Error(body.message || body.error || `Execution failed (HTTP ${res.status})`);
      setReviewError(`Live execution accepted: ${body.contractId || 'reviewed trade'}`);
      setReviewAuthorization(null); setReviewPacket(null); setReviewConfirmation('');
    } catch (err: any) { setReviewError(err.message || 'Reviewed execution was blocked.'); }
    finally { setReviewBusy(false); }
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><FlaskConical className="w-5 h-5 text-cyan-400" /> Research Fleet</h2>
          <p className="text-sm text-slate-500">The edge factory, live — strategy families, every trade's reasoning, and what the system declined. Paper only; shown as-is.</p>
        </div>
        {visibleTotals && (
          <div className="text-right">
            <div className={`text-2xl font-bold font-mono ${visibleTotals.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{visibleTotals.realizedPnl >= 0 ? '+' : ''}${visibleTotals.realizedPnl.toFixed(2)}</div>
            <div className="text-[11px] text-slate-500">{fleetFilter === 'all' ? 'all records · not comparable' : fleetFilter === 'legacy' ? 'legacy historical' : 'V5 only'} · {visibleTotals.trades} trades ({visibleTotals.closed} closed) · paper</div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
          {data && <span className="text-rose-400/70"> — showing the last successful snapshot, which may be stale.</span>}
        </div>
      )}

      {v5?.stale && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Degraded: this is the last materialized operator snapshot, updated {ago(v5.generatedAt)}. It is visibly stale and must not be used as live trading truth.
        </div>
      )}

      {health && health.status !== 'operational' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Fast-perp operation is {health.status}. Recorder, clocks, bounded queues, storage, summary freshness, and the live lock must all be healthy before this surface is operational.
        </div>
      )}

      {data?.operatorTruth ? <ResearchFleetOperatorTruth truth={data.operatorTruth} /> : null}

      {/* Flywheel V5: current observation, economics, lifecycle, and execution destination. */}
      {v5 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Radio className="w-3 h-3" /> Perp recorder</div>
              <div className={`mt-2 text-sm font-bold ${v5.fastPerps.recorder.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {v5.fastPerps.recorder.connected ? 'Connected' : v5.fastPerps.recorder.running ? 'Reconnecting' : 'Stopped'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{v5.fastPerps.recorder.symbols.length} liquid symbols · {v5.fastPerps.counts.books || 0} books · {v5.fastPerps.counts.trades || 0} trades</div>
              <div className="text-[10px] text-slate-600">newest evidence: {v5.fastPerps.freshness.newestEventAgeMs == null ? 'none yet' : `${Math.round(v5.fastPerps.freshness.newestEventAgeMs / 1000)}s ago`}</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Lifecycle</div>
              <div className="mt-2 text-sm font-mono text-white">{v5.economics.counts.research_candidate || 0} → {v5.economics.counts.shadow_paper || 0} → {v5.economics.counts.funded_paper || 0} → {v5.economics.counts.live_review || 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">research · shadow · funded paper · live review</div>
              <div className="text-[10px] text-slate-600">{v5.speedTiers.microstructure.activeContracts} micro · {v5.speedTiers.fastEvent.activeContracts} fast-event · {v5.speedTiers.hourlyDaily.activeSignalArtifacts} hourly/daily signals</div>
              <div className="text-[10px] text-rose-400/80">{v5.economics.counts.killed || 0} killed by immutable rules</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Shadow execution</div>
              <div className="mt-2 text-sm font-mono text-white">{v5.economics.counts.shadowFilled || 0} fills / {v5.economics.counts.shadowOutcomes || 0} outcomes</div>
              <div className={`text-[11px] font-mono mt-1 ${(v5.economics.counts.shadowNetPnlUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                net ${(v5.economics.counts.shadowNetPnlUsd || 0).toFixed(2)} paper P&amp;L
              </div>
              <div className="text-[10px] text-slate-600">maker/taker/delayed/no-trade cohorts</div>
            </div>
            <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Wallet className="w-3 h-3" /> MetaMask destination</div>
              <div className={`mt-2 text-sm font-bold ${v5.metaMaskLiveReview.liveExecution === 'locked'
                ? 'text-amber-400' : 'text-rose-400'}`}>{v5.metaMaskLiveReview.liveExecution === 'locked' ? 'Live locked' : 'LIVE ENABLED'}</div>
              <div className="text-[10px] text-slate-500 mt-1">{v5.metaMaskLiveReview.counts.preparations || 0} prepared · {v5.metaMaskLiveReview.counts.authorizations || 0} approved · {v5.metaMaskLiveReview.counts.consumptions || 0} executed</div>
              <div className="text-[10px] text-slate-600">fresh signal + quote + exact one-use approval</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-white">Economic contracts</h3>
                <p className="text-[11px] text-slate-500 max-w-4xl">{v5.economics.objective} Tiny repeatable edges are eligible; the gates care about post-cost dollars, frequency, capacity, cost stress, drawdown, and untouched forward evidence.</p>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-mono px-2 py-1 rounded-lg border ${operationStatus === 'operational' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10'}`}>{operationStatus} · {v5.verdict.economicResult}</span>
                <div className="mt-1 text-[10px] text-slate-600">operator snapshot updated {ago(v5.generatedAt)}</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {v5.economics.topCandidates.slice(0, 8).map((candidate) => {
                const blockers: string[] = candidate.latestLifecycleEvent?.blockers || candidate.lifecycleBlockers || [];
                return <div key={candidate.id} className="rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[11px] font-mono text-slate-200">{candidate.instrument} · {candidate.strategyFamilyId} · {candidate.executionPolicy}</div>
                    <div className="flex gap-2 text-[10px] font-mono"><span className="text-cyan-300">{candidate.currentState}</span><span className={(candidate.objectiveScoreUsdPerDay || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}>${Number(candidate.objectiveScoreUsdPerDay || 0).toFixed(2)}/day score</span></div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-slate-500 font-mono">
                    <span>gross {Number(candidate.predictedGrossEdgeBps).toFixed(2)}bps</span><span>cost {Number(candidate.totalCostBps).toFixed(2)}bps</span><span>uncertainty {Number(candidate.uncertaintyBufferBps).toFixed(2)}bps</span><span>conservative {Number(candidate.conservativeNetEdgeBps).toFixed(2)}bps</span><span>{Number(candidate.opportunitiesPerDay).toFixed(1)} chances/day</span>
                  </div>
                  <div className={`mt-1 text-[10px] ${blockers.length ? 'text-amber-400/80' : 'text-slate-600'}`}>{candidate.killed ? 'KILLED · ' : ''}{blockers.length ? blockers.join(' · ') : 'No current lifecycle blocker recorded.'}</div>
                </div>;
              })}
              {!v5.economics.topCandidates.length && <p className="text-[11px] text-slate-600">{(v5.fastPerps.counts.researchRuns || 0) > 0
                ? 'Research ran and no evaluation cleared the declared statistical, post-cost, and risk gates. No contract was issued; the correct result is no-trade.'
                : 'No economic contract yet. The recorder must accumulate enough replayable evidence before research can issue one.'}</p>}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-2">Latest shadow outcomes and cost attribution</h3>
            <div className="space-y-1.5">
              {v5.economics.recentShadowOutcomes.slice(0, 8).map((outcome) => <div key={outcome.id} className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[10px] font-mono border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-300">{outcome.cohort} · {outcome.status}</span><span className={(outcome.netPnlUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>net ${Number(outcome.netPnlUsd).toFixed(3)}</span><span className="text-slate-500">fee ${Number(outcome.feeUsd).toFixed(3)}</span><span className="text-slate-500">spread ${Number(outcome.spreadUsd).toFixed(3)}</span><span className="text-slate-500">impact ${Number(outcome.impactUsd).toFixed(3)}</span><span className="text-slate-500">NAV ${Number(outcome.navAfterUsd).toFixed(2)}</span>
              </div>)}
              {!v5.economics.recentShadowOutcomes.length && <p className="text-[11px] text-slate-600">No forward shadow outcome yet.</p>}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-400" /> Reviewed MetaMask execution</h3>
            {!liveReviewCandidate && <p className="text-[11px] text-slate-500 mt-2">Unavailable by design: no strategy with an edge half-life above the measured quote, readiness, and human-approval latency has earned <span className="font-mono text-cyan-300">live_review</span>. Microstructure and 1–30 second fast-event strategies remain paper-only.</p>}
            {liveReviewCandidate && !liveReviewDecision && <p className="text-[11px] text-amber-300/80 mt-2">{liveReviewCandidate.instrument} is review-eligible, but there is no fresh unexpired signal. The original research event cannot be reused.</p>}
            {liveReviewCandidate && liveReviewDecision && <div className="mt-3 space-y-3">
              <div className="text-[11px] font-mono text-slate-300">{liveReviewDecision.side.toUpperCase()} {liveReviewDecision.symbol} · signal expires {ago(liveReviewDecision.expiresAt)} · contract {liveReviewCandidate.id}</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-[10px] text-slate-500">Asset size<input value={reviewSize} onChange={(event) => setReviewSize(event.target.value)} inputMode="decimal" placeholder="e.g. 0.001" className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white" /></label>
                <label className="text-[10px] text-slate-500">Leverage<input value={reviewLeverage} onChange={(event) => setReviewLeverage(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white" /></label>
                <button onClick={prepareReviewedTrade} disabled={reviewBusy || !(Number(reviewSize) > 0)} className="self-end rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-3 py-1.5 text-xs disabled:opacity-40">Quote and prepare</button>
              </div>
              {reviewPacket && <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-[10px] space-y-1">
                <div className="font-mono text-slate-300">quote ${Number(reviewPacket.quote.notionalUsd).toFixed(2)} · entry {reviewPacket.quote.entryPrice ?? '—'} · fee {reviewPacket.quote.estimatedFeeUsd ?? '—'} · expires {ago(reviewPacket.expiresAt)}</div>
                <div className={reviewPacket.blockers.length ? 'text-amber-300' : 'text-emerald-300'}>{reviewPacket.blockers.length ? reviewPacket.blockers.join(' · ') : 'Contract, signal, quote, risk limits, and wallet readiness passed. Explicit approval is still required.'}</div>
                {!reviewPacket.blockers.length && !reviewAuthorization && <div className="pt-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input value={reviewConfirmation} onChange={(event) => setReviewConfirmation(event.target.value)} placeholder="Type: I AUTHORIZE THIS EXACT REVIEWED TRADE" className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white" />
                  <button onClick={approveReviewedTrade} disabled={reviewBusy || reviewConfirmation !== 'I AUTHORIZE THIS EXACT REVIEWED TRADE'} className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 px-3 py-1.5 text-xs disabled:opacity-40">Approve once</button>
                </div>}
                {reviewAuthorization && <div className="pt-2 flex items-center justify-between gap-3 flex-wrap"><span className="text-amber-300">One-use approval recorded. The global live lock and current readiness are checked again on execution.</span><button onClick={executeReviewedTrade} disabled={reviewBusy} className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 px-3 py-1.5 text-xs disabled:opacity-40">Execute this real trade</button></div>}
              </div>}
              {reviewError && <div className="text-[10px] text-rose-300">{reviewError}</div>}
            </div>}
          </div>
        </div>
      )}

      {/* Strategy families */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-2" aria-label="Research Fleet version filter">
        <div className="flex flex-wrap gap-1">
          {(['v5', 'legacy', 'all'] as const).map((filter) => <button key={filter} type="button" aria-pressed={fleetFilter === filter} onClick={() => setFleetFilter(filter)} className={`rounded-lg px-3 py-1.5 text-[11px] font-mono uppercase ${fleetFilter === filter ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30' : 'text-slate-500 hover:text-slate-300'}`}>{filter === 'all' ? 'All · not comparable' : filter}</button>)}
        </div>
        <span className="text-[10px] text-slate-600">Legacy history is excluded from V5 metrics by default.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedFamilies.map((family) => <ResearchFleetFamilyCard key={family.key || family.family} family={family} />)}
        {data && !displayedFamilies.length ? <p className="text-sm text-slate-500 col-span-2">No {fleetFilter === 'all' ? '' : fleetFilter.toUpperCase()} strategy records yet.</p> : null}
      </div>

      {/* Declined opportunities */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><ShieldOff className="w-4 h-4 text-amber-400" /> Declined (last 7d): {declinedTotal}</h3>
        <p className="text-[11px] text-slate-500 mb-3">Restraint is evidence of discipline — the system refusing when conditions aren't met. It is not evidence of edge.</p>
        <div className="flex flex-wrap gap-2">
          {declinedRows.map(([k, n]) => {
            const [family, reason] = k.split('|');
            return <span key={k} className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">{family} · {reason} × {n}</span>;
          })}
          {!declinedRows.length && <span className="text-[11px] text-slate-600">No decline counters yet today.</span>}
        </div>
      </div>

      {/* Recent trades with reasoning */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-indigo-400" /> Recent trades — with their reasoning</h3>
        <div className="space-y-2">
          {/* Keyed by trade id: newest-first, so index names a different trade
              each time a fill lands. */}
          {displayedRecent.map((r: any, i: number) => (
            <div key={r.id ?? `${r.t}-${r.symbol}-${i}`} className="flex items-start justify-between gap-3 border-b border-slate-800/50 pb-2 last:border-0">
              <div className="min-w-0">
                <div className="text-[12px] font-mono text-slate-200">
                  <span className={r.side === 'buy' || r.side === 'long' ? 'text-emerald-400' : 'text-rose-400'}>{r.side.toUpperCase()}</span>
                  {' '}{Number(r.size).toFixed(4)} {r.symbol} @ ${Number(r.price).toLocaleString()} <span className="text-slate-500">[{r.label || r.family}{r.variant ? ` · ${r.variant}` : ''}{r.paperPermission ? ` · ${r.paperPermission}` : ''}]</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate" title={`${r.setup} → ${r.trigger}`}>{r.trigger}</div>
              </div>
              <div className="text-right shrink-0">
                {r.pnl != null && <div className={`text-[12px] font-mono ${r.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.pnl >= 0 ? '+' : ''}${r.pnl.toFixed(2)}</div>}
                <div className="text-[10px] text-slate-600">{ago(r.t)}</div>
              </div>
            </div>
          ))}
          {data && !displayedRecent.length && <p className="text-[11px] text-slate-600">Nothing in this version filter yet.</p>}
        </div>
        {loading && <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2"><RefreshCw className="w-3 h-3 animate-spin" /> refreshing…</div>}
      </div>
    </div>
  );
}
