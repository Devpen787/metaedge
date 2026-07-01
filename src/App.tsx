import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, FriendRoom, TradingAgent, PaperStrategy, AuditEvent, PaperTrade, PredictionMarket } from './types';
import WelcomeScreen from './components/WelcomeScreen';
import Dashboard from './components/Dashboard';
import TradingRoom from './components/TradingRoom';
import AgentWorkshop from './components/AgentWorkshop';
import VaultClubs from './components/VaultClubs';
import GraphEvidence from './components/GraphEvidence';
import ReadinessSheet from './components/ReadinessSheet';
import TradingHub from './components/TradingHub';
import PredictionMarkets from './components/PredictionMarkets';
import SpecsCatalog from './components/SpecsCatalog';
import TokenMarketChart from './components/TokenMarketChart';
import AgentWalletModal from './components/AgentWalletModal';
import CommandPalette from './components/CommandPalette';
import QuantEngine from './components/QuantEngine';
import AgenticAutopilot from './components/AgenticAutopilot';
import IntentSolver from './components/IntentSolver';
import SwarmCopilot from './components/SwarmCopilot';
import { AgentArena } from './components/AgentArena';
import MetaedgeAnalytics from './components/MetaedgeAnalytics';
import { Shield, Sparkles, AlertTriangle, Users, Bot, Landmark, Network, Info, CheckCircle, ArrowRightLeft, Coins, Award, TrendingUp, Wallet, Command, Database, Cpu, Search, Terminal, Swords, Loader2, BarChart2 } from 'lucide-react';
import { apiFetch } from './lib/api';

