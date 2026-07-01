import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, YAxis, ReferenceDot } from 'recharts';
import { User, TradingAgent, PaperTrade } from '../types';
import { Landmark, Activity, TrendingUp, Sparkles, HelpCircle, ArrowRightLeft, Percent, ShieldCheck, Trash2 } from 'lucide-react';

interface TradingHubProps {
  currentUser: User;
  agents: TradingAgent[];
  trades: PaperTrade[];
  onPlaceSimulatedTrade: (payload: any) => Promise<void>;
  onCloseTrade?: (id: string, currentPrice: number) => Promise<void>;
  onDeleteTrade?: (id: string) => Promise<void>;
  onClearAllTrades?: () => Promise<void>;
}

export default function TradingHub({ currentUser, agents, trades, onPlaceSimulatedTrade, onCloseTrade, onDeleteTrade, onClearAllTrades }: TradingHubProps) {
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
        const data = await response.json();
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
      setError('Insufficient paper balance for this margin requirement.');
      return;
    }

    setSubmitting(true);
    try {
      await onPlaceSimulatedTrade({
        agentId: selectedAgentId,
        assetSymbol,
        side,
        size: positionSize,
        price: currentPrice,
        leverage: tradeType === 'perp' ? leverage : 1,
        nonce: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      });
      setSuccess(`Order filled successfully: ${side.toUpperCase()} ${positionSize} ${assetSymbol} at $${currentPrice.toLocaleString()}`);
      setSize('');
    } catch (err: any) {
      setError(err.message || 'Failed to place trade');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 fade-in relative z-10">
      
      {/* Interactive Terminal Order Panel */}
      <div className="lg:col-span-4 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:bg-slate-900/80 transition-all">
        <form onSubmit={handleSubmitTrade} className="space-y-5 relative z-10">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
            <h3 className="text-base font-bold text-white">
              Order Entry
            </h3>
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 text-xs font-bold uppercase tracking-wider">
              Paper Trading
            </div>
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
          <div className="flex gap-2 bg-slate-950/60 p-2 rounded-2xl border border-slate-800 font-mono text-xs text-center overflow-x-auto custom-scrollbar shadow-inner">
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
            <label className="text-sm font-medium text-slate-400">Select Agent</label>
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
                  className={`py-2 text-sm font-medium rounded-xl transition-all border ${
                    side === 'buy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-md shadow-emerald-500/5' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  Spot Buy
                </button>
                <button
                  type="button"
                  onClick={() => setSide('sell')}
                  className={`py-2 text-sm font-medium rounded-xl transition-all border ${
                    side === 'sell' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-md shadow-rose-500/5' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  Spot Sell
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSide('long')}
                  className={`py-2 text-sm font-medium rounded-xl transition-all border ${
                    side === 'long' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-md shadow-emerald-500/5' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  Perp Long
                </button>
                <button
                  type="button"
                  onClick={() => setSide('short')}
                  className={`py-2 text-sm font-medium rounded-xl transition-all border ${
                    side === 'short' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-md shadow-rose-500/5' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  Perp Short
                </button>
              </>
            )}
          </div>

          {/* Input Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm font-medium text-slate-400">
              <span>Order Size</span>
              <span className="text-slate-500 text-xs">Available: ${currentUser.paperBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
              <span className="absolute right-3.5 top-2.5 text-sm font-mono text-slate-500">{assetSymbol}</span>
            </div>
          </div>

          {/* Leverage slider */}
          {tradeType === 'perp' && (
            <div className="space-y-2 bg-slate-950/30 p-3 rounded-xl border border-slate-900/60">
              <div className="flex justify-between items-center text-sm font-medium">
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
              <div className="flex justify-between text-xs text-slate-600">
                <span>1x</span>
                <span>25x</span>
                <span>50x</span>
              </div>
            </div>
          )}

          {/* Risk Boundaries */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              className="flex flex-col items-start bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 transition-colors group cursor-pointer text-left shadow-inner"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-medium text-slate-300">Trailing Stop</span>
              </div>
              <span className="text-xs text-slate-500 leading-tight group-hover:text-slate-400">Attempts to lock upside</span>
            </button>
            <button
              type="button"
              className="flex flex-col items-start bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 transition-colors group cursor-pointer text-left shadow-inner"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span className="text-xs font-medium text-slate-300">Take-Profit Target</span>
              </div>
              <span className="text-xs text-slate-500 leading-tight group-hover:text-slate-400">Auto-exit on resistance</span>
            </button>
          </div>

          {/* Agent Parameters Box */}
          {selectedAgentId && (
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex gap-3 shadow-inner mt-4">
              <div>
                <h5 className="text-xs font-bold text-slate-300 mb-1">Agent Details</h5>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Routing order via {filteredAgents.find(a => a.id === selectedAgentId)?.name || 'Agent'}. 
                  Target asset: {assetSymbol}.
                  {tradeType === 'perp' 
                    ? ` Executing at ${leverage}x leverage.`
                    : ` Spot execution.`}
                </p>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting || !selectedAgentId}
            className={`w-full py-3 mt-4 rounded-xl text-sm font-bold shadow-lg transition-all cursor-pointer ${
              side === 'buy' || side === 'long'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10 text-white'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/10 text-white'
            } disabled:opacity-40`}
          >
            {submitting ? 'EXECUTING...' : !selectedAgentId ? 'SELECT AGENT' : `EXECUTE ${side.toUpperCase()}`}
          </button>

          {error && <p className="text-sm text-rose-400 text-center mt-2">{error}</p>}
          {success && <p className="text-sm text-emerald-400 text-center mt-2">{success}</p>}
        </form>
      </div>

      {/* Margins, Mark-to-market valuations and Positions logs */}
      <div className="lg:col-span-8 flex flex-col gap-6 relative z-10">
        
        {/* Margin metrics board */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 shadow-2xl hover:border-indigo-500/30 transition-all group">
          <h4 className="text-base font-bold text-white mb-4">
            Margin Details
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shadow-inner group-hover:border-slate-700 transition-colors">
              <div className="text-xs text-slate-500 font-medium">Notional Size</div>
              <div className="text-lg font-bold text-slate-200 mt-1 font-mono">${notional.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shadow-inner group-hover:border-indigo-900/50 transition-colors">
              <div className="text-xs text-slate-500 font-medium">Margin Required</div>
              <div className="text-lg font-bold text-indigo-400 mt-1 font-mono">${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shadow-inner group-hover:border-rose-900/50 transition-colors">
              <div className="text-xs text-slate-500 font-medium">Est. Liquidation</div>
              <div className="text-lg font-bold text-rose-400 mt-1 font-mono">
                {tradeType === 'perp' && positionSize > 0 ? `$${estLiquidation.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shadow-inner group-hover:border-emerald-900/50 transition-colors">
              <div className="text-xs text-slate-500 font-medium">Current Price</div>
              <div className="text-lg font-bold text-emerald-400 mt-1 font-mono">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          {/* Position Targets & Boundaries Visualization */}
          {positionSize > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 pt-5 border-t border-slate-700/50">
              <div className="flex items-center gap-2 mb-4 font-bold text-slate-300">
                Risk Boundaries
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-medium">Entry</span>
                  <span className="text-sm font-bold text-slate-200 mt-2 font-mono">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-medium">Break-even</span>
                  <span className="text-sm font-bold text-slate-300 mt-2 font-mono">
                    ${(side === 'long' || side === 'buy' ? currentPrice * 1.0005 : currentPrice * 0.9995).toLocaleString(undefined, { minimumFractionDigits: assetSymbol === 'DOGE' ? 4 : 2 })}
                  </span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-medium">Profit Goals</span>
                  <div className="space-y-1 mt-2 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-xs">+10%:</span>
                      <span className="text-emerald-400 font-bold">${(side === 'long' || side === 'buy' ? currentPrice * 1.10 : currentPrice * 0.90).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-xs">+25%:</span>
                      <span className="text-emerald-400 font-bold">${(side === 'long' || side === 'buy' ? currentPrice * 1.25 : currentPrice * 0.75).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-rose-950/30 flex flex-col justify-between relative overflow-hidden">
                  <span className="text-xs text-rose-400 font-medium relative z-10">Liquidation</span>
                  <span className="text-sm font-bold text-rose-400 mt-2 relative z-10 font-mono">
                    {tradeType === 'perp' 
                      ? `$${estLiquidation.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Live positions list */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 flex-1 shadow-2xl hover:border-slate-500/50 transition-all">
          <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
            <h4 className="text-base font-bold text-white">
              Positions
            </h4>
            {trades.length > 0 && onClearAllTrades && (
              <button
                onClick={onClearAllTrades}
                className="text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {trades.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500 bg-slate-950/20 rounded-xl border border-slate-900/40">
              No positions recorded under your active bot authorizations. Place an order to execute paper trades.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-medium">
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
                <tbody className="divide-y divide-slate-900/60 font-mono">
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
                    
                    const displayPnl = trade.status === 'OPEN' 
                      ? (isBuy ? currentAssetPrice - trade.price : trade.price - currentAssetPrice) * trade.size * trade.leverage
                      : (trade.pnl || 0);

                    return (
                      <tr key={trade.id} className="hover:bg-slate-950/20 text-slate-300 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 text-xs">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-200 flex items-center gap-1.5 mt-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${trade.status === 'OPEN' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                          {trade.assetSymbol}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-xs text-slate-400">
                          {trade.tradeType === 'perp' ? `${trade.leverage}x Perp` : 'Spot Token'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
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
                          displayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {displayPnl >= 0 ? '+' : ''}${displayPnl.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {trade.status === 'OPEN' ? (
                            <button
                              onClick={() => onCloseTrade && onCloseTrade(trade.id, currentAssetPrice)}
                              className="px-2 py-1 text-xs font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded transition-colors"
                            >
                              SETTLE
                            </button>
                          ) : (
                            <button
                              onClick={() => onDeleteTrade && onDeleteTrade(trade.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete trade"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
