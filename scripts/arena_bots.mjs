#!/usr/bin/env node
/**
 * Arena bot battle: N bots play MetaEdge like real users — through the same
 * HTTP API the browser uses — so you can watch a real competition unfold in
 * the UI and verify the whole flow (trades → leaderboard → leagues → badges).
 *
 * Usage:  node scripts/arena_bots.mjs [--bots 4] [--rounds 10] [--interval 4000]
 * Needs the app running on :3000 (bots join the same db your browser sees).
 */
import fs from 'fs';
import path from 'path';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : dflt;
};
const BOTS = arg('bots', 4);
const ROUNDS = arg('rounds', 10);
const INTERVAL = arg('interval', 4000);
const B = process.env.METAEDGE_URL || 'http://127.0.0.1:3000';
const DB = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'db.json');
// Persistent identities: the same bots return every run (no ghost accounts),
// so they can live on a schedule and keep the board alive.
const STATE_FILE = path.join(path.dirname(DB), 'arena-bots.json');

const PERSONALITIES = [
  { name: 'Momo', strategy: 'momentum', asset: 'SOL', desc: 'buys strength, cuts weakness' },
  { name: 'Meanie', strategy: 'mean_reversion', asset: 'ETH', desc: 'buys dips, sells rips' },
  { name: 'Gridley', strategy: 'grid', asset: 'BTC', desc: 'alternates around the mid' },
  { name: 'Degen', strategy: 'custom_ai', asset: 'DOGE', desc: 'random + wallet perps' },
  { name: 'Turtle', strategy: 'momentum', asset: 'LINK', desc: 'slow momentum' },
  { name: 'Wick', strategy: 'mean_reversion', asset: 'AVAX', desc: 'fades every move' },
];

