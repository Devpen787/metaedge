---
createdBy: opencode
tool: opencode
timestamp: 2026-07-09T12:30:00Z
type: handoff
status: proposed
schemaVersion: 2
scope: metaedge-gemini
confidence: high
privacy: repo-safe
---

# MetaEdge: Production Audit — Fix Queue

## Context

MetaEdge is a production-deployed React 19 + Express monolith (AI trading simulation with real MetaMask on-chain capability). It uses a JSON file database (`data/db.json`) with atomic writes but no concurrent write locking. The application can execute real on-chain transactions via MetaMask Agent CLI. Solo-maintained by the author.

**Three files to know before starting:**
- `server/storage.ts` — JSON database (read/write with atomic-rename pattern)
- `server/metamask.ts` — MetaMask CLI subprocess management (1383 lines)
- `src/secure-core/crypto/secrets.ts` — API key HMAC signing

---

## How to use this handoff

1. **Read the Master Execution Checklist** at the bottom — it lists all 114 items with status columns.
2. **Execute in tier order**: Tier 0 → Tier 1 → Tier 2. Do not skip tiers.
3. **Read sections on demand, not all at once.** Each tier section below has Problem/Fix/Verify. Read only what you're working on.
4. **Mark progress** in the Master Execution Checklist: `[x]` Reviewed → `[x]` Decide → `[x]` Implemented or `[x]` Left Out (with reason).
5. **Skip-if logic**: Items marked "Skip if X" are optional — implement only if the precondition applies.
6. **Research sections (5-7)** are labeled Reference vs Actionable. Reference = read for context if working on that topic. Actionable = implementation-ready plans.
7. **Grading sections have been removed** — they were useful during peer review but are not needed for execution.

### Quick start
- Need fastest time-to-fix? Do the **6 Batch Fix Patterns** first (they cover 40+ items via grep).
- Want to risk-rank? Follow tiers (Tier 0 = active production threats).
- Just exploring? Read the **Consolidated Fix Queue** for a bird's-eye view.

---

## Consolidated Fix Queue (Master Lookup Table)

All items cataloged in this handoff. Each maps to a detailed section below. Cross-reference for effort and owning component.

> **STATUS (2026-07-09):** This table is a lookup only and carries **no status**. Live status lives in the
> [Master Execution Checklist](#master-execution-checklist) at the bottom. Tier 0 and Tier 1 are **done**
> (`29b20d1`, `2a70bb0`): 22 implemented, 5 left out with cause, 2 deferred (0.2, 1.4).
> **Four IDs in this table point at files that do not exist** — I2 (`server/intents.ts`), SW1
> (`server/swarm.ts`), C2 (`server/chart.ts`), P2 (`server/predictionMarkets.ts`). See the checklist notes.

| ID | Brief | Tier | Effort | Owning Component(s) | Tab Source |
|---|---|---|---|---|---|
| **0.1** | HMAC pepper fallback + timing leak | Tier 0 | 10m | `src/secure-core/crypto/secrets.ts` (path corrected; **no importers** — latent, not active) | — |
| **0.2** | JSON DB no concurrent write lock | Tier 0 | 2-4h | `server/storage.ts` (all callers) | — |
| **DA2** | Cookie secret hardcoded fallback | Tier 0 | 2m | `server.ts:40` | Deep Audit |
| **1.1** | `res.json()` before `res.ok` (17+ sites) | Tier 1 | 30m | `App.tsx` + all components | — |
| **1.2** | Uncaught mutation errors | Tier 1 | 35m | All `catch {}` in App.tsx handlers | — |
| **1.3** | `tradeParse.ts` missing `await` on `fetch()` | Tier 1 | 5m | `src/lib/tradeParse.ts:50` | — |
| **1.4** | Server routes: no input validation, `req: any` | Tier 1 | 1-2d | All `server/*.ts` route files | — |
| **D1** | Profile save silently closes modal | Tier 1 | 5m | `Dashboard.tsx` | Tab 1 |
| **D12** | Profile edit resets on parent re-render | Tier 1 | 5m | `Dashboard.tsx`, `App.tsx` | Tab 1 |
| **W1** | `switchTo()` fires `wallet-connected` on failure | Tier 1 | 5m | `WalletCenter.tsx` | Tab 2 |
| **W2** | Stale data — key bump never implemented | Tier 1 | 10m | `WalletCenter.tsx`, `WalletsPanel.tsx` | Tab 2 |
| **W4** | `disconnectWallet()` ignores API response | Tier 1 | 5m | `AgentWalletModal.tsx` | Tab 2 |
| **R1** | `declined-daily.json` non-atomic write race | Tier 1 | 15m | `server/declined.ts`, `server/research.ts` | Tab 3 |
| **R2** | ResearchFleet silent API failure (no else) | Tier 1 | 5m | `ResearchFleet.tsx` | Tab 3 |
| **T1** | TradingRoom race on rapid room switch | Tier 1 | 15m | `TradingRoom.tsx` | Tab 4 |
| **T2** | Silent error swallowing — stale room data | Tier 1 | 5m | `TradingRoom.tsx` | Tab 4 |
| **A1** | `rsi_meanrev` strategy missing from type + form | Tier 1 | 15m | `AgentWorkshop.tsx`, `types.ts` | Tab 5 |
| **A2** | Price auto-update overwrites user edits | Tier 1 | 10m | `AgentWorkshop.tsx` | Tab 5 |
| **C2** | Server empty catch blocks on feed failure | Tier 1 | 15m | `server/chart.ts` | Tab 7 |
| **P1** | Empty catch block | Tier 1 | 5m | `PredictionMarkets.tsx` | Tab 8 |
| **P2** | Malformed `outcomePrices` swallowed | Tier 1 | 5m | `server/predictionMarkets.ts` | Tab 8 |
| **P3** | TOCTOU balance check | Tier 1 | 5m | `server/predictionMarkets.ts` | Tab 8 |
| **Q2** | `res.json` before `res.ok` in quant routes | Tier 1 | 5m | `server/quant.ts` | Tab 12 |
| **Q3** | Silent catch with comment admitting error gap | Tier 1 | 5m | `server/quant.ts` | Tab 12 |
| **I2** | `res.json` before `res.ok` in intent routes | Tier 1 | 5m | `server/intents.ts` | Tab 14 |
| **SW1** | `res.json` before `res.ok` in swarm routes | Tier 1 | 5m | `server/swarm.ts` | Tab 15 |
| **AR1** | 6 empty catch blocks in AgentArena | Tier 1 | 15m | `AgentArena.tsx` | Tab 16 |
| **M1** | Check `res.ok` before `r.json()` | Tier 1 | 5m | `MetaedgeAnalytics.tsx` | Tab 17 |
| **DA1** | `uncaughtException` handler doesn't exit | Tier 1 | 5m | `server.ts:156` | Deep Audit |
| **2.1** | Autotrader tick stacking | Tier 2 | 5m | `server/autotrader.ts` | — |
| **2.2** | Split `metamask.ts` (1383 lines) | Tier 2 | 3h | `server/metamask.ts` | — |
| **2.3** | VaultClubs copy-paste `activeRoomId` | Tier 2 | 2m | `VaultClubs.tsx` | — |
| **2.4** | QuantEngine fake "Deploy to Agent" button | Tier 2 | 5m | `QuantEngine.tsx` | — |
| **2.5** | AgentArena checkboxes not state-bound | Tier 2 | 10m | `AgentArena.tsx` | — |
| **2.6** | Price seed discrepancy (BTC $63k vs $96k) | Tier 2 | 5m | `server/prices.ts`, `TokenMarketChart.tsx` | — |
| **2.7** | TS type mismatches (`PaperTrade.side`, `DatabaseState`) | Tier 2 | 10m | `src/types.ts` | — |
| **D11** | Safety Rails uses wrong audit count | Tier 2 | 2m | `Dashboard.tsx` | Tab 1 |
| **W3** | 5-min polling loop no AbortController | Tier 2 | 10m | `AgentWalletModal.tsx` | Tab 2 |
| **R3** | Array index as React key | Tier 2 | 2m | `ResearchFleet.tsx` | Tab 3 |
| **T5** | Invite token in URL query param | Tier 2 | 15m | `TradingRoom.tsx` | Tab 4 |
| **A4** | No delete confirmation on agent delete | Tier 2 | 5m | `AgentWorkshop.tsx` | Tab 5 |
| **A5** | Strategy form missing `maxDrawdown` validation | Tier 2 | 15m | `AgentWorkshop.tsx` | Tab 5 |
| **A6** | Strategy name uniqueness not enforced | Tier 2 | 10m | `AgentWorkshop.tsx` | Tab 5 |
| **A9** | Edit strategy modal resets on re-render | Tier 2 | 10m | `AgentWorkshop.tsx` | Tab 5 |
| **H1** | Fake "Bot Trailing Stop" buttons, no onClick | Tier 2 | 2m | `TradingHub.tsx` | Tab 6 |
| **H2** | Silent catch on price polling | Tier 2 | 5m | `TradingHub.tsx` | Tab 6 |
| **C1** | TokenMarketChart is fabricated random walk | Tier 2 | 2m | `TokenMarketChart.tsx` | Tab 7 |
| **C3** | No loading/error states on chart | Tier 2 | 15m | `TokenMarketChart.tsx` | Tab 7 |
| **V2** | Array index keys on milestones | Tier 2 | 2m | `VaultClubs.tsx` | Tab 9 |
| **G3** | GraphEvidence CSS divs not a real graph | Tier 2 | 2m | `GraphEvidence.tsx` | Tab 10 |
| **Q1** | Fake deploy button (reinforces 2.4) | Tier 2 | 2m | `QuantEngine.tsx` | Tab 12 |
| **AP1** | Autopilot handler silently returns on error | Tier 2 | 5m | `server/autopilot.ts` | Tab 13 |
| **AP2** | Unused `user` prop | Tier 2 | 2m | `AgenticAutopilot.tsx` | Tab 13 |
| **I1** | Multi-step is 700ms setTimeout theater | Tier 2 | 2m | `IntentSolver.tsx` | Tab 14 |
| **SW2** | 3 array index keys in SwarmCopilot | Tier 2 | 5m | `SwarmCopilot.tsx` | Tab 15 |
| **SW3** | Unused `user` prop | Tier 2 | 5m | `SwarmCopilot.tsx` | Tab 15 |
| **AR3** | No `.catch()` on clipboard write | Tier 2 | 2m | `AgentArena.tsx` | Tab 16 |
| **AR4** | No AbortController on fetch effects | Tier 2 | 15m | `AgentArena.tsx` | Tab 16 |
| **AR5** | No loading states on async operations | Tier 2 | 20m | `AgentArena.tsx` | Tab 16 |
| **AR6** | Form controls for risk/prize or remove POST body | Tier 2 | 5m | `AgentArena.tsx` | Tab 16 |
| **AR7** | No leave-league feature | Tier 2 | 30m | `AgentArena.tsx`, `server/arena.ts` | Tab 16 |
| **M2** | Add error logging + user-visible error state | Tier 2 | 5m | `MetaedgeAnalytics.tsx` | Tab 17 |
| **M3** | Use stable key instead of array index | Tier 2 | 2m | `MetaedgeAnalytics.tsx` | Tab 17 |
| **M4** | Replace setInterval with recursive setTimeout | Tier 2 | 10m | `MetaedgeAnalytics.tsx` | Tab 17 |
| **DA3** | server.ts no CORS config | Tier 2 | 10m | `server.ts` | Deep Audit |
| **DA5** | `tradeParse.ts` `res.json` before `res.ok` root cause | Tier 2 | 2m | `src/lib/tradeParse.ts:51` | Deep Audit |
| **DA6** | `tradeParse.ts` NaN `fillPx` when no `.trade.price` | Tier 2 | 2m | `src/lib/tradeParse.ts:54` | Deep Audit |
| **DA7** | `types.ts` missing `canonicalWallet` on `User` | Tier 2 | 5m | `src/types.ts:13-25` | Deep Audit |
| **DA8** | Dead schema: `autopilot`, `thesis`, `edgeops`, `review` never persisted | Tier 2 | 10m | `src/types.ts` | Deep Audit |

---

## Batch Fix Patterns (Grep Targets)

Claude: run these `rg` commands to find ALL instances of a pattern in one pass, then batch-fix.

### Pattern 1: `res.json()` before `res.ok` (reinforces 1.1, covers 17+ App.tsx sites + components)
```bash
rg "\.json\(\)" --type ts --type tsx src/ server/ | rg -v "^\s*//"
```
**Fix:** Swap order — check `if (!res.ok)` first, then `await res.json()`.

### Pattern 2: Array index as React key (`key={i}`)
```bash
rg "key=\{\s*i\s*\}" --type tsx src/components/
```
**Fix:** Use a stable field instead — `key={item.id}`, `key={\`${item.name}-${item.timestamp}\`}`, etc.

### Pattern 3: Empty/silent catch blocks
```bash
rg "\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)" --type ts --type tsx src/ server/
```
**Fix:** At minimum `console.error`, ideally set error state for user feedback.

### Pattern 4: `setInterval` with no cleanup / abort
```bash
rg "setInterval" --type ts --type tsx src/ server/
```
**Fix:** Use recursive `setTimeout` or add cleanup + AbortController.

### Pattern 5: `any` type usage
```bash
rg ": any" --type ts --type tsx src/
```
**Fix:** Replace with proper interfaces matching the server response shape.

### Pattern 6: Unused vars / imports (sweep)
```bash
rg "import.*from" src/components/ | rg -v "react|useState|useEffect|use"
```
**Fix:** Tree-shake unused imports in each component.

---

## Tier 0 — Fix Today (Active production threats)

### 0.1 Hardcoded HMAC pepper fallback

**Problem:** `src/secure-core/crypto/secrets.ts:24` — the `SYSTEM_PEPPER` env var has a fallback to the literal string `'fallback_pepper'`. If this env var is unset in production (deploy script forgot it, .env not copied, etc.), every API key in the system is signed with a static string from source code. Any attacker can forge API keys.

**Fix:** Remove the fallback. Crash at startup if `SYSTEM_PEPPER` is missing.

```typescript
// Change line 24 from:
const pepper = process.env.SYSTEM_PEPPER || 'fallback_pepper';

// To:
const pepper = process.env.SYSTEM_PEPPER;
if (!pepper) throw new Error('SYSTEM_PEPPER environment variable is required');
```

Also on line 51: HMAC comparison uses `===` (string equality) which leaks timing. Replace with `crypto.timingSafeEqual`.

```typescript
// Change from:
const storedHash = keyRecord.hash;
const computedHash = crypto.createHmac('sha256', pepper).update(data).digest('hex');
return storedHash === computedHash;

// To:
const storedHash = keyRecord.hash;
const computedHash = crypto.createHmac('sha256', pepper).update(data).digest('hex');
if (storedHash.length !== computedHash.length) return false;
return crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(computedHash));
```

**Verify:** Start the server without `SYSTEM_PEPPER` set — it should crash immediately with a clear error message. Then set `SYSTEM_PEPPER` — it should start normally.

---

### 0.2 JSON database has no concurrent write locking

**Problem:** `server/storage.ts` — every server module follows the pattern `readDatabase()` → mutate → `writeDatabase()`. Two concurrent requests can both read, both mutate, and the second write silently clobbers the first (last-writer-wins). This causes:

- Prediction market bets double-spending the same balance (both pass the balance check)
- Session writes clobbering each other
- Agent config changes silently lost
- Autotrader ticks racing with manual trades

The atomic-write-per-call (temp file + fsync + rename) is correct for crash safety, but does not prevent inter-request races.

**Fix:** Add a promise-based mutex to `storage.ts` and guard `writeDatabase` with it. This is ~25 lines. Do not add a dependency.

```typescript
// Add to server/storage.ts:

class DatabaseMutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise(resolve => {
      this.queue.push(() => {
        this.locked = true;
        resolve();
      });
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      this.queue.shift()!();
    } else {
      this.locked = false;
    }
  }
}

const dbMutex = new DatabaseMutex();
```

Then wrap `writeDatabase`:

```typescript
// Change from:
export function writeDatabase(db: AppDatabase): void {
  const tmp = DB_FILE + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.fsyncSync(fs.openSync(tmp, 'r'));
  fs.renameSync(tmp, DB_FILE);
}

// To:
export async function writeDatabase(db: AppDatabase): Promise<void> {
  await dbMutex.acquire();
  try {
    const tmp = DB_FILE + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.fsyncSync(fs.openSync(tmp, 'r'));
    fs.renameSync(tmp, DB_FILE);
  } finally {
    dbMutex.release();
  }
}
```

**⚠️ CRITICAL — Stale-read problem not fixed by this alone:**
Guarding only `writeDatabase` prevents clobbering but **does not prevent stale-read races**. Example:

1. Request A reads balance: 100
2. Request B reads balance: 100 (concurrent with A)
3. A writes balance: 95 (deducted 5)
4. B writes balance: 90 (deducted 10 from stale 100)

A and B both read 100, both mutate, the mutex serializes writes, but B still wrote 90 based on stale data. The true balance should be 85. The mutex must protect the **entire read-mutate-write cycle**, not just the write.

**Better approach:** Refactor all callers to use a single `transaction<T>(fn: (db: AppDatabase) => T): T` that acquires the mutex, reads the DB, calls fn, writes the DB, and releases. This is the standard pattern. It requires changing every call site but eliminates the stale-read hole.

**Audit all call sites (11+ files):**
- `server/auth.ts`, `server/predictions.ts`, `server/trades.ts`, `server/agents.ts`, `server/autotrader.ts`, `server/metamask.ts`, `server/rooms.ts`, `server/vaults.ts`, `server/arena.ts`, `server/platform.ts`, `server/research.ts`

**⚠️ Sync-to-async risk:**
`writeDatabase` is called from synchronous code in ~half the call sites (`readDatabase()` + mutate + `writeDatabase()` in one synchronous block). Making it `async` means ALL callers need `await`. Sync callers will silently drop the write (Promise resolves, write runs, but the function returns before it completes). Every call site must be audited and wrapped.

**Verify:** Write a test that fires 10 concurrent writeDatabase calls, then reads the database and confirms all 10 changes are present. The existing smoke tests (`npm run smoke:session`, etc.) should still pass.

---

## Tier 1 — Fix This Week (Production bugs)

### 1.1 `res.json()` called before `res.ok` check

**Problem:** `src/App.tsx` — multiple mutation handlers call `const data = await res.json()` before checking `res.ok`. When the Express server returns a non-JSON error (e.g., an HTML 500 page from a crashed route), `res.json()` will throw a parse error, masking the real failure. The user sees nothing — no error message, no toast, nothing.

**Additionally found in (expanded scope):**
- `src/components/WalletsPanel.tsx:104` — `res.json()` before `res.ok`
- `src/components/AgentWalletModal.tsx:70` — `res.json()` before `res.ok` on readiness fetch
- `src/lib/tradeParse.ts:39` — no `await` on `fetch()` AND `res.json()` before `res.ok` (see New Item 1.3)

**Fix:** Check `res.ok` before parsing JSON, in every handler.

```typescript
// Change from:
const data = await res.json();
if (!res.ok) throw new Error(data.error || 'Request failed');

// To:
if (!res.ok) {
  let message = 'Request failed';
  try { const data = await res.json(); message = data.error || message; } catch {}
  throw new Error(message);
}
const data = await res.json();
```

**Grep target:** `rg 'const data = await res.json\(\)' src/ --include '*.tsx' --include '*.ts'` to find all 17+ occurrences.

**Verify:** Temporarily make a route return `res.status(500).send('Server Error')` (text, not JSON) and confirm the frontend shows an error instead of a blank white screen.

---

### 1.2 Mutation handlers have uncaught errors

**Problem:** `src/App.tsx` — every `handle*` function throws errors but never catches them. No try/catch, no `.catch()`, no error boundary. If any API call fails, React gets an unhandled promise rejection. React 19's error boundary default unmounts the component tree — user sees a white screen.

**Fix two things:**

**a) Wire the existing ErrorBoundary into App.tsx:**
```typescript
// In src/App.tsx — import ErrorBoundary (import likely exists but is unused):
import ErrorBoundary from './components/ErrorBoundary';

// Then wrap the main content:
<ErrorBoundary>
  {/* all tab content, e.g.: */}
  {activeTab === 'dashboard' && <Dashboard ... />}
  {/* ... */}
</ErrorBoundary>
```

**b) Add a catch to every mutation handler — but with user feedback:**
```typescript
// Add near the top of App.tsx:
async function safeHandler<T>(fn: () => Promise<T>, onError?: (err: Error) => void): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Action failed:', error);
    onError?.(error);
    // Callers should pass a setter for a toast/notification:
    // safeHandler(() => handleX(), (e) => setToast(e.message))
    return undefined;
  }
}

// Then wrap each handler call:
// Before:
await handleClaimFaucet();
// After:
await safeHandler(() => handleClaimFaucet(), (e) => setError(e.message));
```

**⚠️ IMPORTANT — Don't silence errors silently:**
`safeHandler` returns `undefined` on failure. If a handler does `setData(await handler())` and the handler throws, state is set to `undefined`. Either:
- Add `fallback` parameter to `safeHandler` (already shown in type signature as optional)
- Or add `.catch(console.error)` to every handler call site (minimum viable)

---

### NEW 1.3 `executeTrade()` in tradeParse.ts has no `await` on `fetch()` — call is silently dropped

**Problem:** `src/lib/tradeParse.ts:39-40` — the `executeTrade()` function calls `fetch()` without `await`, then immediately calls `.json()` on the returned Promise object (not the Response). This means:

1. `fetch()` returns a Promise (which is truthy, so no error is thrown)
2. `Promise.json()` is not a function → `res.json()` throws a TypeError
3. The catch block logs `"Trade execution failed:"` and the error is silently swallowed
4. The trade is **never actually sent to the server**
5. The user sees no error feedback — the UI appears to work but the trade never executes

```typescript
// Current code at tradeParse.ts:39-40 (as reviewed):
export async function executeTrade(text: string): Promise<{ success: boolean }> {
  try {
    const trade = parseTrade(text);
    if (!trade) return { success: false };

    const res = fetch('/api/trades/execute', {  // ← NO AWAIT
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });
    // res is a Promise, not a Response!
    const data = await res.json();  // ← NOT checking res.ok EITHER
    // ...
```

**Fix:**

```typescript
// Change line 39 from:
const res = fetch('/api/trades/execute', {

// To:
const res = await fetch('/api/trades/execute',

// And add the res.ok check (same pattern as 1.1):
if (!res.ok) {
  let msg = 'Trade execution failed';
  try { const d = await res.json(); msg = d.error || msg; } catch {}
  throw new Error(msg);
}
```

