import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createGunzip } from 'node:zlib';

type JsonRow = Record<string, any>;

const projectRoot = path.resolve(process.env.VERIFY_PROJECT_ROOT || process.cwd());
const failures: string[] = [];
const checks: Record<string, unknown> = {};
const archiveRoot = path.resolve(process.env.VERIFY_ARCHIVE_ROOT
  || path.join(projectRoot, 'data', 'archive', 'flywheel-v3-runaway-2026-07-16'));
const activeFast = path.resolve(process.env.VERIFY_FAST_ROOT
  || path.join(projectRoot, 'data', 'opportunity-factory-v3', 'fast-perps'));
const activeEconomics = path.resolve(process.env.VERIFY_ECONOMICS_ROOT
  || path.join(projectRoot, 'data', 'opportunity-factory-v3', 'economics'));
const liveReviewRoot = path.resolve(process.env.VERIFY_LIVE_REVIEW_ROOT
  || path.join(projectRoot, 'data', 'opportunity-factory-v3', 'live-review'));
const operatorRoot = path.resolve(process.env.VERIFY_OPERATOR_ROOT
  || path.join(projectRoot, 'data', 'opportunity-factory-v3', 'operator'));
const replayFile = path.resolve(process.env.VERIFY_REPLAY_FILE
  || path.join(projectRoot, 'output', 'proof', 'flywheel-recovery', 'deterministic-replay.json'));
const baselineRequired = process.env.VERIFY_BASELINE_REQUIRED !== 'false';
const runtimeRequired = process.env.VERIFY_RUNTIME_REQUIRED === 'true';
const now = Number(process.env.VERIFY_NOW || Date.now());
let activeCutoverAt = 0;
try { activeCutoverAt = Number(JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'opportunity-factory-v3',
  'fast-perp-cutover.json'), 'utf8')).cutoverAt) || 0; } catch { /* baseline check reports a missing cutover */ }

function fail(code: string, id?: unknown): void {
  const rendered = id == null ? code : `${code}:${String(id)}`;
  if (!failures.includes(rendered)) failures.push(rendered);
}

function sha(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function inventory(root: string): { files: number; bytes: number; digest: string; writablePaths: string[] } {
  const files = filesBelow(root); const hash = crypto.createHash('sha256'); let bytes = 0;
  for (const file of files) {
    const content = fs.readFileSync(file); const relative = path.relative(root, file); bytes += content.length;
    hash.update(relative); hash.update('\0'); hash.update(crypto.createHash('sha256').update(content).digest('hex')); hash.update('\n');
  }
  const writablePaths = [root, ...pathsBelow(root)].filter((target) => (fs.statSync(target).mode & 0o222) !== 0)
    .map((target) => path.relative(root, target) || '.');
  return { files: files.length, bytes, digest: hash.digest('hex'), writablePaths };
}

function filesBelow(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const result: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(target));
    else result.push(target);
  }
  return result.sort();
}

function pathsBelow(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name); return entry.isDirectory() ? [target, ...pathsBelow(target)] : [target];
  }).sort();
}

async function readJsonl(file: string): Promise<{ rows: JsonRow[]; malformed: number }> {
  if (!fs.existsSync(file)) return { rows: [], malformed: 0 };
  const input = file.endsWith('.gz') ? fs.createReadStream(file).pipe(createGunzip()) : fs.createReadStream(file);
  const reader = readline.createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  const rows: JsonRow[] = []; let malformed = 0;
  for await (const line of reader) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row && typeof row === 'object' && !Array.isArray(row)) rows.push(row);
      else malformed += 1;
    } catch { malformed += 1; }
  }
  return { rows, malformed };
}

async function ledger(root: string, name: string): Promise<JsonRow[]> {
  const file = path.join(root, name); const parsed = await readJsonl(file);
  if (parsed.malformed) fail('MALFORMED_ACTIVE_LEDGER', `${name}:${parsed.malformed}`);
  return parsed.rows;
}

