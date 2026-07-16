#!/usr/bin/env node
// Throwaway diagnostic: what does Kalshi actually return, and where do markets
// get dropped? The overlap probe found 0 markets — this shows whether that is the
// status filter, the response shape, or the quote-field names.
const tries = [
  ['status=open',      'https://api.elections.kalshi.com/trade-api/v2/markets?limit=5&status=open'],
  ['no status filter', 'https://api.elections.kalshi.com/trade-api/v2/markets?limit=5'],
];
for (const [label, url] of tries) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    const body = await res.text();
    console.log(`\n--- ${label} → HTTP ${res.status} (${body.length} bytes)`);
    if (!res.ok) { console.log('   ', body.slice(0, 200)); continue; }
    let j; try { j = JSON.parse(body); } catch { console.log('    non-JSON:', body.slice(0, 200)); continue; }
    const keys = Object.keys(j);
    console.log('    top-level keys:', keys.join(', '));
    const ms = j.markets || [];
    console.log('    markets returned:', ms.length);
    if (ms.length) {
      const m = ms[0];
      console.log('    sample market fields:', Object.keys(m).slice(0, 18).join(', '));
      console.log(`    status=${m.status} yes_bid=${m.yes_bid} yes_ask=${m.yes_ask} volume=${m.volume}`);
      console.log(`    title: ${String(m.title).slice(0, 70)}`);
      // where does our filter drop them?
      const twoSided = ms.filter((x) => Number(x.yes_bid) > 0 && Number(x.yes_ask) > 0);
      console.log(`    survive "yes_bid>0 && yes_ask>0": ${twoSided.length}/${ms.length}  <-- our filter`);
    }
  } catch (e) { console.log(`\n--- ${label} → FAILED: ${e.message}`); }
}