**Verify:** Call `executeTrade("buy $100 BTC")` from the console. Confirm the POST request appears in the Network tab of DevTools. Without the fix, the request never fires.

---

### NEW 1.4 Server routes have NO input validation — `req: any` throughout, no zod/joi

**Problem:** Every server route file in `/server/` uses `req: any` instead of typed request handlers. There is no validation library (no zod, no joi, no express-validator). The only sanitization is `sanitizeText()` for string fields. This means:

- `server/predictions.ts` — `resolveMarket` has no ownership check: anyone who knows a marketId can resolve it, claiming the pool
- `server/arena.ts` — league join has no rate limit: an attacker can create thousands of small leagues to exhaust the filesystem (25-league cap per user, but no cap per session)
- `server/auth.ts` — no session rotation on re-auth: re-logging in creates a new session but the old one remains valid (30-day TTL). An attacker who steals a session token can use it even after the user changes their password
- `server/trades.ts` — `executeTrade` accepts arbitrary amounts: no per-user daily limit, no minimum trade size, no position size limits
- `server/vaults.ts` — `contribute` accepts arbitrary amounts: positive number check only, no max contribution cap

All routes parse JSON body with no schema validation. Malformed input (negative numbers, NaN, missing required fields, extra unexpected fields) passes through to `readDatabase()` → mutate → `writeDatabase()`.

**Fix — Add a lightweight validation utility (no dependency):**

```typescript
// Create server/validate.ts:
type Schema = Record<string, { type: 'string' | 'number' | 'boolean'; required?: boolean; min?: number; max?: number }>;

function validate(body: any, schema: Schema): { valid: boolean; errors: string[]; data: Record<string, any> } {
  const errors: string[] = [];
  const data: Record<string, any> = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = body?.[key];

    if (value === undefined || value === null) {
      if (rules.required) errors.push(`${key} is required`);
      continue;
    }

    if (rules.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) { errors.push(`${key} must be a number`); continue; }
      if (rules.min !== undefined && num < rules.min) errors.push(`${key} must be >= ${rules.min}`);
      if (rules.max !== undefined && num > rules.max) errors.push(`${key} must be <= ${rules.max}`);
      data[key] = num;
    } else if (rules.type === 'string') {
      if (typeof value !== 'string') { errors.push(`${key} must be a string`); continue; }
      data[key] = sanitizeText(value);
    } else if (rules.type === 'boolean') {
      if (typeof value !== 'boolean') { errors.push(`${key} must be a boolean`); continue; }
      data[key] = value;
    }
  }

  return { valid: errors.length === 0, errors, data };
}
```

Then at the top of each route handler:

```typescript
const { valid, errors, data } = validate(req.body, {
  amount: { type: 'number', required: true, min: 1, max: 100000 },
});
if (!valid) return res.status(400).json({ error: errors.join('; ') });
```

**For the auth session rotation issue:**

```typescript
// server/auth.ts — on login:
// Before creating new session:
const existingSessions = db.sessions.filter(s => s.userId === user.id);
for (const session of existingSessions) {
  db.sessions = db.sessions.filter(s => s.id !== session.id);
}
// Then create new session as before
```

**Verify:** Send a POST to `/api/predictions/resolve` with an invalid marketId — should return 400, not 500. Send a POST to `/api/trades/execute` with `{ "amount": -100 }` — should reject. Log in twice and confirm the first session token is invalidated.

---

## Tier 2 — Fix This Month

### 2.1 Autotrader tick stacking

**Problem:** `server/autotrader.ts` — `setInterval(runAutotrader, TICK_MS)` has no guard against overlapping ticks. If a tick takes longer than 90s (which it will under write contention once you add the mutex from 0.2), multiple ticks run concurrently, racing on the same agent balances.

**⚠️ Dependency on 0.2:** This fix only matters after the mutex is added, because ticks will then serialize and take longer. If you fix 2.1 before 0.2, there's no risk (the inFlight guard is harmless when idle), but skipping this after 0.2 creates a balance double-count bug.

**Fix:** Add an `inFlight` boolean:

```typescript
let autotraderInFlight = false;

async function runAutotrader() {
  if (autotraderInFlight) return;
  autotraderInFlight = true;
  try {
    // ... existing tick logic ...
  } finally {
    autotraderInFlight = false;
  }
}
```

**Verify:** Inject an artificial delay (e.g., `await new Promise(r => setTimeout(r, 200_000))`) into the tick, confirm the interval does not stack calls.

---

### 2.2 Split metamask.ts

**Problem:** `server/metamask.ts` at 1383 lines handles: wallet connect/disconnect, balance queries, swaps, perps, prediction markets, intent parsing, Gemini AI calls, readiness checks, rate limiting, SWR caching. Under production pressure, finding the right function is slow.

**Fix:** Extract into 4 files with no behavior change:

- `server/metamask-wallet.ts` — connect, disconnect, list wallets, select wallet, balance, address
- `server/metamask-swaps.ts` — swap execution, perps
- `server/metamask-predict.ts` — prediction market interaction
- `server/metamask-core.ts` — shared helpers: `runMmCore`, `withWalletLock`, rate limiter, SWR cache, input validators

Each file re-exports its router, and `server.ts` imports from all four.

**⚠️ Design decisions you'll need to make:**
- How does shared state (connected wallets, wallet locks) pass between the four files? Options: a shared module `metamask-state.ts` with exports, or a class instance.
- How are Express routers combined? `server.ts` should do `app.use('/api', metamaskWalletRouter)`, etc.
- Are there circular dependencies? `metamask-predict.ts` likely imports `withWalletLock` from core. Verify before splitting.

**Verify:** All existing smoke tests pass: `npm run smoke:session`, `npm run smoke:metamask`, etc.

---

### 2.3 VaultClubs copy-paste bug — `activeRoomId` instead of `activeVaultId`

**Problem:** `src/components/VaultClubs.tsx:49` — `handleContribute` calls `activeRoomId()` (a function from TradingRoom) instead of `activeVaultId`. Works by coincidence because `activeRoomId` falls back to `vaults[0]?.id`, but if the user selects a non-first vault and contributes, the contribution targets the wrong vault.

**Fix:**
```typescript
// Change line 49 from:
await onContributeToVault(activeRoomId(), Number(contribAmount));
// To:
await onContributeToVault(activeVaultId, Number(contribAmount));
```

**Verify:** Create two vaults, select the second one, contribute. Confirm the contribution goes to the correct vault.

---

### 2.4 QuantEngine fake "Deploy to Agent" button

**Problem:** `src/components/QuantEngine.tsx:254-271` — the "Deploy to Agent" button has no API call. It renames itself to "Deployed!" for 3 seconds, then reverts. No agent config is updated, no strategy is deployed.

**Fix:** Either wire it to a real API endpoint that updates the agent's strategy parameters, or remove the button and replace with static text explaining Quant output is advisory.

```typescript
// Option A — remove the button (simplest, recommended):
// Replace lines 254-272 with:
<p className="text-xs text-slate-400 mt-2">
  Quant results are advisory. Manually configure these parameters in the Trading Agents tab.
</p>

// Option B — wire it to the agent update API:
// (requires backend endpoint, ~30 min)
```

---

### 2.5 AgentArena create-league checkboxes not state-bound

**Problem:** `src/components/AgentArena.tsx:906-922` — the strategy checkboxes in the create-league form use `defaultChecked` with no `onChange` handler. The submitted form body (line 307-313) doesn't include the selected strategies at all. Users can toggle checkboxes but their choices are silently ignored.

**Fix — Frontend:**
```typescript
// Add state near line 111:
const [allowedStrategies, setAllowedStrategies] = useState({
  spot: true, perps: true, yield: true, prediction: true,
});

// Replace each checkbox onChange (e.g., line 907):
onChange={(e) => setAllowedStrategies(prev => ({...prev, spot: e.target.checked}))}

// Add to the POST body (line 307-313):
body: JSON.stringify({
  name: newLeagueName,
  startBalance: newLeagueBalance,
  durationDays: newLeagueDuration,
  allowedStrategies,
  risk: 'Medium',
  prize: 'Community Pool',
}),
```

**⚠️ Backend may also need changes:**
Check if `server/arena.ts` reads and enforces `allowedStrategies` from the POST body. If not, the frontend changes only send the data — the server still ignores it. Add server-side validation for `allowedStrategies` if the field doesn't exist yet.

**Verify:** Create a league with only one strategy enabled. Confirm the league record reflects that restriction in the database.

---

### NEW 2.6 Price seed discrepancy — server/prices.ts vs TokenMarketChart

**Problem:** Two seed price sources give different values for the same assets:

| Asset | `server/prices.ts:11-15` (seed) | `TokenMarketChart.tsx` (INITIAL_TOKENS) |
|---|---|---|
| BTC | $63,000 | ~$96,000 |
| ETH | $1,771 | ~$3,125 |

The server's `GET /api/prices` endpoint returns the lower values. `TokenMarketChart.tsx` uses INITIAL_TOKENS for its chart and order book display. The discrepancy means:
- TradingHub shows user portfolio values based on server prices (lower)
- TokenMarketChart shows chart/order book based on INITIAL_TOKENS (higher)
- Users see different portfolio values depending on which component they're looking at
- Autotrader calculates P&L against server prices, but users compare against chart prices

Additionally, both `TokenMarketChart.tsx:138` and `TradingHub` poll `/api/prices` every 60s independently (cross-cutting pattern #2 from the original audit). Consider a shared hook.

**Fix — Option A (align server to charts, recommended):**
Update `server/prices.ts:11-15` to match INITIAL_TOKENS from TokenMarketChart:
```typescript
// server/prices.ts — change seed prices:
btc: 96000,
eth: 3125,
// Also update any other assets to match
```

**Fix — Option B (make server the single source):**
Remove `INITIAL_TOKENS` from TokenMarketChart and use server prices only. This requires loading server prices on mount and handling the loading state.

**Verify:** Open TradingHub and TokenMarketChart side by side. BTC price should be the same in both (within polling delay).

---

### NEW 2.7 TypeScript type mismatches — `PaperTrade.side` and `DatabaseState`

**Problem:** `src/types.ts` has two type inconsistencies:

**a) `PaperTrade.side` is typed as `'buy' | 'sell'` but server code in some paths emits `'long' | 'short'`:**

```typescript
// src/types.ts (current):
export interface PaperTrade {
  side: 'buy' | 'sell';
  // ...
}

// server/trades.ts — some paths emit:
{ side: 'long', /* ... */ }
{ side: 'short', /* ... */ }
```

This causes:
- TypeScript errors in components that destructure `trade.side` and compare against `'buy' | 'sell'` when server returns `'long'`
- Silent runtime failures (no match in switch/case)
- Confusion for new devs reading the code

**b) `DatabaseState` is missing `predictionMarkets` field:**

```typescript
// src/types.ts (current):
export interface DatabaseState {
  users: User[];
  sessions: SessionRecord[];
  wallets: WalletState[];
  friendRooms: FriendRoom[];
  tradingAgents: TradingAgent[];
  paperStrategies: PaperStrategy[];
  paperTrades: PaperTrade[];
  vaultClubs: VaultClub[];
  arenaLeagues: ArenaLeague[];
  // predictionMarkets is MISSING here
}
```

But `data/db.json` has a `predictionMarkets` array, and `server/predictions.ts` reads/writes it. TypeScript won't catch typos or missing fields when accessing `db.predictionMarkets`.

**Fix:**

```typescript
// src/types.ts — fix PaperTrade.side:
export interface PaperTrade {
  side: 'buy' | 'sell' | 'long' | 'short';
  // or normalize to 'buy' | 'sell' at the server boundary
}

// Add to DatabaseState:
export interface DatabaseState {
  // ... existing fields ...
  vaultClubs: VaultClub[];
  predictionMarkets: PredictionMarket[];  // ADD THIS
  arenaLeagues: ArenaLeague[];
  // ... existing fields ...
}
```

**Option B (server normalization — more robust):**
In `server/trades.ts`, normalize the side field before writing to the database:
```typescript
// At the top of the trade execution handler:
const side = req.body.side === 'long' ? 'buy' : req.body.side === 'short' ? 'sell' : req.body.side;
```

**Verify:** Run `npx tsc --noEmit` (or whatever the type-check command is) — no type errors related to `PaperTrade.side` or `DatabaseState`.

---

## Deep Audit: Cross-Cutting Findings (from parallel agent review)

Findings from a second-pass audit of infrastructure files that were not covered by the 17 tab-by-tab reviews.

### New Fix Items