function verifyUnique(name: string, rows: JsonRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (typeof row.id !== 'string' || !row.id) fail('MISSING_RECORD_ID', name);
    else if (seen.has(row.id)) fail('DUPLICATE_RECORD_ID', `${name}:${row.id}`);
    else seen.add(row.id);
  }
}

function close(left: unknown, right: unknown, tolerance = 1e-6): boolean {
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right))
    && Math.abs(Number(left) - Number(right)) <= tolerance;
}

const [contracts, versions, lifecycle, kills, decisions, outcomes, preparations, authorizations, consumptions, states] = await Promise.all([
  ledger(activeEconomics, 'paper-trade-contracts.jsonl'),
  ledger(activeEconomics, 'strategy-versions.jsonl'),
  ledger(activeEconomics, 'lifecycle-events.jsonl'),
  ledger(activeEconomics, 'kill-events.jsonl'),
  ledger(activeEconomics, 'shadow-decisions.jsonl'),
  ledger(activeEconomics, 'shadow-outcomes.jsonl'),
  ledger(liveReviewRoot, 'preparations.jsonl'),
  ledger(liveReviewRoot, 'authorizations.jsonl'),
  ledger(liveReviewRoot, 'consumptions.jsonl'),
  ledger(liveReviewRoot, 'execution-states.jsonl'),
]);

for (const [name, rows] of Object.entries({ contracts, versions, lifecycle, kills, decisions, outcomes,
  preparations, authorizations, consumptions, states })) verifyUnique(name, rows);

const contractById = new Map(contracts.map((row) => [row.id, row]));
const versionIds = new Set(versions.map((row) => row.id));
const decisionById = new Map(decisions.map((row) => [row.id, row]));
const preparationIds = new Set(preparations.map((row) => row.id));
const authorizationIds = new Set(authorizations.map((row) => row.id));
const outcomeDecisionIds = new Set<string>();
const advancedContracts = new Set(lifecycle.filter((row) => row.passed && row.to !== 'research_candidate').map((row) => row.contractId));

for (const contract of contracts) {
  if (!contract.immutable || contract.liveExecution !== 'locked') fail('UNSAFE_CONTRACT', contract.id);
  if (!versionIds.has(contract.strategyVersionId)) fail('MISSING_STRATEGY_VERSION', contract.id);
  const costs = contract.costs || {};
  const summed = ['feeBps', 'spreadBps', 'slippageBps', 'impactBps', 'fundingBps', 'borrowBps',
    'adverseSelectionBps', 'latencyBps'].reduce((total, key) => total + Number(costs[key] || 0), 0);
  if (!close(summed, costs.totalBps, 1e-9)) fail('COST_TOTAL_MISMATCH', contract.id);
  if (advancedContracts.has(contract.id)
    && (!(Number(contract.economics?.tailRiskPenaltyUsdPerDay) > 0)
      || !(Number(contract.economics?.drawdownPenaltyUsdPerDay) > 0))) fail('PROMOTED_WITH_UNMEASURED_RISK', contract.id);
}

for (const event of lifecycle) {
  if (!contractById.has(event.contractId)) fail('ORPHAN_LIFECYCLE', event.id);
  if (event.liveExecution !== 'locked') fail('UNSAFE_LIFECYCLE', event.id);
  if (!Array.isArray(event.eligibleSampleIds)) fail('LIFECYCLE_SAMPLE_SET_MISSING', event.id);
  if (!(Number(event.independentBlockCount) >= 0)) fail('LIFECYCLE_BLOCK_COUNT_INVALID', event.id);
  const expectedAlpha = 0.05 / (Number(event.statisticalLookNumber) * (Number(event.statisticalLookNumber) + 1));
  if (event.passed && (!Number.isInteger(event.statisticalLookNumber) || event.statisticalLookNumber < 1
    || !close(event.alphaSpent, expectedAlpha, 1e-12))) fail('LIFECYCLE_ALPHA_SPENDING_INVALID', event.id);
}
for (const event of kills) {
  if (!contractById.has(event.contractId)) fail('ORPHAN_KILL', event.id);
  if (event.liveExecution !== 'locked') fail('UNSAFE_KILL_EVENT', event.id);
}

