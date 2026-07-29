import { executeControlledLoop } from './control_cycle.js';
import { readFlywheelControlConfig } from './control_runtime.js';
import { FlywheelControlStore } from './control_store.js';
import { EconomicOperationStore } from './economic_store.js';
import { runFastPerpResearchCycle, fastPerpDeclaredTrialsForSymbols,
  FAST_PERP_RESEARCH_POLICY_VERSION } from './fast_perp_research.js';
import { FastPerpEvidenceStore } from './fast_perp_store.js';
import { runFastShadowCycle } from './fast_shadow_runtime.js';
import { runFastLifecycleCycle } from './fast_lifecycle_runtime.js';
import { contentHash } from './store.js';

export async function runControlledFastPerpCycle(options: {
  controlStore?: FlywheelControlStore;
  evidenceStore?: FastPerpEvidenceStore;
  economicStore?: EconomicOperationStore;
  now?: () => number;
} = {}) {
  const controlStore = options.controlStore ?? new FlywheelControlStore();
  const evidenceStore = options.evidenceStore ?? new FastPerpEvidenceStore();
  const economicStore = options.economicStore ?? new EconomicOperationStore();
  const config = readFlywheelControlConfig(); const clock = options.now ?? Date.now;
  // The ordinary six-hour flywheel never owns fast-perp research, decisions,
  // resolution, or lifecycle work. Those mutations belong exclusively to the
  // four independent child clocks in fast_perp_scheduler.ts.
  const dedicatedClockRuntime = true;
  if (dedicatedClockRuntime) {
    const enabled = process.env.FAST_PERP_OPERATION_ENABLED === 'true';
    const disabledFingerprint = contentHash({ status: enabled ? 'delegated_to_independent_clocks'
      : 'disabled_pending_recovery', liveExecution: 'locked' });
    const research = await executeControlledLoop({ loopId: 'fast_event_research', evidenceFingerprint: disabledFingerprint,
      requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
      store: controlStore, config, now: clock, action: () => ({ value: null,
        reason: enabled ? 'FAST_EVENT_RESEARCH_DELEGATED_TO_INDEPENDENT_CLOCK'
          : 'FAST_EVENT_RESEARCH_DISABLED_PENDING_RECOVERY', itemsFound: 0, actionsTaken: 0, newEvidence: false }) });
    const shadow = await executeControlledLoop({ loopId: 'fast_event_shadow', evidenceFingerprint: disabledFingerprint,
      requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
      store: controlStore, config, now: clock, action: () => ({ value: null,
        reason: enabled ? 'FAST_EVENT_SHADOW_DELEGATED_TO_SIGNAL_AND_RESOLVER_CLOCKS'
          : 'FAST_EVENT_SHADOW_DISABLED_PENDING_RECOVERY', itemsFound: 0, actionsTaken: 0, newEvidence: false }) });
    return { mode: 'Paper money' as const, research, shadow, evidence: evidenceStore.snapshot(clock()),
      economics: economicStore.snapshot(), liveExecution: 'locked' as const };
  }
  const trades = evidenceStore.readTrades(); const books = evidenceStore.readBooks(); const contexts = evidenceStore.readContexts();
  const symbols = [...new Set([...trades.map((row) => row.symbol), ...books.map((row) => row.symbol)])].sort();
  const evidenceFingerprint = contentHash({ researchPolicyVersion: FAST_PERP_RESEARCH_POLICY_VERSION,
    economicObjectivePolicyId: economicStore.snapshot().objectivePolicy.id,
    tradeIds: trades.map((row) => row.id), bookIds: books.map((row) => row.id), contextIds: contexts.map((row) => row.id) });
  const research = await executeControlledLoop({ loopId: 'fast_event_research', evidenceFingerprint,
    requestedTrials: fastPerpDeclaredTrialsForSymbols(symbols.length), requestedAgentActions: 0,
    estimatedTokens: 0, forwardResolutionChanged: false, store: controlStore, config, now: clock,
    action: () => {
      const run = runFastPerpResearchCycle({ evidenceStore, economicStore, now: clock() });
      return { value: run, reason: 'FAST_EVENT_RESEARCH_COMPLETE', itemsFound: run.evaluations.length,
        actionsTaken: 0, newEvidence: true };
    } });
  const economicsBefore = economicStore.snapshot();
  const shadowFingerprint = contentHash({ evidenceFingerprint,
    contractIds: economicsBefore.current.map((row) => row.contract.id),
    lifecycleEventIds: economicStore.readLifecycleEvents().map((row) => row.id),
    outcomeIds: economicStore.readShadowOutcomes().map((row) => row.id) });
  const shadow = await executeControlledLoop({ loopId: 'fast_event_shadow', evidenceFingerprint: shadowFingerprint,
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: () => {
      const result = runFastShadowCycle({ evidenceStore, economicStore });
      const lifecycle = runFastLifecycleCycle({ economicStore });
      return { value: result, reason: 'FAST_EVENT_SHADOW_EXECUTION_COMPLETE',
        itemsFound: result.createdDecisions + result.createdOutcomes + lifecycle.evaluated, actionsTaken: 0,
        newEvidence: result.createdDecisions + result.createdOutcomes + lifecycle.evaluated > 0 };
    } });
  return { mode: 'Paper money' as const, research, shadow, evidence: evidenceStore.snapshot(clock()),
    economics: economicStore.snapshot(), liveExecution: 'locked' as const };
}