| ID | Severity | File:Line | Finding | Fix | Effort |
|---|---|---|---|---|---|
| **S1** | **HIGH** | `server.ts:155-156` | **`uncaughtException` handler does not exit**: Process continues in potentially corrupt state. [Node.js docs explicitly warn against this](https://nodejs.org/api/process.html#warning-using-uncaughtexception-correctly). | Log, perform minimal cleanup, then `process.exit(1)` so a process manager restarts cleanly. | 5m |
| **S2** | **HIGH** | `server.ts:40` | **Hardcoded cookie secret fallback**: `cookieParser(process.env.COOKIE_SECRET \|\| 'metaedge-secret-key-cookie')` — if env var is unset in production, all cookies signed with a publicly visible string from source code. Session forgery possible. | Same pattern as 0.1: crash at startup if `COOKIE_SECRET` is missing. | 2m |
| **S3** | **MEDIUM** | `server.ts` (absent) | **No CORS configuration**: Fine while SPA is served from same origin, but blocks any external API consumer. | Add `cors` middleware or hand-configure permissive + allow-list pattern. | 10m |
| **S4** | **HIGH** | `server/storage.ts:134-156` + all callers | **No concurrent write lock — lost updates guaranteed**: Every handler follows `readDatabase()` → modify → `writeDatabase()`. Two concurrent requests: both read v1, both modify, second write silently clobbers the first. Affects `server/trades.ts:46-48,49,123` and every other route. | Add per-process mutex (e.g. `async-mutex` or simple queue) wrapping the read-modify-write cycle. Reinforces 0.2. | Already covered by 0.2 |
| **S5** | **MEDIUM** | `src/lib/tradeParse.ts:51-52` | **Actual root cause of `res.json()` before `res.ok`**: Not `api.ts` (which is a clean 4-line pass-through). `tradeParse.ts` calls `await res.json()` on line 51, checks `!res.ok` on line 52. If server returns non-JSON error body (HTML 500, proxy error), `res.json()` throws `SyntaxError` before the check. Real error message is lost. | Swap: check `!res.ok` first, then `await res.json()`. | 2m |
| **S6** | **MEDIUM** | `src/lib/tradeParse.ts:54` | **`fillPx` can become `NaN`**: `data.trade?.price` may be `undefined` (server returns success with no `.trade`). `Number(undefined)` = `NaN`, renders `"$NaN"` in UI. | Guard with `data.trade?.price ?? 0` or skip the fill-price append. | 2m |
| **S7** | **LOW** | `src/types.ts:13-25` | **`User` type missing `canonicalWallet?: string`**: 2 real users in `data/db.json:1484,1589` carry this field. It's used at runtime but absent from the interface. | Add `canonicalWallet?: string` to `User` interface. | 2m |
| **S8** | **LOW** | `src/types.ts:57-74, 107-125` | **Dead schema surface — fields typed but never persisted**: `TradingAgent.autopilot?`, `TradingAgent.lastAutoTradeAt?`, `PaperTrade.thesis?`, `PaperTrade.edgeops?`, `PaperTrade.review?`, `PaperStrategy.originalStrategyId?`. Zero occurrences in `db.json`. These are planned-but-unimplemented blueprint code. Not urgent, but creates confusion about what actually works. | Either remove them (clean up type surface) or add a `// @TODO` comment documenting that these are planned. Also `WalletState` (types.ts:36-42) and `TradeThesis`/`TradeReview` (types.ts:95-105,129-136) are orphaned. | 10m |

### Additional server.ts Observations

| Issue | File:Line | Severity |
|---|---|---|
| Routes registered with no prefix (`app.use(authRouter)` instead of `app.use('/api', router)`) — every router must define its own `/api/...` prefix internally. Silent shadowing risk. | `server.ts:80-92` | Medium |
| Sync `readFileSync` in route handlers blocks event loop | `server.ts:73,77` | Medium |
| Vite middleware startup failure silently swallowed — server starts without Vite, SPA routes return 404 | `server.ts:107-109` | Medium |
| `fs.existsSync('dist/index.html')` in dev can accidentally trigger prod mode | `server.ts:98` | Low |

---

## Cross-Cutting Patterns (informational, no fix item)

1. **`res.json()` before `res.ok`** — 17 occurrences in `src/App.tsx` alone + 3 in components. Covered by 1.1 and 1.3.

2. **Duplicate 60s price polling** — `TokenMarketChart.tsx:138` and `TradingHub` both poll `/api/prices` every 60s. Net effect: 2 requests/min for the same data. Consider a shared `usePrices()` hook or a lightweight SWR cache. See also 2.6 (price seed fix — good time to add the shared hook).

3. **Fake/placeholder data in trading components** — `TokenMarketChart.tsx` generates random walk chart data (`generateHistoricalData`) and random order book values (`Math.random() * 5 + 0.5`). These are decorative but labeled as "Bid Liquidity" and "Ask Liquidity", which could mislead users. Consider adding a disclaimer badge: "Simulated data — not live market data."

4. **GraphEvidence is not a real graph** — `GraphEvidence.tsx` renders equally-spaced buttons in a flex-wrap container with animated SVG circles behind them. No force-directed layout, no edge rendering. The "Kuzu-Projected" label overpromises. Either add real graph visualization or rename the label.

5. **IntentSolver multi-step execution is fake** — Steps animate through "simulating → executed" with `setTimeout` timers. Only single-asset trades (`tradeAction`) actually execute. Multi-step DeFi routes are purely cosmetic.

---

## Code Size & Decomposition Audit

Oversized files hurt upgradability, review velocity, and mental model. Below are the 5 files that should be decomposed, ordered by impact.

### Ranking (lines, high to low)

| Rank | File | Lines | Suggested Split | Effort | Impact |
|---|---|---|---|---|---|
| 1 | `server/metamask.ts` | **1,383** | Split into: `metamask-exec.ts` (CLI subprocess mgmt), `metamask-tx.ts` (transaction building), `metamask-balance.ts` (balance/readiness), `metamask-connect.ts` (connect/disconnect flow) | 3h (already item 2.2) | **High** — single-file debugging tax, can't unit-test subprocess logic independently |
| 2 | `src/components/AgentArena.tsx` | **1,215** | Split into: `ArenaLeagueList.tsx` (league cards), `ArenaMemberList.tsx` (member table), `ArenaBattleLog.tsx` (battle results), `ArenaCreateForm.tsx` (creation modal), `ArenaScoreboard.tsx` (rankings). Move server calls to a `useArena.ts` hook. | 2h | **High** — 1215-line components are impossible to review in one pass; 6 empty catch blocks already found |
| 3 | `src/App.tsx` | **945** | Extract into: `src/hooks/useSession.ts` (loadSession, login, logout), `src/hooks/useTabs.ts` (tab routing + CustomEvents), `src/hooks/useEntities.ts` (fetchEntities), `src/hooks/useProfile.ts` (profile mutations), `src/context/SessionContext.tsx` (session state + provider). Keep App.tsx as a thin orchestrator (~100 lines). | 4h (design) + 6h (implement) | **Critical** — every mutation handler lives here; 945 lines means one dev can't hold all of App.tsx in working memory. Adding a new tab requires touching 5+ spots in this file. Root cause of the `res.json`-before-`res.ok` pattern spreading to 17 sites. |
| 4 | `src/components/TradingHub.tsx` | **696** | Extract into: `TradingOrderBook.tsx` (order book), `TradingChart.tsx` (price chart), `TradingPositions.tsx` (open positions), `TradingControls.tsx` (buy/sell buttons). Move shared price state to a `usePrices.ts` hook. | 1.5h | **Medium** — 696 lines of mixed concerns (chart, order book, positions, controls) in one file; duplicate polling with TokenMarketChart |
| 5 | `src/components/Dashboard.tsx` | **585** | Extract into: `DashboardStats.tsx` (balance, trade count, PnL), `DashboardSafetyRails.tsx` (audit stats), `DashboardActivityFeed.tsx` (recent events). | 1h | **Medium** — 585 lines of flat JSX with no sub-components; every prop drill touches `user` at top level |

### Optimization Tactics (applicable to all)

**1. Extract data-fetching into custom hooks.**
- Problem: Every component inlines `apiFetch()` + `useState` + `useEffect` with `setInterval`. The same boilerplate (~12 lines) appears 17+ times.
- Fix: Create `useApiFetch<T>(url, interval?)` hook that wraps fetch, error state, loading state, AbortController cleanup, and interval management.
- Impact: Eliminates ~1,200 lines of boilerplate across all components. Adds AbortController to every polling effect for free.

```typescript
// src/hooks/useApiFetch.ts — proposed
function useApiFetch<T>(url: string, options?: { interval?: number }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const fetch_ = async () => {
      try {
        const res = await apiFetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) { setData(json); setError(null); }
      } catch (e) {
        if (!cancelled && !ac.signal.aborted) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch_();
    if (options?.interval) {
      const t = setInterval(fetch_, options.interval);
      return () => { clearInterval(t); cancelled = true; ac.abort(); };
    }
    return () => { cancelled = true; ac.abort(); };
  }, [url]);
  return { data, error, loading };
}
```

**2. Extract Tab components into separate route files.**
- Problem: App.tsx renders all 17 tabs conditionally with `{activeTab === 'X' && <Component ...props />}`. Adding a tab means editing App.tsx (props, import, state, handler).
- Fix: Use React Router (or even a simple `Map<string, { component, getProps }>`) so each tab is self-registering. App.tsx becomes a switch statement or map iteration.

**3. Standardize error handling at the fetch layer.**
- Problem: Every component checks `res.ok` differently (or not at all). 17+ sites in App.tsx alone.
- Fix: Add `res.ok` check inside `apiFetch()` itself — make it throw on non-2xx so every caller gets errors consistently without remembering to check.

```typescript
// src/lib/api.ts — proposed change
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const res = await window.fetch(input, { ...init, headers, credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''));
  return res;
}
```
- Impact: Eliminates the need for `if (!res.ok)` in every handler. Callers just `await apiFetch()` — errors propagate to their catch blocks naturally.

**4. Add lint rule: max component size.**
- Problem: No CI guard prevents files from growing to 1,215 lines.
- Fix: Add `eslint-plugin-react-max-file-lines` or a simple `tsc`-compatible check: fail build if any `.tsx` exceeds 400 lines.
- Impact: Architectural discipline. Forces decomposition as files grow, rather than in a crisis.

**5. Extract shared types from App.tsx.**
- Problem: Several inline types and interfaces in App.tsx (handler signatures, state variables) are duplicated across components.
- Fix: Move all shared handler types to `src/types.ts` or a dedicated `src/types/app.ts`. Components import the types rather than relying on inferred or `any`-typed props.

---

## Rollback Strategy

If any fix causes a production incident, do this in order:

### Immediate revert (under 5 min)
```bash
git revert HEAD --no-edit && git push
```
Re-deploy. The previous working version is live again in <2 min assuming CI/CD.

### If revert is not clean (merge conflicts)
```bash
git checkout HEAD~1 -- <affected-files> && git commit -m "rollback: revert <file(s)>"
```
This replaces only the problematic files while keeping everything else.

### Per-item rollback notes

| Item | Rollback risk | One-line revert |
|---|---|---|
| **0.1** HMAC pepper | If `SYSTEM_PEPPER` env var was unset, crash-at-startup breaks deploy. **Set env var first, then deploy.** | `git revert <sha> && git push` |
| **0.2** DB mutex | If mutex deadlocks, all writes freeze. Monitor `data/db.json` mtime after deploy. | `git revert <sha> && git push` |
| **1.4** Input validation | Overly strict validation may reject legitimate inputs. Monitor error rates after deploy. | Roll back validation rules individually — keep session rotation fix. |
| **DA2** Cookie secret | Same as 0.1 — if `COOKIE_SECRET` is unset, crash. | Set env var first, then `git revert <sha> && git push` |
| **DA1** uncaughtException exit | If the app has background tasks that clean up on uncaughtException, exit may orphan them. | `git revert <sha> && git push` |
| Everything else | Low risk — mostly error handling, type fixes, AbortControllers. Safe to revert one file at a time. | `git checkout HEAD~1 -- <file>` |

### Pre-deploy checklist for Tier 0 items
1. Verify `SYSTEM_PEPPER` and `COOKIE_SECRET` are set in production env
2. Verify `data/db.json` is backed up (last 3 copies)
3. Deploy during low-traffic window
4. Watch logs for 5 min post-deploy for `writeDatabase` errors or crash loops

---

## Test Coverage Gap

**Current state: zero test infrastructure.** No test runner (jest/vitest/mocha), no test files, no CI test step. The only CI gate is `npm run lint` which runs `tsc --noEmit` (type-check only, no runtime tests).

### What this means for the fix queue
- **Every fix item** is currently verified only by manual inspection. No regression safety net.
- **Item 1.4 (input validation) is the riskiest** — new validation may reject legitimate inputs with no test to catch false positives.
- **Item 0.2 (DB mutex) is second** — a race-condition fix with no concurrent test is hard to verify.

### Recommended test setup (in order, 4-6h total)

| Step | What | Effort | Why first |
|---|---|---|---|
| 1 | Add `vitest` + `@testing-library/react` | 10 min | Fastest setup for a Vite project |
| 2 | Test `storage.ts` write/read with concurrent access | 1h | Validates item 0.2 — most critical infra fix |
| 3 | Test `apiFetch` error handling | 30 min | Validates the consolidated fetch layer (Item 1.1 root fix) |
| 4 | Test `tradeParse.ts` with known edge cases | 30 min | Validates items 1.3, S5, S6 |
| 5 | Snapshot test each tab component | 2h | Catches regressions from any of the ~60+ fix items |
| 6 | Add CI step: `npm test` | 10 min | Ensures tests run on every push |

### Files that should have tests but don't

| File | Lines | What to test | Priority |
|---|---|---|---|
| `server/storage.ts` | 167 | Atomicity under concurrent writes, recovery from corrupt JSON | **Critical** |
| `src/lib/tradeParse.ts` | 59 | `parseTrade` regex cases, `executeTrade` error handling, NaN fillPx guard | **High** |
| `src/lib/api.ts` | 4 | Error throwing on non-2xx (after proposed fix) | **High** |
| `server/auth.ts` | ~120 | Session creation, verification, rotation | **Medium** |
| `server/prices.ts` | ~80 | Price seeding, polling intervals | **Medium** |
| All 17 tab components | ~6,000 total | Render without crash, loading state, error state | **Low** (smoke only) |

---

## Observability & Monitoring

### Current state
- **Errors are swallowed silently** in ~12+ locations across the codebase (empty `catch {}` blocks, `.catch(() => {})`)
- **Console logging is inconsistent** — some handlers log (`console.error`), others don't
- **No structured logging** — no log levels, no correlation IDs, no JSON output
- **No error tracking** — no Sentry, no Datadog, no Rollbar
- **No health endpoint beyond `/api/health`** — it returns `{ ok: true }` but doesn't verify DB integrity or MetaMask CLI availability
- **No metrics** — no request latency, error rate, or polling success rate

### Recommended additions

#### 1. Fix the empty catch blocks first (already in queue)
Every silent `catch {}` is a blind spot. At minimum `console.error` before the fix queue is applied — otherwise Claude has no way to tell if its changes work.

**Grep target:**
```bash
rg "catch\s*\(\s*\)\s*\{\s*\}" --type ts --type tsx --multiline src/ server/
```

#### 2. Add structured logging (30 min)
```typescript
// src/lib/logger.ts — proposed
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
const level = (process.env.LOG_LEVEL as keyof typeof LOG_LEVELS) || 'info';
export const logger = {
  debug: (...args: any[]) => LOG_LEVELS[level] <= 0 && console.log('[DEBUG]', ...args),
  info:  (...args: any[]) => LOG_LEVELS[level] <= 1 && console.log('[INFO]',  ...args),
  warn:  (...args: any[]) => LOG_LEVELS[level] <= 2 && console.warn('[WARN]',  ...args),
  error: (...args: any[]) => LOG_LEVELS[level] <= 3 && console.error('[ERROR]', ...args),
};
```
Replace `console.error` in all catch blocks with `logger.error`. Benefits: log levels, grep-able prefixes, easy to swap for a real logger later.

#### 3. Wire Sentry (1h setup, free tier)
```bash
npm install @sentry/browser @sentry/node
```
Add to `server.ts` entry and `src/main.tsx`. This catches every unhandled rejection, uncaught exception, and manual `Sentry.captureException` call. Solves the "silent error" problem permanently.

#### 4. Critical error surfaces that need monitoring

| Location | Current behavior | What to add |
|---|---|---|
| Every `catch {}` (12+ sites) | Silent — user sees nothing | `logger.error('fetch failed', err)` + inline error banner on the affected component |
| `server/storage.ts:153-155` | Write errors logged but not surfaced to caller | Return `{ success: false, error }` from `writeDatabase()` instead of `void` |
| `server.ts` unhandledRejection | Logs to console, process keeps running | Optional: send to Sentry before continuing |
| All polling effects (Dashboard, TradingHub, ResearchFleet, AgentWalletModal) | Stale data if fetch fails silently | Show a "last updated X min ago" timestamp + turning-red indicator if stale |
| All `res.json()` calls (17+ sites) | Non-JSON 500 body causes SyntaxError | Fixed by checking `res.ok` first (Item 1.1) — add logging in the error path |

#### 5. `/api/health` enhancement (15 min)
Current: `{ ok: true }`. Proposed:
```typescript
app.get('/api/health', async (req, res) => {
  const dbOk = await checkDatabaseReadable();
  const metamaskOk = await checkMetamaskResponding();
  res.status(dbOk && metamaskOk ? 200 : 503).json({
    ok: dbOk && metamaskOk,
    database: dbOk ? 'ok' : 'error',
    metamask: metamaskOk ? 'ok' : 'error',
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
  });
});
```
This gives a load balancer or monitoring tool (UptimeRobot, BetterStack) a real signal to alert on.

---

## Effort Estimate (Updated)

| Item | Change | Effort | Risk if skipped |
|---|---|---|---|
| 0.1 | HMAC pepper crash + timingSafeEqual | 10 min | Key forgery |
| 0.2 | Database write mutex (whole-cycle transaction pattern) | 2-4 hr (audit all callers + refactor to transaction) | Silent data loss |
| 1.1 | `res.json()` before `res.ok` | 30 min (17+ sites across App.tsx + components) | Silent failures, blank screen |
| 1.2 | Wire ErrorBoundary + catch handlers | 35 min | White-screen crashes |
| **1.3** | **tradeParse.ts missing `await` on fetch** | **5 min** | **Trades silently never execute** |
| **1.4** | **Server: no input validation, session rotation** | **1-2 days** | **Unauthorized market resolution, stale session theft** |
| 2.1 | Autotrader inFlight guard | 5 min | Balance double-count (after 0.2) |
| 2.2 | Split metamask.ts | 1 hr (design) + 2 hr (implement) | Debugging tax |
| 2.3 | VaultClubs copy-paste bug (`activeRoomId`) | 2 min | Wrong vault contributions |
| 2.4 | QuantEngine fake "Deploy to Agent" button | 5 min | Misleading UX, no-op |
| 2.5 | AgentArena checkboxes not state-bound | 10 min + backend audit | Form submits wrong data |
| **2.6** | **Price seed discrepancy** | **5 min** | **Conflicting portfolio values** |
| **2.7** | **TypeScript type mismatches** | **10 min** | **Type errors, runtime confusion** |
| **DA1** | **uncaughtException should exit** | **5 min** | **Process runs in corrupt state** |
| **DA2** | **Cookie secret hardcoded fallback** | **2 min** | **Session forgery** |
| **DA3** | No CORS config | 10 min | Blocks external API consumers |
| **DA5** | tradeParse.ts res.json before res.ok root cause | 2 min | Real error message lost on non-JSON 500 |
| **DA6** | tradeParse.ts NaN fillPx | 2 min | "$NaN" in UI |
| **DA7** | types.ts missing canonicalWallet | 2 min | Type mismatch at runtime |
| **DA8** | Dead schema surface cleanup | 10 min | Confusion about what works |

**Total effort:** ~4-11 hours for all 21+ items. Recommended order: 0.x → 1.x → 2.x → S items.

~40 additional sub-items from tab-by-tab reviews (D1, W1, R1, etc.) are scoped in the Consolidated Fix Queue above — most are 2-15 min each, totaling ~5-6 extra hours. They can be picked off in any order by grep target pattern.

---

---

## Tab-by-Tab Review: Detailed Component Audits

Each tab gets a dedicated sub-agent audit with exact file:line findings. These supplement the cross-cutting fix items above — some findings are new (not in any fix item), others reinforce existing items with specific call sites.

---

### Tab 1 — Dashboard (`src/components/Dashboard.tsx` + `src/App.tsx` caller)

**Agent scope:** Dashboard.tsx (585 lines), App.tsx (caller at lines 765-774), server/auth.ts, server/platform.ts, lib/api.ts, types.ts

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| D1 | **CRITICAL** | `App.tsx:200-202` | `handleProfileClaimed` catch block logs error but doesn't re-throw. Dashboard's `handleSaveProfile` awaits it, sees successful resolution, and closes the edit modal. User edits appear to save but nothing persisted. Fix: `throw err` in catch. |
| D2 | **HIGH** | `App.tsx:67-80` | `loadSession()` calls `res.json()` with NO `res.ok` check and NO try/catch. Server 500 silently falls through — `data.user` undefined, user stays null, loading spinner disappears, Welcome screen shows. User thinks they're logged out. |
| D3 | **HIGH** | `App.tsx:270-277` | `handleAgentAutopilotChanged` has `if (res.ok) fetchEntities()` with no else. All errors silently swallowed — the only handler in App.tsx that doesn't throw or surface failures. |
| D4 | **LOW** | `Dashboard.tsx:17-31` | `NumberTicker` uses `useState(value)` + `useEffect` mirror — renders old value first on prop change, then flips. One-frame flicker on balance/trade count display. Fix: remove local state, derive from prop directly. |
| D5 | **LOW** | `server/auth.ts:32` | DiceBear avatar URL hardcoded: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`. If DiceBear changes API or pricing, all avatars break. Should be env var or local fallback. |
| D6 | **MEDIUM** | `Dashboard.tsx:127-197` | Chart reconstructs balance timeline by starting at hardcoded 100,000 + adding faucet claims + trade PnLs, then appends `user.paperBalance` as final point. If server modified balance through vaults/predictions/admin, chart line visibly jumps at the end. |
| D7 | **MEDIUM** | `Dashboard.tsx:72-585` | No loading/empty/skeleton state for trades, chart, audits. On mount (before `fetchEntities` resolves), Dashboard renders empty chart, "No actions recorded", zero stats. Flash of empty state. |
| D8 | **LOW** | `Dashboard.tsx:271-275` | Avatar `<img>` has no `onError` fallback, no `loading="lazy"`. Broken URL = broken image icon. |
| D9 | **LOW** | `Dashboard.tsx:472-477` | Refresh button fires `onRefreshAudits` but shows no spinner, doesn't self-disable, allows hammering multiple requests. |
| D10 | **LOW** | `Dashboard.tsx:343,353,363,373` | Navigation buttons dispatch global CustomEvents/KeyboardEvent at document. Bypasses React event system. If listener is removed or mounted after click, buttons silently do nothing. |

#### Findings the agent missed or skimmed

| # | Severity | File:Line | Finding |
|---|---|---|---|
| D11 | **HIGH** | `Dashboard.tsx:305` vs `:139` | **Audit count inconsistency**: Safety Rails section uses `audits.length` (unfiltered — ALL users) at line 305, while the chart correctly uses `myAudits` (filtered by `user.id`) at line 139. Line 312 also uses `audits.filter(...)` (unfiltered). Personal dashboard shows global audit counts, not the user's own. Either intentional (showing platform-wide stats) or a bug. If it's intentional, it's confusing UX — labeled "Safety Rails" on "your" dashboard showing other users' blocked actions. |
| D12 | **MEDIUM** | `Dashboard.tsx:83-90` | **Effect resets editing on parent re-render**: The `useEffect` resets form fields when `user.profile.*` changes. If `fetchEntities()` runs while user is editing their profile (every mutation triggers it), unsaved edits get forcibly overwritten with server values. Deps include `user.profile.avatarUrl`, `user.profile.bio`, `user.profile.displayName` — any parent re-render with updated profile data destroys the user's in-progress edits. |
| D13 | **LOW** | `Dashboard.tsx:422-462` | **No empty-state for chart**: If `chartData` is empty (new user, no trades/faucet claims), Recharts renders nothing. User sees a blank gray box. Should show "Complete a trade or claim the faucet to see your balance timeline." |
| D14 | **LOW** | `Dashboard.tsx:484-503` | **Audit log re-animation on every render**: Each audit item uses `motion.div` with `initial={{ opacity: 0, y: 5 }}`. When `audits` array reference changes (every `fetchEntities` call), ALL items replay their entrance animation. With large audit logs, this causes visible flicker. Fix: use `layoutId` or render a stable key strategy. |
| D15 | **LOW** | `Dashboard.tsx:265` | **Accessibility**: Edit Profile button is icon-only with `title` attribute but no `aria-label`. Screen readers read `title` inconsistently. Add `aria-label="Edit profile"`. |
| D16 | **LOW** | `Dashboard.tsx:12` | **Prop type mismatch**: `onRefreshAudits` typed as `() => void` but App.tsx passes `fetchEntities` which is `async () => Promise<void>`. Dashboard can't await the refresh to show loading state. This compounds D9 (no loading indicator on Refresh button). |

**New fix items from Tab 1 (add to queue if not already covered):**
- D1: Add `throw err` to `handleProfileClaimed` catch block — **5 min, Tier 1 priority**
- D11: Either fix audit count to use `myAudits.length` or relabel Safety Rails as "Global Safety Stats" — **2 min, Tier 2 priority**
- D12: Remove `user.profile.*` from useEffect deps or gate with `!isEditingProfile` check — **5 min, Tier 1 priority**

---

### Tab 2 — WalletCenter + WalletsPanel + AgentWalletModal (cluster)

**Agent scope:** WalletCenter.tsx (177 lines), WalletsPanel.tsx (244 lines), AgentWalletModal.tsx (467 lines), lib/bankWallet.ts (109 lines), server/metamask.ts (1161 lines), App.tsx (caller at lines 777-779)

**Architecture note:** Tab 2 is a 3-component cluster sharing wallet state. WalletCenter owns the top-level view, WalletsPanel renders the wallet list/balances, AgentWalletModal handles MetaMask connection flow. They communicate through a mix of React props and global CustomEvents (`wallet-connected`). The cluster has 467+244+177 = 888 total lines of component code.

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| W1 | **HIGH** | `WalletCenter.tsx:34-44` | `switchTo()` calls `apiFetch()` then **never reads the Response**. No `res.ok` check, no body parsing. `wallet-connected` event fires and `setData(null)` runs even after a 400/500. Client shows "wallet switched" when server disagreed. Client-server state divergence. |
| W2 | **HIGH** | `WalletCenter.tsx:39-40,68,129` + `WalletsPanel.tsx:82-85` | **Stale data bug — "key bump" never implemented**: Comment at line 39 says "nudge a reload via key bump" but no key bump exists. After `switchTo()` or `runConsolidation()`, `setData(null)` does NOT trigger WalletsPanel re-fetch (WalletsPanel's auto-load effect only fires on `defaultOpen` change, which is constant). The devs knew about this bug and left it. |
| W3 | **MEDIUM** | `AgentWalletModal.tsx:111-125` | **5-minute polling loop has no abort**: `startConnect()` polls `checkStatus()` every 6s for 50 iterations (5 min). If user closes the modal, loop continues. On completion, calls `spark()` DOM animation + `loadReadiness()` on possibly-unmounted component. No AbortController, no `isCancelled` flag. |
| W4 | **MEDIUM** | `AgentWalletModal.tsx:160-172` | `disconnectWallet()` never reads API response. If server rejects the disconnect (network error, 5xx), client still sets `connected=false`, clears address, dispatches `wallet-connected`, reloads readiness. Server thinks wallet is still connected, client disagrees. |
| W5 | **MEDIUM** | `AgentWalletModal.tsx:199-201` | `handleFund()` has `setTimeout(..., 4000)` with no cleanup. If modal closes before 4s, React warns about state update on unmounted component (in dev). Should use `useRef` + `clearTimeout` in cleanup. |
| W6 | **MEDIUM** | `WalletCenter.tsx:33` vs `WalletsPanel.tsx:130-131` | **grandTotal calculation differs**: WalletCenter sums `w.totalUsd` directly (no clamp), WalletsPanel uses `Math.max(0, w.totalUsd)`. If any wallet has negative `totalUsd` (possible with perps losses), the two components show different totals. Should share a utility function. |
| W7 | **LOW** | `WalletsPanel.tsx:48,71,194,208` | **Sentinel value `-1` means "loading"**: Uses `totalUsd: -1` as loading sentinel, `0` means "loaded and empty". If any wallet balance API ever returned negative, it would be incorrectly shown as "…" and then reset to `0`. Fragile pattern. |
| W8 | **LOW** | `WalletCenter.tsx:171` | **Success and error messages share same `text-amber-300` class**: `"Consolidation submitted!"` (success) and `"Could not build the plan."` (error) both render in amber warning color. User can't distinguish at a glance. |
| W9 | **LOW** | `WalletCenter.tsx:91-176` | **No loading skeleton at WalletCenter level**: WalletsPanel has its own loading state, but WalletCenter's consolidation section and grand total area show no indicator while data is null. |
| W10 | **LOW** | `AgentWalletModal.tsx:55,134-140` | **CLI token sits in React state as plain string**: Visible in React DevTools. Mitigated by immediate send + clear, but if XSS exists elsewhere in app, token could be exfiltrated. |

**New fix items from Tab 2 (add to queue if not already covered):**
- W1: Check `res.ok` in `switchTo()` before firing `wallet-connected` — **5 min, Tier 1 priority**
- W2: Add key bump or `useEffect` trigger on `data` change in WalletsPanel — **10 min, Tier 1 priority**
- W3: Add AbortController/isCancelled flag to `startConnect()` polling — **10 min, Tier 2 priority**
- W4: Check `res.ok` in `disconnectWallet()` before clearing client state — **5 min, Tier 1 priority**

---

### Tab 3 — ResearchFleet (`src/components/ResearchFleet.tsx`)

**Agent scope:** ResearchFleet.tsx (127 lines), server/research.ts (53 lines), server/declined.ts (51 lines), lib/api.ts, App.tsx (caller at lines 781-783)

**Architecture note:** ResearchFleet is a data-display dashboard with 30s polling. It reads from two server routes: `/api/research-fleet` (server/research.ts) and has an indirect dependency on `server/declined.ts` (which the autotrader calls to record declined trades). Lightweight component with outsized backend risk.

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| R1 | **HIGH** | `server/declined.ts:47` + `server/research.ts:29` | **Race condition on `declined-daily.json`**: `declined.ts` writes via plain `fs.writeFileSync` (NOT atomic), while `research.ts` reads via `fs.readFileSync` + `JSON.parse` every 30s. On concurrent write + read, the JSON parse receives a truncated/half-written file, throwing an exception caught by `catch {}`. Decline counters silently disappear. Compare with `storage.ts:144-152` which uses atomic temp-file + rename — `declined.ts` does none of this. |
| R2 | **HIGH** | `ResearchFleet.tsx:38` | **Silent API failure**: `if (res.ok) setData(...)` with no else branch. On 500/503, `data` stays null (initial) or stale (refresh). User sees blank screen or outdated data with zero indication anything is wrong. No error state, no banner, nothing. |
| R3 | **HIGH** | `ResearchFleet.tsx:107` | **Array index as React key**: `key={i}` on recent trades list. Server returns `tagged.slice(-20).reverse()` — every new trade shifts all indices by 1. React reuses DOM nodes for wrong trade data, breaks animations, and causes unnecessary remounts. Fix: `key={r.t}` (timestamp is unique). |
| R4 | **MEDIUM** | `server/research.ts:22,50` | **Floating-point P&L divergence**: Family-level `realizedPnl` is raw float accumulation (no rounding), total uses `toFixed(2)`. After enough trades, `sum(families[].realizedPnl)` ≠ `totals.realizedPnl`. Observant users see numbers disagree between header and cards. |
| R5 | **MEDIUM** | `ResearchFleet.tsx:95` | **Malformed decline key handling**: `k.split('|')` destructured as `[family, reason]` — if key has no `|`, `reason` is `undefined`. UI renders `"family · undefined × n"`. Compare with `edgeops_report.mjs:68-69` which uses the safer pattern `const [date, ...rest] = k.split('|')`. |
| R6 | **MEDIUM** | `ResearchFleet.tsx:41` + `research.ts:30` | **Magic numbers duplicated**: 30s poll interval, 7-day decline window, n<30 threshold — all hardcoded in both client and server. If one changes without the other, labels lie (e.g., "last 7d" label while server uses 14-day cutoff). |
| R7 | **LOW** | `ResearchFleet.tsx:34-41` | **No AbortController**: In-flight `load()` can call `setData()`/`setLoading()` after component unmount. |
| R8 | **LOW** | `ResearchFleet.tsx:55,72,116` | **`+$0.00` for zero P&L**: Uses `>= 0` instead of `> 0`. Zero displays with misleading plus sign. |
| R9 | **LOW** | `ResearchFleet.tsx:111` | **`NaN` for missing price/size**: `Number(undefined).toLocaleString()` = "NaN". `pnl` is guarded (`r.pnl != null`) but `price` and `size` are not. |
| R10 | **LOW** | `ResearchFleet.tsx:46-126` | **No skeleton on initial load**: Only loading indicator is "refreshing…" text below the fold at line 123. On first paint the page appears empty. |
| R11 | **LOW** | `server/research.ts:44` | **Unstable sort on equal trade counts**: `.sort((a, b) => b.trades - a.trades)` — Timsort is not stable when comparator returns 0. Cards randomly reorder on re-fetch. Fix: add `|| a.family.localeCompare(b.family)` as tiebreaker. |

**New fix items from Tab 3 (add to queue if not already covered):**
- R1: Replace `declined.ts:47` with atomic write (temp file + rename) from `storage.ts` pattern, add corrupt-file recovery in `research.ts:29` — **15 min, Tier 1 priority**
- R2: Add error state + visible error banner in ResearchFleet — **10 min, Tier 1 priority**
- R3: Change `key={i}` to `key={r.t}` on recent trades — **2 min, Tier 2 priority**
- R4: Apply consistent rounding to family-level P&L — **5 min, Tier 2 priority**

---

### Tab 4 — TradingRoom (`src/components/TradingRoom.tsx`)

**Agent scope:** TradingRoom.tsx (404 lines), server/rooms.ts (202 lines), App.tsx (caller at lines 785-792), server/agents.ts

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| T1 | **HIGH** | `TradingRoom.tsx:26-46` | **Race condition on rapid room switch**: `useEffect` fires on `activeRoomId` change, calls `fetchActiveRoomDetails`. No AbortController. If user clicks Room A then Room B quickly, Room A's response may arrive last and overwrite Room B's data. User sees Room A details with Room B highlighted. |
| T2 | **HIGH** | `TradingRoom.tsx:26-38` | **Silent error swallowing on room fetch**: catch block logs `console.error` but never calls `setActiveRoomDetails`. After network error, user sees stale data from the previously loaded room with no indication the fetch failed. No loading/error state anywhere. |
| T3 | **MEDIUM** | `TradingRoom.tsx:103-108` | **Unhandled clipboard promise + fake success**: `navigator.clipboard.writeText()` returns a Promise, never caught. If HTTPS context is missing or permission is denied, user sees "Invite URL copied!" but nothing was copied. Unhandled promise rejection in console. |
| T4 | **MEDIUM** | `App.tsx:248` | **`fetchEntities()` not awaited in `handleJoinRoomByInvite`**: Contrast with `handleRoomCreated` at line 232 which correctly uses `await fetchEntities()`. Fire-and-forget means `rooms` prop is stale when TradingRoom processes the result. Sidebar briefly shows old room list. |
| T5 | **MEDIUM** | `TradingRoom.tsx:99-101` | **Invite token in URL query param**: Exposed in browser history, Referer header, server logs. Consider `#token=` or short-lived signed code. |
| T6 | **MEDIUM** | `TradingRoom.tsx:240-387` | **Stale room details visible during fetch**: When `activeRoomId` changes, `activeRoomDetails` still holds previous room's data until async fetch completes. User sees Room A's members/strategies while Room B is highlighted. No loading spinner, no transition. |
| T7 | **MEDIUM** | `TradingRoom.tsx:16,309,343` | **Pervasive `any` types**: `setActiveRoomDetails<any \| null>`, member map `(m: any)`, strategy map `(strat: any)`. No TypeScript interface for room details response shape. Backend property renames won't produce compile errors. |
| T8 | **LOW** | `TradingRoom.tsx:46` | **`rooms` as unused effect dependency**: Added to force re-fetch when rooms array changes. But causes the effect to fire on every rooms reference change, even if data is identical. |
| T9 | **LOW** | `TradingRoom.tsx:100` | **Invite URL targets non-existent page**: `${origin}/rooms/join?token=...` — no GET route or frontend page at `/rooms/join`. User who clicks this URL sees 404. Only usable by pasting into the invite input box. |
| T10 | **LOW** | `TradingRoom.tsx:199-217` | **No client-side length limits**: Server caps name at 50 chars, description at 200 chars. Inputs have no `maxLength` or character counter. Users discover truncation only after submission. |
| T11 | **LOW** | `TradingRoom.tsx:308-332` | **No empty-state for members grid**: If `activeRoomDetails.members` is empty (corrupted data, inconsistent state), `.map()` produces nothing — blank section titled "Room Membership Ledger". |
| T12 | **LOW** | `TradingRoom.tsx:393-404` vs `server/rooms.ts:158-170` | **Duplicated URL-parsing logic**: Both `extractInviteToken` (client) and `normalizeInviteToken` (server) parse the same invite token from a URL. Nearly identical code. If format changes, both must be updated. |

**New fix items from Tab 4 (add to queue if not already covered):**
- T1: Add AbortController to `fetchActiveRoomDetails` — **15 min, Tier 1 priority**
- T2: Set `activeRoomDetails` to null on error, add error state — **10 min, Tier 1 priority**
- T3: Add `.catch()` to clipboard write that shows error toast — **5 min, Tier 2 priority**
- T4: `await fetchEntities()` in `handleJoinRoomByInvite` — **1 min, Tier 2 priority**
- T6: Add `loadingDetails` state, clear details on room switch — **10 min, Tier 2 priority**

---

### Tab 5 — AgentWorkshop (`src/components/AgentWorkshop.tsx`)

**Agent scope:** AgentWorkshop.tsx (565 lines), server/agents.ts (312 lines), App.tsx (caller at lines 794-807), types.ts, server/autotrader.ts

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| A1 | **HIGH** | `src/types.ts:65`, `AgentWorkshop.tsx:267-272`, `server/agents.ts:46` | **`rsi_meanrev` strategy missing from type + form**: The `TradingAgent.strategyType` union at types.ts:65 lists `'momentum' \| 'grid' \| 'mean_reversion' \| 'custom_ai'` — missing `'rsi_meanrev'`. The create-form dropdown (lines 267-272) also omits it. Yet the server accepts it (agents.ts:46), the autotrader has full decision logic for it (autotrader.ts:136), and ResearchFleet shows it with an "ON TRIAL" badge. Users CANNOT create an agent that uses this strategy through the UI unless they call the API directly. |
| A2 | **HIGH** | `AgentWorkshop.tsx:75-84` | **Price auto-update overwrites user edits**: Effect watches `realPrices` (60s price poll) and silently resets `simPrice` to the live market price. User types a custom fill price → 60s later it's replaced. No dirty flag to distinguish user edits from auto-fills. This breaks the sim trade flow. |
| A3 | **MEDIUM** | `App.tsx:264,276,287,303,321,332,356,375,390` | **`fetchEntities()` never awaited after mutations**: Every handler in the AgentWorkshop parent call chain calls `fetchEntities()` without `await`. After creating, copying, or deleting an agent, UI refresh runs async and errors are silently swallowed (App.tsx:96-98). Agent may appear created (200 from POST) but UI never updates. |
| A4 | **MEDIUM** | `AgentWorkshop.tsx:380-386` | **No delete confirmation**: Trash2 button immediately fires `onAgentDeleted(agent.id)` with no confirmation dialog. The server permanently deletes the agent AND all linked strategies and trade history (agents.ts:222-226). Accidental click = irreversible data loss. |
| A5 | **MEDIUM** | `AgentWorkshop.tsx:354-378` | **Status toggle buttons have no loading state**: Play/Pause/REVOKE buttons call `onAgentStatusChanged` but don't disable or show a spinner. User can rapidly click, triggering multiple concurrent API calls. |
| A6 | **MEDIUM** | `AgentWorkshop.tsx:44-50` | **Hardcoded stale fallback prices**: Initial state BTC: 96420.50, ETH: 3125.20, etc. If `/api/prices` fails, sim box silently uses these with no visual indicator. Server sends a `feed.stale` flag but client never reads it. |
| A7 | **LOW** | `AgentWorkshop.tsx:99` | **Shared `msg` state across all actions**: Create agent, copy strategy, simulate fill all write to the same `{text, type}` state. A success message from one action gets immediately overwritten by the next action's result. User may miss a creation success. |
| A8 | **LOW** | `AgentWorkshop.tsx:380-386` | **Delete button visible when handler undefined**: Button renders even when `onAgentDeleted` is not provided. Clicking does nothing silently — no visual cue (disabled/grayed). |
| A9 | **LOW** | `AgentWorkshop.tsx:53-73` | **No AbortController on price fetch**: In-flight `fetchPrices` can call `setRealPrices` after unmount. |
| A10 | **LOW** | `server/storage.ts:164-166` | **Partial sanitizeText**: Only escapes `<` and `>`, not `&`, `"`, `'` or backticks. Mitigated by JSX auto-escaping but risky if values flow to `dangerouslySetInnerHTML` or title attributes. |

**New fix items from Tab 5 (add to queue if not already covered):**
- A1: Add `'rsi_meanrev'` to type union in types.ts:65 AND add `<option>` to form at AgentWorkshop.tsx:267-272 — **5 min, Tier 1 priority**
- A2: Add dirty flag or prevent auto-overwrite when user has edited simPrice — **10 min, Tier 1 priority**
- A3: Add `await` to `fetchEntities()` calls in App.tsx mutation handlers — **15 min across all sites, Tier 2 priority**
- A4: Add confirmation dialog before agent deletion — **15 min, Tier 2 priority**
- A5: Add loading/disabled state to status toggle buttons — **10 min, Tier 2 priority**

---

### Tab 6 — TradingHub (`src/components/TradingHub.tsx`)

**Agent scope:** TradingHub.tsx (696 lines — largest component so far), server/trades.ts (326 lines), App.tsx (caller at lines 809-818)

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| H1 | **MEDIUM** | `TradingHub.tsx:385-404` | **Fake action buttons — no onClick**: "Bot Trailing Stop" and "AI Take-Profit" are rendered as `<button>` elements with hover effects and cursor styling but ZERO onClick handlers. They look interactive but do absolutely nothing when clicked. Misleading UI for a trading tool. |
| H2 | **MEDIUM** | `TradingHub.tsx:83-85` | **Silent catch on price polling**: `catch (err) { console.error(...) }` — no error state, no stale-data warning, no user feedback. When `/api/prices` fails, the component silently uses hardcoded fallback prices (lines 26-31) without indicating they may be stale. |
| H3 | **MEDIUM** | `TradingHub.tsx:1-696` | **Component size**: 696 lines handling form state, price polling, trade submission, risk analytics, sparkline charts, and gradient decorations. Should split into at least 3 sub-components: OrderForm, ExecutionAnalytics, PositionList. |
| H4 | **LOW** | `TradingHub.tsx:21,24,25,26-31` | **Hardcoded defaults**: Default asset (BTC), trade size (0.1), leverage (10x), and fallback prices all hardcoded. These should come from user profile or server config. |
| H5 | **LOW** | `TradingHub.tsx:71-91` | **No AbortController on price fetch**: In-flight fetch can call `setSimPrices` after unmount. |

**New fix items from Tab 6 (add to queue if not already covered):**
- H1: Add onClick handlers to "Bot Trailing Stop" and "AI Take-Profit" buttons, or replace with decorative `<div>` elements — **10 min, Tier 2 priority**
- H2: Add error state + stale-data warning banner on price fetch failure — **10 min, Tier 2 priority**

---

### Tab 7 — TokenMarketChart (`src/components/TokenMarketChart.tsx`)

**Agent scope:** TokenMarketChart.tsx (375 lines), server/prices.ts, App.tsx (caller at lines 820-822 — receives NO props)

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| C1 | **HIGH** | `TokenMarketChart.tsx:33-91` | **Entire chart is fabricated random-walk data**: `generateHistoricalData()` seeds from current price with random offset, walks via `Math.random() - 0.46` (net 4% upward drift per step), applies per-symbol volatility multipliers. The chart is a visual novel — the server has real CoinGecko/Coinbase data but the component **never requests historical OHLCV**. Everything is invented. |
| C2 | **HIGH** | `server/prices.ts:73,87,91` | **Server has silent empty catch blocks on price feed failures**: Three catch blocks with zero logging (`catch { return false; }`, `catch { /* skip this symbol */ }`, `catch { return false; }`). When both CoinGecko and Coinbase fail, the server generates jittered prices silently. Zero observability. |
| C3 | **HIGH** | `TokenMarketChart.tsx:94-140` | **No loading or error states anywhere**: Component immediately renders stale `INITIAL_TOKENS` prices on mount. No loading indicator during 60s fetch. No error UI on failure. Order book section calls `Math.random()` on EVERY render — bid/ask quantities flicker constantly. |
| C4 | **MEDIUM** | `TokenMarketChart.tsx:111-112` | **No `res.ok` check on price fetch**: `const data = await response.json()` before checking response status. If server returns HTML error page, `res.json()` throws silently. |
| C5 | **MEDIUM** | `TokenMarketChart.tsx:138` vs `server/prices.ts:112` | **60s client poll vs 3s server update**: Client polls every 60s, server updates every 3s. Client lags behind by up to 60s. The server's `lastGoodFetch` and `feed.stale` flag are never exposed to the client. |
| C6 | **LOW** | `TokenMarketChart.tsx:349,362` | **Array index as React key**: `key={i}` in order book section. Static for now but would break if dynamic. |
| C7 | **LOW** | `TokenMarketChart.tsx:98` | **`any[]` type for chartData**: Should be `ChartDataPoint[]`. |

**New fix items from Tab 7 (add to queue if not already covered):**
- C1: Either wire to a real historical price endpoint or add a disclaimer badge "Simulated chart data" — **30 min, Tier 2 priority**
- C2: Add logging/error reporting to server catch blocks — **10 min, Tier 1 priority** (observability gap)
- C3: Add loading skeleton, error banner, memoize order book random values — **15 min, Tier 2 priority**
- C5: Align client poll interval with server update rate, expose `feed.stale` flag — **15 min, Tier 2 priority**

---

### Tab 8 — PredictionMarkets (`src/components/PredictionMarkets.tsx`)

**Agent scope:** PredictionMarkets.tsx (376 lines), server/predictions.ts (179 lines), App.tsx (caller at lines 824-831)

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| P1 | **MEDIUM** | `PredictionMarkets.tsx:39-41` | **Silent empty catch block**: `catch { if (!cancelled) setLiveMarkets([]); }` — no logging, no user feedback. If the live-markets fetch fails (network error, 500), user sees empty state but no way to know why. Makes debugging needlessly hard. |
| P2 | **MEDIUM** | `PredictionMarkets.tsx:35` | **Malformed outcomePrices silently swallowed**: `catch { /* none */ }` — if `JSON.parse(m.outcomePrices)` fails, the market row renders without price info and no error surfaces. |
| P3 | **LOW-MED** | `PredictionMarkets.tsx:82-85` | **Stale balance check (TOCTOU)**: Client checks `currentUser.paperBalance < amount` before submitting. The `currentUser` prop may be stale from a concurrent action (trade, vault). Server has a duplicate check (predictions.ts:45) but user experience is jarring — form shows sufficient balance, submit returns 400. |
| P4 | **LOW** | `PredictionMarkets.tsx:47` | **Default bet hardcoded at $1000**: New users with starting balance below $1000 hit "Insufficient balance" on first try. Should derive from user's balance. |
| P5 | **LOW** | `PredictionMarkets.tsx:29,33` | **Live markets capped at 5**: `.slice(0, 5)` hardcoded — no way to show more or paginate. |
| P6 | **LOW** | `PredictionMarkets.tsx:16,33,92,106,211` | **Pervasive `any` types**: Live market response shapes entirely untyped. |

**New fix items from Tab 8 (add to queue if not already covered):**
- P1: Add logging to empty catch blocks in PredictionMarkets — **5 min, Tier 2 priority**
- P4: Derive default bet amount from user balance (e.g., 10%) instead of hardcoded $1000 — **5 min, Tier 2 priority**

---

### Tab 9 — VaultClubs (`src/components/VaultClubs.tsx`)

**Agent scope:** VaultClubs.tsx, server/vaults.ts, App.tsx (caller at lines 833-840)

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| V1 | **CRITICAL** | `VaultClubs.tsx:49` | **Copy-paste bug CONFIRMED**: `handleContribute` calls `onContributeToVault(activeRoomId())` instead of `activeVaultId`. The function `activeRoomId()` at line 60 is a misleading wrapper with "Room" naming leaked from a Chat component. The guard at line 45 (`if (!activeVaultId)`) makes the fallback logic in `activeRoomId()` dead code anyway. Already listed as item 2.3 in fix queue — exact line confirmed. |
| V2 | **MEDIUM** | `VaultClubs.tsx:238` | **Array index as React key**: `key={idx}` on milestones map. Milestones are currently static (pushed server-side at vaults.ts:102) but if they ever become dynamic, React reconciliation breaks. |
| V3 | **MEDIUM** | `VaultClubs.tsx:13` | **`currentUser` prop passed but never used**: Destructured from props, required by interface, passed from App.tsx (line 835), but never referenced in component JSX or logic. Dead prop that creates unnecessary coupling. |
| V4 | **LOW** | `VaultClubs.tsx:236` | **No empty state for milestones array**: If milestones is empty, the "Club Target Milestones" section shows heading but blank content area. |
| V5 | **LOW** | `VaultClubs.tsx:36,52` | **`catch (err: any)`**: Should be `unknown` with type guard for strict mode. |

**New fix items from Tab 9 (add to queue if not already covered):**
- V2: Use stable key for milestones instead of array index — **2 min, Tier 2 priority**
- V3: Remove unused `currentUser` prop from VaultClubs and App.tsx — **2 min, Tier 2 priority**

---

### Tab 10 — GraphEvidence (`src/components/GraphEvidence.tsx`)

**Agent scope:** GraphEvidence.tsx (171 lines), App.tsx (caller at lines 842-847), types.ts

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| G1 | **HIGH** | `GraphEvidence.tsx:21-24` | **`res.json()` before `res.ok`**: Single API call to `/api/graph` parses response body before checking status. If server returns HTML error page, `res.json()` throws. No try/catch on the caller — unhandled promise rejection. |
| G2 | **HIGH** | `GraphEvidence.tsx:25-27` | **Silent catch with no error state**: `console.error` only. `loading` goes to false, user sees empty state ("No nodes projected yet.") or stale data with zero indication of failure. |
| G3 | **MEDIUM** | `GraphEvidence.tsx:14,61,77-79,91-105` | **Not a real graph — CONFIRMED**: `edges` state is populated at line 24 but **never referenced in JSX** (dead code). Nodes are equally-spaced flex items (`flex flex-wrap justify-center`), not positioned by any layout algorithm. Two concentric `<div>` elements with CSS spinning animations pretend to be edges. No SVG lines, no paths, no force-directed layout. The "Kuzu-Projected" label overpromises massively. |
| G4 | **LOW** | `GraphEvidence.tsx:8-12` | **`currentUser` and `paperLiveMode` props passed but never used**: Both destructured from props but never referenced in component logic or JSX. The `/api/graph` fetch doesn't pass them as query params either — dead props from App.tsx. |
| G5 | **LOW** | `GraphEvidence.tsx:18-34,48-49` | **No AbortController**: In-flight fetch + race condition on rapid re-fresh clicks. |

**New fix items from Tab 10 (add to queue if not already covered):**
- G3: Either add real graph visualization (d3-force, vis-network) or rename "Evidence Map" label and remove "Kuzu-Projected" badge — **strategic decision, not a quick fix**
- G4: Remove unused `currentUser` and `paperLiveMode` props from GraphEvidence and App.tsx — **2 min, Tier 2 priority**

---

### Tab 11 — SpecsCatalog (`src/components/SpecsCatalog.tsx`)

**Agent scope:** SpecsCatalog.tsx (static component, no API calls), App.tsx (caller at lines 849-851 — receives NO props)

**Architecture note:** SpecsCatalog is a **fully static mockup** — no API calls, no `useEffect`, no loading/error states, no server route. Three hardcoded arrays (`userStories`, `designTokens`, `featureTools`) rendered directly. Minimal component.

#### Findings

| # | Severity | File:Line | Finding |
|---|---|---|---|
| S1 | **MEDIUM** | `SpecsCatalog.tsx:79,102` | **Array index as React key**: `key={i}` on both `designTokens.map` and `featureTools.map`. If data ever becomes dynamic, React reconciliation breaks. |
| S2 | **MEDIUM** | `SpecsCatalog.tsx:4-31` | **No TypeScript types anywhere**: Zero `interface` or `type` declarations. All three data arrays are untyped — consumer has no contract to work against, IDE autocompletion degraded. |
| S3 | **LOW** | `SpecsCatalog.tsx:2` | **7 of 8 imported icons unused**: `LayoutGrid`, `ShieldAlert`, `FileSpreadsheet`, `Activity`, `ChevronRight`, `CheckCircle`, `HelpCircle` imported but never rendered. Dead code, copy-paste residue. |
| S4 | **INFO** | `SpecsCatalog.tsx:5-31` | **Hardcoded data**: Statuses never update to reflect real backend state. Static mockup wearing production clothing. No loading/error/empty states exist because no data fetching happens. |

**No new fix items** — nothing functionally broken, just maintainability debt. If this component is intended to be static, consider inlining the data or extracting to a config file.

---

### Tab 12 — QuantEngine (`src/components/QuantEngine.tsx`)

**Agent scope:** QuantEngine.tsx, App.tsx (caller at lines 853-855 — receives `agents` prop, requires `proModeEnabled`)

#### Findings

| # | Severity | File:Line | Finding |
|---|---|---|---|
| Q1 | **CRITICAL** | `QuantEngine.tsx:255-265` | **"Deploy to Agent" button is pure theater — CONFIRMED**: Grabs DOM node by `id="deploy-btn"`, sets innerText to "Deployed!", swaps CSS classes to green, setTimeout 3s reverts everything. **Zero API calls.** No agent config updated, no strategy deployed. Already listed as item 2.4 in fix queue. |
| Q2 | **HIGH** | `QuantEngine.tsx:39-49` | **`res.json()` before `res.ok` on backtest API**: If server returns 500 with HTML body, `res.json()` throws before error guard at line 49. Caught by silent catch (line 51-53). User sees nothing. |
| Q3 | **HIGH** | `QuantEngine.tsx:51-53` | **Silent catch with comment admitting error state is missing**: `catch (err) { console.error(err); // Fallback or error state handling could go here }`. The comment itself documents the gap. No error state, no toast, no feedback. |
| Q4 | **MEDIUM** | `QuantEngine.tsx:226,284` | **Array index as React key**: `key={i}` on equity curve bars and robustness matrix cells. |
| Q5 | **MEDIUM** | `QuantEngine.tsx:12,218,283` | **`any` types**: `results` state is `useState<any>(null)`, map iterators use `(m: any)`. No `QuantBacktestResult` interface. |
| Q6 | **LOW** | `QuantEngine.tsx:218,283` | **Unsafe `.map()` on nullable `results.curve/matrix`**: No optional chaining — throws `TypeError` if server returns unexpected shape. |

**New fix items from Tab 12 (add to queue if not already covered):**
- Q2: Check `res.ok` before `res.json()` in backtest handler — **5 min, Tier 1 priority**
- Q3: Add error state + user-visible error feedback in QuantEngine — **10 min, Tier 2 priority**
- Q4: Use stable keys instead of array index — **5 min, Tier 2 priority**

---

### Tab 13 — AgenticAutopilot (`src/components/AgenticAutopilot.tsx`)

**Agent scope:** AgenticAutopilot.tsx (162 lines — clean, well-structured), App.tsx (caller at lines 857-866, handler at 270-277)

#### Findings

| # | Severity | File:Line | Finding |
|---|---|---|---|
| AP1 | **HIGH** | `App.tsx:270-277` | **`handleAgentAutopilotChanged` silently returns on error**: `if (res.ok) fetchEntities()` with no else branch. Unlike sibling handler `handleAgentStatusChanged` (line 280-289) which reads error body, this handler vanishes failures. User never sees server errors. |
| AP2 | **MEDIUM** | `AgenticAutopilot.tsx:6,28` + `App.tsx:859` | **`user` prop passed but never used**: Interface declares `user: User`, App.tsx passes `user={currentUser}`, but component destructuring explicitly omits it (only uses `agents, trades, audits, onAgentAutopilotChanged, onRefresh`). Dead prop causing unnecessary re-renders. |
| AP3 | **MEDIUM** | `AgenticAutopilot.tsx:127-134` | **Autopilot toggle button has no loading state**: After clicking Engage/Stop, button remains interactive with no spinner. On API failure, toggle snaps back only on next 15s fetchEntities poll — user never told. |
| AP4 | **MEDIUM** | `AgenticAutopilot.tsx:38-43` | **No AbortController on 15s polling effect**: In-flight `fetchEntities` can call `setState` after unmount. `autoAgents.length`-only dependency means swapping agents (same count) doesn't re-evaluate effect. |

**New fix items from Tab 13 (add to queue if not already covered):**
- AP1: Add error handling to `handleAgentAutopilotChanged` (read error body, surface to user) — **5 min, Tier 1 priority**
- AP2: Remove unused `user` prop from AgenticAutopilot and App.tsx — **2 min, Tier 2 priority**
- AP3: Add loading state to autopilot toggle buttons — **10 min, Tier 2 priority**

---

### Tab 14 — IntentSolver (`src/components/IntentSolver.tsx`)

**Agent scope:** IntentSolver.tsx (252 lines), App.tsx (caller at lines 868-870 — receives `user` prop only), tradeParse.ts, server/metamask.ts

#### Findings

| # | Severity | File:Line | Finding |
|---|---|---|---|
| I1 | **HIGH** | `IntentSolver.tsx:78-87` | **Multi-step execution is 700ms setTimeout theater — CONFIRMED**: Comment at lines 78-79 admits it: "Walk the visual steps, then place the REAL tradeable action... Multi-step DeFi routes stay simulated/advisory." A for-loop walks ALL steps with `await new Promise(r => setTimeout(r, 700))` animating each to "executed". Only AFTER all steps visually complete does the code attempt a single `executeTrade` for assets matched by `parseTrade`. Multi-step intents (ANALYZE → SWAP → STAKE) are purely cosmetic. Already noted in cross-cutting pattern #5. |
| I2 | **MEDIUM** | `IntentSolver.tsx:51,53` | **`res.json()` before `res.ok`**: Parses response body at line 51 before checking status at line 53. Server error messages silently lost behind generic "Could not map an execution path" fallback. |
| I3 | **LOW** | `IntentSolver.tsx:142` | **Array index as React key**: `key={i}` on predefined intents buttons. |
| I4 | **LOW** | `IntentSolver.tsx:63-66` | **Error object swallowed**: `console.error` only, replaced with generic message. Server's actual error never surfaces. |
| I5 | **LOW** | `IntentSolver.tsx:20,57` | **`any` types**: `IntentStep.data` typed as `any`, server response steps typed `(s: any)`. |
| I6 | **LOW** | `IntentSolver.tsx:175-180` | **No loading state during fetch**: Steps panel goes blank while `isSolving=true`. No spinner. |

**New fix items from Tab 14 (add to queue if not already covered):**
- I1: Either wire multi-step to real execution or replace with disclaimer explaining single-asset-only — **30 min, Tier 2 priority**
- I2: Check `res.ok` before `res.json()` — **5 min, Tier 2 priority**

---

### Tab 15 — SwarmCopilot (`src/components/SwarmCopilot.tsx`)

**Agent scope:** SwarmCopilot.tsx (321 lines), App.tsx (caller at lines 872-874 — receives `user` prop only), tradeParse.ts, server/metamask.ts

#### Findings

| # | Severity | File:Line | Finding |
|---|---|---|---|
| SW1 | **MEDIUM** | `SwarmCopilot.tsx:59-66` | **`res.json()` before `res.ok`**: Chat API call parses body unconditionally at line 64 before status check at line 66. Non-JSON error body causes `SyntaxError` → misleading "Unexpected token" message shown to user instead of actual HTTP error. |
| SW2 | **MEDIUM** | `SwarmCopilot.tsx:177,204,289` | **Array index as React key (3 instances)**: `key={i}` on thought process steps, proposal actions, and suggestion buttons. The suggestions list (line 289) is static now but would break if made dynamic. |
| SW3 | **MEDIUM** | `SwarmCopilot.tsx:8-10,29` | **`user` prop passed but never used**: Destructured from props, never referenced in component logic or API calls. Chat endpoint receives no user context (no `user.id`, no `user.address`). All users talk to the same stateless endpoint — unauthorized access risk if server actually needs identity. |
| SW4 | **LOW** | `SwarmCopilot.tsx:59,97` | **No AbortController on either fetch**: Chat and execute calls can fire state updates after unmount. |
| SW5 | **LOW** | `SwarmCopilot.tsx:80` | **`catch (err: any)`**: Error type erased. |

**New fix items from Tab 15 (add to queue if not already covered):**
- SW1: Check `res.ok` before `res.json()` in chat handler — **5 min, Tier 2 priority** (already in master table as SW1, Tier 1)
- SW2: Use stable keys instead of array index — **5 min, Tier 2 priority** (already in master table)
- SW3: Either pass user context to API or remove unused `user` prop — **5 min, Tier 2 priority** (already in master table)
- SW4: Add AbortController — **10 min, Tier 2 priority**
- SW5: Replace `: any` with proper type — **2 min, Tier 2 priority**

---

### Tab 16 — AgentArena (`src/components/AgentArena.tsx`)

**Agent scope:** AgentArena.tsx (large component), server/arena.ts, App.tsx (caller at lines 876-885)

#### New Findings (not covered by existing fix items)

| # | Severity | File:Line | Finding |
|---|---|---|---|
| AR1 | **HIGH** | `AgentArena.tsx:163,197,216,294,324,354` | **All catch blocks are empty**: 6 try-catch blocks with empty/no-op catch bodies (`catch { /* keep last good state */ }`, `catch { /* ignore */ }`, `catch { /* refreshed state will tell the truth */ }`). When `loadArena`, `handleCreateLeague`, `handleJoinLeague`, or `handleDeployTemplate` fail, user sees **zero feedback**. Errors silently swallowed. |
| AR2 | **HIGH** | `AgentArena.tsx:906-922` | **Create-league checkboxes CONFIRMED**: Four checkboxes use `defaultChecked` with no `onChange`, no `checked` prop, no state variable. Their values never read or included in POST body (lines 307-313). Server doesn't request/store strategies either. Users visually configure "Allowed Strategies" that are silently ignored. Already item 2.5. |
| AR3 | **MEDIUM** | `AgentArena.tsx:269` | **Unhandled clipboard promise**: `navigator.clipboard.writeText(link)` called without `await` or `.catch()`. If browser denies clipboard access, unhandled promise rejection. |
| AR4 | **MEDIUM** | `AgentArena.tsx:170,221,226` | **Race conditions from no AbortController**: Rapid league switching causes stale leaderboard responses to overwrite fresh data. 5s polling (`loadPositions`) also overlaps without cancellation. |
| AR5 | **MEDIUM** | `AgentArena.tsx:160-327` | **No loading states on ANY async operation**: `loadArena`, `loadPositions`, `handleJoinLeague`, `handleCreateLeague` — all have zero loading indicators. Only `handleDeployTemplate` tracks `isDeploying`. |
| AR6 | **LOW** | `AgentArena.tsx:311-312` | **Hardcoded risk/prize in league creation**: `risk: 'Medium'` and `prize: 'Community Pool'` hardcoded in POST body. No form controls exist for these fields, yet UI displays them as per-league attributes. |
| AR7 | **LOW** | `AgentArena.tsx` (entire file) | **No leave-league capability**: `handleJoinLeague` exists but no `handleLeaveLeague`. Server also has no DELETE endpoint for league membership. Users cannot leave a league once joined. |
| AR8 | **LOW** | `AgentArena.tsx:810-857` | **Missing empty state for Leagues tab**: When `leagues.length === 0`, grid renders with no children — blank area. Other sections have proper empty states. |
| AR9 | **LOW** | `AgentArena.tsx:105,107,137,175,189,344,772,1165` | **Pervasive `any` types**: API response shapes entirely untyped. |

**New fix items from Tab 16 (add to queue if not already covered):**
- AR1: Add error handling to all 6 empty catch blocks in AgentArena — **15 min, Tier 1 priority**
- AR3: Add `.catch()` to clipboard write — **2 min, Tier 2 priority**
- AR4: Add AbortController to fetch effects — **15 min, Tier 2 priority**
- AR5: Add loading states to all async operations — **20 min, Tier 2 priority**
- AR7: Implement leave-league feature (client + server) — **30 min, Tier 2 priority**
- AR6: Add form controls for risk/prize or remove from POST body — **5 min, Tier 2 priority**

---

### Tab 17 — MetaedgeAnalytics (`src/components/MetaedgeAnalytics.tsx`)

**Agent scope:** MetaedgeAnalytics.tsx, server/platform.ts, App.tsx (caller at lines 887-889 — receives NO props)

#### Findings

| # | Severity | File:Line | Finding |
|---|---|---|---|
| M1 | **HIGH** | `MetaedgeAnalytics.tsx:31` | **`r.json()` without `r.ok` check**: Single fetch chain calls `r.json()` unconditionally, then silently discards errors via `.catch(() => {})`. Non-2xx server response causes silent breakdown — `data` stays `null`, cards render `"..."` forever. |
| M2 | **HIGH** | `MetaedgeAnalytics.tsx:31` | **`.catch(() => {})` swallows all errors**: No logging, no error state, no recovery. User staring at `"..."` values has no way to tell if data is loading or broken. |
| M3 | **MEDIUM** | `MetaedgeAnalytics.tsx:121` | **Array index as React key**: `key={i}` on recentEvents. New events prepend to top (server sorts by timestamp), so every new event shifts all indices — React re-renders all rows unnecessarily. |
| M4 | **MEDIUM** | `MetaedgeAnalytics.tsx:31-33` | **No AbortController + interval overlap race**: `setInterval(load, 15000)` with no AbortController. If fetch takes >15s, overlapping in-flight calls compete. Stale response can overwrite fresh data. Use recursive setTimeout or fetchId. |
| M5 | **LOW** | `MetaedgeAnalytics.tsx:27,97,120` | **`any` types**: Response shape fully known (server/platform.ts:55-70) but untyped on client. |

**New fix items from Tab 17 (add to queue if not already covered):**
- M1: Check `res.ok` before `r.json()` — **5 min, Tier 1 priority**
- M2: Add error logging + user-visible error state — **5 min, Tier 2 priority**
- M3: Use stable key instead of array index — **2 min, Tier 2 priority**
- M4: Replace setInterval with recursive setTimeout or add fetchId guard — **10 min, Tier 2 priority**

### Scores by Dimension

| Dimension | Avg Score | Weakest item | Strongest item |
|---|---|---|---|
| Accuracy | 5.0 / 5 | (all perfect) | (all perfect) |
| Priority | 4.00 / 5 | S8 (2), 2.2 (3) | 0.1, 1.3, S2 (5) |
| Completeness | 4.05 / 5 | 0.2, S5 (3) | 0.1, 1.3, S2, S7 (5) |
| Actionability | 4.75 / 5 | 2.2 (2) | 16 items at 5 |
| Risk awareness | 4.00 / 5 | 2.1, S3, S6, S8 (3) | 0.1, 1.3, 1.4, 2.3, 2.4, 2.6, 2.7, S2 (5) |

### Gaps Fixed From Original Handoff

The original handoff (v1) had 9 items. This revision (v2) adds 4 critical gaps plus 8 deep audit findings and significantly improves risk awareness and completeness annotations.

**What was added (main items):**
1. **1.3** `tradeParse.ts` — missing `await` on `fetch()` (broken core feature)
2. **1.4** Server routes — no input validation, `req: any`, stolen session persistence
3. **2.6** Price seed discrepancy — BTC $63k vs $96k between server and charts
4. **2.7** TypeScript type mismatches — `PaperTrade.side` and `DatabaseState.predictionMarkets`

**What was added (deep audit — v3):**
5. **S1** `server.ts:156` — uncaughtException handler doesn't exit
6. **S2** `server.ts:40` — hardcoded cookie secret fallback (Tier 0)
7. **S3** `server.ts` — no CORS configuration
8. **S4** `server/storage.ts` — concurrent write race (reinforces 0.2)
9. **S5** `src/lib/tradeParse.ts:51` — actual root cause of res.json-before-res.ok
10. **S6** `src/lib/tradeParse.ts:54` — NaN fillPx when no .trade.price
11. **S7** `src/types.ts:13-25` — User missing canonicalWallet field
12. **S8** `src/types.ts` — dead schema surface cleanup

**What was added (cross-tab consolidated queue — v3):**
- 60+ sub-items from 17 tab-by-tab reviews, consolidated into a master lookup table at the top
- 6 grep target commands for batch fixes across the entire codebase
- Consolidated Fix Queue with tier + effort + owning component for every item

**What was corrected/enhanced:**
- 0.2 — Added stale-read race warning, sync-to-async silent failure warning, transaction pattern recommendation
- 1.1 — Added additional affected files (WalletsPanel, AgentWalletModal, tradeParse)
- 1.2 — Added undefined-return risk on error, user-feedback gap
- 2.1 — Added dependency ordering note (fix after 0.2)
- 2.2 — Added shared state design questions, circular dependency risk
- 2.5 — Added backend-check requirement

---

## Research 1: Agent-Driven Trading Landscape (July 2026)

**Type:** Reference / Long-term planning
**Actionability:** Informational — survey of platforms, frameworks, safety patterns, and regulation. Use when deciding which real exchange to connect MetaEdge to, or which agent framework to adopt. Not immediately actionable on the current codebase.

### 1. Platform Landscape for Agent Trading

#### Crypto Perps & Spot

| Exchange | API Type | Auth Model | Agent-Specific | Latency | Max Leverage |
|---|---|---|---|---|---|
| **Hyperliquid** | REST + WebSocket + CLOB | Ed25519 key, **agent wallets** (withdraw-disabled keys) | **Best for agents** — agent wallets, 200K orders/sec, dedicated testnet | 200-500ms (on-chain consensus) | — |
| **dYdX v4** | REST + WS + Cosmos SDK | Mnemonic-based signing | Mature SDKs (TS/Python/Rust) | Cosmos-based | — |
| **GMX V2** | Smart contract calls + **AI Agent SDK** (May 2026) | EVM wallet + gas token | **First DEX with dedicated AI Agent SDK** — place/limit/stop-loss, manage collateral, oracle pricing | On-chain (slowest) | 100x |
| **Binance Futures** | REST + WS (1200 wt/min) | API key with granular permissions | Highest throughput (10-50ms), 125x leverage, Hedge Mode, self-trade prevention | 10-50ms | 125x |
| **Bybit** | REST v5 + WS (600 req/5s) | API key | Unified account, SDK users get 400 req/sec, GC order type prevents self-trade | ~50ms | 100x |

**Key takeaway**: Hyperliquid leads for agent-native design (agent wallets = trade-only keys). Binance wins on speed. GMX is first DEX with an explicit AI Agent SDK.

#### Prediction Markets

| Platform | Real Money | API Complexity | Rate Limits | Settlement | Arb Opportunity |
|---|---|---|---|---|---|
| **Polymarket** | Yes (pUSD/Polygon) | High (3 APIs, EIP-712 + HMAC) | 9K req/10s CLOB | UMA Oracle (2h-6d) | Yes (vs Kalshi, others) |
| **Kalshi** | Yes (USD) | Medium (REST, RSA-PSS) | 20r/s read, 10r/s write | Internal team (hours) | Yes (vs Polymarket) |
| **Manifold** | Play money only | Low (simple REST) | Not documented | Creator resolves | No (play money) |
| **Azuro** | Yes (USDC) | Medium (SDK v7) | Moderate | Data Provider + DAO | Limited (different events) |

**Key insight**: Cross-platform arbitrage (Polymarket ↔ Kalshi) is viable with bots like CrossArb, HarrierOnChain's Rust toolkit (10 strategies, 7 venues, <100ms execution). Windows have collapsed from 12.3s (2024) to ~2.7s (2026).

**Resolution risk quantified**: ~78% clean resolution (2h), 15% dispute (48-96h), 5% whale manipulation, 2% oracle failure. Cardi B Super Bowl (Feb 2026) — $47.3M volume — Kalshi invoked Rule 6.3(c) and settled YES at $0.26 while Polymarket resolved YES at $1.00.

#### Tokenized RWAs

| Platform | Agent-Tradeable? | KYC | Best For |
|---|---|---|---|
| **Ondo (OUSG/USDY)** | Yes, if wallet whitelisted in OndoIDRegistry | Yes (per-address) | Yield-bearing cash management by whitelisted agent wallets |
| **BlackRock BUIDL** | Secondary only, whitelist-gated | Qualified Purchaser | Settlement/collateral between institutions |
| **Backed xStocks** | Yes (84-endpoint REST API) | Yes (Backed account) | Tokenized equity trading (bCOIN, bNVDA) |
| **Swarm Markets** | **Most flexible** (Python/TS SDKs, smart routing, P2P + CEX) | Partial (P2P no KYC) | **Best general-purpose RWA agent platform** |

---

### 2. Agent Frameworks

| Framework | Lang | Key Strength | Crypto Ready? | Risk Primitives |
|---|---|---|---|---|
| **ElizaOS** | TS | 200+ plugins, Eliza Cloud, persistent memory, swarms | **Yes** (Coinbase, Solana, EVM plugins) | Plugin-level only, no built-in risk engine |
| **Coinbase AgentKit** | TS/Py | Agentic Wallets (enclave isolation), 50+ pre-built actions, gasless on Base | **Yes** (CDP, swaps, staking) | **Smart Guardrails** (caps per session/tx), KYT screening, enclave isolation |
| **G.A.M.E. (Virtuals)** | SDK | Agent Commerce Protocol, EconomyOS, 54K+ projects | **Yes** (on Base) | Token-level (agent tokens can buy back), no risk gates |
| **LangChain + LangGraph** | Py | TradingAgents (UCLA/MIT), multi-agent debate, MCP integration | Via MCP / community tools | Framework-level (no built-in risk) |
| **Hummingbot Condor** | Py | 300+ exchange connectors, OODA loop (Observe-Orient-Decide-Act) | **Yes** (50+ exchanges) | Position executor with trailing stop, budget checker |
| **Freqtrade (FreqAI)** | Py | 52K+ stars, backtesting, hyperopt, ML module | **Yes** (Hyperliquid support) | StoplossGuard, MaxDrawdown, LowProfitPairs |

**June 2026 milestone**: Coinbase for Agents launched — ChatGPT and Claude connect directly to user accounts with isolated agent portfolios, spending caps, and trade size limits. x402 protocol for machine-to-machine payments. Stocks, index funds, prediction markets planned.

---

### 3. Safety Architecture (The Critical Gap)

The #1 finding across ALL sources: **agents need hard, deterministic, non-LLM-negotiable limits enforced at the execution/signing layer, not the reasoning layer.**

#### Layered Defense Standard

```
Layer 1 (Execution-enforced — hardest, non-negotiable):
├── Max position size (per-asset, per-agent) — 5% of portfolio
├── Max daily loss / drawdown — 5% daily, 15% peak-to-peak
├── Max trade size (absolute USD or % of portfolio)
├── Min confirmation interval between trades — 5min cooldown
└── Kill switch — auto-halt at -8% drawdown, manual reset only

Layer 2 (Policy-enforced — configurable, auditable):
├── Allowed assets list (no gray-area tokens)
├── Maximum leverage allowed — 3x for crypto, 1x for RWAs
├── Funding rate threshold for auto-close — close if annualized >50%
└── Time-of-day trading restrictions

Layer 3 (Agent-level — LLM-negotiable, gated by L1+L2):
├── Stop-loss (price or percentage)
├── Take-profit targets
├── Position duration limits
└── Portfolio rebalancing constraints
```

#### Concrete Implementations

| System | Risk Gates | Key Pattern |
|---|---|---|
| **HyperGuard** | 14 gates (kill switch, whitelist, position, daily loss, drawdown, margin, rate, time, cooldown, volatility, correlation, blackout, per-asset, custom) | YAML-configured, SQLite audit trail |
| **AgentTrading** | 8 pre-trade risk checks, tier-based custody router (MPC → multi-sig → hardware → Fireblocks) | "Configurable limits get reconfigured. Rust constants don't." — Dnalyaw |
| **Cobo Agentic Wallet** | "Pacts" (policy files), MPC threshold signing, Emergency Freeze (one-tap halt) | Agent physically cannot exceed authorization |
| **Coinbase Agentic Wallets** | Enclave isolation (keys never in LLM prompt), smart guardrails, KYT screening | Keys never touch model context |
| **Sygnum Human-in-Loop** | Agent plans, client signs; keys never leave device | Regulatory-grade, bank-approved |

#### The MetaEdge Gap — Corrected Assessment

**Correction from deep audit (July 9):** The initial claim that MetaEdge has "none of these safety layers" was wrong. A second-pass read of `server/trades.ts` and `server/autotrader.ts` revealed substantial risk architecture that was missed in the first pass because these files were never read.

**What MetaEdge actually has (discovered after correction):**

| Layer | MetaEdge | Where | Detail |
|---|---|---|---|
| Position size cap | ✅ | `autotrader.ts:55` | `CLIP_NOTIONAL_USD = 250` — hard per-trade cap |
| Open position notional cap | ✅ | `autotrader.ts:59` | `MAX_OPEN_NOTIONAL_USD = 2,500` |
| Balance floor | ✅ | `autotrader.ts:60,153` | `MIN_BALANCE_FLOOR = 100` — blocks buys below balance |
| Server-side price enforcement | ✅ | `trades.ts:147-153` | Never trusts client price — stamps from `getSpotPrice()` + 10bps cost realism |
| Formal risk evaluation | ✅ | `trades.ts:174-182` | `evaluateOrderRisk()` checks against available balance + current price |
| Intent-based execution | ✅ | `trades.ts:160-190` | `createOrderIntent()` → `evaluateOrderRisk()` → `executeOrderIntent()` pipeline |
| Per-agent opt-in | ✅ | `autotrader.ts:117` | Only agents with `autopilot=true` participate |
| Per-agent error isolation | ✅ | `autotrader.ts:122` | Try/catch per agent — one bad agent doesn't crash the loop |
| Kill switch (env var) | ✅ | `autotrader.ts:61,193-196` | `AUTOTRADER_DISABLED=true` stops all autotrading |
| Audit trail | ✅ | `trades.ts:218-235` | Audit events + graph events for every trade |
| Thesis sanitization | ✅ | `trades.ts:88-101` | Bounded, validated thesis fields (no arbitrary data) |
| Post-trade review system | ✅ | `trades.ts:261-283` | EdgeOps Loop 5: closed trades can be reviewed (outcomeDriver, nextDecision) |
| NaN/Infinity rejection | ✅ | `trades.ts:116-121` | `!Number.isFinite()` guard on both size and price |
| Cost-basis P&L | ✅ | `trades.ts:200-213` | Honest realized P&L via average entry, not random numbers |
| Nonce idempotency | ✅ | `trades.ts:110-111` | Every trade requires a unique nonce, preventing double-fill |

**What MetaEdge is still missing (gaps relative to HyperGuard 14-gate standard):**

| Missing Gate | Risk | Effort to Add |
|---|---|---|
| Drawdown limit (e.g., stop all trading if portfolio drops 10%) | An agent with a losing strategy can drain the paper balance to $0 across multiple trades | 10 min — add to `autotrader.ts` tick() and check before trading |
| Daily loss limit | A bad day can compound without a circuit breaker | 10 min — same pattern as drawdown |
| Time-of-day restrictions | Currently trades 24/7. Some strategies perform poorly outside market hours. | 5 min — env var configurable window |
| Rate limiting (max orders/min) | Currently one decision per tick per agent (90s), so implicit rate limit exists, but no hard max | 2 min — explicit check |
| Cooldown between same-asset trades | Some strategies could flip-flop buy/sell every tick | 5 min — track last trade per asset |
| Volatility circuit breaker | No pause on extreme price moves | 10 min — check price change % before trading |

**Important context**: The entire app is **paper trading** — it moves paper balances and Arena standings, never real funds. The absence of a "paper/live mode separation" pattern is not a gap but an intentional design choice. If on-chain trading were added, this would become the #1 priority.

**Recommendation**: Before adding on-chain trading, add the 6 missing gates above (total ~45 min). The existing intent pipeline (`createOrderIntent` → `evaluateOrderRisk` → `executeOrderIntent`) is already well-structured for this — the risk engine just needs more rules.

---

### 4. Staged Rollout Pattern (Paper → Live)

Every serious system uses staged deployment:

```
Stage 0: Backtest (historical data)
Stage 1: Paper trade (live data, fake fills)
Stage 2: Dry run (live account, orders simulated)
Stage 3: Canary (minimal capital, auto-revert kill switch)
Stage 4: Staged scale (10% → 50% → 100% with gates at each step)
```

**quant-rollout state machine**: Stage advancement gated by win rate ≥60% on 50+ trades. Kill switch auto-reverts on losing streak (WR <55% on last 30). Veto window (30 min for human to abort).

---

### 5. Regulatory Snapshot

| Jurisdiction | Status | Key Rule |
|---|---|---|
| **US (SEC)** | No AI-specific rules; existing securities laws apply | AI in trading must be disclosed in Form ADV. First AI-washing enforcement Sept 2025. |
| **US (CFTC)** | Innovation Task Force developing AI trading guidance (Mar 2026) | No automated trading rules replace the withdrawn Reg AT |
| **EU (MiCA)** | Non-custodial bots NOT CASP-regulated. Bot-as-a-service IS portfolio management | CASP authorization needed if agent manages user funds. Penalties up to 12.5% turnover |
| **EU (AI Act)** | AI trading agents with significant financial impact = likely **high-risk** | Risk management, data governance, documentation, human oversight required |
| **Hong Kong SFC** | License needed (Type 1 + Type 7) if retail-facing | KYT screening mandatory. Users must know they're interacting with AI |
| **Japan FSA** | Human oversight mandatory | No exceptions for autonomous agents |

**The KYC gap**: AI agents have no name, DOB, or identity. The emerging "Know Your Agent" (KYA) framework proposes: wrapper entity (LLC owns agent wallet) + deployer attestation (signed scope limits) + behavior monitoring. NIST launched AI Agent Standards Initiative Feb 2026. MetaComp launched first KYA framework Apr 2026.

---

### 6. Key Sources

| Source | Type | URL |
|---|---|---|
| Coinbase for Agents (June 2026) | Product launch | coinbase.com/blog/coinbase-for-agents |
| Hyperliquid API Guide | Docs | hyprswarm.com/blog/hyperliquid-api-guide |
| GMX AI Agent SDK (May 2026) | Product launch | outposts.io/article/gmx-launches-ai-agent-sdk |
| ElizaOS Docs | Docs | docs.elizaos.ai |
| AgentKit Docs | Docs | docs.cdp.coinbase.com/agent-kit/welcome |
| TradingAgents (UCLA/MIT) | Paper + Code | arxiv.org/abs/2412.20138 |
| AgentTrading Paper | Paper | medium.com/@gwrx2005/agenttrading |
| HyperGuard 14-gate engine | Code | github.com/cwklurks/hyperguard |
| Cobo Agentic Wallet | Product | cobo.com/post/agentic-wallet-hyperliquid-ai-trading |
| AgentArena Bot Toolkits (Rust) | Code | github.com/HarrierOnChain/Prediction-Markets-Trading-Bot-Toolkits |
| CrossArb (Polymarket-Kalshi) | Code | github.com/tswaim/polymarket-kalshi-arbitrage-bot |
| Polymarket API Docs | Docs | docs.polymarket.com |
| Kalshi API Docs | Docs | docs.kalshi.com |
| SimpleFunctions MCP | Tool | simplefunctions.dev |
| Harvard BCG AI Agent Trading Report | Report | hbss.harvard.edu/ai-in-finance-report |
| Fenwick Law — AI Agent Risks | Legal | fenwick.com/insights/publications/the-rise-and-risks-of-ai-agents-in-crypto |
| Sygnum Bank AI Agent (May 2026) | Press release | sygnum.com/news/sygnum-completes-first-live-ai-agent-driven-digital-asset-transactions |
| Chainstack Labs HL Bot | Code | github.com/chainstacklabs/hyperliquid-trading-bot |
| CleanSky Agent Risk Analysis | Analysis | cleansky.io/blog/llm-trading-agents-risks-openclaw-2026 |
| Swarm Markets SDK | Code | github.com/SwarmMarkets/python-swarm-sdks |
| sigc Safety Systems | Docs | docs.skelfresearch.com/sigc/production/safety-systems |
| RustyBT Circuit Breakers | Docs | rustybt.readthedocs.io/en/latest/api/live-trading/core/circuit-breakers |

---

## Research 2: Production Architecture, Data & Pipeline (July 2026)

**Type:** Reference / Architectural guidance
**Actionability:** Mostly informational — deployment patterns, free data APIs, trading strategies, and full pipeline architecture. The free API list and concrete repo references are actionable immediately. The pipeline architecture section should inform any future LLM strategy work (Research 4).

### 1. Deployment Orchestration

#### Standard Pattern by Scale

| Scale | Pattern | Hosting | Monthly Cost |
|---|---|---|---|
| Solo (1-10 bots) | Docker Compose on single VPS | Hetzner, DigitalOcean, Vultr | $5-20/mo |
| Team (10-50 bots) | Docker Compose + systemd/Nomad on 2-5 VPS nodes | Hetzner, AWS | $50-200/mo |
| Institutional (50+ bots) | Kubernetes (K3s/EKS/GKE) | AWS, GCP, Azure | $500+/mo |

**Key decisions:**
- **Docker Compose v2** is production-grade for single-node — health checks, `depends_on: condition: service_healthy`, resource limits, `restart: always` get 99%+ uptime
- **Nomad** quietly captured 22% of new infra deployments (up from 9% in 2023) — simpler than K8s, handles containers + non-containerized workloads natively
- **Kubernetes is overkill** for <15 services — teams spend 2.3x longer debugging deployments than with Nomad
- **Serverless is actively discouraged** — Lambda caps at 15 min, can't maintain persistent WebSocket connections

#### Standard Docker Pattern

```dockerfile
# Multi-stage build (non-negotiable in production)
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim AS runtime
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY . .
RUN addgroup -g 1001 -S trader && adduser -S -u 1001 -G trader trader
USER trader
HEALTHCHECK --interval=30s CMD python health_check.py
CMD ["python", "bot.py"]
```

**Requirements**: multi-stage builds, non-root user, pin base image versions (`python:3.12-slim`, not `:latest`), read-only root fs, vulnerability scanning (Trivy in CI/CD).

#### Secrets Management Hierarchy

| Method | Security | Complexity | Best For |
|---|---|---|---|
| `.env` file + IP whitelist | Medium | Low | Solo operators |
| Docker Secrets (Swarm) | Medium | Medium | Docker-only stacks |
| HashiCorp Vault | High | High | Multi-bot, team |
| External Secrets Operator (K8s) | High | Medium | K8s-native |
| Hardware Security Module | Highest | Very high | Institutional |

**Rule**: Never bake secrets into images. Use `--mount=type=secret` (build-time) or inject at runtime. Environment variables can leak via `ps eww` and container logs — file-based mounts are preferred.

#### Disaster Recovery

The **reconciliation loop** is the core pattern for crash recovery:
1. On startup, fetch all open orders + positions from the exchange (exchange is source of truth)
2. Compare with local state — detect orphan orders, ghost orders, stale fills
3. Reconcile local state to match exchange
4. Never place new orders before reconciliation completes

**Idempotency keys** prevent duplicate orders: generate UUID per order request, store in Redis `SET NX` with 24-48h TTL. On retry, exchange returns original result instead of creating duplicate.

#### Monitoring Stack

| Component | Tool | Purpose |
|---|---|---|
| Metrics | Prometheus | Time-series for health & performance |
| Dashboards | Grafana | P&L, positions, latency, errors |
| Alerts | Alertmanager → PagerDuty/Telegram | Bot down, drawdown breach, error spike |
| Logs | Loki or ELK | Centralized post-mortem |

**Critical alerts**: heartbeat miss (5 min → page), drawdown >15% (flatten + halt), API error rate >5%, position drift between local and exchange.

---

### 2. Free Data APIs (Reduce Costs)

#### Crypto Prices

| Provider | Free Rate Limit | Key Needed | Historical | Best For |
|---|---|---|---|---|
| **Binance public** | 1,200 wt/min | No | Yes (500+ candles) | Primary price feed, highest throughput |
| **CryptoCompare** | 100K calls/mo | Yes | Yes | Higher-volume needs before paid |
| **CoinGecko** | ~30 calls/min | Yes (Demo) | Partial | Wide coin coverage, CORS support |
| **CoinMarketCap** | 10K calls/mo | Yes | No (paid only) | Limited — use Binance instead |
| **Bybit public** | 120 req/5s | No | Yes | Derivatives data |
| **Kraken public** | ~60 req/min | No | Yes | Alternative spot feed |

**Best strategy**: Use Binance public endpoints as primary (no key, highest limits, WebSocket). Cache aggressively — store every API response locally so you never re-fetch. Backfill historical once, then poll incrementally.

#### On-Chain Data

| Provider | Free Tier | Best For |
|---|---|---|
| **Dune Analytics** | 2,500 credits/mo | Custom SQL queries, 100+ chains, dashboards |
| **The Graph** | 100K queries/mo | GraphQL subgraphs (Uniswap, Polymarket, Aave) |
| **DefiLlama** | Unlimited (soft limit) | TVL, yields (50K+ pools), token prices |
| **Etherscan V2** | 100K calls/day | EVM transactions, balances, events (50+ chains) |
| **Public RPC nodes** | Free, rate-limited | Self-host light client for unlimited queries |

#### Prediction Market Data

| Provider | Cost | Auth | Coverage |
|---|---|---|---|
| **Polymarket Gamma API** | Free | No | Market metadata, order books |
| **Polymarket CLOB API** | Free (reads) | HMAC for writes | Live order books, trading |
| **Polymarket Data API** | Free | No | Historical activity, wallet profiles |
| **Kalshi Public API** | Free | No | Market data, order books, events |
| **SimpleFunctions MCP** | Free (15M tokens/mo) | No | 12K+ contracts across Kalshi+Polymarket, 29 MCP tools |
| **Manifold Markets** | Free | No | Play money — prototyping only |
| **PredScope** | Free | No | Aggregated top markets, 10-min refresh |

#### Free LLM APIs for Trading Signals

| Provider | Free Tier | Best Model | Notes |
|---|---|---|---|
| **Google Gemini** | 15 RPM, 250K TPM | Gemini 2.5 Flash-Lite | No credit card needed |
| **Groq** | 30 req/min | Llama 3.3 70B | Fastest inference (LPU), no credit card |
| **DeepSeek** | 500K tokens/day | DeepSeek V4 | 90% cache-hit discount |
| **Hugging Face** | 1,000 req/day | 200K+ open models | Community GPU queue |
| **OpenRouter** | $0 credits | 100+ models | Fallback when others rate-limit |

**Strategy**: Route 90% of calls through Gemini free tier, use Groq for latency-sensitive, OpenRouter as fallback. Keep small paid balance for top 10% high-stakes calls.

#### Free Macro Data

| Provider | Rate Limit | Best For |
|---|---|---|
| **FRED** | 120 req/min | 816K+ economic time series (GDP, CPI, unemployment) |
| **Alpha Vantage** | 25 req/day | Technical indicators, multi-asset (very limited free) |
| **Finnhub** | 60 req/min | News sentiment, stocks, forex (most generous free finance API) |
| **World Bank** | Unlimited | International development data (1-2 year lag) |

#### Self-Hosted Alternatives

- **Bitcoin full node**: ~600GB storage, $300-600 one-time HW, $5-15/mo electricity
- **Ethereum full node**: ~2TB NVMe, 16GB+ RAM, $1,200-2,000 HW
- **Light client**: ~100MB, runs on anything
- **Archive node**: Erigon/Reth reduced storage from 14TB (Geth) to ~1.8TB

#### Data Storage

| Use Case | Recommended DB |
|---|---|
| Single-user bot | SQLite (simplest) |
| Multi-user production | TimescaleDB on PostgreSQL (full SQL, reliable) |
| High-frequency tick data | QuestDB (43-418x faster than InfluxDB) |
| Historical backtesting (large) | Parquet files + DuckDB/ClickHouse |
| Real-time monitoring | InfluxDB |
| Research / notebooks | Parquet (compressed, fast I/O) |

---

### 3. Trading Strategies for LLM Agents

#### Good Fit (LLM adds value)

| Strategy | LLM Value Add | Typical Win Rate Improvement |
|---|---|---|
| **Event-driven / Catalyst** | Interpreting earnings calls, Fed minutes, regulatory filings | LLMs excel at unstructured narrative |
| **Sentiment-driven** | Aggregating social media, news signal | Narrative drives short-term price action |
| **Mean reversion with context** | LLM checks *why* price deviated before mean-reverting | ~55% → 63-70% (prevents catching falling knives) |
| **Regime-aware trend following** | LLM identifies market regime from macro context | Better filter than volatility-based alone |
| **Cross-asset fundamental** | Reading 10-Ks, competitive landscape analysis | Deep research advantage |

#### Poor Fit (use traditional bots)

| Strategy | Why NOT LLM | Better Approach |
|---|---|---|
| HFT / Market making | LLM latency (100ms+) is fatal | FPGA / C++ |
| Pure technical arbitrage | No narrative to analyze | Deterministic rules |
| Grid trading | No reasoning needed | Simple script |
| Simple moving average cross | LLM adds cost + latency for zero benefit | 10 lines of code |
| Options delta hedging | Continuous numerical precision | Dedicated options engine |

#### Multi-Agent Debate (Dominant 2026 Pattern)

TradingAgents (UCLA/MIT, 91K stars) + Apex Quant both use adversarial debate:

```
Analysts (4 agents: Fundamental, Technical, Sentiment, News)
  → Bull Researcher vs Bear Researcher (multi-round structured debate)
    → Trader Agent (makes final call with confidence score)
      → Risk Manager (pre-trade checks)
        → Portfolio Manager (final approval/rejection)
```

**Key finding** (Apex Quant, SSRN 2026): Debate structure itself provides decision stability beyond prompt memory. Systematic persona bias can emerge — one agent dominating through rhetoric rather than evidence. Threshold calibration against historical accuracy is essential.

---

### 4. Full Pipeline: Ingestion → Analysis → Triggers → Execution → Learning

The canonical 2026 architecture is a directed graph with feedback loops, not a linear pipeline.

#### Stage 1: Ingestion

```
Exchange WebSocket (primary) ──▶ Redis Stream Buffer
Exchange REST (backfill)     ──▶ Normalization Layer → Unified Schema
News/Social REST polling     ──▶   {timestamp, open, high, low, close, volume, source, symbol}
                                                      │
                                                      ▼
                                              TimescaleDB (historical)
                                              Redis (real-time)
```

**Key patterns**: WebSocket primary, REST for backfill on disconnect. Track last processed block height/candle timestamp, query historical REST for the gap, then resume stream. Rate limit mitigation: priority queue where SELL_SIGNAL > BUY_SIGNAL > BALANCE_CHECK > NEWS_POLL.

#### Stage 2: Analysis

**Rule**: Pre-compute ALL technical indicators deterministically (code). LLM only does synthesis/reasoning.

```
Multi-timeframe: 1h (trend) + 15m (session) + 5m (entry) + 1m (precision)
  → Deterministic indicators: RSI, MACD, EMA, Bollinger Bands, ATR, ADX
    → Formatted text fed to LLM (not raw numbers)
      → LLM output: structured signal with confidence + reasoning

Sentiment pipeline:
  News/Social → Relevance Filter (discards 70-80% noise)
    → Chunk & Embed → Vector DB (for RAG)
      → LLM sentiment classification → Aggregation (recency + source weighted)
```

**RAG for market context**: Retrieve past analyses, recent news, and historical patterns from similar market regimes. Feed as context to LLM before each decision.

#### Stage 3: Trigger / Decision

```
Multi-Agent Debate (Bull vs Bear, multi-round)
  → Trader Agent: {decision, entry, confidence}
    → Confidence Calibration: map raw LLM confidence to empirically-calibrated value
      → if calibrated < threshold (e.g., 0.65) → reject
        → Risk Gate Pipeline (deterministic, non-LLM):
          - Position limit check
          - VaR budget check
          - Correlation check
          - Max drawdown check
          - Min risk/reward (2:1)
          → if any gate fails → reject
```

Confidence calibration is critical — LLMs are systematically overconfident. Track historical accuracy per confidence bin and recalibrate.

#### Stage 4: Execution

```
Order Type Selection:
  High liquidity, need speed       → Market
  Low liquidity, cost-sensitive    → Limit
  Large (>1% daily vol)            → TWAP
  Very large (>5% daily vol)       → Iceberg + TWAP
  Arbitrage                        → Market (speed > cost)
  Stop loss                        → Stop Market
  Take profit                      → Limit

Exchange Failover:
  Try Primary → Success? → return receipt
              → Timeout/RateLimit/Error? → failover to Secondary
                                          → all fail? → record as "failed execution", never retry same order
```

Slippage model: `market_impact = 0.5 * spread * (order_size / daily_volume)^0.5`. Cap at 5%.

#### Stage 5: Learning / Feedback Loop

```
Every trade logged with full trace:
  {trade_id, entry/exit, pnl, all agent outputs, confidence,
   risk checks passed, execution details, market context at entry}

P&L Attribution: decompose total return into:
  - Setup quality (did high-grade setups outperform low-grade?)
  - Regime fit (did we win because market favored us?)
  - Execution (did we execute as planned?)
  - Sizing (did position sizing help or hurt?)

Strategy Retirement Criteria:
  - Drawdown > 1.5x backtest max DD     → pause
  - Rolling 30d Sharpe < 0               → reduce size 50%
  - Win rate < 40% over 50 trades        → auto-disable
  - Regime dependence > 80% (luck > skill) → flag for review
  - ECE (calibration error) > 0.20       → recalibrate
  - No signal for 14 days                → lower thresholds or retire
```

**Paper → Live graduation**:

```
Phase 1: Backtest (1-3mo historical)
  Pass: Sharpe > 1.0, Max DD < 15%, Profit Factor > 1.5

Phase 2: Paper trading (30d minimum)
  Pass: Sharpe > 0.8, win rate > 50%, no single-day DD > 5%

Phase 3: Live at 10% of target capital (20 trading days)
  Graduation: max DD < 5% allocation, execution cost within 2x of paper estimate

Phase 4: Full scale after 60 days meeting criteria
```

---

### 5. Key Concrete Repos (Architecture References)

| Project | Stars | Language | What It Does | Best For |
|---|---|---|---|---|
| **TradingAgents** | 91K | Python | Multi-agent debate framework (7 agents, LangGraph) | Best reference for agent architecture and debate pattern |
| **sigc** (Skelf Research) | ~50 | Rust | Quant compiler — DSL → single production binary with built-in risk engine | Best reference for risk gates and execution layer |
| **backtest-kit** | 51 | TypeScript | Schema-first backtesting with LLM integration, CCXT exchange connectivity | Best reference for full pipeline with risk schemas |
| **RD-Agent** (Microsoft) | 11K | Python | Automated quant research — discovers alpha strategies via multi-agent | Best reference for automated strategy research |
| **Freqtrade** | 52K | Python | Classic open-source trading bot with FreqAI ML module | Best reference for backtesting and deployment |
| **Hummingbot Condor** | 19K | Python | LLM OODA loop (Observe-Orient-Decide-Act) on 50+ exchanges | Best reference for exchange connectivity layer |

---

### 6. Key Sources (Batch 2)

| Source | Type | URL |
|---|---|---|
| Docker Production Best Practices 2026 | Guide | mykolaaleksandrov.dev/posts/2026/02/docker-production-best-practices |
| K8s vs Docker Compose vs Nomad 2026 | Comparison | devex-tools.net/blog/k8s-vs-docker-compose-vs-nomad-2026 |
| Disaster Recovery for Algorithmic Trading | Guide | breakingalpha.io/insights/disaster-recovery-planning-algorithmic-trading-operations |
| CI/CD Pipelines for Trading Systems | Guide | quantt.co.uk/resources/cicd-pipelines-for-trading-systems |
| AI Trading Bot Deployment Guide | Guide | aitradingbot.us/how-to-deploy-a-trading-bot |
| Running a Crypto Bot on VPS 2026 | Guide | dev.to/cvchelles/running-a-crypto-trading-bot-on-a-vps-the-complete-2026-guide-2j4e |
| Free LLM APIs 2026 | List | klymentiev.com/blog/free-llm-api |
| Free Crypto Price API Comparison | Compare | api-catalog-three.vercel.app/compare/crypto-price-api |
| Dune API Pricing | Docs | dune.com/pricing |
| The Graph Pricing | Docs | thegraph.com/studio-pricing |
| DefiLlama API Docs | Docs | api-docs.defillama.com |
| SimpleFunctions Prediction Market API | Docs | simplefunctions.dev/prediction-market-api |
| TradingAgents Paper + Code | Paper | arxiv.org/abs/2412.20138 |
| Apex Quant (Tri-Agent Debate) | Paper | papers.ssrn.com/sol3/papers.cfm?abstract_id=6354961 |
| Agentic Trading Survey (arXiv 2605.19337) | Survey | arxiv.org/abs/2605.19337 |
| RD-Agent (Microsoft) | Paper + Code | arxiv.org/abs/2505.15155 |
| sigc Quant Compiler | Code | github.com/Skelf-Research/sigc |
| backtest-kit | Code | github.com/tripolskypetr/backtest-kit |
| awesome-trading-agents (catalog) | List | github.com/LLMQuant/awesome-trading-agents |
| Chainstack AI Trading Pipeline | Guide | docs.chainstack.com/docs/ai-trading-agent-pipeline |
| Cryptocurrency Trading API Rate Limits 2026 | Guide | medium.com/@margaretwhite569uknancy8htmll |

---

## Research 3: SQLite Migration Plan (July 2026)

**Type:** Actionable implementation plan
**Actionability:** HIGH — concrete schema (14 tables), migration path, adapter layer for zero-change rollout, backup strategy, npm install commands. The adapter pattern allows phased migration: all routes work unchanged in Phase 1, migrate one by one in Phase 2.

### Best-Fit Library: `better-sqlite3`

| | better-sqlite3 | sql.js | bun:sqlite |
|---|---|---|---|
| API | Synchronous | Async (WASM) | Sync |
| Native | Yes (C++) | No (WASM) | Yes (bun only) |
| Express fit | Perfect — sync in handlers = no async refactor | Requires await | Can't use with Node |

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

### Schema Design (14 Tables)

Key tables: `users`, `sessions`, `rooms`, `agents`, `strategies`, `trades`, `vault_clubs`, `audit_events`, `graph_events`, `prediction_markets`, `arena_leagues`, `arena_members`, `arena_badges`, `arena_rank_snapshots`.

Design notes:
- JSON columns (`bets`, `thesis`, `profile`, `member_contributions`, `metadata`, `ranks`) where data is always read/written as a unit with the parent row
- `member_ids` on rooms stays as JSON array (never queried by containment in SQL)
- Boolean columns use INTEGER (0/1) per SQLite convention
- Timestamps stay as epoch milliseconds (matching current `Date.now()`)

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

### Migration Strategy (Zero-Downtime)

1. `initDatabase()` checks `meta` table for `schema_version`
2. If missing → reads `data/db.json`, runs all inserts in one transaction
3. Sets `schema_version = 1`
4. `data/db.json` is preserved (renamed to `.json.migrated`) — never deleted
5. Optional dual-write mode during rollout: `SQLITE_DUAL_WRITE=true`

### Adapter Layer (Phase 1 — Zero Changes to Routes)

The key insight: polyfill `readDatabase()`/`writeDatabase()` so all 14 route files work unchanged:

```ts
// storage.ts delegates to SQLite
export function readDatabase(): DatabaseState {
  // Rebuild in-memory shape from SQL queries
  const users: Record<string, User> = {};
  for (const row of db.prepare('SELECT * FROM users').all()) {
    users[row.id] = rowToUser(row);
  }
  // ... same for all 14 tables
  return { users, sessions, rooms, agents, strategies, trades, vaultClubs, auditEvents, graphEvents, predictionMarkets, arenaLeagues, arenaMembers, arenaBadges, arenaRankSnapshots };
}
```

**Migration path:** Phase 1 (adapter, zero route changes) → Phase 2 (migrate routes one by one to direct SQL) → Phase 3 (remove adapter).

### Concurrency Fix

Current: `readDatabase()` → mutate → `writeDatabase()` = last-writer-wins lost-update race.

SQLite: Each route operates on its own prepared statement. WAL mode guarantees unlimited concurrent readers, single writer with 5s busy timeout. No more full-DB read-modify-write cycle.

### Backup Strategy

```ts
// Online backup via SQLite's backup API — safe while DB is in use
const backup = new Database(backupPath);
db.backup(backupPath)  // better-sqlite3 v11+
```

Run every 6 hours via `setInterval`, prune backups older than 7 days. Optional S3 upload via `@aws-sdk/client-s3`.

### SQLite vs PostgreSQL

| Factor | SQLite | PostgreSQL |
|---|---|---|
| Deployment | Single file, zero config | Separate service, auth, port config |
| This app's load | <100 users, <10 writes/sec — ideal | Overkill |
| Operational complexity | None | Connection pooling, memory tuning, VACUUM |

**Verdict:** For a single-server, low-concurrency, paper-trading app, SQLite is the right choice. Eliminates an entire infra dependency.

---

## Research 4: Gemini LLM Trading Strategies (July 2026)

**Type:** Actionable implementation plan
**Actionability:** HIGH — concrete hook points in `autotrader.ts:152-153`, prompt templates, cost analysis ($0/mo free tier with caching), sidecar cache architecture, wire points in all affected files. Can be implemented alongside Tier 2 fixes since it's additive (no refactoring of existing code).

### SDK Status

Project already has `@google/genai` v2.4.0 in `package.json`. The legacy `@google/generative-ai` is deprecated. Latest is v2.10.0. Codebase uses it in `server/quant.ts:231-241` for backtest commentary.

### Model Selection

| Model | Free RPM | Free RPD | Paid Input/Mtok | Paid Output/Mtok |
|---|---|---|---|---|
| `gemini-2.5-flash` | 15 | 1,500 | $0.15 | $0.60 |
| `gemini-2.5-flash-lite` | 30 | 1,500 | $0.075 | $0.30 |
| `gemini-2.5-pro` | 5 | 50 | $1.25 | $10.00 |

**Recommendation:** `gemini-2.5-flash`. Free tier viable at 15 RPM. Paid tier ~$0.000195/call.

### Cost Analysis

| Config | Calls/Day | Free tier OK? | Monthly Cost |
|---|---|---|---|
| 12 agents, 5 min, no cache | 3,456 | No (2.3× over) | $20/mo (paid) |
| 12 agents, 5 min, with cache (1 batch/5min) | 288 | **Yes** | **$0** |
| Free with batch cache | ≤1,500 | Yes | $0 |

**Bottom line:** Free tier is sufficient with caching. Paid tier ~$20/mo for 12-agent uncached.

### Integration Architecture: Sidecar Cache

```
tick() — every 90s                     llmWarmer() — every 300s
  for each agent:                        batch all symbols + prices
    strategy decide()                    call Gemini → cache analysis
    CAP_CHECKS                           TTL = 5 min
    if LLM enabled & cached:             on failure: stale cache persists
      check regime confidence ≥ 0.6
      suppress if regime conflicts
    placePaperTrade()
```

**Hook point:** Between `autotrader.ts:152` (strategy decision) and `:153` (balance floor check). Non-blocking — if no cache, fall through to deterministic only.

### Prompt Templates

**Market Regime** — batch all symbols: classify each as `trending_up`/`trending_down`/`ranging`/`volatile`/`quiet` with confidence 0-1.

**Trade Analysis** — given strategy signal + price action + regime: should we execute? Returns `shouldTrade`, `confidence`, `concerns`, `regimeAlignment`.

**Risk Assessment** — position-size sanity: volatility check, regime conflict flag. Advisory only (caps are hard-enforced downstream).

### Wire Points in Existing Code

| File | Lines | Hook |
|---|---|---|
| `autotrader.ts` | 152-153 | Insert LLM gate between strategy decision and cap checks |
| `autotrader.ts` | 161-174 | Inject `regime` into thesis before `placePaperTrade()` |
| `autotrader.ts` | 176-186 | Hook for confidence tracking after trade result |
| `trades.ts` | 159-172 | Downstream — LLM never touches this |
| `declined.ts` | 17-31 | Add 4 new `DeclineReason` variants |
| `quant.ts` | 231-241 | Reference pattern for `ai.models.generateContent()` |

### Fallback Chain

```
LLM enabled? —NO—→ pure deterministic
  YES
Cache hit? —NO—→ deterministic + record 'LLM_NO_CACHE'
  YES
Confidence ≥ 0.6? —NO—→ deterministic only
  YES
Regime conflicts? —YES—→ decline with 'LLM_SUPPRESSED_*'
  NO
Proceed to cap checks + execution
```

### Confidence Calibration

Track last 100 LLM interventions vs realized P&L. If accuracy < 40% over 30+ trades, auto-disable `LLM_ANALYST_ENABLED` and log warning.

### Security

- Key lives in `process.env.GEMINI_API_KEY` only
- Never stored in DB, never sent to client, never logged
- Server already has `GEMINI_API_KEY` in `.env.example:4`
- Guardrail: early return if key missing or `LLM_ANALYST_ENABLED !== 'true'`

---

## Research 5: Live Prediction Market APIs (July 2026)

**Type:** Actionable implementation plan
**Actionability:** HIGH — server-side proxy pattern with 3-tier fallback (Polymarket → Kalshi → local), zero new npm deps (native fetch), unified market schema, caching strategy, WebSocket available for future live odds. The existing `PredictionMarkets.tsx` already handles `source: 'polymarket'` at lines 28-29.

### Polymarket Gamma API (Free, No Auth)

**Base:** `https://gamma-api.polymarket.com`
**Rate limits:** 300 req/10s for markets, 500 req/10s for events, 4000 req/10s general

```bash
# Top active markets by volume
curl "https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume&ascending=false&limit=50"

# Filter by tag (crypto=2, politics=6)
curl "https://gamma-api.polymarket.com/markets?tag_id=2&active=true&limit=20"
```

**Response shape (key fields):**
```json
{
  "question": "Will BTC reach $120k before Dec 2026?",
  "outcomePrices": "[\"0.35\",\"0.65\"]",
  "volumeNum": 1234567.89,
  "liquidityNum": 500000,
  "endDateIso": "2026-12-31T23:59:59.000Z",
  "active": true,
  "closed": false
}
```

CLOB API for price-level data: `https://clob.polymarket.com` — also free, no auth. WebSocket available (no auth) at `wss://ws-subscriptions-clob.polymarket.com/ws/market`.

### Kalshi API (Market Data: Free, No Auth)

**Base:** `https://external-api.kalshi.com/trade-api/v2`
**Rate limits:** Token-bucket, basic tier = 200 read tokens/s (~20 req/s)

```bash
curl "https://external-api.kalshi.com/trade-api/v2/markets?status=open&limit=100"
```

WebSocket requires RSA key auth — skip for display-only.

### Server-Side Proxy Pattern

Create `server/market-proxy.ts` mounted at `/api/mm/predict/markets`:

1. Try Polymarket first (30s cache TTL)
2. On error, try Kalshi (15s cache TTL)
3. On error, fall back to local `db.json` hardcoded markets

Zero npm dependencies needed (native `fetch` in Node 18+). No API keys exposed to client.

### Unified Market Schema

Map both APIs to MetaEdge's existing `PredictionMarket` shape. Key mapping: `outcomePrices[0]` (Polymarket) or `last_price_dollars` (Kalshi) → derive synthetic `yesPool`/`noPool` as `volume * price` for display purposes.

### Implementation Order

1. Create `server/market-proxy.ts` with `fetchPolymarketMarkets()` + `normalizePolymarket()`
2. Mount at `/api/mm/predict/markets`
3. Add Kalshi as secondary fallback
4. In-memory cache (30s Polymarket, 15s Kalshi)
5. Final fallback to local `db.json` markets
6. Existing `PredictionMarkets.tsx` already handles `source: 'polymarket'` at lines 28-29

---

## Research 6: Production Deployment (July 2026)

**Type:** Actionable implementation plan
**Actionability:** HIGH — complete Dockerfile, docker-compose.yml, GitHub Actions CI/CD, Fly.io hosting recommendation with cost, deployment checklist. Can be implemented in a single session. Note: requires completing code fixes first so the Docker image is built from a clean state.

### Multi-Stage Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/docs ./docs
RUN mkdir -p /app/data && chown -R app:app /app/data
EXPOSE 3000
USER app
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
ENV NODE_ENV=production PORT=3000
VOLUME ["/app/data"]
CMD ["node", "dist/server.cjs"]
```

### docker-compose.yml

```yaml
services:
  metaedge:
    build: .
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=production
      - COOKIE_SECRET=${COOKIE_SECRET}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes: ["./data:/app/data"]
    restart: unless-stopped
```

### Process Manager

**Skip PM2.** Docker restart policy handles crash recovery. PM2 inside Docker adds overhead, config surface, and signal-handling conflicts with existing SIGTERM handler.

### CI/CD (GitHub Actions)

Simple pipeline: `npm ci` → `npm run build` → `npm test` (future) → build Docker → push to GHCR → deploy via SSH (`docker compose pull && docker compose up -d`).

Push to **GHCR** (free, no rate limits, auto-auth via `GITHUB_TOKEN`).

### Secrets Management

| Variable | Source | Used In |
|---|---|---|
| `COOKIE_SECRET` | `openssl rand -base64 32` | `server.ts:41` cookie-parser |
| `GEMINI_API_KEY` | Google AI Studio | Future LLM feature |
| `LIVE_EXECUTION_ENABLED` | Config | `server.ts:65` |

Rules: `.env` for local dev (already in `.gitignore`). Docker Compose reads from `.env` file. CI secrets for CD. Production: `fly secrets set` or SSH `env_file:`.

### Hosting Recommendation: Fly.io

| Platform | Cost | Persistent disk? | Fit |
|---|---|---|---|
| **Fly.io** | $0-$5 | Yes (1GB free) | **Best** — Docker-native, `fly deploy` one command |
| Hetzner + Coolify | €4-€6 | Yes | Cheapest unlimited traffic |
| Railway | $0-$5 | Yes | Good, egress limits |
| Render | $7 | Yes | Easy but pricier |

**Not a fit:** Cloud Run (ephemeral FS — `db.json` resets on cold start).

### Reverse Proxy

Already have Caddy in `scripts/gcp_setup.sh`. Caddy wins over Nginx for single-server: auto HTTPS (Let's Encrypt), 5-line config vs 25-line Nginx.

### Deployment Checklist

```
□ Generate COOKIE_SECRET
□ Create .env.production
□ Run npm run build — confirm clean
□ Test Docker build: docker build -t metaedge:test .
□ Test container: docker run -v $(pwd)/data:/app/data -p 3000:3000 metaedge:test
□ Test healthcheck: curl http://localhost:3000/api/health
□ Test graceful shutdown
□ Verify data persistence across restarts
□ Push to GitHub, confirm CI passes
□ Deploy to target platform
□ Test full user journey
□ Schedule daily db backup
```

---

## Research 7: Monitoring & Observability (July 2026)

**Type:** Actionable implementation plan
**Actionability:** HIGH — exact npm install commands, pino setup with redaction, Sentry init for error tracking, enhanced `/api/health` endpoint code, per-file error surface catalog (7 files, 14+ specific line ranges), Prometheus metrics middleware, alert thresholds. Can be implemented incrementally alongside Tier 1/2 fixes.

### Structured Logging — pino

Install: `npm install pino express-pino-logger pino-pretty`

Setup in `server.ts`:
```ts
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: ['req.headers.cookie', 'req.headers.authorization'], censor: '[REDACTED]' },
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,  // prod → JSON stdout
});
app.use(expressPino({ logger }));
```

### Error Tracking — Sentry

Install: `npm install @sentry/node`

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,  // free tier: 5k events/month
  environment: process.env.NODE_ENV,
  release: process.env.GIT_COMMIT || 'dev',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,
  enabled: !!process.env.SENTRY_DSN,
});
Sentry.setupExpressErrorHandler(app);
```

