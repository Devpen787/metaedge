import { snapshotPredictionResolutions } from '../server/scouts.js';

try {
  const recorded = await snapshotPredictionResolutions();
  console.log(JSON.stringify({ recorded, status: 'available', mode: 'evidence collection only', liveExecution: 'locked' }));
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify({ recorded: 0, status: 'source_unavailable', reason,
    mode: 'evidence collection only', liveExecution: 'locked' }));
}
