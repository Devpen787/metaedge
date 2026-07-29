import fs from 'fs';
import path from 'path';
import { readDatabase, writeDatabase } from './storage.js';

// Janitor — enforces docs/DATA_MODEL.md so the flat-file db stays small enough
// to parse per-request on a 1-vCPU box. Three jobs, all conservative:
//   1. Prune T0 visitors (never acted, idle >48h) and their sessions.
//   2. Cap audit/graph events at 5,000 each; spill older rows to archive.
//   3. Archive FLAT trade episodes (net position ≈ 0, all trades older than
//      the cutoff): research account >7d, everyone else >35d (outside the
//      arena month). Cost-basis and standings can never reference archived rows.

const ARCHIVE_DIR = path.join(process.cwd(), 'data', 'archive');
const EVENT_CAP = 5_000;
const VISITOR_IDLE_MS = 48 * 3_600_000;
const RESEARCH_CUTOFF_MS = 7 * 86_400_000;
const GLOBAL_CUTOFF_MS = 35 * 86_400_000;

function archive(name: string, rows: unknown[]) {
  if (!rows.length) return;
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const file = path.join(ARCHIVE_DIR, `${name}-${new Date().toISOString().slice(0, 7)}.jsonl`);
  fs.appendFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

export function runJanitor(): string {
  const db = readDatabase();
  const now = Date.now();

  // ---- 1. prune visitors (T0): no claim, no wallet, no artifacts, idle ----
  const owners = new Set<string>();
  for (const t of db.trades) owners.add(t.userId);
  for (const a of Object.values(db.agents) as any[]) owners.add(a.ownerId);
  for (const r of Object.values(db.rooms) as any[]) (r.memberIds || []).forEach((id: string) => owners.add(id));
  for (const v of Object.values(db.vaultClubs || {}) as any[]) { owners.add(v.ownerId); (v.memberIds || []).forEach((id: string) => owners.add(id)); }
  for (const m of (db as any).arenaMembers || []) owners.add(m.userId);
  for (const mkt of Object.values(db.predictionMarkets || {}) as any[]) {
    const bets = Array.isArray(mkt.bets) ? mkt.bets : Object.values(mkt.bets || {});
    for (const b of bets as any[]) if (b?.userId) owners.add(b.userId);
  }

  let prunedUsers = 0;
  for (const [id, u] of Object.entries(db.users) as [string, any][]) {
    const acted = u.profile?.claimedAt || u.walletAddress || owners.has(id);
    const idleSince = Math.max(u.lastActiveAt || 0, u.createdAt || 0);
    if (!acted && now - idleSince > VISITOR_IDLE_MS) { delete db.users[id]; prunedUsers++; }
  }
  const before = Object.keys(db.sessions || {}).length;
  for (const [sid, s] of Object.entries(db.sessions || {}) as [string, any][]) {
    if (!db.users[s.userId] || s.expiresAt < now) delete db.sessions[sid];
  }
  const prunedSessions = before - Object.keys(db.sessions || {}).length;

  // ---- 2. cap events, spill old to archive ----
  let spilledEvents = 0;
  for (const key of ['auditEvents', 'graphEvents'] as const) {
    const arr = (db as any)[key] as any[];
    if (arr && arr.length > EVENT_CAP) {
      const old = arr.splice(0, arr.length - EVENT_CAP);
      archive(key, old);
      spilledEvents += old.length;
    }
  }

  // ---- 3. archive flat trade episodes ----
  const researchIds = new Set(
    (Object.entries(db.users) as [string, any][]).filter(([, u]) => u.username === 'edgeops_research').map(([id]) => id)
  );
  const episodes = new Map<string, any[]>();
  for (const t of db.trades) {
    const k = `${t.userId}|${t.agentId}|${t.assetSymbol}`;
    (episodes.get(k) || episodes.set(k, []).get(k)!).push(t);
  }
  const archivable = new Set<string>();
  for (const [k, trades] of episodes) {
    const userId = k.split('|')[0];
    const cutoff = now - (researchIds.has(userId) ? RESEARCH_CUTOFF_MS : GLOBAL_CUTOFF_MS);
    if (trades.some((t) => t.timestamp > cutoff)) continue;          // episode still fresh
    let net = 0;
    for (const t of trades) net += (t.side === 'buy' || t.side === 'long') ? t.size : -Math.min(t.size, Math.max(net, 0));
    if (Math.abs(net) < 1e-9) archivable.add(k);                     // flat → safe to archive
  }
  let archivedTrades = 0;
  if (archivable.size) {
    const keep: any[] = [], out: any[] = [];
    for (const t of db.trades) {
      (archivable.has(`${t.userId}|${t.agentId}|${t.assetSymbol}`) ? out : keep).push(t);
    }
    archive('trades', out);
    (db as any).trades = keep;
    archivedTrades = out.length;
  }

  writeDatabase(db);
  const summary = `janitor: pruned ${prunedUsers} visitors + ${prunedSessions} sessions, spilled ${spilledEvents} events, archived ${archivedTrades} trades (flat episodes)`;
  console.log(`[janitor] ${summary}`);
  return summary;
}

export function startJanitor() {
  setTimeout(() => { try { runJanitor(); } catch (e: any) { console.warn('[janitor] failed:', e?.message); } }, 120_000).unref();
  setInterval(() => { try { runJanitor(); } catch (e: any) { console.warn('[janitor] failed:', e?.message); } }, 24 * 3_600_000).unref();
}
