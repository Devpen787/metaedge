import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type {
  FastPerpBookEvent,
  FastPerpContextEvent,
  FastPerpGap,
  FastPerpSourceSession,
  FastPerpTradeEvent,
} from './fast_perp_types.js';
import type { FastPerpResearchRun } from './fast_perp_research_types.js';

export interface FastPerpEvidenceQuery {
  symbol?: string;
  fromReceivedAt?: number;
  toReceivedAt?: number;
  limit?: number;
}

interface StoreOptions {
  flushIntervalMs?: number;
  maximumBatchEvents?: number;
  compressPartition?: (input: Buffer) => Buffer;
}

interface MalformedRowRecord {
  id: string;
  recordedAt: number;
  file: string;
  line: number;
  reason: 'MALFORMED_JSONL_ROW';
  contentHash: string;
}

interface EvidenceSummaryState {
  schemaVersion: 1;
  updatedAt: number;
  counts: { sessions: number; gaps: number; trades: number; books: number; contexts: number; researchRuns: number };
  symbols: string[];
  latestTradeAt: number | null;
  latestBookAt: number | null;
  recentGaps: FastPerpGap[];
  recentTrades: FastPerpTradeEvent[];
  recentBooks: FastPerpBookEvent[];
  latestResearchRun: FastPerpResearchRun | null;
  latestSession: FastPerpSourceSession | null;
  invalidTradeIds: string[];
  invalidBookIds: string[];
  invalidContextIds: string[];
  allLiveExecutionLocked: boolean;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeSymbol(symbol: string): string {
  return symbol.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || '_unknown';
}

function partitionParts(at: number): { date: string; hour: string; hourKey: string } {
  const iso = new Date(at).toISOString();
  return { date: iso.slice(0, 10), hour: iso.slice(11, 13), hourKey: iso.slice(0, 13) };
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const output: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(target));
    else if (entry.isFile() && (entry.name.endsWith('.jsonl') || entry.name.endsWith('.jsonl.gz'))) output.push(target);
  }
  return output.sort();
}

