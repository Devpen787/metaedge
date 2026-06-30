import React, { useEffect, useMemo, useState } from 'react';
import { X, Wallet, ShieldCheck, Activity, RefreshCw, AlertTriangle, ArrowRightLeft, TrendingUp, Lock, Check, KeyRound, Gauge, Landmark } from 'lucide-react';
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

function ProductCard({
  icon: Icon,
  title,
  body,
  footer
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  footer: string;
}) {
  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-100">{title}</h4>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">{body}</p>
          <p className="text-[10px] text-slate-500 font-mono mt-3">{footer}</p>
        </div>
      </div>
    </div>
  );
}

export default function AgentWalletModal({ isOpen, onClose }: AgentWalletModalProps) {
  const [readiness, setReadiness] = useState<MetaMaskReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('readiness');
  const [message, setMessage] = useState('');

  const blockedCount = useMemo(
    () => readiness?.checks.filter((check) => check.status === 'blocked').length ?? 0,
    [readiness]
  );

  const walletAddress = readiness?.wallet?.address;

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

  useEffect(() => {
    if (isOpen) {
      setActiveTab('readiness');
      loadReadiness();
    }
  }, [isOpen]);

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
                <p className="text-xs text-orange-400/80 font-mono mt-0.5">Live review stays locked until MetaMask approval is ready.</p>
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
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">Live locked</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      MetaEdge can prepare previews and readiness checks, but real movement requires MetaMask browser login, policy limits, quote review, and a human approval prompt.
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
                <div className="text-sm text-slate-100 font-bold mt-1">Paper mode</div>
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

            {activeTab === 'swap' && (
              <div className="grid md:grid-cols-2 gap-4">
                <ProductCard
                  icon={ArrowRightLeft}
                  title="Quote before swap"
                  body="MetaEdge can ask Agent Wallet for a swap or bridge preview with route, expected output, and fees before execution."
                  footer="Live execution still needs MetaMask approval."
                />
                <ProductCard
                  icon={Gauge}
                  title="Refuel supported"
                  body="Cross-chain bridge previews can include destination gas top-up when the route supports it."
                  footer="Paper mode remains the default."
                />
              </div>
            )}

            {activeTab === 'perps' && (
              <div className="grid md:grid-cols-2 gap-4">
                <ProductCard
                  icon={TrendingUp}
                  title="Perps preview"
                  body="Perp actions should first show venue, margin, estimated entry, fees, and liquidation before any open action."
                  footer="Open positions stay locked here."
                />
                <ProductCard
                  icon={Landmark}
                  title="Deposit required"
                  body="Hyperliquid perps require venue funding and balance checks before a real position can be reviewed."
                  footer="Use paper fills until ready."
                />
              </div>
            )}

            {activeTab === 'predict' && (
              <div className="grid md:grid-cols-2 gap-4">
                <ProductCard
                  icon={Activity}
                  title="Prediction preview"
                  body="Prediction markets need setup, deposit status, market token selection, and order quote before placement."
                  footer="Real orders remain locked."
                />
                <ProductCard
                  icon={Check}
                  title="Approval path"
                  body="MetaMask approval and policy checks must clear before any live prediction-market action."
                  footer="No hidden execution."
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
