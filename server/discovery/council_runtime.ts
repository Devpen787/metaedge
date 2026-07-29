import { contentHash } from './store.js';
import type { CouncilClaim, CouncilRole, CouncilRun, CouncilSynthesis, SpecialistCouncilPacket } from './council_types.js';
import type { LaneSignalPacket } from './lane_signal_types.js';

const GRAPH_VERSION = 'evidence-council-graph-v1';
const PROMPT_VERSION = 'typed-evidence-packets-v1';
const POLICY_VERSION = 'numerical-gate-paper-only-v1';
const MODEL_VERSION = 'deterministic-evidence-reader-v1';

function claim(role: CouncilRole, index: number, text: string, stance: CouncilClaim['stance'], evidenceIds: string[],
  falsifier: string): CouncilClaim {
  const identity = { role, index, text, stance, evidenceIds: [...evidenceIds].sort(), falsifier };
  return { id: `council_claim_${contentHash(identity).slice(0, 20)}`, text, stance,
    evidenceIds: [...evidenceIds].sort(), falsifier };
}

function specialist(role: CouncilRole, claims: CouncilClaim[]): SpecialistCouncilPacket {
  const support = claims.filter((item) => item.stance === 'support').length;
  const oppose = claims.filter((item) => item.stance === 'oppose').length;
  const conclusion = oppose ? 'oppose' : support && claims.every((item) => item.stance !== 'insufficient_evidence')
    ? 'support' : 'insufficient_evidence';
  return { role, modelVersion: MODEL_VERSION, evidenceIds: [...new Set(claims.flatMap((item) => item.evidenceIds))].sort(),
    claims, conclusion };
}

function rolePackets(packet: LaneSignalPacket): SpecialistCouncilPacket[] {
  const evidenceIds = packet.sourceArtifactIds;
  const robust = (packet.measurements.robustParameterSurfaces ?? 0) > 0;
  const resolved = (packet.measurements.resolvedForwards ?? 0) > 0;
  const executionMissing = packet.blockers.some((blocker) => ['ORDER_BOOK', 'ORDER_FLOW', 'DEPTH', 'EXECUTABLE',
    'LIQUIDITY', 'GAS_BRIDGE', 'HOLDER_', 'TURNOVER_'].some((token) => blocker.includes(token)));
  const catalystMissing = packet.blockers.some((blocker) => ['SIGNED_SURPRISE', 'EXPECTATIONS', 'ATTENTION',
    'OUTCOME_LABEL', 'SETTLEMENT', 'HOLDER_', 'TURNOVER_'].some((token) => blocker.includes(token)));
  return [
    specialist('quant_analyst', [claim('quant_analyst', 0,
      robust ? 'The tested parameter surface contains a near-best local plateau.' : 'The tested parameter surface is isolated or absent.',
      robust ? 'support' : 'oppose', evidenceIds, 'A new sealed surface changes the plateau decision.'),
    claim('quant_analyst', 1, resolved ? 'Resolved forward evidence exists.' : 'Untouched resolved forward evidence is absent.',
      resolved ? 'support' : 'insufficient_evidence', evidenceIds, 'Resolve the pre-registered forward observations.')]),
    specialist('market_structure_analyst', [claim('market_structure_analyst', 0,
      executionMissing ? 'Execution, exit, or executable-quote evidence is incomplete.' : 'No declared execution-evidence blocker is active.',
      executionMissing ? 'oppose' : 'support', evidenceIds, 'Collect fill, depth, impact, finality, and exit evidence for this stream.')]),
    specialist('catalyst_analyst', [claim('catalyst_analyst', 0,
      catalystMissing ? 'The stream lacks a signed or independently resolved catalyst.' : 'The structured catalyst contract has no declared missing field.',
      catalystMissing ? 'insufficient_evidence' : 'support', evidenceIds, 'Add point-in-time signed catalyst or authoritative outcome evidence.')]),
    specialist('risk_reviewer', [claim('risk_reviewer', 0,
      packet.researchDisposition === 'forward_candidate' ? 'The upstream numerical research disposition permits forward observation.'
        : `The upstream numerical disposition is ${packet.researchDisposition}.`,
      packet.researchDisposition === 'forward_candidate' ? 'support' : 'oppose', evidenceIds,
      'A new sealed numerical decision changes the upstream disposition.')]),
  ];
}

