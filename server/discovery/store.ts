import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FactoryRun, OpportunityCard, RelationshipHypothesis } from './types.js';

const DIR = path.join(process.cwd(), 'data', 'opportunity-factory');
const CARDS = path.join(DIR, 'cards.jsonl');
const RELATIONSHIPS = path.join(DIR, 'relationships.jsonl');
const RUNS = path.join(DIR, 'runs.jsonl');
const STATUS = path.join(DIR, 'status.json');

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function contentHash(value: unknown): string {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch { return []; }
}

function appendUnique<T extends { id: string }>(file: string, rows: T[]) {
  fs.mkdirSync(DIR, { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, fresh.map((row) => JSON.stringify(row)).join('\n') + '\n');
}

function atomicJson(file: string, value: unknown) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2)); fs.renameSync(tmp, file);
}

export function persistFactoryOutput(run: FactoryRun, cards: OpportunityCard[], relationships: RelationshipHypothesis[]) {
  appendUnique(CARDS, cards); appendUnique(RELATIONSHIPS, relationships); appendUnique(RUNS, [run]);
  atomicJson(STATUS, { mode: 'Paper research', liveExecution: 'locked', lastRun: run,
    latestCards: cards, latestRelationships: relationships, updatedAt: Date.now() });
}

export function readFactoryStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS, 'utf8')); } catch {
    return { mode: 'Paper research', liveExecution: 'locked', lastRun: null, latestCards: [], latestRelationships: [], updatedAt: null };
  }
}

export function readOpportunityCards(limit = 100): OpportunityCard[] {
  // Pre-v2 development cards are preserved in the append-only ledger but are
  // excluded from the current result surface because they counted overlapping
  // qualifying bars as independent observations.
  return readJsonl<OpportunityCard>(CARDS).filter((card) => card.analysisVersion === 'causal-events-clustered-v2').slice(-limit).reverse();
}
export function readRelationships(limit = 100): RelationshipHypothesis[] { return readJsonl<RelationshipHypothesis>(RELATIONSHIPS).slice(-limit).reverse(); }
