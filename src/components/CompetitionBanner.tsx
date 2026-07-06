import React, { useState } from 'react';
import { Trophy, Copy, Check, X } from 'lucide-react';

// MetaMask "Agent Wallet Trading Competition" — Best Trade & Highest Volume.
// Window: Jul 6 12am ET – Jul 12 11:59pm ET (EDT = UTC-4), winners Jul 13.
// The banner surfaces the user's agent wallet address (needed for the entry
// form) and auto-hides once the window closes.
const COMPETITION_END = Date.UTC(2026, 6, 13, 3, 59, 59); // Jul 12 11:59pm ET
const DISMISS_KEY = 'metaedge-competition-banner-2026-07';
// Set this to the official registration form URL to light up a one-click button.
const REGISTRATION_URL = '';

interface Props {
  walletAddress?: string;
  onConnect: () => void;
}

export default function CompetitionBanner({ walletAddress, onConnect }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [copied, setCopied] = useState(false);

  if (dismissed || Date.now() > COMPETITION_END) return null;

  const isConnected = !!walletAddress && walletAddress !== 'connected';

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  function copyAddr() {
    if (!walletAddress) return;
    navigator.clipboard?.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard blocked */ });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-amber-500/[0.06] to-transparent p-4 mb-4">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute top-3 right-3 text-slate-500 hover:text-slate-300">
        <X className="w-4 h-4" />
      </button>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pr-6">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Agent Wallet Trading Competition</div>
            <div className="text-xs text-slate-400">Best Trade &amp; Highest Volume · ends Jul 12 · scores <span className="text-slate-300">real</span> Agent Wallet trades</div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-2 sm:justify-end">
          {isConnected ? (
            <>
              <button
                onClick={copyAddr}
                title="Copy your Agent Wallet address for the entry form"
                className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 hover:border-orange-500/40 transition-colors group"
              >
                <span className="text-xs font-mono text-slate-200">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />}
              </button>
              {REGISTRATION_URL && (
                <a
                  href={REGISTRATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap"
                >
                  Register ↗
                </a>
              )}
            </>
          ) : (
            <button
              onClick={onConnect}
              className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap"
            >
              Connect to get your address
            </button>
          )}
        </div>
      </div>
      {isConnected && (
        <p className="text-[11px] text-slate-500 mt-2 sm:pl-[3.25rem]">
          {copied ? 'Copied — paste it into the registration form’s “MM agent wallet address” field.' : 'Copy your address above, then paste it into the registration form.'}
        </p>
      )}
    </div>
  );
}
