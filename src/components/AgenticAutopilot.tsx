import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Activity, Network, Wallet, ArrowRightLeft, TrendingUp, Coins, ShieldCheck, Cpu } from 'lucide-react';
import { User } from '../types';

interface AgenticAutopilotProps {
  user: User;
}

export default function AgenticAutopilot({ user }: AgenticAutopilotProps) {
  const [isAutopilotActive, setIsAutopilotActive] = useState(false);
  const [budget, setBudget] = useState('1000');
  const [riskProfile, setRiskProfile] = useState<'low' | 'medium' | 'high'>('medium');
  const [logs, setLogs] = useState<{ time: string, message: string, type: 'info' | 'x402' | 'trade' | 'yield' }[]>([
    { time: new Date().toLocaleTimeString(), message: 'Autopilot Engine Offline. Awaiting activation.', type: 'info' }
  ]);

  const handleToggleAutopilot = async () => {
    if (isAutopilotActive) {
      setIsAutopilotActive(false);
      setLogs(prev => [{ time: new Date().toLocaleTimeString(), message: 'Autopilot Engine deactivated. Portfolio secured.', type: 'info' }, ...prev]);
    } else {
      setIsAutopilotActive(true);
      setLogs([{ time: new Date().toLocaleTimeString(), message: 'Autopilot Engine activated. Scanning for yield opportunities...', type: 'info' }]);
      
      try {
        const res = await fetch('/api/mm/autopilot/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget, riskProfile })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          // Stream the logs in to simulate agentic processing steps
          data.logs.forEach((log: any, index: number) => {
            setTimeout(() => {
              setLogs(prev => [log, ...prev]);
            }, (index + 1) * 1500);
          });
        } else {
          throw new Error(data.error || 'Failed to execute autopilot');
        }
      } catch (err: any) {
        setLogs(prev => [
          { time: new Date().toLocaleTimeString(), message: `[Error] ${err.message}`, type: 'info' },
          ...prev
        ]);
        setIsAutopilotActive(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2.5 rounded-2xl border border-indigo-500/30">
                <Cpu className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Agentic Autopilot & X402 Economy</h2>
                <p className="text-slate-400 text-sm font-mono mt-1">Self-Driving Wallet + Machine-to-Machine Micro-Economies</p>
              </div>
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed max-w-2xl font-mono bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 shadow-inner">
              Welcome to the future of wallets. Instead of manually clicking buttons, you fund an Agentic Autopilot. 
              Your wallet becomes a node in an AI economy: it uses <strong>X402 Micro-transactions</strong> to autonomously pay other specialized agents for private data, 
              then executes a cross-venue strategy (Swaps, Perps, Polymarket) to generate delta-neutral yield while you sleep.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-inner">
                <Network className="w-5 h-5 text-fuchsia-400 mb-2" />
                <h3 className="text-sm font-bold text-white">X402 Data Markets</h3>
                <p className="text-xs text-slate-500 mt-1">Wallet pays micro-fees to other AI oracles for exclusive signals.</p>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-inner">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400 mb-2" />
                <h3 className="text-sm font-bold text-white">Cross-Venue Execution</h3>
                <p className="text-xs text-slate-500 mt-1">Simultaneous hedging across Spot, Perps, and Prediction Markets.</p>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-inner">
                <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
                <h3 className="text-sm font-bold text-white">Delta-Neutral</h3>
                <p className="text-xs text-slate-500 mt-1">Automated risk management ensures principal protection.</p>
              </div>
            </div>
          </div>

          <div className="w-full md:w-80 bg-slate-950 rounded-2xl p-5 border border-slate-800 shadow-xl shrink-0">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Configure Autopilot
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-mono">Allocated Capital (USDC)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input 
                    type="number" 
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    disabled={isAutopilotActive}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-mono">Risk Profile</label>
                <div className="grid grid-cols-3 gap-2">
                  {['low', 'medium', 'high'].map(risk => (
                    <button
                      key={risk}
                      onClick={() => setRiskProfile(risk as any)}
                      disabled={isAutopilotActive}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all capitalize ${
                        riskProfile === risk 
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50' 
                          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300 disabled:opacity-50'
                      }`}
                    >
                      {risk}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleToggleAutopilot}
                  className={`w-full py-3 rounded-xl font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg ${
                    isAutopilotActive
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/50'
                  }`}
                >
                  <Activity className={`w-4 h-4 ${isAutopilotActive ? 'animate-pulse' : ''}`} />
                  {isAutopilotActive ? 'HALT AUTOPILOT' : 'ENGAGE AUTOPILOT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
             <Cpu className="w-32 h-32 text-indigo-500" />
           </div>
           <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2 relative z-10">
             <Activity className="w-4 h-4 text-emerald-400" />
             Live Autonomous Event Log
           </h3>
           <div className="bg-slate-950 rounded-xl p-4 border border-slate-900 h-80 overflow-y-auto custom-scrollbar space-y-3 relative z-10 shadow-inner">
             {logs.map((log, i) => (
               <motion.div 
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 key={i} 
                 className={`text-xs font-mono p-2.5 rounded-lg border ${
                   log.type === 'x402' ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300' :
                   log.type === 'trade' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' :
                   log.type === 'yield' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                   'bg-slate-900 border-slate-800 text-slate-400'
                 }`}
               >
                 <span className="opacity-50 mr-2">[{log.time}]</span>
                 {log.message}
               </motion.div>
             ))}
           </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Active Yield Matrix
          </h3>
          
          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Working Capital</span>
                <span className="text-xs font-mono font-bold text-emerald-400">Active</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono tracking-tight">${isAutopilotActive ? budget : '0.00'}</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Est. APY</span>
                <span className="text-xs font-mono font-bold text-indigo-400">+24.5%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div className={`bg-indigo-500 h-1.5 rounded-full transition-all duration-1000 ${isAutopilotActive ? 'w-[75%]' : 'w-0'}`}></div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner space-y-3">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Current Allocations</div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Spot (Hedge)</span>
                <span className="text-slate-200">50%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Hyperliquid Perps</span>
                <span className="text-slate-200">25%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Polymarket Events</span>
                <span className="text-slate-200">20%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-fuchsia-400 flex items-center gap-1">X402 Budget <Zap className="w-3 h-3" /></span>
                <span className="text-fuchsia-400">5%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
