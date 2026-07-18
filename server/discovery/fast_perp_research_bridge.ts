import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EconomicOperationStore } from './economic_store.js';
import type { PaperTradeContract, PaperTradeLifecycleEvent } from './economic_types.js';
import { runFastPerpResearchCycle } from './fast_perp_research.js';
import type { FastPerpResearchRun } from './fast_perp_research_types.js';
import { FastPerpEvidenceStore } from './fast_perp_store.js';
import type { FastPerpBookEvent, FastPerpContextEvent, FastPerpTradeEvent } from './fast_perp_types.js';
import { contentHash } from './store.js';
import type { ResearchBatchHealth } from './fast_perp_types.js';

const SCHEMA_VERSION = 1 as const;
const DEFAULT_WINDOW_MS = 48 * 60 * 60_000;
const DEFAULT_EXPIRY_MS = 6 * 60 * 60_000;

function streamingContentHash(value: unknown): string {
  const hash = crypto.createHash('sha256');
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) {
      hash.update('['); for (let index = 0; index < item.length; index += 1) {
        if (index) hash.update(','); visit(item[index]);
      } hash.update(']'); return;
    }
    if (item && typeof item === 'object') {
      hash.update('{'); const entries = Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      for (let index = 0; index < entries.length; index += 1) {
        if (index) hash.update(','); hash.update(JSON.stringify(entries[index][0])); hash.update(':'); visit(entries[index][1]);
      } hash.update('}'); return;
    }
    hash.update(JSON.stringify(item));
  };
  visit(value); return hash.digest('hex');
}

interface EvidencePayload {
  fromReceivedAt: number;
  toReceivedAt: number;
  trades: FastPerpTradeEvent[];
  books: FastPerpBookEvent[];
  contexts: FastPerpContextEvent[];
  priorResearchRuns: FastPerpResearchRun[];
  priorContracts: PaperTradeContract[];
}

export interface FastPerpEvidenceExportBundle {
  schemaVersion: 1;
  kind: 'fast_perp_evidence_export';
  id: string;
  createdAt: number;
  expiresAt: number;
  authorityDigest: string;
  payloadHash: string;
  payload: EvidencePayload;
  liveExecution: 'locked';
}

interface ProposalPayload {
  run: FastPerpResearchRun;
  runIsNew: boolean;
  contracts: PaperTradeContract[];
  lifecycleEvents: PaperTradeLifecycleEvent[];
}

export interface FastPerpResearchProposalBundle {
  schemaVersion: 1;
  kind: 'fast_perp_research_proposal';
  id: string;
  createdAt: number;
  expiresAt: number;
  evidenceExportId: string;
  evidenceExportHash: string;
  authorityDigest: string;
  payloadHash: string;
  payload: ProposalPayload;
  liveExecution: 'locked';
}

export interface FastPerpResearchAttempt {
  schemaVersion: 1; id: string; evidenceExportId: string; startedAt: number; deadlineAt: number;
  completedAt: number | null; status: 'running' | 'completed' | 'failed' | 'timed_out' | 'abandoned';
  proposalId: string | null; failureReason: string | null; liveExecution: 'locked';
}

function authorityDigest(evidenceStore: FastPerpEvidenceStore, economicStore: EconomicOperationStore,
  exclude: { runIds?: Set<string>; contractIds?: Set<string> } = {}): string {
  return streamingContentHash({
    researchRuns: evidenceStore.readResearchRuns().filter((row) => !exclude.runIds?.has(row.id))
      .sort((left, right) => left.id.localeCompare(right.id)),
    contracts: economicStore.readContracts().filter((row) => !exclude.contractIds?.has(row.id))
      .sort((left, right) => left.id.localeCompare(right.id)),
  });
}

function evidenceBundleId(input: { createdAt: number; expiresAt: number; authorityDigest: string; payloadHash: string }): string {
  return `fast_perp_evidence_export_${contentHash({ schemaVersion: SCHEMA_VERSION, kind: 'fast_perp_evidence_export',
    createdAt: input.createdAt, expiresAt: input.expiresAt, authorityDigest: input.authorityDigest,
    payloadHash: input.payloadHash }).slice(0, 24)}`;
}

