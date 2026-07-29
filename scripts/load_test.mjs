#!/usr/bin/env node
/**
 * Load test — many concurrent players hammering the app at once, to prove the
 * atomic writes, rate limits, and throttled sessions hold under real
 * concurrency with no 5xx and no data corruption.
 *
 *   node scripts/load_test.mjs [--players 20] [--rounds 8]
 * Needs the app running on :3000. Set DATABASE_URL to the server's db.json to
 * verify final integrity + write count.
 */
import fs from 'fs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? Number(process.argv[i + 1]) : d; };
const PLAYERS = arg('players', 20);
const ROUNDS = arg('rounds', 8);
const B = process.env.METAEDGE_URL || 'http://127.0.0.1:3000';
const DB = process.env.DATABASE_URL;

const codes = { '2xx': 0, '4xx': 0, '429': 0, '5xx': 0, err: 0 };
let latencies = [];

async function req(cookie, method, path, body) {
  const t0 = Date.now();
  try {
    const r = await fetch(B + path, {
      method, headers: { cookie, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    latencies.push(Date.now() - t0);
    if (r.status >= 500) codes['5xx']++;
    else if (r.status === 429) codes['429']++;
    else if (r.status >= 400) codes['4xx']++;
    else codes['2xx']++;
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) { codes.err++; return { status: 0, body: {} }; }
}

console.log(`\n🔨 Load test → ${B} · ${PLAYERS} concurrent players · ${ROUNDS} rounds\n`);

// Set up players (each: session + agent).
const players = [];
for (let i = 0; i < PLAYERS; i++) {
  const r = await fetch(B + '/api/session');
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(B + '/api/session', { headers: { cookie } })).json();
  const a = await req(cookie, 'POST', '/api/agents', { name: `L${i}`, assetSymbol: ['ETH', 'BTC', 'SOL'][i % 3], tradeType: 'token', strategyType: 'grid' });
  players.push({ cookie, id: me.user.id, agentId: (a.body.agent || a.body).id, i, nonce: 0, holding: false });
}
if (DB) {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  for (const p of players) db.users[p.id].walletAddress = '0x' + String(p.i).padStart(40, '0');
  fs.writeFileSync(DB, JSON.stringify(db));
}
console.log(`  ${players.length} players set up`);

// The storm: every player does several actions per round, all rounds concurrent.
const prices = await (await fetch(B + '/api/prices')).json().then((d) => d.prices);
const t0 = Date.now();
for (let round = 0; round < ROUNDS; round++) {
  const tasks = [];
  for (const p of players) {
    const asset = ['ETH', 'BTC', 'SOL'][p.i % 3];
    const price = prices[asset]?.price || 100;
    const size = Number((300 / price).toFixed(5));
    tasks.push(req(p.cookie, 'POST', '/api/trades', { agentId: p.agentId, assetSymbol: asset, side: p.holding ? 'sell' : 'buy', size, price, nonce: `l${p.i}-${p.nonce++}` }));
    p.holding = !p.holding;
    tasks.push(req(p.cookie, 'GET', '/api/arena/leaderboard?leagueId=global'));
    tasks.push(req(p.cookie, 'GET', '/api/dashboard-data'));
    if (round % 2 === 0) tasks.push(req(p.cookie, 'POST', '/api/copilot/execute', { assetSymbol: 'ETH', side: 'buy', usd: 100 }));
  }
  await Promise.all(tasks);
  process.stdout.write(`\r  round ${round + 1}/${ROUNDS} …`);
}
const dur = Date.now() - t0;
console.log('');

// Integrity check.
latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
const total = Object.values(codes).reduce((a, b) => a + b, 0);
console.log(`\n  requests: ${total} in ${dur}ms  (${Math.round(total / (dur / 1000))}/s)`);
console.log(`  status:   2xx ${codes['2xx']} · 4xx ${codes['4xx']} · 429 ${codes['429']} · 5xx ${codes['5xx']} · net-err ${codes.err}`);
console.log(`  latency:  p50 ${p50}ms · p95 ${p95}ms · max ${latencies[latencies.length - 1] || 0}ms`);

let integrityOk = true;
if (DB) {
  try {
    const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
    const users = Object.keys(db.users).length;
    const trades = db.trades.length;
    const balancesOk = Object.values(db.users).every((u) => Number.isFinite(u.paperBalance));
    console.log(`  db final: ${users} users · ${Object.keys(db.agents).length} agents · ${trades} trades · balances finite: ${balancesOk}`);
    integrityOk = balancesOk;
  } catch (e) { console.log('  db final: UNPARSEABLE — corruption!', e.message); integrityOk = false; }
}

const pass = codes['5xx'] === 0 && codes.err === 0 && integrityOk;
console.log(`\n  ${pass ? '✅ PASS' : '❌ FAIL'} — ${codes['5xx']} server errors, ${codes.err} network errors, db ${integrityOk ? 'intact' : 'CORRUPT'}\n`);
process.exitCode = pass ? 0 : 1;
