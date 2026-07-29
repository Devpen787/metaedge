import fs from 'node:fs';
import path from 'node:path';
import { FastPerpResearchBridge, executeFastPerpResearchBatch } from '../server/discovery/fast_perp_research_bridge.js';

const evidenceFile = process.argv[2];
if (!evidenceFile) throw new Error('FAST_PERP_EVIDENCE_BUNDLE_PATH_REQUIRED');
const bridgeRoot = process.env.FAST_PERP_RESEARCH_BRIDGE_ROOT
  ?? path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'research-bridge');
const workRoot = process.env.FAST_PERP_RESEARCH_WORK_ROOT
  ?? path.join(process.cwd(), 'output', 'working_memory', 'fast-perp-research-batches');
const bridge = new FastPerpResearchBridge(bridgeRoot); const evidence = bridge.readEvidence(evidenceFile);
const proposal = executeFastPerpResearchBatch(evidence, workRoot, Date.now());
const candidateRoot = path.join(workRoot, 'private-candidates'); fs.mkdirSync(candidateRoot, { recursive: true });
const file = path.join(candidateRoot, `${proposal.id}.json`); const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, JSON.stringify(proposal)); fs.renameSync(temporary, file);
console.log(JSON.stringify({ status: 'candidate_ready', proposalId: proposal.id, candidateFile: file, runId: proposal.payload.run.id,
  contracts: proposal.payload.contracts.length, lifecycleEvents: proposal.payload.lifecycleEvents.length,
  liveExecution: 'locked' }));
