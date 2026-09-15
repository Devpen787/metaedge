# J09 — Paper Trade

Status: **Detailed draft for human review**

## USER JOB

> Let me or an approved strategy/agent take a realistic, bounded paper position from a current view and then manage it as evidence changes.

## PURPOSE

Paper Trade is where MetaEdge deliberately turns a view into simulated financial state.

It must remain realistic enough to teach useful behavior while remaining categorically unable to create real execution authority.

## PRECONDITIONS

- `PaperPortfolio` exists with declared capital/risk/exploration policy.
- Current market observation is valid for the proposed instrument.
- Proposal/view has traceable source/strategy/user lineage.
- No hard blocker prevents paper experimentation.

## AUTHORITATIVE STATE

Candidate concepts:

- `View`
- `PortfolioTarget`
- `RiskDecision`
- `PaperOrderIntent`
- `PaperOrderEvent`
- `PaperFill`
- `PaperPosition`
- `PaperPnL`
- `EvidenceProfile`
- `TradeThesis`

Existing V5 intent/broker concepts are high-value migration candidates, not automatically final schemas.

## USER-VISIBLE STATES

Proposal states:

- view produced
- target proposed
- target resized by portfolio/risk
- hard blocked

Order states should include at minimum:

- pending
- risk accepted
- broker pending
- partially filled
- executed
- rejected
- expired
- unresolved

Position states:

- flat
- opening
- open
- scaling
- reducing
- closing
- closed

## HAPPY PATH

1. A manual user action, strategy, source or Paper Agent produces a `View` with desired exposure.
2. Portfolio authority combines it with existing views/exposure.
3. Risk checks hard constraints and may clip target size.
4. If target differs meaningfully from current exposure, MetaEdge creates a durable `PaperOrderIntent`.
5. Paper broker waits for the declared fill condition (e.g. next observation), applies modeled fees/spread/slippage/liquidity, and records fills.
6. Paper position/PnL update from canonical fills.
7. Evidence loops continue running.
8. Subsequent desired exposure changes go through J11 Position Management.
9. Outcome enters J12 Review and Learn.

## ANTI-PARALYSIS LAW

Do **not** require an arbitrary global confidence number before any paper intent can exist.

If:

- market data is valid;
- instrument is eligible;
- portfolio exploration risk is available;
- proposal is structurally valid;
- no hard blocker exists;

then weak evidence may map to a small scout target rather than zero by default.

Zero exposure must have an attributable reason.

## HARD BLOCKERS VS SIZING INPUTS

### Examples of hard blockers

- invalid/stale market data beyond policy;
- instrument not supported by paper broker;
- portfolio risk budget exhausted;
- duplicate/replay intent;
- unresolved canonical paper operation where another would corrupt state;
- impossible/invalid order parameters;
- explicit user/portfolio restriction.

### Examples that normally affect size/view rather than hard-block

- incomplete thesis evidence;
- moderate contradiction between signals;
- young strategy/source track record;
- uncertain catalyst causality;
- regime ambiguity.

## EMPTY STATE

No non-zero target exists. Explain whether:

- no strategy/source currently wants exposure;
- target netted to zero across conflicting views;
- all eligible opportunities are intentionally shadow-only;
- a hard blocker exists.

## FAILURE

- broker evaluation error;
- database write failure;
- market observation unavailable during pending intent;
- risk engine internal failure.

Fail closed on state integrity, but distinguish operational failure from valid `no trade`.

## UNKNOWN

Paper broker may model unresolved state if it cannot establish whether a fill should have committed. Unknown is not silently converted to failed/retry.

## RETRY

Intent idempotency/nonce must prevent duplicate financial effects.

## PARTIAL

Partial fills are first-class and update remaining target/position state.

## CANCEL

Pending paper orders may be cancelled when order semantics permit. Cancellation is recorded; partial fills remain real within the paper ledger.

## BACK / REFRESH / RESTART

UI navigation never cancels trading state implicitly. Restart reconciles durable intents/fills before new autonomous intents are admitted.

## OWNER / AUTHORITY

- Source/strategy/user: proposes view.
- Portfolio authority: determines aggregate target.
- Risk: clips/blocks within policy.
- Paper execution authority: creates/executes paper intent.
- No component here has Real authority.

## PRIVACY

Paper portfolios and strategies are private unless user explicitly shares/enters a public competition.

## RECOVERY

On restart:

1. inspect non-terminal intents;
2. reconcile fills/events;
3. mark unknown where truth cannot be established;
4. only then resume autonomous paper operation.

## NEXT JOURNEY

- J11 Manage Position
- J12 Review and Learn
- J13 Improve/Pause/Retire.