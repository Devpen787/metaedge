import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, CheckCircle, Clock, Zap, Shield, ChevronRight, Settings2, Command } from 'lucide-react';
import { User } from '../types';

interface IntentSolverProps {
  user: User;
}

interface IntentStep {
  id: string;
  action: string;
  details: string;
  asset: string;
  network: string;
  status: 'pending' | 'simulating' | 'ready' | 'executed' | 'failed';
  estimatedCost?: string;
  data?: any;
}

export default function IntentSolver({ user }: IntentSolverProps) {
  const [prompt, setPrompt] = useState('Swap 500 USDC to the most undervalued AI token on Base network, then stake it.');
  const [isSolving, setIsSolving] = useState(false);
  const [steps, setSteps] = useState<IntentStep[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const predefinedIntents = [
    "Swap 500 USDC to the most undervalued AI token on Base, then stake it.",
    "Bridge 1 ETH to Arbitrum and deposit into the highest APY stablecoin pool.",
    "Delta-hedge my long ETH position using Hyperliquid perps.",
    "Buy $100 of YES on the most popular US Election market on Polymarket."
  ];

  const handleSolve = async () => {
    if (!prompt) return;
    setIsSolving(true);
    setSteps([]);
    
    try {
      const res = await fetch('/api/mm/intent/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: prompt })
      });
      const data = await res.json();
      
      if (res.ok && data.steps) {
        setSteps(data.steps.map((s: any, i: number) => ({ ...s, id: `step-${i}`, status: 'pending' })));
        
        // Simulate step processing
        data.steps.forEach((_: any, i: number) => {
          setTimeout(() => {
            setSteps(prev => prev.map((step, idx) => 
              idx === i ? { ...step, status: 'simulating' } : step
            ));
          }, (i * 1500) + 500);
          
          setTimeout(() => {
            setSteps(prev => prev.map((step, idx) => 
              idx === i ? { ...step, status: 'ready' } : step
            ));
          }, (i * 1500) + 1500);
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSolving(false);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    for (let i = 0; i < steps.length; i++) {
      setSteps(prev => prev.map((step, idx) => idx === i ? { ...step, status: 'simulating' } : step));
      await new Promise(r => setTimeout(r, 1000));
      setSteps(prev => prev.map((step, idx) => idx === i ? { ...step, status: 'executed' } : step));
    }
    setIsExecuting(false);
  };

  const allReady = steps.length > 0 && steps.every(s => s.status === 'ready' || s.status === 'executed');
  const allExecuted = steps.length > 0 && steps.every(s => s.status === 'executed');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-fuchsia-500/20 p-2.5 rounded-2xl border border-fuchsia-500/30">
                <Sparkles className="w-6 h-6 text-fuchsia-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">DeFi Intent Solver</h2>
                <p className="text-slate-400 text-sm font-mono mt-1">Declarative Execution via Agentic Sub-Routing</p>
              </div>
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed max-w-2xl font-mono">
              Stop manually clicking through bridges, DEXs, and yield farms. Simply state your desired outcome in plain English. The AI Agent will map the optimal execution path, simulate gas costs, and package it into a single signed transaction.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                   <Command className="w-4 h-4" />
                   What do you want to achieve?
                 </label>
                 <textarea
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   placeholder="E.g., Swap 500 USDC to ETH and bridge to Optimism..."
                   className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-fuchsia-500 font-mono resize-none h-28 shadow-inner"
                 />
               </div>

               <div className="flex flex-wrap gap-2">
                 {predefinedIntents.map((intent, i) => (
                   <button
                     key={i}
                     onClick={() => setPrompt(intent)}
                     className="text-[10px] font-mono bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors truncate max-w-[200px]"
                   >
                     {intent}
                   </button>
                 ))}
               </div>

               <button
                 onClick={handleSolve}
                 disabled={isSolving || !prompt}
                 className="w-full py-3.5 rounded-xl font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg bg-fuchsia-600 text-white hover:bg-fuchsia-500 shadow-fuchsia-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isSolving ? (
                   <><Sparkles className="w-4 h-4 animate-spin" /> Solving Intent Path...</>
                 ) : (
                   <><Zap className="w-4 h-4" /> Generate Execution Plan</>
                 )}
               </button>
             </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-full flex flex-col">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-6">
              <Settings2 className="w-4 h-4 text-slate-400" />
              Execution Pathway
            </h3>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              <AnimatePresence>
                {steps.length === 0 && !isSolving && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
                    <Sparkles className="w-8 h-8 opacity-20" />
                    <p className="text-sm font-mono text-center">Awaiting intent parameters to map execution routing.</p>
                  </motion.div>
                )}

                {steps.map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative p-4 rounded-xl border ${
                      step.status === 'executed' ? 'bg-emerald-500/10 border-emerald-500/30' :
                      step.status === 'ready' ? 'bg-slate-800 border-slate-700' :
                      step.status === 'simulating' ? 'bg-fuchsia-500/10 border-fuchsia-500/30 animate-pulse' :
                      'bg-slate-950 border-slate-800 opacity-50'
                    }`}
                  >
                    {i !== steps.length - 1 && (
                      <div className="absolute left-6 -bottom-5 w-px h-5 bg-slate-700" />
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {step.status === 'executed' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                         step.status === 'ready' ? <Zap className="w-4 h-4 text-fuchsia-400" /> :
                         step.status === 'simulating' ? <Clock className="w-4 h-4 text-fuchsia-400 animate-spin" /> :
                         <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                        <span className="text-xs font-bold text-white tracking-wider uppercase">{step.action}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                        {step.network}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono ml-6">{step.details}</p>
                    
                    {step.data && step.status !== 'pending' && (
                      <div className="ml-6 mt-3 p-2 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400">
                        {step.action === 'SWAP' && <div>Quote: {step.data.quote}</div>}
                        {step.action === 'PREDICTION' && <div>Market: {step.data.market}</div>}
                        <div>Est. Gas: {step.estimatedCost}</div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {steps.length > 0 && (
              <div className="pt-6 mt-4 border-t border-slate-800">
                <button
                  onClick={handleExecute}
                  disabled={!allReady || isExecuting || allExecuted}
                  className={`w-full py-3.5 rounded-xl font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg ${
                    allExecuted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    allReady ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/50' :
                    'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {allExecuted ? (
                    <><CheckCircle className="w-4 h-4" /> Intent Executed</>
                  ) : isExecuting ? (
                    <><Zap className="w-4 h-4 animate-spin" /> Executing Batch...</>
                  ) : (
                    <><Shield className="w-4 h-4" /> Sign & Execute Batch</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
