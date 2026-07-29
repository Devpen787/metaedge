import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, ArrowDownToLine, Wallet as WalletIcon, RefreshCw, Star, KeyRound } from 'lucide-react';
import { apiFetch, safeJson } from '../lib/api';
import WalletsPanel from './WalletsPanel';

// The account command center — the dedicated home for everything wallet: what
// you're acting as (guardrail), every wallet + balance, and consolidation. The
// wallet modal stays the quick "connect" entry; this is where you manage.

interface WalletsData {
  activeAddress: string | null;
  canonicalAddress: string | null;
  perps: { venue: string; totalBalance: number; spendable: number };
  wallets: { address: string; name: string | null; totalUsd: number; chains: any[] }[];
}
interface Move { from: string; chainName: string; token: string; amount: string; usd: number; }

const eq = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function WalletCenter({ user, onConnect }: { user: any; onConnect: () => void }) {
  const [data, setData] = useState<WalletsData | null>(null);
  const [plan, setPlan] = useState<{ canonical: string | null; moves: Move[]; totalUsd?: number; note?: string } | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [consolMsg, setConsolMsg] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  // Real key bump. The old code left a comment promising one and never wrote it.
  const [walletsKey, setWalletsKey] = useState(0);

  const connected = !!user?.walletAddress && user.walletAddress !== 'connected';
  const active = data?.wallets.find((w) => eq(w.address, data.activeAddress));
  const canonical = data?.canonicalAddress || null;
  const isCanonicalActive = !!canonical && eq(canonical, data?.activeAddress);
  const grandTotal = (data?.wallets.reduce((s, w) => s + w.totalUsd, 0) || 0) + (data?.perps.totalBalance || 0);

  async function switchTo(address: string) {
    try {
      setSwitching(true);
      setSwitchError('');
      const res = await apiFetch('/api/mm/wallets/select', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) });
      // The response was ignored: a REJECTED switch still fired `wallet-connected`,
      // so the app re-read balances as the new wallet while the server was still
      // acting as the old one. Read it before announcing success.
      const d = await safeJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(d.error || 'Could not switch wallet.');

      window.dispatchEvent(new Event('wallet-connected'));
      setData(null);
      setWalletsKey((k) => k + 1); // force WalletsPanel to remount and refetch
    } catch (e: any) {
      setSwitchError(e?.message || 'Could not switch wallet.');
    } finally {
      setSwitching(false);
    }
  }

  async function loadPlan() {
    try {
      setPlanLoading(true); setConsolMsg('');
      const res = await apiFetch('/api/mm/wallets/consolidate/preview');
      const d = await safeJson(res);
      if (!res.ok) throw new Error(d.error || 'Could not build the plan.');
      setPlan(d);
    } catch (e: any) {
      setConsolMsg(e.message || 'Could not build the plan.');
    } finally {
      setPlanLoading(false);
    }
  }

  async function runConsolidation() {
    try {
      setPlanLoading(true); setConsolMsg('');
      const res = await apiFetch('/api/mm/wallets/consolidate', { method: 'POST' });
      const d = await safeJson(res);
      if (d.locked) { setConsolMsg(d.message); return; }
      if (!res.ok) throw new Error(d.error || 'Consolidation failed.');
      setConsolMsg('Consolidation submitted. Refreshing balances…');
      setData(null);
    } catch (e: any) {
      setConsolMsg(e.message || 'Consolidation failed.');
    } finally {
      setPlanLoading(false);
    }
  }

  if (!connected) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center mx-auto">
          <WalletIcon className="w-7 h-7 text-orange-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Wallet &amp; Funds</h2>
        <p className="text-sm text-slate-400">Connect your MetaMask Agent Wallet to see every wallet under your account, their balances across all chains, and manage funds.</p>
        <button onClick={onConnect} className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-3 rounded-xl inline-flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Connect Agent Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><WalletIcon className="w-5 h-5 text-orange-400" /> Wallet &amp; Funds</h2>
          <p className="text-sm text-slate-500">Every wallet under your account — what you're acting as, balances, and consolidation.</p>
        </div>
        {data && <div className="text-right"><div className="text-2xl font-bold text-white font-mono">${grandTotal.toFixed(2)}</div><div className="text-[11px] text-slate-500">total across {data.wallets.length} wallets + perps</div></div>}
      </div>

      {/* Phase 3 guardrail: who am I acting as? */}
      {data && (
        <div className={`rounded-2xl border p-4 ${isCanonicalActive ? 'border-emerald-700/40 bg-emerald-950/20' : canonical ? 'border-amber-700/50 bg-amber-950/20' : 'border-slate-800 bg-slate-950/40'}`}>
          <div className="flex items-start gap-3">
            {isCanonicalActive ? <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${canonical ? 'text-amber-400' : 'text-slate-500'}`} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">
                Acting as {active?.name || 'wallet'} <span className="font-mono text-slate-400">{active ? short(active.address) : ''}</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {isCanonicalActive
                  ? 'This is your canonical wallet. Real actions will run from here. ✓'
                  : canonical
                    ? <>⚠ Your canonical wallet is <span className="font-mono">{short(canonical)}</span>. Live actions are blocked until you switch to it.</>
                    : 'No canonical wallet set. Pick one below so wrong-wallet actions get caught.'}
              </div>
              {active && <div className="text-[11px] text-slate-500 mt-1 font-mono">${active.totalUsd.toFixed(2)} spot{data.perps.totalBalance > 0 ? ` · $${data.perps.totalBalance.toFixed(2)} perps` : ''}</div>}
            </div>
            {canonical && !isCanonicalActive && (
              <button onClick={() => switchTo(canonical)} disabled={switching} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50 shrink-0">
                Switch to canonical
              </button>
            )}
          </div>
        </div>
      )}

      {switchError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{switchError}</div>
      )}

      {/* Phase 1/2: all wallets (reused component, expanded by default).
          refreshKey bumps after a successful switch so the panel refetches
          instead of rendering the previous wallet's balances. */}
      <WalletsPanel refreshKey={walletsKey} defaultOpen onData={setData} onActiveChanged={() => setData(null)} />

      {/* Phase 4: consolidation */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Consolidate funds</h3>
        </div>
        <p className="text-xs text-slate-400">Sweep balances scattered across your other wallets into one canonical wallet, so your money lives in a single place.</p>

        {!canonical ? (
          <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Set a canonical wallet above first (⭐ Set canonical).</p>
        ) : (
          <>
            <div className="flex gap-2">
              <button onClick={loadPlan} disabled={planLoading} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                {planLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null} Preview consolidation
              </button>
              {plan && plan.moves.length > 0 && (
                <button onClick={runConsolidation} disabled={planLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50">
                  Consolidate to {short(canonical)}
                </button>
              )}
            </div>

            {plan && (
              plan.moves.length === 0
                ? <p className="text-xs text-slate-500">Nothing to consolidate — all funds are already on your canonical wallet.</p>
                : (
                  <div className="space-y-1 bg-slate-950/50 rounded-lg p-3">
                    {/* A consolidation plan is recomputed as balances change and
                        its moves reorder. Key on what identifies a move, not its
                        position in this render — these rows describe real fund
                        transfers. */}
                    {plan.moves.map((m: any, i: number) => (
                      <div key={`${m.from}-${m.token}-${m.chainName}`} className="flex justify-between text-[11px] font-mono text-slate-400">
                        <span>{Number(m.amount).toFixed(4)} {m.token} · {m.chainName} · from {short(m.from)}</span>
                        <span>${m.usd.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[11px] font-mono text-slate-200 border-t border-slate-800 pt-1 mt-1">
                      <span>Total to sweep</span><span>${(plan.totalUsd || 0).toFixed(2)}</span>
                    </div>
                  </div>
                )
            )}
            {consolMsg && <p className="text-[11px] text-amber-300">{consolMsg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
