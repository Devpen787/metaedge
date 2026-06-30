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
import { Shield, Sparkles, AlertTriangle, Users, Bot, Landmark, Network, Info, CheckCircle, ArrowRightLeft, Coins, Award, TrendingUp, Wallet, Command, Database } from 'lucide-react';
import { apiFetch } from './lib/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rooms' | 'agents' | 'vaults' | 'graph' | 'trading' | 'predictions' | 'specs' | 'charts' | 'quant'>('dashboard');
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [proModeEnabled, setProModeEnabled] = useState(false);
  
  // Mode Selection
  const [paperLiveMode, setPaperLiveMode] = useState<'paper' | 'live'>('paper');
  const [showReadiness, setShowReadiness] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

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
    return () => window.removeEventListener('keydown', handleKeyDown);
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
  const handleProfileClaimed = async (displayName: string, bio: string, avatarUrl: string) => {
    try {
      const res = await apiFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio, avatarUrl })
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
    <div className="min-h-screen bg-[#060813] text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Ambient glowing background meshes */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-orange-600/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-[#060813]/85 backdrop-blur-xl border-b border-slate-900/80 px-4 py-3 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 relative z-10">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600/10 border border-indigo-500/20 p-2 rounded-xl text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                MetaEdge <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold uppercase">V1</span>
              </h1>
              <span className="text-[9px] text-slate-500 font-mono block">Autonomous Social Trade Space</span>
            </div>
          </div>

          {/* Navigation Tab Group */}
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 overflow-x-auto max-w-full shadow-inner">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Info },
                { id: 'rooms', label: 'Rooms', icon: Users },
                { id: 'agents', label: 'Agents', icon: Bot },
                { id: 'trading', label: 'Trading Desk', icon: ArrowRightLeft },
                { id: 'charts', label: 'Market Charts', icon: TrendingUp },
                { id: 'predictions', label: 'Predictions', icon: Coins },
                { id: 'vaults', label: 'Vaults', icon: Landmark },
                { id: 'graph', label: 'Evidence Map', icon: Network },
                { id: 'specs', label: 'Specs Hub', icon: Award },
                ...(proModeEnabled ? [{ id: 'quant', label: 'Quant Engine', icon: Database }] : [])
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-800/80 text-white shadow-sm shadow-black/50 border border-slate-700/50'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-slate-400 hover:text-slate-200 transition-colors shadow-inner"
              title="Command Palette"
            >
              <Command className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">⌘K</span>
            </button>
          </div>

          {/* Mode switch & Wallet */}
          <div className="flex items-center gap-3">
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
            <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">Current Authority:</span>
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
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8 relative z-10">
        {/* Verification Alert when switching modes */}
        {paperLiveMode === 'live' && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider">LIVE AUTHORITY BLOCKED</h4>
              <p className="text-xs text-slate-300 mt-1 font-mono leading-relaxed">
                Smart contract safety guards remain globally locked pending formal multi-signature validation. The workspace is active as read-only. Return to Paper Mode to simulated full bot interactions.
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
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Safety Compliance Footer */}
      <footer className="border-t border-slate-900/60 py-6 px-4 md:px-8 bg-slate-950/20 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
            MetaEdge V1 Sovereign Room Ledger Active
          </span>
          <span className="text-[10px]">
            No custody or guaranteed returns. Handled entirely via simulated paper accounts and local MetaMask readiness scopes.
          </span>
        </div>
      </footer>

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
