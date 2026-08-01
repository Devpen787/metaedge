import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { discoverCrossMarketRelationships, runCatalystExperiments } from './experiments.js';
import { persistFactoryOutput } from './store.js';
import { readFactoryConfig } from './sources.js';
import type { FactoryDisposition, FactoryRun } from './types.js';
import { legacyWritersEnabled } from '../v5/authority.js';

const INTERVAL_MS = Math.max(15 * 60_000, Number(process.env.OPPORTUNITY_FACTORY_INTERVAL_MS) || 6 * 60 * 60_000);
let running = false;

export async function runOpportunityFactory(): Promise<FactoryRun> {
  if (!legacyWritersEnabled()) throw new Error('LEGACY_WRITER_DISABLED:OPPORTUNITY_FACTORY_V3');
  if (running) throw new Error('OPPORTUNITY_FACTORY_OVERLAP');
  running = true; const startedAt = Date.now(); const runId = `factory_${crypto.createHash('sha256').update(String(startedAt)).digest('hex').slice(0, 16)}`;
  try {
    const cfg = readFactoryConfig();
    const catalysts = await runCatalystExperiments(runId);
    const relationships = discoverCrossMarketRelationships(runId);
    const errors = [...catalysts.errors, ...relationships.errors];
    const dispositions: Record<FactoryDisposition, number> = { declined: 0, research_hypothesis: 0, forward_paper_candidate: 0 };
    for (const card of catalysts.cards) dispositions[card.disposition]++;
    const run: FactoryRun = {
      id: runId, startedAt, completedAt: Date.now(), status: errors.length ? 'degraded' : 'completed',
      universe: { stocks: cfg.stock.symbols.map((x) => x.symbol), crypto: cfg.crypto.symbols, memecoins: cfg.memecoins.symbols },
      observations: catalysts.observations, cards: catalysts.cards.length, relationships: relationships.relationships.length,
      dispositions, errors, liveExecution: 'locked',
    };
    persistFactoryOutput(run, catalysts.cards, relationships.relationships);
    return run;
  } catch (error: any) {
    const cfg = readFactoryConfig();
    const run: FactoryRun = { id: runId, startedAt, completedAt: Date.now(), status: 'failed',
      universe: { stocks: cfg.stock.symbols.map((x) => x.symbol), crypto: cfg.crypto.symbols, memecoins: cfg.memecoins.symbols },
      observations: 0, cards: 0, relationships: 0,
      dispositions: { declined: 0, research_hypothesis: 0, forward_paper_candidate: 0 }, errors: [error.message], liveExecution: 'locked' };
    persistFactoryOutput(run, [], []); return run;
  } finally { running = false; }
}

export function startOpportunityFactory() {
  if (!legacyWritersEnabled()) {
    console.log('[opportunity-factory] legacy v3 writer disabled by v5 authority');
    return;
  }
  if (process.env.OPPORTUNITY_FACTORY_DISABLED === 'true') { console.log('[opportunity-factory] disabled'); return; }
  let childRunning = false;
  const run = () => {
    if (childRunning) { console.warn('[opportunity-factory] skipped overlapping child run'); return; }
    childRunning = true;
    const tsx = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
    execFile(tsx, ['scripts/flywheel_v3_cycle.ts'], { cwd: process.cwd(), timeout: 5 * 60_000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
      childRunning = false;
      if (error) { console.warn('[opportunity-factory] child run failed:', error.message); return; }
      try {
        const result = JSON.parse(stdout);
        const loops = Object.values(result.loops ?? {}) as Array<{ outcome?: string }>;
        const completed = loops.filter((loop) => loop.outcome === 'completed').length;
        const noOp = loops.filter((loop) => loop.outcome === 'no_op').length;
        const exceptions = loops.filter((loop) => loop.outcome === 'failed' || loop.outcome === 'escalated').length;
        console.log(`[opportunity-factory] v3: loops=${completed} completed/${noOp} no-op/${exceptions} exception; acquisition=${result.acquisition.outcome} discovery=${result.discovery.outcome} states=${result.states} trials=${result.trials} forwards=${result.forwardObservations} lifecycle=${result.lifecycle}; live locked`);
      } catch { console.warn('[opportunity-factory] child completed with unreadable summary'); }
    });
  };
  setTimeout(run, 15_000).unref(); setInterval(run, INTERVAL_MS).unref();
  console.log(`[opportunity-factory] governed paper flywheel v3 every ${Math.round(INTERVAL_MS / 60_000)}min; live execution locked`);
}