for (const decision of decisions) {
  if (!contractById.has(decision.contractId)) fail('ORPHAN_DECISION', decision.id);
  if (decision.liveExecution !== 'locked') fail('UNSAFE_DECISION', decision.id);
  if (!(Number(decision.recordedAt) >= Number(decision.decidedAt)
    && Number(decision.recordedAt) >= Number(decision.evidenceCutoffAt)
    && Number(decision.expiresAt) > Number(decision.recordedAt))) fail('DECISION_CAUSALITY_INVALID', decision.id);
  if (decision.evidenceMode === 'paper_forward' && Number(decision.decisionLagMs) < 0) fail('FORWARD_DECISION_LAG_INVALID', decision.id);
  if (decision.evidenceMode === 'paper_forward' && Number(decision.recordedAt) < activeCutoverAt) fail('FORWARD_DECISION_PRECEDES_CUTOVER', decision.id);
}

for (const outcome of outcomes) {
  const decision = decisionById.get(outcome.decisionId);
  if (!decision) { fail('ORPHAN_OUTCOME', outcome.id); continue; }
  if (outcomeDecisionIds.has(outcome.decisionId)) fail('MULTIPLE_OUTCOMES_FOR_DECISION', outcome.decisionId);
  outcomeDecisionIds.add(outcome.decisionId);
  if (outcome.contractId !== decision.contractId || outcome.evidenceMode !== decision.evidenceMode) fail('OUTCOME_DECISION_MISMATCH', outcome.id);
  if (decision.cohort === 'no_trade' && outcome.status !== 'risk_rejected' && outcome.status !== 'no_trade') {
    fail('NO_TRADE_DECISION_BECAME_EXECUTABLE', outcome.id);
  }
  if (outcome.liveExecution !== 'locked') fail('UNSAFE_OUTCOME', outcome.id);
  if (outcome.promotable && (outcome.evidenceMode !== 'paper_forward' || !outcome.timingValid)) fail('INELIGIBLE_PROMOTABLE_OUTCOME', outcome.id);
  if (!close(outcome.navAfterUsd, Number(outcome.navBeforeUsd) + Number(outcome.netPnlUsd))) fail('NAV_RECONCILIATION_FAILED', outcome.id);
  const ledgerNet = Number(outcome.grossPnlUsd) - Number(outcome.feeUsd) - Number(outcome.fundingUsd) - Number(outcome.borrowUsd);
  if (!close(outcome.netPnlUsd, ledgerNet)) fail('PNL_RECONCILIATION_FAILED', outcome.id);
  if (!close(outcome.noTradeCounterfactualNetPnlUsd, 0)) fail('NO_TRADE_COUNTERFACTUAL_NOT_ZERO', outcome.id);
  if (outcome.status !== 'risk_rejected' && Number(outcome.resolvedAt) < Number(decision.recordedAt)) fail('OUTCOME_PRECEDES_DECISION', outcome.id);
  if (outcome.timingValid) {
    const contract = contractById.get(outcome.contractId); const tolerance = contract?.speedTier === 'microstructure' ? 250 : 1_000;
    if (!Number.isFinite(Number(outcome.timingDeviationMs)) || Math.abs(Number(outcome.timingDeviationMs)) > tolerance) {
      fail('TIMING_VALID_OUTSIDE_TOLERANCE', outcome.id);
    }
  }
}

