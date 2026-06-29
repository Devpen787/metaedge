import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Search, TrendingUp, TrendingDown, Clock, BarChart3, Star, Coins, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

interface TokenInfo {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  supply: string;
  description: string;
}

const INITIAL_TOKENS: Record<string, TokenInfo> = {
  BTC: { symbol: 'BTC', name: 'Bitcoin', price: 96420.50, change24h: 3.42, volume24h: 42150000000, marketCap: 1890000000000, high24h: 97100.00, low24h: 92850.00, supply: '19.6M / 21M', description: "The world's first decentralized digital currency. Bitcoin operates as a sovereign store of value and digital gold." },
  ETH: { symbol: 'ETH', name: 'Ethereum', price: 3125.20, change24h: -1.15, volume24h: 18450000000, marketCap: 375000000000, high24h: 3220.00, low24h: 3090.50, supply: '120.1M', description: "A decentralized, open-source blockchain with smart contract functionality. Ether is the native fuel powering the EVM." },
  SOL: { symbol: 'SOL', name: 'Solana', price: 184.80, change24h: 8.76, volume24h: 4890000000, marketCap: 83000000000, high24h: 189.50, low24h: 168.40, supply: '446.2M', description: "A high-performance blockchain supporting builders globally. Solana uses proof-of-history to facilitate sub-second processing speeds." },
  LINK: { symbol: 'LINK', name: 'Chainlink', price: 16.15, change24h: 0.54, volume24h: 890000000, marketCap: 9500000000, high24h: 16.70, low24h: 15.85, supply: '587M / 1B', description: "A decentralized oracle network providing real-world data feeds to smart contracts across multiple host blockchains." },
  DOGE: { symbol: 'DOGE', name: 'Dogecoin', price: 0.285, change24h: 14.25, volume24h: 2150000000, marketCap: 41000000000, high24h: 0.31, low24h: 0.24, supply: '144B', description: "The original decentralized open-source meme coin. Dogecoin relies on rapid mining and supportive cooperative communities." },
  BNB: { symbol: 'BNB', name: 'BNB', price: 600.00, change24h: 1.5, volume24h: 1200000000, marketCap: 90000000000, high24h: 610.00, low24h: 590.00, supply: '147M', description: "The native cryptocurrency of the Binance ecosystem." },
  XRP: { symbol: 'XRP', name: 'XRP', price: 0.55, change24h: 2.1, volume24h: 1500000000, marketCap: 30000000000, high24h: 0.56, low24h: 0.53, supply: '55B', description: "A digital asset built for global payments." },
  ADA: { symbol: 'ADA', name: 'Cardano', price: 0.45, change24h: 0.5, volume24h: 400000000, marketCap: 15000000000, high24h: 0.46, low24h: 0.44, supply: '35B', description: "A proof-of-stake blockchain platform that says its goal is to allow 'changemakers, innovators and visionaries' to bring about positive global change." },
  AVAX: { symbol: 'AVAX', name: 'Avalanche', price: 35.00, change24h: 4.2, volume24h: 600000000, marketCap: 13000000000, high24h: 36.50, low24h: 33.00, supply: '377M', description: "A smart contracts platform built to scale infinitely and finalize transactions in under a second." },
  DOT: { symbol: 'DOT', name: 'Polkadot', price: 6.50, change24h: 1.2, volume24h: 250000000, marketCap: 8000000000, high24h: 6.70, low24h: 6.40, supply: '1.4B', description: "An open-source sharded multichain protocol that connects and secures a network of specialized blockchains." },
  MATIC: { symbol: 'MATIC', name: 'Polygon', price: 0.65, change24h: -0.5, volume24h: 300000000, marketCap: 6000000000, high24h: 0.68, low24h: 0.64, supply: '9.8B', description: "The first well-structured, easy-to-use platform for Ethereum scaling and infrastructure development." },
};

