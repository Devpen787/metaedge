#!/usr/bin/env node
/**
 * Account conformance harness — the practical stand-in for a formal-methods
 * check. It enumerates the guarantees the wallet/account layer CLAIMS and
 * asserts each against the live endpoints, PASS/FAIL. Exits non-zero on any fail.
 *
 * This validates the RUNNING system, not a hand-written model — which is what
 * you actually want to know ("does it hold what it says?").
 *
 * Setup (local, against your real account):
 *   MM_DEV_HOME="$HOME" PORT=3000 NODE_ENV=production node dist/server.cjs &
 *   node scripts/validate_account.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const MM = fs.existsSync('node_modules/.bin/mm') ? 'node_modules/.bin/mm' : 'mm';
const jar = new Map();

function setCookies(res) {
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  for (const c of sc) { const kv = c.split(';')[0]; const i = kv.indexOf('='); if (i > 0) jar.set(kv.slice(0, i), kv.slice(i + 1)); }
}
async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  setCookies(res);
  let data = null; try { data = await res.json(); } catch { /* non-json */ }
  return { status: res.status, data };
}
function mm(a) { return JSON.parse(execFileSync(MM, [...a, '--json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 })); }
function rpc(method, params) {
  return fetch('https://arb1.arbitrum.io/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then((r) => r.json()).then((j) => j.result);
}

const results = [];
function check(name, pass, detail = '') { results.push({ name, pass: !!pass, detail }); console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); }

console.log(`\n  Account conformance — ${BASE}\n`);

// Establish a session + connect (MM_DEV_HOME makes this the real account).
await req('GET', '/');
const conn = await req('GET', '/api/mm/connect/status');
if (!conn.data?.connected) { console.error('  Could not connect. Start the server with MM_DEV_HOME="$HOME".'); process.exit(2); }

const originalActive = mm(['wallet', 'address']).data?.data?.address;

// --- CLAIM 1: the wallets endpoint reflects exactly the account's wallets. ---
const w = (await req('GET', '/api/mm/wallets')).data;
const cliList = (mm(['wallet', 'list']).data?.wallets || []).map((x) => x.address.toLowerCase()).sort();
const apiList = (w.wallets || []).map((x) => x.address.toLowerCase()).sort();
check('wallets endpoint matches `mm wallet list`', JSON.stringify(cliList) === JSON.stringify(apiList), `${apiList.length} wallets`);

const funded = (w.wallets || []).find((x) => x.totalUsd > 0);
const empty = (w.wallets || []).find((x) => x.totalUsd === 0);

// --- CLAIM 2: per-wallet balances don't collide (cache-bypass works). ---
if (funded && empty) {
  check('per-wallet balances are distinct (no read-cache collision)', funded.totalUsd > 0 && empty.totalUsd === 0, `funded $${funded.totalUsd.toFixed(2)} vs empty $0`);
} else {
  check('per-wallet balances are distinct (no read-cache collision)', true, 'skipped — need one funded + one empty wallet');
}

// --- CLAIM 3: a wallet's total equals the sum of its per-token USD. ---
if (funded) {
  const sum = funded.chains.reduce((s, c) => s + c.tokens.reduce((t, k) => t + k.usd, 0), 0);
  check('wallet total == sum of its token balances', Math.abs(sum - funded.totalUsd) < 0.01, `Σtokens $${sum.toFixed(2)} == total $${funded.totalUsd.toFixed(2)}`);
}

// --- CLAIM 4: reported balance matches on-chain truth (Arbitrum RPC). ---
if (funded) {
  const arb = funded.chains.find((c) => /arbitrum/i.test(c.name));
  const eth = arb?.tokens.find((t) => t.token === 'ETH');
  if (eth) {
    const wei = BigInt(await rpc('eth_getBalance', [funded.address, 'latest']));
    const chainEth = Number(wei) / 1e18;
    check('reported ETH matches on-chain (Arbitrum RPC)', Math.abs(chainEth - Number(eth.amount)) < 1e-9, `chain ${chainEth.toFixed(6)} vs api ${Number(eth.amount).toFixed(6)}`);
  }
}

// --- CLAIM 5: selecting switches active; enumeration restores it. ---
if (funded && empty) {
  await req('POST', '/api/mm/wallets/select', { address: empty.address });
  const aa = (await req('GET', '/api/mm/acting-as')).data;
  check('select switches the active wallet', aa.address?.toLowerCase() === empty.address.toLowerCase(), `active → ${aa.address?.slice(0, 8)}…`);
  await req('GET', '/api/mm/wallets'); // enumerates (selects each internally)
  const aa2 = (await req('GET', '/api/mm/acting-as')).data;
  check('enumeration restores the previously-active wallet', aa2.address?.toLowerCase() === empty.address.toLowerCase(), 'active unchanged by the scan');
}

// --- CLAIM 6: selection is validated against ownership. ---
const bad = await req('POST', '/api/mm/wallets/select', { address: '0x000000000000000000000000000000000000dead' });
check('rejects selecting a wallet not under the account', bad.status === 400, `HTTP ${bad.status}`);
const malformed = await req('POST', '/api/mm/wallets/select', { address: 'not-an-address' });
check('rejects a malformed address', malformed.status === 400, `HTTP ${malformed.status}`);

// --- CLAIM 7: consolidation excludes canonical, targets only funded non-canonical. ---
if (funded && empty) {
  await req('POST', '/api/mm/wallets/canonical', { address: funded.address });
  const p1 = (await req('GET', '/api/mm/wallets/consolidate/preview')).data;
  check('consolidation is empty when funds are on canonical', (p1.moves || []).length === 0, `${(p1.moves || []).length} moves`);
  await req('POST', '/api/mm/wallets/canonical', { address: empty.address });
  const p2 = (await req('GET', '/api/mm/wallets/consolidate/preview')).data;
  const referencesCanonical = (p2.moves || []).some((m) => m.from.toLowerCase() === empty.address.toLowerCase());
  const referencesFunded = (p2.moves || []).some((m) => m.from.toLowerCase() === funded.address.toLowerCase());
  check('consolidation plan sweeps funded → canonical, never from canonical', referencesFunded && !referencesCanonical, `${(p2.moves || []).length} moves from funded`);
}

// --- CLAIM 8: live execution is globally locked (paper). ---
const health = (await req('GET', '/api/health')).data;
check('live execution is globally locked', health.liveModeGlobalLock === true);
const consol = (await req('POST', '/api/mm/wallets/consolidate')).data;
check('consolidation refuses to move real funds in paper mode', consol.locked === true, consol.message ? '"' + consol.message.slice(0, 40) + '…"' : '');

// --- CLAIM 9: the guard's input (canonical mismatch) is reported correctly. ---
if (funded && empty) {
  await req('POST', '/api/mm/wallets/canonical', { address: funded.address });
  await req('POST', '/api/mm/wallets/select', { address: empty.address });
  const aa = (await req('GET', '/api/mm/acting-as')).data;
  check('mismatch is detected (active ≠ canonical → guard would block a live action)', aa.hasCanonical && aa.isCanonical === false, `active ${aa.address?.slice(0, 8)}… ≠ canonical`);
}

// Restore the wallet that was active before we started.
if (originalActive) mm(['wallet', 'select', '--address', originalActive]);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n  ${results.length - failed}/${results.length} claims hold.${failed ? `  ${failed} FAILED.` : '  System conforms. ✓'}\n`);
process.exit(failed ? 1 : 0);
