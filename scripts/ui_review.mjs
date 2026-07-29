#!/usr/bin/env node
/**
 * UI review: capture what a USER actually sees on every tab (full-page
 * screenshots), so design regressions get caught by eyes, not just endpoints.
 *
 * Usage: node scripts/ui_review.mjs [outDir]   (app must be running on :3000)
 */
import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = process.argv[2] || 'ui-review';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [page error]', String(e).slice(0, 140)));

await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 60_000 });
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: `${OUT}/00-landing.png` });
console.log('  captured 00-landing');

async function clickByText(text) {
  const clicked = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, [role="button"], a')];
    const el = els.find((e) => e.textContent && e.textContent.trim().startsWith(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
  await new Promise((r) => setTimeout(r, 2000));
  return clicked;
}

async function shot(name, fullPage = true) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log('  captured', name);
}

// Get past the entry screen a fresh visitor sees.
await clickByText('Enter Paper Room');
await new Promise((r) => setTimeout(r, 2500));

// Dismiss the welcome tour so tab content is visible.
await page.keyboard.press('Escape');
await page.evaluate(() => {
  const close = [...document.querySelectorAll('button')].find((b) => b.querySelector('svg') && (b.textContent || '').trim() === '' && b.closest('[class*="fixed"]'));
  if (close) close.click();
});
await new Promise((r) => setTimeout(r, 1500));

const tabs = [
  'Dashboard', 'Agent Arena', 'Swarm Copilot', 'Intent Solver', 'Autopilot',
  'Trading Agents', 'Trading Desk', 'Market Charts', 'Predictions',
  'Rooms', 'Vaults', 'Platform Data', 'Evidence Map', 'Specs Hub'
];
let i = 1;
for (const tab of tabs) {
  const ok = await clickByText(tab);
  if (!ok) { console.log('  MISSING NAV:', tab); continue; }
  await shot(`${String(i).padStart(2, '0')}-${tab.toLowerCase().replace(/\s+/g, '-')}`);
  i++;
}

// Wallet connection card
if (await clickByText('Wallet')) {
  await shot(`${String(i++).padStart(2, '0')}-wallet-modal`, false);
}

await browser.close();
console.log(`\nDone → ${OUT}/`);