// Generate realistic chart data based on token volatility and timeframe
function generateHistoricalData(symbol: string, timeframe: string, currentPrice: number) {
  const points = timeframe === '15m' ? 30 : timeframe === '1H' ? 60 : timeframe === '4H' ? 48 : timeframe === '24H' ? 24 : timeframe === '7D' ? 42 : timeframe === '30D' ? 30 : 60;
  const data = [];
  
  let baseChangeMap: Record<string, number> = {
    '15m': 0.002,
    '1H': 0.005,
    '4H': 0.01,
    '24H': 0.02,
    '7D': 0.08,
    '30D': 0.15,
    'All': 0.50
  };
  
  let basePrice = currentPrice * (1 - (baseChangeMap[timeframe] || 0.02));
  const now = Date.now();
  
  let stepMsMap: Record<string, number> = {
    '15m': 30 * 1000, // 30 sec steps
    '1H': 60 * 1000, // 1 min steps
    '4H': 5 * 60 * 1000, // 5 min steps
    '24H': 3600 * 1000, // 1 hour steps
    '7D': 4 * 3600 * 1000, // 4 hour steps
    '30D': 24 * 3600 * 1000, // 1 day steps
    'All': 7 * 24 * 3600 * 1000 // 1 week steps
  };
  
  const stepMs = stepMsMap[timeframe] || 3600 * 1000;

  for (let i = 0; i < points; i++) {
    const time = now - (points - i) * stepMs;
    const dateObj = new Date(time);
    
    // Random walk with upwards drift for crypto fun
    const volatility = symbol === 'DOGE' ? 0.04 : symbol === 'SOL' ? 0.025 : 0.012;
    const change = basePrice * (Math.random() - 0.46) * volatility;
    basePrice += change;
    
    // formatting labels
    let label = '';
    if (timeframe === '15m' || timeframe === '1H') {
      label = dateObj.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
    } else if (timeframe === '4H' || timeframe === '24H') {
      label = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      label = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    data.push({
      label,
      price: Number(basePrice.toFixed(symbol === 'DOGE' || symbol === 'XRP' || symbol === 'ADA' || symbol === 'MATIC' ? 4 : 2)),
      volume: Math.floor(currentPrice * (Math.random() * 5000 + 2000))
    });
  }

  // Ensure last point matches current price
  data[data.length - 1].price = currentPrice;
  return data;
}

export default function TokenMarketChart() {
  const [tokens, setTokens] = useState<Record<string, TokenInfo>>(INITIAL_TOKENS);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [timeframe, setTimeframe] = useState<'15m' | '1H' | '4H' | '24H' | '7D' | '30D' | 'All'>('7D');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartData, setChartData] = useState<any[]>([]);

  const selectedToken = tokens[selectedSymbol] || tokens.BTC;

  // Generate historical data when token or timeframe changes
  useEffect(() => {
    setChartData(generateHistoricalData(selectedSymbol, timeframe, selectedToken.price));
  }, [selectedSymbol, timeframe, selectedToken.price]);

  // Fetch real-time price updates for all tokens from server to maintain synchronized prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/prices');
        const data = await response.json();
        if (data.success && data.prices) {
          setTokens(prev => {
            const next = { ...prev };
            Object.keys(data.prices).forEach(symbol => {
              if (next[symbol]) {
                next[symbol] = {
                  ...next[symbol],
                  price: data.prices[symbol].price,
                  change24h: data.prices[symbol].change24h,
                  high24h: data.prices[symbol].high24h,
                  low24h: data.prices[symbol].low24h,
                  volume24h: data.prices[symbol].volume24h,
                  marketCap: data.prices[symbol].marketCap,
                };
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to fetch prices', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.toUpperCase().trim();
    if (tokens[query]) {
      setSelectedSymbol(query);
      setSearchQuery('');
    } else {
      // Try to match by name
      const found = (Object.values(tokens) as TokenInfo[]).find(t => t.name.toUpperCase().includes(query));
      if (found) {
        setSelectedSymbol(found.symbol);
        setSearchQuery('');
      }
    }
  };

  const isPositive = selectedToken.change24h >= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 fade-in font-mono text-xs">
      
      {/* Sidebar List and Search */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Coins className="w-4 h-4 text-indigo-400" />
            MetaEdge Market Explorer
          </h3>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol (e.g., SOL)..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-white outline-none"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </form>

          {/* List of tokens */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {(Object.values(tokens) as TokenInfo[]).map((token) => {
              const active = selectedSymbol === token.symbol;
              const pos = token.change24h >= 0;
              return (
                <div
                  key={token.symbol}
                  onClick={() => setSelectedSymbol(token.symbol)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    active
                      ? 'bg-indigo-600/10 border-indigo-500/30 shadow-md'
                      : 'bg-slate-950/40 border-slate-900/80 hover:border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-slate-900 border border-slate-800/80 rounded-lg flex items-center justify-center font-bold text-slate-200">
                      {token.symbol[0]}
                    </span>
                    <div>
                      <div className="font-bold text-slate-200">{token.symbol}</div>
                      <div className="text-[10px] text-slate-500">{token.name}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-200">${token.price.toLocaleString(undefined, { minimumFractionDigits: token.symbol === 'DOGE' ? 4 : 2 })}</div>
                    <div className={`text-[10px] font-bold flex items-center gap-0.5 justify-end ${pos ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {pos ? '+' : ''}{token.change24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected asset statistics overview */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-3.5">
          <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Asset Properties & Metrics</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{selectedToken.description}</p>
          
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/60 font-mono text-[10px] text-slate-400">
            <div>
              <span className="text-slate-500">24H High:</span>
              <div className="text-slate-200 font-bold mt-0.5">${selectedToken.high24h.toLocaleString(undefined, { minimumFractionDigits: selectedToken.symbol === 'DOGE' ? 3 : 2 })}</div>
            </div>
            <div>
              <span className="text-slate-500">24H Low:</span>
              <div className="text-slate-200 font-bold mt-0.5">${selectedToken.low24h.toLocaleString(undefined, { minimumFractionDigits: selectedToken.symbol === 'DOGE' ? 3 : 2 })}</div>
            </div>
            <div>
              <span className="text-slate-500">Market Cap:</span>
              <div className="text-slate-200 font-bold mt-0.5">${(selectedToken.marketCap / 1e9).toFixed(1)}B</div>
            </div>
            <div>
              <span className="text-slate-500">Circ. Supply:</span>
              <div className="text-slate-200 font-bold mt-0.5">{selectedToken.supply}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main interactive chart terminal */}
      <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
        
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center font-bold text-indigo-400 text-sm">
              {selectedToken.symbol}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white uppercase">{selectedToken.name} Market Feed</h2>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'}`}>
                  {isPositive ? '+' : ''}{selectedToken.change24h.toFixed(2)}%
                </span>
              </div>
              <div className="text-lg font-extrabold text-slate-200 mt-0.5">
                ${selectedToken.price.toLocaleString(undefined, { minimumFractionDigits: selectedToken.symbol === 'DOGE' ? 4 : 2 })}
              </div>
            </div>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-900 overflow-x-auto hide-scrollbar">
            {(['15m', '1H', '4H', '24H', '7D', '30D', 'All'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  timeframe === tf
                    ? 'bg-slate-900 text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Chart */}
        <div className="h-72 w-full pr-4 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorToken" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.25} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                dy={8}
                fontFamily="JetBrains Mono, ui-monospace"
              />
              <YAxis
                stroke="#64748b"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
                dx={-8}
                domain={['auto', 'auto']}
                fontFamily="JetBrains Mono, ui-monospace"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-mono text-[10px] text-slate-300 space-y-1">
                        <div>Time: <strong className="text-white">{d.label}</strong></div>
                        <div>Price: <strong className="text-indigo-400">${d.price.toLocaleString(undefined, { minimumFractionDigits: selectedSymbol === 'DOGE' ? 4 : 2 })}</strong></div>
                        <div>Vol: <strong className="text-slate-400">${d.volume.toLocaleString()}</strong></div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isPositive ? '#10b981' : '#f43f5e'}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorToken)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Live Order Book summary */}
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 grid grid-cols-2 gap-6 mt-4">
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Bid Liquidity (BUY)</div>
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between text-[10px] font-mono">
                  <span className="text-emerald-400 font-bold">${(selectedToken.price * (1 - 0.001 * i)).toLocaleString(undefined, { minimumFractionDigits: selectedToken.symbol === 'DOGE' ? 4 : 2 })}</span>
                  <span className="text-slate-400">{(Math.random() * 5 + 0.5).toFixed(2)} {selectedToken.symbol}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Ask Liquidity (SELL)</div>
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between text-[10px] font-mono">
                  <span className="text-rose-400 font-bold">${(selectedToken.price * (1 + 0.001 * i)).toLocaleString(undefined, { minimumFractionDigits: selectedToken.symbol === 'DOGE' ? 4 : 2 })}</span>
                  <span className="text-slate-400">{(Math.random() * 5 + 0.5).toFixed(2)} {selectedToken.symbol}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
