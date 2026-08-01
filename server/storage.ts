import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseState } from '../src/types';

export const DB_FILE = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'db.json');
let databaseCache: { mtimeMs: number; size: number; state: DatabaseState } | null = null;

export type DatabaseCommitState = 'not_committed' | 'possibly_committed';

export interface DatabaseCommitReceipt {
  file: string;
  bytes: number;
  mtimeMs: number;
  committedAt: number;
  durability: 'file_and_directory_synced';
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
    const stat = fs.statSync(DB_FILE);
    if (databaseCache && databaseCache.mtimeMs === stat.mtimeMs && databaseCache.size === stat.size) return databaseCache.state;
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.sessions) {
      parsed.sessions = {};
    }
    if (!parsed.predictionMarkets) {
      parsed.predictionMarkets = defaultPredictions;
    }
    if (!parsed.predictionBetEvents) {
      parsed.predictionBetEvents = [];
    }
    if (!parsed.arenaLeagues) {
      parsed.arenaLeagues = defaultLeagues;
    }
    if (!parsed.arenaMembers) {
      parsed.arenaMembers = [];
    }
    if (!parsed.arenaBadges) {
      parsed.arenaBadges = [];
    }
    if (!parsed.arenaRankSnapshots) {
      parsed.arenaRankSnapshots = {};
    }
    if (!parsed.trailingState) parsed.trailingState = {};
    if (!parsed.cooldowns) parsed.cooldowns = {};
    if (!parsed.orderIntentsV5) parsed.orderIntentsV5 = {};
    if (!parsed.orderNonceIndexV5) parsed.orderNonceIndexV5 = {};
    if (!parsed.orderEventsV5) parsed.orderEventsV5 = [];
    if (!parsed.paperFillsV5) parsed.paperFillsV5 = [];
    if (!parsed.experimentsV5) {
      parsed.experimentsV5 = { specs: {}, states: {}, budgets: {}, observations: [], lifecycleEvents: [] };
    }
    if (!parsed.experimentsV5.specs) parsed.experimentsV5.specs = {};
    if (!parsed.experimentsV5.states) parsed.experimentsV5.states = {};
    if (!parsed.experimentsV5.budgets) parsed.experimentsV5.budgets = {};
    if (!parsed.experimentsV5.observations) parsed.experimentsV5.observations = [];
    if (!parsed.experimentsV5.lifecycleEvents) parsed.experimentsV5.lifecycleEvents = [];
    if (parsed.portfolioAllocatorV5) {
      if (!parsed.portfolioAllocatorV5.reservations) parsed.portfolioAllocatorV5.reservations = {};
      if (!parsed.portfolioAllocatorV5.decisions) parsed.portfolioAllocatorV5.decisions = [];
    }
    if (parsed.populationOperationsV5) {
      if (!parsed.populationOperationsV5.samples) parsed.populationOperationsV5.samples = [];
      if (!parsed.populationOperationsV5.assuranceRecords) parsed.populationOperationsV5.assuranceRecords = [];
      if (!parsed.populationOperationsV5.acceptanceBundles) parsed.populationOperationsV5.acceptanceBundles = [];
    }
    if (!parsed.marketDataV5) parsed.marketDataV5 = { universeVersions: {}, coverageHistory: [] };
    if (!parsed.marketDataV5.universeVersions) parsed.marketDataV5.universeVersions = {};
    if (!parsed.marketDataV5.coverageHistory) parsed.marketDataV5.coverageHistory = [];
    if (!parsed.decisionRuntime) {
      parsed.decisionRuntime = { strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {} };
    }
    if (!parsed.decisionRuntime.strategySpecs) parsed.decisionRuntime.strategySpecs = {};
    if (!parsed.decisionRuntime.validations) parsed.decisionRuntime.validations = {};
    if (!parsed.decisionRuntime.decisions) parsed.decisionRuntime.decisions = [];
    if (!parsed.decisionRuntime.executedDecisionIds) parsed.decisionRuntime.executedDecisionIds = {};
    if (!parsed.decisionRuntime.cycleDiagnostics) parsed.decisionRuntime.cycleDiagnostics = [];
    if (!parsed.decisionRuntime.forwardCheckpoints) parsed.decisionRuntime.forwardCheckpoints = [];
    databaseCache = { mtimeMs: stat.mtimeMs, size: stat.size, state: parsed };
    return parsed;
  } catch (error) {
    databaseCache = null;
    console.error('Error reading database:', error);
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

export function writeDatabase(state: DatabaseState): DatabaseCommitReceipt {
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

// Generate random unguessable IDs/tokens
export function generateId() {
  return crypto.randomBytes(16).toString('base64url');
}

// Helper for sanitizing text inputs to prevent XSS/unwanted rendering
export function sanitizeText(str: string, maxLen = 100): string {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, maxLen).trim();
}
