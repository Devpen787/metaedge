import React, { useEffect, useMemo, useState } from 'react';
import { X, Wallet, ShieldCheck, Activity, RefreshCw, AlertTriangle, ArrowRightLeft, TrendingUp, Lock, KeyRound, Send, Search, Play, Zap, FlaskConical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';

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
  loginCommand: string;
  package: string;
  recommendedMode: string;
  checks: ReadinessCheck[];
  wallet?: {
    address: string | null;
    baseBalanceReady: boolean;
  };
  capabilities: {
    swaps: { quoteBeforeExecute: boolean; refuelSupported: boolean; executeLocked: boolean };
    perps: { venuesCommand: string; depositRequired: boolean; quoteBeforeOpen: boolean; openLocked: boolean };
    predictionMarkets: { setupRequired: boolean; quoteBeforePlace: boolean; placeLocked: boolean };
  };
}

const tabs = [
  { id: 'readiness', label: 'Readiness', icon: ShieldCheck },
  { id: 'overview', label: 'Overview', icon: Wallet },
  { id: 'swap', label: 'Swaps', icon: ArrowRightLeft },
  { id: 'perps', label: 'Perps', icon: TrendingUp },
  { id: 'predict', label: 'Markets', icon: Activity }
] as const;

type ActiveTab = (typeof tabs)[number]['id'];

const statusStyles: Record<CheckStatus, string> = {
  ready: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  blocked: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  unknown: 'text-slate-300 bg-slate-500/10 border-slate-500/20'
};

function StatusPill({ status }: { status: CheckStatus }) {
  return (
    <span className={`text-[10px] font-mono px-2 py-1 rounded-full border ${statusStyles[status]}`}>
      {status === 'ready' ? 'Ready' : status === 'blocked' ? 'Needs review' : 'Unknown'}
    </span>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{label}</span>
      <input
        {...props}
        className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-orange-500/50 focus:outline-none transition-colors disabled:opacity-50"
      />
    </label>
  );
}