async function api(bot, method, p, body) {
  const res = await fetch(B + p, {
    method,
    headers: { cookie: bot.cookie, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function prices() {
  const r = await fetch(B + '/api/prices');
  return (await r.json()).prices;
}

// ---- Setup: create or RESUME bot players (session + agent + wallet link) ----
console.log(`\n⚔️  Arena bot battle: ${BOTS} bots · ${ROUNDS} rounds · ${INTERVAL / 1000}s per round · ${B}\n`);
let saved = {};
try { saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { /* first run */ }

const bots = [];
for (let i = 0; i < BOTS; i++) {
  const p = PERSONALITIES[i % PERSONALITIES.length];
  const prev = saved[p.name];

  // Try to resume the saved identity; sessions can expire, so verify.
  if (prev?.cookie) {
    const me = await (await fetch(B + '/api/session', { headers: { cookie: prev.cookie } })).json().catch(() => null);
    if (me?.user?.id === prev.userId) {
      bots.push({ ...p, ...prev, units: prev.units || 0, nonce: prev.nonce || 0 });
      console.log(`  🤖 ${p.name.padEnd(8)} returns — ${p.strategy} on ${p.asset}`);
      continue;
    }
  }

  const r = await fetch(B + '/api/session');
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(B + '/api/session', { headers: { cookie } })).json();
  const bot = { ...p, cookie, userId: me.user.id, units: 0, lastPrice: 0, nonce: 0 };
  const a = await api(bot, 'POST', '/api/agents', {
    name: `${p.name}Bot`, assetSymbol: p.asset, tradeType: 'token', strategyType: p.strategy,
    description: p.desc,
  });
  bot.agentId = (a.body.agent || a.body).id;
  bots.push(bot);
  console.log(`  🤖 ${p.name.padEnd(8)} joined — ${p.strategy} on ${p.asset}`);
}

function persistBots() {
  const out = {};
  for (const b of bots) out[b.name] = { cookie: b.cookie, userId: b.userId, agentId: b.agentId, units: b.units, nonce: b.nonce };
  try { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(out, null, 2)); } catch { /* remote mode */ }
}
persistBots();

// Simulated wallet link (competing requires a connected wallet). Only for bots
// that aren't linked yet; sequential writes verified after each write. Needs
// local db access — skipped gracefully when running against a remote URL.
try {
  for (const [i, bot] of bots.entries()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
      if (!db.users[bot.userId] || db.users[bot.userId].walletAddress) break;
      db.users[bot.userId].walletAddress = `0xb07${String(i).padStart(3, '0')}` + 'c0ffee'.repeat(6).slice(0, 34);
      db.users[bot.userId].walletConnectedAt = Date.now();
      fs.writeFileSync(DB, JSON.stringify(db, null, 2));
      const check = JSON.parse(fs.readFileSync(DB, 'utf8'));
      if (check.users[bot.userId]?.walletAddress) break;
    }
  }
  console.log(`  🔗 all bots wallet-linked\n`);
} catch {
  console.log(`  ⚠️  no local db access — bots must already be wallet-linked\n`);
}

// One shared league — created once, rejoined idempotently on later runs.
const existing = await api(bots[0], 'GET', '/api/arena/leagues');
let leagueId = (existing.body.leagues || []).find((l) => l.name === 'Bot Battle Royale')?.id;
if (!leagueId) {
  const lg = await api(bots[0], 'POST', '/api/arena/leagues', {
    name: 'Bot Battle Royale', startBalance: 10000, durationDays: 30, risk: 'High', prize: 'Silicon Glory',
  });
  leagueId = lg.body.league?.id;
}
if (leagueId) {
  for (const bot of bots) await api(bot, 'POST', `/api/arena/leagues/${leagueId}/join`, {});
  console.log(`  🏟  league "Bot Battle Royale" ready — all ${BOTS} bots in\n`);
}

// ---- The battle ----
const errors = [];
for (let round = 1; round <= ROUNDS; round++) {
  const px = await prices();
  const lines = [];
  for (const bot of bots) {
    const price = px[bot.asset]?.price;
    if (!price) continue;
    const change = px[bot.asset]?.change24h ?? 0;
    // ~$500 notional per trade, tiny assets get more units
    const clip = Math.max(0.001, Number((500 / price).toFixed(3)));

    let action = null; // 'buy' | 'sell' | null
    if (bot.strategy === 'momentum') action = change >= 0 ? 'buy' : (bot.units > 0 ? 'sell' : null);
    else if (bot.strategy === 'mean_reversion') action = change < 0 ? 'buy' : (bot.units > 0 ? 'sell' : null);
    else if (bot.strategy === 'grid') action = round % 2 === 1 ? 'buy' : (bot.units > 0 ? 'sell' : null);
    else action = Math.random() > 0.4 ? 'buy' : (bot.units > 0 ? 'sell' : null); // degen

    if (action === 'buy') {
      const r = await api(bot, 'POST', '/api/trades', {
        agentId: bot.agentId, assetSymbol: bot.asset, side: 'buy', size: clip, price, nonce: `n${bot.userId.slice(4, 8)}-${bot.nonce++}`,
      });
      if (r.status === 200) { bot.units += clip; lines.push(`${bot.name} BUY ${clip} ${bot.asset} @ $${price.toLocaleString()}`); }
      else errors.push(`${bot.name} buy → ${r.status} ${r.body.error || ''}`);
    } else if (action === 'sell' && bot.units > 0) {
      const size = Number(bot.units.toFixed(3));
      const r = await api(bot, 'POST', '/api/trades', {
        agentId: bot.agentId, assetSymbol: bot.asset, side: 'sell', size, price, nonce: `n${bot.userId.slice(4, 8)}-${bot.nonce++}`,
      });
      if (r.status === 200) { bot.units = 0; lines.push(`${bot.name} SELL ${size} ${bot.asset} @ $${price.toLocaleString()}`); }
      else errors.push(`${bot.name} sell → ${r.status} ${r.body.error || ''}`);
    }

    // Degen exercises the MetaMask wallet path occasionally (real quote → paper fill).
    if (bot.strategy === 'custom_ai' && round % 4 === 2) {
      const r = await api(bot, 'POST', '/api/mm/perps/open', { symbol: 'ETH', side: Math.random() > 0.5 ? 'long' : 'short', size: '0.2', leverage: '3' });
      if (r.status === 200 && r.body.arenaScored) lines.push(`${bot.name} 🦊 wallet perp ${r.body.side} 0.2 ETH (arena-scored @ $${r.body.arenaEntry})`);
    }
    // ...and settles an open wallet position the round after.
    if (bot.strategy === 'custom_ai' && round % 4 === 3) {
      const pos = await api(bot, 'GET', '/api/arena/positions');
      const open = (pos.body.positions || []).find((x) => x.status === 'open');
      if (open) {
        const c = await api(bot, 'POST', `/api/arena/positions/${open.id}/close`, {});
        if (c.status === 200) lines.push(`${bot.name} 🦊 settled ${open.symbol} → ${c.body.position.pnl >= 0 ? '+' : ''}$${c.body.position.pnl}`);
      }
    }
  }

  console.log(`R${String(round).padStart(2)} │ ${lines.join('  ·  ') || '(hold)'}`);

  if (round % 3 === 0 || round === ROUNDS) {
    const lb = await api(bots[0], 'GET', '/api/arena/leaderboard?leagueId=global');
    const rows = (lb.body.leaderboard || []).slice(0, 6)
      .map((p) => `#${p.rank} ${p.name} ${p.roi}${p.streak >= 2 ? ` 🔥${p.streak}` : ''}${p.badges?.length ? ` 🏅${p.badges.length}` : ''}`);
    console.log(`    🏆 ${rows.join('  |  ')}`);
  }
  if (round < ROUNDS) await new Promise((r) => setTimeout(r, INTERVAL));
}

// ---- Final standings + flow integrity ----
console.log('\n═══ FINAL ═══');
const finalGlobal = await api(bots[0], 'GET', '/api/arena/leaderboard?leagueId=global');
for (const p of finalGlobal.body.leaderboard || []) {
  console.log(`  #${p.rank} ${p.name.padEnd(14)} ${p.strategy.padEnd(15)} bal $${p.currentBal.toLocaleString()}  roi ${p.roi}  badges: ${(p.badges || []).map((b) => b.icon).join('') || '—'}`);
}
if (leagueId) {
  const flb = await api(bots[0], 'GET', `/api/arena/leaderboard?leagueId=${leagueId}`);
  console.log(`\n  🏟  Bot Battle Royale: ${(flb.body.leaderboard || []).map((p) => `#${p.rank} ${p.name} ${p.roi}`).join('  ·  ')}`);
}

persistBots();

const board = finalGlobal.body.leaderboard || [];
const ranksOk = board.map((p) => p.rank).join(',') === board.map((_, i) => i + 1).join(',');
const sortedOk = board.every((p, i) => i === 0 || board[i - 1].roiValue >= p.roiValue);
const botsOn = bots.filter((b) => board.some((p) => p.userId === b.userId)).length;
console.log(`\n  integrity: ranks ${ranksOk ? 'OK' : 'BROKEN'} · sort ${sortedOk ? 'OK' : 'BROKEN'} · ${botsOn}/${BOTS} bots on board · ${errors.length} request errors`);
if (errors.length) console.log('  errors:', errors.slice(0, 5).join(' | '));
console.log(`\n  Watch it live: ${B} → Agent Arena (bots stay on the board)\n`);
process.exitCode = ranksOk && sortedOk && botsOn === BOTS && errors.length === 0 ? 0 : 1;