export class FastPerpEvidenceStore {
  private readonly knownByFile = new Map<string, Set<string>>();
  private readonly knownHours = new Map<string, string>();
  private readonly pendingByFile = new Map<string, Array<{ id: string }>>();
  private pendingEvents = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushIntervalMs: number;
  private readonly maximumBatchEvents: number;
  private readonly compressPartition: (input: Buffer) => Buffer;
  private readonly quarantineIds = new Set<string>();
  private readonly summaryFile: string;
  private summary: EvidenceSummaryState;

  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'fast-perps'),
    options: StoreOptions = {}) {
    this.flushIntervalMs = Math.max(1, options.flushIntervalMs ?? 100);
    this.maximumBatchEvents = Math.max(1, options.maximumBatchEvents ?? 500);
    this.compressPartition = options.compressPartition ?? ((input) => zlib.gzipSync(input, { level: 6 }));
    this.summaryFile = path.join(this.root, 'materialized', 'evidence-summary.json');
    this.summary = this.loadSummary();
  }

  private loadSummary(): EvidenceSummaryState {
    try { return JSON.parse(fs.readFileSync(this.summaryFile, 'utf8')) as EvidenceSummaryState; }
    catch {
      return { schemaVersion: 1, updatedAt: 0, counts: { sessions: 0, gaps: 0, trades: 0, books: 0, contexts: 0,
        researchRuns: 0 }, symbols: [], latestTradeAt: null, latestBookAt: null, recentGaps: [], recentTrades: [],
        recentBooks: [], latestResearchRun: null, latestSession: null, invalidTradeIds: [], invalidBookIds: [], invalidContextIds: [],
        allLiveExecutionLocked: true };
    }
  }

  private writeSummary(): void {
    fs.mkdirSync(path.dirname(this.summaryFile), { recursive: true });
    const lockFile = `${this.summaryFile}.lock`; let lock: number | null = null;
    for (let attempt = 0; attempt < 100 && lock == null; attempt += 1) {
      try { lock = fs.openSync(lockFile, 'wx'); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try { if (Date.now() - fs.statSync(lockFile).mtimeMs > 30_000) fs.unlinkSync(lockFile); }
        catch { /* another writer released it */ }
        if (lock == null) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
    }
    if (lock == null) throw new Error('FAST_PERP_SUMMARY_LOCK_TIMEOUT');
    try {
      const disk = this.loadSummary();
      const unique = <T extends { id: string }>(left: T[], right: T[], limit?: number): T[] => {
        const rows = [...new Map([...left, ...right].map((row) => [row.id, row])).values()];
        return limit == null ? rows : rows.slice(-limit);
      };
      const latest = <T>(left: T | null, right: T | null, time: (row: T) => number): T | null => {
        if (!left) return right; if (!right) return left; return time(left) >= time(right) ? left : right;
      };
      this.summary = { schemaVersion: 1, updatedAt: Date.now(), counts: {
        sessions: Math.max(disk.counts.sessions, this.summary.counts.sessions),
        gaps: Math.max(disk.counts.gaps, this.summary.counts.gaps),
        trades: Math.max(disk.counts.trades, this.summary.counts.trades),
        books: Math.max(disk.counts.books, this.summary.counts.books),
        contexts: Math.max(disk.counts.contexts, this.summary.counts.contexts),
        researchRuns: Math.max(disk.counts.researchRuns, this.summary.counts.researchRuns),
      }, symbols: [...new Set([...disk.symbols, ...this.summary.symbols])].sort(),
      latestTradeAt: Math.max(disk.latestTradeAt ?? 0, this.summary.latestTradeAt ?? 0) || null,
      latestBookAt: Math.max(disk.latestBookAt ?? 0, this.summary.latestBookAt ?? 0) || null,
      recentGaps: unique(disk.recentGaps, this.summary.recentGaps, 20),
      recentTrades: unique(disk.recentTrades, this.summary.recentTrades, 20),
      recentBooks: unique(disk.recentBooks, this.summary.recentBooks, 20),
      latestResearchRun: latest(disk.latestResearchRun, this.summary.latestResearchRun, (row) => row.createdAt),
      latestSession: latest(disk.latestSession, this.summary.latestSession, (row) => row.at),
      invalidTradeIds: [...new Set([...disk.invalidTradeIds, ...this.summary.invalidTradeIds])],
      invalidBookIds: [...new Set([...disk.invalidBookIds, ...this.summary.invalidBookIds])],
      invalidContextIds: [...new Set([...disk.invalidContextIds, ...this.summary.invalidContextIds])],
      allLiveExecutionLocked: disk.allLiveExecutionLocked && this.summary.allLiveExecutionLocked };
      const temporary = `${this.summaryFile}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(this.summary)); fs.renameSync(temporary, this.summaryFile);
    } finally {
      fs.closeSync(lock); try { fs.unlinkSync(lockFile); } catch { /* already released */ }
    }
  }

  private recordRaw(kind: 'trades' | 'books' | 'contexts', rows: Array<{ id: string; symbol: string;
    receivedAt: number; liveExecution: 'locked' }>): void {
    if (!rows.length) return;
    this.summary.counts[kind] += rows.length;
    this.summary.symbols = [...new Set([...this.summary.symbols, ...rows.map((row) => row.symbol)])].sort();
    this.summary.allLiveExecutionLocked &&= rows.every((row) => row.liveExecution === 'locked');
    if (kind === 'trades') {
      const trades = rows as FastPerpTradeEvent[];
      this.summary.latestTradeAt = Math.max(this.summary.latestTradeAt ?? 0, ...trades.map((row) => row.receivedAt));
      this.summary.recentTrades = [...this.summary.recentTrades, ...trades].slice(-20);
      this.summary.invalidTradeIds.push(...trades.filter((row) => !(row.price > 0 && row.size > 0 && row.notionalUsd > 0)
        || row.eventTime > row.receivedAt || row.liveExecution !== 'locked').map((row) => row.id));
    } else if (kind === 'books') {
      const books = rows as FastPerpBookEvent[];
      this.summary.latestBookAt = Math.max(this.summary.latestBookAt ?? 0, ...books.map((row) => row.receivedAt));
      this.summary.recentBooks = [...this.summary.recentBooks, ...books].slice(-20);
      this.summary.invalidBookIds.push(...books.filter((row) => !(row.bestAsk >= row.bestBid && row.midPrice > 0)
        || row.eventTime > row.receivedAt || row.liveExecution !== 'locked').map((row) => row.id));
    } else {
      const contexts = rows as FastPerpContextEvent[];
      this.summary.invalidContextIds.push(...contexts.filter((row) => !(row.markPrice > 0 && row.oraclePrice > 0
        && row.openInterest >= 0) || row.eventTime > row.receivedAt || row.liveExecution !== 'locked').map((row) => row.id));
    }
  }

  private readFile(file: string): string {
    if (file.endsWith('.gz')) return zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
    return fs.readFileSync(file, 'utf8');
  }

  private readJsonl<T>(file: string, quarantine = true): T[] {
    if (!fs.existsSync(file)) return [];
    let content: string;
    try { content = this.readFile(file); } catch { return []; }
    const valid: T[] = [];
    content.split('\n').forEach((line, index) => {
      if (!line.trim()) return;
      try { valid.push(JSON.parse(line) as T); }
      catch { if (quarantine) this.quarantineMalformed(file, index + 1, line); }
    });
    return valid;
  }

  private quarantineMalformed(file: string, line: number, content: string): void {
    const contentHash = sha256(content);
    const id = `malformed_${sha256(`${file}:${line}:${contentHash}`).slice(0, 24)}`;
    if (this.quarantineIds.has(id)) return;
    const quarantineFile = path.join(this.root, 'quarantine', 'malformed-jsonl.jsonl');
    if (!this.quarantineIds.size) {
      for (const row of this.readJsonl<MalformedRowRecord>(quarantineFile, false)) this.quarantineIds.add(row.id);
      if (this.quarantineIds.has(id)) return;
    }
    this.quarantineIds.add(id);
    fs.mkdirSync(path.dirname(quarantineFile), { recursive: true });
    const record: MalformedRowRecord = { id, recordedAt: Date.now(), file, line,
      reason: 'MALFORMED_JSONL_ROW', contentHash };
    fs.appendFileSync(quarantineFile, `${JSON.stringify(record)}\n`);
  }

  private known(file: string): Set<string> {
    let known = this.knownByFile.get(file);
    if (!known) {
      const source = fs.existsSync(file) ? file : fs.existsSync(`${file}.gz`) ? `${file}.gz` : file;
      known = new Set(this.readJsonl<{ id: string }>(source).map((row) => row.id));
      this.knownByFile.set(file, known);
    }
    return known;
  }

  private retainTwoDedupeHours(hourKey: string): void {
    this.knownHours.set(hourKey, hourKey);
    const retained = [...this.knownHours.keys()].sort().slice(-2);
    const retainedSet = new Set(retained);
    for (const key of this.knownHours.keys()) if (!retainedSet.has(key)) this.knownHours.delete(key);
    for (const file of this.knownByFile.keys()) {
      const relative = path.relative(path.join(this.root, 'raw'), file).split(path.sep);
      const fileHourKey = relative.length >= 2 ? `${relative[0]}T${relative[1]}` : null;
      if (fileHourKey && !retainedSet.has(fileHourKey)) this.knownByFile.delete(file);
    }
  }

  private rawFile(kind: 'trades' | 'books' | 'contexts', symbol: string, receivedAt: number): { file: string; hourKey: string } {
    const partition = partitionParts(receivedAt);
    return { file: path.join(this.root, 'raw', partition.date, partition.hour, safeSymbol(symbol), `${kind}.jsonl`),
      hourKey: partition.hourKey };
  }

  private enqueueRaw<T extends { id: string; symbol: string; receivedAt: number }>(kind: 'trades' | 'books' | 'contexts', rows: T[]): void {
    for (const row of rows) {
      const { file, hourKey } = this.rawFile(kind, row.symbol, row.receivedAt);
      this.retainTwoDedupeHours(hourKey);
      const known = this.known(file);
      if (known.has(row.id)) continue;
      known.add(row.id);
      const pending = this.pendingByFile.get(file) ?? [];
      pending.push(row); this.pendingByFile.set(file, pending); this.pendingEvents += 1;
    }
    if (this.pendingEvents >= this.maximumBatchEvents) this.flush();
    else if (this.pendingEvents && !this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
      this.flushTimer.unref?.();
    }
  }

  private appendUniqueImmediate<T extends { id: string }>(file: string, rows: T[]): T[] {
    if (!rows.length) return [];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const known = this.known(file);
    const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
    if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
    return fresh;
  }

  flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    for (const [file, rows] of this.pendingByFile) {
      if (!rows.length) continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
      const kind = path.basename(file, '.jsonl') as 'trades' | 'books' | 'contexts';
      this.recordRaw(kind, rows as Array<{ id: string; symbol: string; receivedAt: number; liveExecution: 'locked' }>);
    }
    const changed = this.pendingEvents > 0; this.pendingByFile.clear(); this.pendingEvents = 0;
    if (changed) this.writeSummary();
  }

  close(): void { this.flush(); }

  maintainPartitions(now = Date.now(), retentionDays = 30, maximumCompressionFiles = Number.POSITIVE_INFINITY): {
    compressedFiles: number; recoveredFiles: number; deletedFiles: number; remainingCompressionFiles: number } {
    this.flush();
    const rawRoot = path.join(this.root, 'raw');
    const manifestFile = path.join(this.root, 'manifests', 'partition-maintenance.jsonl');
    const currentHourStart = Math.floor(now / 3_600_000) * 3_600_000;
    const retentionCutoff = now - Math.max(1, retentionDays) * 86_400_000;
    const appendManifest = (record: Record<string, unknown>) => {
      fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
      fs.appendFileSync(manifestFile, `${JSON.stringify(record)}\n`);
    };
    const manifestedTargets = new Set(this.readJsonl<{ target?: string }>(manifestFile, false)
      .flatMap((row) => typeof row.target === 'string' ? [row.target] : []));
    const compressionLimit = Number.isFinite(maximumCompressionFiles)
      ? Math.max(0, Math.floor(maximumCompressionFiles)) : Number.POSITIVE_INFINITY;
    let compressedFiles = 0; let recoveredFiles = 0; let deletedFiles = 0; let remainingCompressionFiles = 0;
    for (const file of walkFiles(rawRoot)) {
      const relative = path.relative(rawRoot, file).split(path.sep);
      if (relative.length < 4) continue;
      const partitionStart = Date.parse(`${relative[0]}T${relative[1]}:00:00.000Z`);
      if (!Number.isFinite(partitionStart)) continue;
      if (partitionStart < retentionCutoff) {
        const bytes = fs.statSync(file).size; const digest = sha256(fs.readFileSync(file).toString('base64'));
        fs.unlinkSync(file); deletedFiles += 1;
        appendManifest({ id: `partition_${sha256(`delete:${file}:${digest}`).slice(0, 24)}`, recordedAt: now,
          action: 'retention_deleted', file, partitionStart, bytes, digest, retentionDays });
        continue;
      }
      if (file.endsWith('.jsonl') && partitionStart + 3_600_000 <= currentHourStart) {
        if (compressedFiles + recoveredFiles >= compressionLimit) { remainingCompressionFiles += 1; continue; }
        const input = fs.readFileSync(file); const digest = sha256(input.toString('base64')); const target = `${file}.gz`;
        if (fs.existsSync(target)) {
          let validTarget = false;
          try { validTarget = zlib.gunzipSync(fs.readFileSync(target)).equals(input); } catch { /* interrupted output */ }
          if (validTarget) {
            if (!manifestedTargets.has(target)) appendManifest({
              id: `partition_${sha256(`compress:${file}:${digest}`).slice(0, 24)}`, recordedAt: now,
              action: 'compressed', recoveredAfterInterruptedManifest: true, file, target, partitionStart,
              sourceBytes: input.length, compressedBytes: fs.statSync(target).size, digest });
            fs.unlinkSync(file); recoveredFiles += 1; continue;
          }
          fs.unlinkSync(target);
        }
        const output = this.compressPartition(input); const temporary = `${target}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, output); fs.renameSync(temporary, target);
        appendManifest({ id: `partition_${sha256(`compress:${file}:${digest}`).slice(0, 24)}`,
          recordedAt: now, action: 'compressed', file, target, partitionStart, sourceBytes: input.length,
          compressedBytes: output.length, digest });
        manifestedTargets.add(target); fs.unlinkSync(file); compressedFiles += 1;
      }
    }
    return { compressedFiles, recoveredFiles, deletedFiles, remainingCompressionFiles };
  }

  appendSessions(rows: FastPerpSourceSession[]): void {
    const fresh = this.appendUniqueImmediate(path.join(this.root, 'state', 'sessions.jsonl'), rows);
    if (fresh.length) { this.summary.counts.sessions += fresh.length;
      this.summary.latestSession = fresh.at(-1) ?? this.summary.latestSession;
      this.summary.allLiveExecutionLocked &&= fresh.every((row) => row.liveExecution === 'locked'); this.writeSummary(); }
  }
  appendGaps(rows: FastPerpGap[]): void {
    const fresh = this.appendUniqueImmediate(path.join(this.root, 'state', 'gaps.jsonl'), rows);
    if (fresh.length) { this.summary.counts.gaps += fresh.length; this.summary.recentGaps = [...this.summary.recentGaps, ...fresh].slice(-20);
      this.summary.allLiveExecutionLocked &&= fresh.every((row) => row.liveExecution === 'locked'); this.writeSummary(); }
  }
  appendTrades(rows: FastPerpTradeEvent[]): void { this.enqueueRaw('trades', rows); }
  appendBooks(rows: FastPerpBookEvent[]): void { this.enqueueRaw('books', rows); }
  appendContexts(rows: FastPerpContextEvent[]): void { this.enqueueRaw('contexts', rows); }
  appendResearchRuns(rows: FastPerpResearchRun[]): void {
    const fresh = this.appendUniqueImmediate(path.join(this.root, 'derived', 'research-runs.jsonl'), rows);
    if (fresh.length) { this.summary.counts.researchRuns += fresh.length; this.summary.latestResearchRun = fresh.at(-1) ?? null;
      this.summary.allLiveExecutionLocked &&= fresh.every((row) => row.liveExecution === 'locked'); this.writeSummary(); }
  }

  readSessions(): FastPerpSourceSession[] {
    return this.readJsonl(path.join(this.root, 'state', 'sessions.jsonl'));
  }
  readGaps(): FastPerpGap[] { return this.readJsonl(path.join(this.root, 'state', 'gaps.jsonl')); }
  readTrades(query: FastPerpEvidenceQuery = {}): FastPerpTradeEvent[] { return this.readRaw('trades', query); }
  readBooks(query: FastPerpEvidenceQuery = {}): FastPerpBookEvent[] { return this.readRaw('books', query); }
  readContexts(query: FastPerpEvidenceQuery = {}): FastPerpContextEvent[] { return this.readRaw('contexts', query); }
  readResearchRuns(): FastPerpResearchRun[] {
    return this.readJsonl(path.join(this.root, 'derived', 'research-runs.jsonl'));
  }

  private readRaw<T extends { symbol: string; receivedAt: number }>(kind: 'trades' | 'books' | 'contexts',
    query: FastPerpEvidenceQuery): T[] {
    this.flush();
    let files: string[];
    if (query.symbol && query.fromReceivedAt != null && query.toReceivedAt != null) {
      const firstHour = Math.floor(query.fromReceivedAt / 3_600_000) * 3_600_000;
      const lastHour = Math.floor(query.toReceivedAt / 3_600_000) * 3_600_000;
      if (lastHour - firstHour > 48 * 3_600_000) throw new Error('FAST_PERP_QUERY_RANGE_EXCEEDS_48_HOURS');
      files = [];
      for (let at = firstHour; at <= lastHour; at += 3_600_000) {
        const partition = partitionParts(at); const file = path.join(this.root, 'raw', partition.date, partition.hour,
          safeSymbol(query.symbol), `${kind}.jsonl`);
        if (fs.existsSync(file)) files.push(file); else if (fs.existsSync(`${file}.gz`)) files.push(`${file}.gz`);
      }
    } else {
      files = walkFiles(path.join(this.root, 'raw')).filter((file) => file.endsWith(`${kind}.jsonl`)
        || file.endsWith(`${kind}.jsonl.gz`));
    }
    const rows = files.flatMap((file) => this.readJsonl<T>(file)).filter((row) => (!query.symbol || row.symbol === query.symbol)
      && (query.fromReceivedAt == null || row.receivedAt >= query.fromReceivedAt)
      && (query.toReceivedAt == null || row.receivedAt <= query.toReceivedAt))
      .sort((left, right) => left.receivedAt - right.receivedAt);
    return query.limit == null ? rows : rows.slice(-Math.max(0, query.limit));
  }

  snapshot(now = Date.now()) {
    this.flush(); const state = this.summary; const latestTradeAt = state.latestTradeAt ?? 0; const latestBookAt = state.latestBookAt ?? 0;
    return { mode: 'Paper money', source: { venue: 'hyperliquid', sourceVersion: 'hyperliquid-websocket-v1' },
      counts: { ...state.counts, symbols: state.symbols.length },
      symbols: state.symbols, freshness: { latestTradeAt: latestTradeAt || null, latestBookAt: latestBookAt || null,
        tradeAgeMs: latestTradeAt ? now - latestTradeAt : null, bookAgeMs: latestBookAt ? now - latestBookAt : null,
        newestEventAgeMs: latestTradeAt || latestBookAt ? now - Math.max(latestTradeAt, latestBookAt) : null,
        current: Boolean(latestTradeAt && latestBookAt && now - Math.min(latestTradeAt, latestBookAt) <= 30_000) },
      recentGaps: [...state.recentGaps].reverse(), recentTrades: [...state.recentTrades].reverse(), recentBooks: [...state.recentBooks].reverse(),
      latestResearchRun: state.latestResearchRun,
      latestSession: state.latestSession,
      integrity: { invalidTradeIds: state.invalidTradeIds, invalidBookIds: state.invalidBookIds,
      invalidContextIds: state.invalidContextIds, allLiveExecutionLocked: state.allLiveExecutionLocked },
      liveExecution: 'locked' as const };
  }
}
