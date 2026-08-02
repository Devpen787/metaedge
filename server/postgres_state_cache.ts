import crypto from 'node:crypto';
import { canonicalJson } from './canonical_json.js';

export interface CanonicalSegmentSnapshot {
  canonical: string;
  fingerprint: string;
  valueHash: string;
  valueJson: string;
  valueBytes: number;
}

export function snapshotSerializedSegment(value: unknown): {
  fingerprint: string;
  valueJson: string;
  valueBytes: number;
} {
  const valueJson = JSON.stringify(value);
  if (valueJson === undefined) throw new Error('UNSERIALIZABLE_STATE_SEGMENT');
  return {
    fingerprint: crypto.createHash('sha256').update(valueJson).digest('hex'),
    valueJson,
    valueBytes: Buffer.byteLength(valueJson),
  };
}

export function snapshotCanonicalSegment(
  value: unknown,
  serialized = snapshotSerializedSegment(value),
): CanonicalSegmentSnapshot {
  const canonical = canonicalJson(value);
  return {
    canonical,
    fingerprint: serialized.fingerprint,
    valueHash: crypto.createHash('sha256').update(canonical).digest('hex'),
    valueJson: serialized.valueJson,
    valueBytes: serialized.valueBytes,
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
