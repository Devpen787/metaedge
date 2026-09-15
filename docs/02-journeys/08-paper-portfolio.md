# J08 — Paper Portfolio

Status: **Detailed draft for human review**

## USER JOB

Create a paper portfolio with explicit simulated capital and limits so multiple strategies and agents can test ideas coherently.

## CORE RULES

- Strategies and agents propose desired exposure; the portfolio resolves account-level exposure.
- Weak evidence may map to a small paper scout rather than automatic inactivity.
- Objective integrity/account-limit failures may block.
- Exact sizing defaults are not frozen yet.
- If simulated position/order truth is unknown, reconcile before adding new exposure.

## AUTHORITATIVE STATE

Candidate concepts: `PaperPortfolio`, `PortfolioPolicy`, `ExplorationBudget`, `PortfolioTarget`, `PortfolioSnapshot`, `PolicyDecision`.

## HAPPY PATH

1. User creates or accepts a starter paper portfolio.
2. MetaEdge explains capital, allowed instruments, account limits and exploration capacity.
3. Strategies/sources/agents emit desired exposures.
4. Portfolio authority combines them with current paper positions.
5. Policy checks clip or reject only where objective limits require it.
6. Paper execution moves toward the permitted target.

## EXPLORATION

The portfolio must reserve a bounded path for weak-but-valid ideas to be tested at small size. Observation/shadow, scout, standard paper allocation and larger evidence-supported allocation are distinct states. Numeric defaults remain open.

## FAILURE / RECOVERY

If portfolio accounting is inconsistent or execution state is unresolved, new paper exposure pauses until reconciliation restores a coherent state. Restart recovers policy, reconciles fills/positions and rebuilds the account snapshot before resuming.

## OWNER / AUTHORITY

User owns policy changes. Portfolio owns aggregate target. Policy/risk owns hard limits. Paper execution owns simulated mutation. Strategies and agents only propose views.

## NEXT JOURNEY

J09 Paper Trade, J10 Paper Copy, J11 Manage Position, J14 Paper Agent Operation.
