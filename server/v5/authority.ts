import crypto from 'node:crypto';
import { readDatabase, writeDatabase } from '../storage.js';

export const METAEDGE_AUTHORITY_VERSION = 5 as const;
export const METAEDGE_AUTHORITY_SCHEMA = 'metaedge-authority.v5' as const;

export type V5ArtifactState = 'active' | 'shadow' | 'disabled';
export type V5ArtifactKind =
  | 'strategy'
  | 'policy'
  | 'feature'
  | 'card'
  | 'agent'
  | 'store'
  | 'writer'
  | 'operator';

export interface ActiveArtifactV5 {
  authorityVersion: 5;
  schema: `${string}.v5`;
  id: string;
  kind: V5ArtifactKind;
  state: V5ArtifactState;
  writer: boolean;
  semanticVersion?: string;
}

export interface LegacyArtifactAdapterV5<T> {
  authorityVersion: 5;
  schema: 'legacy-artifact-adapter.v5';
  legacyPreV5: true;
  readOnly: true;
  routable: false;
  originalVersion: string;
  artifact: Readonly<T>;
}

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function bool(environment: Record<string, string | undefined>, name: string, fallback: boolean): boolean {
  const value = environment[name];
  if (value == null) return fallback;
  return value === 'true';
}

export function v5AuthorityFlags(environment: Record<string, string | undefined> = process.env) {
  return {
    shadowEnabled: bool(environment, 'V5_SHADOW_ENABLED', true),
    decisionWriterEnabled: bool(environment, 'V5_DECISION_WRITER_ENABLED', true),
    paperIntentsEnabled: bool(environment, 'V5_PAPER_INTENTS_ENABLED', true),
    legacyWritersEnabled: bool(environment, 'V5_LEGACY_WRITERS_ENABLED', false),
    liveExecutionEnabled: bool(environment, 'LIVE_EXECUTION_ENABLED', false),
  };
}

export function legacyWritersEnabled(environment: Record<string, string | undefined> = process.env): boolean {
  return v5AuthorityFlags(environment).legacyWritersEnabled;
}

export function createActiveArtifactV5(input: Omit<ActiveArtifactV5, 'authorityVersion'>): ActiveArtifactV5 {
  const artifact: ActiveArtifactV5 = { authorityVersion: 5, ...input };
  assertActiveArtifactV5(artifact);
  return artifact;
}

export function assertActiveArtifactV5(artifact: {
  authorityVersion?: number;
  schema?: string;
  state?: string;
  id?: string;
}): asserts artifact is ActiveArtifactV5 {
  if (artifact.state !== 'active' && artifact.state !== 'shadow' && artifact.state !== 'disabled') {
    throw new Error(`V5_ARTIFACT_STATE_INVALID:${artifact.id || 'unknown'}`);
  }
  assertAuthorityV5Contract(artifact);
}

export function assertAuthorityV5Contract(artifact: {
  authorityVersion?: number;
  schema?: string;
  id?: string;
}): void {
  if (artifact.authorityVersion !== 5 || !artifact.schema?.endsWith('.v5')) {
    throw new Error(`ACTIVE_ARTIFACT_BELOW_V5:${artifact.id || 'unknown'}`);
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value as Readonly<T>;
}

export function adaptLegacyArtifact<T>(
  artifact: T,
  originalVersion: string,
): Readonly<LegacyArtifactAdapterV5<T>> {
  return deepFreeze({
    authorityVersion: 5 as const,
    schema: 'legacy-artifact-adapter.v5' as const,
    legacyPreV5: true as const,
    readOnly: true as const,
    routable: false as const,
    originalVersion,
    artifact: structuredClone(artifact),
  });
}

export function assertArtifactRoutable(
  artifact: ActiveArtifactV5 | LegacyArtifactAdapterV5<unknown>,
): asserts artifact is ActiveArtifactV5 {
  if ('legacyPreV5' in artifact || !artifact.writer || artifact.state !== 'active') {
    throw new Error('LEGACY_OR_NONACTIVE_ARTIFACT_CANNOT_ROUTE');
  }
  assertActiveArtifactV5(artifact);
}

/**
 * Freezes a pre-v5 cutoff once and upgrades mutable current agents to the v5
 * authority contract. Historical trades, decisions, specs, and cards are not
 * rewritten; their IDs are captured in the cutoff record for read-only audit.
 */
export function initializeV5Authority(now = Date.now()) {
  const db = readDatabase();
  if (db.authorityV5) return db.authorityV5;
  const legacyStrategySpecIds = Object.keys(db.decisionRuntime?.strategySpecs || {}).sort();
  const legacyAgentIds = Object.values(db.agents)
    .filter((agent) => agent.authorityVersion !== 5)
    .map((agent) => agent.id)
    .sort();
  const legacySnapshotHash = digest({
    strategySpecs: legacyStrategySpecIds,
    agents: legacyAgentIds.map((id) => {
      const agent = db.agents[id];
      return { id, status: agent.status, strategyType: agent.strategyType, createdAt: agent.createdAt };
    }),
    tradeIds: db.trades.map((trade) => trade.id).sort(),
    orderIntentIds: Object.keys(db.orderIntentsV5 || {}).sort(),
  });

  for (const agent of Object.values(db.agents)) {
    if (agent.status === 'revoked' || agent.authorityVersion === 5) continue;
    agent.authorityVersion = 5;
    agent.schema = 'trading-agent.v5';
    agent.migratedFromPreV5 = true;
  }

  db.authorityV5 = {
    authorityVersion: 5,
    schema: 'authority-cutover.v5',
    cutoffAt: now,
    activatedAt: now,
    legacySnapshotHash,
    legacyStrategySpecIds,
    legacyAgentIds,
  };
  writeDatabase(db);
  return db.authorityV5;
}
