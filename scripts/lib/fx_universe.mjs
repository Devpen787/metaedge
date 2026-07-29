// SHARED FX PAIR UNIVERSE — replaces the hand-picked 24-pair list that used
// to live independently in fx_scout.mjs and directional_harness.mjs's fxAdapter
// (a real, flagged inconsistency: crypto/stocks/mm all learned to derive their
// universe live from a real venue query this session; FX never got that fix).
//
// Yahoo has no single bulk "list every currency pair" endpoint, but its
// lookup API (query1.finance.yahoo.com/v1/finance/lookup?type=currency) is a
// real, live, queryable source — same "start from a real source, then filter,
// don't hand-curate" discipline as everywhere else (Binance exchangeInfo,
// SEC company_tickers.json, Coinbase volume-summary). It's a search-style
// endpoint (not a bulk listing), so multiple seed queries against the four
// standard FX vehicle currencies (USD, EUR, GBP, JPY — this is how real FX
// markets are actually structured, not an arbitrary pick) surface a much
// broader real set (~650 raw candidates) than any single query would.
//
// The raw feed is NOT clean: it mixes real currency pairs with commodity/SDR
// tickers Yahoo tags quoteType:"currency" anyway (XCU=X is copper, XDR=X is
// the IMF Special Drawing Right — neither is a national currency) and a
// handful of alternate-suffix artifacts (CAX, BRX, CZX, DKX, HUX, ISX, MYX,
// PLX, ROX, THX, MXX, USY — none of these are real ISO 4217 codes). Filtered
// against a real ISO 4217 active-currency-code allowlist below, which is an
// external reference standard, not an arbitrary curation — the same kind of
// fact-based filter as refresh_universe.mjs's STABLE stablecoin-exclusion set.
import fs from 'node:fs';
import path from 'node:path';

const CACHE_FP = path.join(process.cwd(), 'data', 'market', 'fx', 'universe-cache.json');
const CACHE_TTL_MS = 7 * 86400000; // weekly — currency universe changes rarely, matches stock_scout_wide.mjs's cadence
const SEEDS = ['USD', 'EUR', 'GBP', 'JPY'];

// ISO 4217 active currency codes (real external standard). Errs toward
// inclusion of legitimate codes — the failure mode of omitting one is "one
// fewer pair," while including a non-currency artifact would corrupt the
// lane with an untradeable instrument, which is the worse failure to avoid.
const ISO4217 = new Set([
  'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'CNH', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'SGD',
  'KRW', 'INR', 'RUB', 'ZAR', 'MXN', 'BRL', 'TRY', 'PLN', 'THB', 'IDR', 'HUF', 'CZK', 'ILS', 'CLP', 'CLF',
  'PHP', 'AED', 'SAR', 'MYR', 'RON', 'COP', 'PEN', 'VND', 'EGP', 'PKR', 'BDT', 'NGN', 'KES', 'GHS', 'MAD',
  'DZD', 'TND', 'UAH', 'KZT', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LKR', 'NPR', 'MMK', 'KHR', 'LAK', 'MNT',
  'UZS', 'AZN', 'GEL', 'AMD', 'BYN', 'MDL', 'ALL', 'MKD', 'RSD', 'BAM', 'ISK', 'HRK', 'XOF', 'XAF', 'XCD',
  'XPF', 'BWP', 'ZMW', 'MWK', 'TZS', 'UGX', 'RWF', 'BIF', 'ETB', 'DJF', 'SOS', 'ERN', 'SDG', 'LYD', 'MRU',
  'SLE', 'SLL', 'GMD', 'GNF', 'CDF', 'AOA', 'NAD', 'LSL', 'SZL', 'MUR', 'SCR', 'MVR', 'MGA', 'KMF', 'STN',
  'CVE', 'GYD', 'SRD', 'TTD', 'JMD', 'BBD', 'BSD', 'BZD', 'BMD', 'KYD', 'GTQ', 'HNL', 'NIO', 'CRC', 'PAB',
  'DOP', 'HTG', 'CUP', 'VES', 'ARS', 'UYU', 'PYG', 'BOB', 'FJD', 'WST', 'TOP', 'VUV', 'SBD', 'PGK', 'SHP',
  'FKP', 'GIP', 'IQD', 'IRR', 'YER', 'SYP', 'LBP', 'AFN', 'AWG', 'ANG', 'BND', 'TJS', 'TMT', 'KPW', 'CUC',
]);

async function lookupCurrency(seed) {
  const r = await fetch(`https://query1.finance.yahoo.com/v1/finance/lookup?query=${seed}&type=currency&count=200`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);
  return j?.finance?.result?.[0]?.documents || [];
}

/** Live-derived, ISO-4217-filtered, weekly-cached FX pair list (e.g. "EURUSD"). */
export async function fxUniverseSymbols() {
  if (fs.existsSync(CACHE_FP) && Date.now() - fs.statSync(CACHE_FP).mtimeMs < CACHE_TTL_MS) {
    return JSON.parse(fs.readFileSync(CACHE_FP, 'utf8'));
  }
  const seen = new Set();
  for (const seed of SEEDS) {
    for (const d of await lookupCurrency(seed)) {
      const m = /^([A-Z]{3})([A-Z]{3})=X$/.exec(d.symbol);
      if (!m || m[1] === m[2]) continue;
      if (!ISO4217.has(m[1]) || !ISO4217.has(m[2])) continue; // drops XCU/XDR/CAX/etc.
      seen.add(`${m[1]}${m[2]}`);
    }
  }
  const symbols = [...seen].sort();
  fs.mkdirSync(path.dirname(CACHE_FP), { recursive: true });
  fs.writeFileSync(CACHE_FP, JSON.stringify(symbols));
  return symbols;
}
