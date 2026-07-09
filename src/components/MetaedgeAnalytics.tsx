import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Users, Bot, ArrowRightLeft, Activity, BarChart2, Zap, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch, safeJson } from '../lib/api';

// Real platform analytics — every figure comes from /api/platform-stats, which
// aggregates the live database. On a fresh instance these read low/zero, and
// that honesty is the point.

const STRAT_LABEL: Record<string, string> = {
  momentum: 'Momentum', grid: 'Grid', mean_reversion: 'Mean Reversion', custom_ai: 'Custom AI',
};
const STRAT_COLOR: Record<string, string> = {
  momentum: 'bg-indigo-500', grid: 'bg-emerald-500', mean_reversion: 'bg-amber-500', custom_ai: 'bg-fuchsia-500',
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function MetaedgeAnalytics() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // M1: this used a `.then(r => r.json())` promise chain, not `await res.json()`,
    // so the 1.1 codemod never matched it and the `res.ok` bug survived here.
    // M2: the `.catch(() => {})` swallowed everything — a dead analytics tab looked
    // identical to a healthy one with no data.
    const load = async () => {
      try {
        const res = await apiFetch('/api/platform-stats');
        const d = await safeJson(res);
        if (!alive) return;
        if (!res.ok) {
          setError(d?.error || `Could not load platform stats (HTTP ${res.status}).`);
          return;
        }
        setData(d);
        setError(null);
      } catch (err: any) {
        if (!alive) return;
        console.warn('[analytics] platform-stats failed', err);
        setError(err?.message || 'Could not reach the analytics service.');
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const m = data?.metrics;
  const cards = [
    { label: 'Players', value: m ? (m.players ?? m.users).toLocaleString() : '…', sub: m ? `${m.visitors ?? 0} visitors · ${m.walletConnected} wallet-connected` : '', icon: Users },
    { label: 'Agents Deployed', value: m ? m.agents.toLocaleString() : '…', sub: m ? `${m.autopilotAgents} on autopilot` : '', icon: Bot },
    { label: 'Trades Executed', value: m ? m.trades.toLocaleString() : '…', sub: m ? `$${m.volume.toLocaleString()} volume` : '', icon: ArrowRightLeft },
    { label: 'Net Realized P&L', value: m ? `${m.realizedPnl >= 0 ? '+' : ''}$${m.realizedPnl.toLocaleString()}` : '…', sub: 'across all players', icon: Zap },
  ];

  return (
    <div className="space-y-8 pb-12">
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
          {data && <span className="text-rose-400/70"> — figures below are from the last successful poll.</span>}
        </div>
      )}
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white font-mono">Platform Data</h1>
          <p className="text-sm text-slate-400">Live metrics aggregated from the real database — updates every 15s.</p>
        </div>
      </div>

      {/* Real metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <c.icon className="w-5 h-5 text-slate-500 mb-3" />
            <div className="text-2xl font-bold text-white font-mono">{c.value}</div>
            <div className="text-xs text-slate-500 mt-1">{c.label}</div>
            {c.sub && <div className="text-[10px] text-slate-600 font-mono mt-1">{c.sub}</div>}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth from real timestamps */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4">Cumulative growth (last 14 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.growth || []}>
                <defs>
                  <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#475569" fontSize={10} />
                <YAxis stroke="#475569" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="agents" stroke="#10b981" fill="url(#gA)" name="Agents" />
                <Area type="monotone" dataKey="trades" stroke="#6366f1" fill="url(#gU)" name="Trades" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real strategy distribution */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4">Strategies in play</h3>
          {(!data?.strategyDistribution || data.strategyDistribution.length === 0) ? (
            <div className="text-xs text-slate-500 font-mono py-8 text-center">No agents deployed yet.</div>
          ) : (
            <div className="space-y-4">
              {data.strategyDistribution.map((s: any) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{STRAT_LABEL[s.name] || s.name}</span>
                    <span className="text-slate-400 font-mono">{s.count} · {s.pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${STRAT_COLOR[s.name] || 'bg-slate-500'}`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real recent activity from the audit log */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> Live activity</h3>
        {(!data?.recentEvents || data.recentEvents.length === 0) ? (
          <div className="text-xs text-slate-500 font-mono py-6 text-center">No activity yet — be the first to trade.</div>
        ) : (
          <div className="space-y-1.5">
            {/* Keyed by event id, not index: this list is re-polled every 15s and
                new events arrive at the FRONT, so index 0 names a different event
                on every refresh. */}
            {data.recentEvents.map((e: any, i: number) => (
              <div key={e.id ?? `${e.timestamp}-${e.username}-${i}`} className="flex items-center justify-between gap-3 text-xs font-mono bg-slate-950/40 rounded-lg px-3 py-2">
                <span className="text-slate-300 truncate"><span className="text-indigo-400">{e.username}</span> · {e.details}</span>
                <span className="text-slate-600 shrink-0">{timeAgo(e.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