// A read-only capability preview: fires a real endpoint, shows the returned data
// or the error. This is what makes a capability genuinely "reachable" from the UI.
function Preview({ error, data, empty }: { error?: string; data?: any; empty?: string }) {
  if (error) {
    return (
      <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-3 flex items-start gap-2 text-amber-200 text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <div>{error}</div>
      </div>
    );
  }
  if (data === undefined || data === null) {
    return <div className="text-xs text-slate-500 font-mono">{empty || 'No preview yet.'}</div>;
  }
  return (
    <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-emerald-200/90 font-mono overflow-x-auto max-h-52 custom-scrollbar">
      {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

// An execute affordance. In paper mode it's ACTIVE and runs a simulated fill —
// paper is a first-class path competitions run on. In live mode it executes for
// real (orange). It is never a dead button.
function ExecuteButton({ label, paperMode, loading, onRun }: { label: string; paperMode: boolean; loading: boolean; onRun: () => void }) {
  return (
    <button
      onClick={onRun}
      disabled={loading}
      className={`w-full py-2.5 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
        paperMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-orange-600 hover:bg-orange-500 text-white'
      }`}
    >
      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : paperMode ? <Play className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
      {paperMode ? `Simulate ${label} (paper)` : `${label} — LIVE`}
    </button>
  );
}

export default function AgentWalletModal({ isOpen, onClose }: AgentWalletModalProps) {
  const [readiness, setReadiness] = useState<MetaMaskReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('readiness');
  const [message, setMessage] = useState('');

  // Overview (status + address + balance)
  const [overview, setOverview] = useState<{ error?: string; status?: any; address?: string; balance?: any } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');

  // Swap quote
  const [swapForm, setSwapForm] = useState({ from: 'USDC', to: 'WETH', amount: '10' });
  const [swapQuote, setSwapQuote] = useState<{ error?: string; data?: any }>({});
  const [swapLoading, setSwapLoading] = useState(false);

  // Perps
  const [perpsBal, setPerpsBal] = useState<{ error?: string; data?: any }>({});
  const [perpsForm, setPerpsForm] = useState({ symbol: 'ETH', side: 'long', size: '0.1', leverage: '2' });
  const [perpsQuote, setPerpsQuote] = useState<{ error?: string; data?: any }>({});
  const [perpsLoading, setPerpsLoading] = useState(false);

  // Predict
  const [predictQuery, setPredictQuery] = useState('crypto');
  const [predictMarkets, setPredictMarkets] = useState<{ error?: string; data?: any }>({});
  const [predictForm, setPredictForm] = useState({ tokenId: '', side: 'buy', size: '10' });
  const [predictQuote, setPredictQuote] = useState<{ error?: string; data?: any }>({});
  const [predictLoading, setPredictLoading] = useState(false);

  // Execute results (simulated fills in paper mode, real fills in live mode).
  const [execResult, setExecResult] = useState<Record<string, { error?: string; data?: any }>>({});
  const [execLoading, setExecLoading] = useState<string>('');

  const blockedCount = useMemo(
    () => readiness?.checks.filter((check) => check.status === 'blocked').length ?? 0,
    [readiness]
  );
  const walletAddress = readiness?.wallet?.address;
  // Paper mode = live execution is globally locked. In paper mode every execute
  // action runs as a simulation instead of being disabled.
  const paperMode = readiness?.liveModeGlobalLock ?? true;

  async function loadReadiness() {
    try {
      setLoading(true);
      setMessage('');
      const res = await apiFetch('/api/mm/readiness');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Could not check MetaMask readiness.');
      setReadiness(data);
    } catch (error: any) {
      setMessage(error.message || 'Could not check MetaMask readiness.');
    } finally {
      setLoading(false);
    }
  }

  async function requestBrowserLogin() {
    try {
      setLoading(true);
      const res = await apiFetch('/api/mm/login-browser', { method: 'POST' });
      const data = await res.json();
      setMessage(data.message || `Run ${data.command || 'mm login browser'} locally.`);
      await loadReadiness();
    } catch (error: any) {
      setMessage(error.message || 'Run MetaMask browser login locally.');
    } finally {
      setLoading(false);
    }
  }

  // Small helper: GET/POST an mm endpoint and normalise into { error?, data? }.
  async function callMm(path: string, init?: RequestInit, pick?: (d: any) => any) {
    const res = await apiFetch(path, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.message || body.error || `Request failed (${res.status}).` };
    return { data: pick ? pick(body) : body };
  }

  // The address endpoint returns the raw CLI text, which can be a JSON blob like
  // {"ok":true,"data":{"address":"0x…"}}. Dig out the actual 0x address.
  function normalizeAddress(raw: any): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    if (trimmed.startsWith('0x')) return trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed?.data?.address || parsed?.address || undefined;
    } catch {
      const m = trimmed.match(/0x[a-fA-F0-9]{40}/);
      return m ? m[0] : undefined;
    }
  }

  async function loadOverview() {
    setOverviewLoading(true);
    try {
      const [status, address, balance] = await Promise.all([
        callMm('/api/mm/status'),
        callMm('/api/mm/address', undefined, (d) => normalizeAddress(d.address)),
        callMm('/api/mm/balance', undefined, (d) => d.balance)
      ]);
      const firstErr = status.error && address.error && balance.error ? status.error : undefined;
      setOverview({
        error: firstErr,
        status: status.data,
        address: address.data,
        balance: balance.data
      });
    } finally {
      setOverviewLoading(false);
    }
  }

  async function getSwapQuote() {
    setSwapLoading(true);
    setSwapQuote(await callMm('/api/mm/swap/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(swapForm)
    }, (d) => d.quote));
    setSwapLoading(false);
  }

  async function getPerpsBalance() {
    setPerpsBal(await callMm('/api/mm/perps/balance', undefined, (d) => d.balance));
  }

  async function getPerpsQuote() {
    setPerpsLoading(true);
    setPerpsQuote(await callMm('/api/mm/perps/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(perpsForm)
    }, (d) => d.quote));
    setPerpsLoading(false);
  }

  async function searchMarkets() {
    setPredictLoading(true);
    setPredictMarkets(await callMm(`/api/mm/predict/markets?query=${encodeURIComponent(predictQuery)}`, undefined, (d) => d.markets));
    setPredictLoading(false);
  }

  async function getPredictQuote() {
    setPredictLoading(true);
    setPredictQuote(await callMm('/api/mm/predict/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(predictForm)
    }, (d) => d.quote));
    setPredictLoading(false);
  }

  // Run an execute action. In paper mode the backend returns a simulated fill;
  // in live mode it performs the real transaction.
  async function runExec(key: string, path: string, payload: any) {
    setExecLoading(key);
    const result = await callMm(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setExecResult((prev) => ({ ...prev, [key]: result }));
    setExecLoading('');
  }

  useEffect(() => {
    if (isOpen) {
      setActiveTab('readiness');
      loadReadiness();
    }
  }, [isOpen]);

  // Lazy-load a tab's live data the first time it's opened.
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'overview' && !overview && !overviewLoading) loadOverview();
    if (activeTab === 'predict' && !predictMarkets.data && !predictMarkets.error && !predictLoading) searchMarkets();
  }, [activeTab, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shadow-inner">
                <Wallet className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">MetaMask Agent Wallet</h3>
                <p className="text-xs text-orange-400/80 font-mono mt-0.5">Live previews are real. Execution stays locked until MetaMask approval is ready.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors relative z-10"
              aria-label="Close MetaMask Agent Wallet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
            <div className="grid md:grid-cols-[1fr_auto] gap-4 items-stretch">
              <div className={`border rounded-2xl p-5 ${paperMode ? 'bg-indigo-950/30 border-indigo-800/50' : 'bg-orange-950/30 border-orange-800/50'}`}>
                <div className="flex items-start gap-3">
                  {paperMode ? <FlaskConical className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" /> : <Zap className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />}
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{paperMode ? 'Paper mode — actions simulate' : 'LIVE mode — real execution'}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      {paperMode
                        ? 'Every tab fetches real Agent Wallet data, and execute actions run as simulated fills built from live quotes — so competitions use the full capability set risk-free. Switch to Live (readiness + MetaMask approval) to execute for real.'
                        : 'Live execution is enabled. Execute actions perform real on-chain transactions after MetaMask approval. Double-check every quote.'}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={requestBrowserLogin}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-5 py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Browser login
              </button>
            </div>

            {message && (
              <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-4 flex items-start gap-3 text-amber-200">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">{message}</div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Package</div>
                <div className="text-sm text-slate-100 font-bold mt-1">Agent Wallet v3</div>
              </div>
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Mode</div>
                <div className={`text-sm font-bold mt-1 ${paperMode ? 'text-indigo-300' : 'text-orange-300'}`}>{paperMode ? 'Paper (simulate)' : 'Live'}</div>
              </div>
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Blocked</div>
                <div className="text-sm text-slate-100 font-bold mt-1">{blockedCount} checks</div>
              </div>
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Wallet</div>
                <div className="text-sm text-slate-100 font-bold mt-1 truncate">
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 min-w-fit py-2 px-3 text-xs font-mono rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === tab.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'readiness' && (
              <div className="space-y-3">
                {readiness?.checks.map((check) => (
                  <div key={check.id} className="flex items-center justify-between gap-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                    <div>
                      <p className="text-sm font-bold text-slate-100">{check.label}</p>
                      <p className="text-xs text-slate-500 mt-1">{check.summary}</p>
                    </div>
                    <StatusPill status={check.status} />
                  </div>
                ))}
                {!readiness && (
                  <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 text-sm text-slate-400">
                    Checking MetaMask readiness...
                  </div>
                )}
              </div>
            )}

            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-100">Wallet overview</h4>
                  <button onClick={loadOverview} disabled={overviewLoading} className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${overviewLoading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Auth status</div>
                    <div className="text-sm text-slate-100 font-bold mt-1">
                      {overview?.status?.isAuthenticated ? 'Authenticated' : overview ? 'Not logged in' : '—'}
                    </div>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Address</div>
                    <div className="text-sm text-slate-100 font-bold mt-1 truncate font-mono">
                      {overview?.address ? `${overview.address.slice(0, 8)}…${overview.address.slice(-6)}` : '—'}
                    </div>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Base balance</div>
                    <div className="text-sm text-slate-100 font-bold mt-1">
                      {overview?.balance ? 'Loaded below' : '—'}
                    </div>
                  </div>
                </div>
                <Preview error={overview?.error} data={overview?.balance} empty={overviewLoading ? 'Loading balance…' : 'Refresh to load balance.'} />

                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-100 text-sm font-bold"><Send className="w-4 h-4 text-orange-400" /> Send / transfer</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="To address" placeholder="0x…" value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
                    <Field label="Amount" placeholder="0.0" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
                  </div>
                  <ExecuteButton label="Send" paperMode={paperMode} loading={execLoading === 'transfer'} onRun={() => runExec('transfer', '/api/mm/transfer', { to: sendTo, amount: sendAmount })} />
                  {execResult.transfer && <Preview error={execResult.transfer.error} data={execResult.transfer.data} />}
                </div>
              </div>
            )}

            {activeTab === 'swap' && (
              <div className="space-y-4">
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="From" value={swapForm.from} onChange={(e) => setSwapForm({ ...swapForm, from: e.target.value.toUpperCase() })} />
                    <Field label="To" value={swapForm.to} onChange={(e) => setSwapForm({ ...swapForm, to: e.target.value.toUpperCase() })} />
                    <Field label="Amount" value={swapForm.amount} onChange={(e) => setSwapForm({ ...swapForm, amount: e.target.value })} />
                  </div>
                  <button onClick={getSwapQuote} disabled={swapLoading} className="w-full py-2.5 px-4 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 disabled:opacity-50">
                    {swapLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Get swap quote
                  </button>
                  <Preview error={swapQuote.error} data={swapQuote.data} empty="Enter a pair and fetch a live route + fee preview." />
                  <ExecuteButton label="Execute swap" paperMode={paperMode} loading={execLoading === 'swap'} onRun={() => runExec('swap', '/api/mm/swap/execute', swapForm)} />
                  {execResult.swap && <Preview error={execResult.swap.error} data={execResult.swap.data} />}
                </div>
              </div>
            )}

            {activeTab === 'perps' && (
              <div className="space-y-4">
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-100">Hyperliquid margin balance</div>
                    <button onClick={getPerpsBalance} className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Check
                    </button>
                  </div>
                  <Preview error={perpsBal.error} data={perpsBal.data} empty="Check your venue margin balance." />
                </div>
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field label="Symbol" value={perpsForm.symbol} onChange={(e) => setPerpsForm({ ...perpsForm, symbol: e.target.value.toUpperCase() })} />
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Side</span>
                      <select value={perpsForm.side} onChange={(e) => setPerpsForm({ ...perpsForm, side: e.target.value })} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-orange-500/50 focus:outline-none">
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                      </select>
                    </label>
                    <Field label="Size" value={perpsForm.size} onChange={(e) => setPerpsForm({ ...perpsForm, size: e.target.value })} />
                    <Field label="Leverage" value={perpsForm.leverage} onChange={(e) => setPerpsForm({ ...perpsForm, leverage: e.target.value })} />
                  </div>
                  <button onClick={getPerpsQuote} disabled={perpsLoading} className="w-full py-2.5 px-4 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 disabled:opacity-50">
                    {perpsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Get perps quote
                  </button>
                  <Preview error={perpsQuote.error} data={perpsQuote.data} empty="Preview entry, fees, and liquidation before opening." />
                  <ExecuteButton label="Open position" paperMode={paperMode} loading={execLoading === 'perps'} onRun={() => runExec('perps', '/api/mm/perps/open', perpsForm)} />
                  {execResult.perps && <Preview error={execResult.perps.error} data={execResult.perps.data} />}
                </div>
              </div>
            )}

            {activeTab === 'predict' && (
              <div className="space-y-4">
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1"><Field label="Search markets" value={predictQuery} onChange={(e) => setPredictQuery(e.target.value)} /></div>
                    <button onClick={searchMarkets} disabled={predictLoading} className="self-end py-2 px-4 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 disabled:opacity-50">
                      {predictLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
                    </button>
                  </div>
                  <Preview error={predictMarkets.error} data={predictMarkets.data} empty="Search real Polymarket markets." />
                </div>
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Field label="Token ID" placeholder="market token id" value={predictForm.tokenId} onChange={(e) => setPredictForm({ ...predictForm, tokenId: e.target.value })} />
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Side</span>
                      <select value={predictForm.side} onChange={(e) => setPredictForm({ ...predictForm, side: e.target.value })} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-orange-500/50 focus:outline-none">
                        <option value="buy">Buy (Yes)</option>
                        <option value="sell">Sell (No)</option>
                      </select>
                    </label>
                    <Field label="Size" value={predictForm.size} onChange={(e) => setPredictForm({ ...predictForm, size: e.target.value })} />
                  </div>
                  <button onClick={getPredictQuote} disabled={predictLoading} className="w-full py-2.5 px-4 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 disabled:opacity-50">
                    {predictLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Get order quote
                  </button>
                  <Preview error={predictQuote.error} data={predictQuote.data} empty="Preview an order before placement." />
                  <ExecuteButton label="Place order" paperMode={paperMode} loading={execLoading === 'predict'} onRun={() => runExec('predict', '/api/mm/predict/place', predictForm)} />
                  {execResult.predict && <Preview error={execResult.predict.error} data={execResult.predict.data} />}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
