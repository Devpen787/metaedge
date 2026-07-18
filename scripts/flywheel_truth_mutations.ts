import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type Fixture = {
  contract: Record<string, any>;
  version: Record<string, any>;
  decision: Record<string, any>;
  outcome: Record<string, any>;
  events: Record<string, any>[];
  lifecycle: Record<string, any>[];
  cutoverAt?: number;
};

function baseFixture(): Fixture {
  const costs = { feeBps: 1, spreadBps: 1, slippageBps: 1, impactBps: 1, fundingBps: 0,
    borrowBps: 0, adverseSelectionBps: 1, latencyBps: 1, totalBps: 6 };
  return {
    contract: { id: 'contract_1', immutable: true, liveExecution: 'locked', strategyVersionId: 'version_1',
      speedTier: 'microstructure', lifecycleState: 'research_candidate', costs,
      economics: { tailRiskPenaltyUsdPerDay: 1, drawdownPenaltyUsdPerDay: 1 } },
    version: { id: 'version_1', immutable: true },
    decision: { id: 'decision_1', contractId: 'contract_1', evidenceMode: 'paper_forward',
      sourceSignalEventIds: ['signal_event'], recordedAt: 100, decidedAt: 100, evidenceCutoffAt: 90,
      expiresAt: 200, decisionLagMs: 10, liveExecution: 'locked' },
    outcome: { id: 'outcome_1', decisionId: 'decision_1', contractId: 'contract_1',
      evidenceMode: 'paper_forward', promotable: true, timingValid: true, timingDeviationMs: 0,
      status: 'filled', resolvedAt: 200, grossPnlUsd: 1, feeUsd: 0.1, fundingUsd: 0,
      borrowUsd: 0, netPnlUsd: 0.9, navBeforeUsd: 10_000, navAfterUsd: 10_000.9,
      noTradeCounterfactualNetPnlUsd: 0, sourceEventIds: ['signal_event', 'outcome_event'], liveExecution: 'locked' },
    events: [{ id: 'signal_event', receivedAt: 90 }, { id: 'outcome_event', receivedAt: 200 }],
    lifecycle: [],
  };
}

function writeJsonl(file: string, rows: Record<string, any>[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (rows.length) fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function runCase(name: string, mutate: (fixture: Fixture) => void, expectedFailure: string | null,
  liveEnabled = false): { name: string; passed: boolean; failures: string[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `metaedge-mutation-${name}-`));
  const fixture = baseFixture(); mutate(fixture);
  const economics = path.join(root, 'economics'); const fast = path.join(root, 'fast');
  writeJsonl(path.join(economics, 'paper-trade-contracts.jsonl'), [fixture.contract]);
  writeJsonl(path.join(economics, 'strategy-versions.jsonl'), [fixture.version]);
  writeJsonl(path.join(economics, 'lifecycle-events.jsonl'), fixture.lifecycle);
  writeJsonl(path.join(economics, 'shadow-decisions.jsonl'), [fixture.decision]);
  writeJsonl(path.join(economics, 'shadow-outcomes.jsonl'), [fixture.outcome]);
  writeJsonl(path.join(fast, 'raw', 'fixture.jsonl'), fixture.events);
  if (fixture.cutoverAt != null) {
    const cutoverFile = path.join(root, 'data', 'opportunity-factory-v3', 'fast-perp-cutover.json');
    fs.mkdirSync(path.dirname(cutoverFile), { recursive: true });
    fs.writeFileSync(cutoverFile, JSON.stringify({ cutoverAt: fixture.cutoverAt }));
  }
  const command = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  const verification = spawnSync(command, [path.join(process.cwd(), 'scripts', 'verify_flywheel_recovery.ts')], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, VERIFY_PROJECT_ROOT: root,
      VERIFY_ECONOMICS_ROOT: economics, VERIFY_FAST_ROOT: fast, VERIFY_LIVE_REVIEW_ROOT: path.join(root, 'live-review'),
      VERIFY_OPERATOR_ROOT: path.join(root, 'operator'), VERIFY_OUTPUT: path.join(root, 'result.json'),
      VERIFY_BASELINE_REQUIRED: 'false', VERIFY_RUNTIME_REQUIRED: 'false', LIVE_EXECUTION_ENABLED: liveEnabled ? 'true' : 'false',
      LIVE_REVIEW_EXECUTION_CERTIFIED: liveEnabled ? 'true' : 'false' },
  });
  let failures: string[] = [];
  try { failures = JSON.parse(fs.readFileSync(path.join(root, 'result.json'), 'utf8')).failures; }
  catch { failures = [`VERIFIER_DID_NOT_WRITE_RESULT:${verification.stderr || verification.stdout}`]; }
  const passed = expectedFailure == null ? verification.status === 0 && failures.length === 0
    : verification.status !== 0 && failures.some((failure) => failure.startsWith(expectedFailure));
  fs.rmSync(root, { recursive: true, force: true });
  return { name, passed, failures };
}

const cases = [
  runCase('clean_control', () => {}, null),
  runCase('late_signal', (fixture) => { fixture.events[0].receivedAt = 101; }, 'DECISION_USED_LATE_EVIDENCE'),
  runCase('predecision_outcome', (fixture) => { fixture.events[1].receivedAt = 100; }, 'OUTCOME_USED_PREDECISION_EVENT'),
  runCase('precutover_forward', (fixture) => { fixture.cutoverAt = 150; }, 'FORWARD_DECISION_PRECEDES_CUTOVER'),
  runCase('canary_promotion', (fixture) => { fixture.decision.evidenceMode = 'canary'; fixture.outcome.evidenceMode = 'canary'; },
    'INELIGIBLE_PROMOTABLE_OUTCOME'),
  runCase('false_nav', (fixture) => { fixture.outcome.navAfterUsd = 20_000; }, 'NAV_RECONCILIATION_FAILED'),
  runCase('false_no_trade_value', (fixture) => { fixture.outcome.noTradeCounterfactualNetPnlUsd = 0.9; },
    'NO_TRADE_COUNTERFACTUAL_NOT_ZERO'),
  runCase('no_trade_became_fill', (fixture) => { fixture.decision.cohort = 'no_trade'; },
    'NO_TRADE_DECISION_BECAME_EXECUTABLE'),
  runCase('unmeasured_promoted_risk', (fixture) => {
    fixture.contract.economics.tailRiskPenaltyUsdPerDay = 0;
    fixture.lifecycle.push({ id: 'lifecycle_1', contractId: 'contract_1', from: 'research_candidate', to: 'shadow_paper',
      passed: true, eligibleSampleIds: [], independentBlockCount: 1, statisticalLookNumber: 1,
      alphaSpent: 0.025, liveExecution: 'locked' });
  }, 'PROMOTED_WITH_UNMEASURED_RISK'),
  runCase('live_switch', () => {}, 'LIVE_EXECUTION_ENABLED_DURING_RECOVERY', true),
];

const result = { schemaVersion: 1, generatedAt: Date.now(), cases,
  passed: cases.every((item) => item.passed), liveExecution: 'locked' };
const output = path.join(process.cwd(), 'output', 'proof', 'flywheel-recovery', 'truth-mutation-proof.json');
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ output, ...result }, null, 2));
if (!result.passed) process.exitCode = 1;
