#!/usr/bin/env node
/**
 * Best-Trade trigger check — evaluates docs/edgeops/cards/best-trade-eth-breakout-v1.md
 * against live market data and prints GO / NO-GO. Read-only: never places an order.
 * The card's rule: entries are pre-committed; a human approves before any execution.
 *
 * Usage: node scripts/best_trade_check.mjs
 */
const CARD = 'best-trade-eth-breakout-v1';

const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum&price_change_percentage=24h', { headers: { accept: 'application/json' } });
const [eth] = await res.json();
const price = eth.current_price, hi = eth.high_24h, lo = eth.low_24h, chg = eth.price_change_percentage_24h ?? 0;

const longTrig = price >= hi * 0.999 && chg >= 1.5;
const shortTrig = price <= lo * 1.001 && chg <= -1.5;

console.log(`\n  ${CARD} — ${new Date().toISOString()}`);
console.log(`  ETH $${price.toLocaleString()} · 24h ${chg.toFixed(2)}% · range $${lo.toLocaleString()}–$${hi.toLocaleString()}`);
console.log(`  LONG trigger  (≥ $${(hi * 0.999).toFixed(0)} and 24h ≥ +1.5%): price ${price >= hi * 0.999 ? '✓' : '✗'} momentum ${chg >= 1.5 ? '✓' : '✗'}`);
console.log(`  SHORT trigger (≤ $${(lo * 1.001).toFixed(0)} and 24h ≤ −1.5%): price ${price <= lo * 1.001 ? '✓' : '✗'} momentum ${chg <= -1.5 ? '✓' : '✗'}`);

if (longTrig || shortTrig) {
  const side = longTrig ? 'long' : 'short';
  const stop = longTrig ? price * 0.99 : price * 1.01;
  const target = longTrig ? price * 1.025 : price * 0.975;
  console.log(`\n  🔥 GO — ${side.toUpperCase()} setup live. Pre-committed plan:`);
  console.log(`     entry ~$${price.toFixed(0)} · stop $${stop.toFixed(0)} (−1%) · target $${target.toFixed(0)} (+2.5%) · $3 margin @ 5x`);
  console.log(`     NEXT: get operator approval, then execute per the card. Log thesis BEFORE entry.\n`);
  process.exit(10);
} else {
  console.log(`\n  NO-GO — conditions not met. Do not trade. Re-run later.\n`);
}