### Enhanced `/api/health` Endpoint

Include: uptime, db connectivity + file size, price feed age + source, active agent count, open positions, memory (rss/heap), load avg. Returns `200` or `503` based on db connectivity. Warn log if response > 1s.

### Error Surface Catalog — Instrument Per Module

| File | Lines | Current | Fix |
|---|---|---|---|
| `prices.ts` | 73, 87, 91 | `catch { return false }` / `/* skip */` | `logger.warn(...)` |
| `storage.ts` | 103-155 | `console.error` | `logger.error(...)` + `Sentry.captureException(e)` |
| `trades.ts` | 170, 180, 188 | `catch { return { ok: false } }` | `logger.warn(...)` + `Sentry.captureException(err)` |
| `autotrader.ts` | 187-198 | `console.warn` | `logger.warn({ err, agent }, ...)` |
| `janitor.ts` | 101-102 | `console.warn` | `logger.warn(...)` + Sentry |
| `recorder.ts` | 26, 52, 62, 95 | `catch {}` | `logger.warn(...)` |
| `server.ts` | 108 | `console.error` | `logger.error` + Sentry |

### Alert Thresholds

```ts
// Check every 60s
rssMB > 500 → WARN, > 1000 → CRIT
price feed age > 300s → WARN
5xx rate > 1% → ALERT
trade execution fail rate > 10% → ERROR
```

