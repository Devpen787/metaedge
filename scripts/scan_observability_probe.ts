/**
 * SCAN-OBSERVABILITY PROBE — a no-entry scan used to emit nothing, so ongoing scans couldn't be
 * proven and the forward run wasn't auditable. This proves EVERY scan (incl. zero entries) writes
 * a durable record with timestamp, counts, and feed status. NO PRODUCTION DATA CHANGE (temp paths).
 *
 * Run: npx tsx scripts/scan_observability_probe.ts [--expect-closed]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXPECT_CLOSED = process.argv.includes('--expect-closed');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcscan-'));
  process.env.DATABASE_URL = path.join(dir, 'db.json');
  process.env.GC_SCAN_LOG = path.join(dir, 'scans.jsonl');
  (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });   // feed stays empty → 0 candidates
  const origRandom = Math.random; Math.random = () => 0.5;

  const gc = await import('../server/decision/golden_cross_scanner.js');
  const r1 = gc.scanOnce();                    // first no-entry scan
  const r2 = gc.scanOnce();                    // second no-entry scan
  Math.random = origRandom;

  const lines = fs.existsSync(process.env.GC_SCAN_LOG!) ? fs.readFileSync(process.env.GC_SCAN_LOG!, 'utf8').split('\n').filter(Boolean) : [];
  const recs = lines.map((l) => JSON.parse(l));
  const last = recs[recs.length - 1];

  const wroteEveryScan = recs.length === 2;
  const noEntriesButRecorded = r1.entries.length === 0 && !!last && Array.isArray(last.entries) && last.entries.length === 0;
  const hasAuditFields = !!last && typeof last.ts === 'string' && 'scanned' in last && 'evaluated' in last && 'qualified' in last && 'opened' in last && 'feedStale' in last;

  const ok = wroteEveryScan && noEntriesButRecorded && hasAuditFields;
  const cls = ok ? 'FACT_CLOSED' : 'FACT_OPEN';
  console.log('\n=== SCAN-OBSERVABILITY PROBE ===');
  console.log(JSON.stringify({
    id: 'NO_ENTRY_SCAN_IS_SILENT', class: cls,
    checks: { recordWrittenForEveryScan: wroteEveryScan, noEntriesStillRecorded: noEntriesButRecorded, hasAuditFields: hasAuditFields },
    recordsWritten: recs.length, lastRecord: last,
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? `\nCLOSED: ${recs.length} scan records written (both no-entry) with ts/counts/feed status — scans are now provable and auditable.\n`
    : '\nOPEN: scans not recorded.\n');
  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})().catch((e) => { console.log('PROBE_ERROR', e?.message); process.exit(EXPECT_CLOSED ? 1 : 0); });
