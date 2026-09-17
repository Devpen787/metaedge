# P4 Proposal — Market Analysis, Pattern Recognition & Human Feedback

Status: **P4 PROPOSAL — not approved product authority**

Updated: 2026-09-17

## Why this proposal exists

The approved MetaEdge wedge puts wallet-capable trading agents at the center of operation, but human-in-the-loop supervision still requires more than status cards and post-hoc explanations.

The operator must be able to see enough of the market context to:

- understand what the agent is seeing;
- challenge a thesis;
- inspect patterns/levels/regime/evidence;
- understand why the agent acted or stayed flat;
- provide relevant feedback or additional context;
- decide whether intervention is warranted;
- learn whether the agent's market interpretation deserves trust.

This must not turn the operator back into the manual execution loop.

## Recommended P4 change

Do **not** create a disconnected generic "Charts" or "Market Analysis" product.

Instead, broaden the current candidate `ME-J03 — Understand a Material Agent Decision` into a first-class journey tentatively named:

> **ME-J03 — Understand the Market & Agent Thesis**

The journey should support both **pull** and **push** entry.

### Pull entry — operator initiated

Examples:

- "What is happening in BTC right now?"
- "Why is my agent still flat?"
- "What pattern is the agent seeing on ETH?"
- "What changed since I last checked?"
- "Why is this position still open?"

### Push entry — agent initiated

Examples:

- material opportunity detected;
- trade opened/reduced/exited/reversed;
- thesis materially changed;
- unusual risk surfaced;
- agent deliberately abstained from a meaningful opportunity;
- data/source degradation affects interpretation.

## Operator job

> **"Show me what is happening in the market, what my agent thinks it means, what supports or contradicts that view, and what I may need to do about it."**

## Journey shape

```text
enter from market / agent / position / alert / review
→ orient to current market state
→ inspect price/chart context
→ inspect agent-detected patterns / levels / regime / notable changes
→ inspect relevant supporting + conflicting evidence
→ inspect current position/exposure if any
→ understand agent thesis / invalidation / uncertainty
→ understand what the agent did, did not do, or plans to monitor
→ optionally provide feedback / context / challenge
→ return to supervision
   OR intervene
   OR mark for review
   OR later change agent/mandate/configuration
```

## What the operator should be able to inspect

Exact screen design belongs later, but the journey should eventually support context such as:

- price chart across useful timeframes;
- important price levels / support / resistance where relevant;
- detected patterns or structures;
- momentum / volatility / volume context;
- liquidity / order-flow context when available;
- derivatives/funding/open-interest context when relevant;
- wallet/trader/on-chain activity;
- catalyst/news/narrative context;
- current agent position and trade history markers;
- where the agent entered, added, reduced or exited;
- thesis, invalidation and what is currently unknown;
- contradicting evidence;
- what the agent is watching next.

No specific indicator/pattern family is a platform law. Different agents/strategies may use different evidence.

## Pattern recognition principle — candidate

A detected pattern should not be shown as an unexplained label such as:

> `Bull flag detected — 87% confidence`

The operator should be able to inspect the market context that caused the agent to treat the pattern as relevant.

Where practical, the product should visually ground interpretations in their source context, for example:

- highlighted price structure;
- marked levels;
- timeframe;
- relevant volume/flow change;
- source event markers;
- entry/invalidation regions.

This does not mean every agent decision must be explainable through a chart alone.

## Human feedback principle — candidate

Feedback should improve supervision without converting every action into an approval workflow.

Potential feedback classes to explore later:

- **context** — operator provides information the agent may not have considered;
- **challenge** — operator flags a concern with the interpretation;
- **preference** — operator indicates what deserves more/less attention;
- **constraint** — operator deliberately changes future mandate/guardrails;
- **review label** — operator marks a decision for later competence review.

Important distinction:

> ordinary feedback is not automatically financial authority.

If feedback changes mandate, risk, allowed markets or authority, it must go through the explicit operator control/evolution path rather than silently rewriting agent behavior.

## Relationship to other candidate journeys

### ME-J02 — Supervise Running Agents

ME-J02 stays concise and operational:

> "Is everything healthy? What is my exposure? Does anything deserve attention?"

From there the operator drills into ME-J03 when they want market/thesis depth.

### ME-J04 — Intervene / Take Control

ME-J03 helps the operator understand before intervening. If the operator changes authority, risk or agent state, the flow moves into ME-J04.

### ME-J05 — Review Agent Competence

ME-J03 focuses on **what is happening / what the agent thinks now**.

ME-J05 focuses on **whether the decision process was competent after enough outcome/evidence exists**.

The same chart/evidence context may support both, but the jobs differ.

## Important product distinction

MetaEdge should not force a choice between:

```text
BLACK-BOX AGENT
agent operates, human sees almost nothing
```

and:

```text
MANUAL TRADING TERMINAL
human has to analyze and approve everything
```

The intended model is:

```text
AGENT DOES THE HEAVY LIFTING
        ↓
HUMAN CAN INSPECT MARKET + THESIS ON DEMAND
        ↓
HUMAN CHALLENGES / FEEDS BACK / INTERVENES WHEN USEFUL
        ↓
AGENT CONTINUES OPERATING INSIDE ITS AUTHORITY
```

## Candidate P5 UX laws implied by this proposal

These are **not yet approved**, but P4 should preserve the need for them:

1. **Every material agent decision should be inspectable in market context.**
2. **Summary first, evidence on demand.**
3. **Charts should explain agent interpretation, not exist as decorative trading-terminal chrome.**
4. **Observed facts, agent interpretation and unknowns must remain distinguishable.**
5. **Human feedback should be possible without making normal agent action approval-dependent.**
6. **Feedback that changes authority/guardrails must be explicit and durable.**
7. **The operator should be able to understand why the agent acted and why it stayed flat.**

## P4 question

Should `ME-J03` be broadened from:

> **Understand a Material Agent Decision**

to:

> **Understand the Market & Agent Thesis**

with market/chart/pattern analysis available both on operator demand and when a material agent event pulls the operator in?

Recommendation: **yes**.
