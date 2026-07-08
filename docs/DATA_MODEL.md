# Data Model — identity tiers & storage lifecycle

Date: 2026-07-08 · Owner: platform · Enforced by `server/janitor.ts` + `platform-stats`

## Why this exists

Three growth leaks fed one fragile store: (1) every visit — including internet
scanners — minted a permanent user+session; (2) the research fleet writes
thousands of trades/day; (3) every trade also writes uncapped audit+graph
events. `data/db.json` is parsed on every request and rewritten whole on every
mutation on a 1-vCPU box — unbounded growth kills the site in weeks, not years.

## Identity tiers (who is a "user"?)

| Tier | Definition | Signal | Persistence |
|---|---|---|---|
| T0 Visitor | Touched the site; never acted | no `profile.claimedAt`, no artifacts | Pruned after 48h idle |
| T1 Player | Meaningful action | `profile.claimedAt` set (Enter Paper Room), or owns trades/agents/rooms/vaults/bets | Kept |
| T2 Connected | Wallet bound | `walletAddress` | Kept |
| T3 Operator | Us | Devin's accounts, `edgeops_research` | Kept; basis for the live-mode allowlist |

**Metrics honesty:** public counts report **Players (T1+)**, with visitors
stated separately. "374 users" that are mostly scanner noise violates the
no-fiction rule as much as a fake APY does.

## Storage lifecycle (hot vs cold)

| Data | Hot (db.json) | Cold (data/archive/*.jsonl) |
|---|---|---|
| Users/sessions | T1+ only; T0 pruned with sessions | not archived (noise) |
| Trades | Open episodes + recent closed | Flat episodes: research account >7d; everyone >35d (outside the arena month) |
| Audit/graph events | Last 5,000 each | Older spilled to archive |
| Market ticks/funding | never in db | data/market/, 30d rotation |
| Declined counters | never in db | data/edgeops/, aggregates only |

**Archival safety rule:** a trade episode (user+agent+asset) is archived only
when its net position is flat AND every trade in it is older than the cutoff —
cost-basis math and arena monthly standings can never reference archived rows.

## Growth math (why the janitor is enough for now)

Fleet: ~2–4k trades/day × ~600B + equal audit/graph events ≈ 3–6MB/day
unbounded → ~50–100MB in two weeks → multi-second request parses → dead site.
With the janitor: hot db stabilizes around a few MB (open episodes + 30d of
competing trades + capped events + real users only).

## SQLite migration triggers (deliberate, not now)

Migrate storage.ts to SQLite when ANY of:
- hot db.json > 25MB after janitor, or
- p95 API latency > 250ms attributable to parse/write, or
- write contention errors observed (concurrent writeDatabase clobbering).
The interface (readDatabase/writeDatabase call sites) is the migration seam.
