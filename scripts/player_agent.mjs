#!/usr/bin/env node
/**
 * Player Agent — drives MetaEdge through a real browser like a human would,
 * exercising every way to compete, and asserts each actually worked (reads the
 * rendered DOM, not just HTTP). Screenshots every step.
 *
 *   node scripts/player_agent.mjs
 *
 * Needs the app running on :3000. Set DATABASE_URL to the server's db.json so
 * the agent can simulate a completed wallet connect (MetaMask login can't run
 * headless); otherwise the compete steps are skipped with a note.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const URL = process.env.METAEDGE_URL || 'http://127.0.0.1:3000';
const DB = process.env.DATABASE_URL;
const OUT = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'player-run');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let shotN = 0;

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('  [page error]', String(e).slice(0, 160)));

async function shot(tag) {
  const name = `${String(++shotN).padStart(2, '0')}-${tag}.png`;
  await page.screenshot({ path: path.join(OUT, name) });
  return name;
}
async function clickText(t, wait = 1600) {
  const hit = await page.evaluate((x) => {
    const el = [...document.querySelectorAll('button,[role=button],a')].find((e) => e.textContent && e.textContent.trim().startsWith(x));
    if (el) { el.click(); return true; }
    return false;
  }, t);
  await new Promise((r) => setTimeout(r, wait));
  return hit;
}
// Deterministic SPA navigation via the app's own event (no click flakiness).
async function goTab(tab, wait = 2000) {
  await page.evaluate((x) => window.dispatchEvent(new CustomEvent('navigate', { detail: x })), tab);
  await new Promise((r) => setTimeout(r, wait));
}
async function bodyText() {
  return page.evaluate(() => document.body.innerText);
}
async function step(name, fn) {
  try {
    const detail = await fn();
    const s = await shot(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    results.push({ name, ok: true, detail: detail || '', shot: s });
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    const s = await shot('FAIL-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    results.push({ name, ok: false, detail: err.message, shot: s });
    console.log(`  ❌ ${name} — ${err.message}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log(`\n🎮 Player Agent → ${URL}\n`);

// ── Enter ──────────────────────────────────────────────────────────────────
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60_000 });
await new Promise((r) => setTimeout(r, 3000));

await step('Enter the paper room', async () => {
  assert(await clickText('Enter Paper Room', 2500), 'no Enter button');
  // dismiss welcome tour
  for (let i = 0; i < 6; i++) if (!(await clickText('Next', 600))) break;
  await clickText('Get Started', 800);
  const t = await bodyText();
  assert(/Paper|Dashboard|Balance/i.test(t), 'dashboard did not load');
  return 'in the app';
});

// ── Simulate a completed wallet connect (needed to compete) ──────────────────
let myUserId = null;
await step('Connect wallet (simulated)', async () => {
  const sess = await page.evaluate(() => fetch('/api/session').then((r) => r.json()));
  myUserId = sess?.user?.id;
  assert(myUserId, 'no session user');
  if (!DB) return 'SKIPPED — no DATABASE_URL (compete steps will be limited)';
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  db.users[myUserId].walletAddress = '0x' + 'a1b2c3d4'.repeat(5);
  db.users[myUserId].walletConnectedAt = Date.now();
  fs.writeFileSync(DB, JSON.stringify(db));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  return `connected as ${myUserId.slice(0, 10)}…`;
});

// ── Deploy a real agent from the Arena ───────────────────────────────────────
await step('Deploy an agent (Arena template)', async () => {
  assert(await clickText('Agent Arena', 1800), 'no Agent Arena nav');
  assert(await clickText('Deploy Agent', 1200) || await clickText('Deploy Your First Agent', 1200), 'no Deploy button');
  // Delta Farmer = grid on spot ETH: trades every autopilot tick and matches the
  // Trading Desk's SPOT tab, so the later steps have a real signal to exercise.
  assert(await clickText('Delta Farmer', 3000), 'template not clickable');
  const t = await bodyText();
  assert(/Delta Farmer/.test(t), 'agent did not appear');
  return 'Delta Farmer deployed (grid · ETH · spot)';
});

// ── Manual trade on the Trading Desk ─────────────────────────────────────────
await step('Trade on the Trading Desk', async () => {
  // Reach the desk reliably (verify with a desk-EXCLUSIVE marker).
  let onDesk = false;
  for (let i = 0; i < 3 && !onDesk; i++) {
    await clickText('Trading Desk', 2500);
    onDesk = /AUTHORIZING AGENT|PERPS \(Futures\)|Available:/i.test(await bodyText());
  }
  assert(onDesk, 'could not reach the Trading Desk');
  // Switch to SPOT — the desk auto-selects our matching token agent (grid/ETH).
  await clickText('SPOT', 1400);
  await new Promise((r) => setTimeout(r, 700));
  const tc = () => page.evaluate(() => fetch('/api/trades').then((r) => r.json()).then((d) => (d.trades || d).length).catch(() => 0));
  const before = await tc();
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /SUBMIT SIMULATED/i.test(b.textContent));
    if (btn && !btn.disabled) { btn.click(); return 'submitted'; }
    return btn ? `blocked: ${btn.textContent.trim()}` : 'no submit button';
  });
  await new Promise((r) => setTimeout(r, 2500));
  const after = await tc();
  assert(after > before, `desk trade not recorded (before ${before}, after ${after}; ${clicked})`);
  return `trade recorded (${before} → ${after})`;
});

// ── Natural-language trade via Swarm Copilot ─────────────────────────────────
await step('Trade via Swarm Copilot', async () => {
  assert(await clickText('Swarm Copilot', 1800), 'no Copilot nav');
  // Focus the real input and type with real keystrokes so React state updates.
  const sel = await page.evaluate(() => {
    const el = [...document.querySelectorAll('input,textarea')].find((e) => /orchestr|analyze|hedge/i.test(e.placeholder || ''));
    if (!el) return null;
    el.setAttribute('data-player', '1');
    return '[data-player="1"]';
  });
  assert(sel, 'copilot input not found');
  await page.focus(sel);
  await page.type(sel, 'Buy $500 of ETH now', { delay: 15 });
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 6500));
  assert(await clickText('Execute paper trade', 4500), 'no Execute button (parse failed?)');
  const t = await bodyText();
  assert(/Filled:/.test(t), 'copilot fill not confirmed');
  return t.match(/Filled:[^.]+/)?.[0]?.slice(0, 60) || 'filled';
});

// ── Prediction bet ───────────────────────────────────────────────────────────
await step('Place a prediction bet', async () => {
  assert(await clickText('Predictions', 1800), 'no Predictions nav');
  await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input')].find((i) => /USD|1000|amount/i.test(i.value || i.placeholder || ''));
    if (inp) { inp.value = '250'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await new Promise((r) => setTimeout(r, 500));
  assert(await clickText('CONFIRM SIMULATED', 2500) || await clickText('PREDICT YES', 1500), 'could not place bet');
  return 'bet placed';
});

// ── Engage Autopilot ─────────────────────────────────────────────────────────
await step('Engage Autopilot', async () => {
  assert(await clickText('Autopilot', 1800), 'no Autopilot nav');
  assert(await clickText('Engage all', 2000), 'no Engage all');
  const t = await bodyText();
  assert(/LIVE/.test(t), 'engine not LIVE');
  return 'engine LIVE';
});

// ── Wait for the autotrader, then confirm autonomous trades ──────────────────
await step('Autopilot trades on its own', async () => {
  await new Promise((r) => setTimeout(r, 12000)); // let ticks land
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  await clickText('Autopilot', 2000);
  const t = await bodyText();
  const logged = Number((t.match(/(\d+)\s+Auto-trades logged/i) || [])[1] || 0);
  assert(logged > 0 || /Autopilot executed/i.test(t), 'no autonomous trades appeared');
  return `${logged} auto-trades logged`;
});

// ── Check the leaderboard ────────────────────────────────────────────────────
await step('Appear on the Arena leaderboard', async () => {
  assert(await clickText('Agent Arena', 2000), 'no Arena nav');
  await new Promise((r) => setTimeout(r, 1500));
  const board = await page.evaluate((uid) => fetch('/api/arena/leaderboard?leagueId=global').then((r) => r.json()).then((d) => d.leaderboard || []), myUserId);
  const me = board.find((p) => p.userId === myUserId);
  assert(me, `not on board (${board.length} competitors)`);
  return `rank #${me.rank}, roi ${me.roi}, strategy ${me.strategy}`;
});

// ── Platform Data reflects real activity ─────────────────────────────────────
await step('Platform Data shows real numbers', async () => {
  assert(await clickText('Platform Data', 2000), 'no Platform Data nav');
  const stats = await page.evaluate(() => fetch('/api/platform-stats').then((r) => r.json()));
  assert(stats.metrics.users >= 1 && stats.metrics.agents >= 1, 'metrics not real');
  return `${stats.metrics.users} players · ${stats.metrics.agents} agents · ${stats.metrics.trades} trades`;
});

await browser.close();

// ── Report ───────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.ok).length;
console.log(`\n═══ PLAYER AGENT REPORT: ${passed}/${results.length} passed ═══`);
for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}  [${r.shot}]`);
console.log(`\n  Screenshots → ${OUT}/\n`);
process.exitCode = passed === results.length ? 0 : 1;
