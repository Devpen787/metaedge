import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Wallet, RefreshCw, AlertTriangle, KeyRound, ShieldCheck, ChevronDown, ChevronUp, Landmark, Bot, Copy, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch, safeJson } from '../lib/api';
import { connectBank, refreshBalance, fundAgentWallet, hasMetaMask, BASE_CHAIN_ID_HEX, type BankConnection } from '../lib/bankWallet';
import { spark, originOf } from '../lib/fx';
import WalletsPanel from './WalletsPanel';

// The wallet modal explains and connects TWO different MetaMask things:
//   • Agent Wallet (the executor) — what your agents trade with; how you compete.
//   • MetaMask Wallet (the bank)  — your everyday wallet; holds funds, tops up
//     the executor when you go Live.
// They serve different purposes and both add value — so we present both clearly.

interface AgentWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckStatus = 'ready' | 'blocked' | 'unknown';

interface ReadinessCheck {
  id: string;
  label: string;
  status: CheckStatus;
  summary: string;
  command?: string;
}

interface MetaMaskReadiness {
  liveModeGlobalLock: boolean;
  checks: ReadinessCheck[];
  wallet?: { address: string | null; baseBalanceReady: boolean };
}

const statusStyles: Record<CheckStatus, string> = {
  ready: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  blocked: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  unknown: 'text-slate-300 bg-slate-500/10 border-slate-500/20'
};

