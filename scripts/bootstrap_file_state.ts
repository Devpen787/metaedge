import { DATABASE_BACKEND, DB_FILE, readDatabase } from '../server/storage.js';

if (DATABASE_BACKEND !== 'file' || !DB_FILE) throw new Error('BOOTSTRAP_REQUIRES_FILE_DATABASE_URL');
const state = readDatabase();
console.log(JSON.stringify({
  databaseFile: DB_FILE,
  users: Object.keys(state.users || {}).length,
  trades: state.trades.length,
  liveExecution: 'locked',
}));
