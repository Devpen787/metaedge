import fs from 'node:fs';
import path from 'node:path';
import type { CouncilRun } from './council_types.js';

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); } catch { return []; }
}
function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

export class CouncilStore {
  private readonly runsFile: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'council')) {
    this.runsFile = path.join(root, 'runs.jsonl');
  }
  appendRuns(rows: CouncilRun[]): void { appendUnique(this.runsFile, rows); }
  readRuns(): CouncilRun[] { return readJsonl(this.runsFile); }
  snapshot() {
    const runs = this.readRuns(); const latest = new Map<string, CouncilRun>();
    for (const run of runs) latest.set(run.stream, run);
    const current = [...latest.values()].sort((left, right) => left.stream.localeCompare(right.stream));
    const invalidRunIds = runs.filter((run) => !run.numericalGate.nonOverridable
      || run.liveExecution !== 'locked' || run.manager.liveExecution !== 'locked'
      || run.numericalGate.liveExecution !== 'locked'
      || run.manager.decision === 'paper_observe' && !run.numericalGate.passed).map((run) => run.id);
    return { mode: 'Paper research', counts: { runs: runs.length, streams: current.length }, current,
      operatorSummary: { paperObserve: current.filter((run) => run.manager.decision === 'paper_observe').length,
        researchOnly: current.filter((run) => run.manager.decision === 'research_only').length,
        noTrade: current.filter((run) => run.manager.decision === 'no_trade').length,
        numericalGatePassed: current.filter((run) => run.numericalGate.passed).length },
      integrity: { invalidRunIds, allLiveExecutionLocked: runs.every((run) => run.liveExecution === 'locked') },
      liveExecution: 'locked' as const };
  }
}
