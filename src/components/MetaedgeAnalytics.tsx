import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Bot, ArrowRightLeft, TrendingUp, Activity, BarChart2, Shield, Search, Terminal, Zap, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } from 'recharts';

const METRICS_CARDS = [
  { id: 'users', label: 'Active Users', value: '14,285', change: '+12.5%', isPositive: true, icon: Users },
  { id: 'agents', label: 'Agents Deployed', value: '42,912', change: '+24.8%', isPositive: true, icon: Bot },
  { id: 'volume', label: 'Simulated Volume', value: '$845.2M', change: '+8.2%', isPositive: true, icon: ArrowRightLeft },
  { id: 'strategies', label: 'Strategy Clones', value: '8,433', change: '-2.4%', isPositive: false, icon: Zap }
];

const USER_GROWTH_DATA = [
  { name: 'Jan', users: 4000, agents: 2400 },
  { name: 'Feb', users: 5000, agents: 3500 },
  { name: 'Mar', users: 6500, agents: 5800 },
  { name: 'Apr', users: 8200, agents: 9200 },
  { name: 'May', users: 11000, agents: 15400 },
  { name: 'Jun', users: 14285, agents: 22000 },
  { name: 'Jul', users: 15800, agents: 31000 }
];

const STRATEGY_DISTRIBUTION = [
  { name: 'Arb', value: 45 },
  { name: 'Sniping', value: 25 },
  { name: 'Delta Neutral', value: 20 },
  { name: 'Perps', value: 10 }
];

const RECENT_EVENTS = [
  { id: 1, action: 'User Onboarding', detail: '0x7F...3b2 connected wallet', time: '2 mins ago', type: 'user' },
  { id: 2, action: 'Agent Deployed', detail: 'Delta Neutral strategy by 0x2A...9c1', time: '5 mins ago', type: 'agent' },
  { id: 3, action: 'High Volume', detail: 'Simulated $1.2M swap on ETH/USDC', time: '12 mins ago', type: 'trade' },
  { id: 4, action: 'Arena Match', detail: 'Global season passed $14M volume', time: '25 mins ago', type: 'arena' },
  { id: 5, action: 'Copilot Usage', detail: 'User queried "explain impermanent loss"', time: '42 mins ago', type: 'query' },
];

export default function MetaedgeAnalytics() {
  const [timeRange, setTimeRange] = useState('7D');

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 font-mono">
            <Activity className="w-6 h-6 text-indigo-500" /> MetaEdge Usage Analytics
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Platform adoption, agent activity, and simulated network metrics.
          </p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
          {['24H', '7D', '30D', 'ALL'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                timeRange === range 
                  ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS_CARDS.map((card, idx) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group hover:border-slate-700 transition-colors"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-800/30 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-400">
                  <card.icon className="w-5 h-5" />
                </div>
                <div className={`text-xs font-mono font-bold px-2 py-1 rounded ${card.isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {card.change}
                </div>
              </div>
              <h3 className="text-slate-400 text-xs font-mono uppercase mb-1">{card.label}</h3>
              <div className="text-3xl font-bold text-white">{card.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Growth Chart */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-white font-mono uppercase">User & Agent Growth</h3>
            <button className="text-xs text-indigo-400 flex items-center gap-1 hover:text-indigo-300">
              Export CSV <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={USER_GROWTH_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAgents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'monospace' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Area type="monotone" dataKey="users" name="Active Users" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
                <Area type="monotone" dataKey="agents" name="Deployed Agents" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorAgents)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feature Usage / Strategy Mix */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <h3 className="text-sm font-bold text-white font-mono uppercase mb-6">Popular Strategies</h3>
          <div className="flex-1 flex flex-col justify-center gap-6">
            {STRATEGY_DISTRIBUTION.map((strat, idx) => (
              <div key={strat.name}>
                <div className="flex justify-between items-end mb-2">
                  <div className="text-sm text-slate-300 font-medium">{strat.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{strat.value}%</div>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${strat.value}%` }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-indigo-500' :
                      idx === 1 ? 'bg-emerald-500' :
                      idx === 2 ? 'bg-yellow-500' :
                      'bg-rose-500'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl flex items-start gap-3">
            <Search className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-indigo-300 mb-1">Actionable Insight</h4>
              <p className="text-xs text-indigo-400/80 leading-relaxed">
                High demand for Arbitrage bots indicates users are seeking low-risk yields. Consider promoting the "Delta Neutral" preset on the main dashboard to drive diversification.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Event Log */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-white font-mono uppercase">Live Platform Events</h3>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
            </div>
          </div>
          <div className="space-y-4">
            {RECENT_EVENTS.map(event => (
              <div key={event.id} className="flex items-start gap-4 p-3 hover:bg-slate-800/50 rounded-xl transition-colors">
                <div className="mt-0.5">
                  {event.type === 'user' && <Users className="w-4 h-4 text-slate-400" />}
                  {event.type === 'agent' && <Bot className="w-4 h-4 text-indigo-400" />}
                  {event.type === 'trade' && <ArrowRightLeft className="w-4 h-4 text-emerald-400" />}
                  {event.type === 'arena' && <Shield className="w-4 h-4 text-yellow-400" />}
                  {event.type === 'query' && <Terminal className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-sm font-medium text-white">{event.action}</span>
                    <span className="text-xs text-slate-500 font-mono">{event.time}</span>
                  </div>
                  <div className="text-xs text-slate-400">{event.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Retention Chart */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <h3 className="text-sm font-bold text-white font-mono uppercase mb-2">Feature Adoption</h3>
          <p className="text-xs text-slate-400 mb-6">Daily active users engaging with specific platform modules.</p>
          <div className="flex-1 min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Swarm Copilot', users: 12400 },
                { name: 'Agent Arena', users: 8200 },
                { name: 'Trading Desk', users: 6500 },
                { name: 'Prediction Mkts', users: 3100 },
                { name: 'Vault Clubs', users: 1800 }
              ]} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                  cursor={{ fill: '#1e293b' }}
                />
                <Bar dataKey="users" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
