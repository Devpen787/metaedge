import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FriendRoom, User, PaperStrategy } from '../types';
import { Users, UserPlus, ShieldAlert, Plus, DoorOpen, Link2, Copy, ToggleLeft, ToggleRight, Settings, Info } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface TradingRoomProps {
  currentUser: User;
  rooms: FriendRoom[];
  onRoomCreated: (name: string, description: string) => Promise<void>;
  onJoinRoomByInvite: (inviteToken: string) => Promise<string>;
}

export default function TradingRoom({ currentUser, rooms, onRoomCreated, onJoinRoomByInvite }: TradingRoomProps) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(rooms[0]?.id || null);
  const [activeRoomDetails, setActiveRoomDetails] = useState<any | null>(null);
  
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [joinInviteToken, setJoinInviteToken] = useState('');

  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  const fetchActiveRoomDetails = async (roomId: string) => {
    try {
      const res = await apiFetch(`/api/rooms/${roomId}`);
      const data = await res.json();
      if (res.ok) {
        setActiveRoomDetails(data);
      } else {
        setActiveRoomDetails(null);
      }
    } catch (e) {
      console.error('Error loading room details', e);
    }
  };

  useEffect(() => {
    if (activeRoomId) {
      fetchActiveRoomDetails(activeRoomId);
    } else {
      setActiveRoomDetails(null);
    }
  }, [activeRoomId, rooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreateLoading(true);
    setMsg({ text: '', type: '' });
    try {
      await onRoomCreated(newRoomName, newRoomDesc);
      setNewRoomName('');
      setNewRoomDesc('');
      setMsg({ text: 'Room created successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Error creating room', type: 'error' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinByInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteToken.trim()) return;
    setJoinLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const actualToken = joinInviteToken.includes('/rooms/join?token=')
        ? joinInviteToken.split('token=')[1]
        : joinInviteToken;

      const newId = await onJoinRoomByInvite(actualToken);
      setActiveRoomId(newId);
      setJoinInviteToken('');
      setMsg({ text: 'Successfully joined the trading room!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Error joining room', type: 'error' });
    } finally {
      setJoinLoading(false);
    }
  };

  const toggleInviteState = async () => {
    if (!activeRoomId) return;
    try {
      const res = await apiFetch(`/api/rooms/${activeRoomId}/invite/toggle`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        fetchActiveRoomDetails(activeRoomId);
      }
    } catch (e) {
      console.error('Error toggling invite state', e);
    }
  };

  // Construct sharing link
  const inviteUrl = activeRoomDetails?.room
    ? `${window.location.origin}/rooms/join?token=${activeRoomDetails.room.inviteToken}`
    : '';

  const copyToClipboard = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setMsg({ text: 'Invite URL copied to clipboard!', type: 'success' });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleCopyStrategy = async (strategyId: string) => {
    try {
      const res = await apiFetch(`/api/strategies/copy`, {
        method: 'POST',
        body: JSON.stringify({ strategyId })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: `Strategy copied! Agent "${data.agent.name}" created in your Agents tab.`, type: 'success' });
        fetchActiveRoomDetails(activeRoomId!);
      } else {
        setMsg({ text: data.error || 'Failed to copy strategy', type: 'error' });
      }
    } catch (e: any) {
      setMsg({ text: e.message || 'Error copying strategy', type: 'error' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in">
      {/* Rooms Sidebar */}
      <div className="space-y-6">
        {/* Joined Rooms List */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Your Co-Trading Rooms
          </h3>

          <div className="space-y-2">
            {rooms.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-4 text-center">No active trading rooms joined.</p>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    activeRoomId === room.id
                      ? 'bg-indigo-600/10 border-indigo-500 text-white'
                      : 'bg-slate-950/40 border-slate-900 text-slate-300 hover:border-slate-850'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">{room.name}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[160px]">{room.description || 'No description'}</p>
                  </div>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                    {room.memberIds.length} users
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Join room box */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-emerald-400" />
            Join via Invite Token
          </h3>

          <form onSubmit={handleJoinByInvite} className="space-y-3">
            <input
              type="text"
              required
              value={joinInviteToken}
              onChange={(e) => setJoinInviteToken(e.target.value)}
              placeholder="Paste invite URL or Token"
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={joinLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm py-2 px-4 rounded-xl shadow-lg transition-all cursor-pointer"
            >
              {joinLoading ? 'Joining...' : 'Claim Invitation'}
            </button>
          </form>
        </div>

        {/* Create room box */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            Create Trading Room
          </h3>

          <form onSubmit={handleCreateRoom} className="space-y-3">
            <div>
              <input
                type="text"
                required
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room Name"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>
            <div>
              <textarea
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder="Brief purpose/thesis of room"
                rows={2}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-all resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={createLoading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm py-2 px-4 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              {createLoading ? 'Creating...' : 'Initialize Room'}
            </button>
          </form>
        </div>
      </div>

      {/* Selected Room View */}
      <div className="lg:col-span-2 space-y-6">
        {msg.text && (
          <div className={`p-4 rounded-xl border text-xs font-mono ${
            msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            {msg.text}
          </div>
        )}

        {activeRoomDetails ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{activeRoomDetails.room.name}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-1">{activeRoomDetails.room.description || 'No description provided.'}</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <span>Owner ID:</span>
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-900 font-mono">{activeRoomDetails.room.ownerId.slice(0, 10)}...</span>
                </div>
              </div>

              {/* Invitation Token Generator */}
              <div className="bg-slate-950/55 rounded-xl border border-slate-900 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                    <Link2 className="w-4 h-4 text-indigo-400" />
                    Verifiable Invitation Link
                  </div>
                  {activeRoomDetails.room.ownerId === currentUser.id && (
                    <button
                      onClick={toggleInviteState}
                      className="text-xs font-mono flex items-center gap-1.5 hover:text-indigo-400 text-slate-400 cursor-pointer"
                    >
                      {activeRoomDetails.room.isInviteDisabled ? (
                        <>
                          <ToggleLeft className="w-5 h-5 text-rose-500" /> Invite Disabled
                        </>
                      ) : (
                        <>
                          <ToggleRight className="w-5 h-5 text-emerald-500" /> Invite Enabled
                        </>
                      )}
                    </button>
                  )}
                </div>

                {!activeRoomDetails.room.isInviteDisabled ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      className="flex-1 bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400 px-3 py-2 rounded-lg select-all"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-rose-400 flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4" /> Room owner has paused new membership entries for this vault space.
                  </p>
                )}
              </div>
            </div>

            {/* Room Members */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-4">
                Room Membership Ledger
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeRoomDetails.members.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-900 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={m.avatarUrl}
                        alt="Avatar"
                        className="w-9 h-9 bg-slate-900 rounded-lg border border-slate-800 p-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{m.displayName}</p>
                        <p className="text-xs text-indigo-400 font-mono">@{m.username}</p>
                      </div>
                    </div>
                    {m.id === activeRoomDetails.room.ownerId && (
                      <span className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase font-bold">
                        Room Creator
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Shared Strategies */}
            {activeRoomDetails.sharedStrategies && activeRoomDetails.sharedStrategies.length > 0 && (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Copy className="w-5 h-5 text-emerald-400" />
                  Shared Agent Strategies
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeRoomDetails.sharedStrategies.map((strat: any) => (
                    <div
                      key={strat.id}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/30 transition-all group shadow-inner"
                    >
                      <div className="mb-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-base font-bold text-slate-200 truncate">{strat.name}</h4>
                          <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 shrink-0">
                            {strat.assetSymbol} • {strat.tradeType.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                          {strat.description || 'No description provided.'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <div className="text-xs text-slate-500">
                          Copied <span className="text-emerald-400 font-bold">{strat.copiedCount}</span> times
                        </div>
                        <button
                          onClick={() => handleCopyStrategy(strat.id)}
                          className="bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-slate-700 hover:border-emerald-500 shadow-md flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-900/20 border border-slate-900 border-dashed rounded-2xl h-80 space-y-4">
            <Users className="w-12 h-12 text-slate-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-400">No active co-trading room selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                Select a room from the sidebar or enter an invite token to join your colleagues and compare trading strategies.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
