import fs from 'fs';
import path from 'path';
import { DatabaseState } from '../src/types';
import { defaultPredictionMarkets } from './demo.js';

export const DB_FILE = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'db.json');

export function readDatabase(): DatabaseState {
  try {
    const defaultPredictions = defaultPredictionMarkets();

    if (!fs.existsSync(DB_FILE)) {
      const initialState: DatabaseState = {
        users: {},
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
    if (!parsed.predictionMarkets) {
      parsed.predictionMarkets = defaultPredictions;
    }
    return parsed;
  } catch (error) {
    console.error('Error reading database, resetting:', error);
    return {
      users: {},
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
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper for sanitizing text inputs to prevent XSS/unwanted rendering
export function sanitizeText(str: string, maxLen = 100): string {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, maxLen).trim();
}
