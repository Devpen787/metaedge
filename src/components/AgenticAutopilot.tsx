import React, { useMemo } from 'react';
import { Cpu, Zap, Activity, Bot, Play, Pause, ArrowUpRight } from 'lucide-react';
import { User, TradingAgent, PaperTrade, AuditEvent } from '../types';

interface AgenticAutopilotProps {
  user: User;
  agents: TradingAgent[];
  trades: PaperTrade[];
  audits: AuditEvent[];
  onAgentAutopilotChanged: (id: string, enabled: boolean) => Promise<void>;
}

// The REAL Autopilot control center. Not a planner, not a yield fantasy — this
// is where you turn your agents into self-trading bots. The engine runs
// server-side (~every 90s): each active agent with autopilot on trades by its
// own strategy against live prices, through the same ledger as manual fills.

function timeAgo(ts?: number) {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AgenticAutopilot({ agents, trades, audits, onAgentAutopilotChanged }: AgenticAutopilotProps) {
  const myAgents = agents.filter((a) => a.status !== 'revoked');
  const autoAgents = myAgents.filter((a) => a.autopilot && a.status === 'active');

  const realizedByAgent = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of trades) if (typeof t.pnl === 'number') m[t.agentId] = (m[t.agentId] || 0) + t.pnl;
    return m;
  }, [trades]);

  const autoLog = useMemo(
    () => audits.filter((a) => a.action === 'AUTOPILOT_TRADE').sort((a, b) => b.timestamp - a.timestamp).slice(0, 20),
    [audits]
  );

  const engageAll = async () => {
    for (const a of myAgents) if (a.status === 'active' && !a.autopilot) await onAgentAutopilotChanged(a.id, true);
  };
  const pauseAll = async () => {
    for (const a of autoAgents) await onAgentAutopilotChanged(a.id, false);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Autopilot</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xl">
                Turn your agents into self-trading bots. The engine runs server-side every ~90 seconds — each active agent with autopilot on trades by its own strategy against live prices. Paper only; its P&L moves your Arena standing while you're away.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={engageAll} disabled={myAgents.length === 0}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm">
              <Zap className="w-4 h-4" /> Engage all
            </button>
            {autoAgents.length > 0 && (
              <button onClick={pauseAll} className="px-5 py-2 text-slate-400 hover:text-slate-200 text-xs font-mono">Pause all</button>
            )}
          </div>
        </div>
        <div className="flex gap-6 mt-6 relative z-10">
          <div><div className="text-2xl font-bold text-white font-mono">{autoAgents.length}</div><div className="text-[10px] text-slate-500 uppercase font-mono">On autopilot</div></div>
          <div><div className="text-2xl font-bold text-white font-mono">{autoLog.length}</div><div className="text-[10px] text-slate-500 uppercase font-mono">Auto-trades logged</div></div>
          <div><div className={`text-2xl font-bold font-mono ${autoAgents.length ? 'text-cyan-400' : 'text-slate-500'}`}>{autoAgents.length ? 'LIVE' : 'IDLE'}</div><div className="text-[10px] text-slate-500 uppercase font-mono">Engine</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Bot className="w-4 h-4 text-indigo-400" /> Your Agents</h3>
          {myAgents.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-500">
              No agents yet. Deploy one in <b className="text-slate-300">Trading Agents</b> or the <b className="text-slate-300">Agent Arena</b>, then engage autopilot here.
            </div>
          ) : (
            <div className="space-y-3">
              {myAgents.map((a) => {
                const paused = a.status === 'paused';
                const on = a.autopilot && !paused;
                const pnl = realizedByAgent[a.id] || 0;
                return (
                  <div key={a.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${on ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        {a.name}
                        {on && <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"><Zap className="w-2.5 h-2.5 animate-pulse" /> Auto</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {a.strategyType.replace('_', ' ')} · {a.assetSymbol} · last: {timeAgo(a.lastAutoTradeAt)} · <span className={pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onAgentAutopilotChanged(a.id, !a.autopilot)}
                      disabled={paused}
                      title={paused ? 'Resume the agent first (it is paused)' : on ? 'Turn autopilot off' : 'Turn autopilot on'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 ${on ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                    >
                      {on ? <><Pause className="w-3.5 h-3.5" /> Stop</> : <><Play className="w-3.5 h-3.5" /> Engage</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> Live Autonomous Trades</h3>
          {autoLog.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 font-mono">
              {autoAgents.length ? 'Engine engaged — waiting for the next tick (~90s)…' : 'Engage an agent to see it trade on its own here.'}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
              {autoLog.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 text-xs font-mono bg-slate-950/40 rounded-lg px-3 py-2 border border-slate-900/60">
                  <span className="text-slate-300 truncate flex items-center gap-1.5"><ArrowUpRight className="w-3 h-3 text-cyan-400 shrink-0" /> {e.details}</span>
                  <span className="text-slate-600 shrink-0">{timeAgo(e.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
