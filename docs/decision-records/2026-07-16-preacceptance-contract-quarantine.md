# Pre-acceptance contract quarantine

- Recorded: 2026-07-16
- Reason: `RECOVERY_PREACCEPTANCE_NONCANDIDATE_CONTRACTS`
- Status: historical diagnostic evidence only; excluded from active lifecycle state

The staged challenger run correctly left live execution locked, but persisted insufficient and declined evaluations as research-candidate contracts. This inflated the operator contract count even though none could enter shadow paper. The staged run therefore does not count toward acceptance.

Quarantined hashes:

- `paper-trade-contracts.jsonl`: `e676b880ce7dbfeff87ec4e4990f3d2b58791a5b2ad0c4ca45b5bec5d9d34a2f`
- `strategy-versions.jsonl`: `1ae314c66043c52e540bb2da324b0c4915d62a03f038a65efba27c46231bcea5`
- `research-runs.jsonl`: `4b3d07ca2832bff2d98d89a51b057a1f45a8681c0d2e7e87f03c56301a8181c1`

The active store is rebuilt from the retained post-cutover raw evidence after changing the contract boundary: only `shadow_candidate` evaluations may create a `PaperTradeContract`. Insufficient and declined evaluations remain in research summaries.
