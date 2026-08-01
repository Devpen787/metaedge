# V5 batch 10I — zero-route diagnostics

Date: 2026-08-01
Status: locally implemented; not deployed

## Decision

Every completed decision cycle now receives a durable, content-addressed
`decision-cycle-diagnostics.v5`. The record explains outcomes by strategy,
symbol, gate category, and exact reason. It separately counts organic routes
and excluded assurance evaluations.

A zero-route cycle is classified as one of:

- `expected_no_trade`: no valid trigger or eligible regime;
- `evidence_blocked`: data, universe, liquidity, or validation was missing;
- `risk_vetoed`: cost, risk, or portfolio controls withheld the trade;
- `routing_gap`: a paper candidate existed but no intent routed;
- `unclassified`: insufficient reason evidence.

This prevents “zero trades” from being treated as one ambiguous result. A
valid stand-down is not a failure, while a routing gap is an incident.

## Fresh isolated evidence

The final ten-cycle acceptance run completed 5,040 evaluations and routed no
organic paper intents in that market window. All ten cycles were explicitly
classified `evidence_blocked`; no assurance decision entered the organic
counts. This is an explained lack of eligible evidence, not a mechanics
failure and not economic evidence.
