import { runDecisionCycle } from '../server/decision/runtime.js';

const summary = await runDecisionCycle();
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.error ? 1 : 0);

