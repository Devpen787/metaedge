#!/usr/bin/env node
/**
 * Wallet status — the single source of truth for "where is what, and how much".
 *
 * Lists every wallet under the authenticated MetaMask account, reads each one's
 * balance across all chains, and writes a timestamped snapshot to
 * wallet-status.json (plus a readable table to the console). Run it any time you
 * need to know the money situation instead of re-deriving it from block explorers.
 *
 * Usage: node scripts/wallet_status.mjs
 * Requires: an authenticated `mm` session (mm auth status → authenticated: true).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const MM = fs.existsSync('node_modules/.bin/mm') ? 'node_modules/.bin/mm' : 'mm';

function mm(args) {
  const out = execFileSync(MM, [...args, '--json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const parsed = JSON.parse(out);
  if (parsed.ok === false) throw new Error(`mm ${args.join(' ')} failed: ${parsed.summary || 'unknown'}`);
  return parsed;
}

function short(a) { return a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '—'; }

// Guard: must be authenticated.
const auth = mm(['auth', 'status']);
if (!auth.data?.authenticated) {
  console.error('Not authenticated. Run `mm login browser` first.');
  process.exit(1);
}

// Remember the active wallet so we can restore it (this script must not change state).
const activeBefore = mm(['wallet', 'address']).data?.address;

const wallets = mm(['wallet', 'list']).data?.wallets || [];
const rows = [];
for (const w of wallets) {
  mm(['wallet', 'select', '--address', w.address]);
  const bal = mm(['wallet', 'balance']).data || {};
  const tokens = [];
  for (const ch of bal.chains || []) {
    for (const t of ch.tokens || []) {
      tokens.push({ chain: ch.name, token: t.token, amount: t.amount, usd: Number(t.usdValue || 0) });
    }
  }
  rows.push({ address: w.address, name: w.name || null, totalUsd: Number(bal.totalValue || 0), tokens });
}

// Restore the wallet that was active before we started poking around.
if (activeBefore) mm(['wallet', 'select', '--address', activeBefore]);

rows.sort((a, b) => b.totalUsd - a.totalUsd);
const snapshot = {
  takenAt: new Date().toISOString(),
  totalUsd: Number(rows.reduce((s, r) => s + r.totalUsd, 0).toFixed(2)),
  activeWallet: activeBefore,
  wallets: rows
};
fs.writeFileSync('wallet-status.json', JSON.stringify(snapshot, null, 2));
// Append a compact line to build a track record of balances over time.
const histLine = JSON.stringify({
  at: snapshot.takenAt,
  totalUsd: snapshot.totalUsd,
  perWallet: rows.map((r) => ({ a: r.address, usd: r.totalUsd }))
}) + '\n';
fs.appendFileSync('wallet-status-history.jsonl', histLine);

// Console report.
console.log(`\n  Wallet status — ${snapshot.takenAt}`);
console.log(`  Total across all wallets: $${snapshot.totalUsd.toFixed(2)}\n`);
for (const r of rows) {
  const tag = r.address === activeBefore ? ' (active)' : '';
  console.log(`  ${short(r.address)}  ${(r.name || '').padEnd(20)} $${r.totalUsd.toFixed(2)}${tag}`);
  console.log(`     ${r.address}`);
  for (const t of r.tokens) console.log(`       · ${t.amount} ${t.token} on ${t.chain}  ($${t.usd.toFixed(2)})`);
  if (!r.tokens.length) console.log('       · (empty)');
}
console.log('\n  Snapshot written to wallet-status.json\n');
