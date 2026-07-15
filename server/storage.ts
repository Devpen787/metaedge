import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseState } from '../src/types';

export const DB_FILE = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'db.json');

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
        arenaLeagues: defaultLeagues,
        arenaMembers: [],
        arenaBadges: [],
        arenaRankSnapshots: {},
        decisionRuntime: {
          strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {}
        }
      };
      
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), 'utf8');
      return initialState;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.sessions) {
      parsed.sessions = {};
    }
    if (!parsed.predictionMarkets) {
      parsed.predictionMarkets = defaultPredictions;
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
    if (!parsed.decisionRuntime) {
      parsed.decisionRuntime = { strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {} };
    }
    if (!parsed.decisionRuntime.strategySpecs) parsed.decisionRuntime.strategySpecs = {};
    if (!parsed.decisionRuntime.validations) parsed.decisionRuntime.validations = {};
    if (!parsed.decisionRuntime.decisions) parsed.decisionRuntime.decisions = [];
    if (!parsed.decisionRuntime.executedDecisionIds) parsed.decisionRuntime.executedDecisionIds = {};
    return parsed;
  } catch (error) {
    console.error('Error reading database:', error);
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
      vaultClubs: {}, auditEvents: [], graphEvents: [], predictionMarkets: {},
      arenaLeagues: {}, arenaMembers: [], arenaBadges: [], arenaRankSnapshots: {},
      decisionRuntime: { strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {} }
    };
  }
}

export function writeDatabase(state: DatabaseState) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic write: serialize, flush to a temp file, then rename over the
    // target. rename() is atomic on POSIX, so a crash mid-write can never leave
    // a half-written (corrupt) db.json — readers see either the old or new file.
    const json = JSON.stringify(state, null, 2);
    const tmp = `${DB_FILE}.tmp-${process.pid}`;
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, json, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, DB_FILE);
  } catch (error) {
    console.error('Error writing database:', error);
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
