import React, { useState } from 'react';
import { motion } from 'motion/react';
import { VaultClub, User } from '../types';
import { Landmark, Sparkles, Plus, Award, Coins, ShieldCheck, Info } from 'lucide-react';

interface VaultClubsProps {
  currentUser: User;
  vaults: VaultClub[];
  onVaultCreated: (name: string, description: string) => Promise<void>;
  onContributeToVault: (id: string, amount: number) => Promise<void>;
}

export default function VaultClubs({ currentUser, vaults, onVaultCreated, onContributeToVault }: VaultClubsProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [activeVaultId, setActiveVaultId] = useState<string | null>(vaults[0]?.id || null);
  const [contribAmount, setContribAmount] = useState('1000');

  const [createLoading, setCreateLoading] = useState(false);
  const [contribLoading, setContribLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const activeVault = vaults.find(v => v.id === activeVaultId);

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateLoading(true);
    setMsg({ text: '', type: '' });
    try {
      await onVaultCreated(name, description);
      setName('');
      setDescription('');
      setMsg({ text: 'Paper Vault Club initialized!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Error creating vault club', type: 'error' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVaultId || !contribAmount) return;
    setContribLoading(true);
    setMsg({ text: '', type: '' });
    try {
      await onContributeToVault(activeVaultIdOrFirst(), Number(contribAmount));
      setMsg({ text: 'Simulated contribution credited!', type: 'success' });
      setContribAmount('1000');
    } catch (err: any) {
      setMsg({ text: err.message || 'Error executing simulated contribution', type: 'error' });
    } finally {
      setContribLoading(false);
    }
  };

  // Safe fallback to resolve selected vault ID
  // Named `activeRoomId` by copy-paste from TradingRoom. It always returned the
  // VAULT id, so the behaviour was correct and the name lied. Renamed, not repaired.
  const activeVaultIdOrFirst = () => activeVaultId || (vaults[0]?.id || '');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in">
      {/* Sidebar - Create & Select list */}
      <div className="space-y-6">
        {/* Create Vault */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            Launch Paper Saving Club
          </h3>

          <form onSubmit={handleCreateVault} className="space-y-3 font-mono text-xs">
            <div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Club Name (e.g. SOL Whales)"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-white placeholder-slate-600 outline-none"
              />
            </div>
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Target goals/milestones"
                rows={2}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-white placeholder-slate-600 outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={createLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-xl shadow-lg shadow-indigo-500/10 transition-all cursor-pointer text-center"
            >
              {createLoading ? 'Launching...' : 'Initialize Vault'}
            </button>
          </form>
        </div>

        {/* List of Vaults */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-400" />
            Saving Vault Clubs
          </h3>

          <div className="space-y-2">
            {vaults.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-4 text-center">No active paper clubs launched.</p>
            ) : (
              vaults.map((v) => {
                const progress = Math.min((v.simulatedTotalContribution / 100000) * 100, 100); // Mock target 100k
                return (
                <button
                  key={v.id}
                  onClick={() => setActiveVaultId(v.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 shadow-inner ${
                    activeVaultId === v.id
                      ? 'bg-indigo-600/10 border-indigo-500 shadow-indigo-500/10'
                      : 'bg-slate-950/40 border-slate-900 hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="space-y-1 font-mono">
                      <p className={`text-sm font-bold ${activeVaultId === v.id ? 'text-indigo-300' : 'text-slate-300'}`}>{v.name}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{v.description || 'No target description'}</p>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border ${
                      activeVaultId === v.id ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      ${v.simulatedTotalContribution.toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
                    <div className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full" style={{ width: `${progress}%` }} />
                  </div>
                </button>
              )})
            )}
          </div>
        </div>
      </div>

      {/* Main Details and Contribution Sim Panel */}
      <div className="lg:col-span-2 space-y-6">
        {msg.text && (
          <div className={`p-4 rounded-xl border text-xs font-mono ${
            msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            {msg.text}
          </div>
        )}

        {activeVault ? (
          <div className="space-y-6">
            {/* Target Vault Summary */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{activeVault.name}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-1">{activeVault.description || 'No target thesis.'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-500 block">Simulated Total Pool</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    ${activeVault.simulatedTotalContribution.toLocaleString()} USD
                  </span>
                </div>
              </div>

              {/* Warnings and Disclosure */}
              <div className="bg-slate-950/50 rounded-xl border border-slate-900 p-4 space-y-2 font-mono text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  READ-ONLY COORDINATION DISCLOSURE
                </div>
                <p className="leading-relaxed text-[11px]">
                  This Vault Club is entirely simulated. Contributions use mock Paper Balance credits. No custodial ownership, investment yields, or pooled funds claims exist. Live smart contracts remain locked.
                </p>
              </div>
            </div>

            {/* Sim Contribute and Milestones columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Simulate Contribution Form */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  Simulate Contribution
                </h3>

                <form onSubmit={handleContribute} className="space-y-3 font-mono text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">Select Amount</label>
                    <div className="flex gap-2">
                      {['1000', '5000', '10000', '25000'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setContribAmount(val)}
                          className={`flex-1 py-1 rounded-lg border text-center transition-all cursor-pointer ${
                            contribAmount === val
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                              : 'bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          ${Number(val).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={contribLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl shadow-lg transition-all cursor-pointer text-center"
                  >
                    {contribLoading ? 'Crediting...' : `Contribute $${Number(contribAmount).toLocaleString()} Mock USD`}
                  </button>
                </form>
              </div>

              {/* Milestones achieved */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-400" />
                  Club Target Milestones
                </h3>

                <div className="space-y-3 font-mono text-xs">
                  {activeVault.milestones.map((milestone, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl shadow-inner group transition-all hover:border-indigo-500/30"
                    >
                      <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-slate-200 font-medium leading-relaxed block mb-1">{milestone}</span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Milestone 0{idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-900/20 border border-slate-900 border-dashed rounded-2xl h-80 space-y-4">
            <Landmark className="w-12 h-12 text-slate-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-400">No active paper saving club selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                Select a savings club from the sidebar list or launch a new coordination group to start competing with paper contributions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
