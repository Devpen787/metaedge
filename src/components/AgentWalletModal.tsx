import React, { useState, useEffect } from 'react';
import { X, Wallet, ShieldCheck, Activity, RefreshCw, AlertTriangle, Send, ArrowRightLeft, TrendingUp, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AgentWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AgentWalletModal({ isOpen, onClose }: AgentWalletModalProps) {
  const [token, setToken] = useState('');
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'transfer' | 'swap' | 'perps' | 'predict'>('transfer');

  // Transfer state
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError('');
      
      const statusRes = await fetch('/api/mm/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
        
        if (statusData.isAuthenticated) {
          await fetchWalletInfo();
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletInfo = async () => {
    try {
      const addrRes = await fetch('/api/mm/address');
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        setAddress(addrData.address);
      }

      const balRes = await fetch('/api/mm/balance?chain=8453'); // Base network
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalance(balData);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleLogin = async () => {
    if (!token) {
      setError('Please enter a CLI token');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/mm/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to login');
      }
      
      await checkStatus();
      setToken('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) {
      setError('Missing destination address or amount');
      return;
    }

    try {
      setTransferring(true);
      setError('');
      setTransferResult(null);

      const res = await fetch('/api/mm/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: transferTo,
          amount: transferAmount,
          token: 'native',
          chainId: 8453
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');

      setTransferResult(data);
      await fetchWalletInfo(); // Refresh balance
      setTransferTo('');
      setTransferAmount('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTransferring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shadow-inner">
                <Wallet className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">MetaMask Agent Wallet</h3>
                <p className="text-xs text-orange-400/80 font-mono mt-0.5">Live on-chain execution layer</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors relative z-10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar">
            {error && (
              <div className="mb-6 bg-rose-950/40 border border-rose-900/50 rounded-xl p-4 flex items-start gap-3 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            )}

            {!status?.isAuthenticated ? (
              <div className="space-y-4">
                <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800 shadow-inner">
                  <h4 className="text-sm font-bold text-slate-200 mb-3">Connect Your Wallet</h4>
                  <p className="text-xs text-slate-400 mb-5 leading-relaxed font-mono">
                    You can connect an existing MetaMask Agent Wallet session by pasting your CLI refresh token below. 
                    This enables the MetaEdge platform to execute real on-chain trades via the Base network.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider">CLI Token (cliToken:cliRefreshToken)</label>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Paste your CLI token here..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 font-mono shadow-inner transition-colors"
                      />
                    </div>
                    
                    <button
                      onClick={handleLogin}
                      disabled={loading || !token}
                      className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/50"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                      Authenticate Agent
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800 shadow-inner">
                    <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Status</div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <ShieldCheck className="w-4 h-4" />
                      Connected to Agentic CLI
                    </div>
                  </div>
                  
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800 shadow-inner">
                    <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Network</div>
                    <div className="text-sm font-bold text-white">Base (Chain ID 8453)</div>
                  </div>
                </div>

                <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800 shadow-inner">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">Wallet Address</div>
                    <button onClick={fetchWalletInfo} className="text-slate-500 hover:text-white transition-colors" title="Refresh Wallet">
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="font-mono text-sm text-slate-300 break-all bg-slate-900 p-3 rounded-xl border border-slate-700/50">
                    {address || 'Loading...'}
                  </div>
                </div>

                {balance && (
                  <div className="bg-slate-950/50 rounded-2xl p-5 border border-slate-800 shadow-inner flex justify-between items-end">
                    <div>
                      <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Native Balance</div>
                      <div className="text-4xl font-bold text-white font-mono tracking-tight">
                        {parseFloat(balance.balance).toFixed(4)} <span className="text-slate-500 text-xl font-sans">ETH</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button onClick={() => setActiveTab('transfer')} className={`flex-1 py-2 text-xs font-mono rounded-lg transition-all ${activeTab === 'transfer' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Transfer</button>
                  <button onClick={() => setActiveTab('swap')} className={`flex-1 py-2 text-xs font-mono rounded-lg transition-all ${activeTab === 'swap' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Swap</button>
                  <button onClick={() => setActiveTab('perps')} className={`flex-1 py-2 text-xs font-mono rounded-lg transition-all ${activeTab === 'perps' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Perps</button>
                  <button onClick={() => setActiveTab('predict')} className={`flex-1 py-2 text-xs font-mono rounded-lg transition-all ${activeTab === 'predict' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Predict</button>
                </div>

                {/* Tab Content */}
                <div className="border border-slate-800 rounded-2xl p-5 bg-slate-950/30">
                  {activeTab === 'transfer' && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                        <Send className="w-4 h-4 text-orange-400" />
                        On-Chain Transfer
                      </h4>
                      <div>
                        <label className="block text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Destination Address (0x...)</label>
                        <input type="text" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="0x..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 font-mono shadow-inner" />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Amount (ETH)</label>
                        <input type="number" step="0.0001" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 font-mono shadow-inner" />
                      </div>
                      <button onClick={handleTransfer} disabled={transferring || !transferTo || !transferAmount} className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/50 mt-2">
                        {transferring ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Execute Transfer'}
                      </button>
                      {transferResult && (
                        <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 text-emerald-400 text-xs font-mono whitespace-pre-wrap mt-4 overflow-x-auto">
                          {JSON.stringify(transferResult, null, 2)}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'swap' && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                        Agent Spot Swaps
                      </h4>
                      <div className="text-sm text-slate-400 bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-start gap-3 shadow-inner">
                        <HelpCircle className="w-5 h-5 shrink-0 text-indigo-400" />
                        <div className="space-y-2">
                          <p><strong>Securing Money with Spot:</strong> Swapping to Spot tokens (like USDC or ETH) removes liquidation risk entirely. Agents can automatically swap into stables during high volatility to secure profits.</p>
                          <p>To perform an automated swap, call <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300">/api/mm/swap/quote</code> and then execute via <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300">/api/mm/swap/execute</code>.</p>
                        </div>
                      </div>
                      <button disabled className="w-full bg-slate-800 text-slate-500 font-bold py-3 rounded-xl cursor-not-allowed border border-slate-700 mt-2">
                        Agent Execution Only (See Docs)
                      </button>
                    </div>
                  )}

                  {activeTab === 'perps' && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        Hyperliquid Perpetuals
                      </h4>
                      <div className="text-sm text-slate-400 bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-start gap-3 shadow-inner">
                        <HelpCircle className="w-5 h-5 shrink-0 text-emerald-400" />
                        <div className="space-y-2">
                          <p><strong>Securing Money with Perps:</strong> Leverage multiplies gains but introduces liquidation risk. Agents secure your money by enforcing strict Stop-Loss boundaries and automatically taking profit at predetermined levels.</p>
                          <p>To open an automated position, send a POST request to <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-300">/api/mm/perps/open</code>.</p>
                        </div>
                      </div>
                      <button disabled className="w-full bg-slate-800 text-slate-500 font-bold py-3 rounded-xl cursor-not-allowed border border-slate-700 mt-2">
                        Agent Execution Only (See Docs)
                      </button>
                    </div>
                  )}

                  {activeTab === 'predict' && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-rose-400" />
                        Polymarket Predictions
                      </h4>
                      <div className="text-xs text-slate-500 bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 shrink-0 text-rose-400" />
                        <p>Search prediction markets and place orders on Polymarket. You must fund your predict deposit wallet first. Call <code className="bg-slate-950 px-1 py-0.5 rounded text-rose-300">/api/mm/predict/markets</code> to query available events.</p>
                      </div>
                      <button disabled className="w-full bg-slate-800 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed border border-slate-700 mt-2">
                        Interface Disabled (API Only)
                      </button>
                    </div>
                  )}

                </div>

              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
