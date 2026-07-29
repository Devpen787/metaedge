# Flywheel v3 Control Budget

Machine authority: `config/research/flywheel-v3-control.json`.

| Budget | Limit | Runtime behavior |
| --- | ---: | --- |
| Runs per loop per UTC day | 24 | Pause before execution |
| Estimated model tokens per loop per UTC day | 2,000,000 | Pause before execution |
| Report-only threshold | 80% | Stop mutating research artifacts |
| Agent actions per loop per UTC day | 8 | Report-only before action |
| Declared trials per research cycle | 500 | Report-only before research |
| Attempts on identical evidence | 3 | Escalate with circuit breaker |
| Consecutive identical-evidence failures | 3 | Escalate with circuit breaker |
| Runtime per loop | 300 seconds | Record escalation and stop promotion |
| Resource-lock TTL | 30 minutes | Expired locks cease blocking |

Current scheduled frequency is one governed flywheel cycle every six hours. Individual loop cadences remain authoritative and can produce a no-op even when the scheduler wakes the process.

Token and action budgets are currently zero-spend for the deterministic v2 kernel. The future decision council must meter actual provider usage and persist model, prompt, and token accounting before it can run unattended.