export default function AgentWalletModal({ isOpen, onClose }: AgentWalletModalProps) {
  const [readiness, setReadiness] = useState<MetaMaskReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  // The token path gets its OWN loading flag: the browser-connect flow holds
  // `loading` true for up to 5 min while it polls, which must not disable the
  // token Connect button — the two paths are alternatives, not a sequence.
  const [tokenLoading, setTokenLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [connected, setConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | undefined>(undefined);
  const [connectPolling, setConnectPolling] = useState(false);
  // Cancels the 5-minute connect poll. Held in a ref because startConnect() runs
  // outside React's render cycle and must reach the live controller, not a stale
  // closure over one.
  const pollAbortRef = useRef<AbortController | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | undefined>(undefined);
  const [tokenInput, setTokenInput] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [copied, setCopied] = useState(false);

  // --- Bank (everyday MetaMask) state ---
  const [bank, setBank] = useState<BankConnection | null>(null);
  const [bankConnecting, setBankConnecting] = useState(false);
  const [bankError, setBankError] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const [fundNote, setFundNote] = useState('');
  const fundBtnRef = useRef<HTMLButtonElement>(null);

  const paperMode = readiness?.liveModeGlobalLock ?? true;
  const readyCount = useMemo(
    () => readiness?.checks.filter((c) => c.status === 'ready').length ?? 0,
    [readiness]
  );
  const totalChecks = readiness?.checks.length ?? 0;

  async function loadReadiness() {
    try {
      const res = await apiFetch('/api/mm/readiness');
      const data = await safeJson(res);
      if (res.ok) setReadiness(data);
    } catch {
      /* readiness stays unknown */
    }
  }

  // A sleep that wakes early when the poll is cancelled, so closing the modal
  // stops it now rather than up to six seconds later.
  function sleep(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      const done = () => { clearTimeout(t); signal.removeEventListener('abort', done); resolve(); };
      const t = setTimeout(done, ms);
      signal.addEventListener('abort', done, { once: true });
    });
  }

  async function checkStatus(signal?: AbortSignal) {
    try {
      const res = await apiFetch('/api/mm/connect/status', signal ? { signal } : undefined);
      const s = await safeJson(res);
      if (signal?.aborted) return false;
      setConnected(!!s.connected);
      setConnectedAddress(s.address || undefined);
      return !!s.connected;
    } catch {
      return false;
    }
  }

  // Agent Wallet connect: fetch a MetaMask sign-in link, SHOW it as a link the
  // user clicks themselves (popup blockers eat window.open after an await). The
  // sign-in page hands them a CLI token; pasting it below completes the login.
  async function startConnect() {
    // This loop ran for five minutes with no way to stop it. Closing the modal
    // left it polling /api/mm/connect/status — which spawns a CLI process on the
    // server — 50 times, then calling finishConnect() and setState on a component
    // the user had walked away from. Now the modal's close and unmount both abort
    // it. (Since the wallet rate limiter actually works again, an orphaned poll
    // would also spend the user's own /api/mm/* budget and 429 their next action.)
    pollAbortRef.current?.abort();
    const ctrl = new AbortController();
    pollAbortRef.current = ctrl;
    const { signal } = ctrl;

    try {
      setLoading(true);
      setMessage('');
      const res = await apiFetch('/api/mm/connect/start', { method: 'POST', signal });
      const data = await safeJson(res);
      if (signal.aborted) return;
      if (!res.ok || !data.loginUrl) throw new Error(data.message || 'Could not start MetaMask login. Try again in a few seconds.');
      setLoginUrl(data.loginUrl);
      setConnectPolling(true);
      // Some sign-in methods complete the server session directly; poll quietly
      // in case they do, but the token paste below is the reliable completion.
      for (let i = 0; i < 50 && !signal.aborted; i++) {
        await sleep(6000, signal);
        if (signal.aborted) return;
        if (await checkStatus(signal)) {
          if (signal.aborted) return;
          setLoginUrl(undefined);
          await finishConnect();
          return;
        }
      }
    } catch (error: any) {
      if (signal.aborted || error?.name === 'AbortError') return;
      setMessage(error.message || 'Could not start MetaMask login.');
    } finally {
      // Never write state for a poll the user already dismissed.
      if (!signal.aborted) {
        setConnectPolling(false);
        setLoading(false);
      }
    }
  }

  // Complete the sign-in with the CLI token MetaMask showed the user. Used once
  // server-side and never stored.
  async function connectWithToken() {
    if (!tokenInput.trim()) return;
    try {
      setTokenLoading(true);
      setMessage('');
      const res = await apiFetch('/api/mm/connect/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() })
      });
      const data = await safeJson(res);
      if (!res.ok || !data.connected) throw new Error(data.message || data.error || 'Token login failed.');
      setTokenInput('');
      setConnected(true);
      setConnectedAddress(data.address || undefined);
      await finishConnect();
    } catch (error: any) {
      setMessage(error.message || 'Token login failed.');
    } finally {
      setTokenLoading(false);
    }
  }

  async function finishConnect() {
    setMessage('Agent Wallet connected — you can now compete in the Arena.');
    // Milestone: your executor is live. A radial indigo pulse marks it.
    spark({ palette: 'indigo', direction: 'radial', count: 32 });
    window.dispatchEvent(new Event('wallet-connected'));
    await loadReadiness();
  }

  async function disconnectWallet() {
    try {
      setLoading(true);
      const res = await apiFetch('/api/mm/connect/disconnect', { method: 'POST' });
      // The response was ignored, so a FAILED disconnect still cleared local state:
      // the UI read "disconnected" while the server kept the wallet attached.
      const d = await safeJson<{ error?: string }>(res);
      if (!res.ok) {
        setMessage(d.error || 'Could not disconnect the wallet.');
        return;
      }
      setConnected(false);
      setConnectedAddress(undefined);
      setMessage('');
      window.dispatchEvent(new Event('wallet-connected'));
      await loadReadiness();
    } finally {
      setLoading(false);
    }
  }

  // --- Bank actions (the user's own MetaMask extension) ---
  async function handleConnectBank() {
    try {
      setBankConnecting(true);
      setBankError('');
      setBank(await connectBank());
    } catch (e: any) {
      setBankError(e?.message || 'Could not connect MetaMask.');
    } finally {
      setBankConnecting(false);
    }
  }

  async function handleFund() {
    if (!bank || !connectedAddress) return;
    try {
      setFunding(true);
      setBankError('');
      setFundNote('');
      const tx = await fundAgentWallet(bank.address, connectedAddress, fundAmount, bank.chainId);
      setFundNote(`Funding sent — tx ${String(tx).slice(0, 10)}…`);
      // Real value moved on-chain — a gold puff from the Fund button.
      spark({ origin: originOf(fundBtnRef.current), palette: 'gold', count: 26 });
      setFundAmount('');
      // Balance will drop once it confirms; refresh shortly.
      setTimeout(async () => {
        try { setBank((b) => (b ? { ...b, balanceEth: '…' } : b)); const bal = await refreshBalance(bank.address); setBank((b) => (b ? { ...b, balanceEth: bal, chainId: BASE_CHAIN_ID_HEX } : b)); } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) {
      setBankError(e?.message || 'Funding failed.');
    } finally {
      setFunding(false);
    }
  }

  function copyAgentAddress() {
    if (!connectedAddress) return;
    navigator.clipboard?.writeText(connectedAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard blocked; ignore */ });
  }

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      checkStatus();
      loadReadiness();
    } else {
      // Closed mid-poll: stop immediately. `isOpen` false returns null below, so
      // the component stays mounted and the loop would otherwise keep running.
      pollAbortRef.current?.abort();
      setConnectPolling(false);
      setLoading(false);
    }
  }, [isOpen]);

  // Unmount is the other exit the loop never had.
  useEffect(() => () => pollAbortRef.current?.abort(), []);

  if (!isOpen) return null;

  const shortAddr = connectedAddress ? `${connectedAddress.slice(0, 6)}…${connectedAddress.slice(-4)}` : null;
  const bankShort = bank ? `${bank.address.slice(0, 6)}…${bank.address.slice(-4)}` : null;
  const onBase = bank?.chainId === BASE_CHAIN_ID_HEX;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
        >
          <div className="flex justify-between items-center p-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Your MetaMask, two ways</h3>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
            <p className="text-sm text-slate-400 leading-relaxed">
              MetaEdge uses two MetaMask wallets that work together. Connect your <span className="text-white font-semibold">Agent Wallet</span> to compete, and your everyday <span className="text-white font-semibold">MetaMask Wallet</span> to hold and fund it.
            </p>

            {/* ============ ZONE 1: AGENT WALLET (the executor) ============ */}
            <div className="border border-orange-500/25 bg-orange-500/[0.04] rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Agent Wallet — your executor</div>
                  <div className="text-xs text-slate-400">The wallet your agents trade with. Required to compete in the Agent Arena.</div>
                </div>
              </div>

              {!connected ? (
                <>
                  {!loginUrl ? (
                    <button
                      onClick={startConnect}
                      disabled={loading || connectPolling}
                      className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
                    >
                      {loading || connectPolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      {loading || connectPolling ? 'Getting your sign-in link…' : 'Open MetaMask sign-in'}
                    </button>
                  ) : (
                    <a
                      href={loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
                    >
                      <ExternalLink className="w-4 h-4" /> Open MetaMask sign-in ↗
                    </a>
                  )}

                  <div className="text-xs text-slate-400 leading-relaxed">
                    <span className="text-slate-300 font-semibold">Then:</span> sign in on that page, copy the <span className="text-slate-200">CLI token</span> it shows you, and paste it here to finish.
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste your CLI token (used once, never stored)"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-orange-500/50 focus:outline-none"
                    />
                    <button
                      onClick={connectWithToken}
                      disabled={tokenLoading || !tokenInput.trim()}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {tokenLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {tokenLoading ? 'Connecting…' : 'Connect'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                      <ShieldCheck className="w-4 h-4" /> Agent Wallet connected
                    </div>
                    <button onClick={disconnectWallet} disabled={loading} className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50">
                      Disconnect
                    </button>
                  </div>
                  {connectedAddress && (
                    <button
                      onClick={copyAgentAddress}
                      title="Copy full address"
                      className="w-full text-left bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2 hover:border-emerald-700/50 transition-colors group"
                    >
                      <span className="text-[13px] text-white font-mono break-all">{connectedAddress}</span>
                      {copied ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <Copy className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0" />}
                    </button>
                  )}
                  <div className="text-xs text-slate-400">{paperMode ? 'Paper mode — trades simulate, standings are real' : 'LIVE mode — real execution'}</div>
                </div>
              )}
            </div>

            {/* ============ ZONE 2: METAMASK WALLET (the bank) ============ */}
            <div className="border border-blue-500/20 bg-blue-500/[0.04] rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <Landmark className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">MetaMask Wallet — your bank</div>
                  <div className="text-xs text-slate-400">Your everyday wallet. See your balance and top up your Agent Wallet when you go Live.</div>
                </div>
              </div>

              {!bank ? (
                <button
                  onClick={handleConnectBank}
                  disabled={bankConnecting}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {bankConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                  {bankConnecting ? 'Check MetaMask…' : hasMetaMask() ? 'Connect MetaMask Wallet' : 'Install MetaMask to connect'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white font-mono">{bankShort}</div>
                      <div className="text-xs text-slate-400">Balance: <span className="text-slate-200 font-mono">{bank.balanceEth} ETH</span>{!onBase && <span className="text-amber-400"> · not on Base</span>}</div>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                  </div>

                  {/* Funding: real transfer, so it's gated to Live mode. */}
                  {!connected ? (
                    <p className="text-xs text-slate-500">Connect your Agent Wallet above to get a fund destination.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Fund destination (your Agent Wallet)</span>
                        <button onClick={copyAgentAddress} className="flex items-center gap-1 text-slate-400 hover:text-slate-200">
                          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span className="font-mono">{shortAddr}</span>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="Amount in ETH"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(e.target.value)}
                          disabled={paperMode}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
                        />
                        <button
                          ref={fundBtnRef}
                          onClick={handleFund}
                          disabled={paperMode || funding || !fundAmount.trim()}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {funding && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          {funding ? 'Sending…' : 'Fund'}
                        </button>
                      </div>
                      {paperMode
                        ? <p className="text-[11px] text-slate-500">Everything's in paper mode right now — real funding unlocks when you switch to Live. No need to move real ETH to play.</p>
                        : <p className="text-[11px] text-slate-500">This sends real ETH on Base from your MetaMask. You approve it in the MetaMask popup.</p>}
                      {fundNote && <p className="text-[11px] text-emerald-300">{fundNote}</p>}
                    </div>
                  )}
                </div>
              )}

              {bankError && (
                <div className="text-[11px] text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {bankError}
                </div>
              )}
            </div>

            {message && (
              <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-3 flex items-start gap-2 text-amber-200 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{message}</div>
              </div>
            )}

            {/* Account management: all wallets under this account. */}
            {connected && (
              <WalletsPanel onActiveChanged={(addr) => setConnectedAddress(addr)} />
            )}

            {/* Go-Live checklist, collapsed by default. */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowChecklist(!showChecklist)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-950/60 hover:bg-slate-950 transition-colors"
              >
                <span className="text-sm font-bold text-slate-200">Go-Live checklist</span>
                <span className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  {totalChecks ? `${readyCount}/${totalChecks} ready` : '…'}
                  {showChecklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>
              {showChecklist && (
                <div className="divide-y divide-slate-800/60">
                  {readiness?.checks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{check.label}</p>
                        <p className="text-[11px] text-slate-500">{check.summary}</p>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${statusStyles[check.status]}`}>
                        {check.status === 'ready' ? 'Ready' : 'Not yet'}
                      </span>
                    </div>
                  ))}
                  {!readiness && <div className="px-4 py-3 text-xs text-slate-500">Checking…</div>}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Trade in the Trading Desk, bet in Predictions, compete in the Arena — everything runs on your Agent Wallet once connected. No keys or secrets ever touch MetaEdge; your MetaMask signs everything itself.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
