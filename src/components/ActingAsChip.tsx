import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Wallet as WalletIcon } from 'lucide-react';
import { apiFetch, safeJson } from '../lib/api';

// A compact guardrail chip: "which wallet am I acting as, and is it the right
// one?" Shown wherever a real action can originate (e.g. the Trading Desk) so
// you never trade from the wrong wallet by surprise.

interface ActingAs {
  address: string | null;
  name: string | null;
  canonicalAddress: string | null;
  isCanonical: boolean;
  hasCanonical: boolean;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function ActingAsChip({ className = '' }: { className?: string }) {
  const [data, setData] = useState<ActingAs | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch('/api/mm/acting-as');
        if (!res.ok) { if (alive) setGone(true); return; } // 403 when no wallet connected
        const d = await safeJson(res);
        if (alive) setData(d);
      } catch {
        if (alive) setGone(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (gone || !data || !data.address) return null;

  const ok = data.isCanonical;
  const warn = data.hasCanonical && !data.isCanonical;
  const tone = ok
    ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-300'
    : warn
      ? 'border-amber-700/50 bg-amber-950/20 text-amber-300'
      : 'border-slate-700/50 bg-slate-900/40 text-slate-300';

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${tone} ${className}`}>
      {ok ? <ShieldCheck className="w-4 h-4 shrink-0" /> : warn ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <WalletIcon className="w-4 h-4 shrink-0" />}
      <span className="font-semibold">Acting as {data.name || 'wallet'}</span>
      <span className="font-mono opacity-80">{short(data.address)}</span>
      <span className="opacity-70">
        {ok ? '· canonical ✓' : warn ? <>· not your canonical ({short(data.canonicalAddress!)})</> : '· no canonical set'}
      </span>
    </div>
  );
}
