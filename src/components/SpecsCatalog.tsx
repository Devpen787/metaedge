import React from 'react';
import { LayoutGrid, ShieldAlert, Award, FileSpreadsheet, Activity, ChevronRight, CheckCircle, HelpCircle } from 'lucide-react';

export default function SpecsCatalog() {
  const userStories = [
    { id: 'US-01', name: 'Anonymous Session Handshake', desc: 'Secure local-session synchronization to bypass browser standard iframe third-party cookie restrictions.', status: 'COMPLETED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'US-02', name: 'Sovereign Faucet Minting', desc: 'Sovereign claims of up to $10,000 simulated USD in paper funds to kickstart bots and active prediction pools.', status: 'COMPLETED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'US-03', name: 'Bot Assembly & Custom Agent Workshop', desc: 'Creation, strategy configuration, and status manipulation of autonomous AI trading bots.', status: 'COMPLETED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'US-04', name: 'Joint Cooperative Rooms Sync', desc: 'Collaborative rooms where multiple traders can join, sync strategies, and invite peers.', status: 'COMPLETED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'US-05', name: 'Self-Audit Ledger Logging', desc: 'Atomic verification ledger capturing every trade, strategy copy, and mode toggle securely.', status: 'COMPLETED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'US-06', name: 'High-Leverage Perp & Spot Hub', desc: 'Multi-leverage perpetual options (1x-50x) with real-time mark-to-market valuations and liqudation pricing.', status: 'COMPLETED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'US-07', name: 'Decentralized Binary Prediction Pools', desc: 'Binary option markets backed by Yes/No shares, volume meters, and automated winner pay-outs.', status: 'COMPLETED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'US-08', name: 'Evidence Map Projection', desc: 'Live network knowledge graph displaying node connections between users, rooms, strategies, and clubs.', status: 'COMPLETED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
  ];

  const designTokens = [
    { name: 'Primary Canvas', value: '#060813 (Deep Cosmic Slate)', desc: 'Provides optimal high contrast dark background for readable trading tickers.' },
    { name: 'Accent Primary', value: 'indigo-500 (#6366f1)', desc: 'Represents verified cryptography operations, systems, and structures.' },
    { name: 'Accent Positive', value: 'emerald-400 (#34d399)', desc: 'Highlights bullish moves, trade entries, active states, and faucet gains.' },
    { name: 'Accent Warning/Stop', value: 'rose-400 (#f87171)', desc: 'Marks liquidated positions, high leverage alerts, or locked live pathways.' },
    { name: 'Typography Family', value: 'Inter / JetBrains Mono', desc: 'Sans-serif Inter for general labels; monospace JetBrains for live ledger telemetry.' }
  ];

  const featureTools = [
    { feat: 'Interactive Room Joiner', tool: 'Invite Tokens generator', tech: 'Atomically synced session storage + Express routing' },
    { feat: 'Active Faucet', tool: 'Minter proxy', tech: 'Sovereign claim counters limited to 10 claims max' },
    { feat: 'Agent Customizer', tool: 'Modular strategy template', tech: 'Cloning engine with cross-referencing audit maps' },
    { feat: 'Perps Simulator', tool: 'Dynamic Margin Slider', tech: 'Underlying constant-spread markup tracker with margin locks' },
    { feat: 'Binary Predict Markets', tool: 'Automated Pool Resolver', tech: 'Proportional Yes/No shares formula backed by local session ledger' },
    { feat: 'Knowledge Graph Projector', tool: 'Network visualizer', tech: 'Custom dynamic SVG topology mapping with node/edge lookups' }
  ];

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 mb-2">
          <Award className="w-5 h-5 text-indigo-400" />
          MetaEdge V1 Operational Specification Hub
        </h3>
        <p className="text-xs text-slate-400 font-mono leading-relaxed mb-6">
          System blueprint catalog displaying interactive design tokens, integrated tools alignment, and real-time user story status tracking.
        </p>

        {/* System User Stories Tracking */}
        <div className="mb-8">
          <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-indigo-500 rounded-full"></span>
            User Stories & Operational Status
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userStories.map((us) => (
              <div key={us.id} className="bg-slate-950/40 border border-slate-900/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold font-mono text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                      {us.id}
                    </span>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${us.color}`}>
                      {us.status}
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-slate-200 mt-1 font-mono">{us.name}</h5>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed font-mono">{us.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Design System Tokens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-800/60">
          <div>
            <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
              Core Design System Tokens
            </h4>
            <div className="space-y-3">
              {designTokens.map((token, i) => (
                <div key={i} className="bg-slate-950/20 border border-slate-900/60 rounded-xl p-3 flex justify-between items-start font-mono text-xs">
                  <div>
                    <div className="text-slate-400 font-bold">{token.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{token.desc}</div>
                  </div>
                  <div className="text-right">
                    <span className="bg-slate-900 text-slate-300 text-xs px-2 py-1 rounded font-bold border border-slate-800">
                      {token.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature-Tool Matrix */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-rose-500 rounded-full"></span>
              Modular Features & Tools Match
            </h4>
            <div className="space-y-3">
              {featureTools.map((ft, i) => (
                <div key={i} className="bg-slate-950/20 border border-slate-900/60 rounded-xl p-3 flex flex-col justify-center font-mono text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-300 font-bold">{ft.feat}</span>
                    <span className="text-indigo-400 text-xs uppercase font-bold">{ft.tool}</span>
                  </div>
                  <div className="text-xs text-slate-500 leading-normal">{ft.tech}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
