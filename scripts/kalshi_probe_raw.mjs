#!/usr/bin/env node
// status=open is the query value that WORKS (proven: returned 5 markets).
// The market's own `status` FIELD reads "active" — different thing. Do not
// conflate a query filter value with a response field value (I did; it cost a run).
const res = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=3&status=open',
  { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
const j = await res.json();
const ms = j.markets || [];
console.log('markets:', ms.length);
if (ms.length) {
  console.log('\n--- ALL fields on market[0] ---');
  console.log(Object.keys(ms[0]).sort().join('  '));
  console.log('\n--- the quote/price fields, verbatim ---');
  const m = ms[0];
  for (const k of Object.keys(m).sort()) {
    if (/price|bid|ask|dollar|volume|liquid|interest|status|ticker|title/i.test(k)) {
      console.log(`  ${k} = ${JSON.stringify(m[k])}`);
    }
  }
}
