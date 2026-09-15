# J14 — Paper Agent Operation

Status: **Detailed draft for human review**

## USER JOB

> Let this agent operate autonomously in paper mode within limits I already approved, without asking me every tick and without giving it authority to bypass portfolio/risk/execution controls.

## PURPOSE

This journey makes MetaEdge genuinely agentic while directly preventing the historical failure where agents were paralyzed by their own rules.

A Paper Agent is a **proposal/position-management seat inside an approved paper envelope**.

It is not its own broker, portfolio authority, or real wallet authority.

## PRECONDITIONS

- Agent definition/version exists.
- Paper Portfolio exists.
- User explicitly launches a Paper Agent session.
- Session specifies:
   - allowed instruments/universe;
   - capital/risk/exploration budget;
   - operation mode;
   - strategy/source permissions;
   - cadence/event triggers;
   - stop conditions.
- Runtime can enforce the envelope deterministically.

## AUTHORITATIVE STATE

Candidate concepts:

- `AgentDefinition`
- `AgentSession`
- `AgentEnvelope`
- `AgentObservation`
- `AgentView`
- `AgentDecisionRecord`
- `AgentLesson`
- `PortfolioTarget`
- `RiskDecision`

## USER-VISIBLE STATES

- configured
- dry-run / observer
- running
- quiet / no material change
- proposed scout
- managing position
- runtime-blocked (with reason)
- degraded evidence
- paused
- stopped
- failed/recovery required

## LAUNCH AUTHORIZATION LAW

When the user launches an autonomous Paper Agent with a declared envelope, that launch is the authorization for unattended **paper proposals/actions within that envelope**.

The agent must not ask every tick:

> “May I take this in-limit paper action?”

because nobody may be present to answer and the market does not wait.

The runtime—not the LLM—enforces what the session is allowed to do.

A runtime rejection is a real boundary. The agent may resize/change tack/stop; it may not repeatedly resend the forbidden action.

## ANTI-PARALYSIS LAW

Do not give the agent a generic policy:

> “When in doubt, hold.”

Instead:

1. Is there a hard blocker?
   - yes → target/action blocked;
2. Is evidence weak/ambiguous but structurally valid?
   - consider shadow/scout/smaller target according to strategy/exploration policy;
3. Is the best target genuinely zero?
   - record the evidence/reason and counterfactual eligibility.

The agent's job is to seek/interpret opportunity. Risk's job is to bound it.

## SENSE / REASON / ACT LOOP

An Agent Session can receive asynchronous evidence events and/or periodic clocks.

Conceptual cycle:

1. **Sense** — receive pre-computed observations/current portfolio state.
2. **Understand** — identify what changed and relevant contradictions/unknowns.
3. **Form thesis/update thesis**.
4. **Propose target exposure**.
5. **Portfolio** combines agent view with other views.
6. **Risk** validates/clips.
7. **Paper execution** moves toward target if needed.
8. **Reconcile** fills/positions.
9. **Journal decision facts/evidence/action**.
10. **Learn** later from outcomes.

LLM reasoning may participate in steps 2–4 but canonical state does not live in model context.

## PARALLELISM LAW

Many Paper Agents/strategies/sources may run concurrently.

They may not independently assume their virtual sleeve equals total account risk.

One account-level portfolio authority sees all exposure.

## HAPPY PATH

1. User configures and launches agent in Paper mode.
2. Agent starts from canonical state/evidence.
3. A meaningful event/tick occurs.
4. Agent emits view/target with evidence references.
5. Portfolio/risk returns permitted aggregate target.
6. Paper execution acts without per-tick human approval.
7. Agent observes resulting position next cycle and manages it continuously.
8. User can inspect concise decision record, evidence, target changes, runtime refusals and outcomes.
9. Session continues until user/policy stops it.

## QUIET TICK / NO ACTION

A quiet cycle is valid when nothing materially changes.

Do not manufacture trades to satisfy an activity quota.

But track systematic under-participation separately through eligible missed opportunities.

## HARD BLOCK / RUNTIME REFUSAL

Examples:

- session asset not allowed;
- paper portfolio risk exhausted;
- stale critical data;
- invalid target;
- unresolved execution truth;
- requested exposure outside envelope.

Record refusal as structured state. Do not teach the agent that every refusal means the market thesis was wrong.

## FAILURE

- model/reasoning unavailable;
- provider failure;
- session state corrupted;
- portfolio/risk unavailable;
- execution/reconciliation failure.

If reasoning fails, no invented fallback trade is allowed. If mechanical state is unsafe/unknown, stop new exposure until recovered.

## UNKNOWN

Agent may state uncertainty as evidence. Unknown does not automatically equal zero exposure; the approved strategy/exploration policy determines whether uncertainty maps to shadow, scout, hold, reduction or block.

## RETRY

Tool/execution retries must follow idempotency/state rules. Reasoning can retry/reformulate; financial mutation cannot duplicate.

## PARTIAL

Agent can observe partially filled positions and update views from actual reconciled exposure.

## CANCEL / PAUSE / STOP

Human can pause/stop a session at any time.

Stopping proposal generation does not magically close positions. The user/session policy must define whether stop means:

- freeze current exposure;
- reduce to zero through portfolio/execution;
- hand position to manual/another approved manager.

## BACK / REFRESH / RESTART

Agent session continues independently of UI navigation.

On process restart:

1. recover session definition/envelope;
2. reconcile paper execution/positions;
3. restore compact durable decision state/learnings;
4. refresh evidence;
5. resume only if session was running and recovery is clean.

## OWNER / AUTHORITY

- Agent owns reasoning/view generation inside session scope.
- Portfolio owns aggregate target.
- Risk owns enforceable limits.
- Paper execution owns simulated mutation.
- Human owns session start/pause/stop and policy changes.
- Agent has **no Real authority** in this journey.

## PRIVACY

Agent journals should record decision facts, evidence, tool/action summaries and lessons. Do not make private model chain-of-thought a required durable artifact.

## RECOVERY

Every session restart must distinguish:

- durable strategy/session state;
- market/execution facts;
- model-generated interpretation;
- cross-session lessons.

Do not rely on conversation context to restore authority.

## NEXT JOURNEY

- J11 Manage Position (continuously)
- J12 Review and Learn
- J13 Improve/Pause/Retire
- future Level-3 Supervised Real only through a separately approved real-authority journey.