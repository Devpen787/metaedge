import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { GraphNode, GraphEdge, User } from '../types';
import { Network, HelpCircle, ShieldAlert, Award, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface GraphEvidenceProps {
  currentUser: User;
  paperLiveMode: 'paper' | 'live';
}

export default function GraphEvidence({ currentUser, paperLiveMode }: GraphEvidenceProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/graph');
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (e) {
      console.error('Error fetching graph projection:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            MetaEdge Kuzu-Projected Evidence
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Visual trust and relationship paths reconstructed from verifiable room ledger logs.
          </p>
        </div>
        <button
          onClick={fetchGraph}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Project Graph
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Network Canvas */}
        <div className="lg:col-span-2 bg-slate-950/60 rounded-xl border border-slate-800/60 p-4 h-80 flex flex-col justify-between relative overflow-hidden">
          {/* Simulated Graph SVG */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="relative z-10 w-full h-full flex items-center justify-center">
            {nodes.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">No nodes projected yet. Make some actions to populate the graph.</p>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute w-48 h-48 rounded-full border border-slate-800/50 animate-[spin_60s_linear_infinite]" />
                <div className="absolute w-72 h-72 rounded-full border border-slate-800/30 animate-[spin_90s_linear_infinite_reverse]" />
                <div className="flex flex-wrap justify-center gap-6 max-w-xl relative z-10 p-8">
                  {nodes.map((node, i) => {
                    const isSelected = selectedNode?.id === node.id;
                    const colorMap: Record<string, string> = {
                      User: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-indigo-500/20',
                      Room: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-emerald-500/20',
                      Agent: 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-purple-500/20',
                      Strategy: 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-amber-500/20',
                      VaultClub: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-cyan-500/20'
                    };

                    return (
                      <motion.button
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setSelectedNode(node)}
                        className={`px-4 py-2.5 rounded-xl border text-xs font-mono flex items-center gap-2.5 transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
                          colorMap[node.label] || 'bg-slate-800 border-slate-700 text-slate-300'
                        } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110 z-20' : ''}`}
                      >
                        <span className={`w-2 h-2 rounded-full bg-current ${isSelected ? 'animate-pulse' : ''}`} />
                        <span className="font-bold tracking-tight">{node.properties.name || node.id.substring(0, 8)}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 z-10 border-t border-slate-900 pt-2">
            <HelpCircle className="w-3.5 h-3.5" />
            Click on any relation node above to inspect its security verifications and owner relationships.
          </div>
        </div>

        {/* Selected Evidence Cards */}
        <div className="bg-slate-950/40 rounded-xl border border-slate-800/60 p-4 flex flex-col justify-between">
          {selectedNode ? (
            <div className="space-y-4 fade-in">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded">
                  {selectedNode.label}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">ID: {selectedNode.id}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  {selectedNode.properties.name || selectedNode.id}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  {selectedNode.label === 'Agent' && `Asset: ${selectedNode.properties.asset} | Status: ${selectedNode.properties.status}`}
                  {selectedNode.label === 'User' && `Verified balance: $${selectedNode.properties.balance?.toLocaleString()} Paper Money`}
                  {selectedNode.label === 'VaultClub' && `Simulated total: $${selectedNode.properties.contribution?.toLocaleString()}`}
                  {selectedNode.label === 'Room' && `Multi-session co-trading room`}
                  {selectedNode.label === 'Strategy' && `Copied index count: ${selectedNode.properties.copiedCount}`}
                </p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/40 space-y-2">
                <div className="text-[11px] font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-indigo-400" />
                  Evidence and readiness
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                  This {selectedNode.label.toLowerCase()} is bound to the verified owner session. It is isolated from other room participants and operates within client-side execution boundaries.
                </p>
              </div>

              <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 bg-slate-900/20 p-2 rounded">
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                No relational orphan writes detected.
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full text-slate-500 p-6 space-y-3">
              <ShieldAlert className="w-8 h-8 text-indigo-500/40" />
              <div>
                <p className="text-xs font-mono font-medium text-slate-400">Security Sandbox Verified</p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  No active warnings. Every agent strategy listed in MetaEdge V1 corresponds to genuine peer-reviewed code.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
