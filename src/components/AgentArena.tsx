import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Swords, Users, Target, Award, TrendingUp, Plus, Bot, Zap, ShieldCheck, Clock, ChevronRight, Crown, Activity, Rocket, DollarSign, PieChart, Play, Pause, X, Wallet, Settings, Terminal, ArrowUpRight, ArrowDownRight, Sliders, Share2 } from 'lucide-react';
import { User } from '../types';
import { apiFetch } from '../lib/api';

function msToLeft(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} Day${days > 1 ? 's' : ''} Left`;
  const hrs = Math.max(1, Math.floor(ms / 3600000));
  return `${hrs} Hr${hrs !== 1 ? 's' : ''} Left`;
}

const AnimatedValue = ({ value, formatter, className }: { value: number, formatter: (val: number) => string, className?: string }) => {
  const prevValue = useRef(value);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);

  useEffect(() => {
    if (value > prevValue.current) setDirection(1);
    else if (value < prevValue.current) setDirection(-1);
    else setDirection(0);
    prevValue.current = value;
    
    const timeout = setTimeout(() => setDirection(0), 1000);
    return () => clearTimeout(timeout);
  }, [value]);

  const color = direction === 1 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' 
              : direction === -1 ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]' 
              : '';

  return (
    <motion.span 
      animate={{ scale: direction !== 0 ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 0.3 }}
      className={`inline-block transition-colors duration-300 ${color} ${className}`}
    >
      {formatter(value)}
    </motion.span>
  );
};

interface AgentArenaProps {
  user: User;
}

const AVAILABLE_AGENTS = [
  { id: 'a1', name: 'Swarm Copilot', type: 'Generalist', risk: 'Medium', desc: 'Executes text-based intents dynamically across all markets.' },
  { id: 'a2', name: 'Delta Farmer', type: 'Yield', risk: 'Low', desc: 'Farms stablecoin yields and hedges volatile assets.' },
  { id: 'a3', name: 'Perp Sniper', type: 'Leverage', risk: 'High', desc: 'Takes high conviction leveraged positions based on social sentiment.' },
  { id: 'a4', name: 'Arb Finder', type: 'Arbitrage', risk: 'Low', desc: 'Exploits price differences across L2s instantly.' },
];

const DataStreamBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.15] z-0">
      <motion.div
        animate={{
          backgroundPosition: ['0px 0px', '40px 40px'],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: "linear",
        }}
        className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0iIzQzMzhjYSIvPgo8L3N2Zz4=')]"
      />
      <div className="absolute inset-0 flex justify-around px-10">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: '100vh', opacity: [0, 0.5, 0] }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              delay: Math.random() * 10,
              ease: "linear"
            }}
            className="w-[1px] h-64 bg-gradient-to-b from-transparent via-indigo-500 to-transparent"
          />
        ))}
      </div>
    </div>
  );
};

export const AgentArena: React.FC<AgentArenaProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leagues' | 'create'>('dashboard');
  const [activeLeagueId, setActiveLeagueId] = useState<string | 'global'>('global');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [allocation, setAllocation] = useState<number>(1000);
  
  const [availableCapital, setAvailableCapital] = useState(10000);
  const [activeAgents, setActiveAgents] = useState<any[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);

  const [leagues, setLeagues] = useState<any[]>([]);
  const [joinedLeagues, setJoinedLeagues] = useState<(string | 'global')[]>(['global']);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueBalance, setNewLeagueBalance] = useState(10000);
  const [newLeagueDuration, setNewLeagueDuration] = useState(7);
  const [activeTier, setActiveTier] = useState('All');

  const [customAgents, setCustomAgents] = useState<{id: string, name: string, type: string, risk: string, desc: string}[]>([]);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({ name: '', type: 'Generalist', risk: 'Medium', desc: '' });
  
  const [inspectedAgentId, setInspectedAgentId] = useState<string | null>(null);
  const [inspectTab, setInspectTab] = useState<'logs' | 'settings'>('logs');
  const [inspectDepositAmount, setInspectDepositAmount] = useState(0);
  const [inspectWithdrawAmount, setInspectWithdrawAmount] = useState(0);
  
  const [inspectedPlayerRank, setInspectedPlayerRank] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const [positions, setPositions] = useState<any[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [boardMeta, setBoardMeta] = useState<{ name: string; endsAt: number } | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const prevRankRef = useRef<{ leagueId: string | 'global'; rank: number } | null>(null);

  // Auto-dismiss celebration toasts.
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 4500);
    return () => clearTimeout(t);
  }, [celebration]);

  // Arena share links: /arena?league=<id> opens that league's board directly
  // (the visitor still joins deliberately via "Enter the Arena").
  useEffect(() => {
    const lg = new URLSearchParams(window.location.search).get('league');
    if (lg) {
      setActiveLeagueId(lg);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadPositions = React.useCallback(async () => {
    try {
      const res = await apiFetch('/api/arena/positions');
      if (res.ok) setPositions((await res.json()).positions || []);
    } catch { /* keep last good state */ }
  }, []);

  const loadArena = React.useCallback(async () => {
    try {
      const [lgRes, lbRes] = await Promise.all([
        apiFetch('/api/arena/leagues'),
        apiFetch(`/api/arena/leaderboard?leagueId=${encodeURIComponent(activeLeagueId)}`),
      ]);
      if (lgRes.ok) {
        const data = await lgRes.json();
        const mapped = (data.leagues || []).map((l: any) => ({
          id: l.id, name: l.name, creator: l.creatorName,
          participants: l.participants, prize: l.prize,
          time: msToLeft(l.endsAt), risk: l.risk, joined: l.joined,
        }));
        setLeagues(mapped);
        setJoinedLeagues(['global', ...mapped.filter((l: any) => l.joined).map((l: any) => l.id)]);
      }
      if (lbRes.ok) {
        const data = await lbRes.json();
        const rows = data.leaderboard || [];
        setLeaderboard(rows);
        if (data.board) setBoardMeta(data.board);
        // Celebrate a genuine rank-up on the same board.
        const mine = rows.find((p: any) => p.userId === user.id);
        const prev = prevRankRef.current;
        if (mine && prev && prev.leagueId === activeLeagueId && mine.rank < prev.rank) {
          setCelebration(`🚀 Rank up! #${prev.rank} → #${mine.rank}`);
        }
        prevRankRef.current = mine ? { leagueId: activeLeagueId, rank: mine.rank } : null;
      }
    } catch {
      /* keep last good state */
    }
  }, [activeLeagueId, user.id]);

  const handleClosePosition = async (id: string) => {
    setClosingId(id);
    try {
      const res = await apiFetch(`/api/arena/positions/${id}/close`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const pnl = data?.position?.pnl;
        if (typeof pnl === 'number' && pnl > 0) {
          setCelebration(`💰 +${pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} locked in!`);
        }
        await loadPositions();
        await loadArena();
      }
    } catch { /* ignore transient failures */ } finally {
      setClosingId(null);
    }
  };

  useEffect(() => { loadArena(); }, [loadArena]);

  // Refresh open positions periodically so their live P&L keeps ticking.
  useEffect(() => {
    loadPositions();
    const t = setInterval(loadPositions, 5000);
    return () => clearInterval(t);
  }, [loadPositions]);

  // Real, computed arena stats derived from the live leaderboard (never faked).
  // `leaderboard` already reflects the active league (global or a specific one).
  const arenaStats = React.useMemo(() => {
    const participants = leaderboard.length;
    const capitalInPlay = leaderboard.reduce((s, p) => s + (p.currentBal || 0), 0);
    const topReturn = leaderboard[0]?.roi ?? '—';
    const inProfit = leaderboard.filter((p) => (p.roiValue || 0) > 0).length;
    const myRank = leaderboard.find((p) => p.userId === user.id)?.rank ?? null;
    return { participants, capitalInPlay, topReturn, inProfit, myRank };
  }, [leaderboard, user.id]);

  const fmtUsd = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${Math.round(n)}`;

  // Real rank-percentile tiers (top 10% Platinum, 35% Gold, 70% Silver, rest
  // Bronze) — computed from the live board, filterable, never decorative.
  const tierOf = React.useCallback((rank: number) => {
    const n = leaderboard.length || 1;
    if (rank <= Math.max(1, Math.ceil(n * 0.1))) return 'Platinum';
    if (rank <= Math.ceil(n * 0.35)) return 'Gold';
    if (rank <= Math.ceil(n * 0.7)) return 'Silver';
    return 'Bronze';
  }, [leaderboard.length]);

  const tierStyles: Record<string, string> = {
    Platinum: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    Gold: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
    Silver: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    Bronze: 'bg-amber-700/10 text-amber-500 border-amber-700/20',
  };

  const visibleLeaderboard = activeTier === 'All'
    ? leaderboard
    : leaderboard.filter((p) => tierOf(p.rank) === activeTier);

  const handleShare = () => {
    const link = `${window.location.origin}/arena?league=${activeLeagueId}`;
    navigator.clipboard.writeText(link);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleJoinLeague = async (id: string | 'global') => {
    if (id === 'global' || joinedLeagues.includes(id)) {
      setActiveLeagueId(id);
      setActiveTab('dashboard');
      return;
    }
    try {
      const res = await apiFetch(`/api/arena/leagues/${id}/join`, { method: 'POST' });
      if (res.ok || res.status === 409) {
        setActiveLeagueId(id);
        setActiveTab('dashboard');
        await loadArena();
      }
    } catch {
      /* ignore transient failures; state stays consistent on next load */
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;
    try {
      const res = await apiFetch('/api/arena/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: newLeagueName,
          startBalance: newLeagueBalance,
          durationDays: newLeagueDuration,
          risk: 'Medium',
          prize: 'Community Pool',
        }),
      });
      if (res.ok) {
        setActiveTab('leagues');
        setNewLeagueName('');
        setNewLeagueBalance(10000);
        setNewLeagueDuration(7);
        await loadArena();
      }
    } catch {
      /* ignore */
    }
  };

  // Simulated live PnL updates
  useEffect(() => {
    if (activeAgents.length === 0) return;
    
    const interval = setInterval(() => {
      setActiveAgents(prev => prev.map(agent => {
        const volatility = agent.risk === 'High' ? 0.05 : agent.risk === 'Medium' ? 0.02 : 0.005;
        const change = agent.allocated * volatility * (Math.random() - 0.4); // slightly biased to positive
        return {
          ...agent,
          pnl: agent.pnl + change,
          currentValue: agent.allocated + agent.pnl + change
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [activeAgents.length]);

  // Live trading simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAgents(prev => {
        if (prev.length === 0) return prev;
        return prev.map(agent => {
          // Determine volatility based on risk profile
          const volatility = agent.risk === 'High' ? 0.04 : agent.risk === 'Low' ? 0.008 : 0.02;
          // Random walk with slight positive drift
          const changePercent = (Math.random() - 0.48) * volatility; 
          const pnlChange = agent.allocated * changePercent;
          const newPnl = agent.pnl + pnlChange;
          return {
            ...agent,
            pnl: newPnl,
            currentValue: agent.allocated + newPnl
          };
        });
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const total = activeAgents.reduce((sum, a) => sum + a.pnl, 0);
    setTotalPnL(total);
  }, [activeAgents]);

  const handleDeploy = () => {
    if (!selectedAgent || allocation <= 0 || allocation > availableCapital) return;
    
    const agentData = [...customAgents, ...AVAILABLE_AGENTS].find(a => a.id === selectedAgent);
    if (!agentData) return;

    setIsDeploying(true);
    
    setTimeout(() => {
      setActiveAgents(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          ...agentData,
          allocated: allocation,
          currentValue: allocation,
          pnl: 0,
          status: 'active'
        }
      ]);
      setAvailableCapital(prev => prev - allocation);
      setIsDeploying(false);
      setDeployModalOpen(false);
      setSelectedAgent(null);
    }, 1500);
  };

  const handleInspectDeposit = () => {
    if (inspectDepositAmount <= 0 || inspectDepositAmount > availableCapital || !inspectedAgentId) return;
    setActiveAgents(prev => prev.map(a => {
      if (a.id === inspectedAgentId) {
        return { ...a, allocated: a.allocated + inspectDepositAmount, currentValue: a.currentValue + inspectDepositAmount };
      }
      return a;
    }));
    setAvailableCapital(prev => prev - inspectDepositAmount);
    setInspectDepositAmount(0);
  };

  const handleInspectWithdraw = () => {
    const agent = activeAgents.find(a => a.id === inspectedAgentId);
    if (!agent || inspectWithdrawAmount <= 0 || inspectWithdrawAmount > agent.currentValue) return;
    
    if (Math.abs(inspectWithdrawAmount - agent.currentValue) < 0.01) {
      handleRemoveAgent(agent.id, agent.currentValue);
      setInspectedAgentId(null);
      setInspectWithdrawAmount(0);
      return;
    }

    setActiveAgents(prev => prev.map(a => {
      if (a.id === inspectedAgentId) {
        const fraction = inspectWithdrawAmount / a.currentValue;
        const newAllocated = a.allocated * (1 - fraction);
        const newCurrent = a.currentValue - inspectWithdrawAmount;
        const newPnl = newCurrent - newAllocated;
        return { ...a, allocated: newAllocated, currentValue: newCurrent, pnl: newPnl };
      }
      return a;
    }));
    setAvailableCapital(prev => prev + inspectWithdrawAmount);
    setInspectWithdrawAmount(0);
  };

  const handleRemoveAgent = (id: string, value: number) => {
    setActiveAgents(prev => prev.filter(a => a.id !== id));
    setAvailableCapital(prev => prev + value);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-slate-300 relative bg-[#020617]">
      <DataStreamBackground />

      {/* Celebration toast — fires on real events (rank-up, profitable close) */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-yellow-500/40 shadow-[0_0_36px_rgba(234,179,8,0.3)] rounded-2xl px-5 py-4 text-white font-bold text-sm flex items-center gap-2"
          >
            {celebration}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex-none p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3 font-mono">
            <Swords className="w-6 h-6 text-yellow-500" />
            Agent Arena <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded font-bold">PAPER LEAGUE</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Learn to deploy agents and test your strategies risk-free. Compete against others using Swarm Copilot, Autopilot, and Intent Solvers.
          </p>
        </div>

        <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setActiveLeagueId('global'); setActiveTab('dashboard'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeLeagueId === 'global' && activeTab === 'dashboard' ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-slate-800'
            }`}
          >
            Global Season
          </button>
          <button
            onClick={() => setActiveTab('leagues')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'leagues' ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-slate-800'
            }`}
          >
            Custom Leagues
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'create' ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {activeTab === 'dashboard' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ staggerChildren: 0.1 }}
            className="space-y-6 max-w-6xl mx-auto"
          >
            
            {/* Header & Stats (Always visible) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative"
            >
              {/* Decorative Background */}
              <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-yellow-500/20 blur-3xl pointer-events-none" />
              
              <div className="p-8 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono uppercase tracking-widest mb-4">
                      <Clock className="w-3 h-3" /> 
                      {activeLeagueId === 'global' ? 'Ends in 14d 08h 22m' : (leagues.find(l => l.id === activeLeagueId)?.time || 'Ongoing')}
                    </div>
                    <h2 className="text-4xl font-black text-white tracking-tight mb-2">
                      {activeLeagueId === 'global' ? 'The Genesis Flywheel' : leagues.find(l => l.id === activeLeagueId)?.name}
                    </h2>
                    <p className="text-slate-400 max-w-xl">
                      {activeLeagueId === 'global'
                        ? 'Deploy autonomous agents to trade virtual capital. Climb the leaderboard by generating the highest PnL to win a share of the growing prize pool.'
                        : 'Custom league dashboard. Compete with your community members and prove your strategies.'}
                    </p>
                    {boardMeta && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono">
                        <Clock className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-slate-300">{boardMeta.name}</span>
                        <span className="text-yellow-500 font-bold">· {msToLeft(boardMeta.endsAt)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleShare}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700"
                    >
                      <Share2 className="w-4 h-4" />
                      {shareCopied ? 'Link Copied!' : 'Share Strategy'}
                    </button>
                    {!joinedLeagues.includes(activeLeagueId) ? (
                      <button 
                        onClick={() => handleJoinLeague(activeLeagueId)}
                        className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:scale-105"
                      >
                        <Swords className="w-5 h-5" /> Enter the Arena
                      </button>
                    ) : (
                      <div className="px-6 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                        <div className="text-xs text-slate-500 font-mono uppercase">Your Rank</div>
                        <div className="text-2xl font-bold text-yellow-500">{arenaStats.myRank ? `#${arenaStats.myRank}` : 'Unranked'}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">Competitors</div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {arenaStats.participants}
                    </div>
                  </div>
                  <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">Capital in play</div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {fmtUsd(arenaStats.capitalInPlay)}
                    </div>
                  </div>
                  <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">Top return</div>
                    <div className="text-2xl font-bold text-emerald-400 font-mono">
                      {arenaStats.topReturn}
                    </div>
                  </div>
                  <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">In profit</div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {arenaStats.inProfit}
                    </div>
                  </div>
                </div>

                {/* Prize / Reward */}
                <div className="bg-slate-950 rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-white mb-4">{activeLeagueId === 'global' ? 'Reward' : 'Prize pool'}</h3>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">{activeLeagueId === 'global' ? 'On the line' : 'Set by league creator'}</div>
                      <div className="text-3xl font-bold text-yellow-500 font-mono">
                        {activeLeagueId === 'global' ? 'Leaderboard Glory' : (leagues.find(l => l.id === activeLeagueId)?.prize || 'Reputation Badge')}
                      </div>
                    </div>
                  </div>
                  {activeLeagueId === 'global' ? (
                    <div className="text-xs text-slate-500 font-mono">
                      Ranked by real agent P&amp;L · {arenaStats.participants} competing · {fmtUsd(arenaStats.capitalInPlay)} in play
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 font-mono">
                      Custom league · winner takes the pool
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {joinedLeagues.includes(activeLeagueId) && (
              <div className="space-y-6">
                {/* Active Player Dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Stats Card */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-700" />
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <h3 className="text-slate-400 text-sm font-mono uppercase tracking-wider mb-1">Your Portfolio Value</h3>
                        <div className="text-4xl font-mono font-bold text-white">
                          <AnimatedValue 
                            value={10000 + totalPnL} 
                            formatter={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                          />
                        </div>
                        <div className={`text-sm font-mono mt-2 flex items-center gap-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                          <AnimatedValue 
                            value={totalPnL} 
                            formatter={(v) => `${v >= 0 ? '+' : ''}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((v / 10000) * 100).toFixed(2)}%)`} 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-800/50 relative z-10">
                       <div>
                         <div className="text-xs text-slate-500 font-mono uppercase mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Unallocated</div>
                         <div className="text-xl font-mono text-slate-200">${availableCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                       </div>
                       <div>
                         <div className="text-xs text-slate-500 font-mono uppercase mb-1 flex items-center gap-1"><Bot className="w-3 h-3" /> Active Agents</div>
                         <div className="text-xl font-mono text-slate-200">{activeAgents.length} / 5</div>
                       </div>
                    </div>
                  </motion.div>

                  {/* Deploy Action Card */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 flex flex-col justify-center items-center text-center relative overflow-hidden"
                  >
                     <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />
                     <Rocket className="w-12 h-12 text-indigo-400 mb-4" />
                     <h3 className="text-lg font-bold text-white mb-2">Deploy New Agent</h3>
                     <p className="text-xs text-slate-400 mb-6">Allocate your virtual capital to specialized AI agents and watch them trade.</p>
                     <button 
                       onClick={() => setDeployModalOpen(true)}
                       disabled={availableCapital <= 0 || activeAgents.length >= 5}
                       className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors relative z-10"
                     >
                       <Plus className="w-5 h-5" /> Select Agent
                     </button>
                  </motion.div>
                </div>

                {/* Active Agents List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" /> Live Arena Operations
                  </h3>
                  
                  {activeAgents.length === 0 ? (
                    <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                        <Bot className="w-8 h-8 text-slate-500" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">No Agents Deployed</h4>
                      <p className="text-slate-400 mb-6 max-w-sm mx-auto">Allocate your virtual capital to specialized AI agents to start competing in the arena.</p>
                      <button 
                        onClick={() => setDeployModalOpen(true)}
                        className="px-6 py-3 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 font-bold rounded-xl transition-colors border border-indigo-500/30 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Select Your First Agent
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AnimatePresence>
                        {activeAgents.map(agent => (
                          <motion.div
                            key={agent.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/50 transition-colors"
                          >
                            <motion.div 
                              animate={{ opacity: [0, 0.05, 0] }}
                              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: Math.random() * 2 }}
                              className="absolute inset-0 bg-indigo-500 pointer-events-none" 
                            />
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                            <div className="flex justify-between items-start mb-4 relative z-10">
                               <div>
                                 <h4 className="font-bold text-white flex items-center gap-2">
                                   {agent.name}
                                   <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] uppercase">
                                     <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /> Live
                                   </span>
                                 </h4>
                                 <span className="text-xs text-slate-500">{agent.type} Strategy</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <button 
                                   onClick={() => setInspectedAgentId(agent.id)}
                                   className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                   title="Manage Agent"
                                 >
                                   <Settings className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleRemoveAgent(agent.id, agent.currentValue)}
                                   className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                   title="Stop Agent & Withdraw"
                                 >
                                   <Pause className="w-4 h-4" />
                                 </button>
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 bg-slate-950 rounded-xl p-3 relative z-10">
                              <div>
                                <div className="text-[10px] text-slate-500 font-mono uppercase mb-1">Allocated</div>
                                <div className="font-mono text-sm">${agent.allocated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500 font-mono uppercase mb-1">Current Value</div>
                                <div className={`font-mono text-sm font-bold ${agent.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  <AnimatedValue value={agent.currentValue} formatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Your wallet positions — MetaMask paper actions, marked live */}
            {positions.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-indigo-400" /> Your Wallet Positions
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">Agent Wallet paper actions · marked live</span>
                </div>
                <div className="space-y-2">
                  {positions.map((pos) => {
                    const up = pos.pnl >= 0;
                    const short = pos.side === 'short' || pos.side === 'sell';
                    return (
                      <div key={pos.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 ${pos.status === 'closed' ? 'bg-slate-950/40 opacity-60' : 'bg-slate-950/60'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${short ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {short ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{pos.symbol}
                              <span className="text-xs text-slate-500 font-mono uppercase ml-2">{pos.tradeType === 'perp' ? `${pos.side} ${pos.leverage}x` : pos.side}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              size {pos.size} · entry ${pos.entry?.toLocaleString()}{pos.current != null ? ` · now $${pos.current.toLocaleString()}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={`text-sm font-mono font-bold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {up ? '+' : ''}{pos.pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </div>
                            <div className={`text-[11px] font-mono ${up ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>{up ? '+' : ''}{pos.pnlPct}%</div>
                          </div>
                          {pos.status === 'open' ? (
                            <button onClick={() => handleClosePosition(pos.id)} disabled={closingId === pos.id} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50">
                              {closingId === pos.id ? 'Closing…' : 'Close'}
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-slate-800 text-slate-400">Settled</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Leaderboard snippet */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 mt-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard
                </h3>
                {activeLeagueId === 'global' && (
                  <div className="flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-1">
                    {['All', 'Platinum', 'Gold', 'Silver', 'Bronze'].map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setActiveTier(tier)}
                        className={`px-4 py-1.5 text-sm transition-colors rounded-lg ${
                          activeTier === tier 
                            ? 'font-bold bg-slate-800 text-white' 
                            : 'font-medium text-slate-400 hover:text-white'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500 font-mono uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Rank</th>
                      <th className="px-4 py-4 font-semibold">Player</th>
                      <th className="px-4 py-4 font-semibold">Active Agents</th>
                      <th className="px-4 py-4 font-semibold text-right">PnL</th>
                      <th className="px-4 py-4 font-semibold text-right">ROI</th>
                      <th className="px-4 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">

                    {visibleLeaderboard.map((player) => {
                      const isYou = player.userId === user.id;
                      const tier = tierOf(player.rank);
                      return (
                      <tr
                        key={player.rank}
                        onClick={() => setInspectedPlayerRank(player.rank)}
                        className={`transition-colors group cursor-pointer ${isYou ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'hover:bg-slate-800/50'}`}
                      >
                        <td className={`px-4 py-4 font-mono font-bold ${isYou ? 'text-indigo-400' : 'text-slate-300'}`}>
                          <div className="flex items-center gap-1.5">
                            {player.rank === 1 ? <Crown className="w-5 h-5 text-yellow-500" /> :
                             player.rank === 2 ? <Crown className="w-5 h-5 text-slate-300" /> :
                             player.rank === 3 ? <Crown className="w-5 h-5 text-amber-700" /> :
                             `0${player.rank}`}
                            {player.move > 0 && <span className="text-[10px] text-emerald-400">▲{player.move}</span>}
                            {player.move < 0 && <span className="text-[10px] text-rose-400">▼{Math.abs(player.move)}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-white text-base group-hover:text-indigo-400 transition-colors">{player.address.substring(0, 6)}...{isYou && <span className="ml-2 text-xs text-indigo-400 font-mono">You</span>}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">{player.name}
                            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${tierStyles[tier]}`}>{tier}</span>
                            {player.streak >= 2 && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-300 border-orange-500/20" title={`${player.streak} profitable days in a row`}>🔥{player.streak}</span>
                            )}
                            {player.badges?.length > 0 && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-slate-800/80 text-slate-300 border-slate-700" title={player.badges.map((b: any) => `${b.icon} ${b.name}`).join('  ')}>🏅{player.badges.length}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-400">{player.agents} <span className="text-xs ml-1 bg-slate-800 group-hover:bg-indigo-500/10 group-hover:text-indigo-300 px-2 py-0.5 rounded text-slate-500 transition-colors">{player.strategy}</span></td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-mono font-bold text-base ${(player.currentBal - player.startBal) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(player.currentBal - player.startBal) >= 0 ? '+' : ''}
                            {((player.currentBal - player.startBal)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-mono font-bold text-emerald-400 text-lg">{player.roi}</span>
                        </td>
                        <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-5 h-5 text-slate-400 inline-block" />
                        </td>
                      </tr>
                      );
                    })}
                    {visibleLeaderboard.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">
                          {leaderboard.length === 0
                            ? 'No agents competing yet. Deploy an agent to claim the top spot.'
                            : `No players in ${activeTier} tier yet.`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        )}

        {/* Custom Leagues Tab */}
        {activeTab === 'leagues' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagues.map((league) => {
                const isJoined = joinedLeagues.includes(league.id);
                return (
                  <div key={league.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/30 transition-all group flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{league.name}</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-1 rounded bg-slate-800 text-slate-400">
                        {league.risk} Risk
                      </span>
                    </div>
                    
                    <div className="space-y-3 mb-6 flex-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Creator</span>
                        <span className="font-mono text-slate-300">{league.creator}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Prize Pool</span>
                        <span className="text-yellow-500 font-medium">{league.prize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Participants</span>
                        <span className="text-slate-300 flex items-center gap-1"><Users className="w-3 h-3" /> {league.participants}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ends In</span>
                        <span className="text-slate-300">{league.time}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleJoinLeague(league.id)}
                      className={`w-full py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                        isJoined 
                          ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:bg-indigo-500' 
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      {isJoined ? 'Enter Arena' : 'Join League'} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Create Tab */}
        {activeTab === 'create' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-2">Create Custom League</h2>
              <p className="text-slate-400 mb-8 text-sm">Set up a paper trading competition with custom parameters to challenge your friends or community.</p>

              <form className="space-y-6" onSubmit={handleCreateLeague}>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">League Name</label>
                  <input 
                    type="text" 
                    value={newLeagueName}
                    onChange={(e) => setNewLeagueName(e.target.value)}
                    placeholder="e.g., Bear Market Brawlers" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500" 
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Starting Balance (Simulated USDC)</label>
                    <input 
                      type="number" 
                      value={newLeagueBalance}
                      onChange={(e) => setNewLeagueBalance(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500" 
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Duration (Days)</label>
                    <input 
                      type="number" 
                      value={newLeagueDuration}
                      onChange={(e) => setNewLeagueDuration(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500" 
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Allowed Strategies</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-3 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800">
                      <input type="checkbox" defaultChecked className="accent-yellow-500" />
                      <span className="text-sm">Spot Trading</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800">
                      <input type="checkbox" defaultChecked className="accent-yellow-500" />
                      <span className="text-sm">Perpetuals</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800">
                      <input type="checkbox" defaultChecked className="accent-yellow-500" />
                      <span className="text-sm">Yield Farming</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800">
                      <input type="checkbox" defaultChecked className="accent-yellow-500" />
                      <span className="text-sm">Prediction Markets</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                    Initialize League <Zap className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </div>

      {/* Deploy Agent Modal */}
      <AnimatePresence>
        {deployModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
              onClick={() => { setDeployModalOpen(false); setIsCreatingAgent(false); }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 z-50 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Bot className="w-5 h-5 text-indigo-400" /> {isCreatingAgent ? 'Create Custom Agent' : 'Designate Agent'}</h3>
                <button onClick={() => { setDeployModalOpen(false); setIsCreatingAgent(false); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isCreatingAgent ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Agent Name</label>
                    <input type="text" value={newAgentForm.name} onChange={e => setNewAgentForm({...newAgentForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g., Alpha Seeker" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Strategy Type</label>
                      <select value={newAgentForm.type} onChange={e => setNewAgentForm({...newAgentForm, type: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                        <option>Generalist</option>
                        <option>Yield Farmer</option>
                        <option>Arbitrage</option>
                        <option>Momentum</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Risk Profile</label>
                      <select value={newAgentForm.risk} onChange={e => setNewAgentForm({...newAgentForm, risk: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Instructions / Description</label>
                    <textarea value={newAgentForm.desc} onChange={e => setNewAgentForm({...newAgentForm, desc: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 h-24" placeholder="Describe the agent's behavior..." />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setIsCreatingAgent(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Cancel</button>
                    <button 
                      onClick={() => {
                        const newId = 'custom-' + Date.now();
                        setCustomAgents(prev => [{...newAgentForm, id: newId}, ...prev]);
                        setSelectedAgent(newId);
                        setIsCreatingAgent(false);
                        setNewAgentForm({ name: '', type: 'Generalist', risk: 'Medium', desc: '' });
                      }} 
                      disabled={!newAgentForm.name}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-colors"
                    >
                      Save Agent
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <button 
                      onClick={() => setIsCreatingAgent(true)}
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 transition-all font-medium"
                    >
                      + Create Custom Agent
                    </button>
                    {[...customAgents, ...AVAILABLE_AGENTS].map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          selectedAgent === agent.id 
                            ? 'bg-indigo-500/10 border-indigo-500' 
                            : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-bold text-white">{agent.name}</div>
                          <div className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">{agent.risk} Risk</div>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mb-2">{agent.type}</div>
                        <p className="text-sm text-slate-400 leading-relaxed">{agent.desc}</p>
                      </button>
                    ))}
                  </div>

                  {selectedAgent && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 pt-6 border-t border-slate-800 overflow-hidden">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Allocate Capital (Max: ${availableCapital.toLocaleString()})</label>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="relative flex-1">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            type="number" 
                            value={allocation}
                            onChange={(e) => setAllocation(Math.min(Number(e.target.value), availableCapital))}
                            max={availableCapital}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button 
                          onClick={() => setAllocation(availableCapital)}
                          className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold rounded-xl transition-colors"
                        >
                          MAX
                        </button>
                      </div>

                      <button 
                        onClick={handleDeploy}
                        disabled={isDeploying || allocation <= 0 || allocation > availableCapital}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        {isDeploying ? (
                          <><Activity className="w-5 h-5 animate-spin" /> Initializing Agent...</>
                        ) : (
                          <><Play className="w-5 h-5 fill-current" /> Execute Deployment</>
                        )}
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Inspected Agent Modal */}
      <AnimatePresence>
        {inspectedAgentId && activeAgents.find(a => a.id === inspectedAgentId) && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
              onClick={() => setInspectedAgentId(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl z-50 shadow-2xl flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              {(() => {
                const agent = activeAgents.find(a => a.id === inspectedAgentId);
                if (!agent) return null;
                
                return (
                  <>
                    <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-2xl font-bold text-white">{agent.name}</h3>
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-xs uppercase font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /> Active
                          </span>
                        </div>
                        <div className="text-slate-500 text-sm">{agent.type} Strategy • {agent.risk || 'Medium'} Risk</div>
                      </div>
                      <button onClick={() => setInspectedAgentId(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex border-b border-slate-800 bg-slate-950">
                      <button 
                        onClick={() => setInspectTab('logs')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 border-b-2 ${inspectTab === 'logs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                      >
                        <Terminal className="w-4 h-4" /> Live Logs
                      </button>
                      <button 
                        onClick={() => setInspectTab('settings')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 border-b-2 ${inspectTab === 'settings' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                      >
                        <Sliders className="w-4 h-4" /> Manage Agent
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto">
                      {inspectTab === 'logs' && (
                        <div className="bg-black border border-slate-800 rounded-xl p-4 h-64 font-mono text-xs overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                          <div className="text-emerald-500">[System] {agent.name} initialized and connected to mainnet feed.</div>
                          <div className="text-slate-400">[{new Date(Date.now() - 300000).toLocaleTimeString()}] Analyzing current market volatility...</div>
                          <div className="text-slate-400">[{new Date(Date.now() - 240000).toLocaleTimeString()}] Opportunity detected on ETH/USDC pair.</div>
                          <div className="text-indigo-400">[{new Date(Date.now() - 120000).toLocaleTimeString()}] Executing trade. Swap confirmed on Uniswap V3.</div>
                          <div className="text-emerald-400">[{new Date(Date.now() - 60000).toLocaleTimeString()}] Position closed. Net PnL: {agent.pnl >= 0 ? '+' : ''}${agent.pnl.toFixed(2)}</div>
                          <div className="text-slate-500 flex items-center gap-2 mt-2"><Activity className="w-3 h-3 animate-pulse" /> Monitoring for next signal...</div>
                        </div>
                      )}
                      
                      {inspectTab === 'settings' && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                              <div className="text-xs text-slate-500 font-mono uppercase mb-1">Current Value</div>
                              <div className="text-2xl font-bold text-white">${agent.currentValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                              <div className="text-xs text-slate-500 font-mono uppercase mb-1">Net ROI</div>
                              <div className={`text-2xl font-bold ${agent.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {agent.pnl >= 0 ? '+' : ''}{((agent.pnl / agent.allocated) * 100).toFixed(2)}%
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800">
                            <h4 className="text-sm font-bold text-white mb-4">Agent Configuration</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Risk Profile</label>
                                <select 
                                  value={agent.risk || 'Medium'} 
                                  onChange={(e) => {
                                    setActiveAgents(prev => prev.map(a => a.id === agent.id ? { ...a, risk: e.target.value } : a));
                                  }}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                  <option>Low</option>
                                  <option>Medium</option>
                                  <option>High</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Strategy Focus</label>
                                <select 
                                  value={agent.type} 
                                  onChange={(e) => {
                                    setActiveAgents(prev => prev.map(a => a.id === agent.id ? { ...a, type: e.target.value } : a));
                                  }}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                  <option>Generalist</option>
                                  <option>Yield</option>
                                  <option>Arbitrage</option>
                                  <option>Leverage</option>
                                  <option>Momentum</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Inject Capital</label>
                              <div className="flex gap-2 mb-2">
                                <div className="relative flex-1">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                  <input 
                                    type="number" 
                                    value={inspectDepositAmount || ''}
                                    onChange={(e) => setInspectDepositAmount(Number(e.target.value))}
                                    placeholder="0"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <button onClick={() => setInspectDepositAmount(availableCapital)} className="px-3 bg-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:text-white">MAX</button>
                              </div>
                              <button 
                                onClick={handleInspectDeposit}
                                disabled={!inspectDepositAmount || inspectDepositAmount <= 0 || inspectDepositAmount > availableCapital}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                              >
                                <ArrowDownRight className="w-4 h-4" /> Deposit
                              </button>
                              <div className="text-xs text-slate-500 mt-2">Available: ${availableCapital.toLocaleString()}</div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Withdraw Capital</label>
                              <div className="flex gap-2 mb-2">
                                <div className="relative flex-1">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                  <input 
                                    type="number" 
                                    value={inspectWithdrawAmount || ''}
                                    onChange={(e) => setInspectWithdrawAmount(Number(e.target.value))}
                                    placeholder="0"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-rose-500"
                                  />
                                </div>
                                <button onClick={() => setInspectWithdrawAmount(agent.currentValue)} className="px-3 bg-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:text-white">MAX</button>
                              </div>
                              <button 
                                onClick={handleInspectWithdraw}
                                disabled={!inspectWithdrawAmount || inspectWithdrawAmount <= 0 || inspectWithdrawAmount > agent.currentValue}
                                className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                              >
                                <ArrowUpRight className="w-4 h-4" /> Withdraw
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Inspected Player Modal */}
      <AnimatePresence>
        {inspectedPlayerRank !== null && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
              onClick={() => setInspectedPlayerRank(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl z-50 shadow-2xl flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              {(() => {
                const player = leaderboard.find(p => p.rank === inspectedPlayerRank);
                if (!player) return null;
                
                return (
                  <>
                    <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900 rounded-t-3xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                            {player.rank === 1 ? <Crown className="w-6 h-6 text-yellow-500" /> : 
                             player.rank === 2 ? <Crown className="w-6 h-6 text-slate-300" /> :
                             player.rank === 3 ? <Crown className="w-6 h-6 text-amber-700" /> :
                             <span className="text-xl font-mono text-slate-400">#{player.rank}</span>}
                            {player.name}
                          </h3>
                        </div>
                        <div className="text-slate-500 text-sm font-mono">{player.address}</div>
                      </div>
                      <button onClick={() => setInspectedPlayerRank(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors relative z-10">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 mb-8">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 sm:col-span-2">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Total PnL</div>
                          <div className={`text-xl font-bold ${(player.currentBal - player.startBal) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(player.currentBal - player.startBal) >= 0 ? '+' : ''}{((player.currentBal - player.startBal)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 sm:col-span-1">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Total ROI</div>
                          <div className="text-xl font-bold text-emerald-400">{player.roi}</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 sm:col-span-1">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Agents</div>
                          <div className="text-xl font-bold text-white">{player.agents}</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 sm:col-span-2">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Primary Strategy</div>
                          <div className="text-lg font-bold text-white">{player.strategy}</div>
                        </div>
                      </div>

                      {player.badges?.length > 0 && (
                        <>
                          <h4 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Achievements</h4>
                          <div className="flex flex-wrap gap-2 mb-8">
                            {player.badges.map((b: any) => (
                              <div key={b.id} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2" title={b.desc}>
                                <span className="text-lg">{b.icon}</span>
                                <div>
                                  <div className="text-xs font-bold text-white">{b.name}</div>
                                  <div className="text-[10px] text-slate-500">{b.desc}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Honest arsenal summary — only what we actually know about this player. */}
                      <h4 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Arsenal</h4>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div>
                            <div className="font-bold text-white mb-0.5">{player.agents > 0 ? `${player.agents} active agent${player.agents > 1 ? 's' : ''}` : 'Wallet-powered'}</div>
                            <div className="text-xs text-slate-500 font-mono">Lead strategy: {player.strategy}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono text-sm font-bold ${(player.currentBal - player.startBal) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{player.roi}</div>
                          <div className="text-xs text-slate-500 font-mono">this board</div>
                        </div>
                      </div>

                      <div className="mt-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-4">
                        <Activity className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h5 className="font-bold text-indigo-300 text-sm mb-1">Copy their edge</h5>
                          <p className="text-xs text-indigo-400/80 leading-relaxed">
                            Shared strategies from other players can be copied from Rooms — deploy one, tune it, and take their spot on the board.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
