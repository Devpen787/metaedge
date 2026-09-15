# J03 — Investigate Source

Status: **Detailed draft for human review**

## USER JOB

> Help me understand what this market/wallet/trader/strategy/agent/cohort is doing, what may explain it, what has worked historically, what could be misleading, and what I still do not know.

## PURPOSE

Investigation converts **attention** into an evidence-backed view of a source.

It is where MetaEdge separates:

1. **OBSERVED** — direct evidence;
2. **INFERRED** — MetaEdge interpretation;
3. **UNKNOWN** — material facts not established.

That separation is mandatory.

## PRECONDITIONS

- A `DiscoveryCandidate` or directly addressed source exists.
- Source identity/instrument mapping is sufficiently resolved to display safely.

## AUTHORITATIVE STATE

Candidate concepts:

- `CopySource`
- `SourceObservation`
- `SourceTrackRecord`
- `SourceCompleteness`
- `EvidenceProfile`
- `Interpretation`
- `Contradiction`
- `SourceReputationEvidence`

## USER-VISIBLE STATES

### Observed facts

Examples:

- wallet position/fill change;
- price/volume movement;
- strategy definition/version;
- verified historical outcomes;
- leverage/exposure when directly observable;
- provider timestamps.

### Inference

Examples:

- possible accumulation;
- likely momentum participation;
- possible capitulation reversal;
- suspected regime preference;
- possible catalyst relationship.

Inference must be labeled and evidence-linked.

### Unknown / incomplete

Examples:

- hidden hedge elsewhere;
- multiple wallets belonging to same trader;
- off-chain/option exposure;
- actual intent behind a trade;
- unobserved deposits/withdrawals;
- source rules that cannot be reconstructed.

### Conflicted evidence

MetaEdge should show meaningful disagreement instead of averaging it away.

Example:

- price momentum positive;
- whale flows positive;
- funding/crowding extreme negative for continuation.

### Data degraded

Some evidence is stale or unavailable.

## HAPPY PATH

1. User opens a candidate/source.
2. MetaEdge shows source identity/type and observation coverage.
3. User sees current behavior/state.
4. MetaEdge explains the evidence profile: supporting evidence, contradictions, unknowns and freshness.
5. Historical behavior is shown with mode/provenance preserved.
6. For wallets/traders, MetaEdge explains source-completeness limitations.
7. User chooses one of:
   - Follow — J04;
   - Shadow — J07;
   - create/copy strategy — J05;
   - paper copy — J10, if prerequisites/policy exist;
   - leave with no action.

## EVIDENCE LAW

Do not collapse the entire investigation into “82% confidence.”

A user may see concise summaries, but the product state should preserve separate evidence dimensions and contradictions.

## SOURCE-REPUTATION LAW

Raw PnL is insufficient.

Wallet/trader/source evaluation should eventually account for factors such as:

- drawdown;
- leverage;
- concentration;
- duration/sample length;
- realized vs unrealized PnL;
- deposits/withdrawals;
- regime dependence;
- trade independence;
- consistency;
- liquidation risk;
- whether a few trades dominate results;
- evidence integrity/timestamp provenance.

The exact methodology remains an open product/research decision.

## EMPTY STATE

A source can exist but have insufficient history/coverage to evaluate. Show:

> “Observable, but not enough evidence yet to characterize reliably.”

Do not fabricate a track record.

## FAILURE

- source lookup failure;
- corrupted/inconsistent observations;
- historical outcome service failure;
- identity collision;
- unsupported instrument mapping.

## UNKNOWN

Unknown is first-class. The journey is successful even when the honest conclusion is:

> “We cannot tell whether this wallet's visible short is an outright bearish bet or a hedge.”

## RETRY

Refresh data providers individually. Preserve previously observed evidence and timestamps.

## PARTIAL

Investigation may proceed with partial evidence if limitations are explicit and no unsafe claim is made.

## CANCEL

User can leave investigation without creating a Follow, Shadow, Copy or trading relationship.

## BACK / REFRESH / RESTART

- Back returns to Discover.
- Refresh appends/replaces current snapshots based on timestamps without rewriting past evidence.
- Restart reconstructs from durable source/evidence state.

## OWNER / AUTHORITY

- Evidence services own observations.
- Interpretation/reasoning layer owns labeled inference.
- Neither may create portfolio exposure directly.

## PRIVACY

- Public source evidence may be displayed according to provider terms.
- User-specific notes, follows, policies and interpretations remain private by default.

## RECOVERY

If interpretation fails, observed evidence should remain usable. The system should degrade to facts rather than substitute invented explanation.

## NEXT JOURNEY

- **J04 Follow Source**
- **J07 Shadow**
- **J05 Create/Copy Strategy**
- **J10 Paper Copy** when policy/preconditions exist.