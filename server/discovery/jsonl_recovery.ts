import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface MalformedJsonlRecord {
  id: string;
  schemaVersion: 1;
  observedAt: number;
  file: string;
  line: number;
  reason: string;
  contentHash: string;
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function quarantine(root: string, record: MalformedJsonlRecord): void {
  const file = path.join(root, 'malformed-jsonl.jsonl');
  fs.mkdirSync(root, { recursive: true });
  const known = new Set<string>();
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      try { known.add(String((JSON.parse(line) as { id?: string }).id ?? '')); } catch { /* preserve prior evidence */ }
    }
  } catch { /* first quarantine record */ }
  if (!known.has(record.id)) fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
}

export function readJsonlTolerant<T>(file: string, quarantineRoot: string): T[] {
  let content: string;
  try { content = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const rows: T[] = [];
  for (const [index, line] of content.split('\n').entries()) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line) as T); }
    catch (error) {
      const contentHash = hash(line); const relative = path.relative(path.dirname(quarantineRoot), file);
      quarantine(quarantineRoot, { id: `malformed_jsonl_${hash(`${relative}:${index + 1}:${contentHash}`).slice(0, 24)}`,
        schemaVersion: 1, observedAt: Date.now(), file: relative, line: index + 1,
        reason: error instanceof Error ? error.message : String(error), contentHash });
    }
  }
  return rows;
}
