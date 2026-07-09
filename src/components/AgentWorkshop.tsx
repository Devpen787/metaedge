import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { TradingAgent, PaperStrategy, User, PaperTrade } from '../types';
import { Bot, HelpCircle, Plus, AlertCircle, Play, Pause, Trash2, ArrowRight, TrendingUp, Info } from 'lucide-react';
import { safeJson } from '../lib/api';

interface AgentWorkshopProps {
  currentUser: User;
  agents: TradingAgent[];
  strategies: PaperStrategy[];
  rooms: any[];
  trades: PaperTrade[];
  onAgentCreated: (payload: any) => Promise<void>;
  onAgentStatusChanged: (id: string, status: 'active' | 'paused' | 'revoked') => Promise<void>;
  onAgentDeleted?: (id: string) => Promise<void>;
  onCopyStrategy: (strategyId: string) => Promise<void>;
  onPlaceSimulatedTrade: (payload: any) => Promise<void>;
}

export default function AgentWorkshop({
  currentUser,
  agents,
  strategies,
  rooms,
  trades,
  onAgentCreated,
  onAgentStatusChanged,
  onAgentDeleted,
  onCopyStrategy,
  onPlaceSimulatedTrade
}: AgentWorkshopProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assetSymbol, setAssetSymbol] = useState('BTC');
  const [tradeType, setTradeType] = useState<'token' | 'perp'>('token');
  const [strategyType, setStrategyType] = useState('momentum');
  const [leverage, setLeverage] = useState('1');
  const [roomId, setRoomId] = useState('');

  // Manual trade simulation box
  const [simAgentId, setSimAgentId] = useState('');
  const [simSide, setSimSide] = useState<'buy' | 'sell' | 'long' | 'short'>('buy');
  const [simSize, setSimSize] = useState('0.1');
  // No seeded price. `simPrice` is submitted verbatim as the fill price of a REAL
  // paper trade, so a fabricated seed does not merely mislead the eye — it books
  // a trade at a price that never existed. The old seed was BTC $96,420.50
  // against a server truth of $63,089, and the seeding fallback below was
  // `|| 1.0`, which would have filled at one dollar. Until a real price arrives
  // the field stays empty and the fill button is locked.
  const [simPrice, setSimPrice] = useState('');
  const [realPrices, setRealPrices] = useState<Record<string, number>>({});
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [feedStale, setFeedStale] = useState(false);

  // A5: the status buttons fired straight into an async mutation with nothing
  // disabled, so a double-click sent two concurrent writes — and Pause followed
  // by REVOKE could land in either order. One agent at a time may be in flight.
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const changeStatus = async (id: string, status: 'active' | 'paused' | 'revoked') => {
    if (busyAgentId) return;
    setBusyAgentId(id);
    try { await onAgentStatusChanged(id, status); } finally { setBusyAgentId(null); }
  };

  // Latest prices, readable without making them a hook dependency (see the seed
  // effect below — depending on them would clobber the user's typed price).
  const realPricesRef = useRef(realPrices);
  useEffect(() => { realPricesRef.current = realPrices; }, [realPrices]);

  // Fetch prices from server to keep everything in sync.
  // A9: the in-flight request is aborted on unmount, so it cannot setState into
  // a component that is gone.
  useEffect(() => {
    const ctrl = new AbortController();
    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/prices', { signal: ctrl.signal });
        const data = await safeJson(response);
        if (ctrl.signal.aborted) return;
        if (data.success && data.prices) {
          const pricesMap: Record<string, number> = {};
          Object.keys(data.prices).forEach(symbol => {
            pricesMap[symbol] = data.prices[symbol].price;
          });
          setRealPrices(pricesMap);
          setPricesLoaded(true);
          // The server has always sent `feed.stale`; nothing read it. A price
          // more than two minutes old should not silently look live next to a
          // button that books a fill at it.
          setFeedStale(!!data.feed?.stale);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Failed to fetch prices', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => { clearInterval(interval); ctrl.abort(); };
  }, []);

  // Seed the simulator price when the SELECTED AGENT (or its asset) changes —
  // never on a price refresh. `realPrices` used to be a dependency here, so every
  // poll of /api/prices overwrote whatever price the user had typed.
  const simSymbol = agents.find(a => a.id === simAgentId)?.assetSymbol || 'BTC';
  useEffect(() => {
    if (!simAgentId) return;
    // `|| 1.0` used to fabricate a one-dollar price whenever the real one was
    // missing. Leave the field empty instead: an absent price is a fact, and the
    // fill button below refuses to submit without one.
    const px = realPricesRef.current[simSymbol];
    setSimPrice(typeof px === 'number' && px > 0 ? px.toString() : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simAgentId, simSymbol, pricesLoaded]);

  // Auto-select an active bot for the fill simulator, so "Simulate Fill" isn't
  // dead-disabled until the user manually picks the only bot they just created.
  useEffect(() => {
    const active = agents.filter(a => a.status === 'active');
    if (active.length === 0) {
      if (simAgentId) setSimAgentId('');
    } else if (!simAgentId || !active.some(a => a.id === simAgentId)) {
      setSimAgentId(active[0].id);
    }
  }, [agents, simAgentId]);

  const [loading, setLoading] = useState(false);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      await onAgentCreated({
        name,
        description,
        assetSymbol,
        tradeType,
        strategyType,
        leverage: Number(leverage),
        roomId: roomId || undefined
      });
      setName('');
      setDescription('');
      setMsg({ text: 'Paper agent initialized successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Error creating agent', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyStrategy = async (strategyId: string) => {
    setMsg({ text: '', type: '' });
    try {
      await onCopyStrategy(strategyId);
      setMsg({ text: 'Strategy copied into inactive bot. Open Agent settings to verify risk compliance.', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Error copying strategy', type: 'error' });
    }
  };

  const handleTriggerTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simAgentId) return;
    // The field is user-editable, so the button's disabled state is not enough.
    // Refuse to book a fill at a price we do not have rather than send NaN or 0.
    const px = Number(simPrice);
    if (!Number.isFinite(px) || px <= 0) {
      setMsg({ text: 'No live price for this asset yet — a fill needs a real price, not a placeholder.', type: 'error' });
      return;
    }
    setTradeLoading(true);
    setMsg({ text: '', type: '' });
    try {
      await onPlaceSimulatedTrade({
        agentId: simAgentId,
        assetSymbol: agents.find(a => a.id === simAgentId)?.assetSymbol || 'BTC',
        side: simSide,
        size: Number(simSize),
        price: px,
        nonce: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      });
      setMsg({ text: 'Paper fill executed successfully. Balances deducted server-side.', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Execution error', type: 'error' });
    } finally {
      setTradeLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Overview of errors/success */}
      {msg.text && (
        <div className={`p-4 rounded-xl border text-xs font-mono ${
          msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Agent Bot Column */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            Initialize Paper Trading Agent
          </h3>

          <form onSubmit={handleCreateAgent} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Agent Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BTC Momentum Bot"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Short Thesis</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Buys on break out over 1-hour high"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Asset Token</label>
                <select
                  value={assetSymbol}
                  onChange={(e) => setAssetSymbol(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none transition-all"
                >
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                  <option value="SOL">SOL</option>
                  <option value="LINK">LINK</option>
                  <option value="DOGE">DOGE</option>
                  <option value="BNB">BNB</option>
                  <option value="XRP">XRP</option>
                  <option value="ADA">ADA</option>
                  <option value="AVAX">AVAX</option>
                  <option value="DOT">DOT</option>
                  <option value="MATIC">MATIC</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Execution Mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTradeType('token')}
                    className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-xl transition-all shadow-sm ${
                      tradeType === 'token' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-indigo-500/10' : 'bg-slate-950/80 border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    SPOT
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeType('perp')}
                    className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-xl transition-all shadow-sm ${
                      tradeType === 'perp' ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30 shadow-orange-500/10' : 'bg-slate-950/80 border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    PERP
                  </button>
                </div>
              </div>
            </div>

            {/* Agent Advice Box based on Mode */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 shadow-inner">
              <div className="flex gap-2">
                <Info className="w-4 h-4 shrink-0 text-slate-500" />
                <div className="text-[10px] text-slate-400 leading-tight">
                  {tradeType === 'token' 
                    ? 'Spot Strategy: Accumulate tokens without margin liquidation risk. Ideal for long-term holding, swing trading, and riding macro trends up.'
                    : 'Perp Strategy: Amplifies gains/losses with leverage. Ideal for shorting down-trends and hedging, but strictly requires stop-loss risk management.'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Engine Strategy</label>
                <select
                  value={strategyType}
                  onChange={(e) => setStrategyType(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none transition-all"
                >
                  <option value="momentum">Momentum</option>
                  <option value="grid">Grid Trading</option>
                  <option value="mean_reversion">Mean Reversion</option>
                  <option value="rsi_meanrev">RSI Mean Reversion</option>
                  <option value="custom_ai">Custom AI</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Leverage Limits</label>
                <select
                  value={leverage}
                  disabled={tradeType !== 'perp'}
                  onChange={(e) => setLeverage(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none transition-all disabled:opacity-50"
                >
                  <option value="1">1x No leverage</option>
                  <option value="5">5x Mid leverage</option>
                  <option value="10">10x High leverage</option>
                  <option value="20">20x Max leverage</option>
                </select>
              </div>
            </div>

            {rooms.length > 0 && (
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Scope / Share with Room</label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none transition-all"
                >
                  <option value="">Do not share yet</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all cursor-pointer text-center uppercase tracking-wider text-[11px]"
            >
              {loading ? 'Initializing...' : 'Construct Paper Agent'}
            </button>
          </form>
        </div>

        {/* List of My Active Agents and Manual Fill simulator */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Agents */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Active Trading Agent Books ({agents.length})
            </h3>

            <div className="space-y-3">
              {agents.length === 0 ? (
                <p className="text-xs text-slate-500 font-mono py-8 text-center">No agent bots created. Construct one on the left.</p>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-950/40 border border-slate-900 rounded-xl font-mono text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{agent.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          agent.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {agent.status}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{agent.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                        <span>Asset: <strong className="text-slate-300">{agent.assetSymbol}</strong></span>
                        <span>Mode: <strong className="text-slate-300">{agent.tradeType.toUpperCase()}</strong></span>
                        {agent.tradeType === 'perp' && <span>Leverage: <strong className="text-slate-300">{agent.leverage}x</strong></span>}
                        <span>Engine: <strong className="text-indigo-400">{agent.strategyType}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {agent.status === 'active' ? (
                        <button
                          onClick={() => changeStatus(agent.id, 'paused')}
                          disabled={busyAgentId === agent.id}
                          className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 text-amber-400 rounded-lg border border-amber-500/20 transition-colors cursor-pointer"
                          title="Pause Bot"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => changeStatus(agent.id, 'active')}
                          disabled={busyAgentId === agent.id}
                          className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40 text-emerald-400 rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
                          title="Activate Bot"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {agent.status !== 'revoked' && (
                        <button
                          onClick={() => changeStatus(agent.id, 'revoked')}
                          disabled={busyAgentId === agent.id}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-400 rounded-lg border border-rose-500/20 transition-colors cursor-pointer"
                          title="Revoke Strategy"
                        >
                          <span className="text-[10px] font-bold px-0.5">REVOKE</span>
                        </button>
                      )}
                      <button
                        onClick={() => onAgentDeleted && onAgentDeleted(agent.id)}
                        className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                        title="Delete Bot Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Manual Order Simulation Box */}
          {agents.filter(a => a.status === 'active').length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                Trigger Paper Fill Simulator
              </h3>

              <form onSubmit={handleTriggerTrade} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono items-end">
                <div>
                  <label className="block text-slate-400 mb-1">Target Bot</label>
                  <select
                    value={simAgentId}
                    onChange={(e) => setSimAgentId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white outline-none"
                  >
                    <option value="">Select active bot</option>
                    {agents.filter(a => a.status === 'active').map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.assetSymbol})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Trade Action</label>
                  <select
                    value={simSide}
                    onChange={(e) => setSimSide(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white outline-none"
                  >
                    <option value="buy">BUY / SPOT</option>
                    <option value="sell">SELL / CLOSE</option>
                    <option value="long">LONG PERP</option>
                    <option value="short">SHORT PERP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Size / Fills Price</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="any"
                      required
                      value={simSize}
                      onChange={(e) => setSimSize(e.target.value)}
                      placeholder="Size"
                      className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-white placeholder-slate-600 outline-none"
                    />
                    <input
                      type="number"
                      step="any"
                      required
                      value={simPrice}
                      onChange={(e) => setSimPrice(e.target.value)}
                      placeholder={pricesLoaded ? 'Price' : 'Waiting for price…'}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-white placeholder-slate-600 outline-none"
                    />
                  </div>
                  {feedStale && (
                    <div className="mt-1 text-[10px] text-amber-400">
                      Price feed is stale — this fill would book at an old price.
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  // Locked until a real price exists: this books a paper fill at
                  // whatever is in the field, and it scores in the Arena.
                  disabled={tradeLoading || !simAgentId || !(Number(simPrice) > 0)}
                  title={!(Number(simPrice) > 0) ? 'Waiting for a live price for this asset' : undefined}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-1.5 px-4 rounded-xl shadow-lg transition-all cursor-pointer text-center"
                >
                  {tradeLoading ? 'Fills...' : 'Simulate Fill'}
                </button>
              </form>
            </div>
          )}

          {/* Shared Strategies Market to Copy */}
          {strategies.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4">
                Explore & Copy Shared Friend Strategies
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategies.map((strat) => (
                  <div
                    key={strat.id}
                    className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between font-mono text-xs space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{strat.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          {strat.assetSymbol}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1.5">{strat.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                      <span>Copied {strat.copiedCount} times</span>
                      <button
                        onClick={() => handleCopyStrategy(strat.id)}
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        Copy strategy <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Simulated Trade Orders Ledger */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Recent Simulated Fills & Trades Ledger
            </h3>

            {trades.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-mono bg-slate-950/20 rounded-xl border border-slate-900/40">
                No simulated fills recorded. Create an agent and trigger a Paper Fill Simulator to begin co-trading.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Asset</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Price</th>
                      <th className="py-2.5 px-3 text-right">Estimated PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {[...trades].sort((a,b) => b.timestamp - a.timestamp).map((trade) => {
                      const isBuy = trade.side === 'buy' || trade.side === 'long';
                      return (
                        <tr key={trade.id} className="hover:bg-slate-950/20 text-slate-300 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                            {new Date(trade.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-200">
                            {trade.assetSymbol}
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
                          <td className={`py-2.5 px-3 text-right font-bold ${
                            trade.pnl === undefined ? 'text-slate-500' : trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {trade.pnl === undefined ? '—' : `$${trade.pnl.toFixed(2)}`}
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
    </div>
  );
}
