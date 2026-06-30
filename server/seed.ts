import fs from 'fs';
import path from 'path';
import { createDemoState } from './demo.js';

const DB_FILE = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'db.json');

console.log('Resetting local DB state with curated demo world...');

try {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(createDemoState(), null, 2), 'utf8');
  console.log('Database successfully reset and seeded.');
} catch (e) {
  console.error('Failed to write database file', e);
  process.exit(1);
}
