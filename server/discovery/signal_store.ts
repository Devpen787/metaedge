import fs from 'node:fs';
import path from 'node:path';
import type { SignalResearchArtifact } from './signal_types.js';

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); } catch { return []; }
}

function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  if (!rows.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

export class SignalResearchStore {
  private readonly artifactsFile: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'signals')) {
    this.artifactsFile = path.join(root, 'artifacts.jsonl');
  }
  appendArtifacts(rows: SignalResearchArtifact[]): void { appendUnique(this.artifactsFile, rows); }
  readArtifacts(): SignalResearchArtifact[] { return readJsonl(this.artifactsFile); }
  snapshot() {
    const artifacts = this.readArtifacts();
    const latestByLaneSymbol = new Map<string, SignalResearchArtifact>();
    for (const artifact of artifacts) latestByLaneSymbol.set(`${artifact.lane}:${artifact.symbol}`, artifact);
    const legacyUnaccountedArtifactIds = artifacts.filter((artifact) => !Array.isArray(artifact.researchChoices)).map((artifact) => artifact.id);
    const legacyUnversionedPolicyArtifactIds = artifacts.filter((artifact) => !artifact.researchPolicyVersion).map((artifact) => artifact.id);
    const invalidArtifactIds = artifacts.filter((artifact) => (Array.isArray(artifact.researchChoices)
      && artifact.transform.declaredTrials !== artifact.researchChoices.reduce((sum, choice) => sum + choice.trialCost, 0))
      || artifact.points.some((point) => point.availableAt < point.at)
      || (artifact.historicalResearchEligible && artifact.blockers.length > 0)).map((artifact) => artifact.id);
    const summaries = [...latestByLaneSymbol.values()].map((artifact) => ({
      id: artifact.id, createdAt: artifact.createdAt, lane: artifact.lane, symbol: artifact.symbol,
      benchmark: artifact.benchmark, observations: artifact.points.length, declaredTrials: artifact.transform.declaredTrials,
      plateauRobust: artifact.plateau.robust, informationHorizon: artifact.informationHorizon,
      holdoutEventStudies: artifact.eventStudies.filter((study) => study.split === 'holdout'),
      trafficTransitions: artifact.traffic.length, historicalResearchEligible: artifact.historicalResearchEligible,
      paperForwardEligible: artifact.paperForwardEligible, methodDisposition: artifact.methodDisposition,
      promotionDisposition: artifact.promotionDisposition, decisionReasons: artifact.decisionReasons,
      blockers: artifact.blockers, liveExecution: artifact.liveExecution,
    }));
    return { mode: 'Paper research', counts: { artifacts: artifacts.length, currentSignals: summaries.length },
      currentSignals: summaries, integrity: { invalidArtifactIds, legacyUnaccountedArtifactIds, legacyUnversionedPolicyArtifactIds,
        allLiveExecutionLocked: artifacts.every((artifact) => artifact.liveExecution === 'locked') },
      liveExecution: 'locked' as const };
  }
}
