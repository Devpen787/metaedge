#!/usr/bin/env tsx
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { STRATEGY_PLUGINS } from '../server/decision/plugins.js';
import { compileFrozenStrategy } from '../server/decision/specs.js';
import { persistStrategySpec, persistValidation } from '../server/decision/store.js';
import { validateFrozenStrategy, type HistoricalBar, type HistoricalDataset } from '../server/decision/validator.js';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function explicitSymbols(): string[] {
  const symbols = flag('symbols')?.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) || [];
  const universeFile = flag('universe-file');
  if (universeFile) {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(universeFile), 'utf8'));
    const rows = Array.isArray(parsed) ? parsed : parsed.rows || parsed.included;
    if (!Array.isArray(rows)) throw new Error('Universe file must contain an array, { rows: [] }, or { included: [] }');
    symbols.push(...rows.filter((row: any) => row.included !== false).map((row: any) => String(row.symbol || row).toUpperCase()));
  }
  const unique = [...new Set(symbols)];
  if (!unique.length) throw new Error('Explicit universe required: --symbols A,B or --universe-file PATH');
  return unique;
}

function loadDataset(symbol: string, interval: string): HistoricalDataset | null {
  const file = path.resolve(flag('data-dir') || 'data/market', `backfill-${symbol}-${interval}.jsonl`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const bars = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as HistoricalBar);
  if (!bars.length) throw new Error(`No bars in ${file}`);
  return {
    id: `binance:${symbol}:${interval}:${bars[0].t}-${bars.at(-1)!.t}`,
    hash: crypto.createHash('sha256').update(raw).digest('hex'),
    provider: 'binance-public-klines', venue: 'spot', symbol, bars,
  };
}

const pluginId = flag('plugin') || 'rsi_mean_reversion';
const interval = flag('interval') || '1h';
const plugin = STRATEGY_PLUGINS.find((item) => item.id === pluginId);
if (!plugin) throw new Error(`Unknown plugin ${pluginId}. Available: ${STRATEGY_PLUGINS.map((item) => item.id).join(', ')}`);
const symbols = explicitSymbols();
const loaded = symbols.map((symbol) => ({ symbol, dataset: loadDataset(symbol, interval) }));
const datasets = loaded.map((item) => item.dataset).filter((item): item is HistoricalDataset => item != null);
const unavailableSymbols = loaded.filter((item) => !item.dataset).map((item) => item.symbol);
if (!datasets.length) throw new Error('No historical datasets exist for the explicit universe');
const spec = persistStrategySpec(compileFrozenStrategy(plugin));
let codeCommit = 'working-tree';
try { codeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* explicit fallback */ }
const validation = persistValidation(validateFrozenStrategy(spec, plugin, datasets, { codeCommit }));
const outputDir = path.resolve('data/edgeops/validations');
fs.mkdirSync(outputDir, { recursive: true });
const artifact = path.join(outputDir, `${validation.id}.json`);
fs.writeFileSync(artifact, `${JSON.stringify({ spec, validation, requestedSymbols: symbols, unavailableSymbols }, null, 2)}\n`);
console.log(JSON.stringify({ artifact, plugin: plugin.id, strategyHash: spec.hash, status: validation.status, reasons: validation.reasons, requestedSymbols: symbols, validatedSymbols: datasets.map((item) => item.symbol), unavailableSymbols, metrics: validation.metrics }, null, 2));
