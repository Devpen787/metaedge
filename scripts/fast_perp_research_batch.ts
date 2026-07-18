import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { FastPerpResearchBridge } from '../server/discovery/fast_perp_research_bridge.js';
import { FAST_PERP_RESEARCH_BATCH } from '../server/discovery/fast_perp_scheduler.js';

const execute = promisify(execFile); const evidenceFile = process.argv[2];
if (!evidenceFile) throw new Error('FAST_PERP_EVIDENCE_BUNDLE_PATH_REQUIRED');
const bridgeRoot = process.env.FAST_PERP_RESEARCH_BRIDGE_ROOT
  ?? path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'research-bridge');
const bridge = new FastPerpResearchBridge(bridgeRoot); const evidence = bridge.readEvidenceMetadata(evidenceFile);
const attempt = bridge.beginAttempt(evidence.id, Date.now(), FAST_PERP_RESEARCH_BATCH.timeoutMs);
try {
  const tsx = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  const { stdout } = await execute(tsx, ['scripts/fast_perp_research_worker.ts', evidenceFile], {
    cwd: process.cwd(), env: process.env, timeout: FAST_PERP_RESEARCH_BATCH.timeoutMs, maxBuffer: 10 * 1024 * 1024,
  });
  const line = stdout.trim().split('\n').at(-1) ?? '{}';
  const result = JSON.parse(line) as { proposalId: string; candidateFile: string; [key: string]: unknown };
  const proposal = bridge.readProposal(result.candidateFile);
  if (proposal.id !== result.proposalId) throw new Error('RESEARCH_CANDIDATE_ID_MISMATCH');
  bridge.finishAttempt(attempt.id, 'completed', { proposalId: result.proposalId });
  const file = bridge.publishProposal(proposal);
  console.log(JSON.stringify({ attemptId: attempt.id, ...result, file, status: 'proposed', liveExecution: 'locked' }));
} catch (error) {
  const timedOut = Boolean((error as { killed?: boolean }).killed) || (error as { code?: string }).code === 'ETIMEDOUT';
  bridge.finishAttempt(attempt.id, timedOut ? 'timed_out' : 'failed', {
    failureReason: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