import GuidedTour from './components/GuidedTour';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rooms' | 'agents' | 'vaults' | 'graph' | 'trading' | 'predictions' | 'specs' | 'charts' | 'quant' | 'autopilot' | 'intent' | 'copilot' | 'arena' | 'analytics'>('dashboard');
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [proModeEnabled, setProModeEnabled] = useState(false);
  const [showTour, setShowTour] = useState(() => {
    const hasSeenTour = localStorage.getItem('metaedge_tour_completed');
    return !hasSeenTour;
  });

  const completeTour = () => {
    localStorage.setItem('metaedge_tour_completed', 'true');
    setShowTour(false);
  };

  
  // Mode Selection
  const [paperLiveMode, setPaperLiveMode] = useState<'paper' | 'live'>('paper');
  const [showReadiness, setShowReadiness] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isGlobalAutopilotEnabled, setIsGlobalAutopilotEnabled] = useState(false);
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [agentProcessingAction, setAgentProcessingAction] = useState<string | null>(null);

  // Entities state
  const [rooms, setRooms] = useState<FriendRoom[]>([]);
  const [agents, setAgents] = useState<TradingAgent[]>([]);
  const [strategies, setStrategies] = useState<PaperStrategy[]>([]);
  const [vaults, setVaults] = useState<any[]>([]);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [predictionMarkets, setPredictionMarkets] = useState<PredictionMarket[]>([]);

  // Fetch initial session & load database entities
  const loadSession = async () => {
    try {
      const res = await apiFetch('/api/session');
      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
        localStorage.setItem('metaedge_session_id', data.user.id);
      }
    } catch (e) {
      console.error('Error fetching session', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntities = async () => {
    if (!currentUser) return;
    try {
      // Use batched endpoint to avoid hitting rate limits
      const res = await apiFetch('/api/dashboard-data');
      const data = await res.json();

      setRooms(data.rooms || []);
      setAgents(data.agents || []);
      setStrategies(data.strategies || []);
      setVaults(data.vaults || []);
      setAudits(data.audits || []);
      setTrades(data.trades || []);
      setPredictionMarkets(data.predictionMarkets || []);
    } catch (e) {
      console.error('Error fetching entities', e);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchEntities();
      
      // Auto join if invite token exists in URL search parameters
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        handleAutoJoinInvite(token);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as any);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    
    const handleAgentProcessing = (e: any) => {
      setIsAgentProcessing(e.detail.isProcessing);
      setAgentProcessingAction(e.detail.actionName || null);
    };
    window.addEventListener('agent-processing', handleAgentProcessing);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('agent-processing', handleAgentProcessing);
    };
  }, []);

  // Handle auto invite acceptance
  const handleAutoJoinInvite = async (token: string) => {
    try {
      const res = await apiFetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken: token })
      });
      if (res.ok) {
        // Strip parameters from URL for a clean state
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchEntities();
        setActiveTab('rooms');
      }
    } catch (e) {
      console.error('Error auto-joining room', e);
    }
  };

  // Profile Update handler
  const handleProfileClaimed = async (displayName: string, bio: string, avatarUrl: string, preferredCurrency: string) => {
    try {
      const res = await apiFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio, avatarUrl, preferredCurrency })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem('metaedge_session_id', data.user.id);
      }
    } catch (err) {
      console.error('Error updating profile', err);
    }
  };

  const handleProfileReset = async () => {
    try {
      const res = await apiFetch('/api/profile/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        fetchEntities();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Faucet claim handler
  const handleClaimFaucet = async () => {
    const res = await apiFetch('/api/faucet', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          paperBalance: data.balance,
          faucetClaimedCount: data.faucetClaimedCount
        });
      }
      fetchEntities();
    } else {
      throw new Error(data.error || 'Failed to claim faucet.');
    }
  };

  // Create Room handler
  const handleRoomCreated = async (name: string, description: string) => {
    const res = await apiFetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    const data = await res.json();
    if (res.ok) {
      fetchEntities();
    } else {
      throw new Error(data.error || 'Failed to create room.');
    }
  };

  // Join Room by invite input handler
  const handleJoinRoomByInvite = async (token: string) => {
    const res = await apiFetch('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken: token })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      fetchEntities();
      return data.roomId;
    } else {
      throw new Error(data.error || 'Invalid invite token or link.');
    }
  };

  // Create Agent Bot handler
  const handleAgentCreated = async (payload: any) => {
    const res = await apiFetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      fetchEntities();
    } else {
      throw new Error(data.error || 'Failed to initialize agent.');
    }
  };

  // Update Agent Status handler
  const handleAgentStatusChanged = async (id: string, status: 'active' | 'paused' | 'revoked') => {
    const res = await apiFetch(`/api/agents/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      fetchEntities();
    } else {
      const data = await res.json();
      throw new Error(data.error || 'Failed to change agent status.');
    }
  };

  // Copy strategy handler
  const handleCopyStrategy = async (strategyId: string) => {
    const res = await apiFetch('/api/strategies/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategyId })
    });
    const data = await res.json();
    if (res.ok) {
      fetchEntities();
    } else {
      throw new Error(data.error || 'Failed to copy strategy.');
    }
  };

  // Simulate execution fills trade
  const handlePlaceSimulatedTrade = async (payload: any) => {
    const res = await apiFetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (currentUser) {
        setCurrentUser({ ...currentUser, paperBalance: data.balance });
      }
      fetchEntities();
    } else {
      throw new Error(data.error || 'Execution fill failed.');
    }
  };

  const handleAgentDeleted = async (id: string) => {
    const res = await apiFetch(`/api/agents/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      fetchEntities();
    } else {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete agent.');
    }
  };

  const handleCloseTrade = async (id: string, currentPrice: number) => {
    try {
      const res = await apiFetch(`/api/trades/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPrice })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (currentUser) {
          setCurrentUser({ ...currentUser, paperBalance: data.balance });
        }
        fetchEntities();
      } else {
        alert(data.error || 'Failed to close trade');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTradeDeleted = async (id: string) => {
    const res = await apiFetch(`/api/trades/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      fetchEntities();
    } else {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete trade.');
    }
  };

  const handleClearAllTrades = async () => {
    const res = await apiFetch(`/api/trades`, {
      method: 'DELETE'
    });
    if (res.ok) {
      fetchEntities();
    } else {
      const data = await res.json();
      throw new Error(data.error || 'Failed to clear trades.');
    }
  };

  // Contribute to vault handler
  const handleContributeToVault = async (id: string, amount: number) => {
    const res = await apiFetch(`/api/vaults/${id}/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (currentUser) {
        setCurrentUser({ ...currentUser, paperBalance: data.balance });
      }
      fetchEntities();
    } else {
      throw new Error(data.error || 'Failed to contribute simulated funds.');
    }
  };

  // Create vault handler
  const handleVaultCreated = async (name: string, description: string) => {
    const res = await apiFetch('/api/vaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    const data = await res.json();
    if (res.ok) {
      fetchEntities();
    } else {
      throw new Error(data.error || 'Failed to create vault.');
    }
  };

  // Place prediction market bet handler
  const handlePlacePredictionBet = async (marketId: string, side: 'yes' | 'no', amount: number) => {
    const res = await apiFetch(`/api/predictions/${marketId}/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side, amount })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (currentUser) {
        setCurrentUser({ ...currentUser, paperBalance: data.balance });
      }
      fetchEntities();
    } else {
      throw new Error(data.error || 'Failed to place prediction bet.');
    }
  };

  // Resolve prediction market handler
  const handleResolveMarket = async (marketId: string, outcome: 'yes' | 'no') => {
    const res = await apiFetch(`/api/predictions/${marketId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loadSession();
      fetchEntities();
    } else {
      throw new Error(data.error || 'Failed to resolve prediction market.');
    }
  };

  // Handle toggling of Paper/Live switch
  const handleModeToggle = () => {
    if (paperLiveMode === 'paper') {
      // Trigger security readiness sheet
      setShowReadiness(true);
    } else {
      setPaperLiveMode('paper');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060813] flex flex-col items-center justify-center gap-4 text-slate-400 font-mono text-sm">
        <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
        Resolving Sovereign Room Session...
      </div>
    );
  }

  // Ensure user has updated their profile details at least once before entering the primary dashboard
  const needsProfileSetup = currentUser && currentUser.profile.displayName === 'MetaEdge Agent' && currentUser.faucetClaimedCount === 0;

  if (currentUser && needsProfileSetup) {
    return (
      <WelcomeScreen
        user={currentUser}
        onProfileClaimed={handleProfileClaimed}
      />
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#060813] flex flex-col items-center justify-center gap-6 text-center px-4 font-mono">
        <AlertTriangle className="w-12 h-12 text-rose-500" />
        <div>
          <h2 className="text-xl font-bold text-slate-200 mb-2">Connection Error</h2>
          <p className="text-slate-400 text-sm max-w-sm">
            Failed to connect to the sovereign room. This is usually due to network rate limits. Please try again.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); loadSession(); }}
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl border border-slate-700 shadow-sm transition-all cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#060813] text-slate-100 flex flex-col lg:flex-row relative overflow-hidden">
      {/* Ambient glowing background meshes */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-orange-600/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Sidebar (Desktop) */}
      <aside className="w-64 border-r border-slate-900/80 bg-[#060813]/90 backdrop-blur-xl hidden lg:flex flex-col relative z-40">
        <div className="p-4 border-b border-slate-900/80 flex items-center gap-2.5">
          <div className="bg-indigo-600/10 border border-indigo-500/20 p-2 rounded-xl text-indigo-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              MetaEdge <span className="text-xs bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold uppercase">V1</span>
            </h1>
            <span className="text-xs text-slate-500 font-mono block">Autonomous Social Trade</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {[
            {
              title: 'Overview',
              items: [
                { id: 'dashboard', label: 'Dashboard', icon: Info }
              ]
            },
            {
              title: 'Swarm Intelligence',
              items: [
                { id: 'copilot', label: 'Swarm Copilot', icon: Terminal },
                { id: 'intent', label: 'Intent Solver', icon: Search },
                { id: 'autopilot', label: 'Autopilot', icon: Cpu },
                { id: 'agents', label: 'Trading Agents', icon: Bot },
              ]
            },
            {
              title: 'Markets & Trading',
              items: [
                { id: 'trading', label: 'Trading Desk', icon: ArrowRightLeft },
                { id: 'charts', label: 'Market Charts', icon: TrendingUp },
                { id: 'predictions', label: 'Predictions', icon: Coins },
              ]
            },
            {
              title: 'Community & Vaults',
              items: [
                { id: 'rooms', label: 'Rooms', icon: Users },
                { id: 'vaults', label: 'Vaults', icon: Landmark },
                { id: 'arena', label: 'Agent Arena', icon: Swords },
              ]
            },
            {
              title: 'Analytics & Evidence',
              items: [
                { id: 'analytics', label: 'Platform Data', icon: BarChart2 },
                { id: 'graph', label: 'Evidence Map', icon: Network },
                { id: 'specs', label: 'Specs Hub', icon: Award },
                ...(proModeEnabled ? [{ id: 'quant', label: 'Quant Engine', icon: Database }] : [])
              ]
            }
          ].map((group, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-mono text-slate-500 font-bold uppercase tracking-wider mb-2 px-2">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-800/80 text-white shadow-sm shadow-black/50 border border-slate-700/50'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-900/80 space-y-2">
          <button
            onClick={() => setCmdPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-950/80 border border-slate-800/80 rounded-xl text-slate-400 hover:text-slate-200 transition-colors shadow-inner"
            title="Command Palette"
          >
            <div className="flex items-center gap-2 text-xs font-mono">
              <Command className="w-3.5 h-3.5" /> Search
            </div>
            <span className="text-xs font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">⌘K</span>
          </button>
          
          <button
            onClick={() => setShowTour(true)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-950/80 border border-slate-800/80 rounded-xl text-slate-400 hover:text-indigo-300 hover:border-indigo-500/30 transition-all shadow-inner group"
          >
            <div className="flex items-center gap-2 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5 group-hover:text-indigo-400 transition-colors" /> Platform Tour
            </div>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative z-10 w-full lg:w-[calc(100%-16rem)]">
        {/* Dynamic Header */}
        <header className="sticky top-0 z-40 bg-[#060813]/85 backdrop-blur-xl border-b border-slate-900/80 px-4 py-3 md:px-8 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            
            {/* Mobile Nav Top */}
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="bg-indigo-600/10 border border-indigo-500/20 p-2 rounded-xl text-indigo-400">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                MetaEdge
              </span>
            </div>
            
            {/* Nav select for mobile */}
            <div className="lg:hidden w-full order-last mt-2">
               <select
                 value={activeTab}
                 onChange={(e) => setActiveTab(e.target.value as any)}
                 className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50"
               >
                 <optgroup label="Overview">
                   <option value="dashboard">Dashboard</option>
                 </optgroup>
                 <optgroup label="Swarm Intelligence">
                   <option value="copilot">Swarm Copilot</option>
                   <option value="intent">Intent Solver</option>
                   <option value="autopilot">Autopilot</option>
                   <option value="agents">Trading Agents</option>
                 </optgroup>
                 <optgroup label="Markets & Trading">
                   <option value="trading">Trading Desk</option>
                   <option value="charts">Market Charts</option>
                   <option value="predictions">Predictions</option>
                 </optgroup>
                 <optgroup label="Community & Vaults">
                   <option value="rooms">Rooms</option>
                   <option value="vaults">Vaults</option>
                   <option value="arena">Agent Arena</option>
                 </optgroup>
                 <optgroup label="Analytics & Evidence">
                   <option value="analytics">Platform Data</option>
                   <option value="graph">Evidence Map</option>
                   <option value="specs">Specs Hub</option>
                   {proModeEnabled && <option value="quant">Quant Engine</option>}
                 </optgroup>
               </select>
            </div>

            {/* Empty div or loading state to push items to right on desktop */}
            <div className="hidden lg:flex flex-1 items-center px-4">
              <AnimatePresence>
                {isAgentProcessing && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full"
                  >
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    <span className="text-xs font-mono text-indigo-300 font-bold uppercase tracking-wider">
                      {agentProcessingAction || 'AI Processing...'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mode switch & Wallet */}
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={() => setIsGlobalAutopilotEnabled(!isGlobalAutopilotEnabled)}
                className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-inner ${
                  isGlobalAutopilotEnabled 
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                    : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-400'
                }`}
                title="Toggle Global Autopilot"
              >
                <Cpu className={`w-3.5 h-3.5 ${isGlobalAutopilotEnabled ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-mono hidden md:inline">
                  Autopilot {isGlobalAutopilotEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                onClick={() => {
                  setProModeEnabled(!proModeEnabled);
                  if (proModeEnabled && activeTab === 'quant') {
                    setActiveTab('dashboard');
                  }
                }}
                className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 transition-colors cursor-pointer ${
                  proModeEnabled 
                    ? 'bg-fuchsia-500/10 border-fuchsia-500/30 hover:bg-fuchsia-500/20 text-fuchsia-400 shadow-sm shadow-fuchsia-900/20' 
                    : 'bg-slate-950 border-slate-900 hover:bg-slate-900 text-slate-500'
                }`}
                title="Toggle Advanced Quant Mode"
              >
                <Database className="w-3.5 h-3.5" />
                <span className="text-xs font-mono hidden md:inline">Pro Mode</span>
              </button>
              <button
                onClick={() => setShowWalletModal(true)}
                className="flex items-center gap-1.5 bg-slate-950 border border-slate-900 rounded-xl px-3 py-1.5 hover:bg-slate-900 transition-colors cursor-pointer"
                title="MetaMask Agent Wallet"
              >
                <Wallet className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-mono text-slate-300 hidden md:inline">Wallet</span>
              </button>
              <span className="text-sm font-mono text-slate-400 hidden lg:inline">Current Authority:</span>
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-1 flex items-center gap-1.5 shadow-inner">
                <button
                  onClick={() => setPaperLiveMode('paper')}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                    paperLiveMode === 'paper'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-900/20'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Paper
                </button>
                <button
                  onClick={handleModeToggle}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                    paperLiveMode === 'live'
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-sm shadow-rose-900/20'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Live
                </button>
              </div>
            </div>

          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 relative z-10">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Verification Alert when switching modes */}
            {paperLiveMode === 'live' && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider">Live Trading Disabled</h4>
                  <p className="text-xs text-slate-300 mt-1 font-mono leading-relaxed">
                    Live execution is currently locked. The workspace is active in read-only mode. Return to Paper Mode to place simulated trades.
                  </p>
                </div>
              </div>
            )}

            {/* Tab Router Panels */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {currentUser && activeTab === 'dashboard' && (
                  <Dashboard
                    user={currentUser}
                    onClaimFaucet={handleClaimFaucet}
                    audits={audits}
                    onRefreshAudits={fetchEntities}
                    trades={trades}
                    onEditProfile={handleProfileClaimed}
                    onResetProfile={handleProfileReset}
                  />
                )}

                {currentUser && activeTab === 'rooms' && (
                  <TradingRoom
                    currentUser={currentUser}
                    rooms={rooms}
                    onRoomCreated={handleRoomCreated}
                    onJoinRoomByInvite={handleJoinRoomByInvite}
                  />
                )}

                {currentUser && activeTab === 'agents' && (
                  <AgentWorkshop
                    currentUser={currentUser}
                    agents={agents}
                    strategies={strategies}
                    rooms={rooms}
                    trades={trades}
                    onAgentCreated={handleAgentCreated}
                    onAgentStatusChanged={handleAgentStatusChanged}
                    onAgentDeleted={handleAgentDeleted}
                    onCopyStrategy={handleCopyStrategy}
                    onPlaceSimulatedTrade={handlePlaceSimulatedTrade}
                  />
                )}

                 {currentUser && activeTab === 'trading' && (
                  <TradingHub
                    currentUser={currentUser}
                    agents={agents}
                    trades={trades}
                    onPlaceSimulatedTrade={handlePlaceSimulatedTrade}
                    onCloseTrade={handleCloseTrade}
                    onDeleteTrade={handleTradeDeleted}
                    onClearAllTrades={handleClearAllTrades}
                  />
                )}

                {currentUser && activeTab === 'charts' && (
                  <TokenMarketChart />
                )}

                {currentUser && activeTab === 'predictions' && (
                  <PredictionMarkets
                    currentUser={currentUser}
                    markets={predictionMarkets}
                    onPlacePredictionBet={handlePlacePredictionBet}
                    onResolveMarket={handleResolveMarket}
                  />
                )}

                {currentUser && activeTab === 'vaults' && (
                  <VaultClubs
                    currentUser={currentUser}
                    vaults={vaults}
                    onVaultCreated={handleVaultCreated}
                    onContributeToVault={handleContributeToVault}
                  />
                )}

                {currentUser && activeTab === 'graph' && (
                  <GraphEvidence
                    currentUser={currentUser}
                    paperLiveMode={paperLiveMode}
                  />
                )}

                {currentUser && activeTab === 'specs' && (
                  <SpecsCatalog />
                )}

                {currentUser && activeTab === 'quant' && proModeEnabled && (
                  <QuantEngine agents={agents} />
                )}
                
                {currentUser && activeTab === 'autopilot' && (
                  <AgenticAutopilot user={currentUser} />
                )}
                
                {currentUser && activeTab === 'intent' && (
                  <IntentSolver user={currentUser} />
                )}
                
                {currentUser && activeTab === 'copilot' && (
                  <SwarmCopilot user={currentUser} />
                )}

                {currentUser && activeTab === 'arena' && (
                  <AgentArena user={currentUser} />
                )}

                {currentUser && activeTab === 'analytics' && (
                  <MetaedgeAnalytics />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900/60 py-6 px-4 md:px-8 bg-slate-950/20 text-center text-xs text-slate-500 font-mono relative z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
              MetaEdge V1 Active
            </span>
            <span className="text-xs">
              Platform operates in paper trading mode. No real assets are custodied.
            </span>
          </div>
        </footer>
      </div>

      {/* Global Autopilot Active Indicator (Removed for cleanliness) */}
      <AnimatePresence>
      </AnimatePresence>

      {/* Safety Compliance Readiness Sheet */}
      {showReadiness && (
        <ReadinessSheet
          onClose={() => setShowReadiness(false)}
          onStayPaper={() => {
            setPaperLiveMode('paper');
            setShowReadiness(false);
          }}
        />
      )}

      {/* Guided Tour for new users */}
      {showTour && <GuidedTour onComplete={completeTour} />}

      {/* MetaMask Agent Wallet Modal */}
      <AgentWalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={(tab) => setActiveTab(tab as any)}
        proModeEnabled={proModeEnabled}
      />
    </div>
  );
}
