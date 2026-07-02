import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User } from '../types';
import { Sparkles, ArrowRight, ShieldCheck, Wallet } from 'lucide-react';
import ParticleField from './ParticleField';

interface WelcomeScreenProps {
  user: User;
  onProfileClaimed: (displayName: string, bio: string, avatarUrl: string) => Promise<void>;
}

export default function WelcomeScreen({ user, onProfileClaimed }: WelcomeScreenProps) {
  const [displayName, setDisplayName] = useState(user.profile.displayName || '');
  const [bio, setBio] = useState(user.profile.bio || '');
  const [avatarSeed, setAvatarSeed] = useState(user.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      await onProfileClaimed(displayName, bio, avatarUrl);
    } catch (err: any) {
      setError(err?.message || 'Could not save this profile. Try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060813] bg-radial-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial effects */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl" />
      <ParticleField className="absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-400 text-xs font-mono mb-4">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            MetaEdge V1 Paper Room
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            MetaEdge
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Social agent-wallet trading room. Play with paper strategies, coordinate in vault clubs, and audit evidence securely.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Selector */}
          <div className="flex flex-col items-center gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
            <div className="relative group">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-xl bg-slate-900 border-2 border-slate-700/80 p-1 group-hover:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setAvatarSeed(Math.random().toString())}
                className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-1 text-[10px] font-mono shadow-lg transition-transform hover:scale-105"
              >
                RND
              </button>
            </div>
            <span className="text-xs text-slate-500 font-mono">Simulated Agent Profile Seed</span>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Satoshi_Edge"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
                Short Bio / Thesis
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Quantitative momentum strategies for volatile EVM assets."
                rows={3}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 outline-none transition-all resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !displayName.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all cursor-pointer"
          >
            {isSubmitting ? 'Opening...' : 'Enter Paper Room'}
            <ArrowRight className="w-4 h-4" />
          </button>
          {error && (
            <p className="text-xs text-rose-400 font-mono text-center">{error}</p>
          )}
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 flex justify-between items-center text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Paper Default
          </span>
          <span className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-indigo-400" />
            MetaMask Integration
          </span>
        </div>
      </motion.div>
    </div>
  );
}
