import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, AlertTriangle, Wallet, Check, Ban, Settings, RefreshCw, KeyRound } from 'lucide-react';
import { WalletState } from '../types';
import { apiFetch } from '../lib/api';

interface ReadinessSheetProps {
  onClose: () => void;
  onStayPaper: () => void;
}

export default function ReadinessSheet({ onClose, onStayPaper }: ReadinessSheetProps) {
  const [walletState, setWalletState] = useState<WalletState>({
    isInstalled: false,
    isConnected: false
  });

  const [riskLimit, setRiskLimit] = useState('500');
  const [safetyCleared, setSafetyCleared] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [agentWalletChecks, setAgentWalletChecks] = useState<any[]>([]);
  const [agentWalletMessage, setAgentWalletMessage] = useState('');

  // Check if MetaMask is present in window object.
  const checkMetaMask = () => {
    setCheckingWallet(true);
    setTimeout(() => {
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        setWalletState({
          isInstalled: true,
          isConnected: ethereum.selectedAddress ? true : false,
          address: ethereum.selectedAddress || undefined,
          chainId: ethereum.chainId ? parseInt(ethereum.chainId, 16) : undefined,
          balanceEth: 0.12 // Mock safe balance
        });
      } else {
        setWalletState({
          isInstalled: false,
          isConnected: false
        });
      }
      setCheckingWallet(false);
    }, 800);
  };

  useEffect(() => {
    checkMetaMask();
    checkAgentWallet();
  }, []);

  const checkAgentWallet = async () => {
    try {
      setAgentWalletMessage('');
      const res = await apiFetch('/api/mm/readiness');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not check Agent Wallet readiness.');
      setAgentWalletChecks(data.checks || []);
    } catch (err: any) {
      setAgentWalletMessage(err.message || 'Agent Wallet readiness is not available yet.');
    }
  };

  const triggerConnect = async () => {
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      try {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setWalletState({
            isInstalled: true,
            isConnected: true,
            address: accounts[0],
            balanceEth: 0.12
          });
        }
      } catch (err) {
        console.error('MetaMask connection rejected', err);
      }
    } else {
      alert('MetaMask is not installed in this browser session. Please install it or proceed in Paper Mode.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative space-y-6"
      >
        {/* Warning Header */}
        <div className="flex items-start gap-4 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-400 font-mono">Live review</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Live mode stays locked until MetaMask browser login, Agent Wallet checks, policy limits, quote preview, and human approval are ready. No action moves funds silently.
            </p>
            <p className="text-[11px] text-amber-300 font-mono mt-2">Needs MetaMask approval before any real transaction.</p>
          </div>
        </div>

        {/* Dynamic Checklist Grid */}
        <div className="space-y-4">
          <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            MetaMask readiness
          </h4>

          {/* Gate 1: MetaMask Installation */}
          <div className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${walletState.isInstalled ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                <Wallet className={`w-4 h-4 ${walletState.isInstalled ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
              <div>
                <p className="text-xs font-mono font-medium text-slate-200">MetaMask extension</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {walletState.isInstalled ? 'Detected' : 'Not detected in this browser'}
                </p>
              </div>
            </div>
            {walletState.isInstalled ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <Check className="w-3 h-3" /> Ready
              </span>
            ) : (
              <button
                onClick={checkMetaMask}
                disabled={checkingWallet}
                className="text-[10px] font-mono bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/30 transition-all cursor-pointer"
              >
                {checkingWallet ? 'Scanning...' : 'Scan Again'}
              </button>
            )}
          </div>

          {/* Gate 2: MetaMask Connection */}
          <div className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${walletState.isConnected ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                <ShieldCheck className={`w-4 h-4 ${walletState.isConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
              <div>
                <p className="text-xs font-mono font-medium text-slate-200">Wallet connected</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {walletState.isConnected ? `Connected: ${walletState.address?.slice(0, 6)}...${walletState.address?.slice(-4)}` : 'Disconnected'}
                </p>
              </div>
            </div>
            {walletState.isConnected ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <Check className="w-3 h-3" /> Connected
              </span>
            ) : (
              <button
                onClick={triggerConnect}
                disabled={!walletState.isInstalled}
                className="text-[10px] font-mono bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-indigo-500/10 transition-all disabled:opacity-50 cursor-pointer"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Agent Wallet v3 checks */}
          {agentWalletChecks.map((check) => {
            const ready = check.status === 'ready';
            return (
              <div key={check.id} className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${ready ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                    {check.id === 'browser_login' ? (
                      <KeyRound className={`w-4 h-4 ${ready ? 'text-emerald-400' : 'text-amber-400'}`} />
                    ) : (
                      <ShieldCheck className={`w-4 h-4 ${ready ? 'text-emerald-400' : 'text-amber-400'}`} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-mono font-medium text-slate-200">{check.label}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{check.summary}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-full border ${
                  ready ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}>
                  {ready ? <Check className="w-3 h-3" /> : null}
                  {ready ? 'Ready' : 'Needs review'}
                </span>
              </div>
            );
          })}

          {agentWalletMessage && (
            <div className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-mono font-medium text-slate-200">Agent Wallet check</p>
                  <p className="text-[10px] text-slate-500 font-mono">{agentWalletMessage}</p>
                </div>
              </div>
              <button
                onClick={checkAgentWallet}
                className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-all cursor-pointer"
              >
                Check again
              </button>
            </div>
          )}

          {/* Gate 3: Live Mode Lock */}
          <div className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-rose-500/10">
                <Ban className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p className="text-xs font-mono font-medium text-slate-200">Live locked</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Real execution is disabled for this build.
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
              Locked
            </span>
          </div>
        </div>

        {/* Set Risk Policy Limit */}
        <div className="bg-slate-950/30 border border-slate-800/60 p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Settings className="w-4 h-4 text-indigo-400" />
            Set risk limit for Live review
          </div>
          <div className="flex gap-2">
            {['100', '500', '2000', '5000'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setRiskLimit(val)}
                className={`flex-1 py-1 text-xs font-mono rounded-lg border transition-all ${
                  riskLimit === val
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                ${Number(val).toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Checkbox agreements */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={safetyCleared}
              onChange={(e) => setSafetyCleared(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 outline-none"
            />
            <span className="text-[11px] text-slate-400 font-mono leading-relaxed">
              I acknowledge that I am testing simulated copy trading in a paper environment. I will not put actual funds in jeopardy until code safety audits are fully completed.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={policyAccepted}
              onChange={(e) => setPolicyAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 outline-none"
            />
            <span className="text-[11px] text-slate-400 font-mono leading-relaxed">
              I accept that vault clubs are paper/read-only coordination spaces and do not involve pooling, custodial trust, or guaranteed yields.
            </span>
          </label>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800/80">
          <button
            onClick={onStayPaper}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-medium transition-all text-center"
          >
            Stay in Paper Mode
          </button>
          <button
            disabled={true} // Strict requirement: LIVE is locked in V1
            className="flex-1 py-2.5 bg-rose-500/20 text-rose-400/80 border border-rose-500/30 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
          >
            Live Locked <Ban className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