---

## Master Execution Checklist

**Purpose:** Track every item in this handoff through 5 stages. Claude (or any tool) updates this checklist as work progresses. When a session ends, the checklist shows exactly what's been reviewed, decided, implemented, left out, or still pending.

### How to use
1. Start at the top. Review each item → mark `[x]` Reviewed.
2. Decide whether to implement, defer, or skip → mark `[x]` Decide.
3. Implement code changes → mark `[x]` Implemented.
4. If intentionally skipping → mark `[x]` Left Out + add reason in Notes.
5. Revisit remaining items in next session.

### Tier 0 — Fix Today (Active production threats)

| ID | Description | Effort | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|
| **0.1** | HMAC pepper fallback + timing leak | 10m | [x] | [x] | [x] Implemented | `29b20d1`. Fallback existed in **TWO** places (`:24` AND `:47`) — doc lists only `:24`. Both now route through one `systemPepper()` accessor that throws. `===` → `timingSafeEqual` behind a length guard. **Scope correction:** `secrets.ts` has **no importers** — threat was latent, not active. The doc's verify step ("start without SYSTEM_PEPPER → crash") does NOT fire: the throw is inside an uncalled function. |
| **0.2** | JSON DB no concurrent write lock | 2-4h | [x] | [x] | [ ] **DEFERRED** | **Premise not reproducible.** Scanned every `readDatabase()`→`writeDatabase()` block in `server/*.ts`: **0 async windows** (no `await` between read and write). Node's single thread makes each cycle atomic, so a promise mutex is a no-op against current code. It also cannot serialise the REAL exposure: separate `.mjs` processes writing the same files (see R1). Worth adding as insurance before any `await` enters a critical section. Invariant is load-bearing and unguarded. |
| **DA2** | Cookie secret hardcoded fallback | 2m | [x] | [x] | [x] Implemented | `29b20d1`. Confirmed live on the request path at `server.ts:41`. Deploy-safe: verified `gcp_setup.sh:49` generates `COOKIE_SECRET` into `.env.production`, loaded by systemd `EnvironmentFile`. Also fixed `startServer().catch`, which logged fatal startup errors but left a zombie process — that would have silently defeated this crash-on-missing-secret behaviour. |

