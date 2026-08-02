import crypto from 'node:crypto';
import { canonicalJson } from './canonical_json.js';

export interface CanonicalSegmentSnapshot {
  canonical: string;
  valueHash: string;
  valueJson: string;
  valueBytes: number;
}

export function snapshotCanonicalSegment(value: unknown): CanonicalSegmentSnapshot {
  const valueJson = JSON.stringify(value);
  if (valueJson === undefined) throw new Error('UNSERIALIZABLE_STATE_SEGMENT');
  const canonical = canonicalJson(value);
  return {
    canonical,
    valueHash: crypto.createHash('sha256').update(canonical).digest('hex'),
    valueJson,
    valueBytes: Buffer.byteLength(valueJson),
  };
}

export function canonicalStateHash(
  segmentCanonical: Readonly<Record<string, string>>,
): string {
  const hash = crypto.createHash('sha256');
  hash.update('{');
  const keys = Object.keys(segmentCanonical).sort();
  keys.forEach((key, index) => {
    if (index > 0) hash.update(',');
    hash.update(JSON.stringify(key));
    hash.update(':');
    hash.update(segmentCanonical[key]);
  });
  hash.update('}');
  return hash.digest('hex');
}

export function compactStateBytes(
  segmentBytes: Readonly<Record<string, number>>,
): number {
  const keys = Object.keys(segmentBytes).sort();
  if (keys.length === 0) return 2;
  return 2 + (keys.length - 1) + keys.reduce(
    (sum, key) => sum + Buffer.byteLength(JSON.stringify(key)) + 1 + segmentBytes[key],
    0,
  );
}

export function trackTopLevelMutations<T extends object>(source: T): {
  state: T;
  dirtyKeys: Set<string>;
} {
  const dirtyKeys = new Set<string>();
  const proxies = new WeakMap<object, object>();

  const wrap = (value: unknown, topLevelKey: string): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const existing = proxies.get(value);
    if (existing) return existing;
    const proxy = new Proxy(value as object, {
      get(target, property) {
        return wrap(Reflect.get(target, property, target), topLevelKey);
      },
      set(target, property, nextValue) {
        dirtyKeys.add(topLevelKey);
        return Reflect.set(target, property, nextValue, target);
      },
      deleteProperty(target, property) {
        dirtyKeys.add(topLevelKey);
        return Reflect.deleteProperty(target, property);
      },
      defineProperty(target, property, descriptor) {
        dirtyKeys.add(topLevelKey);
        return Reflect.defineProperty(target, property, descriptor);
      },
    });
    proxies.set(value, proxy);
    return proxy;
  };

  const root = new Proxy(source, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      return typeof property === 'string' ? wrap(value, property) : value;
    },
    set(target, property, nextValue) {
      if (typeof property === 'string') dirtyKeys.add(property);
      return Reflect.set(target, property, nextValue, target);
    },
    deleteProperty(target, property) {
      if (typeof property === 'string') dirtyKeys.add(property);
      return Reflect.deleteProperty(target, property);
    },
    defineProperty(target, property, descriptor) {
      if (typeof property === 'string') dirtyKeys.add(property);
      return Reflect.defineProperty(target, property, descriptor);
    },
  });
  return { state: root, dirtyKeys };
}
