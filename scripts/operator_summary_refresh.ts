import { materializeV5OperatorSnapshot } from '../server/discovery/operator_snapshot.js';

// This process writes only the canonical V5 operator envelope. The underlying
// opportunity-factory-v3 ledgers remain readable historical evidence and are
// not maintained or mutated by the default V5 runtime.
const snapshot = materializeV5OperatorSnapshot({ now: Date.now() });

console.log(JSON.stringify({
  authorityVersion: snapshot.authorityVersion,
  schema: snapshot.schema,
  generatedAt: snapshot.generatedAt,
  operationStatus: snapshot.verdict.operationStatus,
  legacyComponentsReadOnly: snapshot.legacyComponentsReadOnly,
  liveExecution: snapshot.liveExecution,
}));
