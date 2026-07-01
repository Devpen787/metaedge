import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, AuditEvent, PaperTrade } from '../types';
import { Landmark, RefreshCw, FileText, HelpCircle, Flame, TrendingUp, Activity, BarChart2, Edit3, X, Loader2, Shield, Search, Swords, Terminal } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardProps {
  user: User;
  onClaimFaucet: () => Promise<void>;
  audits: AuditEvent[];
  onRefreshAudits: () => void;
  trades: PaperTrade[];
  onEditProfile?: (displayName: string, bio: string, avatarUrl: string, preferredCurrency: string) => Promise<void>;
  onResetProfile?: () => Promise<void>;
}

const NumberTicker = ({ value, prefix = '', suffix = '', decimals = 0 }: { value: number, prefix?: string, suffix?: string, decimals?: number }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  return (
    <span className="font-mono tabular-nums">
      {prefix}
      {displayValue.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isImpactPositive = data.Amount > 0;
    const isImpactNegative = data.Amount < 0;

    return (
      <div className="bg-slate-950/95 border border-slate-800 p-3.5 rounded-xl shadow-2xl font-mono text-xs space-y-2 backdrop-blur-md">
        <div className="text-slate-500 text-[10px] font-bold tracking-tight">
          {data.date} at {data.time}
        </div>
        <div className="flex justify-between items-center gap-6">
          <span className="text-slate-400">Paper Balance:</span>
          <span className="text-emerald-400 font-extrabold text-sm">
            ${data.Balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        {data.Event && (
          <div className="flex justify-between items-center gap-6 border-t border-slate-900/80 pt-1.5 mt-1">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider">Trigger Event:</span>
            <span className="text-slate-300 font-semibold text-[10px] max-w-[140px] truncate text-right">
              {data.Event}
            </span>
          </div>
        )}
        {data.Amount !== 0 && (
          <div className="flex justify-between items-center gap-6">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider">Simulated Gain/Loss:</span>
            <span className={`font-extrabold text-[10px] ${isImpactPositive ? 'text-emerald-400' : isImpactNegative ? 'text-rose-400' : 'text-slate-400'}`}>
              {isImpactPositive ? '+' : ''}{data.Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function Dashboard({ user, onClaimFaucet, audits, onRefreshAudits, trades, onEditProfile, onResetProfile }: DashboardProps) {
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetError, setFaucetError] = useState('');
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(user.profile.displayName);
  const [editBio, setEditBio] = useState(user.profile.bio || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user.profile.avatarUrl);
  const [editPreferredCurrency, setEditPreferredCurrency] = useState(user.profile.preferredCurrency || 'USD');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const predefinedAvatars = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Oliver',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Bella',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Shadow',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Midnight',
  ];

  const handleSaveProfile = async () => {
    if (!onEditProfile) return;
    setIsSavingProfile(true);
    try {
      await onEditProfile(editDisplayName, editBio || '', editAvatarUrl, editPreferredCurrency);
      setIsEditingProfile(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetProfile = async () => {
    if (!onResetProfile) return;
    const confirm = window.confirm("Are you sure you want to completely wipe your simulated profile, trades, and history? This cannot be undone.");
    if (!confirm) return;
    setIsResetting(true);
    try {
      await onResetProfile();
      setIsEditingProfile(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  const handleFaucetClaim = async () => {
    setFaucetLoading(true);
    setFaucetError('');
    try {
      await onClaimFaucet();
    } catch (e: any) {
      setFaucetError(e.message || 'Error claiming faucet.');
    } finally {
      setFaucetLoading(false);
    }
  };

  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  const currentSymbol = currencySymbols[user.profile.preferredCurrency || 'USD'] || '$';

  // 1. Filter trades & audits associated with this user
  const myTrades = trades.filter(t => t.userId === user.id);
  const myAudits = audits.filter(a => a.userId === user.id);

  // 2. Assemble events affecting paper balance chronologically
  const events: { timestamp: number; type: 'initial' | 'faucet' | 'trade'; amount: number; label: string }[] = [];

  // Anchor point at user creation
  events.push({
    timestamp: user.createdAt || Date.now() - 3600000,
    type: 'initial',
    amount: 100000,
    label: 'Initial Balance allocation'
  });

  // Faucet claims from audits
  myAudits.forEach(audit => {
    if (audit.action === 'FAUCET_CLAIM') {
      events.push({
        timestamp: audit.timestamp,
        type: 'faucet',
        amount: 10000,
        label: 'Faucet Claim Mint'
      });
    }
  });

  // Trades from trades array
  myTrades.forEach(trade => {
    if (trade.pnl !== undefined) {
      events.push({
        timestamp: trade.timestamp,
        type: 'trade',
        amount: trade.pnl,
        label: `Simulated Trade: ${trade.assetSymbol} ${trade.side.toUpperCase()}`
      });
    }
  });

  // Sort chronologically
  events.sort((a, b) => a.timestamp - b.timestamp);

  // Recompute historical balance timeline forward
  let currentBalance = 100000;
  const chartData = events.map(ev => {
    if (ev.type === 'initial') {
      currentBalance = 100000;
    } else {
      currentBalance += ev.amount;
    }
    return {
      time: new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date(ev.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      timestamp: ev.timestamp,
      Balance: Number(currentBalance.toFixed(2)),
      Event: ev.label,
      Amount: ev.amount
    };
  });

  // Append a live "Current" point to present-moment balance to avoid empty/flat single-points
  if (chartData.length > 0) {
    const lastPoint = chartData[chartData.length - 1];
    // Only append if there isn't a point already at the same timestamp
    if (Date.now() - lastPoint.timestamp > 1000) {
      chartData.push({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        timestamp: Date.now(),
        Balance: Number(user.paperBalance.toFixed(2)),
        Event: 'Current Status',
        Amount: 0
      });
    }
  }

  // Statistics
  const netPnL = myTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const totalTradesCount = myTrades.length;
  const winningTrades = myTrades.filter(t => (t.pnl || 0) > 0).length;
  const winRate = totalTradesCount > 0 ? (winningTrades / totalTradesCount) * 100 : 0;

  return (
    <div className="space-y-6 fade-in relative z-10">
      {/* Top Banner metrics - Bento Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Balances - Main Focus */}
        <div className="col-span-1 md:col-span-8 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl group transition-all hover:bg-slate-900/80">
          
          <div className="absolute top-6 right-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              Paper Trading
            </div>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <Landmark className="w-4 h-4 text-emerald-400" />
              Account Balance
            </div>
            <h2 className="text-5xl font-extrabold text-white tracking-tight mt-4 drop-shadow-sm flex items-baseline gap-1 font-mono">
              <span className="text-slate-500 text-3xl font-mono">{currentSymbol}</span>
              <NumberTicker value={user.paperBalance} decimals={2} />
            </h2>
            <div className="flex items-center gap-3 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-mono rounded-lg shadow-sm font-bold uppercase tracking-widest">
                <Flame className="w-3 h-3" /> Yield Active
              </span>
              <span className="text-xs text-slate-500">Default Settlement Currency</span>
            </div>
            <p className="text-sm text-slate-400 mt-4 max-w-md leading-relaxed">
              Available capital for executing trades and deploying algorithmic agents.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700/50 relative z-10">
            <button
              onClick={handleFaucetClaim}
              disabled={faucetLoading || user.faucetClaimedCount >= 10}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-3 px-6 rounded-xl shadow-lg shadow-emerald-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Activity className="w-4 h-4" />
              {faucetLoading ? 'Minting...' : `Claim $10,000 Faucet (${user.faucetClaimedCount}/10)`}
            </button>
            {faucetError && (
              <p className="text-[10px] text-rose-400 mt-2 font-mono">{faucetError}</p>
            )}
          </div>
        </div>

        {/* Right side stats column */}
        <div className="col-span-1 md:col-span-4 flex flex-col gap-6">
          
          {/* User Identity Info */}
          <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl group hover:border-indigo-500/30 transition-all relative">
            <button
              onClick={() => setIsEditingProfile(true)}
              className="absolute top-4 right-4 p-2 bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 rounded-xl transition-colors"
              title="Edit Profile"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-4">
              <img
                src={user.profile.avatarUrl}
                alt="Avatar"
                className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700/50 shadow-inner"
              />
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight leading-none group-hover:text-indigo-400 transition-colors">
                  {user.profile.displayName}
                </h3>
                <p className="text-xs text-indigo-400/80 font-mono mt-1">@{user.username}</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between text-xs text-slate-500">
              <span>Member since</span>
              <span className="text-slate-300">{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Verifier Firewall */}
          <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-amber-500/20 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Strict Validation
                </span>
                <span className="bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] text-amber-400 uppercase tracking-wider font-bold">Active</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-1.5 leading-tight">
              <span className="text-sm text-slate-400">Orders Rejected</span>
              <span className="text-amber-400 font-bold font-mono text-lg">14</span>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Verifies order intent against margin requirements before execution.
            </p>
          </div>

          {/* Paper Stats */}
          <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                Performance Ranking
              </div>
              <h2 className="text-xl font-bold text-slate-200 mt-2">
                Unranked
              </h2>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-500 flex items-start gap-2 leading-tight">
              <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Join a room to submit your strategy performance records.</p>
            </div>
          </div>

        </div>
      </div>

      {/* Quick Navigation / Workflow Optimizations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <button 
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="bg-slate-900/60 border border-slate-700/50 hover:border-indigo-500/50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 shadow-lg group"
        >
          <div className="bg-indigo-500/10 p-3 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
            <Search className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="text-sm font-bold text-slate-200">Command Palette</span>
          <span className="text-[10px] font-mono text-slate-500">Cmd+K</span>
        </button>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'arena' }))}
          className="bg-slate-900/60 border border-slate-700/50 hover:border-yellow-500/50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 shadow-lg group"
        >
          <div className="bg-yellow-500/10 p-3 rounded-xl group-hover:bg-yellow-500/20 transition-colors">
            <Swords className="w-6 h-6 text-yellow-500" />
          </div>
          <span className="text-sm font-bold text-slate-200">Agent Arena</span>
          <span className="text-[10px] font-mono text-slate-500">Compete & Earn</span>
        </button>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'intent' }))}
          className="bg-slate-900/60 border border-slate-700/50 hover:border-emerald-500/50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 shadow-lg group"
        >
          <div className="bg-emerald-500/10 p-3 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
            <Terminal className="w-6 h-6 text-emerald-400" />
          </div>
          <span className="text-sm font-bold text-slate-200">Intent Solver</span>
          <span className="text-[10px] font-mono text-slate-500">Text to Strategy</span>
        </button>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'analytics' }))}
          className="bg-slate-900/60 border border-slate-700/50 hover:border-blue-500/50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 shadow-lg group"
        >
          <div className="bg-blue-500/10 p-3 rounded-xl group-hover:bg-blue-500/20 transition-colors">
            <BarChart2 className="w-6 h-6 text-blue-400" />
          </div>
          <span className="text-sm font-bold text-slate-200">Platform Data</span>
          <span className="text-[10px] font-mono text-slate-500">Global Metrics</span>
        </button>
      </div>

      {/* Recharts Area Performance Graph */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 shadow-2xl hover:border-indigo-500/30 transition-all duration-500 group relative overflow-hidden">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-700/50 pb-6 mb-6 relative z-10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Account Balance Performance
            </h3>
            <p className="text-sm text-slate-400 mt-1 max-w-lg">
              Balance timeline tracking deposits and PnL.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 font-mono text-xs">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl px-5 py-3 shadow-inner">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider">Net Profit</span>
              <div className={`text-lg font-bold mt-1 ${netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netPnL >= 0 ? '+' : '-'}$<NumberTicker value={Math.abs(netPnL)} decimals={2} />
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl px-5 py-3 shadow-inner">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider">Win Rate</span>
              <div className="text-indigo-400 text-lg font-bold mt-1">
                <NumberTicker value={winRate} decimals={1} suffix="%" />
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl px-5 py-3 shadow-inner">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider">Total trades</span>
              <div className="text-white text-lg font-bold mt-1">
                <NumberTicker value={totalTradesCount} />
              </div>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="h-80 w-full pr-4 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={8}
                fontFamily="JetBrains Mono, ui-monospace"
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                dx={-8}
                domain={['dataMin - 5000', 'dataMax + 5000']}
                fontFamily="JetBrains Mono, ui-monospace"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4f46e5', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="Balance"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorBalance)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ledger Logs */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-500/50 transition-all">
        <div className="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-4 relative z-10">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Audit Logs
          </h3>
          <button
            onClick={onRefreshAudits}
            className="text-xs px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-slate-300 hover:text-white flex items-center gap-1.5 font-sans font-medium cursor-pointer transition-colors shadow-inner border border-slate-700/50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar relative z-10">
          {audits.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">No actions recorded yet.</div>
          ) : (
            audits.map((log) => (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                key={log.id}
                className="flex items-start justify-between bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm hover:border-indigo-500/30 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-800/80 text-indigo-300 text-[10px] font-mono px-2.5 py-0.5 rounded shadow-inner border border-slate-700/50">
                      {log.action}
                    </span>
                    <span className="text-slate-400 text-xs font-mono">@{log.username}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">{log.details}</p>
                </div>
                <span className="text-slate-500 text-[10px] font-mono whitespace-nowrap bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {isEditingProfile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
              >
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <h2 className="text-xl font-bold text-white mb-6">Edit Profile</h2>
                
                <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={e => setEditDisplayName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-2">Avatar Picker</label>
                    <div className="flex flex-wrap gap-3 mb-3">
                      {predefinedAvatars.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setEditAvatarUrl(url)}
                          className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-colors ${editAvatarUrl === url ? 'border-indigo-500' : 'border-transparent hover:border-slate-700 bg-slate-800'}`}
                        >
                          <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={editAvatarUrl}
                      onChange={e => setEditAvatarUrl(e.target.value)}
                      placeholder="Or paste a custom image URL"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500/50 transition-colors text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Preferred Currency</label>
                    <select
                      value={editPreferredCurrency}
                      onChange={e => setEditPreferredCurrency(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500/50 transition-colors appearance-none font-mono"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Bio</label>
                    <textarea
                      value={editBio}
                      onChange={e => setEditBio(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500/50 transition-colors min-h-[80px]"
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-800/50 mt-4">
                    <button
                      onClick={handleResetProfile}
                      disabled={isResetting}
                      className="w-full py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl border border-rose-500/20 transition-colors text-xs font-bold"
                    >
                      {isResetting ? 'Resetting...' : 'DANGER: Wipe All Profile Data & Trades'}
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile || !editDisplayName.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
