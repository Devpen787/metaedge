import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, AlertTriangle, Check, Ban, KeyRound, Wallet } from 'lucide-react';
import { apiFetch, safeJson } from '../lib/api';

// The Live gate. ONE wallet concept everywhere: your MetaMask Agent Wallet
// (the same connection the Wallet button manages). No browser-extension
// detection, no decorative controls — real checks, real lock, one next step.

interface ReadinessSheetProps {
  onGoLive?: () => void;
  onClose: () => void;
  onStayPaper: () => void;
}

interface ReadinessCheck {
  id: string;
  label: string;
  status: 'ready' | 'blocked' | 'unknown';
  summary: string;
}

export default function ReadinessSheet({ onClose, onStayPaper, onGoLive }: ReadinessSheetProps) {
  const [checks, setChecks] = useState<ReadinessCheck[] | null>(null);
  const [liveLocked, setLiveLocked] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/mm/readiness');
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.message || 'Could not check readiness.');
        setChecks(data.checks || []);
        setLiveLocked(data.liveModeGlobalLock !== false);
      } catch (err: any) {
        setError(err.message || 'Readiness is not available right now.');
        setChecks([]);
      }
    })();
  }, []);

  const walletConnected = checks?.find((c) => c.id === 'wallet_connected')?.status === 'ready';
  const readyCount = checks?.filter((c) => c.status === 'ready').length ?? 0;

  const openWalletConnect = () => {
    onClose();
    window.dispatchEvent(new Event('open-wallet-modal'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" onClick={onStayPaper}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative space-y-5"
      >
        {/* What Live means, honestly */}
        <div className="flex items-start gap-4 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-400 font-mono">Going Live</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Live mode executes real transactions from your own MetaMask Agent Wallet, with policy limits and approvals on your phone. {liveLocked
                ? <>It is <b>locked for this account</b> — paper mode has everything else: real prices, real quotes, real competition.</>
                : <>It is <b>ENABLED for your account</b> — actions below will move real funds from your Agent Wallet. Your MetaMask policy limits and phone approvals still apply.</>}
            </p>
          </div>
        </div>

        {/* Step 1: the ONE wallet connection (same as the Wallet button) */}
        <div className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${walletConnected ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
              <Wallet className={`w-4 h-4 ${walletConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <div>
              <p className="text-xs font-mono font-medium text-slate-200">Your MetaMask Agent Wallet</p>
              <p className="text-[10px] text-slate-500 font-mono">
                {checks === null ? 'Checking…' : walletConnected ? 'Connected — you can compete now' : 'Not connected yet'}
              </p>
            </div>
          </div>
          {walletConnected ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <Check className="w-3 h-3" /> Connected
            </span>
          ) : (
            <button
              onClick={openWalletConnect}
              className="text-[10px] font-mono bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-orange-900/30 transition-all flex items-center gap-1.5"
            >
              <KeyRound className="w-3 h-3" /> Connect
            </button>
          )}
        </div>

        {/* Step 2: the go-live checklist (real, per-user) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Go-Live checklist</h4>
            <span className="text-[10px] font-mono text-slate-500">{checks === null ? '…' : `${readyCount}/${checks.length} ready`}</span>
          </div>
          <div className="max-h-52 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60 border border-slate-800/80 rounded-xl bg-slate-950/40">
            {checks === null && <div className="p-3.5 text-[11px] font-mono text-slate-500">Checking your wallet profile…</div>}
            {checks?.map((check) => (
              <div key={check.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div>
                  <p className="text-xs font-mono font-medium text-slate-200">{check.label}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{check.summary}</p>
                </div>
                <span className={`shrink-0 flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  check.status === 'ready' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}>
                  {check.status === 'ready' && <Check className="w-3 h-3" />}
                  {check.status === 'ready' ? 'Ready' : 'Not yet'}
                </span>
              </div>
            ))}
            {error && <div className="p-3.5 text-[11px] font-mono text-amber-300">{error}</div>}
          </div>
        </div>

        {/* Step 3: the lock — per-account truth, not a hardcoded assumption */}
        <div className={`flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border ${liveLocked ? 'border-slate-800/80' : 'border-emerald-800/60'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${liveLocked ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}>
              <Ban className={`w-4 h-4 ${liveLocked ? 'text-rose-400' : 'text-emerald-400'}`} />
            </div>
            <div>
              <p className="text-xs font-mono font-medium text-slate-200">Live execution</p>
              <p className="text-[10px] text-slate-500 font-mono">{liveLocked ? 'Locked for this account — no real funds can move.' : 'ENABLED for your account — live actions move real funds from your Agent Wallet.'}</p>
            </div>
          </div>
          {liveLocked
            ? <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">Locked</span>
            : <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">Enabled</span>}
        </div>

        <p className="text-[10px] text-slate-600 font-mono leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
          Paper trading uses simulated fills only. Vault clubs are read-only coordination spaces — no pooling, no custody, no implied yields.
        </p>

        {!liveLocked && onGoLive && (
          <button
            onClick={onGoLive}
            className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold transition-all"
          >
            ENTER LIVE MODE — real funds, your approval on every action
          </button>
        )}
        <button
          onClick={onStayPaper}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition-all"
        >
          Keep competing in Paper Mode
        </button>
      </motion.div>
    </div>
  );
}
