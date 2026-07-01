import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User as UserIcon, ShieldCheck, Zap, Activity, ChevronRight, CheckCircle, AlertTriangle, Terminal, Cpu, Sparkles } from 'lucide-react';
import { User } from '../types';
import { setGlobalAgentProcessing } from '../lib/events';

interface SwarmCopilotProps {
  user: User;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thoughtProcess?: string[];
  proposal?: {
    description: string;
    actions: string[];
    estimatedCost: string;
    riskLevel: string;
  } | null;
  status?: 'typing' | 'done' | 'executing' | 'executed';
}

export default function SwarmCopilot({ user }: SwarmCopilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      content: 'Swarm Orchestrator initialized. All micro-agents are standing by. What is your directive?',
      status: 'done'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [userApiKey, setUserApiKey] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (overrideText?: string) => {
    const textToProcess = typeof overrideText === 'string' ? overrideText : input;
    if (!textToProcess.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToProcess };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setGlobalAgentProcessing(true, 'Swarm Copilot Reasoning');

    try {
      const res = await fetch('/api/mm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, model: selectedModel, apiKey: userApiKey })
      });
      const data = await res.json();

      if (res.ok) {
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          thoughtProcess: data.thoughtProcess,
          proposal: data.proposal,
          status: 'done'
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Connection error: ${err.message}. Orchestrator offline.`,
        status: 'done'
      }]);
    } finally {
      setIsTyping(false);
      setGlobalAgentProcessing(false);
    }
  };

  const handleExecuteProposal = async (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'executing' } : m));
    setGlobalAgentProcessing(true, 'Executing Proposal');
    
    // Simulate execution
    await new Promise(r => setTimeout(r, 2000));
    
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'executed' } : m));
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Execution complete. Assets have been routed securely according to the proposal.',
      status: 'done'
    }]);
    
    setGlobalAgentProcessing(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl shrink-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2.5 rounded-2xl border border-indigo-500/30">
                <Terminal className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Swarm Copilot</h2>
                <p className="text-slate-400 text-sm font-mono mt-1">Conversational Natural-Language Orchestrator</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {selectedModel === 'claude-3-5' && (
              <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/30 text-amber-400">
                <input 
                  type="password" 
                  value={userApiKey}
                  onChange={(e) => setUserApiKey(e.target.value)}
                  placeholder="Your API Key (sk-ant-...)"
                  className="bg-transparent text-xs font-mono placeholder:text-amber-500/50 focus:outline-none w-48"
                />
              </div>
            )}
            <div className="flex items-center gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 backdrop-blur-sm">
              <Cpu className="w-4 h-4 text-slate-400" />
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-xs font-mono text-slate-300 focus:outline-none cursor-pointer appearance-none pr-4"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Free Tier / Cloud)</option>
                <option value="llama-3-8b-local">Llama 3 8B (Free / Local WebGPU)</option>
                <option value="claude-3-5">Claude 3.5 Sonnet (Pro / BYO Key)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-slate-950/50 pointer-events-none" />
        
        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${
                  msg.role === 'user' 
                    ? 'bg-slate-800 border-slate-700 text-slate-300' 
                    : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                }`}>
                  {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div className={`space-y-3 ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
                  {msg.thoughtProcess && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 w-fit space-y-1.5">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                        <Activity className="w-3 h-3" /> Agentic Consensus
                      </div>
                      {msg.thoughtProcess.map((thought, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-400">
                          <ChevronRight className="w-3 h-3 text-indigo-500" />
                          {thought}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={`p-4 rounded-2xl text-sm font-mono leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-sm shadow-indigo-900/20 shadow-lg' 
                      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm shadow-xl'
                  }`}>
                    {msg.content}
                  </div>

                  {msg.proposal && (
                    <div className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden mt-2 max-w-sm">
                      <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Execution Proposal</span>
                      </div>
                      <div className="p-4 space-y-4">
                        <p className="text-sm font-mono text-slate-300">{msg.proposal.description}</p>
                        
                        <div className="space-y-2">
                          {msg.proposal.actions.map((act, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <Zap className="w-3 h-3 text-indigo-400" />
                              {act}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-xs font-mono border-t border-slate-800 pt-3">
                          <span className="text-slate-500">Cost: <span className="text-slate-300">{msg.proposal.estimatedCost}</span></span>
                          <span className="flex items-center gap-1">
                            <AlertTriangle className={`w-3 h-3 ${msg.proposal.riskLevel === 'High' ? 'text-red-400' : msg.proposal.riskLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`} />
                            <span className={msg.proposal.riskLevel === 'High' ? 'text-red-400' : msg.proposal.riskLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}>{msg.proposal.riskLevel} Risk</span>
                          </span>
                        </div>

                        <button 
                          onClick={() => handleExecuteProposal(msg.id)}
                          disabled={msg.status !== 'done'}
                          className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                            msg.status === 'executed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            msg.status === 'executing' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                            'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                          }`}
                        >
                          {msg.status === 'executed' ? <><CheckCircle className="w-4 h-4" /> Executed</> :
                           msg.status === 'executing' ? <><Activity className="w-4 h-4 animate-spin" /> Simulating...</> :
                           <><ShieldCheck className="w-4 h-4" /> Approve & Execute</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-[85%]">
                <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="space-y-3 w-full">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 w-fit space-y-2 min-w-[200px]">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-2">
                      <Activity className="w-3 h-3 animate-spin" /> Synthesizing Intent...
                    </div>
                    <div className="h-2 w-3/4 bg-indigo-500/20 rounded animate-pulse" />
                    <div className="h-2 w-1/2 bg-indigo-500/20 rounded animate-pulse delay-75" />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 rounded-tl-sm shadow-xl min-w-[300px]">
                    <div className="space-y-3">
                       <div className="h-3 w-full bg-slate-700 rounded animate-pulse" />
                       <div className="h-3 w-5/6 bg-slate-700 rounded animate-pulse delay-75" />
                       <div className="h-3 w-4/6 bg-slate-700 rounded animate-pulse delay-150" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 relative z-10 flex flex-col gap-3">
          {messages.length <= 2 && !isTyping && (
            <div className="flex flex-wrap gap-2 items-center mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mr-2">
                <Sparkles className="w-3 h-3 text-indigo-400"/> Suggestions
              </span>
              {[
                "Move idle USDC to MetaMask Money Account (~4% APY)",
                "Scan for highest risk-adjusted stablecoin yield",
                "Delta-hedge my portfolio against a 10% drop",
                "Bridge 100 USDC to Base"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { handleSend(suggestion); }}
                  className="text-xs font-mono bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-2 rounded-lg transition-colors text-left whitespace-normal"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the Swarm Orchestrator to analyze yields, route funds, or hedge positions..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-14 py-4 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