### Tier 1 — Fix This Week (Production bugs)

| ID | Description | Effort | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|
| **1.1** | `res.json()` before `res.ok` (17+ sites) | 30m | [x] | [x] | [x] Implemented | `2a70bb0`. **Real count: 44 sites / 18 files**, incl. `ActingAsChip.tsx` (missed by the doc). **28 of them already checked `res.ok` — just after parsing.** So the fix is not "add a check": added `safeJson()` (`src/lib/api.ts`) that never throws, then let each existing `if (!res.ok)` run. Control flow and `data.error` messages preserved exactly. Migrated by codemod. Absorbs Q2/I2/SW1/M1. |
| **1.2** | Uncaught mutation errors → white screen | 35m | [x] | [x] | [x] Implemented | `2a70bb0`. **(a) was already done** — `main.tsx` already wraps `<App/>` in `ErrorBoundary`. But it only catches **render** errors, never a rejected promise from an event handler. Added a global `unhandledrejection` listener + dismissible banner rather than hand-wrapping 22 handlers: the symptom ("clicked, nothing happened") can originate anywhere. |
| **1.3** | tradeParse.ts missing `await` on fetch | 5m | [x] | [x] | [x] **Left Out** | **STALE.** `await fetch(` is already present at `tradeParse.ts:39`. Its `res.json`-before-`res.ok` half was covered by 1.1. |
| **1.4** | Server routes: no input validation, session rotation | 1-2d | [x] | [x] | [ ] **DEFERRED** | Largest item in the queue. **Carve-out worth pulling forward (~20m):** `resolveMarket` has no ownership check — that is an authz hole, not a validation nicety. The one remaining `tsc` error (`metamask.ts:1366` `req.userId`) belongs to this item. |
| **D1** | Profile save silently closes modal | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. `Dashboard.tsx:100-105` **already** catches, keeps the modal open and renders the message. App.tsx swallowed the error so the promise resolved and the modal closed as if saved. Rethrowing is the entire fix. |
| **D12** | Profile edit resets on parent re-render | 5m | [x] | [x] | [x] **Left Out** | **ALREADY FIXED.** `Dashboard.tsx:83` is already gated on `!isEditingProfile`. Verified, no change needed. |
| **W1** | `switchTo()` fires `wallet-connected` on failure | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. A rejected switch still fired the event, so the app re-read balances as the NEW wallet while the server still acted as the old one. Now reads the response first; added `switchError` surface. |
| **W2** | Stale data — key bump never implemented | 10m | [x] | [x] | [x] Implemented | `2a70bb0`. Implemented as a **`refreshKey` prop**, not a React `key`: a literal `key` fails to typecheck against `WalletsPanel`'s inline props type and flashes the panel on remount. `WalletsPanel` now refetches when `refreshKey` changes. |
| **W4** | `disconnectWallet()` ignores API response | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. A failed disconnect still cleared local state — UI read "disconnected" while the server stayed attached. |
| **R1** | `declined-daily.json` non-atomic write race | 15m | [x] | [x] | [x] Implemented | `2a70bb0`. **NOT blocked by 0.2** — different file, and one reader (`scripts/edgeops_report.mjs`) is a **separate process**, which a per-process mutex cannot serialise. Fixed with temp+rename. **Measured: 26 torn reads / 3,555 with the old truncating write; 0 / 15,045 after.** |
| **R2** | ResearchFleet silent API failure (no else) | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. Added error state ("showing the last successful snapshot, which may be stale"). Also fixed its **3 live `tsc` errors**: `data?.declined \|\| {}` widened to `{}`, so `Object.entries` yielded `unknown`. |
| **T1** | TradingRoom race on rapid room switch | 15m | [x] | [x] | [x] Implemented | `2a70bb0`. AbortController on switch/unmount; `AbortError` is not treated as a failure and must not clobber the new room's state. |
| **T2** | Silent error swallowing — stale room data | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. A failed load left the PREVIOUS room's details on screen — the desk showed one room while acting on another. |
| **A1** | `rsi_meanrev` missing from type + form | 15m | [x] | [x] | [x] Implemented | `2a70bb0`. Corroborated by a **live compile error** at `autotrader.ts:136`. Added to the `types.ts` union + AgentWorkshop `<select>`. `server/agents.ts:46` already whitelisted it. |
| **A2** | Price auto-update overwrites user edits | 10m | [x] | [x] | [x] Implemented | `2a70bb0`. Root cause was a **dependency-array bug**: the sim-price effect listed `realPrices`, so every `/api/prices` poll overwrote the typed value. Now seeded on agent/asset change only, reading prices via a ref. |
| **C2** | Server empty catch blocks on feed failure | 15m | [x] | [x] | [x] **Left Out** | **MIS-SCOPED.** `server/chart.ts` does not exist. The client-side equivalent (`TokenMarketChart.tsx:112`) was covered by the 1.1 codemod. |
| **P1** | Empty catch block | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. Error state is deliberately **source-agnostic** — per Research 5 this endpoint becomes a Polymarket→Kalshi→local proxy, so naming a provider would start lying the day the proxy lands. Malformed `outcomePrices` now warns instead of silently rendering a blank market. |
| **P2** | Malformed `outcomePrices` swallowed | 5m | [x] | [x] | [x] **Left Out** | **File does not exist.** `server/predictionMarkets.ts` is absent; markets live in `server/predictions.ts`. Research 5 explains why: the intended module is a *future* `server/market-proxy.ts`, and this fix belongs in its `normalizePolymarket()`. Cannot be actioned today. |
| **P3** | TOCTOU balance check | 5m | [x] | [x] | [x] **Left Out** | **No TOCTOU.** `predictions.ts` reads the balance (`:45`) and deducts (`:51`) synchronously with **no `await` between**, so the event loop cannot interleave. Same false premise as 0.2. |
| **Q2** | `res.json` before `res.ok` in quant routes | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. Folded into the 1.1 codemod (client-side `QuantEngine.tsx:48`). |
| **Q3** | Silent catch with comment admitting error gap | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. Kept non-fatal (commentary is optional) but now logs — it was hiding a revoked API key or exhausted quota indefinitely. |
| **I2** | `res.json` before `res.ok` in intent routes | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. **Mis-scoped path**: `server/intents.ts` does not exist. Defect is client-side (`IntentSolver.tsx:51`); fixed by the 1.1 codemod. |
| **SW1** | `res.json` before `res.ok` in swarm routes | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. **Mis-scoped path**: `server/swarm.ts` does not exist. Defect is client-side (`SwarmCopilot.tsx:64`); fixed by the 1.1 codemod. |
| **AR1** | 6 empty catch blocks in AgentArena | 15m | [x] | [x] | [x] Implemented | `2a70bb0`. All six now log a reason. No error UI exists in this component and inventing one was out of scope — the goal was "no failure is silent". |
| **M1** | Check `res.ok` before `.json()` | 5m | [x] | [x] | [x] Implemented | `2a70bb0`. Folded into the 1.1 codemod. |
| **S1-DA** | `uncaughtException` handler doesn't exit | 5m | [x] | [x] | [x] Implemented | `29b20d1` (done with Tier 0 at the user's request; filed under Tier 1 here). Logs → `process.exit(1)`; systemd `Restart=always` brings it back clean. `unhandledRejection` still only logs (deliberate). **Note:** when Sentry lands, a bare `exit(1)` drops buffered events — see `docs/observability_retcon.md`. |

