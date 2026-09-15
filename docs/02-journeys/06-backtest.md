# J06 — Backtest

Status: **Detailed draft for human review**

## USER JOB

Show how this exact Strategy Version behaved historically, with assumptions and costs explicit, without pretending a backtest proves future edge.

## PURPOSE

Backtesting generates evidence; it does not certify a strategy.

Every result must preserve the strategy version, dataset period/universe, execution assumptions, costs, warnings and benchmark/control used.

## AUTHORITATIVE STATE

Candidate concepts: `BacktestRun`, `BacktestConfig`, `BacktestDatasetRef`, `BacktestExecutionModel`, `BacktestResult`, `BacktestWarning`, `BenchmarkResult`.

## HAPPY PATH

1. User selects an immutable Strategy Version and historical scope.
2. MetaEdge shows material assumptions: fees, spread/slippage, fill timing, liquidity/participation, data resolution and benchmark/control.
3. Run executes deterministically.
4. Results show return/PnL, drawdown, exposure/utilization, turnover/costs, outcome distribution, time/regime segmentation and benchmark/no-trade comparisons where applicable.
5. Results remain one evidence source alongside forward shadow/paper evidence.

## ANTI-OVERFIT LAW

Historical optimization does not promote a strategy to “trusted.” Where appropriate MetaEdge should support untouched evaluation windows, out-of-sample/walk-forward checks, parameter sensitivity, cost stress and multiple-testing warnings.

## ANTI-PARALYSIS LAW

A weak or inconclusive backtest is different from an invalid backtest. A weak result may still justify a small forward paper experiment if mechanics are valid and exploration policy permits it. Invalid results cannot be treated as evidence.

## FAILURE / INVALID

Examples include missing critical history, lookahead/data leakage, impossible fill assumptions, unavailable-at-the-time information, unsupported features or corrupted data.

## RETRY / VERSIONING

Changed configuration creates a new Backtest Run. Historical assumptions/results are never overwritten.

## BACK / REFRESH / RESTART

Runs are durable jobs. UI refresh does not restart them or change their identity.

## OWNER / AUTHORITY

Strategy Version defines logic. Backtest domain owns historical simulation and results. Backtests have no execution authority.

## NEXT JOURNEY

J07 Shadow, J08 Paper Portfolio, J09 Paper Trade or J13 Improve/Pause/Retire.
