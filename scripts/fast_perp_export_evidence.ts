import path from 'node:path';
import { FastPerpResearchBridge, createFastPerpEvidenceExport } from '../server/discovery/fast_perp_research_bridge.js';

const bridgeRoot = process.env.FAST_PERP_RESEARCH_BRIDGE_ROOT
  ?? path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'research-bridge');
const bridge = new FastPerpResearchBridge(bridgeRoot);
const bundle = createFastPerpEvidenceExport();
const file = bridge.publishEvidence(bundle);
console.log(JSON.stringify({ status: 'exported', bundleId: bundle.id, file, payloadHash: bundle.payloadHash,
  expiresAt: bundle.expiresAt, liveExecution: 'locked' }));
