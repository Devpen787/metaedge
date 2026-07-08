import React, { useEffect, useState } from 'react';
import { FlaskConical, RefreshCw, ShieldOff, Activity } from 'lucide-react';
import { apiFetch } from '../lib/api';

// The edge factory, visible: which strategy families are running, every
// thesis-tagged trade with its reasoning, and what the system DECLINED.
// Everything shown as-is — wins, losses, and restraint alike.

interface Family { family: string; cardId: string | null; trades: number; closed: number; wins: number; realizedPnl: number; lastTradeAt: number; lastTrigger: string; }
interface Recent { t: number; family: string; side: string; size: number; symbol: string; price: number; pnl: number | null; trigger: string; setup: string; }
interface FleetData { families: Family[]; declined: Record<string, number>; recent: Recent[]; totals: { trades: number; closed: number; realizedPnl: number }; }

const FAMILY_DESC: Record<string, string> = {
  momentum: 'Baseline: follow the 24h move (±0.75% threshold)',
  mean_reversion: 'Baseline: fade the 24h move (±0.75% threshold)',
  grid: 'Baseline: alternating buy/sell ticks — a cost-bleed benchmark',
  custom_ai: 'Baseline: momentum sign + exploration coin-flip',
  rsi_meanrev: 'CANDIDATE on trial: RSI14(1h) ≤ 35 dip-buy in uptrend (card rsi-meanrev-dot-v1, screened OOS PF 2.08)',
  manual: 'Your own Trading Desk fills with trade notes',
  copilot: 'Swarm Copilot natural-language fills',
  intent: 'Intent Solver fills',
};

function ago(ts: number) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
}

export default function ResearchFleet() {
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await apiFetch('/api/research-fleet');
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, []);

  const declinedRows = Object.entries(data?.declined || {}).sort((a, b) => b[1] - a[1]);
  const declinedTotal = declinedRows.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><FlaskConical className="w-5 h-5 text-cyan-400" /> Research Fleet</h2>
          <p className="text-sm text-slate-500">The edge factory, live — strategy families, every trade's reasoning, and what the system declined. Paper only; shown as-is.</p>
        </div>
        {data && (
          <div className="text-right">
            <div className={`text-2xl font-bold font-mono ${data.totals.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{data.totals.realizedPnl >= 0 ? '+' : ''}${data.totals.realizedPnl.toFixed(2)}</div>
            <div className="text-[11px] text-slate-500">realized P&L · {data.totals.trades} trades ({data.totals.closed} closed) · paper</div>
          </div>
        )}
      </div>

      {/* Strategy families */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data?.families || []).map((f) => {
          const winRate = f.closed ? Math.round((f.wins / f.closed) * 100) : null;
          return (
            <div key={f.family} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white font-mono">{f.family}</span>
                  {f.family === 'rsi_meanrev' && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">ON TRIAL</span>}
                </div>
                <span className={`text-sm font-bold font-mono ${f.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{f.realizedPnl >= 0 ? '+' : ''}${f.realizedPnl.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{FAMILY_DESC[f.family] || 'Strategy family'}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
                <span>{f.trades} trades</span>
                <span>{f.closed} closed{f.closed < 30 ? ' · ⚠ n<30' : ''}</span>
                {winRate != null && <span>{winRate}% wins</span>}
                <span>last: {ago(f.lastTradeAt)}</span>
              </div>
              {f.lastTrigger && <p className="text-[11px] text-slate-600 font-mono truncate" title={f.lastTrigger}>↳ {f.lastTrigger}</p>}
              {f.cardId && <p className="text-[10px] text-slate-600">card: {f.cardId}</p>}
            </div>
          );
        })}
        {data && !data.families.length && <p className="text-sm text-slate-500 col-span-2">No thesis-tagged trades yet.</p>}
      </div>

      {/* Declined opportunities */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><ShieldOff className="w-4 h-4 text-amber-400" /> Declined (last 7d): {declinedTotal}</h3>
        <p className="text-[11px] text-slate-500 mb-3">Restraint is evidence of discipline — the system refusing when conditions aren't met. It is not evidence of edge.</p>
        <div className="flex flex-wrap gap-2">
          {declinedRows.map(([k, n]) => {
            const [family, reason] = k.split('|');
            return <span key={k} className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">{family} · {reason} × {n}</span>;
          })}
          {!declinedRows.length && <span className="text-[11px] text-slate-600">No decline counters yet today.</span>}
        </div>
      </div>

      {/* Recent trades with reasoning */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-indigo-400" /> Recent trades — with their reasoning</h3>
        <div className="space-y-2">
          {(data?.recent || []).map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-slate-800/50 pb-2 last:border-0">
              <div className="min-w-0">
                <div className="text-[12px] font-mono text-slate-200">
                  <span className={r.side === 'buy' || r.side === 'long' ? 'text-emerald-400' : 'text-rose-400'}>{r.side.toUpperCase()}</span>
                  {' '}{Number(r.size).toFixed(4)} {r.symbol} @ ${Number(r.price).toLocaleString()} <span className="text-slate-500">[{r.family}]</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate" title={`${r.setup} → ${r.trigger}`}>{r.trigger}</div>
              </div>
              <div className="text-right shrink-0">
                {r.pnl != null && <div className={`text-[12px] font-mono ${r.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.pnl >= 0 ? '+' : ''}${r.pnl.toFixed(2)}</div>}
                <div className="text-[10px] text-slate-600">{ago(r.t)}</div>
              </div>
            </div>
          ))}
          {data && !data.recent.length && <p className="text-[11px] text-slate-600">Nothing yet.</p>}
        </div>
        {loading && <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2"><RefreshCw className="w-3 h-3 animate-spin" /> refreshing…</div>}
      </div>
    </div>
  );
}
