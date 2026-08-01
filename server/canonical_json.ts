export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error('CANONICAL_JSON_UNSERIALIZABLE');
    return serialized;
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const object = value as Record<string, unknown>;
  const entries = Object.keys(object).sort().flatMap((key) => {
    if (object[key] === undefined) return [];
    return [`${JSON.stringify(key)}:${canonicalJson(object[key])}`];
  });
  return `{${entries.join(',')}}`;
}