### Tier 2 — Fix This Month

| ID | Description | Effort | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|
| **2.1** | Autotrader tick stacking (inFlight guard) | 5m | [ ] | [ ] | [ ] | Depends on 0.2. Guard harmless before 0.2, essential after. |
| **2.2** | Split `metamask.ts` (1383 lines) | 3h | [ ] | [ ] | [ ] | 4 files: exec, tx, balance, connect |
| **2.3** | VaultClubs copy-paste `activeRoomId` | 2m | [ ] | [ ] | [ ] | `VaultClubs.tsx` |
| **2.4** | QuantEngine fake "Deploy to Agent" button | 5m | [ ] | [ ] | [ ] | Remove or wire up |
| **2.5** | AgentArena checkboxes not state-bound | 10m | [ ] | [ ] | [ ] | Form submits wrong data |
| **2.6** | Price seed discrepancy ($63k vs $96k) | 5m | [ ] | [ ] | [ ] | `server/prices.ts` vs `TokenMarketChart.tsx` |
| **2.7** | TS type mismatches | 10m | [ ] | [ ] | [ ] | `src/types.ts` |
| **D11** | Safety Rails uses wrong audit count | 2m | [ ] | [ ] | [ ] | `Dashboard.tsx:305` vs `:139` |
| **W3** | 5-min polling loop no AbortController | 10m | [ ] | [ ] | [ ] | `AgentWalletModal.tsx:111-125` |
| **R3** | Array index as React key | 2m | [ ] | [ ] | [ ] | `ResearchFleet.tsx` |
| **T5** | Invite token in URL query param | 15m | [ ] | [ ] | [ ] | `TradingRoom.tsx` Move to POST body |
| **A4** | No delete confirmation on agent delete | 5m | [ ] | [ ] | [ ] | `AgentWorkshop.tsx` |
| **A5** | Strategy form missing `maxDrawdown` validation | 15m | [ ] | [ ] | [ ] | `AgentWorkshop.tsx` |
| **A6** | Strategy name uniqueness not enforced | 10m | [ ] | [ ] | [ ] | `AgentWorkshop.tsx` |
| **A9** | Edit strategy modal resets on re-render | 10m | [ ] | [ ] | [ ] | `AgentWorkshop.tsx` |
| **H1** | Fake "Bot Trailing Stop" buttons, no onClick | 2m | [ ] | [ ] | [ ] | `TradingHub.tsx` |
| **H2** | Silent catch on price polling | 5m | [ ] | [ ] | [ ] | `TradingHub.tsx` |
| **C1** | TokenMarketChart fabricated random walk | 2m | [ ] | [ ] | [ ] | Label as "Simulated" or add real data |
| **C3** | No loading/error states on chart | 15m | [ ] | [ ] | [ ] | `TokenMarketChart.tsx` |
| **V2** | Array index keys on milestones | 2m | [ ] | [ ] | [ ] | `VaultClubs.tsx` |
| **G3** | GraphEvidence CSS divs are not a real graph | 2m | [ ] | [ ] | [ ] | Rename or add real graph viz |
| **Q1** | Fake deploy button (reinforces 2.4) | 2m | [ ] | [ ] | [ ] | `QuantEngine.tsx` |
| **AP1** | Autopilot handler silently returns on error | 5m | [ ] | [ ] | [ ] | `server/autopilot.ts` |
| **AP2** | Unused `user` prop | 2m | [ ] | [ ] | [ ] | `AgenticAutopilot.tsx` |
| **I1** | Multi-step is 700ms setTimeout theater | 2m | [ ] | [ ] | [ ] | `IntentSolver.tsx` |
| **SW2** | 3 array index keys in SwarmCopilot | 5m | [ ] | [ ] | [ ] | `SwarmCopilot.tsx` (Tab 15) |
| **SW3** | Unused `user` prop | 5m | [ ] | [ ] | [ ] | `SwarmCopilot.tsx` |
| **AR3** | No `.catch()` on clipboard write | 2m | [ ] | [ ] | [ ] | `AgentArena.tsx` |
| **AR4** | No AbortController on fetch effects | 15m | [ ] | [ ] | [ ] | `AgentArena.tsx` |
| **AR5** | No loading states on async operations | 20m | [ ] | [ ] | [ ] | `AgentArena.tsx` |
| **AR6** | Form controls or remove POST body | 5m | [ ] | [ ] | [ ] | `AgentArena.tsx` |
| **AR7** | No leave-league feature | 30m | [ ] | [ ] | [ ] | `AgentArena.tsx` + `server/arena.ts` |
| **M2** | Add error logging + user-visible error state | 5m | [ ] | [ ] | [ ] | `MetaedgeAnalytics.tsx` |
| **M3** | Use stable key instead of array index | 2m | [ ] | [ ] | [ ] | `MetaedgeAnalytics.tsx` |
| **M4** | Replace setInterval with recursive setTimeout | 10m | [ ] | [ ] | [ ] | `MetaedgeAnalytics.tsx` |
| **DA3** | server.ts no CORS config | 10m | [ ] | [ ] | [ ] | Add cors middleware |
| **DA5** | tradeParse.ts root cause of res.json order | 2m | [ ] | [ ] | [ ] | `tradeParse.ts:51-52` |
| **DA6** | tradeParse.ts NaN fillPx | 2m | [ ] | [ ] | [ ] | `tradeParse.ts:54` Guard with `?? 0` |
| **DA7** | types.ts missing `canonicalWallet` | 2m | [ ] | [ ] | [ ] | Add to User interface |
| **DA8** | Dead schema surface cleanup | 10m | [ ] | [ ] | [ ] | Remove or comment as planned |

