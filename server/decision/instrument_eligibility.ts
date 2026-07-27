// INSTRUMENT ELIGIBILITY — enforce the frozen hypothesis's "eligible real crypto spot only".
// Production (Gate-only) otherwise admits leveraged tokens (SHIB3S), tokenized equities (QQQON),
// stables and wrapped assets — all of which corrupt a clean forward test and don't belong in a
// spot golden-cross book.
//
// Design bias: prefer FALSE-INCLUDING a borderline real coin over FALSE-EXCLUDING one. So we lean
// on explicit lists + ONE unambiguous leveraged pattern, and deliberately avoid loose suffix
// regexes (e.g. plain /UP$/ would wrongly kill JUP; /^W.../ would kill WIF). Tokenized-equity
// detection is heuristic and KNOWN-INCOMPLETE — see the truth-freeze blockers.

const STABLE = new Set(['USDT', 'USDC', 'FDUSD', 'TUSD', 'DAI', 'USDP', 'USDE', 'PYUSD', 'GUSD', 'USDD', 'USDG', 'USD1', 'USDY', 'USDF', 'BUSD', 'USDX', 'USR', 'RLUSD', 'EUR', 'EURT', 'EURI', 'EURS', 'AEUR']);
const WRAPPED = new Set(['WBTC', 'WETH', 'WBETH', 'STETH', 'WEETH', 'CBETH', 'RETH', 'WBNB', 'WSOL', 'WMATIC', 'WAVAX', 'WHYPE', 'WSTETH', 'METH', 'RSETH', 'EZETH', 'BNSOL', 'JITOSOL', 'MSOL']);
// leveraged: base + 2-5 + L|S  (BTC3L, SHIB3S, DOGE5L, ETH3S, BCH5L, WIF5S). Won't hit JUP/WIF/etc.
const LEVERAGED = /^[A-Z0-9]{2,}[2-5](L|S)$/;
// tokenized equities on Gate/others: known set + <known-equity-ticker>ON suffix. Best-effort.
const TOKENIZED = new Set(['QQQON', 'SPYON', 'AAPLON', 'TSLAON', 'NVDAON', 'MSTRON', 'COINON', 'GOOGLON', 'GOOGON', 'METAON', 'AMZNON', 'MSFTON', 'AMDON', 'HOODON', 'CRCLON', 'PLTRON']);
const EQUITY_TICKERS = ['QQQ', 'SPY', 'AAPL', 'TSLA', 'NVDA', 'MSTR', 'COIN', 'GOOGL', 'GOOG', 'META', 'AMZN', 'MSFT', 'AMD', 'HOOD', 'CRCL', 'PLTR', 'NFLX', 'BABA'];

export function isRealSpot(base: string): boolean {
  const b = (base || '').toUpperCase();
  if (!b) return false;
  if (STABLE.has(b) || WRAPPED.has(b)) return false;
  if (LEVERAGED.test(b)) return false;
  if (TOKENIZED.has(b)) return false;
  if (b.endsWith('ON') && EQUITY_TICKERS.some((t) => b === `${t}ON`)) return false;   // tokenized-equity "…ON" wrappers
  return true;
}

// Why a symbol was excluded (for logging/telemetry); null if eligible.
export function ineligibleReason(base: string): string | null {
  const b = (base || '').toUpperCase();
  if (!b) return 'empty';
  if (STABLE.has(b)) return 'stablecoin';
  if (WRAPPED.has(b)) return 'wrapped';
  if (LEVERAGED.test(b)) return 'leveraged-token';
  if (TOKENIZED.has(b) || (b.endsWith('ON') && EQUITY_TICKERS.some((t) => b === `${t}ON`))) return 'tokenized-equity';
  return null;
}