const referencedEventIds = new Set<string>();
for (const decision of decisions) for (const id of decision.sourceSignalEventIds || []) referencedEventIds.add(id);
for (const outcome of outcomes) for (const id of outcome.sourceEventIds || []) referencedEventIds.add(id);
const events = new Map<string, JsonRow>(); let rawMalformed = 0;
if (referencedEventIds.size) {
  for (const file of filesBelow(path.join(activeFast, 'raw')).filter((name) => name.endsWith('.jsonl') || name.endsWith('.jsonl.gz'))) {
    const parsed = await readJsonl(file); rawMalformed += parsed.malformed;
    for (const row of parsed.rows) if (referencedEventIds.has(row.id)) events.set(row.id, row);
  }
}
if (rawMalformed) fail('MALFORMED_ACTIVE_RAW_EVIDENCE', rawMalformed);
for (const decision of decisions) {
  for (const id of decision.sourceSignalEventIds || []) {
    const event = events.get(id);
    if (!event) fail('DECISION_SOURCE_EVENT_MISSING', `${decision.id}:${id}`);
    else if (Number(event.receivedAt) > Number(decision.recordedAt)) fail('DECISION_USED_LATE_EVIDENCE', `${decision.id}:${id}`);
    else if (decision.evidenceMode === 'paper_forward' && Number(event.receivedAt) < activeCutoverAt) {
      fail('FORWARD_DECISION_USED_PRECUTOVER_EVIDENCE', `${decision.id}:${id}`);
    }
  }
}
for (const outcome of outcomes) {
  const decision = decisionById.get(outcome.decisionId); if (!decision) continue;
  const signalIds = new Set(decision.sourceSignalEventIds || []);
  for (const id of outcome.sourceEventIds || []) {
    const event = events.get(id);
    if (!event) fail('OUTCOME_SOURCE_EVENT_MISSING', `${outcome.id}:${id}`);
    else if (!signalIds.has(id) && Number(event.receivedAt) <= Number(decision.recordedAt)) {
      fail('OUTCOME_USED_PREDECISION_EVENT', `${outcome.id}:${id}`);
    }
  }
}

for (const authorization of authorizations) {
  if (!preparationIds.has(authorization.preparationId)) fail('ORPHAN_AUTHORIZATION', authorization.id);
  if (authorization.oneTime !== true || authorization.state !== 'approved') fail('INVALID_AUTHORIZATION', authorization.id);
}
const consumed = new Set<string>();
for (const consumption of consumptions) {
  if (!authorizationIds.has(consumption.authorizationId)) fail('ORPHAN_CONSUMPTION', consumption.id);
  if (consumed.has(consumption.authorizationId)) fail('REUSED_AUTHORIZATION', consumption.authorizationId);
  consumed.add(consumption.authorizationId);
}
for (const state of states) if (!authorizationIds.has(state.authorizationId)) fail('ORPHAN_EXECUTION_STATE', state.id);

const runtimeEnabled = process.env.LIVE_EXECUTION_ENABLED === 'true'
  && process.env.LIVE_REVIEW_EXECUTION_CERTIFIED === 'true';
checks.liveExecutionEnvironment = { LIVE_EXECUTION_ENABLED: process.env.LIVE_EXECUTION_ENABLED ?? 'unset',
  LIVE_REVIEW_EXECUTION_CERTIFIED: process.env.LIVE_REVIEW_EXECUTION_CERTIFIED ?? 'unset', runtimeEnabled };
if (runtimeEnabled) fail('LIVE_EXECUTION_ENABLED_DURING_RECOVERY');

