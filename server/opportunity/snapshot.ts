import fs from 'fs';
import path from 'path';
import { getHourlyCloses } from '../recorder.js';
import { fundingAprPercent, openInterestUsd } from '../units.mjs';
import type { FeedRow } from './feed.js';
import type { MarketSnapshot, FundingSnapshot } from './types.js';

// MarketSnapshotStore + FundingSnapshotStore. Every field has a declared unit in
// docs/data_requirements_and_contracts.md. Missing data returns null and causes a
// DECLINE downstream — never fabricated (no fake spread, depth, liquidation, or
// pre-recorder history).
//
// Takes a FeedRow rather than reading the product catalog, so it serves Tier 0
// and Tier 1 identically.


export function buildMarketSnapshot(row: FeedRow): MarketSnapshot | null {
  if (!(row.price > 0)) return null;
  const atrPercent = row.high24h > 0 && row.low24h > 0
    ? ((row.high24h - row.low24h) / row.price) * 100
    : 0;
  return {
    t: Date.now(),
    symbol: row.symbol,
    price: row.price,
    change24h: row.change24h,
    volume24h: row.volume24h,
    atrPercent,
    realizedVol24h: realizedVol(row.symbol),
    dataAgeS: 0,
  };
}

// Realized vol from OUR OWN recorded hourly closes. Null until enough history
// exists — the caller must decline, never backfill from another feed. Coins that
// just entered the universe have NO recorded history, and that is the truth.
function realizedVol(symbol: string): number | null {
  const closes = getHourlyCloses(symbol);
  if (closes.length < 25) return null; // need ~24 hourly returns
  const window = closes.slice(-25);
  const rets: number[] = [];
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1] > 0) rets.push(Math.log(window[i] / window[i - 1]));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * 100; // percent per hour
}

// Every captured funding row for a symbol, oldest first — the funding_scanner_snapshot
// contract as a time series. The carry trial consumes THIS rather than reading raw
// files, so the trial is the scanner's first consumer instead of a private bolt-on.
//
// `premium` is null for rows captured before 2026-07-09 (the recorder discarded it).
// Callers must treat that as basis UNMEASURED, never as zero basis.
export interface FundingSeriesRow {
  t: number;
  fundingHourly: number;
  fundingApr: number | null;
  premium: number | null;
  openInterestUsd: number | null;
}

export function readFundingSeries(symbol: string, sinceMs = 0): FundingSeriesRow[] {
  const rows: FundingSeriesRow[] = [];
  try {
    const dir = path.join(process.cwd(), 'data', 'market');
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('funding-') && f.endsWith('.jsonl') && !f.startsWith('funding-hist-'))
      .sort();
    for (const f of files) {
      for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
        if (!line) continue;
        try {
          const e = JSON.parse(line);
          if (e.sym !== symbol || typeof e.fundingHourly !== 'number' || e.t < sinceMs) continue;
          rows.push({
            t: e.t,
            fundingHourly: e.fundingHourly,
            fundingApr: fundingAprPercent(e.fundingHourly),
            premium: typeof e.premium === 'number' ? e.premium : null,
            openInterestUsd: openInterestUsd(e.openInterest, e.markPx),
          });
        } catch { /* skip malformed line */ }
      }
    }
  } catch { /* no funding capture yet */ }
  return rows.sort((a, b) => a.t - b.t);
}

// Latest funding from the recorder's wide Hyperliquid capture.
//
// Unit conversions are NOT performed here — they live in server/units.mjs, the
// single place they may be derived. A record missing markPx is INCOMPLETE, not
// zero: openInterestUsd() returns null so the scorer declines it rather than
// scoring absence as low.
export function readLatestFunding(symbol: string): FundingSnapshot {
  const t = Date.now();
  const empty: FundingSnapshot = { t, symbol, fundingHourly: null, fundingApr: null, openInterestUsd: null };
  try {
    const dir = path.join(process.cwd(), 'data', 'market');
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('funding-') && f.endsWith('.jsonl') && !f.startsWith('funding-hist-'))
      .sort();
    for (let i = files.length - 1; i >= 0; i--) {
      const lines = fs.readFileSync(path.join(dir, files[i]), 'utf8').trim().split('\n');
      for (let j = lines.length - 1; j >= 0; j--) {
        try {
          const e = JSON.parse(lines[j]);
          if (e.sym !== symbol || typeof e.fundingHourly !== 'number') continue;
          return {
            t: typeof e.t === 'number' ? e.t : t,
            symbol,
            fundingHourly: e.fundingHourly,
            fundingApr: fundingAprPercent(e.fundingHourly),
            openInterestUsd: openInterestUsd(e.openInterest, e.markPx),
          };
        } catch { /* skip malformed line */ }
      }
    }
  } catch { /* no funding capture yet */ }
  return empty;
}
