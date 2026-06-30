import fs from 'fs';
import path from 'path';

const DB_FILE = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'db.json');

console.log('Resetting local DB state...');

const initialState = {
  users: {},
  rooms: {},
  agents: {},
  strategies: {},
  trades: [],
  vaultClubs: {},
  auditEvents: [],
  graphEvents: [],
  predictionMarkets: {
    "pred_btc_120k": {
      id: "pred_btc_120k",
      question: "Will BTC reach $120,000 before December 31, 2026?",
      category: "Crypto",
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
      category: "AI Performance",
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
      category: "Macro",
      yesPool: 15000,
      noPool: 45000,
      resolved: false,
      outcome: null,
      endTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
      volume: 60000,
      bets: {}
    }
  }
};

try {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), 'utf8');
  console.log('Database successfully reset and seeded.');
} catch (e) {
  console.error('Failed to write database file', e);
  process.exit(1);
}
