import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, AuditEvent, PaperTrade } from '../types';
import { Landmark, RefreshCw, FileText, HelpCircle, Flame, TrendingUp, Activity, BarChart2, Edit3, X, Loader2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardProps {
  user: User;
  onClaimFaucet: () => Promise<void>;
  audits: AuditEvent[];
  onRefreshAudits: () => void;
  trades: PaperTrade[];
  onEditProfile?: (displayName: string, bio: string, avatarUrl: string) => Promise<void>;
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

export default function Dashboard({ user, onClaimFaucet, audits, onRefreshAudits, trades, onEditProfile }: DashboardProps) {
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetError, setFaucetError] = useState('');
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(user.profile.displayName);
  const [editBio, setEditBio] = useState(user.profile.bio);
  const [editAvatarUrl, setEditAvatarUrl] = useState(user.profile.avatarUrl);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (!isEditingProfile) {
      setEditDisplayName(user.profile.displayName);
      setEditBio(user.profile.bio);
      setEditAvatarUrl(user.profile.avatarUrl);
      setProfileError('');
    }
  }, [isEditingProfile, user.profile.avatarUrl, user.profile.bio, user.profile.displayName]);

  const handleSaveProfile = async () => {
    if (!onEditProfile) return;
    if (!editDisplayName.trim()) {
      setProfileError('Display name is required.');
      return;
    }
    setIsSavingProfile(true);
    setProfileError('');
    try {
      await onEditProfile(editDisplayName, editBio, editAvatarUrl);
      setIsEditingProfile(false);
    } catch (e: any) {
      console.error(e);
      setProfileError(e?.message || 'Could not save profile.');
    } finally {
      setIsSavingProfile(false);
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
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-700" />
          
          <div className="absolute top-6 right-6 flex items-center gap-2">
             <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-emerald-400 text-[10px] font-mono">
              Paper balance synced
            </div>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-wider">
              <Landmark className="w-4 h-4 text-emerald-400" />
              Paper money
            </div>
            <h2 className="text-5xl font-extrabold text-white tracking-tight mt-4 drop-shadow-sm flex items-baseline gap-1 font-mono">
              <span className="text-slate-500 text-3xl font-mono">$</span>
              <NumberTicker value={user.paperBalance} decimals={2} />
            </h2>
            <p className="text-sm text-slate-400 font-mono mt-3 max-w-md">
              Active currency for simulating bots & rooms
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700/50 relative z-10">
            <button
              onClick={handleFaucetClaim}
              disabled={faucetLoading || user.faucetClaimedCount >= 10}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs font-mono py-3 px-6 rounded-xl shadow-lg shadow-emerald-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
            
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between text-[11px] font-mono text-slate-500">
              <span>Member since</span>
              <span className="text-slate-300">{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Paper Stats */}
          <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-orange-500/30 transition-all">
             <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-orange-500/20 transition-all duration-700" />
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <Flame className="w-4 h-4 text-orange-400" />
                MetaEdge League
              </div>
              <h2 className="text-2xl font-bold text-slate-200 mt-2 font-mono group-hover:text-orange-400 transition-colors">
                Unranked
              </h2>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700/50 text-[10px] font-mono text-slate-500 flex items-center gap-1.5 leading-tight">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              Join a cooperative Room to submit and share active strategy performance proof.
            </div>
          </div>

        </div>
      </div>

      {/* Recharts Area Performance Graph */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 shadow-2xl hover:border-indigo-500/30 transition-all duration-500 group relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-32 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-700/50 pb-6 mb-6 relative z-10">
          <div>
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Paper balance performance
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-1 max-w-lg">
              Simulated paper balance timeline tracking mint faucets and active strategy PnL fills.
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
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            MetaEdge Verification Ledger Logs
          </h3>
          <button
            onClick={onRefreshAudits}
            className="text-xs px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-slate-300 hover:text-white flex items-center gap-1.5 font-mono cursor-pointer transition-colors shadow-inner border border-slate-700/50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar relative z-10">
          {audits.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500 font-mono bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">No actions recorded in this room yet.</div>
          ) : (
            audits.map((log) => (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                key={log.id}
                className="flex items-start justify-between bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-xs font-mono shadow-sm hover:border-indigo-500/30 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-800/80 text-indigo-300 text-[10px] px-2.5 py-0.5 rounded shadow-inner border border-slate-700/50">
                      {log.action}
                    </span>
                    <span className="text-slate-400">@{log.username}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed max-w-2xl">{log.details}</p>
                </div>
                <span className="text-slate-500 text-[10px] whitespace-nowrap bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {isEditingProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
              
              <div className="space-y-4 font-mono text-sm">
                <div>
                  <label className="block text-slate-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={e => setEditDisplayName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                {profileError && (
                  <p className="text-xs text-rose-400">{profileError}</p>
                )}
                <div>
                  <label className="block text-slate-400 mb-1">Avatar URL</label>
                  <input
                    type="text"
                    value={editAvatarUrl}
                    onChange={e => setEditAvatarUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500/50 transition-colors min-h-[80px]"
                  />
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
      </AnimatePresence>
    </div>
  );
}