if (baselineRequired) {
  const archiveContracts = path.join(archiveRoot, 'economics-legacy', 'paper-trade-contracts.jsonl');
  const archiveResearch = path.join(archiveRoot, 'fast-perps-legacy', 'research-runs.jsonl');
  const archivedBooks = path.join(archiveRoot, 'fast-perps-legacy', 'books-2026-07-16.jsonl');
  const contractRows = await readJsonl(archiveContracts); const researchRows = await readJsonl(archiveResearch);
  checks.archiveContracts = contractRows.rows.length; checks.archiveResearchRuns = researchRows.rows.length;
  checks.archiveBookSha256 = fs.existsSync(archivedBooks) ? sha(archivedBooks) : null;
  checks.archiveContractSha256 = fs.existsSync(archiveContracts) ? sha(archiveContracts) : null;
  checks.archiveResearchSha256 = fs.existsSync(archiveResearch) ? sha(archiveResearch) : null;
  if (checks.archiveContracts !== 14_312) fail('ARCHIVE_CONTRACT_COUNT_MISMATCH');
  if (checks.archiveResearchRuns !== 37) fail('ARCHIVE_RESEARCH_COUNT_MISMATCH');
  if (checks.archiveBookSha256 !== '8aae9b4a6d3d4ae42c9000b5e52af129f2f7352795e9d7485fc3a92a366c4652') {
    fail('ARCHIVE_BOOK_HASH_MISMATCH');
  }
  if (checks.archiveContractSha256 !== '2400cf4a9ae993455f33a0611eef153adf08360d908d39fab8a0f076044e7505') {
    fail('ARCHIVE_CONTRACT_HASH_MISMATCH');
  }
  if (checks.archiveResearchSha256 !== '069bc26273f878109378952f76233147c7eefc0d757db9d6c5f3e46c017900e4') {
    fail('ARCHIVE_RESEARCH_HASH_MISMATCH');
  }
  const legacyManifest = path.join(projectRoot, 'data', 'archive', 'flywheel-v3-runaway-2026-07-16-manifest.md');
  const legacyManifestText = fs.existsSync(legacyManifest) ? fs.readFileSync(legacyManifest, 'utf8') : '';
  if (!legacyManifestText.includes('LEGACY_RETROSPECTIVE_FAST_PIPELINE')
    || !legacyManifestText.includes('Forward eligibility: none')) fail('LEGACY_ARCHIVE_POLICY_MISSING');
  const legacyArchiveInventory = inventory(archiveRoot);
  checks.legacyArchiveReadOnly = legacyArchiveInventory.writablePaths.length === 0;
  if (legacyArchiveInventory.writablePaths.length || !fs.existsSync(legacyManifest)
    || (fs.statSync(legacyManifest).mode & 0o222) !== 0) fail('LEGACY_ARCHIVE_NOT_READ_ONLY');
  const cutoverFile = path.join(projectRoot, 'data', 'opportunity-factory-v3', 'fast-perp-cutover.json');
  if (!fs.existsSync(cutoverFile)) fail('PREACCEPTANCE_CUTOVER_MISSING');
  else {
    const cutover = JSON.parse(fs.readFileSync(cutoverFile, 'utf8')); const manifestFile = path.join(cutover.archiveRoot, 'manifest.json');
    if (!fs.existsSync(manifestFile)) fail('PREACCEPTANCE_ARCHIVE_MANIFEST_MISSING');
    else {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      checks.preacceptanceCutover = { cutoverAt: cutover.cutoverAt, archiveRoot: cutover.archiveRoot,
        evidenceBeforeCutover: cutover.evidenceBeforeCutover, evidenceAtOrAfterCutover: cutover.evidenceAtOrAfterCutover };
      if (manifest.promotable !== false || manifest.evidenceBeforeCutover !== 'historical_replay'
        || manifest.evidenceAtOrAfterCutover !== 'paper_forward') fail('PREACCEPTANCE_CUTOVER_POLICY_INVALID');
      for (const [name, expected] of Object.entries(manifest.moved || {}) as [string, any][]) {
        const measured = inventory(path.join(cutover.archiveRoot, name));
        if (measured.files !== expected.files || measured.bytes !== expected.bytes || measured.digest !== expected.digest) {
          fail('PREACCEPTANCE_ARCHIVE_DIGEST_MISMATCH', name);
        }
        if (measured.writablePaths.length) fail('PREACCEPTANCE_ARCHIVE_NOT_READ_ONLY', name);
      }
    }
  }
  if (!fs.existsSync(replayFile)) fail('DETERMINISTIC_REPLAY_MISSING');
  else {
    const replay = JSON.parse(fs.readFileSync(replayFile, 'utf8'));
    checks.replay = { decisions: replay.first?.decisions, outcomes: replay.first?.outcomes,
      promotable: replay.first?.promotable, deterministic: replay.deterministic,
      restartPreserved: replay.first?.restartPreserved, hash: replay.first?.hash };
    if (Number(replay.first?.decisions) < 100 || Number(replay.first?.outcomes) < 100) fail('CANARY_SUPPORT_BELOW_100');
    if (Number(replay.first?.promotable) !== 0) fail('CANARY_PROMOTABLE_EVIDENCE_PRESENT');
    if (!replay.deterministic || !replay.first?.restartPreserved || replay.first?.hash !== replay.secondHash) fail('REPLAY_NOT_DETERMINISTIC');
    const requiredPaths = ['lifecyclePass', 'lifecycleDecline', 'filled', 'unresolved', 'riskRejected',
      'killTriggered', 'restartPreserved', 'malformedRowRecovered'];
    for (const replayPath of requiredPaths) if (replay.first?.paths?.[replayPath] !== true) fail('REPLAY_PATH_NOT_EXERCISED', replayPath);
  }
}

