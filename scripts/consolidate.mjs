#!/usr/bin/env node
/**
 * Consolidate — sweep balances from every wallet into one destination wallet.
 *
 * DRY-RUN BY DEFAULT. It prints exactly what it would move and stops. Only with
 * --execute does it send real transfers (native token keeps a small gas buffer;
 * ERC-20 tokens need native gas already on that chain in the source wallet).
 *
 * Usage:
 *   node scripts/consolidate.mjs --to 0xYourCanonical            # dry-run
 *   node scripts/consolidate.mjs --to 0xYourCanonical --execute  # move funds
 *
 * Requires an authenticated `mm` session (mm auth status → authenticated: true).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const MM = fs.existsSync('node_modules/.bin/mm') ? 'node_modules/.bin/mm' : 'mm';
const args = process.argv.slice(2);
const TO = (args[args.indexOf('--to') + 1] || '').toLowerCase();
const EXECUTE = args.includes('--execute');
const GAS_BUFFER = 0.0002; // native left behind to pay for the transfer itself

if (!/^0x[a-f0-9]{40}$/.test(TO)) {
  console.error('Provide a destination:  node scripts/consolidate.mjs --to 0x<canonical> [--execute]');
  process.exit(1);
}

function mm(a) {
  const out = execFileSync(MM, [...a, '--json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const p = JSON.parse(out);
  if (p.ok === false) throw new Error(`mm ${a.join(' ')}: ${p.summary || 'failed'}`);
  return p;
}
const short = (a) => `${a.slice(0, 8)}…${a.slice(-6)}`;

if (!mm(['auth', 'status']).data?.authenticated) { console.error('Not authenticated. Run `mm login browser`.'); process.exit(1); }

const activeBefore = mm(['wallet', 'address']).data?.address;
const wallets = mm(['wallet', 'list']).data?.wallets || [];

// Build the plan by scanning every non-destination wallet.
const moves = [];
for (const w of wallets) {
  if (w.address.toLowerCase() === TO) continue;
  mm(['wallet', 'select', '--address', w.address]);
  const bal = mm(['wallet', 'balance']).data || {};
  for (const ch of bal.chains || []) {
    const chainId = String(ch.chainId || ch.chain || '').replace(/^eip155:/, '');
    for (const t of ch.tokens || []) {
      const isNative = t.type === 'native';
      const amount = isNative ? Number(t.amount) - GAS_BUFFER : Number(t.amount);
      if (amount > 0) moves.push({ from: w.address, chainId, chainName: ch.name, token: t.token, isNative, amount, usd: Number(t.usdValue || 0) });
    }
  }
}

console.log(`\n  Consolidate → ${short(TO)}   (${EXECUTE ? 'EXECUTE' : 'DRY-RUN'})\n`);
if (!moves.length) { console.log('  Nothing to move — all funds already on the destination.\n'); mm(['wallet', 'select', '--address', activeBefore]); process.exit(0); }
for (const m of moves) console.log(`  ${m.amount.toFixed(6)} ${m.token} · ${m.chainName} · from ${short(m.from)}  ($${m.usd.toFixed(2)})`);
console.log(`  ─ total ~$${moves.reduce((s, m) => s + m.usd, 0).toFixed(2)}\n`);

if (!EXECUTE) {
  console.log('  DRY-RUN — nothing moved. Re-run with --execute to send these transfers.\n');
  mm(['wallet', 'select', '--address', activeBefore]);
  process.exit(0);
}

for (const m of moves) {
  process.stdout.write(`  → ${m.amount.toFixed(6)} ${m.token} from ${short(m.from)}… `);
  try {
    mm(['wallet', 'select', '--address', m.from]);
    mm(['transfer', '--to', TO, '--amount', String(m.amount), '--token', m.token, '--chain-id', m.chainId, '--wait']);
    console.log('sent ✓');
  } catch (e) {
    console.log(`failed: ${e.message}`);
  }
}
mm(['wallet', 'select', '--address', activeBefore]);
console.log('\n  Done. Run `node scripts/wallet_status.mjs` to confirm.\n');
