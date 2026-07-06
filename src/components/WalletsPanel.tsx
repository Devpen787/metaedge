import React, { useState } from 'react';
import { RefreshCw, Star, Check, AlertTriangle, ChevronDown, ChevronUp, Wallet as WalletIcon } from 'lucide-react';
import { apiFetch } from '../lib/api';

// Account management: every wallet under the account, its balance across all
// chains + perps, which is active/canonical, and loud warnings when the wallet
// the app is acting as isn't where the money is. This is the panel that stops
// us ever losing track of funds again.

interface Token { token: string; amount: string; usd: number; }
interface ChainBal { name: string; totalUsd: number; tokens: Token[]; }
interface WalletRow { address: string; name: string | null; totalUsd: number; chains: ChainBal[]; }
interface WalletsData {
  activeAddress: string | null;
  canonicalAddress: string | null;
  perps: { venue: string; totalBalance: number; spendable: number };
  wallets: WalletRow[];
}

function short(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
const eq = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export default function WalletsPanel({ onActiveChanged }: { onActiveChanged?: (addr: string) => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<WalletsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true); setError('');
      const res = await apiFetch('/api/mm/wallets');
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || d.error || 'Could not load your wallets.');
      setData(d);
    } catch (e: any) {
      setError(e.message || 'Could not load your wallets.');
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) load();
  }

  async function selectWallet(address: string) {
    try {
      setBusy(address); setError('');
      const res = await apiFetch('/api/mm/wallets/select', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not switch wallet.');
      onActiveChanged?.(address);
      window.dispatchEvent(new Event('wallet-connected'));
      await load();
    } catch (e: any) {
      setError(e.message || 'Could not switch wallet.');
    } finally {
      setBusy('');
    }
  }

  async function makeCanonical(address: string) {
    try {
      setBusy(address); setError('');
      const res = await apiFetch('/api/mm/wallets/canonical', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Could not set canonical.'); }
      await load();
    } catch (e: any) {
      setError(e.message || 'Could not set canonical.');
    } finally {
      setBusy('');
    }
  }

  const active = data?.wallets.find((w) => eq(w.address, data.activeAddress));
  const funded = (data?.wallets || []).filter((w) => w.totalUsd > 0);
  const activeEmptyButFunded = data && active && active.totalUsd === 0 && funded.length > 0;
  const canonicalNotActive = data?.canonicalAddress && !eq(data.canonicalAddress, data.activeAddress);
  const spotTotal = (data?.wallets || []).reduce((s, w) => s + w.totalUsd, 0);
  const grandTotal = spotTotal + (data?.perps.totalBalance || 0);

  return (
    <div className="border border-slate-800 rounded-2xl overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between px-4 py-3 bg-slate-950/60 hover:bg-slate-950 transition-colors">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-200"><WalletIcon className="w-4 h-4" /> Your wallets</span>
        <span className="flex items-center gap-2 text-xs font-mono text-slate-400">
          {data ? `${data.wallets.length} · $${grandTotal.toFixed(2)}` : (loading ? 'loading…' : '')}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {loading && !data && (
            <div className="flex items-center gap-2 text-xs text-slate-400 px-1 py-3">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Reading balances across every chain… (first load takes a few seconds)
            </div>
          )}

          {error && (
            <div className="text-[11px] text-amber-300 flex items-start gap-1.5 px-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Edge-case warning: acting as an empty wallet while funds sit elsewhere. */}
          {activeEmptyButFunded && (
            <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-3 text-xs text-amber-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>The wallet you're acting as is <b>empty</b>, but ${funded[0].totalUsd.toFixed(2)} is on <span className="font-mono">{short(funded[0].address)}</span>. Trades would run from the wrong wallet.</span>
              </div>
              <button
                onClick={() => selectWallet(funded[0].address)}
                disabled={!!busy}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                Switch to the funded wallet ({short(funded[0].address)})
              </button>
            </div>
          )}
          {canonicalNotActive && !activeEmptyButFunded && (
            <div className="text-[11px] text-amber-300 flex items-center gap-1.5 px-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Active wallet isn't your canonical one.
            </div>
          )}

          {data?.wallets.map((w) => {
            const isActive = eq(w.address, data.activeAddress);
            const isCanonical = eq(w.address, data.canonicalAddress);
            return (
              <div key={w.address} className={`rounded-xl border p-3 ${isActive ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{w.name || 'Wallet'}</span>
                      {isActive && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">ACTIVE</span>}
                      {isCanonical && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> CANONICAL</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono break-all">{w.address}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-white font-mono">${w.totalUsd.toFixed(2)}</div>
                  </div>
                </div>

                {w.chains.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {w.chains.map((c) => c.tokens.map((t) => (
                      <div key={c.name + t.token} className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>{Number(t.amount).toFixed(4)} {t.token} · {c.name}</span>
                        <span>${t.usd.toFixed(2)}</span>
                      </div>
                    )))}
                  </div>
                )}
                {w.chains.length === 0 && <div className="mt-1 text-[11px] text-slate-600">empty</div>}

                <div className="mt-2 flex gap-2">
                  {!isActive && (
                    <button onClick={() => selectWallet(w.address)} disabled={!!busy}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {busy === w.address ? <RefreshCw className="w-3 h-3 animate-spin" /> : null} Use this wallet
                    </button>
                  )}
                  {!isCanonical && (
                    <button onClick={() => makeCanonical(w.address)} disabled={!!busy}
                      className="text-xs text-slate-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-indigo-500/30 disabled:opacity-50 flex items-center gap-1">
                      <Star className="w-3 h-3" /> Set canonical
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {data && data.perps.totalBalance > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 flex justify-between text-xs">
              <span className="text-slate-400">Perps ({data.perps.venue})</span>
              <span className="text-white font-mono font-bold">${data.perps.totalBalance.toFixed(2)} <span className="text-slate-500">(${data.perps.spendable.toFixed(2)} free)</span></span>
            </div>
          )}

          {data && (
            <button onClick={load} disabled={loading} className="w-full text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 py-1 disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh balances
            </button>
          )}
        </div>
      )}
    </div>
  );
}
