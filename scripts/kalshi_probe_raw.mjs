#!/usr/bin/env node
// Show the FULL field list and a real market verbatim. No assumptions.
const res = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=3&status=active',
  { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
const j = await res.json();
const ms = j.markets || [];
console.log('markets:', ms.length);
if (ms.length) {
  console.log('\n--- ALL fields on market[0] ---');
  console.log(Object.keys(ms[0]).sort().join('\n'));
  console.log('\n--- market[0] verbatim ---');
  console.log(JSON.stringify(ms[0], null, 1).slice(0, 1400));
}
