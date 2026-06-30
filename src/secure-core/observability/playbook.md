# Observability Playbook

## 1. Monitoring & Alerts
- **Alert:** High mismatched evidence rate.
  - **Runbook:** Verify ingestion mapping logic. Check identity binding.
- **Alert:** Duplicate `requestId` spikes.
  - **Runbook:** Client-side retry loops. Network latency issues.

## 2. Dispute Workflows
1. **Trigger:** `PAYER` submits evidence, but `RECEIVER` denies receipt.
2. **Action:** Organizer role inspects immutable audit log.
3. **Resolution:** Extract payload hashes and verify on-chain or external provider. Manually apply override if matched, emitting `OVERRIDE_EVIDENCE` audit event.

## 3. Rollback & Incident Response
- All changes are hash-chained in the audit log.
- To rollback: Do not delete data. Create compensating commands (e.g. `REVERSE_TRANSITION`) linked to the original `requestId` to maintain the append-only ledger integrity.

## 4. Public Claims Boundaries
- **DO NOT** claim "100% final everywhere."
- **DO** state: "System holds verified intent signatures up to observed block height."
