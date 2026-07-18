import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Swords, Users, Target, Award, TrendingUp, Plus, Bot, Zap, ShieldCheck, Clock, ChevronRight, Crown, Activity, Rocket, DollarSign, PieChart, Play, Pause, X, Wallet, Settings, Terminal, ArrowUpRight, ArrowDownRight, Sliders, Share2 } from 'lucide-react';
import { User, TradingAgent, PaperTrade } from '../types';
import { apiFetch, safeJson } from '../lib/api';
import { burst } from '../lib/fx';

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
  agents: TradingAgent[];
  trades: PaperTrade[];
  onAgentCreated: (payload: any) => Promise<void>;
  onAgentStatusChanged: (id: string, status: 'active' | 'paused' | 'revoked') => Promise<void>;
  onAgentAutopilotChanged: (id: string, enabled: boolean) => Promise<void>;
}

// Deploy templates: picking one creates a REAL trading agent (same backend as
// the Trading Agents tab) with a sensible strategy + market preset.
const AGENT_TEMPLATES = [
  { id: 't1', name: 'Swarm Copilot', type: 'Generalist', risk: 'Medium', desc: 'Adaptive AI strategy across majors.', strategyType: 'custom_ai', assetSymbol: 'ETH', tradeType: 'token' },
  { id: 't2', name: 'Delta Farmer', type: 'Yield', risk: 'Low', desc: 'Grid strategy that harvests range-bound moves.', strategyType: 'grid', assetSymbol: 'ETH', tradeType: 'token' },
  { id: 't3', name: 'Perp Sniper', type: 'Leverage', risk: 'High', desc: 'Momentum entries on BTC with leverage.', strategyType: 'momentum', assetSymbol: 'BTC', tradeType: 'perp' },
  { id: 't4', name: 'Arb Finder', type: 'Mean Reversion', risk: 'Low', desc: 'Fades overextended moves on SOL.', strategyType: 'mean_reversion', assetSymbol: 'SOL', tradeType: 'token' },
] as const;

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

