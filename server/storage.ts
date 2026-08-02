import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseState } from '../src/types';
import { readPostgresState, writePostgresState, type PostgresStateSegment } from './postgres_sync.js';
import { canonicalJson } from './canonical_json.js';
import { normalizePersistedState } from './state_normalization.js';

const configuredDatabaseUrl = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'db.json');
export const DATABASE_BACKEND = /^postgres(?:ql)?:\/\//i.test(configuredDatabaseUrl) ? 'postgres' : 'file';
export const DB_FILE = DATABASE_BACKEND === 'file' ? configuredDatabaseUrl : '';
if (process.env.NODE_ENV === 'production' && DATABASE_BACKEND !== 'postgres'
  && process.env.METAEDGE_ALLOW_PRODUCTION_SQLITE !== 'true') {
  throw new Error('PRODUCTION_POSTGRES_REQUIRED');
}
let databaseCache: { mtimeMs: number; size: number; state: DatabaseState } | null = null;
let postgresCache: {
  revision: number;
  stateHash: string;
  state: DatabaseState;
  segmentHashes: Record<string, string>;
} | null = null;
const postgresStateRevision = new WeakMap<object, number>();

export type DatabaseCommitState = 'not_committed' | 'possibly_committed';

export interface DatabaseCommitReceipt {
  file: string;
  bytes: number;
  mtimeMs: number;
  committedAt: number;
  durability: 'file_and_directory_synced' | 'postgres_transaction_committed';
  backend?: 'file' | 'postgres';
  revision?: number;
}

export class DatabaseWriteError extends Error {
  readonly code = 'DATABASE_WRITE_FAILED';

  constructor(
    message: string,
    readonly commitState: DatabaseCommitState,
    readonly cause: unknown,
  ) {
    super(message);
    this.name = 'DatabaseWriteError';
  }
}