function proposalBundleId(input: { createdAt: number; expiresAt: number; authorityDigest: string; payloadHash: string;
  evidenceExportId: string; evidenceExportHash: string }): string {
  return `fast_perp_research_proposal_${contentHash({ schemaVersion: SCHEMA_VERSION,
    kind: 'fast_perp_research_proposal', createdAt: input.createdAt, expiresAt: input.expiresAt,
    authorityDigest: input.authorityDigest, payloadHash: input.payloadHash,
    evidenceExportId: input.evidenceExportId, evidenceExportHash: input.evidenceExportHash }).slice(0, 24)}`;
}

function validateEvidenceExport(bundle: FastPerpEvidenceExportBundle): void {
  if (bundle.liveExecution !== 'locked') throw new Error('RESEARCH_BUNDLE_LIVE_NOT_LOCKED');
  if (bundle.schemaVersion !== SCHEMA_VERSION || bundle.kind !== 'fast_perp_evidence_export') {
    throw new Error('RESEARCH_BUNDLE_SCHEMA_UNSUPPORTED');
  }
  if (streamingContentHash(bundle.payload) !== bundle.payloadHash) throw new Error('RESEARCH_BUNDLE_HASH_MISMATCH');
  if (evidenceBundleId(bundle) !== bundle.id) {
    throw new Error('RESEARCH_BUNDLE_ID_MISMATCH');
  }
  if (bundle.payload.trades.some((row) => row.liveExecution !== 'locked')
    || bundle.payload.books.some((row) => row.liveExecution !== 'locked')
    || bundle.payload.contexts.some((row) => row.liveExecution !== 'locked')) {
    throw new Error('RESEARCH_BUNDLE_LIVE_NOT_LOCKED');
  }
}

function validateProposal(bundle: FastPerpResearchProposalBundle): void {
  if (bundle.liveExecution !== 'locked') throw new Error('RESEARCH_BUNDLE_LIVE_NOT_LOCKED');
  if (bundle.schemaVersion !== SCHEMA_VERSION || bundle.kind !== 'fast_perp_research_proposal') {
    throw new Error('RESEARCH_BUNDLE_SCHEMA_UNSUPPORTED');
  }
  if (streamingContentHash(bundle.payload) !== bundle.payloadHash) throw new Error('RESEARCH_BUNDLE_HASH_MISMATCH');
  if (proposalBundleId(bundle) !== bundle.id) {
    throw new Error('RESEARCH_BUNDLE_ID_MISMATCH');
  }
  if (bundle.payload.run.liveExecution !== 'locked'
    || bundle.payload.contracts.some((row) => row.liveExecution !== 'locked' || !row.immutable)
    || bundle.payload.lifecycleEvents.some((row) => row.liveExecution !== 'locked')) {
    throw new Error('RESEARCH_BUNDLE_LIVE_NOT_LOCKED');
  }
}

export function createFastPerpEvidenceExport(options: { evidenceStore?: FastPerpEvidenceStore;
  economicStore?: EconomicOperationStore; now?: number; windowMs?: number } = {}): FastPerpEvidenceExportBundle {
  const evidenceStore = options.evidenceStore ?? new FastPerpEvidenceStore();
  const economicStore = options.economicStore ?? new EconomicOperationStore();
  const createdAt = options.now ?? Date.now();
  const fromReceivedAt = Math.max(0, createdAt - (options.windowMs ?? DEFAULT_WINDOW_MS));
  const snapshot = evidenceStore.snapshot(createdAt); const symbols = [...snapshot.symbols].sort();
  const payload: EvidencePayload = {
    fromReceivedAt, toReceivedAt: createdAt,
    trades: symbols.flatMap((symbol) => evidenceStore.readTrades({ symbol, fromReceivedAt,
      toReceivedAt: createdAt, limit: 100_000 })),
    books: symbols.flatMap((symbol) => evidenceStore.readBooks({ symbol, fromReceivedAt,
      toReceivedAt: createdAt, limit: 50_000 })),
    contexts: symbols.flatMap((symbol) => evidenceStore.readContexts({ symbol, fromReceivedAt,
      toReceivedAt: createdAt, limit: 20_000 })),
    priorResearchRuns: evidenceStore.readResearchRuns(), priorContracts: economicStore.readContracts(),
  };
  const authority = authorityDigest(evidenceStore, economicStore); const payloadHash = streamingContentHash(payload);
  return { schemaVersion: SCHEMA_VERSION, kind: 'fast_perp_evidence_export',
    id: evidenceBundleId({ createdAt, expiresAt: createdAt + DEFAULT_EXPIRY_MS,
      authorityDigest: authority, payloadHash }), createdAt,
    expiresAt: createdAt + DEFAULT_EXPIRY_MS, authorityDigest: authority, payloadHash, payload,
    liveExecution: 'locked' };
}

