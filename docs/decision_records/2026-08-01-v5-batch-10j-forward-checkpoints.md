# V5 batch 10J — durable forward checkpoints and incidents

Date: 2026-08-01
Status: locally implemented; not deployed

## Decision

Each distinct decision cycle now creates one bounded, content-addressed
`forward-operation-checkpoint.v5`. It records organic routes, the consecutive
zero-route count, the explanatory classification, and linked incidents.

Incident rules are explicit:

- cycle error: critical;
- evidence pipeline blocked: attention;
- candidate-to-route gap: critical;
- stale required clock at the completed operation sample: critical;
- unresolved order beyond SLA: critical.

Clock and order incidents are reconciled only after broker, portfolio,
outcome, and risk clocks complete. This avoids falsely reporting every cycle
as stale during the normal interval between the decision writer and the other
workers.

## Fresh isolated evidence

The final acceptance database contains ten diagnostics and ten checkpoints.
The only checkpoint incidents were ten correctly linked
`EVIDENCE_PIPELINE_BLOCKED` attention incidents; no false clock incident was
recorded during the decision-to-worker handoff.
