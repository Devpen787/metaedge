import { runOpportunityFactory } from '../server/discovery/runtime.js';

const result = await runOpportunityFactory();
console.log(JSON.stringify(result, null, 2));
if (result.status === 'failed') process.exitCode = 1;
