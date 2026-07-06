import React, { useEffect, useMemo, useState } from 'react';
import { X, Wallet, RefreshCw, AlertTriangle, KeyRound, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';

// The wallet modal is a CONNECTION card, nothing more. Trading lives in the
// Trading Desk, markets in Predictions — this modal answers two questions:
// "am I plugged in?" and "am I ready to go live?"

interface AgentWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckStatus = 'ready' | 'blocked' | 'unknown';

interface ReadinessCheck {
  id: string;
  label: string;
  status: CheckStatus;
  summary: string;
  command?: string;
}

interface MetaMaskReadiness {
  liveModeGlobalLock: boolean;
  checks: ReadinessCheck[];
  wallet?: { address: string | null; baseBalanceReady: boolean };
}

const statusStyles: Record<CheckStatus, string> = {
  ready: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  blocked: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  unknown: 'text-slate-300 bg-slate-500/10 border-slate-500/20'
};

export default function AgentWalletModal({ isOpen, onClose }: AgentWalletModalProps) {
  const [readiness, setReadiness] = useState<MetaMaskReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  // The token path gets its OWN loading flag: the browser-connect flow holds
  // `loading` true for up to 5 min while it polls, which must not disable the
  // token Connect button — the two paths are alternatives, not a sequence.
  const [tokenLoading, setTokenLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [connected, setConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | undefined>(undefined);
  const [connectPolling, setConnectPolling] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string | undefined>(undefined);
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenField, setShowTokenField] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  const paperMode = readiness?.liveModeGlobalLock ?? true;
  const readyCount = useMemo(
    () => readiness?.checks.filter((c) => c.status === 'ready').length ?? 0,
    [readiness]
  );
  const totalChecks = readiness?.checks.length ?? 0;

  async function loadReadiness() {
    try {
      const res = await apiFetch('/api/mm/readiness');
      const data = await res.json();
      if (res.ok) setReadiness(data);
    } catch {
      /* readiness stays unknown */
    }
  }

  async function checkStatus() {
    try {
      const res = await apiFetch('/api/mm/connect/status');
      const s = await res.json();
      setConnected(!!s.connected);
      setConnectedAddress(s.address || undefined);
      return !!s.connected;
    } catch {
      return false;
    }
  }

  // Connect flow: fetch a MetaMask login link, SHOW it as a button the user
  // clicks themselves (popup blockers eat window.open calls that happen after
  // an await), and poll until their per-user profile is authenticated.
  async function startConnect() {
    try {
      setLoading(true);
      setMessage('');
      const res = await apiFetch('/api/mm/connect/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.loginUrl) throw new Error(data.message || 'Could not start MetaMask login. Try again in a few seconds.');
      setLoginUrl(data.loginUrl);
      setConnectPolling(true);
      // Poll in the background while the user completes login in their tab.
      // 6s interval × 50 ≈ 5 min: gentle on the server (each status check spawns
      // the MetaMask CLI), still snappy enough to feel instant after approval.
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 6000));
        if (await checkStatus()) {
          setLoginUrl(undefined);
          await finishConnect();
          return;
        }
      }
      setMessage('Still not connected — click the sign-in link again, or use a CLI token.');
    } catch (error: any) {
      setMessage(error.message || 'Could not start MetaMask login.');
    } finally {
      setConnectPolling(false);
      setLoading(false);
    }
  }

  // Pro path: a pre-minted CLI token, used once server-side and never stored.
  async function connectWithToken() {
    if (!tokenInput.trim()) return;
    try {
      setTokenLoading(true);
      setMessage('');
      const res = await apiFetch('/api/mm/connect/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.connected) throw new Error(data.message || data.error || 'Token login failed.');
      setTokenInput('');
      setConnected(true);
      setConnectedAddress(data.address || undefined);
      await finishConnect();
    } catch (error: any) {
      setMessage(error.message || 'Token login failed.');
    } finally {
      setTokenLoading(false);
    }
  }

  async function finishConnect() {
    setMessage('Connected — you can now compete in the Arena.');
    window.dispatchEvent(new Event('wallet-connected'));
    await loadReadiness();
  }

  async function disconnectWallet() {
    try {
      setLoading(true);
      await apiFetch('/api/mm/connect/disconnect', { method: 'POST' });
      setConnected(false);
      setConnectedAddress(undefined);
      setMessage('');
      window.dispatchEvent(new Event('wallet-connected'));
      await loadReadiness();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      checkStatus();
      loadReadiness();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const shortAddr = connectedAddress ? `${connectedAddress.slice(0, 6)}…${connectedAddress.slice(-4)}` : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        >
          <div className="flex justify-between items-center p-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-white">MetaMask Agent Wallet</h3>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
            {!connected ? (
              <>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Bring your own wallet. Connecting lets you compete in the Agent Arena — and switch to Live trading when you're ready.
                </p>
                {!loginUrl ? (
                  <button
                    onClick={startConnect}
                    disabled={loading || connectPolling}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white font-bold px-5 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
                  >
                    {loading || connectPolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {loading || connectPolling ? 'Getting your sign-in link…' : 'Connect your MetaMask'}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <a
                      href={loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
                    >
                      <KeyRound className="w-4 h-4" /> Open MetaMask sign-in ↗
                    </a>
                    <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-2">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Sign in on that page — this screen updates by itself.
                    </p>
                  </div>
                )}
                <button onClick={() => setShowTokenField(!showTokenField)} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">
                  or use a CLI token
                </button>
                {showTokenField && (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste your CLI token (used once, never stored)"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-orange-500/50 focus:outline-none"
                    />
                    <button
                      onClick={connectWithToken}
                      disabled={tokenLoading || !tokenInput.trim()}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {tokenLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {tokenLoading ? 'Connecting…' : 'Connect'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-sm font-bold text-white font-mono">{shortAddr || 'Wallet connected'}</div>
                    <div className="text-xs text-slate-400">{paperMode ? 'Paper mode — trades simulate, standings are real' : 'LIVE mode — real execution'}</div>
                  </div>
                </div>
                <button onClick={disconnectWallet} disabled={loading} className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50">
                  Disconnect
                </button>
              </div>
            )}

            {message && (
              <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-3 flex items-start gap-2 text-amber-200 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{message}</div>
              </div>
            )}

            {/* Go-Live checklist, collapsed by default. */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowChecklist(!showChecklist)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-950/60 hover:bg-slate-950 transition-colors"
              >
                <span className="text-sm font-bold text-slate-200">Go-Live checklist</span>
                <span className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  {totalChecks ? `${readyCount}/${totalChecks} ready` : '…'}
                  {showChecklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>
              {showChecklist && (
                <div className="divide-y divide-slate-800/60">
                  {readiness?.checks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{check.label}</p>
                        <p className="text-[11px] text-slate-500">{check.summary}</p>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${statusStyles[check.status]}`}>
                        {check.status === 'ready' ? 'Ready' : 'Not yet'}
                      </span>
                    </div>
                  ))}
                  {!readiness && <div className="px-4 py-3 text-xs text-slate-500">Checking…</div>}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Trade in the Trading Desk, bet in Predictions, compete in the Arena — everything runs on your wallet once connected. No keys or secrets ever touch MetaEdge.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
