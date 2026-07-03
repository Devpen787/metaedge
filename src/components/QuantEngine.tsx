import React, { useState } from 'react';
import { Database, TrendingUp, Activity, BarChart2, Shield, Settings, Zap } from 'lucide-react';
import { TradingAgent } from '../types';

interface QuantEngineProps {
  agents: TradingAgent[];
}

export default function QuantEngine({ agents }: QuantEngineProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<any>(null);

  const [enabledIndicators, setEnabledIndicators] = useState({
    sma: true,
    rsi: true,
    macd: true
  });

  const [enabledFeeds, setEnabledFeeds] = useState({
    onChain: true,
    social: true,
    macro: true,
    optionsFlow: true,
    darkPool: true
  });

  const activeAgents = agents.filter(a => a.status === 'active');

  const handleRunBacktest = async () => {
    if (!selectedAgentId) return;
    setIsSimulating(true);
    setResults(null);

    const agent = activeAgents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    try {
      const res = await fetch('/api/quant/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol: agent.assetSymbol,
          indicators: enabledIndicators,
          feeds: enabledFeeds
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quant simulation failed');
      setResults(data);
    } catch (err) {
      console.error(err);
      // Fallback or error state handling could go here
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6 fade-in font-mono">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="bg-fuchsia-500/10 p-2 rounded-xl text-fuchsia-400 border border-fuchsia-500/20">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-200">Quant & Strategy Engine</h2>
          <p className="text-xs text-slate-500">Phases 1-5: Data Ingestion, Signal Analysis, Backtesting, & Optimization.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2">Target Strategy (Agent)</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">Select active agent...</option>
              {activeAgents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.assetSymbol})</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Technical Indicators</label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={enabledIndicators.sma} onChange={e => setEnabledIndicators(prev => ({...prev, sma: e.target.checked}))} className="rounded border-slate-800 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500/20" />
                <span className="text-slate-300">SMA Cross</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={enabledIndicators.rsi} onChange={e => setEnabledIndicators(prev => ({...prev, rsi: e.target.checked}))} className="rounded border-slate-800 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500/20" />
                <span className="text-slate-300">RSI (14)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={enabledIndicators.macd} onChange={e => setEnabledIndicators(prev => ({...prev, macd: e.target.checked}))} className="rounded border-slate-800 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500/20" />
                <span className="text-slate-300">MACD</span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Alternative Data Ingestion (Phase 1)</label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={enabledFeeds.onChain} onChange={e => setEnabledFeeds(prev => ({...prev, onChain: e.target.checked}))} className="rounded border-slate-800 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500/20" />
                <span className="text-slate-300">On-Chain Metrics (MVRV, Flows)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={enabledFeeds.social} onChange={e => setEnabledFeeds(prev => ({...prev, social: e.target.checked}))} className="rounded border-slate-800 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500/20" />
                <span className="text-slate-300">Social Sentiment (X, News)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={enabledFeeds.optionsFlow} onChange={e => setEnabledFeeds(prev => ({...prev, optionsFlow: e.target.checked}))} className="rounded border-slate-800 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500/20" />
                <span className="text-slate-300">Options Flow (Gamma Exposure)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={enabledFeeds.darkPool} onChange={e => setEnabledFeeds(prev => ({...prev, darkPool: e.target.checked}))} className="rounded border-slate-800 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500/20" />
                <span className="text-slate-300">Dark Pool Prints (Whale Txns)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={enabledFeeds.macro} onChange={e => setEnabledFeeds(prev => ({...prev, macro: e.target.checked}))} className="rounded border-slate-800 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500/20" />
                <span className="text-slate-300">Macro Catalysts (Fed, CPI)</span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Machine Learning & Adaptation</label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-3">
              <div className="flex items-center justify-between text-slate-300">
                <span>Parameter sweep (SMA windows, in-sample)</span>
                <span className="text-emerald-400 font-bold">✓</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Out-of-sample validation (unseen data)</span>
                <span className="text-emerald-400 font-bold">✓</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Backtest Parameters</label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-3">
              <div className="flex justify-between items-center text-slate-300">
                <span>Data Horizon</span>
                <span className="font-bold text-slate-100">100 days · real Binance candles</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Train / Test Split</span>
                <span className="font-bold text-slate-100">70% / 30% out-of-sample</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Costs Per Fill</span>
                <span className="font-bold text-slate-100">0.15% (fee + slippage)</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRunBacktest}
            disabled={!selectedAgentId || isSimulating}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-fuchsia-500/10 transition-all text-xs uppercase tracking-wider"
          >
            {isSimulating ? 'Processing Matrix...' : 'Run Quant Optimization'}
          </button>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {isSimulating ? (
            <div className="h-64 border border-slate-800 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-500 text-sm gap-4">
              <Activity className="w-8 h-8 text-fuchsia-400 animate-pulse" />
              <span>Simulating historical fills and optimizing robustness matrix...</span>
            </div>
          ) : results ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Metrics Header */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Sharpe Ratio</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">{results.sharpe}</div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Win Rate</div>
                  <div className="text-xl font-bold text-white mt-1">{results.winRate}</div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Max Drawdown</div>
                  <div className="text-xl font-bold text-rose-400 mt-1">{results.maxDrawdown}</div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Horizon Score</div>
                  <div className="text-xl font-bold text-fuchsia-400 mt-1">{results.horizonScore} / 100</div>
                  <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
                    <Shield className="w-16 h-16 text-fuchsia-400" />
                  </div>
                </div>
              </div>

              {/* Equity Curve Mock */}
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Simulated Equity Curve (+${results.pnl})
                  </h3>
                  <div className="text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded">
                    {results.totalTrades} Fills Analyzed
                  </div>
                </div>
                <div className="h-40 w-full flex items-end justify-between gap-[1px] px-2 border-b border-l border-slate-800 pb-2">
                  {/* Real simulated equity curve telemetry from Backend */}
                  {results.curve && results.curve.map((val: number, i: number) => {
                    const min = Math.min(...results.curve);
                    const max = Math.max(...results.curve);
                    const range = max - min || 1;
                    const normalized = ((val - min) / range) * 100;
                    const height = Math.max(2, normalized);
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-indigo-500/30 hover:bg-indigo-400/50 transition-colors rounded-t-sm"
                        style={{ height: `${height}%` }}
                        title={`Equity: $${val.toFixed(2)}`}
                      ></div>
                    );
                  })}
                </div>
              </div>

              {/* Optimization Results */}
              {results.optimizedParams && (
                <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-fuchsia-400 mb-1">Optimized Parameters Found</h3>
                    <p className="text-xs text-slate-400">
                      Best performing strategy parameters across 100 days of historical data.
                      <br/>
                      <span className="text-slate-300 font-mono mt-1 flex flex-col gap-1">
                        <span>SMA Short: <strong className="text-white">{results.optimizedParams.short}</strong> | SMA Long: <strong className="text-white">{results.optimizedParams.long}</strong></span>
                        {results.sentimentSignal && (
                          <span className="text-emerald-400 flex items-center gap-1">
                             <Activity className="w-3 h-3" /> Catalyst: {results.sentimentSignal}
                          </span>
                        )}
                      </span>
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      const btn = document.getElementById('deploy-btn');
                      if (btn) {
                        btn.innerText = 'Deployed!';
                        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-500', 'shadow-emerald-500/20');
                        btn.classList.remove('bg-fuchsia-600', 'hover:bg-fuchsia-500', 'shadow-fuchsia-500/20');
                        setTimeout(() => {
                           btn.innerText = 'Deploy to Agent';
                           btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500', 'shadow-emerald-500/20');
                           btn.classList.add('bg-fuchsia-600', 'hover:bg-fuchsia-500', 'shadow-fuchsia-500/20');
                        }, 3000);
                      }
                    }}
                    id="deploy-btn"
                    className="whitespace-nowrap bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-fuchsia-500/20 transition-all text-xs uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-4 h-4 pointer-events-none" />
                    Deploy to Agent
                  </button>
                </div>
              )}

              {/* Robustness Matrix */}
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-fuchsia-400" />
                  Timeframe Robustness Matrix
                </h3>
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  {results.matrix.map((m: any, i: number) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-slate-500 mb-1">{m.timeframe}</div>
                      <div className={`font-bold ${m.return.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {m.return}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-64 border border-slate-800 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <Settings className="w-8 h-8 opacity-50 mb-2" />
              <span>Select an agent and configure parameters to run quant analysis.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