export const AgentArena: React.FC<AgentArenaProps> = ({ user, agents, trades, onAgentCreated, onAgentStatusChanged, onAgentAutopilotChanged }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leagues' | 'create'>('dashboard');
  const [activeLeagueId, setActiveLeagueId] = useState<string | 'global'>(() => (
    new URLSearchParams(window.location.search).get('league') || 'global'
  ));
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployError, setDeployError] = useState('');
  const [arenaError, setArenaError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [leagues, setLeagues] = useState<any[]>([]);
  const [joinedLeagues, setJoinedLeagues] = useState<(string | 'global')[]>(['global']);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueBalance, setNewLeagueBalance] = useState(10000);
  const [newLeagueDuration, setNewLeagueDuration] = useState(7);
  // AR6: these were hardcoded to 'Medium' / 'Community Pool' in the POST body,
  // while every league card rendered them as if the creator had chosen them. The
  // server validates `risk` against ['Low','Medium','High'] and sanitizes
  // `prize` (arena.ts:340-341) — it always accepted real values; the form simply
  // never asked. Now it asks.
  const [newLeagueRisk, setNewLeagueRisk] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [newLeaguePrize, setNewLeaguePrize] = useState('');
  const [activeTier, setActiveTier] = useState('All');
  const [scoringMetric, setScoringMetric] = useState<'roi' | 'pnl' | 'volume'>('roi');

  const [inspectedAgentId, setInspectedAgentId] = useState<string | null>(null);

  const [inspectedPlayerRank, setInspectedPlayerRank] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [celebrationAction, setCelebrationAction] = useState<{ label: string; tab: 'trading' | 'rooms' } | null>(null);

  // Every Arena modal must have the same keyboard recovery path. Mouse-only
  // backdrops leave keyboard and assistive-technology users stranded.
  useEffect(() => {
    if (!deployModalOpen && !inspectedAgentId && inspectedPlayerRank === null) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (inspectedPlayerRank !== null) setInspectedPlayerRank(null);
      else if (inspectedAgentId) setInspectedAgentId(null);
      else setDeployModalOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [deployModalOpen, inspectedAgentId, inspectedPlayerRank]);

  // ---- Real portfolio, real agents, real P&L — no simulation in this layer.
  // Your agents are the SAME agents as the Trading Agents tab; P&L is the sum
  // of actual realized fills recorded by the trading engine.
  const myAgents = agents.filter((a) => a.status !== 'revoked');
  const activeAgents = myAgents.filter((a) => a.status === 'active');
  const realizedByAgent = React.useMemo(() => {
    const m: Record<string, { pnl: number; trades: number }> = {};
    for (const t of trades) {
      const e = (m[t.agentId] = m[t.agentId] || { pnl: 0, trades: 0 });
      e.trades += 1;
      if (typeof t.pnl === 'number') e.pnl += t.pnl;
    }
    return m;
  }, [trades]);
  const totalPnL = React.useMemo(
    () => trades.reduce((s, t) => s + (typeof t.pnl === 'number' ? t.pnl : 0), 0),
    [trades]
  );

  const [positions, setPositions] = useState<any[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [boardMeta, setBoardMeta] = useState<{ name: string; endsAt: number; metric?: string; metricLabel?: string } | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const prevRankRef = useRef<{ leagueId: string | 'global'; metric: string; rank: number } | null>(null);
  // Mirrors activeLeagueId so an in-flight response can ask "am I still the
  // league on screen?" without closing over the value it started with.
  const activeLeagueIdRef = useRef<string | 'global'>(activeLeagueId);
  activeLeagueIdRef.current = activeLeagueId;
  const scoringMetricRef = useRef(scoringMetric);
  scoringMetricRef.current = scoringMetric;

  // Auto-dismiss celebration toasts.
  useEffect(() => {
    if (!celebration || celebrationAction) return;
    const t = setTimeout(() => {
      setCelebration(null);
      setCelebrationAction(null);
    }, 6500);
    return () => clearTimeout(t);
  }, [celebration, celebrationAction]);

  // Keep the selected board in the address bar so refresh, profile setup, and
  // copy/paste preserve the invitation target. Selecting Global clears only
  // the league query, not the current session or any product state.
  const selectLeague = React.useCallback((id: string | 'global') => {
    setActionError('');
    setArenaError('');
    setBoardMeta(null);
    setLeaderboard([]);
    setActiveLeagueId(id);
    const url = new URL(window.location.href);
    url.pathname = '/arena';
    if (id === 'global') url.searchParams.delete('league');
    else url.searchParams.set('league', id);
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
  }, []);

  const loadPositions = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await apiFetch('/api/arena/positions', signal ? { signal } : undefined);
      if (signal?.aborted) return;
      if (res.ok) setPositions((await safeJson(res)).positions || []);
      else setActionError('Wallet positions could not be refreshed. The last confirmed values remain on screen.');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('[arena] loadPositions failed; keeping last good state', e);
      setActionError('Wallet positions could not be refreshed. The last confirmed values remain on screen.');
    }
  }, []);

  // Switching leagues fires a new request while the previous is still in flight,
  // and the slower response wins the setState race — so league A's board could
  // overwrite league B's, with a rank-up celebration computed by comparing ranks
  // across two different boards. The signal aborts the stale request; the id
  // check backs it up, since a response already resolved cannot be aborted.
  const loadArena = React.useCallback(async (signal?: AbortSignal) => {
    const requestedLeagueId = activeLeagueId;
    const requestedMetric = scoringMetric;
    const isStale = () => !!signal?.aborted || requestedLeagueId !== activeLeagueIdRef.current || requestedMetric !== scoringMetricRef.current;
    try {
      const init = signal ? { signal } : undefined;
      const [lgRes, lbRes] = await Promise.all([
        apiFetch('/api/arena/leagues', init),
        apiFetch(`/api/arena/leaderboard?leagueId=${encodeURIComponent(requestedLeagueId)}&metric=${requestedMetric}`, init),
      ]);
      if (isStale()) return;
      if (lgRes.ok) {
        const data = await safeJson(lgRes);
        const mapped = (data.leagues || []).map((l: any) => ({
          id: l.id, name: l.name, creator: l.creatorName,
          participants: l.participants, prize: l.prize,
          time: msToLeft(l.endsAt), risk: l.risk, joined: l.joined,
          status: l.status, endsAt: l.endsAt,
        }));
        setLeagues(mapped);
        setJoinedLeagues(['global', ...mapped.filter((l: any) => l.joined).map((l: any) => l.id)]);
      }
      if (lbRes.ok) {
        const data = await safeJson(lbRes);
        if (isStale()) return;
        setArenaError('');
        const rows = data.leaderboard || [];
        setLeaderboard(rows);
        if (data.board) setBoardMeta(data.board);
        // Celebrate a genuine rank-up on the same board. Compare against the
        // league this response is FOR, not whichever league is selected now.
        const mine = rows.find((p: any) => p.userId === user.id);
        const prev = prevRankRef.current;
        if (mine && prev && prev.leagueId === requestedLeagueId && prev.metric === requestedMetric && mine.rank < prev.rank) {
          setCelebrationAction(null);
          setCelebration(`🚀 Rank up! #${prev.rank} → #${mine.rank}`);
          burst('rankup');
        }
        prevRankRef.current = mine ? { leagueId: requestedLeagueId, metric: requestedMetric, rank: mine.rank } : null;
      } else if (lbRes.status === 404 && requestedLeagueId !== 'global') {
        setLeaderboard([]);
        setBoardMeta(null);
        setArenaError('This league invite is unavailable. It may have been removed or the link may be incomplete.');
      } else {
        setArenaError('The Arena standings could not be loaded. Your account and paper balance were not changed.');
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('[arena] loadArena failed; keeping last good state', e);
      setArenaError('The Arena could not be reached. Check your connection and try again.');
    }
  }, [activeLeagueId, scoringMetric, user.id]);

  const handleClosePosition = async (id: string) => {
    setClosingId(id);
    setActionError('');
    try {
      const res = await apiFetch(`/api/arena/positions/${id}/close`, { method: 'POST' });
      if (res.ok) {
        const data = await safeJson(res).catch(() => null);
        const pnl = data?.position?.pnl;
        if (typeof pnl === 'number' && pnl > 0) {
          setCelebrationAction(null);
          setCelebration(`💰 +${pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} locked in!`);
          burst('profit');
        }
        await loadPositions();
        await loadArena();
      } else {
        const data = await safeJson(res);
        setActionError(data?.message || data?.error || 'This paper position could not be closed.');
      }
    } catch (e) {
      console.error('[arena] closePosition failed; the next refresh reconciles state', e);
      setActionError('This paper position could not be closed. Check your connection and try again.');
    } finally {
      setClosingId(null);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    loadArena(ctrl.signal);
    // Switching leagues (or unmounting) cancels the request for the old one
    // before it can land on the new board.
    return () => ctrl.abort();
  }, [loadArena]);

  // Refresh open positions periodically so their live P&L keeps ticking.
  useEffect(() => {
    const ctrl = new AbortController();
    let inFlight = false;
    const tick = async () => {
      // A 5s interval against a slower response would stack requests and let an
      // older one resolve last. Skip the tick instead of racing ourselves.
      if (inFlight) return;
      inFlight = true;
      try { await loadPositions(ctrl.signal); } finally { inFlight = false; }
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { clearInterval(t); ctrl.abort(); };
  }, [loadPositions]);

  const fmtUsd = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1_000_000).toFixed(1)}M`
    : Math.abs(n) >= 1_000 ? `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1_000).toFixed(1)}K`
    : `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n))}`;

  // Real, computed arena stats derived from the live leaderboard (never faked).
  // `leaderboard` already reflects the active league (global or a specific one).
  const arenaStats = React.useMemo(() => {
    const participants = leaderboard.length;
    const capitalInPlay = leaderboard.reduce((s, p) => s + (p.currentBal || 0), 0);
    const totalVolume = leaderboard.reduce((s, p) => s + (p.volumeUsd || 0), 0);
    const topScore = leaderboard[0]
      ? scoringMetric === 'volume' ? fmtUsd(leaderboard[0].volumeUsd || 0)
      : scoringMetric === 'pnl' ? fmtUsd(leaderboard[0].pnlValue || 0)
      : leaderboard[0].roi
      : '—';
    const inProfit = leaderboard.filter((p) => (p.roiValue || 0) > 0).length;
    const myRank = leaderboard.find((p) => p.userId === user.id)?.rank ?? null;
    return { participants, capitalInPlay, totalVolume, topScore, inProfit, myRank };
  }, [leaderboard, scoringMetric, user.id]);

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

  const selectedLeague = activeLeagueId === 'global'
    ? null
    : leagues.find((league) => league.id === activeLeagueId);
  const leagueEnded = activeLeagueId !== 'global' && selectedLeague?.status === 'ended';

  const handleShare = async () => {
    const link = `${window.location.origin}/arena?league=${activeLeagueId}`;
    setActionError('');
    try {
      await navigator.clipboard.writeText(link);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (e) {
      console.warn('[arena] clipboard write failed', e);
      setShareCopied(false);
      setActionError('Clipboard access was blocked. Copy the invitation link from the dialog.');
      window.prompt('Copy this invite link:', link);
    }
  };

  // Competing requires the user's own MetaMask Agent Wallet.
  const walletConnected = !!user.walletAddress;
  const promptConnect = () => window.dispatchEvent(new Event('open-wallet-modal'));

  const handleJoinLeague = async (id: string | 'global') => {
    if (!walletConnected) { promptConnect(); return; }
    if (id === 'global' || joinedLeagues.includes(id)) {
      selectLeague(id);
      setActiveTab('dashboard');
      return;
    }
    setIsJoining(true);
    setActionError('');
    try {
      const res = await apiFetch(`/api/arena/leagues/${id}/join`, { method: 'POST' });
      if (res.ok || res.status === 409) {
        // 409 is only idempotent when the server says this membership already
        // exists. Inactive leagues also use 409 and must remain a visible error.
        const data = res.status === 409 ? await safeJson(res) : null;
        if (res.status === 409 && data?.error !== 'Already joined this league.') {
          setActionError(data?.message || data?.error || 'This league is not accepting new players.');
          return;
        }
        selectLeague(id);
        setActiveTab('dashboard');
        await loadArena();
      } else if (res.status === 403) {
        promptConnect();
      } else {
        const data = await safeJson(res);
        setActionError(data?.message || data?.error || 'This league could not be joined.');
      }
    } catch (e) {
      console.error('[arena] league action failed; the next load reconciles state', e);
      setActionError('This league could not be joined. Check your connection and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected) { promptConnect(); return; }
    if (!newLeagueName.trim()) return;
    setIsCreating(true);
    setActionError('');
    try {
      const res = await apiFetch('/api/arena/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: newLeagueName,
          startBalance: newLeagueBalance,
          durationDays: newLeagueDuration,
          risk: newLeagueRisk,
          // Empty means "let the server pick its default" (Reputation Badge),
          // rather than the client asserting a prize nobody chose.
          prize: newLeaguePrize.trim() || undefined,
        }),
      });
      if (res.ok) {
        setActiveTab('leagues');
        setNewLeagueName('');
        setNewLeagueBalance(10000);
        setNewLeagueDuration(7);
        setNewLeagueRisk('Medium');
        setNewLeaguePrize('');
        await loadArena();
      } else if (res.status === 403) {
        promptConnect();
      } else {
        const data = await safeJson(res);
        setActionError(data?.message || data?.error || 'This paper league could not be created.');
      }
    } catch (e) {
      console.error('[arena] league action failed', e);
      setActionError('This paper league could not be created. Check your connection and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Deploy a template as a REAL agent (same backend as the Trading Agents tab).
  const handleDeployTemplate = async (tpl: (typeof AGENT_TEMPLATES)[number]) => {
    setIsDeploying(true);
    setDeployError('');
    try {
      await onAgentCreated({
        name: `${tpl.name} #${myAgents.length + 1}`,
        description: tpl.desc,
        assetSymbol: tpl.assetSymbol,
        tradeType: tpl.tradeType,
        strategyType: tpl.strategyType,
        leverage: tpl.tradeType === 'perp' ? 5 : 1,
      });
      setDeployModalOpen(false);
      setCelebration(`🤖 ${tpl.name} deployed — place its first paper fill next`);
      setCelebrationAction({ label: 'Open Trading Desk', tab: 'trading' });
    } catch (e: any) {
      setDeployError(e.message || 'Could not deploy agent.');
    } finally {
      setIsDeploying(false);
    }
  };

  const handlePauseResume = async (agent: TradingAgent) => {
    try {
      await onAgentStatusChanged(agent.id, agent.status === 'active' ? 'paused' : 'active');
    } catch (e) {
      console.error('[arena] pause/resume failed; refreshed state will show the truth', e);
      setActionError('This agent status could not be changed. Its last confirmed state remains on screen.');
    }
  };

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden text-slate-300 relative bg-[#020617]">
      <DataStreamBackground />

      {/* Celebration toast — fires on real events (rank-up, profitable close) */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 z-50 bg-slate-900 border border-yellow-500/40 shadow-[0_0_36px_rgba(234,179,8,0.3)] rounded-2xl px-5 py-4 text-white font-bold text-sm flex flex-wrap items-center gap-3"
          >
            <span className="flex-1 min-w-0">{celebration}</span>
            {celebrationAction && (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('navigate', { detail: celebrationAction.tab }));
                  setCelebration(null);
                  setCelebrationAction(null);
                }}
                className="shrink-0 rounded-lg bg-yellow-500 px-3 py-2 text-xs font-black text-yellow-950 hover:bg-yellow-400"
              >
                {celebrationAction.label} <ChevronRight className="ml-1 inline-block h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => { setCelebration(null); setCelebrationAction(null); }}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex-none p-4 sm:p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex flex-wrap items-center gap-2 sm:gap-3 font-mono">
            <Swords className="w-6 h-6 text-yellow-500" />
            <span>Agent Arena</span>
            <span className="basis-full sm:basis-auto w-fit text-xs px-2 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded font-bold">PAPER LEAGUE</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Paper practice is open without a wallet. Connect a MetaMask Agent Wallet only when you want to enter ranked seasons and leagues.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1 sm:gap-2 w-full md:w-auto bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { selectLeague('global'); setActiveTab('dashboard'); }}
            aria-pressed={activeLeagueId === 'global' && activeTab === 'dashboard'}
            className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeLeagueId === 'global' && activeTab === 'dashboard' ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-slate-800'
            }`}
          >
            Global Season
          </button>
          <button
            onClick={() => setActiveTab('leagues')}
            aria-pressed={activeTab === 'leagues'}
            className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'leagues' ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-slate-800'
            }`}
          >
            <span><span className="hidden sm:inline">Custom </span>Leagues</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            aria-pressed={activeTab === 'create'}
            className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'create' ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 scrollbar-hide">
        {actionError && (
          <div role="alert" className="max-w-6xl mx-auto mb-4 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200 flex items-start justify-between gap-4">
            <span>{actionError}</span>
            <button onClick={() => setActionError('')} className="text-xs font-bold text-rose-300 hover:text-white">Dismiss</button>
          </div>
        )}
        {activeTab === 'dashboard' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ staggerChildren: 0.1 }}
            className="space-y-6 max-w-6xl mx-auto"
          >
            
            {arenaError && (
              <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">League invite unavailable</h2>
                  <p className="text-sm text-slate-300 mt-1">{arenaError}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { selectLeague('global'); setActiveTab('dashboard'); }} className="px-4 py-2 rounded-xl bg-yellow-500 text-yellow-950 font-bold">Open Global Season</button>
                  <button onClick={() => { selectLeague('global'); setActiveTab('leagues'); }} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold">Browse Leagues</button>
                </div>
              </div>
            )}

            {/* Header & Stats */}
            {!arenaError && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative"
            >
              {/* Decorative Background */}
              <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-yellow-500/20 blur-3xl pointer-events-none" />
              
              <div className="p-5 sm:p-8 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                  <div>
                    {/* One real countdown, one real title, no duplicated copy —
                        the page header above already explains the Arena. */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono uppercase tracking-widest mb-4">
                      <Clock className="w-3 h-3" />
                      {boardMeta ? msToLeft(boardMeta.endsAt) : '…'}{activeLeagueId === 'global' ? ' · resets monthly' : ''}
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight break-words">
                      {activeLeagueId === 'global'
                        ? (boardMeta ? `${boardMeta.name.replace('Season · ', '')} Season` : 'Global Season')
                        : (selectedLeague?.name || 'League unavailable')}
                    </h2>
                  </div>

                  <div className="flex items-center gap-4">
                    {joinedLeagues.includes(activeLeagueId) && walletConnected && (
                      <button
                        onClick={handleShare}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700"
                      >
                        <Share2 className="w-4 h-4" />
                        {shareCopied ? 'Link Copied!' : 'Invite Rivals'}
                      </button>
                    )}
                    {arenaError ? null : leagueEnded ? (
                      <div className="px-6 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                        <div className="text-xs text-slate-500 font-mono uppercase">League ended</div>
                        <div className="text-sm font-bold text-slate-200">Final standings</div>
                      </div>
                    ) : !walletConnected ? (
                      <button
                        onClick={promptConnect}
                        className="w-full sm:w-auto px-4 sm:px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white text-sm sm:text-base font-bold rounded-xl flex items-center justify-center gap-2 sm:gap-3 transition-all shadow-[0_0_30px_rgba(234,88,12,0.35)] hover:scale-105"
                      >
                        <Wallet className="w-5 h-5" />
                        <span className="sm:hidden">Connect to Compete</span>
                        <span className="hidden sm:inline">Connect MetaMask to Compete</span>
                      </button>
                    ) : !joinedLeagues.includes(activeLeagueId) ? (
                      <button
                        onClick={() => handleJoinLeague(activeLeagueId)}
                        disabled={isJoining}
                        className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:scale-105"
                      >
                        <Swords className="w-5 h-5" /> {isJoining ? 'Joining…' : 'Enter the Arena'}
                      </button>
                    ) : (
                      <div className="px-6 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                        <div className="text-xs text-slate-500 font-mono uppercase">Your Rank</div>
                        <div className="text-2xl font-bold text-yellow-500">{arenaStats.myRank ? `#${arenaStats.myRank}` : 'Unranked'}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* One honest stat line — the board below is the real content. */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-mono text-slate-400">
                  <span><span className="text-white font-bold">{arenaStats.participants}</span> competing</span>
                  <span className="text-slate-700">·</span>
                  <span><span className="text-white font-bold">{fmtUsd(arenaStats.capitalInPlay)}</span> in play</span>
                  <span className="text-slate-700">·</span>
                  <span><span className="text-white font-bold">{fmtUsd(arenaStats.totalVolume)}</span> traded</span>
                  <span className="text-slate-700">·</span>
                  <span>top {boardMeta?.metricLabel || 'Return %'} <span className="text-emerald-400 font-bold">{arenaStats.topScore}</span></span>
                  <span className="text-slate-700">·</span>
                  <span className="text-yellow-500/90">{activeLeagueId === 'global' ? 'reward: leaderboard glory' : `paper prize: ${selectedLeague?.prize || 'Reputation Badge'}`}</span>
                </div>
              </div>
            </motion.div>
            )}

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
                        <h3 className="text-slate-400 text-sm font-mono uppercase tracking-wider mb-1">Account Paper Balance</h3>
                        <div className="text-4xl font-mono font-bold text-white">
                          <AnimatedValue
                            value={user.paperBalance}
                            formatter={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          />
                        </div>
                        <div className={`text-sm font-mono mt-2 flex items-center gap-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                          <AnimatedValue
                            value={totalPnL}
                            formatter={(v) => `${v >= 0 ? '+' : ''}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} all-time realized P&L`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-800/50 relative z-10">
                       <div>
                         <div className="text-xs text-slate-500 font-mono uppercase mb-1 flex items-center gap-1"><Activity className="w-3 h-3" /> Trades Made</div>
                         <div className="text-xl font-mono text-slate-200">{trades.length}</div>
                       </div>
                       <div>
                         <div className="text-xs text-slate-500 font-mono uppercase mb-1 flex items-center gap-1"><Bot className="w-3 h-3" /> Active Agents</div>
                         <div className="text-xl font-mono text-slate-200">{activeAgents.length}</div>
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
                     <h3 className="text-lg font-bold text-white mb-2">Deploy Paper Agent</h3>
                     <p className="text-xs text-slate-400 mb-6">Deploy a paper agent and place fills from the Trading Desk. Connect your Agent Wallet when you are ready for those results to enter the ranked season.</p>
                     <button
                       onClick={() => setDeployModalOpen(true)}
                       className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors relative z-10"
                     >
                       <Plus className="w-5 h-5" /> Deploy Paper Agent
                     </button>
                  </motion.div>
                </div>

                {/* Your Agents — the REAL ones (same as the Trading Agents tab) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" /> Your Agents
                  </h3>

                  {myAgents.length === 0 ? (
                    <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                        <Bot className="w-8 h-8 text-slate-500" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">No Agents Yet</h4>
                      <p className="text-slate-400 mb-6 max-w-sm mx-auto">Deploy a paper agent and practice immediately. Ranked seasons begin after you connect your Agent Wallet.</p>
                      <button
                        onClick={() => setDeployModalOpen(true)}
                        className="px-6 py-3 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 font-bold rounded-xl transition-colors border border-indigo-500/30 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Deploy Your First Paper Agent
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AnimatePresence>
                        {myAgents.map(agent => {
                          const stats = realizedByAgent[agent.id] || { pnl: 0, trades: 0 };
                          const paused = agent.status === 'paused';
                          return (
                          <motion.div
                            key={agent.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group transition-colors ${paused ? 'opacity-60' : 'hover:border-indigo-500/50'}`}
                          >
                            <div className={`absolute top-0 left-0 w-1 h-full ${paused ? 'bg-slate-600' : 'bg-indigo-500'}`} />
                            <div className="flex justify-between items-start mb-4 relative z-10">
                               <div>
                                 <h4 className="font-bold text-white flex items-center gap-2">
                                   {agent.name}
                                   <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase ${paused ? 'bg-slate-700/40 text-slate-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                     {!paused && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />} {paused ? 'Paused' : 'Active'}
                                   </span>
                                   {agent.autopilot && !paused && (
                                     <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                       <Zap className="w-2.5 h-2.5 animate-pulse" /> Auto
                                     </span>
                                   )}
                                 </h4>
                                 <span className="text-xs text-slate-500">{agent.strategyType.replace('_', ' ')} · {agent.assetSymbol} · {agent.tradeType === 'perp' ? `${agent.leverage}x perp` : 'spot'}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <button
                                   onClick={() => setInspectedAgentId(agent.id)}
                                   className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                   title="Agent details"
                                 >
                                   <Settings className="w-4 h-4" />
                                 </button>
                                 <button
                                   onClick={() => onAgentAutopilotChanged(agent.id, !agent.autopilot)}
                                   className={`p-1.5 rounded-lg transition-colors ${agent.autopilot ? 'text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20' : 'text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10'}`}
                                   title={agent.autopilot ? 'Paper Autopilot ON — click to stop simulated trading.' : 'Enable Paper Autopilot — simulated trades based on market prices'}
                                 >
                                   <Zap className="w-4 h-4" />
                                 </button>
                                 <button
                                   onClick={() => handlePauseResume(agent)}
                                   className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                   title={paused ? 'Resume agent' : 'Pause agent'}
                                 >
                                   {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                 </button>
                               </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-950 rounded-xl p-3 relative z-10">
                              <div>
                                <div className="text-[10px] text-slate-500 font-mono uppercase mb-1">Trades</div>
                                <div className="font-mono text-sm">{stats.trades}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500 font-mono uppercase mb-1">Realized P&L</div>
                                <div className={`font-mono text-sm font-bold ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                          );
                        })}
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
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-8 mt-8">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Rank by</span>
                    <div className="flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-1">
                      {([
                        ['roi', 'Return %'],
                        ['pnl', 'P&L'],
                        ['volume', 'Volume'],
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          onClick={() => { setScoringMetric(id); setInspectedPlayerRank(null); }}
                          aria-pressed={scoringMetric === id}
                          className={`px-3 py-1.5 text-sm transition-colors rounded-lg ${scoringMetric === id ? 'font-bold bg-yellow-500/15 text-yellow-300' : 'font-medium text-slate-400 hover:text-white'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
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
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500 font-mono uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Rank</th>
                      <th className="px-4 py-4 font-semibold">Player</th>
                      <th className="px-4 py-4 font-semibold">Scored Lanes</th>
                      <th className={`px-4 py-4 font-semibold text-right ${scoringMetric === 'volume' ? 'text-yellow-300' : ''}`}>Volume</th>
                      <th className={`px-4 py-4 font-semibold text-right ${scoringMetric === 'pnl' ? 'text-yellow-300' : ''}`}>P&amp;L</th>
                      <th className={`px-4 py-4 font-semibold text-right ${scoringMetric === 'roi' ? 'text-yellow-300' : ''}`}>Return</th>
                      <th className="px-4 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">

                    {visibleLeaderboard.map((player) => {
                      const isYou = player.userId === user.id;
                      const tier = tierOf(player.rank);
                      return (
                      <tr
                        key={player.userId}
                        onClick={() => setInspectedPlayerRank(player.rank)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setInspectedPlayerRank(player.rank);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${player.name}'s Arena profile, rank ${player.rank}`}
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
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {(player.lanes || []).filter((lane: any) => lane.events > 0).map((lane: any) => (
                              <span key={lane.key} className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                                {lane.label}
                              </span>
                            ))}
                            {!(player.lanes || []).some((lane: any) => lane.events > 0) && <span className="text-xs text-slate-600">No scored activity</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{player.activityCount || 0} events · {player.activeDays || 0} active days</div>
                        </td>
                        <td className={`px-4 py-4 text-right font-mono font-bold ${scoringMetric === 'volume' ? 'text-yellow-300' : 'text-slate-300'}`}>{fmtUsd(player.volumeUsd || 0)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-mono font-bold text-base ${(player.pnlValue || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} ${scoringMetric === 'pnl' ? 'underline decoration-yellow-500/40 underline-offset-4' : ''}`}>
                            {(player.pnlValue || 0) >= 0 ? '+' : ''}{fmtUsd(player.pnlValue || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-mono font-bold text-lg ${(player.roiValue || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} ${scoringMetric === 'roi' ? 'underline decoration-yellow-500/40 underline-offset-4' : ''}`}>{player.roi}</span>
                        </td>
                        <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-5 h-5 text-slate-400 inline-block" />
                        </td>
                      </tr>
                      );
                    })}
                    {visibleLeaderboard.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-sm">
                          {leaderboard.length === 0
                            ? (arenaError ? 'No standings are available for this invitation.' : 'No agents competing yet. Deploy a paper agent to claim the top spot.')
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
                const isEnded = league.status === 'ended';
                return (
                  <div key={league.id} className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all group flex flex-col ${isEnded ? 'opacity-75' : 'hover:border-indigo-500/30'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{league.name}</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-1 rounded bg-slate-800 text-slate-400">
                        {isEnded ? 'Ended' : `${league.risk} Risk`}
                      </span>
                    </div>
                    
                    <div className="space-y-3 mb-6 flex-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Creator</span>
                        <span className="font-mono text-slate-300">{league.creator}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Paper Prize</span>
                        <span className="text-yellow-500 font-medium">{league.prize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Participants</span>
                        <span className="text-slate-300 flex items-center gap-1"><Users className="w-3 h-3" /> {league.participants}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isEnded ? 'Status' : 'Ends In'}</span>
                        <span className="text-slate-300">{league.time}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        if (isEnded) {
                          selectLeague(league.id);
                          setActiveTab('dashboard');
                        } else {
                          handleJoinLeague(league.id);
                        }
                      }}
                      disabled={isJoining && !isEnded}
                      className={`w-full py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                        isEnded
                          ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          : isJoined
                          ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:bg-indigo-500' 
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      {isEnded ? 'View Final Standings' : isJoined ? 'Enter Arena' : isJoining ? 'Joining…' : 'Join League'} <ChevronRight className="w-4 h-4" />
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-8">
              <h2 className="text-2xl font-bold text-white mb-2">Create Custom League</h2>
              <p className="text-slate-400 mb-8 text-sm">Set up a paper trading competition with custom parameters to challenge your friends or community.</p>

              {!walletConnected && (
                <div role="note" className="mb-6 rounded-xl border border-orange-500/30 bg-orange-950/20 p-4 text-sm text-orange-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>Creating and joining ranked leagues requires your MetaMask Agent Wallet. Paper practice remains open without it.</span>
                  <button type="button" onClick={promptConnect} className="shrink-0 rounded-lg bg-orange-600 px-3 py-2 font-bold text-white hover:bg-orange-500">Connect Agent Wallet</button>
                </div>
              )}

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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                {/* 2.5: this block used to be four `defaultChecked` checkboxes
                    labelled "Allowed Strategies" — unbound to state, absent from
                    the POST body, and unknown to the server, which has no concept
                    of per-league strategy restrictions. Toggling them changed
                    nothing, while promising a permission system that does not
                    exist. Replaced with the two fields the API actually honours
                    (AR6), which the form had been hardcoding behind the user's
                    back. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Risk band</label>
                    <select
                      value={newLeagueRisk}
                      onChange={(e) => setNewLeagueRisk(e.target.value as 'Low' | 'Medium' | 'High')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-yellow-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Paper prize label</label>
                    <input
                      type="text"
                      maxLength={60}
                      value={newLeaguePrize}
                      onChange={(e) => setNewLeaguePrize(e.target.value)}
                      placeholder="Reputation Badge"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 outline-none focus:border-yellow-500"
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type={walletConnected ? 'submit' : 'button'}
                    onClick={walletConnected ? undefined : promptConnect}
                    disabled={isCreating}
                    className="w-full py-4 bg-white disabled:bg-slate-700 disabled:text-slate-400 text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    {isCreating ? 'Creating Paper League…' : walletConnected ? 'Initialize Paper League' : 'Connect Wallet to Initialize'} <Zap className="w-4 h-4" />
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
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
              onClick={() => setDeployModalOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="deploy-paper-agent-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 z-50 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 id="deploy-paper-agent-title" className="text-xl font-bold text-white flex items-center gap-2"><Bot className="w-5 h-5 text-indigo-400" /> Deploy a Paper Agent</h3>
                <button aria-label="Close deploy dialog" onClick={() => setDeployModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                Pick a starter — this creates a paper agent that also appears in Trading Agents. Practice fills are immediate; connect your Agent Wallet to enter ranked seasons.
              </p>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                {AGENT_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => handleDeployTemplate(tpl)}
                    disabled={isDeploying}
                    className="w-full text-left p-4 rounded-xl border bg-slate-950 border-slate-800 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all disabled:opacity-50"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-bold text-white">{tpl.name}</div>
                      <div className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">{tpl.risk} Risk</div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mb-2">{tpl.type} · {tpl.assetSymbol} · {tpl.tradeType === 'perp' ? 'perps' : 'spot'}</div>
                    <p className="text-sm text-slate-400 leading-relaxed">{tpl.desc}</p>
                  </button>
                ))}
                <button
                  onClick={() => { setDeployModalOpen(false); window.dispatchEvent(new CustomEvent('navigate', { detail: 'agents' })); }}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 transition-all font-medium"
                >
                  Build a custom paper agent in the Trading Agents tab →
                </button>
              </div>

              {isDeploying && (
                <div className="mt-4 text-sm text-indigo-300 flex items-center gap-2"><Activity className="w-4 h-4 animate-spin" /> Deploying…</div>
              )}
              {deployError && <p className="mt-4 text-sm text-rose-400">{deployError}</p>}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Inspected Agent Modal — real agent data + real trade history */}
      <AnimatePresence>
        {inspectedAgentId && myAgents.find(a => a.id === inspectedAgentId) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
              onClick={() => setInspectedAgentId(null)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="arena-agent-detail-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl z-50 shadow-2xl flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              {(() => {
                const agent = myAgents.find(a => a.id === inspectedAgentId)!;
                const stats = realizedByAgent[agent.id] || { pnl: 0, trades: 0 };
                const agentTrades = trades.filter(t => t.agentId === agent.id).slice(0, 12);
                const paused = agent.status === 'paused';
                return (
                  <>
                    <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 id="arena-agent-detail-title" className="text-2xl font-bold text-white">{agent.name}</h3>
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs uppercase font-mono ${paused ? 'bg-slate-700/40 text-slate-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {!paused && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />} {paused ? 'Paused' : 'Active'}
                          </span>
                        </div>
                        <div className="text-slate-500 text-sm">{agent.strategyType.replace('_', ' ')} · {agent.assetSymbol} · {agent.tradeType === 'perp' ? `${agent.leverage}x perp` : 'spot'}</div>
                      </div>
                      <button aria-label="Close agent details" onClick={() => setInspectedAgentId(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Trades</div>
                          <div className="text-2xl font-bold text-white">{stats.trades}</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Realized P&L</div>
                          <div className={`text-2xl font-bold ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Recent Fills</h4>
                        {agentTrades.length === 0 ? (
                          <div className="bg-slate-950/50 border border-slate-800 border-dashed rounded-xl p-6 text-center text-sm text-slate-500">
                            <p>No fills yet. Open the Trading Desk with this agent already available.</p>
                            <button
                              type="button"
                              onClick={() => { setInspectedAgentId(null); window.dispatchEvent(new CustomEvent('navigate', { detail: 'trading' })); }}
                              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-500"
                            >
                              Open Trading Desk <ChevronRight className="ml-1 inline-block h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {agentTrades.map((t) => (
                              <div key={t.id} className="flex items-center justify-between gap-3 text-xs font-mono bg-slate-950/50 rounded-lg px-3 py-2 border border-slate-900/60">
                                <span className={t.side === 'buy' || t.side === 'long' ? 'text-emerald-400' : 'text-rose-400'}>
                                  {t.side.toUpperCase()} {t.size} {t.assetSymbol} @ ${t.price.toLocaleString()}
                                </span>
                                <span className="text-slate-500">
                                  {typeof t.pnl === 'number' && <span className={`mr-3 font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}</span>}
                                  {new Date(t.timestamp).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handlePauseResume(agent)}
                          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          {paused ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
                        </button>
                        <button
                          onClick={async () => { await onAgentStatusChanged(agent.id, 'revoked'); setInspectedAgentId(null); }}
                          className="flex-1 py-3 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 font-bold rounded-xl transition-colors border border-rose-900/50"
                        >
                          Retire Agent
                        </button>
                      </div>
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
              role="dialog"
              aria-modal="true"
              aria-labelledby="arena-player-profile-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl z-50 shadow-2xl flex flex-col"
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
                          <h3 id="arena-player-profile-title" className="text-2xl font-bold text-white flex items-center gap-2">
                            {player.rank === 1 ? <Crown className="w-6 h-6 text-yellow-500" /> : 
                             player.rank === 2 ? <Crown className="w-6 h-6 text-slate-300" /> :
                             player.rank === 3 ? <Crown className="w-6 h-6 text-amber-700" /> :
                             <span className="text-xl font-mono text-slate-400">#{player.rank}</span>}
                            {player.name}
                          </h3>
                        </div>
                        <div className="text-slate-500 text-sm font-mono">{player.address}</div>
                      </div>
                      <button aria-label="Close player profile" onClick={() => setInspectedPlayerRank(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors relative z-10">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Total P&amp;L</div>
                          <div className={`text-xl font-bold ${(player.pnlValue || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(player.pnlValue || 0) >= 0 ? '+' : ''}{fmtUsd(player.pnlValue || 0)}
                          </div>
                          <div className="text-[10px] text-slate-600 font-mono mt-1">{fmtUsd(player.realizedPnl || 0)} realized · {fmtUsd(player.unrealizedPnl || 0)} open</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Return</div>
                          <div className={`text-xl font-bold ${(player.roiValue || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{player.roi}</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Traded Volume</div>
                          <div className="text-xl font-bold text-white">{fmtUsd(player.volumeUsd || 0)}</div>
                          <div className="text-[10px] text-slate-600 font-mono mt-1">{player.activityCount || 0} scored events</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <div className="text-xs text-slate-500 font-mono uppercase mb-1">Realized Win Rate</div>
                          <div className="text-xl font-bold text-white">{player.winRatePct == null ? '—' : `${player.winRatePct}%`}</div>
                          <div className="text-[10px] text-slate-600 font-mono mt-1">{player.activeDays || 0} active days</div>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Money lanes</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                        {(player.lanes || []).map((lane: any) => {
                          const lanePnl = (lane.realizedPnl || 0) + (lane.unrealizedPnl || 0);
                          return (
                            <div key={lane.key} className={`rounded-xl border p-4 ${lane.events > 0 ? 'bg-slate-950 border-indigo-500/20' : 'bg-slate-950/40 border-slate-800 opacity-60'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-white">{lane.label}</span>
                                <span className="text-[9px] font-mono uppercase text-slate-500">{lane.events} events</span>
                              </div>
                              <div className={`font-mono font-bold ${lanePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{lanePnl >= 0 ? '+' : ''}{fmtUsd(lanePnl)}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-1">{fmtUsd(lane.volumeUsd || 0)} volume</div>
                            </div>
                          );
                        })}
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

                      <button
                        type="button"
                        onClick={() => { setInspectedPlayerRank(null); window.dispatchEvent(new CustomEvent('navigate', { detail: 'rooms' })); }}
                        className="mt-8 w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-4 text-left transition-colors"
                      >
                        <Activity className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h5 className="font-bold text-indigo-300 text-sm mb-1">Copy their edge</h5>
                          <p className="text-xs text-indigo-400/80 leading-relaxed">
                            Open Rooms to find shared strategies, copy one, tune it, and bring it back to the Arena.
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-indigo-400 mt-2" />
                      </button>
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
