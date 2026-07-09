import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, YAxis, ReferenceDot } from 'recharts';
import { User, TradingAgent, PaperTrade } from '../types';
import { Landmark, Activity, TrendingUp, Sparkles, HelpCircle, ArrowRightLeft, Percent, ShieldCheck, Trash2, Wallet, RefreshCw } from 'lucide-react';
import { apiFetch, safeJson } from '../lib/api';
import ActingAsChip from './ActingAsChip';
import { spark, originOf } from '../lib/fx';

interface TradingHubProps {
  currentUser: User;
  agents: TradingAgent[];
  trades: PaperTrade[];
  onPlaceSimulatedTrade: (payload: any) => Promise<void>;
  onDeleteTrade?: (id: string) => Promise<void>;
  onClearAllTrades?: () => Promise<void>;
}

export default function TradingHub({ currentUser, agents, trades, onPlaceSimulatedTrade, onDeleteTrade, onClearAllTrades }: TradingHubProps) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [assetSymbol, setAssetSymbol] = useState('BTC');
  const [tradeType, setTradeType] = useState<'token' | 'perp'>('perp');
  const [side, setSide] = useState<'buy' | 'sell' | 'long' | 'short'>('long');
  const [size, setSize] = useState('0.1');
  const [leverage, setLeverage] = useState(10);
  const [simPrices, setSimPrices] = useState<Record<string, number>>({
    BTC: 96420.50,
    ETH: 3125.20,
    SOL: 184.80,
    LINK: 16.15,
    DOGE: 0.28
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // EdgeOps trade notes: optional thesis attached to the fill. When setup,
  // trigger AND invalidation are given, the trade counts as edgeops_complete
  // and feeds the weekly edge report; otherwise it's tagged thesis_missing.
  const [showThesis, setShowThesis] = useState(false);
  const [thesisSetup, setThesisSetup] = useState('');
  const [thesisTrigger, setThesisTrigger] = useState('');
  const [thesisInvalidation, setThesisInvalidation] = useState('');
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Live-market sanity check via the MetaMask Agent Wallet: one line of real
  // route/venue data for the trade on the ticket. Fetched on demand (the CLI
  // call takes a few seconds), rendered as text — never a JSON dump.
  const [mmRoute, setMmRoute] = useState<{ loading?: boolean; text?: string; error?: string }>({});

  // Active agents owned by user
  const myAgents = agents.filter(a => a.status === 'active');
  const filteredAgents = myAgents.filter(a => a.tradeType === tradeType);

  // Automatically select first active agent of correct type if none selected
  useEffect(() => {
    if (filteredAgents.length > 0 && (!selectedAgentId || !filteredAgents.find(a => a.id === selectedAgentId))) {
      setSelectedAgentId(filteredAgents[0].id);
      setAssetSymbol(filteredAgents[0].assetSymbol);
      if (filteredAgents[0].tradeType === 'token') {
        setSide('buy');
      } else {
        setSide('long');
      }
    } else if (filteredAgents.length === 0) {
      setSelectedAgentId('');
    }
  }, [filteredAgents, selectedAgentId]);

  // Fetch real-time price updates for all tokens from server to maintain synchronized prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/prices');
        const data = await safeJson(response);
        if (data.success && data.prices) {
          const pricesMap: Record<string, number> = {};
          Object.keys(data.prices).forEach(symbol => {
            pricesMap[symbol] = data.prices[symbol].price;
          });
          setSimPrices(pricesMap);
        }
      } catch (err) {
        console.error('Failed to fetch prices', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAgentChange = (id: string) => {
    setSelectedAgentId(id);
    const agent = myAgents.find(a => a.id === id);
    if (agent) {
      setAssetSymbol(agent.assetSymbol);
      setTradeType(agent.tradeType);
      if (agent.tradeType === 'token') {
        setSide(side === 'sell' ? 'sell' : 'buy');
      } else {
        setSide(side === 'short' ? 'short' : 'long');
      }
    }
  };

  const currentPrice = simPrices[assetSymbol] || 100;
  const positionSize = Number(size) || 0;
  const notional = positionSize * currentPrice;
  const marginRequired = tradeType === 'perp' ? notional / leverage : notional;
  const estLiquidation = tradeType === 'perp'
    ? side === 'long'
      ? currentPrice * (1 - 1 / leverage)
      : currentPrice * (1 + 1 / leverage)
    : 0;

  const checkMmRoute = async () => {
    setMmRoute({ loading: true });
    try {
      if (tradeType === 'token') {
        const usd = Math.max(1, Math.round(notional));
        const res = await apiFetch('/api/mm/swap/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ from: 'USDC', to: assetSymbol === 'BTC' ? 'WBTC' : assetSymbol === 'ETH' ? 'WETH' : assetSymbol, amount: String(usd) })
        });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body.message || 'No live route for this pair right now.');
        const inner = body.quote?.data?.quote || {};
        const dec = Number(inner?.destAsset?.decimals);
        const out = inner?.destAssetAmount != null && Number.isFinite(dec) ? (Number(inner.destAssetAmount) / 10 ** dec).toFixed(6) : null;
        if (!out) throw new Error('No live route for this pair right now.');
        setMmRoute({ text: `${inner.bridgeId || 'MetaMask'} route: ${usd.toLocaleString()} USDC → ${out} ${inner?.destAsset?.symbol || assetSymbol}` });
      } else {
        const res = await apiFetch('/api/mm/perps/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ symbol: assetSymbol, side, size: String(positionSize || 0.1), leverage: String(leverage) })
        });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body.message || 'No live venue quote for this market right now.');
        const q = body.quote?.data || {};
        if (!q.entryPrice) throw new Error('No live venue quote for this market right now.');
        setMmRoute({ text: `hyperliquid: entry $${Number(q.entryPrice).toLocaleString()} · liq $${Number(q.estimatedLiquidationPrice).toLocaleString()} · fee $${q.estimatedFee}` });
      }
    } catch (err: any) {
      setMmRoute({ error: err.message || 'Live route unavailable.' });
    }
  };

  const handleSubmitTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedAgentId) {
      setError('Please assemble and select an active AI bot to authorize trade executions.');
      return;
    }

    if (positionSize <= 0) {
      setError('Size must be greater than zero.');
      return;
    }

    if ((side === 'buy' || side === 'long') && marginRequired > currentUser.paperBalance) {
      setError('Insufficient simulated paper balance for this margin requirement.');
      return;
    }

    setSubmitting(true);
    try {
      const hasNotes = thesisSetup.trim() || thesisTrigger.trim() || thesisInvalidation.trim();
      await onPlaceSimulatedTrade({
        agentId: selectedAgentId,
        assetSymbol,
        side,
        size: positionSize,
        price: currentPrice,
        leverage: tradeType === 'perp' ? leverage : 1,
        nonce: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ...(hasNotes ? { thesis: { signalFamily: 'manual', setup: thesisSetup.trim(), trigger: thesisTrigger.trim(), invalidation: thesisInvalidation.trim() } } : {})
      });
      setSuccess(`Simulated order filled successfully: ${side.toUpperCase()} ${positionSize} ${assetSymbol} at $${currentPrice.toLocaleString()}`);
      // Every fill earns a tactile spark from the button — long/buy runs
      // emerald, short/sell runs rose, matching the order's own semantics.
      spark({
        origin: originOf(submitBtnRef.current),
        palette: side === 'buy' || side === 'long' ? 'emerald' : 'rose',
      });
      setSize('');
    } catch (err: any) {
      setError(err.message || 'Failed to place trade');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 fade-in relative z-10">

      {/* Guardrail: which wallet real actions would run from. */}
      <ActingAsChip className="lg:col-span-12" />

      {/* Interactive Terminal Order Panel */}
      <div className="lg:col-span-4 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:bg-slate-900/80 transition-all">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-700" />
        
        <form onSubmit={handleSubmitTrade} className="space-y-5 relative z-10">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
            <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
              Paper trading desk
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5 shadow-inner">
               <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              Paper fills
            </span>
          </div>

          {/* Mode Switch: Spot vs Perps */}
          <div className="flex gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => { setTradeType('token'); setSide('buy'); }}
              className={`flex-1 py-2 text-xs font-mono font-bold rounded-xl transition-all ${
                tradeType === 'token' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-md' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              SPOT (Tokens)
            </button>
            <button
              type="button"
              onClick={() => { setTradeType('perp'); setSide('long'); }}
              className={`flex-1 py-2 text-xs font-mono font-bold rounded-xl transition-all ${
                tradeType === 'perp' ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30 shadow-md' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              PERPS (Futures)
            </button>
          </div>

          {/* Price strip */}
          <div className="flex gap-2 bg-slate-950/60 p-2 rounded-2xl border border-slate-800 font-mono text-[10px] text-center overflow-x-auto custom-scrollbar shadow-inner">
            {Object.entries(simPrices).map(([symbol, price]) => (
              <button
                key={symbol}
                type="button"
                onClick={() => {
                  const agentWithAsset = filteredAgents.find(a => a.assetSymbol === symbol);
                  if (agentWithAsset) {
                    handleAgentChange(agentWithAsset.id);
                  } else {
                    setAssetSymbol(symbol);
                    setSelectedAgentId(''); // unset agent if no match for this asset and type
                  }
                }}
                className={`p-1.5 min-w-[70px] rounded transition-all flex-shrink-0 ${assetSymbol === symbol ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}
              >
                <div>{symbol}</div>
                <div className="font-bold mt-0.5 text-white">${Intl.NumberFormat('en-US', { maximumFractionDigits: symbol === 'DOGE' || symbol === 'XRP' || symbol === 'ADA' || symbol === 'MATIC' ? 4 : 2 }).format(Number(price))}</div>
              </button>
            ))}
          </div>

          {/* Select Bot */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase">Authorizing Agent Bot</label>
            {filteredAgents.length === 0 ? (
              <div className="bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-300 font-mono">
                No active <b>{tradeType === 'perp' ? 'Perp' : 'Spot'}</b> bots found. Assemble a bot in the <b>Agents</b> tab and toggle its status to Active to begin.
              </div>
            ) : (
              <select
                value={selectedAgentId}
                onChange={(e) => handleAgentChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
              >
                <option value="" disabled>Select an authorizing bot...</option>
                {filteredAgents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.assetSymbol} - {a.tradeType.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Side Tabs */}
          <div className="grid grid-cols-2 gap-2">
            {tradeType === 'token' ? (
              <>
                <button
                  type="button"
                  onClick={() => setSide('buy')}
                  className={`py-2 text-xs font-mono font-bold rounded-xl transition-all border ${
                    side === 'buy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-md shadow-emerald-500/5' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  SPOT BUY
                </button>
                <button
                  type="button"
                  onClick={() => setSide('sell')}
                  className={`py-2 text-xs font-mono font-bold rounded-xl transition-all border ${
                    side === 'sell' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-md shadow-rose-500/5' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  SPOT SELL
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSide('long')}
                  className={`py-2 text-xs font-mono font-bold rounded-xl transition-all border ${
                    side === 'long' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-md shadow-emerald-500/5' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  PERP LONG
                </button>
                <button
                  type="button"
                  onClick={() => setSide('short')}
                  className={`py-2 text-xs font-mono font-bold rounded-xl transition-all border ${
                    side === 'short' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-md shadow-rose-500/5' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  PERP SHORT
                </button>
              </>
            )}
          </div>

          {/* Input Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
              <span>Order Size</span>
              <span>Available: ${currentUser.paperBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="0.0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-mono text-slate-500">{assetSymbol}</span>
            </div>
          </div>

          {/* Leverage slider */}
          {tradeType === 'perp' && (
            <div className="space-y-2 bg-slate-950/30 p-3 rounded-xl border border-slate-900/60">
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span className="text-slate-400">Custom Leverage</span>
                <span className="text-indigo-400 font-bold">{leverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-600">
                <span>1x</span>
                <span>25x</span>
                <span>50x</span>
              </div>
            </div>
          )}

          {/* AI Auto-Risk Guards */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              className="flex flex-col items-start bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 transition-colors group cursor-pointer text-left shadow-inner"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-bold text-slate-300 font-mono">Bot Trailing Stop</span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono leading-tight group-hover:text-slate-400">Secures profit dynamically</span>
            </button>
            <button
              type="button"
              className="flex flex-col items-start bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 transition-colors group cursor-pointer text-left shadow-inner"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span className="text-[10px] font-bold text-slate-300 font-mono">AI Take-Profit</span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono leading-tight group-hover:text-slate-400">Auto-exit on resistance</span>
            </button>
          </div>

          {/* AI Insight Box */}
          {selectedAgentId && (
            <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-xl p-3 flex gap-3 shadow-inner">
              <div className="shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h5 className="text-[10px] font-bold text-indigo-300 font-mono uppercase tracking-widest mb-1">Agent Intelligence</h5>
                <p className="text-[11px] text-indigo-200/70 leading-relaxed font-sans">
                  {tradeType === 'perp' 
                    ? side === 'long'
                      ? `Funding rates show bullish momentum for ${assetSymbol}. Keep leverage under ${leverage > 10 ? '10x' : '15x'} to survive volatility wicks. Activate Bot Trailing Stop to secure profits dynamically.`
                      : `Shorting ${assetSymbol} here requires caution against short-squeezes. Ensure AI Take-Profit is active to lock in downside gains automatically.`
                    : side === 'buy'
                      ? `Spot accumulation for ${assetSymbol} is safe from funding fees and liquidations. DCAing here is recommended by historical agent moving averages.`
                      : `Selling ${assetSymbol} spot locks in your capital. The agent suggests keeping 20% in cold storage in case of sudden macro breakouts.`
                  }
                </p>
              </div>
            </div>
          )}

          {/* EdgeOps trade notes: why this trade — feeds the weekly edge report. */}
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowThesis(!showThesis)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-slate-400 hover:text-slate-200"
            >
              <span>📝 Trade notes {thesisSetup && thesisTrigger && thesisInvalidation ? '· thesis complete ✓' : '(optional — why this trade?)'}</span>
              <span>{showThesis ? '−' : '+'}</span>
            </button>
            {showThesis && (
              <div className="px-3 pb-3 space-y-2">
                <input value={thesisSetup} onChange={(e) => setThesisSetup(e.target.value)} placeholder="Setup — what condition exists (e.g. ETH near 24h high)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50" />
                <input value={thesisTrigger} onChange={(e) => setThesisTrigger(e.target.value)} placeholder="Trigger — what fired now (e.g. breakout + rising volume)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50" />
                <input value={thesisInvalidation} onChange={(e) => setThesisInvalidation(e.target.value)} placeholder="Invalidation — what proves you wrong (e.g. closes back below)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50" />
                <p className="text-[10px] text-slate-600">All three filled = counts in your edge report. Notes ride with the trade — special events, reasons, anything worth remembering.</p>
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            ref={submitBtnRef}
            type="submit"
            disabled={submitting || !selectedAgentId}
            className={`w-full py-3 rounded-xl font-mono text-xs font-bold shadow-lg transition-all cursor-pointer ${
              side === 'buy' || side === 'long'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10 text-white'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/10 text-white'
            } disabled:opacity-40`}
          >
            {submitting ? 'Executing Telemetry...' : !selectedAgentId ? 'NO BOT SELECTED' : `SUBMIT SIMULATED ${side.toUpperCase()} FILL`}
          </button>

          {error && <p className="text-[11px] text-rose-400 font-mono text-center">{error}</p>}
          {success && <p className="text-[11px] text-emerald-400 font-mono text-center">{success}</p>}

          {/* Live-market check via MetaMask — one line, on demand. */}
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 space-y-2">
            <button
              type="button"
              onClick={checkMmRoute}
              disabled={!!mmRoute.loading}
              className="w-full flex items-center justify-center gap-2 text-[11px] font-mono text-orange-400/90 hover:text-orange-300 disabled:opacity-60 transition-colors"
            >
              {mmRoute.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
              {mmRoute.loading ? 'Checking live market…' : 'Check live route (MetaMask)'}
            </button>
            {mmRoute.text && <p className="text-[11px] text-emerald-300 font-mono text-center">{mmRoute.text}</p>}
            {mmRoute.error && <p className="text-[11px] text-slate-500 font-mono text-center">{mmRoute.error}</p>}
          </div>
        </form>

        {/* Telemetry Status Footer */}
        <div className="text-[10px] font-mono text-slate-500 bg-slate-950/20 p-3 rounded-xl border border-slate-900/30 mt-4 flex items-center gap-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          Autonomous multi-agent trade room auth active
        </div>
      </div>

      {/* Margins, Mark-to-market valuations and Positions logs */}
      <div className="lg:col-span-8 flex flex-col gap-6 relative z-10">
        
        {/* Margin metrics board */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 shadow-2xl hover:border-indigo-500/30 transition-all group">
          <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-4 bg-indigo-500 rounded-sm"></span>
            Dynamic Execution Analytics
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shadow-inner group-hover:border-slate-700 transition-colors">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Notional Size</div>
              <div className="text-sm font-bold text-slate-200 mt-2">${notional.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shadow-inner group-hover:border-indigo-900/50 transition-colors">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Margin Required</div>
              <div className="text-sm font-bold text-indigo-400 mt-2">${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shadow-inner group-hover:border-rose-900/50 transition-colors">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Est. Liquidation</div>
              <div className="text-sm font-bold text-rose-400 mt-2">
                {tradeType === 'perp' && positionSize > 0 ? `$${estLiquidation.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shadow-inner group-hover:border-emerald-900/50 transition-colors">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Price</div>
              <div className="text-sm font-bold text-emerald-400 mt-2">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          {/* Position Targets & Boundaries Visualization */}
          {positionSize > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 pt-5 border-t border-slate-700/50 font-mono text-xs text-slate-300">
              <div className="flex items-center gap-2 mb-4 text-indigo-400 font-bold uppercase text-[10px] tracking-widest">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Execution Targets & Boundaries Plan
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Where Entered</span>
                  <span className="text-xs font-bold text-slate-200 mt-2">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="text-[9px] text-slate-500 mt-1">Average Cost Basis</span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Break-even Price</span>
                  <span className="text-xs font-bold text-slate-300 mt-2">
                    ${(side === 'long' || side === 'buy' ? currentPrice * 1.0005 : currentPrice * 0.9995).toLocaleString(undefined, { minimumFractionDigits: assetSymbol === 'DOGE' ? 4 : 2 })}
                  </span>
                  <span className="text-[9px] text-slate-500 mt-1">Incl. 0.05% Exchange Fee</span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Profit Target Goals</span>
                  <div className="space-y-1 mt-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px]">+10%:</span>
                      <span className="text-emerald-400 font-bold">${(side === 'long' || side === 'buy' ? currentPrice * 1.10 : currentPrice * 0.90).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px]">+25%:</span>
                      <span className="text-emerald-400 font-bold">${(side === 'long' || side === 'buy' ? currentPrice * 1.25 : currentPrice * 0.75).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1">Dynamic take profit limits</span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-rose-950/30 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 blur-[20px] pointer-events-none" />
                  <span className="text-[10px] text-rose-400 block uppercase tracking-wider relative z-10">Full Loss / Liq</span>
                  <span className="text-xs font-bold text-rose-400 mt-2 relative z-10">
                    {tradeType === 'perp' 
                      ? `$${estLiquidation.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
                      : 'N/A (Asset must go to $0)'}
                  </span>
                  <span className="text-[9px] text-slate-500 mt-1 relative z-10">
                    {tradeType === 'perp' ? 'Margin requirement boundary' : 'No margin liquidation risk in Spot'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Live positions list */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 flex-1 shadow-2xl hover:border-slate-500/50 transition-all">
          <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
            <h4 className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Active Leveraged Positions & Spot Fills
            </h4>
            {trades.length > 0 && onClearAllTrades && (
              <button
                onClick={onClearAllTrades}
                className="text-[10px] font-mono text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-inner"
              >
                Clear All History
              </button>
            )}
          </div>

          {trades.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500 font-mono bg-slate-950/20 rounded-xl border border-slate-900/40">
              No positions recorded under your active bot authorizations. Place an order to execute paper trades.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Asset</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Side</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Mark Price</th>
                    <th className="py-2.5 px-3 text-center">Timeline</th>
                    <th className="py-2.5 px-3 text-right">PnL</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {[...trades].sort((a,b) => b.timestamp - a.timestamp).map((trade) => {
                    const isBuy = trade.side === 'buy' || trade.side === 'long';
                    const currentAssetPrice = simPrices[trade.assetSymbol] || trade.price;
                    
                    // Generate deterministic sparkline
                    const sparklineData = [];
                    const steps = 15;
                    for (let i = 0; i <= steps; i++) {
                      const t = i / steps;
                      const base = trade.price + (currentAssetPrice - trade.price) * t;
                      const noiseFactor = Math.sin(i * 2.5 + trade.price) * 0.4;
                      const diff = currentAssetPrice - trade.price;
                      const noise = diff === 0 ? (currentAssetPrice * 0.001 * noiseFactor) : diff * noiseFactor;
                      sparklineData.push({ val: i === 0 ? trade.price : i === steps ? currentAssetPrice : base + noise });
                    }
                    const minVal = Math.min(...sparklineData.map(d => d.val));
                    const maxVal = Math.max(...sparklineData.map(d => d.val));
                    const isWinning = isBuy ? currentAssetPrice >= trade.price : currentAssetPrice <= trade.price;

                    return (
                      <tr key={trade.id} className="hover:bg-slate-950/20 text-slate-300 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-200">
                          {trade.assetSymbol}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[10px] text-slate-400">
                          {trade.tradeType === 'perp' ? `${trade.leverage}x Perp` : 'Spot Token'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{trade.size}</td>
                        <td className="py-2.5 px-3">${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 px-3 w-28">
                          <div className="h-8 w-24">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparklineData}>
                                <YAxis domain={[minVal, maxVal]} hide />
                                <Line 
                                  type="monotone" 
                                  dataKey="val" 
                                  stroke={isWinning ? '#10b981' : '#f43f5e'} 
                                  strokeWidth={1.5} 
                                  dot={false}
                                  isAnimationActive={false}
                                />
                                <ReferenceDot x={0} y={trade.price} r={2} fill="#94a3b8" stroke="none" />
                                <ReferenceDot x={steps} y={currentAssetPrice} r={2.5} fill={isWinning ? '#10b981' : '#f43f5e'} stroke="none" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${
                          trade.pnl === undefined ? 'text-slate-500' : trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {trade.pnl === undefined ? '—' : `$${trade.pnl.toFixed(2)}`}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => onDeleteTrade && onDeleteTrade(trade.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete trade"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
