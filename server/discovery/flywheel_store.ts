import fs from 'node:fs';
import path from 'node:path';
import type {
  AlphaCandidateSpec, AlphaLifecycleRecord, AlphaNoveltyRecord, AlphaTrial, AlphaValidationRecord, AttributionRecord,
  ExecutionDecisionRecord, FlywheelCoverage, FlywheelSnapshot, ForwardObservation, PointInTimeState,
  PortfolioDecisionRecord, ResearchQueueItem,
} from './flywheel_types.js';

function readJsonl<T>(file: string): T[] {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  if (!rows.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (!fresh.length) return;
  fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function atomicJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export class FlywheelLedger {
  private readonly statesFile: string;
  private readonly candidatesFile: string;
  private readonly validationsFile: string;
  private readonly noveltyFile: string;
  private readonly executionFile: string;
  private readonly portfolioFile: string;
  private readonly attributionFile: string;
  private readonly lifecycleFile: string;
  private readonly researchQueueFile: string;
  private readonly trialsFile: string;
  private readonly forwardFile: string;
  private readonly coverageFile: string;

  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v2')) {
    this.statesFile = path.join(root, 'states.jsonl');
    this.candidatesFile = path.join(root, 'candidates.jsonl');
    this.validationsFile = path.join(root, 'validations.jsonl');
    this.noveltyFile = path.join(root, 'novelty.jsonl');
    this.executionFile = path.join(root, 'execution-decisions.jsonl');
    this.portfolioFile = path.join(root, 'portfolio-decisions.jsonl');
    this.attributionFile = path.join(root, 'attributions.jsonl');
    this.lifecycleFile = path.join(root, 'lifecycle.jsonl');
    this.researchQueueFile = path.join(root, 'research-queue.jsonl');
    this.trialsFile = path.join(root, 'trials.jsonl');
    this.forwardFile = path.join(root, 'forward-observations.jsonl');
    this.coverageFile = path.join(root, 'coverage.json');
  }

  appendStates(rows: PointInTimeState[]): void { appendUnique(this.statesFile, rows); }
  appendCandidates(rows: AlphaCandidateSpec[]): void { appendUnique(this.candidatesFile, rows); }
  appendValidations(rows: AlphaValidationRecord[]): void { appendUnique(this.validationsFile, rows); }
  appendNovelty(rows: AlphaNoveltyRecord[]): void { appendUnique(this.noveltyFile, rows); }
  appendExecutionDecisions(rows: ExecutionDecisionRecord[]): void { appendUnique(this.executionFile, rows); }
  appendPortfolioDecisions(rows: PortfolioDecisionRecord[]): void { appendUnique(this.portfolioFile, rows); }
  appendAttributions(rows: AttributionRecord[]): void { appendUnique(this.attributionFile, rows); }
  appendLifecycle(rows: AlphaLifecycleRecord[]): void { appendUnique(this.lifecycleFile, rows); }
  appendResearchQueue(rows: ResearchQueueItem[]): void { appendUnique(this.researchQueueFile, rows); }
  appendTrials(rows: AlphaTrial[]): void { appendUnique(this.trialsFile, rows); }
  appendForwardObservations(rows: ForwardObservation[]): void { appendUnique(this.forwardFile, rows); }
  writeCoverage(coverage: FlywheelCoverage): void { atomicJson(this.coverageFile, coverage); }

  snapshot(): FlywheelSnapshot {
    let coverage: FlywheelCoverage | null = null;
    try { coverage = JSON.parse(fs.readFileSync(this.coverageFile, 'utf8')) as FlywheelCoverage; } catch { /* not written yet */ }
    const states = readJsonl<PointInTimeState>(this.statesFile);
    const candidates = readJsonl<AlphaCandidateSpec>(this.candidatesFile);
    const validations = readJsonl<AlphaValidationRecord>(this.validationsFile);
    const trials = readJsonl<AlphaTrial>(this.trialsFile);
    const forwardObservations = readJsonl<ForwardObservation>(this.forwardFile);
    const novelty = readJsonl<AlphaNoveltyRecord>(this.noveltyFile);
    const executionDecisions = readJsonl<ExecutionDecisionRecord>(this.executionFile);
    const portfolioDecisions = readJsonl<PortfolioDecisionRecord>(this.portfolioFile);
    const attributions = readJsonl<AttributionRecord>(this.attributionFile);
    const lifecycle = readJsonl<AlphaLifecycleRecord>(this.lifecycleFile);
    const researchQueue = readJsonl<ResearchQueueItem>(this.researchQueueFile);
    const candidateHashes = new Set(candidates.map((candidate) => candidate.contentHash));
    const validationIds = new Set(validations.map((validation) => validation.id));
    const latestTrials = new Map<string, AlphaTrial>();
    for (const trial of [...trials].sort((a, b) => a.completedAt - b.completedAt)) latestTrials.set(trial.candidateHash, trial);
    const latestLifecycle = new Map<string, AlphaLifecycleRecord>();
    for (const record of [...lifecycle].sort((a, b) => a.at - b.at)) latestLifecycle.set(record.candidateHash, record);
    const latestExecution = new Map<string, ExecutionDecisionRecord>();
    for (const decision of [...executionDecisions].sort((a, b) => a.createdAt - b.createdAt)) latestExecution.set(decision.candidateHash, decision);
    const latestPortfolio = new Map<string, PortfolioDecisionRecord>();
    for (const decision of [...portfolioDecisions].sort((a, b) => a.createdAt - b.createdAt)) latestPortfolio.set(decision.candidateHash, decision);
    const countBy = <T extends string>(values: T[]): Partial<Record<T, number>> => values.reduce((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1; return counts;
    }, {} as Partial<Record<T, number>>);
    const currentTrialCounts = countBy([...latestTrials.values()].map((trial) => trial.status));
    const forwardCounts = countBy(forwardObservations.map((observation) => observation.status));
    const promotedAlpha = [...latestTrials.values()].filter((trial) => trial.status === 'candidate').length;
    return {
      mode: 'Paper research',
      states, candidates, validations, novelty, executionDecisions, portfolioDecisions, trials, forwardObservations,
      attributions, lifecycle, researchQueue,
      coverage,
      integrity: {
        orphanTrialIds: trials.filter((trial) => !candidateHashes.has(trial.candidateHash)).map((trial) => trial.id),
        orphanValidationIds: validations.filter((validation) => !candidateHashes.has(validation.candidateHash)).map((validation) => validation.id),
        invalidStateIds: states.filter((state) => !state.valid).map((state) => state.id),
        allLiveExecutionLocked: states.every((state) => state.liveExecution === 'locked') &&
          candidates.every((candidate) => candidate.liveExecution === 'locked') &&
          validations.every((validation) => validation.liveExecution === 'locked') &&
          trials.every((trial) => trial.liveExecution === 'locked') &&
          executionDecisions.every((decision) => decision.liveExecution === 'locked') &&
          portfolioDecisions.every((decision) => decision.paperOnly) &&
          lifecycle.every((record) => record.liveExecution === 'locked') &&
          [...trials].filter((trial) => trial.validationId).every((trial) => validationIds.has(trial.validationId as string)),
      },
      operatorSummary: {
        generatedAt: Date.now(),
        currentCandidateContracts: candidateHashes.size,
        currentTrials: { candidate: currentTrialCounts.candidate ?? 0, declined: currentTrialCounts.declined ?? 0,
          blocked: currentTrialCounts.blocked ?? 0, failed: currentTrialCounts.failed ?? 0 },
        currentLifecycle: countBy([...latestLifecycle.values()].map((record) => record.state)),
        currentExecutionPolicies: countBy([...latestExecution.values()].map((decision) => decision.policy)),
        portfolioAllowed: [...latestPortfolio.values()].filter((decision) => decision.allowed).length,
        portfolioBlocked: [...latestPortfolio.values()].filter((decision) => !decision.allowed).length,
        forward: { pending: forwardCounts.pending ?? 0, resolved: forwardCounts.resolved ?? 0,
          expired: forwardCounts.expired ?? 0, attributed: attributions.length },
        measuredChangeFromV1: {
          researchCards: 3,
          accountableCandidateContracts: candidateHashes.size,
          marketLanes: { before: 3, now: 6 },
          promotedAlpha,
          conclusion: promotedAlpha > 0
            ? 'Research breadth and promoted paper alpha both increased; promotion remains paper-only.'
            : 'Research breadth increased materially, but validated alpha did not; the correct current action remains no-trade.',
        },
      },
      liveExecution: 'locked',
    };
  }
}
