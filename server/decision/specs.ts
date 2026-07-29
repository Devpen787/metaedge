import crypto from 'node:crypto';
import type { FrozenStrategySpec, StrategyPlugin } from './types.js';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stable(child)]));
  }
  return value;
}

export function compileFrozenStrategy(plugin: StrategyPlugin, createdAt = Date.now()): FrozenStrategySpec {
  const body = {
    pluginId: plugin.id,
    pluginVersion: plugin.version,
    mechanism: plugin.mechanism,
    instrument: plugin.instrument,
    requiredFeatures: [...plugin.requiredFeatures].sort(),
    parameters: stable(plugin.parameters) as Record<string, unknown>,
    benchmark: plugin.benchmark,
    falsifier: plugin.falsifier,
    expectedFailureRegimes: [...plugin.expectedFailureRegimes],
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(stable(body))).digest('hex');
  return { id: `strategy_${hash.slice(0, 16)}`, hash, ...body, createdAt };
}

