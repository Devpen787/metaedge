# ADR-030 — Product/UX-First Relaunch Sequence

Status: `DECIDED`

Date: 2026-09-15

## Context

The relaunch produced valuable repository archaeology, platform research, domain models, security contracts and technical stress tests before the user experience had been fully made concrete.

This created a sequencing risk: technical abstractions could begin dictating screens, journeys and product scope before those had been validated from the user's point of view.

The ChopDot relaunch provides a better operating precedent: lock the wedge, map the user experience, define UX laws and journeys, break/review them, make approved journeys Golden, then derive implementation architecture.

## Decision

MetaEdge will use a product/UX-first sequence:

```text
Wedge
→ User/JTBD
→ Master Experience Loop
→ Journey Registry
→ UX Laws / Design Principles
→ Information Architecture
→ Detailed Journeys
→ UX Breaker
→ Golden Journeys
→ Technical Derivation
→ Legacy Migration
→ Build / QA
```

Existing J01–J14 journey material is reclassified as `INVENTORY` until rewritten/reviewed under this process.

Existing domain/state/security/aggregation/replay/migration artifacts are preserved but treated as **technical hypotheses / constraints** until the relevant Golden journeys reach technical derivation.

## Consequences

- No application implementation is authorized.
- Contract Replay 02 and further architecture freeze work are paused.
- Old UI structure has no authority.
- Technical object names do not automatically become user-facing concepts.
- Product/UX artifacts gain higher authority than later technical derivations.
- Technical work must trace back to Golden user journeys.
- The active phase is P1: V1 Wedge + Primary User.

## Non-decision

This does not reject prior research or architecture work. It changes its authority and timing.

MetaMask research, external-system research, failure lessons, security requirements and implementation archaeology remain valuable evidence for later phases and for feasibility checks during UX work.
