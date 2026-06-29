import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Info, Users, Bot, ArrowRightLeft, TrendingUp, Coins, Landmark, Network, Award, X } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tabId: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Info, desc: 'Overview & Recent Audits' },
    { id: 'rooms', label: 'Rooms', icon: Users, desc: 'Social trading rooms' },
    { id: 'agents', label: 'Agents', icon: Bot, desc: 'AI agent workshop' },
    { id: 'trading', label: 'Trading Desk', icon: ArrowRightLeft, desc: 'Execute paper trades' },
    { id: 'charts', label: 'Market Charts', icon: TrendingUp, desc: 'Live market data' },
    { id: 'predictions', label: 'Predictions', icon: Coins, desc: 'Speculate on outcomes' },
    { id: 'vaults', label: 'Vaults', icon: Landmark, desc: 'Shared capital clubs' },
    { id: 'graph', label: 'Evidence Map', icon: Network, desc: 'Agent knowledge graph' },
    { id: 'specs', label: 'Specs Hub', icon: Award, desc: 'Node operations catalog' }
  ];

  const filtered = tabs.filter(t => 
    t.label.toLowerCase().includes(search.toLowerCase()) || 
    t.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-xl bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search modules..."
                className="w-full bg-transparent text-white focus:outline-none placeholder-slate-500 font-mono text-sm"
              />
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filtered.length > 0 ? (
                <div className="space-y-1">
                  {filtered.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          onNavigate(tab.id);
                          onClose();
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-500/10 hover:text-indigo-400 text-left transition-colors group"
                      >
                        <div className="bg-slate-800 group-hover:bg-indigo-500/20 p-2 rounded-lg text-slate-400 group-hover:text-indigo-400 transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-200 group-hover:text-white">{tab.label}</div>
                          <div className="text-xs font-mono text-slate-500">{tab.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 font-mono text-sm">
                  No modules found matching "{search}"
                </div>
              )}
            </div>
            <div className="bg-slate-950 px-4 py-2 text-xs font-mono text-slate-500 flex justify-between border-t border-slate-800">
              <span>Use arrows to navigate</span>
              <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded font-sans">esc</kbd> to close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