function valueHash(value: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function stateHash(state: DatabaseState): string {
  return crypto.createHash('sha256').update(canonicalJson(state)).digest('hex');
}

export function readDatabase(): DatabaseState {
  try {
    const defaultPredictions = {
      "pred_btc_120k": {
        id: "pred_btc_120k",
        question: "Will BTC reach $120,000 before December 31, 2026?",
        category: "Crypto" as const,
        yesPool: 50000,
        noPool: 35000,
        resolved: false,
        outcome: null,
        endTime: Date.now() + 180 * 24 * 60 * 60 * 1000,
        volume: 85000,
        bets: {}
      },
      "pred_agent_beat": {
        id: "pred_agent_beat",
        question: "Will the Custom AI Agent outperform the Momentum Strategy over the next week?",
        category: "AI Performance" as const,
        yesPool: 24000,
        noPool: 28000,
        resolved: false,
        outcome: null,
        endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
        volume: 52000,
        bets: {}
      },
      "pred_gas_12gwei": {
        id: "pred_gas_12gwei",
        question: "Will Ethereum gas fee average stay below 12 Gwei during July 2026?",
        category: "Macro" as const,
        yesPool: 15000,
        noPool: 45000,
        resolved: false,
        outcome: null,
        endTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
        volume: 60000,
        bets: {}
      }
    };

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const defaultLeagues = {
      "lg_bluechip": { id: "lg_bluechip", name: "Blue Chip Autopilot", creatorId: "system", creatorName: "MetaEdge", startBalance: 10000, durationDays: 14, createdAt: now, endsAt: now + 14 * DAY_MS, risk: "Low" as const, prize: "Reputation Badge", status: "active" as const },
      "lg_degen": { id: "lg_degen", name: "Degen Perps Only", creatorId: "system", creatorName: "MetaEdge", startBalance: 10000, durationDays: 7, createdAt: now, endsAt: now + 7 * DAY_MS, risk: "High" as const, prize: "500 USDC Pool", status: "active" as const },
      "lg_predict": { id: "lg_predict", name: "Prediction Market Masters", creatorId: "system", creatorName: "MetaEdge", startBalance: 10000, durationDays: 30, createdAt: now, endsAt: now + 30 * DAY_MS, risk: "Medium" as const, prize: "Winner Takes All", status: "active" as const },
    };

    let parsed: any;
    let fileStat: fs.Stats | null = null;
    let postgresRead: ReturnType<typeof readPostgresState> | null = null;
    if (DATABASE_BACKEND === 'postgres') {
      postgresRead = readPostgresState(postgresCache?.revision);
      if (postgresRead.missing) throw new Error('POSTGRES_STATE_NOT_INITIALIZED');
      if (postgresRead.unchanged) {
        if (!postgresCache) throw new Error('POSTGRES_CACHE_PROTOCOL_ERROR');
        return postgresCache.state;
      }
      if (!postgresRead.revision || postgresRead.schemaVersion !== 5 || !postgresRead.segments) {
        throw new Error('POSTGRES_STATE_INVALID');
      }
      parsed = Object.fromEntries(postgresRead.segments.map((segment) => [segment.key, segment.value]));
    } else {
      if (!fs.existsSync(DB_FILE)) {
        const initialState: DatabaseState = {
          users: {},
          sessions: {},
          rooms: {},
          agents: {},
          strategies: {},
          trades: [],
          vaultClubs: {},
          auditEvents: [],
          graphEvents: [],
          predictionMarkets: defaultPredictions,
          predictionBetEvents: [],
          arenaLeagues: defaultLeagues,
          arenaMembers: [],
          arenaBadges: [],
          arenaRankSnapshots: {},
          trailingState: {},
          cooldowns: {},
          orderIntentsV5: {},
          orderNonceIndexV5: {},
          orderEventsV5: [],
          paperFillsV5: [],
          experimentsV5: { specs: {}, states: {}, budgets: {}, observations: [], lifecycleEvents: [] },
          marketDataV5: { universeVersions: {}, coverageHistory: [] },
          decisionRuntime: {
            strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {}
          }
        };

        writeDatabase(initialState);
        return initialState;
      }
      fileStat = fs.statSync(DB_FILE);
      if (databaseCache && databaseCache.mtimeMs === fileStat.mtimeMs
        && databaseCache.size === fileStat.size) return databaseCache.state;
      parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
    if (!parsed.sessions) parsed.sessions = {};
    if (!parsed.predictionMarkets) {
      parsed.predictionMarkets = defaultPredictions;
    }
    if (!parsed.arenaLeagues) {
      parsed.arenaLeagues = defaultLeagues;
    }
    parsed = normalizePersistedState(parsed);
    if (DATABASE_BACKEND === 'postgres') {
      const revision = postgresRead!.revision!;
      const segmentHashes = Object.fromEntries(postgresRead!.segments!.map((segment) => [segment.key, segment.valueHash]));
      postgresCache = { revision, stateHash: postgresRead!.stateHash || stateHash(parsed), state: parsed, segmentHashes };
      postgresStateRevision.set(parsed, revision);
    } else {
      databaseCache = { mtimeMs: fileStat!.mtimeMs, size: fileStat!.size, state: parsed };
    }
    return parsed;
  } catch (error) {
    databaseCache = null;
    postgresCache = null;
    console.error('Error reading database:', error);
    if (DATABASE_BACKEND === 'postgres') throw error;
    // Failure to create the canonical store is a write failure, not an empty
    // product. Returning an in-memory default here would make later mutations
    // look accepted even though no durable database exists.
    if (error instanceof DatabaseWriteError) throw error;
    // A parse error must NOT silently wipe everyone's data. Preserve the bad
    // file for forensics, then try to recover from the newest daily backup
    // before falling back to an empty state.
    try {
      if (fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`);
      }
      const dir = path.dirname(DB_FILE);
      const backups = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => f.startsWith('db-backup-')).sort()
        : [];
      for (const b of backups.reverse()) {
        try {
          const recovered = JSON.parse(fs.readFileSync(path.join(dir, b), 'utf8'));
          console.warn(`Recovered database from backup: ${b}`);
          return recovered;
        } catch { /* try older backup */ }
      }
    } catch (recoverErr) {
      console.error('Backup recovery failed:', recoverErr);
    }
    return {
      users: {}, sessions: {}, rooms: {}, agents: {}, strategies: {}, trades: [],
      vaultClubs: {}, auditEvents: [], graphEvents: [], predictionMarkets: {}, predictionBetEvents: [],
      arenaLeagues: {}, arenaMembers: [], arenaBadges: [], arenaRankSnapshots: {},
      orderIntentsV5: {}, orderNonceIndexV5: {}, orderEventsV5: [],
      paperFillsV5: [],
      experimentsV5: { specs: {}, states: {}, budgets: {}, observations: [], lifecycleEvents: [] },
      marketDataV5: { universeVersions: {}, coverageHistory: [] },
      decisionRuntime: { strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {} }
    };
  }
}

function writePostgresDatabase(state: DatabaseState): DatabaseCommitReceipt {
  let commitState: DatabaseCommitState = 'not_committed';
  try {
    const expectedRevision = postgresStateRevision.get(state);
    if (expectedRevision == null || !postgresCache || postgresCache.revision !== expectedRevision) {
      throw new Error('POSTGRES_WRITE_REQUIRES_CURRENT_READ_STATE');
    }
    const serialized = JSON.stringify(state);
    const bytes = Buffer.byteLength(serialized);
    const nextStateHash = stateHash(state);
    const currentKeys = Object.keys(state).sort();
    const currentKeySet = new Set(currentKeys);
    const changedSegments: PostgresStateSegment[] = [];
    const nextSegmentHashes: Record<string, string> = {};
    for (const key of currentKeys) {
      const hash = valueHash((state as any)[key]);
      nextSegmentHashes[key] = hash;
      if (postgresCache.segmentHashes[key] !== hash) {
        changedSegments.push({ key, value: (state as any)[key], valueHash: hash });
      }
    }
    const deletedKeys = Object.keys(postgresCache.segmentHashes).filter((key) => !currentKeySet.has(key));
    const result = writePostgresState({
      expectedRevision,
      changedSegments,
      deletedKeys,
      stateHash: nextStateHash,
      stateBytes: bytes,
      writerId: `${process.env.GIT_COMMIT || 'dev'}:${process.pid}`,
    });
    commitState = 'possibly_committed';
    postgresCache = {
      revision: result.revision,
      stateHash: nextStateHash,
      state,
      segmentHashes: nextSegmentHashes,
    };
    postgresStateRevision.set(state, result.revision);
    return {
      file: 'postgres:metaedge.state_segments',
      bytes,
      mtimeMs: result.committedAt,
      committedAt: result.committedAt,
      durability: 'postgres_transaction_committed',
      backend: 'postgres',
      revision: result.revision,
    };
  } catch (error: any) {
    postgresCache = null;
    const reportedState = error?.commitState as DatabaseCommitState | undefined;
    throw new DatabaseWriteError(
      `Canonical PostgreSQL write failed (${reportedState || commitState})`,
      reportedState || commitState,
      error,
    );
  }
}

export function writeDatabase(state: DatabaseState): DatabaseCommitReceipt {
  if (DATABASE_BACKEND === 'postgres') return writePostgresDatabase(state);
  const dir = path.dirname(DB_FILE);
  let tmp: string | null = null;
  let renamed = false;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic durable write: serialize, flush a unique temp file, rename over the
    // target, then fsync the parent directory so the rename itself survives a
    // crash. Success is acknowledged only after all four stages complete.
    const json = JSON.stringify(state, null, 2);
    tmp = `${DB_FILE}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
    const fd = fs.openSync(tmp, 'wx');
    try {
      fs.writeFileSync(fd, json, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, DB_FILE);
    renamed = true;
    tmp = null;

    const dirFd = fs.openSync(dir, 'r');
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }

    const stat = fs.statSync(DB_FILE);
    databaseCache = { mtimeMs: stat.mtimeMs, size: stat.size, state };
    return {
      file: DB_FILE,
      bytes: stat.size,
      mtimeMs: stat.mtimeMs,
      committedAt: Date.now(),
      durability: 'file_and_directory_synced',
      backend: 'file',
    };
  } catch (error) {
    // A caller may have mutated the cached object before attempting this
    // commit. Drop the cache on every failure so the next read returns only
    // durable on-disk state, never the uncommitted object.
    databaseCache = null;
    if (tmp) {
      try {
        fs.unlinkSync(tmp);
      } catch (cleanupError: any) {
        if (cleanupError?.code !== 'ENOENT') {
          console.error('Error cleaning failed database temp file:', cleanupError);
        }
      }
    }
    const commitState: DatabaseCommitState = renamed ? 'possibly_committed' : 'not_committed';
    throw new DatabaseWriteError(
      `Canonical database write failed (${commitState})`,
      commitState,
      error,
    );
  }
}

export function databaseStatus() {
  return DATABASE_BACKEND === 'postgres'
    ? {
      backend: 'postgres' as const,
      schemaVersion: 5,
      revision: postgresCache?.revision ?? null,
      durability: 'postgres_transaction_committed' as const,
    }
    : {
      backend: 'file' as const,
      schemaVersion: 5,
      revision: null,
      durability: 'file_and_directory_synced' as const,
    };
}

// Generate random unguessable IDs/tokens
export function generateId() {
  return crypto.randomBytes(16).toString('base64url');
}

// Helper for sanitizing text inputs to prevent XSS/unwanted rendering
export function sanitizeText(str: string, maxLen = 100): string {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, maxLen).trim();
}