### Batch Fix Patterns (run in parallel with Tier 1-2)

| ID | Pattern | Grep Command | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|
| **BP1** | `res.json()` before `res.ok` | `rg "\.json\(\)" --type ts --type tsx src/ server/` | [ ] | [ ] | [ ] | Covers 1.1, Q2, I2, S1-T15, M1, S5-DA |
| **BP2** | Array index as React key | `rg "key=\{\s*i\s*\}" --type tsx src/components/` | [ ] | [ ] | [ ] | Covers R3, V2, S2-T15, M3 |
| **BP3** | Empty/silent catch blocks | `rg "\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)" src/ server/` | [ ] | [ ] | [ ] | Covers 1.2, C2, P1, Q3, AR1, AR3 |
| **BP4** | setInterval with no cleanup | `rg "setInterval" --type ts --type tsx src/ server/` | [ ] | [ ] | [ ] | Covers W3, M4, 2.1 |
| **BP5** | `any` type usage | `rg ": any" --type ts --type tsx src/` | [ ] | [ ] | [ ] | Covers 1.4 |
| **BP6** | Unused imports sweep | `rg "import.*from" src/components/ \| rg -v "react\|useState\|useEffect\|use"` | [ ] | [ ] | [ ] | Cleanup |

### Cross-Cutting Deep Audit Items

| ID | Description | Effort | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|
| **DA1** | uncaughtException handler doesn't exit | 5m | [ ] | [ ] | [ ] | (Listed in Tier 1 above) |
| **DA2** | Cookie secret hardcoded fallback | 2m | [ ] | [ ] | [ ] | (Listed in Tier 0 above) |
| **DA3** | No CORS config | 10m | [ ] | [ ] | [ ] | (Listed in Tier 2 above) |
| **DA4** | No concurrent write lock (covered by 0.2) | — | [ ] | [ ] | [ ] | Duplicate of 0.2 |
| **DA5** | tradeParse.ts res.json root cause | 2m | [ ] | [ ] | [ ] | (Listed in Tier 2 above) |
| **DA6** | tradeParse.ts NaN fillPx | 2m | [ ] | [ ] | [ ] | (Listed in Tier 2 above) |
| **DA7** | types.ts missing canonicalWallet | 2m | [ ] | [ ] | [ ] | (Listed in Tier 2 above) |
| **DA8** | Dead schema surface | 10m | [ ] | [ ] | [ ] | (Listed in Tier 2 above) |
| SERVER-1 | Routes registered with no prefix pattern | — | [ ] | [ ] | [ ] | `server.ts:80-92` Silent shadowing risk |
| SERVER-2 | Sync readFileSync blocks event loop | — | [ ] | [ ] | [ ] | `server.ts:73,77` |
| SERVER-3 | Vite middleware failure silently swallowed | — | [ ] | [ ] | [ ] | `server.ts:107-109` |
| SERVER-4 | fs.existsSync('dist/index.html') in dev | — | [ ] | [ ] | [ ] | `server.ts:98` |

### Code Size & Decomposition (Optional — post-fix cleanup)

| ID | File | Lines | Suggested Split | Effort | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| **DECOMP-1** | `server/metamask.ts` | 1,383 | 4 files (exec, tx, balance, connect) | 3h | [ ] | [ ] | [ ] | (Covered by 2.2) |
| **DECOMP-2** | `src/components/AgentArena.tsx` | 1,215 | 5 files + useArena hook | 2h | [ ] | [ ] | [ ] | |
| **DECOMP-3** | `src/App.tsx` | 945 | Extract hooks + context, keep ~100 lines | 10h | [ ] | [ ] | [ ] | Highest impact. Kills 1,200 lines boilerplate. |
| **DECOMP-4** | `src/components/TradingHub.tsx` | 696 | 4 files + usePrices hook | 1.5h | [ ] | [ ] | [ ] | |
| **DECOMP-5** | `src/components/Dashboard.tsx` | 585 | 3 sub-components | 1h | [ ] | [ ] | [ ] | |

### Optimization Tactics (Optional — after decomposition)

| ID | Tactic | Impact | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|
| **OPT-1** | Extract `useApiFetch<T>` hook | Eliminates ~1,200 lines boilerplate, adds AbortController everywhere | [ ] | [ ] | [ ] | Code provided in section above |
| **OPT-2** | Add res.ok check in apiFetch() itself | Every caller gets consistent errors without remembering | [ ] | [ ] | [ ] | 4-line change to `src/lib/api.ts` |
| **OPT-3** | React Router or Map-based tab routing | Adding a tab = 1 file, not touching App.tsx 5 spots | [ ] | [ ] | [ ] | |
| **OPT-4** | ESLint max component size rule (400 lines) | Architectural discipline, prevents future bloat | [ ] | [ ] | [ ] | |

### Test Coverage (Optional — critical for 0.2 and 1.4)

| ID | Step | Effort | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|
| **TEST-1** | Add vitest + @testing-library/react | 10m | [ ] | [ ] | [ ] | Fastest setup for Vite project |
| **TEST-2** | Test storage.ts concurrent writes | 1h | [ ] | [ ] | [ ] | Validates item 0.2 |
| **TEST-3** | Test apiFetch error handling | 30m | [ ] | [ ] | [ ] | Validates item 1.1 root fix |
| **TEST-4** | Test tradeParse.ts edge cases | 30m | [ ] | [ ] | [ ] | Validates 1.3, S5, S6 |
| **TEST-5** | Snapshot test each tab component | 2h | [ ] | [ ] | [ ] | Catches regressions from all fix items |
| **TEST-6** | Add CI step: npm test | 10m | [ ] | [ ] | [ ] | Runs on every push |

### Research Topics (Reference — use to inform future direction)

| ID | Topic | Type | Reviewed | Decide | Status | Notes |
|---|---|---|---|---|---|---|
| **R3** | SQLite Migration Plan | Actionable — schema, adapter, migration | [ ] | [ ] | [ ] | Highest-impact infra change. Phased rollout via adapter. |
| **R4** | Gemini LLM Trading Strategies | Actionable — hooks, prompts, costs | [ ] | [ ] | [ ] | Additive to existing code. Free tier viable with cache. |
| **R5** | Live Prediction Market APIs | Actionable — Polymarket + Kalshi proxy | [ ] | [ ] | [ ] | Zero new deps. 3-tier fallback to local. |
| **R6** | Production Deployment | Actionable — Docker, CI/CD, Fly.io | [ ] | [ ] | [ ] | Wait until code fixes complete for clean build. |
| **R7** | Monitoring & Observability | Actionable — pino, Sentry, health, metrics | [ ] | [ ] | [ ] | Can be implemented incrementally alongside T1/T2. |
| **R1** | Agent-Driven Trading Landscape | Reference — platforms, safety, regulation | [ ] | [ ] | [ ] | Use when deciding real exchange integration. |
| **R2** | Production Architecture & Pipeline | Reference — deployment, data, strategies | [ ] | [ ] | [ ] | Free API list and repo refs are immediately useful. |

### Summary

Updated 2026-07-09. Commits: **`29b20d1`** (Tier 0) · **`2a70bb0`** (Tier 1). Not yet pushed.

| Category | Total Items | Reviewed | Decided | Implemented | Left Out | Remaining |
|---|---|---|---|---|---|---|
| Tier 0 | 3 | 3 | 3 | 2 | 0 | 1 (0.2 deferred) |
| Tier 1 | 26 † | 26 | 26 | 20 | 5 | 1 (1.4 deferred) |
| Tier 2 | 44 | 0 | 0 | 0 | 0 | 44 |
| Batch Patterns | 6 | 2 | 2 | 1 | 0 | 5 |
| Deep Audit | 12 | 3 | 3 | 2 ‡ | 0 | 10 |
| Code Size | 5 | 0 | 0 | 0 | 0 | 5 |
| Optimization | 4 | 0 | 0 | 0 | 0 | 4 |
| Test Coverage | 6 | 0 | 0 | 0 | 0 | 6 |
| Research | 7 | 2 | — | — | — | 5 |
| **Total** | **113 †** | **36** | **34** | **22 ‡** | **5** | **81** |

† The header claimed **27** Tier-1 items; the table contains **26** rows. Total corrected 114 → 113.
‡ DA2 and DA1/S1-DA are counted once (in Tier 0 / Tier 1) to avoid double-counting; the Deep Audit row records them for traceability only.

**Batch Patterns status:** Pattern 1 (`res.json()` before `res.ok`) is **done** — 44 sites, all of `src/`. Pattern 3 (empty/silent catch blocks) is **partial**: fixed in `AgentArena`, `PredictionMarkets`, `quant.ts`, `recorder.ts`; 8 further silent catches exist in the new `server/opportunity/*` modules, which postdate this audit. Patterns 2, 4, 5, 6 untouched.

### Session log — 2026-07-09

**Tier 0 (`29b20d1`)** — 0.1, DA2, S1-DA implemented. 0.2 deferred.
Verified by driving it, not typechecking: boot without `COOKIE_SECRET` → exit 1; with it → serves. `generateApiKey` without `SYSTEM_PEPPER` → throws. Wrong secret rejected via constant-time compare; length mismatch handled. Uncaught exception → exit 1.

**Tier 1 (`2a70bb0`)** — 20 implemented, 5 left out, 1 deferred. 24 files.
`tsc` **5 → 1 error** (the survivor, `metamask.ts:1366`, belongs to deferred 1.4). `npm run build` green. Server boots; `/api/prices`, `/api/graph`, `/api/arena/leaderboard`, `/api/research-fleet` all 200.

**Corrections this session made to the audit itself:**
1. `server/intents.ts`, `server/swarm.ts`, `server/chart.ts`, `server/predictionMarkets.ts` **do not exist** — items I2, SW1, C2, P2 were mis-scoped.
2. 1.3's `await` is **already present**; the finding is stale.
3. D12 is **already fixed**.
4. 1.2(a) is **already done** — `ErrorBoundary` is wired in `main.tsx`.
5. 0.2 and P3 rest on the **same false premise**: Node's single thread makes a synchronous read-modify-write atomic. Zero async race windows exist.
6. 0.1's fallback exists in **two** places, not one; and `secrets.ts` has **no importers**.
7. 1.1 is **44 sites / 18 files**, not "17+"; **28 already checked `res.ok`**, just after parsing.
8. R1's racing reader is a **separate process**, so 0.2's mutex was never a prerequisite. Measured: 26 torn reads / 3,555 before, 0 / 15,045 after.

**Cross-references added:** `docs/observability_retcon.md` — which handlers need `logger`/Sentry when pino lands, the Sentry-flush hazard in the new `exit(1)` paths, and the rule that shared `.mjs` modules stay logger-free (scripts have no pino instance).

**Recommended next:** 1.4's `resolveMarket` ownership check (~20m authz hole), pulled out of the 1–2d item.
