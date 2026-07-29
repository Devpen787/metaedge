import { runControlledFastPerpCycle } from '../server/discovery/fast_perp_controlled_runtime.js';

const result = await runControlledFastPerpCycle();
console.log(JSON.stringify({ mode: result.mode,
  research: { executed: result.research.executed, outcome: result.research.run.outcome,
    reason: result.research.run.reason, itemsFound: result.research.run.itemsFound,
    declaredTrials: result.research.run.declaredTrials },
  shadow: { executed: result.shadow.executed, outcome: result.shadow.run.outcome,
    reason: result.shadow.run.reason, itemsFound: result.shadow.run.itemsFound },
  evidence: { counts: result.evidence.counts, freshness: result.evidence.freshness,
    latestResearchRunId: result.evidence.latestResearchRun?.id ?? null },
  economics: { counts: result.economics.counts,
    topCandidateIds: result.economics.topEconomicCandidates.map((row) => row.contract.id) },
  liveExecution: result.liveExecution,
}, null, 2));
