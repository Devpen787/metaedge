# V5 batch 10G — operator truth boundaries

Date: 2026-08-01
Status: locally implemented; not deployed
Money boundary: paper only; live execution locked

## Decision

Operational readiness and economic validity are separate state machines.
`go_local_paper_operation` means the isolated mechanics packet passed. It does
not mean an edge exists, production is authorized, or live capital can trade.

The canonical operator snapshot now reports four independent truths:

- mechanics: local paper GO or NO-GO, with reasons;
- economics: unproven, collecting organic forward evidence, or review
  candidate but still not proven;
- deployment: not authorized;
- capital: live locked.

Assurance fixtures are excluded from organic outcome and review-candidate
counts by linked record, intent, trade thesis, and fixture provenance.

## Proof

Decision tests assert that fixtures cannot improve economic status and that
the UI states “This does not prove an edge.” No deployment or live mutation was
performed.