export function runDecisionCouncil(packet: LaneSignalPacket, createdAt = Date.now()): CouncilRun {
  const specialists = rolePackets(packet);
  const allClaims = specialists.flatMap((specialistPacket) => specialistPacket.claims);
  const supporting = allClaims.filter((item) => item.stance === 'support');
  const opposing = allClaims.filter((item) => item.stance === 'oppose');
  const insufficient = allClaims.filter((item) => item.stance === 'insufficient_evidence');
  const bullCase = { side: 'bull' as const, claims: supporting,
    unresolvedDissent: [...opposing, ...insufficient].map((item) => item.id),
    conclusion: supporting.length ? 'supported' as const : insufficient.length ? 'insufficient_evidence' as const : 'unsupported' as const };
  const bearCase = { side: 'bear' as const, claims: [...opposing, ...insufficient],
    unresolvedDissent: supporting.map((item) => item.id),
    conclusion: opposing.length ? 'supported' as const : insufficient.length ? 'insufficient_evidence' as const : 'unsupported' as const };
  const proposedAction: CouncilSynthesis['proposedAction'] = packet.researchDisposition === 'forward_candidate' && packet.candidateAction === 'observe_forward'
    ? 'observe_forward' : packet.candidateAction === 'research_only' ? 'research_only' : 'no_trade';
  const synthesis = { proposedAction,
    thesis: proposedAction === 'observe_forward' ? 'Numerical evidence permits a bounded paper-forward observation only.'
      : proposedAction === 'research_only' ? 'Evidence is useful for research but not for a paper position.'
        : 'The stream has no evidence-qualified action.',
    supportingClaimIds: supporting.map((item) => item.id), opposingClaimIds: opposing.map((item) => item.id),
    unresolvedDissent: insufficient.map((item) => item.id) };
  const gateBlockers = packet.blockers.filter((blocker) => blocker !== 'UNTOUCHED_FORWARD_OUTCOMES_NOT_YET_OBSERVED');
  if (packet.researchDisposition !== 'forward_candidate') gateBlockers.push('UPSTREAM_NUMERICAL_DISPOSITION_NOT_FORWARD_CANDIDATE');
  if (packet.candidateAction !== 'observe_forward') gateBlockers.push('UPSTREAM_ACTION_NOT_FORWARD_OBSERVATION');
  const blockers = [...new Set(gateBlockers)].sort();
  const numericalGate = { passed: blockers.length === 0, blockers, nonOverridable: true as const, liveExecution: 'locked' as const };
  const managerDecision = numericalGate.passed ? 'paper_observe' as const
    : proposedAction === 'research_only' ? 'research_only' as const : 'no_trade' as const;
  const manager = { decision: managerDecision,
    reason: numericalGate.passed ? 'NON_OVERRIDABLE_NUMERICAL_GATE_PASSED_FOR_PAPER_OBSERVATION_ONLY'
      : `NUMERICAL_GATE_BLOCKED:${blockers.join('|')}`,
    humanGateRequiredForAnyPromotion: true as const, liveExecution: 'locked' as const };
  const identity = { stream: packet.stream, laneSignalPacketId: packet.id, graphVersion: GRAPH_VERSION,
    promptVersion: PROMPT_VERSION, decisionPolicyVersion: POLICY_VERSION, specialists, bullCase, bearCase, synthesis,
    numericalGate, manager };
  return { id: `council_run_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1, createdAt,
    stream: packet.stream, laneSignalPacketId: packet.id, datasetVersionId: packet.datasetVersionId,
    universeVersionId: packet.universeVersionId, worldContractId: packet.worldContractId, graphVersion: GRAPH_VERSION,
    promptVersion: PROMPT_VERSION, decisionPolicyVersion: POLICY_VERSION, specialists, bullCase, bearCase,
    synthesis, numericalGate, manager, liveExecution: 'locked' };
}