if (runtimeRequired) {
  const clockDefinitions: Record<string, number> = { signal_evaluator: 250, outcome_resolver: 1_000,
    challenger_research: 21_600_000, lifecycle_evaluator: 60_000 };
  for (const [clock, cadenceMs] of Object.entries(clockDefinitions)) {
    const file = path.join(operatorRoot, 'heartbeats', `${clock}.json`);
    if (!fs.existsSync(file)) { fail('RUNTIME_HEARTBEAT_MISSING', clock); continue; }
    const heartbeat = JSON.parse(fs.readFileSync(file, 'utf8'));
    const freshAt = Math.max(Number(heartbeat.completedAt) || 0, Number(heartbeat.heartbeatAt) || 0);
    const freshnessBudgetMs = heartbeat.phase === 'running' ? Math.min(cadenceMs, 60_000) : cadenceMs;
    if (heartbeat.status !== 'healthy' || now - freshAt > freshnessBudgetMs
      || Number(heartbeat.queueDepth) > 10_000 || Number(heartbeat.queueLagMs) > 30_000) fail('RUNTIME_HEARTBEAT_UNHEALTHY', clock);
  }
  const storageFile = path.join(operatorRoot, 'storage-health.json');
  if (!fs.existsSync(storageFile) || JSON.parse(fs.readFileSync(storageFile, 'utf8')).healthy !== true) fail('RUNTIME_STORAGE_UNHEALTHY');
}

checks.active = { contracts: contracts.length, strategyVersions: versions.length, lifecycleEvents: lifecycle.length,
  kills: kills.length, decisions: decisions.length, outcomes: outcomes.length, referencedEvents: referencedEventIds.size,
  recoveredEvents: events.size, preparations: preparations.length, authorizations: authorizations.length,
  consumptions: consumptions.length, executionStates: states.length };
checks.integrity = { duplicateFree: !failures.some((item) => item.startsWith('DUPLICATE_RECORD_ID')),
  causal: !failures.some((item) => item.includes('CAUSALITY') || item.includes('LATE_EVIDENCE')
    || item.includes('PREDECISION') || item.includes('PRECEDES_DECISION')),
  reconciled: !failures.some((item) => item.includes('RECONCILIATION')),
  liveLocked: !runtimeEnabled };

const result = { schemaVersion: 2, verifiedAt: now, source: 'persisted-state-independent-verifier',
  baselineRequired, runtimeRequired, checks, failures: failures.sort(), passed: failures.length === 0,
  liveExecution: runtimeEnabled ? 'enabled' : 'locked' };
const output = path.resolve(process.env.VERIFY_OUTPUT || path.join(projectRoot, 'output', 'proof',
  'flywheel-recovery', 'persisted-state-verification.json'));
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ output, ...result }, null, 2));
if (failures.length) process.exitCode = 1;
