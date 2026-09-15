# Journey Specification Template

Status: **P7 TEMPLATE — use only after P1–P6 establish the product frame**

## Metadata

- Journey ID:
- Journey name:
- Status: `DRAFT | PRODUCT_REVIEW | UX_BREAKER | APPROVED | GOLDEN`
- Primary user job:
- Related jobs:
- Entry points:
- Previous journeys:
- Next journeys:
- Commitment/mode: `observe | follow | shadow | paper | future real`

## 1. User situation

Describe the user's context in plain language.

- What just happened?
- Why did they come here?
- What do they already know?
- What are they likely unsure about?
- What emotional/attention pressure might exist without turning this into a psychology diagnosis?

## 2. One primary decision

Complete:

> **This journey helps the user decide ________.**

If the answer requires several unrelated decisions, the journey may need to be split.

## 3. User promise

What should the user be able to understand or accomplish by the end?

## 4. Entry state

What must already be true from the user's point of view?

Do not use backend object names unless they are themselves user concepts.

## 5. Step-by-step experience

For each step specify:

### Step N — [user-language name]

**User sees**

What is visibly present?

**User understands**

What should be clear without explanation from a developer?

**Primary action**

What is the main next action?

**Secondary actions**

What optional actions exist?

**Trust cues**

What proves freshness, provenance, uncertainty, paper/real mode or agent authority where relevant?

**What changes next**

What visible state changes after the action?

## 6. Branches

Describe meaningful user choices and where each goes.

```text
Choice A → ...
Choice B → ...
Choice C → ...
```

Do not hide a major product path in a footnote.

## 7. Required user-visible states

### Loading

What can the user understand while data is arriving?

### Empty

What does “nothing here” mean and what can the user do next?

### Partial / incomplete

How is missing source/evidence coverage explained?

### Unknown

How does MetaEdge communicate that it genuinely does not know something?

### Error

What failed and what remains safe/unchanged?

### Offline / unavailable provider

What remains usable?

### Pending

What is waiting, who/what owns the next step, and should the user act?

### Recovery

What happens after refresh, restart or returning later?

## 8. Back / refresh / restart

Explicitly define:

- Browser/app back behavior.
- Manual refresh behavior.
- Session restart behavior.
- What context persists.
- What must be revalidated.

## 9. Agent behavior

If an agent participates:

- What is it allowed to do here?
- What must it explain?
- What requires user approval?
- What can happen unattended?
- What happens when it is paused/stopped?

Do not let a prompt be the source of financial authority.

## 10. Paper / real clarity

If relevant, describe how the user unmistakably knows the mode and commitment level.

## 11. Privacy / identity

What personal/wallet/source information is displayed, retained or shared?

## 12. What we deliberately hide

What technical complexity should exist behind the experience but not become a primary UX concept?

## 13. Open design questions

Only unresolved product/UX questions. Technical implementation questions belong in the later derivation phase.

## 14. Breaker checklist

Review against `UX_LAWS_AND_DESIGN_PRINCIPLES.md`.

At minimum:

- Is the primary decision obvious?
- Can the user tell why they are here?
- Is fact/inference/unknown clear?
- Is the commitment level clear?
- Is paper/real unmistakable?
- Is there a dead end?
- Can the user recover after interruption?
- Could nothing happen without the user understanding why?
- Does an agent have accidental authority?
- Did a technical object leak into the UX without user benefit?
- Are adjacent journeys connected?

## 15. Golden criteria

A journey may become Golden only when:

- human product review is approved;
- breaker findings are resolved or explicitly accepted;
- adjacent journeys exist and connect;
- all material user-visible states are specified;
- no critical open design question remains;
- terminology is consistent with other Golden journeys.
