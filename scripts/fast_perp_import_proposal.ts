import path from 'node:path';
import { FastPerpResearchBridge } from '../server/discovery/fast_perp_research_bridge.js';

const proposalId = process.argv[2];
if (!proposalId) throw new Error('FAST_PERP_PROPOSAL_ID_REQUIRED');
if (process.env.LIVE_EXECUTION_ENABLED === 'true') throw new Error('RESEARCH_IMPORT_REQUIRES_LIVE_LOCK');
const bridgeRoot = process.env.FAST_PERP_RESEARCH_BRIDGE_ROOT
  ?? path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'research-bridge');
const result = new FastPerpResearchBridge(bridgeRoot).importProposal(proposalId);
console.log(JSON.stringify({ ...result, liveExecution: 'locked' }));
