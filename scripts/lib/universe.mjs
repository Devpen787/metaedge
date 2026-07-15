import fs from 'node:fs';

export function flag(args, name, fallback = undefined) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}

function normalize(values) {
  return [...new Set(values.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))];
}

export function readUniverseFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.jsonl')) {
    return normalize(text.split('\n').filter(Boolean).map((line) => JSON.parse(line)).filter((row) => row.included !== false).map((row) => row.symbol));
  }
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return normalize(parsed.map((row) => typeof row === 'string' ? row : row.symbol));
  if (Array.isArray(parsed.included)) return normalize(parsed.included.map((row) => typeof row === 'string' ? row : row.symbol));
  if (Array.isArray(parsed.symbols)) return normalize(parsed.symbols);
  throw new Error(`Universe file ${file} must contain an array, symbols[], or included[]`);
}

export function explicitUniverse(args, flagName) {
  const inline = flag(args, flagName);
  const file = flag(args, 'universe-file');
  const symbols = inline ? normalize(inline.split(',')) : file ? readUniverseFile(file) : [];
  if (!symbols.length) {
    throw new Error(`Explicit universe required: --${flagName} SYMBOL_A,SYMBOL_B or --universe-file PATH`);
  }
  return symbols;
}

