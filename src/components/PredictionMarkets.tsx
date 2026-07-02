import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, PredictionMarket } from '../types';
import { Landmark, TrendingUp, HelpCircle, AlertCircle, Percent, Coins, ChevronRight, Award, Globe } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface PredictionMarketsProps {
  currentUser: User;
  markets: PredictionMarket[];
  onPlacePredictionBet: (marketId: string, side: 'yes' | 'no', amount: number) => Promise<void>;
  onResolveMarket: (marketId: string, outcome: 'yes' | 'no') => Promise<void>;
}

export default function PredictionMarkets({ currentUser, markets, onPlacePredictionBet, onResolveMarket }: PredictionMarketsProps) {
  // Real-world market discovery (MetaMask → Polymarket fallback, labeled).
  const [liveMarkets, setLiveMarkets] = useState<any[] | null>(null);
  const [liveSource, setLiveSource] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/mm/predict/markets');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) { setLiveMarkets([]); return; }
        setLiveSource(data.source || '');
        if (data.source === 'polymarket') {
          setLiveMarkets((data.markets || []).slice(0, 5));
        } else {
          // MetaMask CLI shape: dig out the market list and normalize lightly.
          const raw = data.markets?.data?.result?.markets || data.markets?.result?.markets || [];
          setLiveMarkets(raw.slice(0, 5).map((m: any) => {
            let prices: number[] = [];
            try { prices = JSON.parse(m.outcomePrices || '[]').map(Number); } catch { /* none */ }
            return { id: m.id, question: m.question, yesPrice: prices[0] ?? null, volume: m.volume ?? m.liquidity ?? null };
          }));
        }
      } catch {
        if (!cancelled) setLiveMarkets([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [selectedMarketId, setSelectedMarketId] = useState('');
  const [betSide, setBetSide] = useState<'yes' | 'no'>('yes');
  const [betAmount, setBetAmount] = useState('1000');
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeMarkets = markets.filter(m => !m.resolved);
  const resolvedMarkets = markets.filter(m => m.resolved);

  const selectedMarket = markets.find(m => m.id === selectedMarketId) || activeMarkets[0];

  const handlePlaceBet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedMarket) {
      setError('Please select a valid prediction market.');
      return;
    }

    const amount = Number(betAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    if (currentUser.paperBalance < amount) {
      setError('Insufficient simulated paper balance to place this bet.');
      return;
    }

    setSubmitting(true);
    try {
      await onPlacePredictionBet(selectedMarket.id, betSide, amount);
      setSuccess(`Successfully placed a simulated $${amount.toLocaleString()} ${betSide.toUpperCase()} bet!`);
      setBetAmount('');
    } catch (err: any) {
      setError(err.message || 'Failed to place prediction bet.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveMarket = async (marketId: string, outcome: 'yes' | 'no') => {
    setError('');
    setSuccess('');
    setResolving(true);
    try {
      await onResolveMarket(marketId, outcome);
      setSuccess(`Simulated market resolved with outcome: ${outcome.toUpperCase()}! Winning pools credited.`);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve market.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 fade-in">
      
      {/* Bet Form / Interactive market focus */}
      <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
        {selectedMarket ? (
          <form onSubmit={handlePlaceBet} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-indigo-400" />
                Prediction Pool Terminal
              </h3>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase">
                {selectedMarket.category}
              </span>
            </div>

            {/* Selected market header */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900">
              <h4 className="text-xs font-bold text-white font-mono leading-relaxed">{selectedMarket.question}</h4>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-4">
                <span>Total Volume: ${selectedMarket.volume?.toLocaleString()}</span>
                <span>Ends: {new Date(selectedMarket.endTime).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Toggle bet side */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBetSide('yes')}
                className={`py-2 text-xs font-mono font-bold rounded-xl transition-all border ${
                  betSide === 'yes' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                PREDICT YES ({(selectedMarket.yesPool / (selectedMarket.yesPool + selectedMarket.noPool) * 100).toFixed(0)}% odds)
              </button>
              <button
                type="button"
                onClick={() => setBetSide('no')}
                className={`py-2 text-xs font-mono font-bold rounded-xl transition-all border ${
                  betSide === 'no' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-slate-950/20 text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                PREDICT NO ({(selectedMarket.noPool / (selectedMarket.yesPool + selectedMarket.noPool) * 100).toFixed(0)}% odds)
              </button>
            </div>

            {/* Bet Input size */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                <span>Collateral Amount</span>
                <span>Balance: ${currentUser.paperBalance?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="100"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-mono text-slate-500">USD</span>
              </div>
            </div>

            {/* Expected shares */}
            <div className="bg-slate-950/20 p-3 rounded-xl border border-slate-900/60 font-mono text-[11px] space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>Est. Shares Purchased:</span>
                <span className="text-white font-bold">
                  {(Number(betAmount) / (betSide === 'yes' ? (selectedMarket.yesPool / (selectedMarket.yesPool + selectedMarket.noPool)) : (selectedMarket.noPool / (selectedMarket.yesPool + selectedMarket.noPool))) || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Share Price:</span>
                <span className="text-indigo-400">
                  ${(betSide === 'yes' ? (selectedMarket.yesPool / (selectedMarket.yesPool + selectedMarket.noPool)) : (selectedMarket.noPool / (selectedMarket.yesPool + selectedMarket.noPool))).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-mono text-xs font-bold text-white shadow-lg shadow-indigo-500/10 transition-all cursor-pointer disabled:opacity-40"
            >
              {submitting ? 'Streaming Bet Contract...' : 'CONFIRM SIMULATED POSITION'}
            </button>

            {error && <p className="text-[11px] text-rose-400 font-mono text-center">{error}</p>}
            {success && <p className="text-[11px] text-emerald-400 font-mono text-center">{success}</p>}

            {/* Dev-only resolution trigger — hidden from players; markets settle
                at their end date. Enable locally with VITE_DEV_TOOLS=true. */}
            {(import.meta as any).env?.VITE_DEV_TOOLS === 'true' && (
              <div className="pt-4 border-t border-slate-800 mt-4 space-y-2.5">
                <h5 className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Dev: Force Resolution</h5>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleResolveMarket(selectedMarket.id, 'yes')} disabled={resolving}
                    className="flex-1 py-1.5 text-[10px] font-mono font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-all">
                    Resolve YES
                  </button>
                  <button type="button" onClick={() => handleResolveMarket(selectedMarket.id, 'no')} disabled={resolving}
                    className="flex-1 py-1.5 text-[10px] font-mono font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-all">
                    Resolve NO
                  </button>
                </div>
              </div>
            )}
          </form>
        ) : (
          <div className="text-center py-12 text-xs text-slate-500 font-mono">
            No active markets. Select or seed one on the right!
          </div>
        )}

        <div className="text-[10px] font-mono text-slate-500 bg-slate-950/20 p-3 rounded-xl border border-slate-900/30 mt-4 text-center">
          Decentralized pool pricing derived from current liquidity allocations.
        </div>
      </div>

      {/* Markets List catalog */}
      <div className="lg:col-span-7 flex flex-col gap-6">

        {/* Live real-world markets — discovery strip, honestly labeled by source. */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-orange-400" />
              Live Markets
            </h4>
            {liveSource && (
              <span className="text-[10px] font-mono text-slate-500">
                via {liveSource === 'metamask' ? 'MetaMask Agent Wallet' : 'Polymarket (MetaMask unavailable)'}
              </span>
            )}
          </div>
          {liveMarkets === null ? (
            <div className="text-[11px] font-mono text-slate-500">Loading real markets…</div>
          ) : liveMarkets.length === 0 ? (
            <div className="text-[11px] font-mono text-slate-500">Live markets are unavailable right now — paper pools below still work.</div>
          ) : (
            <div className="space-y-1.5">
              {liveMarkets.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 text-[11px] font-mono bg-slate-950/30 rounded-lg px-3 py-2 border border-slate-900/50">
                  <span className="text-slate-300 truncate">{m.question}</span>
                  <span className="shrink-0 text-slate-500">
                    {m.yesPrice != null && <span className="text-emerald-400">YES {(Number(m.yesPrice) * 100).toFixed(0)}¢</span>}
                    {m.volume != null && <span className="ml-2">vol ${Math.round(Number(m.volume)).toLocaleString()}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Markets Panel */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex-1">
          <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Active Prediction Pools
          </h4>

          {activeMarkets.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500 font-mono bg-slate-950/20 rounded-xl border border-slate-900/40">
              No active prediction pools remaining.
            </div>
          ) : (
            <div className="space-y-4">
              {activeMarkets.map((market) => {
                const totalPool = market.yesPool + market.noPool || 1;
                const yesPercent = (market.yesPool / totalPool) * 100;
                const isSelected = selectedMarket && selectedMarket.id === market.id;

                return (
                  <div
                    key={market.id}
                    onClick={() => setSelectedMarketId(market.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer font-mono text-xs shadow-sm ${
                      isSelected
                        ? 'bg-indigo-950/20 border-indigo-500/40 shadow-indigo-500/5'
                        : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <h5 className={`font-bold leading-relaxed text-sm ${isSelected ? 'text-white' : 'text-slate-200'}`}>{market.question}</h5>
                      <span className="text-[9px] bg-slate-900/80 px-2.5 py-1 rounded-md text-slate-400 uppercase tracking-wider shrink-0 border border-slate-800">
                        {market.category}
                      </span>
                    </div>

                    {/* Bar visual odds */}
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-emerald-400">YES {yesPercent.toFixed(0)}%</span>
                        <span className="text-rose-400">NO {(100 - yesPercent).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${yesPercent}%` }}></div>
                        <div className="bg-rose-500 h-full flex-1 transition-all duration-500"></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-5 pt-3 border-t border-slate-800/50">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-600 uppercase tracking-wider">Volume</span>
                        <span className="text-slate-300 font-bold">${market.volume?.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-slate-600 uppercase tracking-wider">Your Shares</span>
                        <span className="text-indigo-400 font-bold">{market.bets[currentUser.id] ? (market.bets[currentUser.id].yesShares + market.bets[currentUser.id].noShares).toFixed(0) : 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resolved Markets Panel */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
          <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-indigo-400" />
            Recently Resolved Predictions
          </h4>

          {resolvedMarkets.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 font-mono">
              No recently resolved markets in this cooperative space yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {resolvedMarkets.map((market) => {
                const isWinnerYes = market.outcome === 'yes';
                return (
                  <div key={market.id} className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl font-mono text-xs flex justify-between items-center transition-all hover:bg-slate-950/60">
                    <div>
                      <div className="text-slate-300 font-bold line-clamp-1">{market.question}</div>
                      <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Resolved: {new Date(market.endTime).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-inner ${
                        isWinnerYes ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        Winner: {market.outcome?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
