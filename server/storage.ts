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
        predictionMarkets: defaultPredictions
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
    return parsed;
  } catch (error) {
    console.error('Error reading database, resetting:', error);
    return {
      users: {},
      sessions: {},
      rooms: {},
      agents: {},
      strategies: {},
      trades: [],
      vaultClubs: {},
      auditEvents: [],
      graphEvents: [],
      predictionMarkets: {}
    };
  }
}

export function writeDatabase(state: DatabaseState) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
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