export function executeFastPerpResearchBatch(bundle: FastPerpEvidenceExportBundle,
  workRoot: string, now = bundle.createdAt): FastPerpResearchProposalBundle {
  validateEvidenceExport(bundle);
  if (now > bundle.expiresAt) throw new Error('RESEARCH_EVIDENCE_EXPORT_EXPIRED');
  const attemptRoot = path.join(workRoot, bundle.id); fs.mkdirSync(attemptRoot, { recursive: true });
  const group = <T extends { symbol: string; receivedAt: number }>(rows: T[]) => {
    const grouped = new Map<string, T[]>();
    for (const row of rows) { const bucket = grouped.get(row.symbol) ?? []; bucket.push(row); grouped.set(row.symbol, bucket); }
    for (const bucket of grouped.values()) bucket.sort((a, b) => a.receivedAt - b.receivedAt); return grouped;
  };
  const trades = group(bundle.payload.trades); const books = group(bundle.payload.books); const contexts = group(bundle.payload.contexts);
  const researchRuns = [...bundle.payload.priorResearchRuns];
  const read = <T extends { receivedAt: number }>(rows: T[], query: { fromReceivedAt?: number; toReceivedAt?: number;
    limit?: number }) => {
    const filtered = rows.filter((row) => (query.fromReceivedAt == null || row.receivedAt >= query.fromReceivedAt)
      && (query.toReceivedAt == null || row.receivedAt <= query.toReceivedAt));
    return query.limit == null ? filtered : filtered.slice(-Math.max(0, query.limit));
  };
  const latestTradeAt = bundle.payload.trades.reduce((value, row) => Math.max(value, row.receivedAt), 0);
  const latestBookAt = bundle.payload.books.reduce((value, row) => Math.max(value, row.receivedAt), 0);
  const symbols = [...new Set([...trades.keys(), ...books.keys(), ...contexts.keys()])].sort();
  const evidenceStore = {
    snapshot: () => ({ symbols, freshness: { latestTradeAt: latestTradeAt || null, latestBookAt: latestBookAt || null } }),
    readTrades: (query: { symbol?: string; fromReceivedAt?: number; toReceivedAt?: number; limit?: number }) =>
      read(trades.get(query.symbol ?? '') ?? [], query),
    readBooks: (query: { symbol?: string; fromReceivedAt?: number; toReceivedAt?: number; limit?: number }) =>
      read(books.get(query.symbol ?? '') ?? [], query),
    readContexts: (query: { symbol?: string; fromReceivedAt?: number; toReceivedAt?: number; limit?: number }) =>
      read(contexts.get(query.symbol ?? '') ?? [], query),
    readResearchRuns: () => researchRuns,
    appendResearchRuns: (rows: FastPerpResearchRun[]) => {
      const known = new Set(researchRuns.map((row) => row.id));
      for (const row of rows) if (!known.has(row.id)) { researchRuns.push(row); known.add(row.id); }
    },
  } as unknown as FastPerpEvidenceStore;
  const economicStore = new EconomicOperationStore(path.join(attemptRoot, 'economics'));
  economicStore.appendContracts(bundle.payload.priorContracts);
  const priorRunIds = new Set(bundle.payload.priorResearchRuns.map((row) => row.id));
  const priorContractIds = new Set(bundle.payload.priorContracts.map((row) => row.id));
  const priorLifecycleIds = new Set(economicStore.readLifecycleEvents().map((row) => row.id));
  const run = runFastPerpResearchCycle({ evidenceStore, economicStore, now: bundle.createdAt });
  const payload: ProposalPayload = { run, runIsNew: !priorRunIds.has(run.id),
    contracts: economicStore.readContracts().filter((row) => !priorContractIds.has(row.id)),
    lifecycleEvents: economicStore.readLifecycleEvents().filter((row) => !priorLifecycleIds.has(row.id)), };
  const payloadHash = streamingContentHash(payload); const createdAt = bundle.createdAt;
  return { schemaVersion: SCHEMA_VERSION, kind: 'fast_perp_research_proposal',
    id: proposalBundleId({ createdAt, expiresAt: bundle.expiresAt, authorityDigest: bundle.authorityDigest,
      payloadHash, evidenceExportId: bundle.id, evidenceExportHash: bundle.payloadHash }), createdAt,
    expiresAt: bundle.expiresAt,
    evidenceExportId: bundle.id, evidenceExportHash: bundle.payloadHash, authorityDigest: bundle.authorityDigest,
    payloadHash, payload, liveExecution: 'locked' };
}

