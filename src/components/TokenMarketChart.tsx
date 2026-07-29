import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Search, TrendingUp, TrendingDown, Coins, Info } from 'lucide-react';
import { safeJson } from '../lib/api';

interface TokenInfo {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  supply: string;
  description: string;
}

interface HistoryPoint { t: number; close: number }

// Timeframes are declared as WINDOWS IN HOURS because that is the resolution the
// recorder actually stores. The sub-hourly buttons (15m/1H/4H) were removed: we
// persist no sub-hourly series, and offering the button implies we do.
const TIMEFRAMES = [
  { key: '24H', hours: 24 },
  { key: '7D', hours: 24 * 7 },
  { key: '30D', hours: 24 * 30 },
  { key: 'All', hours: 400 },
] as const;
type TimeframeKey = (typeof TIMEFRAMES)[number]['key'];

const decimalsFor = (sym: string) => (['DOGE', 'XRP', 'ADA', 'MATIC'].includes(sym) ? 4 : 2);
const fmtUsd = (v: number, sym: string) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: decimalsFor(sym), maximumFractionDigits: decimalsFor(sym) })}`;

const HOUR_MS = 3_600_000;

function labelFor(t: number, hours: number) {
  const d = new Date(t);
  return hours <= 24
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Expand the recorded points into one bucket per hour of the window, leaving
// `null` where nothing was recorded. Recharts spaces points evenly by index, so
// a sparse series plotted directly would compress a 27-hour outage into a single
// smooth step. Nulls + `connectNulls={false}` break the line instead, which is
// what an unobserved hour actually looks like.
function densify(points: HistoryPoint[], hours: number) {
  if (points.length === 0) return [];
  const endHour = Math.floor(Date.now() / HOUR_MS);
  const startHour = endHour - hours + 1;
  const byHour = new Map(points.map((p) => [Math.floor(p.t / HOUR_MS), p.close]));
  const out: { label: string; price: number | null }[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const t = h * HOUR_MS;
    out.push({ label: labelFor(t, hours), price: byHour.has(h) ? byHour.get(h)! : null });
  }
  return out;
}

export default function TokenMarketChart() {
  const [tokens, setTokens] = useState<Record<string, TokenInfo> | null>(null);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [timeframe, setTimeframe] = useState<TimeframeKey>('24H');
  const [searchQuery, setSearchQuery] = useState('');

  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [gaps, setGaps] = useState(0);
  const [totalHoursRecorded, setTotalHoursRecorded] = useState(0);

  const selectedToken = tokens?.[selectedSymbol] ?? null;
  const activeTf = TIMEFRAMES.find((t) => t.key === timeframe)!;

  // Live prices. No seeded constants: until this resolves we render a skeleton.
  // The old INITIAL_TOKENS seeded BTC at $96,420.50 against a server truth of
  // $63,089 — and that invented number was both displayed AND used as the
  // chart's starting price.
  useEffect(() => {
    let alive = true;
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/prices');
        const data = await safeJson(res);
        if (!alive) return;
        if (!res.ok || !data.success || !data.prices) {
          setPricesError(data?.error || `Price feed unavailable (HTTP ${res.status}).`);
          return;
        }
        const next: Record<string, TokenInfo> = {};
        for (const [symbol, p] of Object.entries<any>(data.prices)) next[symbol] = { symbol, ...p };
        setTokens(next);
        setPricesError(null);
      } catch (err: any) {
        if (!alive) return;
        setPricesError(err?.message || 'Could not reach the price feed.');
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  // Real recorded history. Replaces generateHistoricalData(), which walked a
  // random series with `Math.random() - 0.46` — a built-in upward drift, the
  // same defect that once carried the server's BTC to $444k.
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setHistoryLoading(true);
    setHistoryError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/prices/history/${selectedSymbol}?hours=${activeTf.hours}`,
          { signal: ctrl.signal }
        );
        const data = await safeJson(res);
        if (!alive) return;
        if (!res.ok || !data.success) {
          setHistoryError(data?.error || `Could not load history (HTTP ${res.status}).`);
          setHistory(null);
          return;
        }
        setHistory(data.points || []);
        setGaps(data.gaps ?? 0);
        setTotalHoursRecorded(data.totalHoursRecorded ?? 0);
      } catch (err: any) {
        if (!alive || err?.name === 'AbortError') return;
        setHistoryError(err?.message || 'Could not reach the history feed.');
        setHistory(null);
      } finally {
        if (alive) setHistoryLoading(false);
      }
    })();
    return () => { alive = false; ctrl.abort(); };
  }, [selectedSymbol, activeTf.hours]);

  const recordedPoints = history?.length ?? 0;
  const chartData = densify(history ?? [], activeTf.hours);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens) return;
    const query = searchQuery.toUpperCase().trim();
    if (tokens[query]) { setSelectedSymbol(query); setSearchQuery(''); return; }
    const found = (Object.values(tokens) as TokenInfo[]).find((t) => t.name.toUpperCase().includes(query));
    if (found) { setSelectedSymbol(found.symbol); setSearchQuery(''); }
  };

  // Loading and failure states — C3: the component previously had neither.
  if (pricesError && !tokens) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-4 text-sm text-rose-300 font-mono">
        {pricesError}
      </div>
    );
  }
  if (!tokens || !selectedToken) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs animate-pulse">
        <div className="lg:col-span-4 h-96 bg-slate-900/40 border border-slate-800/80 rounded-2xl" />
        <div className="lg:col-span-8 h-96 bg-slate-900/40 border border-slate-800/80 rounded-2xl" />
      </div>
    );
  }

  const isPositive = selectedToken.change24h >= 0;
  // Gate on REAL recorded points, never on the densified bucket count — the
  // buckets always number `activeTf.hours`, most of them empty.
  const enoughToPlot = recordedPoints >= 2;
  const windowIsPartial = enoughToPlot && recordedPoints < activeTf.hours;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 fade-in font-mono text-xs">

      {/* Sidebar List and Search */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Coins className="w-4 h-4 text-indigo-400" />
            MetaEdge Market Explorer
          </h3>

          {pricesError && (
            <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
              {pricesError} Showing the last good prices.
            </div>
          )}

          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol (e.g., SOL)..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-white outline-none"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </form>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {(Object.values(tokens) as TokenInfo[]).map((token) => {
              const active = selectedSymbol === token.symbol;
              const pos = token.change24h >= 0;
              return (
                <div
                  key={token.symbol}
                  onClick={() => setSelectedSymbol(token.symbol)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    active
                      ? 'bg-indigo-600/10 border-indigo-500/30 shadow-md'
                      : 'bg-slate-950/40 border-slate-900/80 hover:border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-slate-900 border border-slate-800/80 rounded-lg flex items-center justify-center font-bold text-slate-200">
                      {token.symbol[0]}
                    </span>
                    <div>
                      <div className="font-bold text-slate-200">{token.symbol}</div>
                      <div className="text-[10px] text-slate-500">{token.name}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-200">{fmtUsd(token.price, token.symbol)}</div>
                    <div className={`text-[10px] font-bold flex items-center gap-0.5 justify-end ${pos ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {pos ? '+' : ''}{token.change24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected asset statistics overview */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-3.5">
          <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Asset Properties & Metrics</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{selectedToken.description}</p>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/60 font-mono text-[10px] text-slate-400">
            <div>
              <span className="text-slate-500">24H High:</span>
              <div className="text-slate-200 font-bold mt-0.5">{fmtUsd(selectedToken.high24h, selectedToken.symbol)}</div>
            </div>
            <div>
              <span className="text-slate-500">24H Low:</span>
              <div className="text-slate-200 font-bold mt-0.5">{fmtUsd(selectedToken.low24h, selectedToken.symbol)}</div>
            </div>
            <div>
              <span className="text-slate-500">Market Cap:</span>
              <div className="text-slate-200 font-bold mt-0.5">${(selectedToken.marketCap / 1e9).toFixed(1)}B</div>
            </div>
            <div>
              <span className="text-slate-500">Circ. Supply:</span>
              <div className="text-slate-200 font-bold mt-0.5">{selectedToken.supply}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main interactive chart terminal */}
      <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">

        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center font-bold text-indigo-400 text-sm">
              {selectedToken.symbol}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white uppercase">{selectedToken.name} Market Feed</h2>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'}`}>
                  {isPositive ? '+' : ''}{selectedToken.change24h.toFixed(2)}%
                </span>
              </div>
              <div className="text-lg font-extrabold text-slate-200 mt-0.5">
                {fmtUsd(selectedToken.price, selectedToken.symbol)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-900 overflow-x-auto hide-scrollbar">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  timeframe === tf.key ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tf.key}
              </button>
            ))}
          </div>
        </div>

        {/* Chart — real recorded closes, or an honest empty state. */}
        <div className="h-72 w-full pr-4 mb-4">
          {historyLoading ? (
            <div className="h-full w-full rounded-xl bg-slate-950/40 animate-pulse" />
          ) : historyError ? (
            <div className="h-full flex items-center justify-center text-center px-6">
              <div className="text-[11px] text-rose-300">{historyError}</div>
            </div>
          ) : !enoughToPlot ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2">
              <Info className="w-5 h-5 text-slate-600" />
              <div className="text-[11px] text-slate-400 font-bold">Not enough recorded history to chart {selectedToken.symbol}.</div>
              <div className="text-[10px] text-slate-500 leading-relaxed max-w-sm font-sans">
                MetaEdge plots only prices it has recorded itself. It holds {totalHoursRecorded} hourly
                {totalHoursRecorded === 1 ? ' close' : ' closes'} so far and needs at least 2 to draw a line.
                This chart fills in as the recorder runs.
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorToken" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.25} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} dy={8} fontFamily="JetBrains Mono, ui-monospace" />
                <YAxis
                  stroke="#64748b" fontSize={9} tickLine={false} axisLine={false}
                  tickFormatter={(val) => `$${val.toLocaleString()}`}
                  dx={-8} domain={['auto', 'auto']} fontFamily="JetBrains Mono, ui-monospace"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      if (d.price == null) {
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-mono text-[10px] text-slate-400 space-y-1">
                            <div>Time: <strong className="text-white">{d.label}</strong></div>
                            <div className="text-slate-500">Not recorded</div>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-mono text-[10px] text-slate-300 space-y-1">
                          <div>Time: <strong className="text-white">{d.label}</strong></div>
                          <div>Close: <strong className="text-indigo-400">{fmtUsd(d.price, selectedSymbol)}</strong></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? '#10b981' : '#f43f5e'}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorToken)"
                  // An unrecorded hour must leave a hole, not a bridge.
                  connectNulls={false}
                  // Isolated observations have no neighbours to draw a line to;
                  // without a dot they would render as nothing at all.
                  dot={recordedPoints <= 60 ? { r: 1.5 } : false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Provenance. The chart states where its numbers came from, and what it
            does not have. The old panel here rendered a bid/ask ladder whose
            quantities were Math.random() on every render — invented liquidity,
            which is precisely the number a trader would size against. */}
        <div className="flex items-start gap-2 text-[10px] text-slate-500 bg-slate-950/40 border border-slate-900 rounded-xl px-3 py-2.5 leading-relaxed">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px text-slate-600" />
          <span className="font-sans">
            Hourly closes recorded by MetaEdge from the live price feed
            {enoughToPlot && <> · <span className="font-mono text-slate-400">{recordedPoints}</span> of {activeTf.hours} hours observed</>}
            {gaps > 0 && <> · <span className="font-mono text-amber-500/80">{gaps}</span> recording gap{gaps === 1 ? '' : 's'}, drawn as breaks</>}
            {windowIsPartial && <> · window not yet full</>}
            . No order-book depth feed is connected, so bid/ask liquidity is not shown.
          </span>
        </div>

      </div>
    </div>
  );
}