export class FastPerpResearchBridge {
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'research-bridge')) {}

  private proposalFile(id: string): string {
    if (!/^fast_perp_research_proposal_[a-f0-9]{24}$/.test(id)) throw new Error('RESEARCH_PROPOSAL_ID_INVALID');
    return path.join(this.root, 'proposals', `${id}.json`);
  }
  private evidenceDir(id: string): string { return path.join(this.root, 'evidence', id); }
  private resolveEvidenceDir(fileOrId: string): string {
    return fs.existsSync(fileOrId) && fs.statSync(fileOrId).isDirectory() ? fileOrId : this.evidenceDir(fileOrId);
  }
  private attemptFile(id: string): string { return path.join(this.root, 'attempts', `${id}.json`); }
  private importFile(id: string): string { return path.join(this.root, 'imports', `${id}.json`); }
  private quarantine(file: string, reason: string): void {
    const target = path.join(this.root, 'quarantine', `${path.basename(file)}.${Date.now()}.${reason}.json`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
      if (fs.statSync(file).isDirectory()) fs.writeFileSync(target, JSON.stringify({ source: file, reason }));
      else fs.copyFileSync(file, target);
    } catch { /* missing or unreadable input is still rejected */ }
  }

  private atomicJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true }); const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value)); fs.renameSync(temporary, file);
  }

  private acquireLock(file: string, staleAfterMs: number): number {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { return fs.openSync(file, 'wx'); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try { if (Date.now() - fs.statSync(file).mtimeMs > staleAfterMs) { fs.unlinkSync(file); continue; } }
        catch { continue; }
        throw new Error('RESEARCH_BRIDGE_LOCK_HELD');
      }
    }
    throw new Error('RESEARCH_BRIDGE_LOCK_HELD');
  }

  publishEvidence(bundle: FastPerpEvidenceExportBundle, options: { failAfterChunks?: number } = {}): string {
    validateEvidenceExport(bundle); const directory = this.evidenceDir(bundle.id);
    if (fs.existsSync(directory)) { this.readEvidence(directory); return directory; }
    const staging = `${directory}.${process.pid}.${Date.now()}.staging`;
    fs.mkdirSync(staging, { recursive: true }); let writtenChunks = 0;
    const writeChunks = <T>(name: string, rows: T[]) => {
      const chunks: Array<{ file: string; count: number; hash: string }> = [];
      for (let offset = 0; offset < rows.length; offset += 5_000) {
        const slice = rows.slice(offset, offset + 5_000); const content = `${slice.map((row) => JSON.stringify(row)).join('\n')}\n`;
        const file = `${name}-${String(chunks.length).padStart(5, '0')}.jsonl`;
        fs.writeFileSync(path.join(staging, file), content);
        chunks.push({ file, count: slice.length, hash: crypto.createHash('sha256').update(content).digest('hex') });
        writtenChunks += 1;
        if (writtenChunks === options.failAfterChunks) throw new Error('INJECTED_EVIDENCE_PUBLICATION_FAILURE');
      }
      return chunks;
    };
    try {
      const manifest = { schemaVersion: 1, bundle: { ...bundle, payload: undefined },
        payload: { fromReceivedAt: bundle.payload.fromReceivedAt, toReceivedAt: bundle.payload.toReceivedAt,
          trades: writeChunks('trades', bundle.payload.trades), books: writeChunks('books', bundle.payload.books),
          contexts: writeChunks('contexts', bundle.payload.contexts),
          priorResearchRuns: writeChunks('prior-research-runs', bundle.payload.priorResearchRuns),
          priorContracts: writeChunks('prior-contracts', bundle.payload.priorContracts) } };
      fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest));
      fs.mkdirSync(path.dirname(directory), { recursive: true }); fs.renameSync(staging, directory); return directory;
    } catch (error) { fs.rmSync(staging, { recursive: true, force: true }); throw error; }
  }

  readEvidence(fileOrId: string): FastPerpEvidenceExportBundle {
    const directory = this.resolveEvidenceDir(fileOrId);
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as {
        schemaVersion: number; bundle: Omit<FastPerpEvidenceExportBundle, 'payload'>;
        payload: { fromReceivedAt: number; toReceivedAt: number; trades: Array<{ file: string; count: number; hash: string }>;
          books: Array<{ file: string; count: number; hash: string }>; contexts: Array<{ file: string; count: number; hash: string }>;
          priorResearchRuns: Array<{ file: string; count: number; hash: string }>;
          priorContracts: Array<{ file: string; count: number; hash: string }> } };
      if (manifest.schemaVersion !== 1) throw new Error('RESEARCH_BUNDLE_SCHEMA_UNSUPPORTED');
      const readChunks = <T>(name: string, chunks: Array<{ file: string; count: number; hash: string }>): T[] => chunks.flatMap((chunk) => {
        if (!new RegExp(`^${name}-[0-9]{5}\\.jsonl$`).test(chunk.file) || chunk.count < 0 || chunk.count > 5_000
          || chunks.length > 1_000) throw new Error('RESEARCH_BUNDLE_CHUNK_MANIFEST_INVALID');
        const content = fs.readFileSync(path.join(directory, chunk.file), 'utf8');
        const digest = crypto.createHash('sha256').update(content).digest('hex');
        if (digest !== chunk.hash) throw new Error('RESEARCH_BUNDLE_CHUNK_HASH_MISMATCH');
        const rows = content.split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
        if (rows.length !== chunk.count) throw new Error('RESEARCH_BUNDLE_CHUNK_COUNT_MISMATCH'); return rows;
      });
      const payload: EvidencePayload = { fromReceivedAt: manifest.payload.fromReceivedAt,
        toReceivedAt: manifest.payload.toReceivedAt, trades: readChunks('trades', manifest.payload.trades),
        books: readChunks('books', manifest.payload.books), contexts: readChunks('contexts', manifest.payload.contexts),
        priorResearchRuns: readChunks('prior-research-runs', manifest.payload.priorResearchRuns),
        priorContracts: readChunks('prior-contracts', manifest.payload.priorContracts) };
      const bundle = { ...manifest.bundle, payload } as FastPerpEvidenceExportBundle;
      validateEvidenceExport(bundle); return bundle;
    } catch (error) { this.quarantine(directory, 'REJECTED'); throw error; }
  }

  readEvidenceMetadata(fileOrId: string): Omit<FastPerpEvidenceExportBundle, 'payload'> {
    const directory = this.resolveEvidenceDir(fileOrId);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as {
      schemaVersion: number; bundle: Omit<FastPerpEvidenceExportBundle, 'payload'> };
    const bundle = manifest.bundle;
    if (manifest.schemaVersion !== 1 || bundle.schemaVersion !== 1 || bundle.kind !== 'fast_perp_evidence_export') {
      throw new Error('RESEARCH_BUNDLE_SCHEMA_UNSUPPORTED');
    }
    if (bundle.liveExecution !== 'locked') throw new Error('RESEARCH_BUNDLE_LIVE_NOT_LOCKED');
    if (evidenceBundleId(bundle) !== bundle.id) throw new Error('RESEARCH_BUNDLE_ID_MISMATCH');
    return bundle;
  }

  beginAttempt(evidenceExportId: string, now = Date.now(), timeoutMs = 5 * 60_000): FastPerpResearchAttempt {
    const lockFile = path.join(this.root, 'attempts', '.begin.lock'); const lock = this.acquireLock(lockFile, 30_000);
    try {
      this.reconcileExpiredAttempts(now);
      const running = this.readAttempts().find((row) => row.status === 'running');
      if (running) throw new Error(`RESEARCH_BATCH_ALREADY_RUNNING:${running.id}`);
      const id = `fast_perp_attempt_${contentHash({ evidenceExportId, startedAt: now }).slice(0, 24)}`;
      const attempt: FastPerpResearchAttempt = { schemaVersion: 1, id, evidenceExportId, startedAt: now,
        deadlineAt: now + timeoutMs, completedAt: null, status: 'running', proposalId: null, failureReason: null,
        liveExecution: 'locked' };
      this.atomicJson(this.attemptFile(id), attempt); return attempt;
    } finally { fs.closeSync(lock); try { fs.unlinkSync(lockFile); } catch { /* already released */ } }
  }

  finishAttempt(id: string, status: 'completed' | 'failed' | 'timed_out', options: {
    completedAt?: number; proposalId?: string | null; failureReason?: string | null } = {}): FastPerpResearchAttempt {
    const file = this.attemptFile(id); const prior = JSON.parse(fs.readFileSync(file, 'utf8')) as FastPerpResearchAttempt;
    if (prior.status !== 'running') return prior;
    const completed: FastPerpResearchAttempt = { ...prior, status, completedAt: options.completedAt ?? Date.now(),
      proposalId: options.proposalId ?? null, failureReason: options.failureReason ?? null };
    this.atomicJson(file, completed); return completed;
  }

  reconcileExpiredAttempts(now = Date.now()): FastPerpResearchAttempt[] {
    return this.readAttempts().map((row) => {
      if (row.status !== 'running' || row.deadlineAt >= now) return row;
      const abandoned: FastPerpResearchAttempt = { ...row, status: 'abandoned', completedAt: now,
        failureReason: 'PROCESS_ENDED_WITHOUT_TERMINAL_RESULT' };
      this.atomicJson(this.attemptFile(row.id), abandoned); return abandoned;
    });
  }

  readAttempts(): FastPerpResearchAttempt[] {
    const root = path.join(this.root, 'attempts'); if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root).filter((name) => name.endsWith('.json')).sort().flatMap((name) => {
      try { return [JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')) as FastPerpResearchAttempt]; }
      catch { return []; }
    });
  }

  researchBatchHealth(enabled: boolean, now = Date.now()): ResearchBatchHealth {
    const persisted = this.readAttempts().sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
    const latest = persisted?.status === 'running' && persisted.deadlineAt < now
      ? { ...persisted, status: 'abandoned' as const, completedAt: now,
        failureReason: 'PROCESS_ENDED_WITHOUT_TERMINAL_RESULT' } : persisted;
    return { id: 'challenger_research', cadenceMs: 6 * 60 * 60_000, timeoutMs: 5 * 60_000,
      latestAttemptId: latest?.id ?? null, status: enabled ? latest?.status ?? 'idle' : 'disabled',
      startedAt: latest?.startedAt ?? null, completedAt: latest?.completedAt ?? null,
      deadlineAt: latest?.deadlineAt ?? null, failureReason: latest?.failureReason ?? null,
      affectsContinuousOperation: false };
  }

  publishProposal(bundle: FastPerpResearchProposalBundle): string {
    validateProposal(bundle); const file = this.proposalFile(bundle.id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      const existing = this.readProposal(file);
      if (existing.payloadHash !== bundle.payloadHash) throw new Error('RESEARCH_PROPOSAL_ID_COLLISION');
      return file;
    }
    const temporary = `${file}.${process.pid}.${Date.now()}.staging`;
    try { fs.writeFileSync(temporary, JSON.stringify(bundle)); fs.renameSync(temporary, file); return file; }
    catch (error) { try { fs.unlinkSync(temporary); } catch { /* incomplete file is never visible */ } throw error; }
  }

  readProposal(fileOrId: string): FastPerpResearchProposalBundle {
    const file = fileOrId.endsWith('.json') ? fileOrId : this.proposalFile(fileOrId);
    try { const bundle = JSON.parse(fs.readFileSync(file, 'utf8')) as FastPerpResearchProposalBundle;
      validateProposal(bundle); return bundle;
    } catch (error) { this.quarantine(file, 'REJECTED'); throw error; }
  }

  importProposal(id: string, options: { evidenceStore?: FastPerpEvidenceStore;
    economicStore?: EconomicOperationStore; failAfter?: 'research_run' | 'contracts'; now?: number } = {}) {
    const evidenceStore = options.evidenceStore ?? new FastPerpEvidenceStore();
    const economicStore = options.economicStore ?? new EconomicOperationStore();
    const importedFile = this.importFile(id);
    if (fs.existsSync(importedFile)) return { status: 'already_imported' as const, id };
    fs.mkdirSync(path.dirname(importedFile), { recursive: true });
    const lockFile = `${importedFile}.lock`; let lock: number;
    try { lock = this.acquireLock(lockFile, 5 * 60_000); }
    catch { throw new Error('RESEARCH_IMPORT_ALREADY_RUNNING'); }
    try {
      if (fs.existsSync(importedFile)) return { status: 'already_imported' as const, id };
      const bundle = this.readProposal(id);
      if ((options.now ?? Date.now()) > bundle.expiresAt) {
        this.atomicJson(path.join(this.root, 'rejections', `${id}.json`),
          { proposalId: id, rejectedAt: options.now ?? Date.now(), reason: 'RESEARCH_PROPOSAL_EXPIRED' });
        throw new Error('RESEARCH_PROPOSAL_EXPIRED');
      }
      const currentAuthority = authorityDigest(evidenceStore, economicStore, {
        runIds: new Set(bundle.payload.runIsNew ? [bundle.payload.run.id] : []),
        contractIds: new Set(bundle.payload.contracts.map((row) => row.id)),
      });
      if (currentAuthority !== bundle.authorityDigest) {
        this.atomicJson(path.join(this.root, 'rejections', `${id}.json`),
          { proposalId: id, rejectedAt: options.now ?? Date.now(), reason: 'RESEARCH_PROPOSAL_STALE_AUTHORITY' });
        throw new Error('RESEARCH_PROPOSAL_STALE_AUTHORITY');
      }
      evidenceStore.appendResearchRuns([bundle.payload.run]);
      if (options.failAfter === 'research_run') throw new Error('INJECTED_IMPORT_FAILURE');
      economicStore.appendContracts(bundle.payload.contracts);
      if (options.failAfter === 'contracts') throw new Error('INJECTED_IMPORT_FAILURE');
      economicStore.appendLifecycleEvents(bundle.payload.lifecycleEvents);
      const result = { schemaVersion: 1, proposalId: id, importedAt: Date.now(), runId: bundle.payload.run.id,
        contractIds: bundle.payload.contracts.map((row) => row.id),
        lifecycleEventIds: bundle.payload.lifecycleEvents.map((row) => row.id), liveExecution: 'locked' as const };
      const temporary = `${importedFile}.${process.pid}.tmp`; fs.writeFileSync(temporary, JSON.stringify(result));
      fs.renameSync(temporary, importedFile); return { status: 'imported' as const, id, result };
    } finally { fs.closeSync(lock); try { fs.unlinkSync(lockFile); } catch { /* already released */ } }
  }
}
