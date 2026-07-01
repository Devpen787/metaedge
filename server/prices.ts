import { Router } from 'express';

export const pricesRouter = Router();

// Simulated real-time token prices stored in server-side state
export const serverPrices: Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number; marketCap: number; supply: string; name: string; description: string }> = {
  BTC: { price: 96420.50, change24h: 3.42, high24h: 97100.00, low24h: 92850.00, volume24h: 42150000000, marketCap: 1890000000000, supply: '19.6M / 21M', name: 'Bitcoin', description: "The world's first decentralized digital currency. Bitcoin operates as a sovereign store of value and digital gold." },
  ETH: { price: 3125.20, change24h: -1.15, high24h: 3220.00, low24h: 3090.50, volume24h: 18450000000, marketCap: 375000000000, supply: '120.1M', name: 'Ethereum', description: "A decentralized, open-source blockchain with smart contract functionality. Ether is the native fuel powering the EVM." },
  SOL: { price: 184.80, change24h: 8.76, high24h: 189.50, low24h: 168.40, volume24h: 4890000000, marketCap: 83000000000, supply: '446.2M', name: 'Solana', description: "A high-performance blockchain supporting builders globally. Solana uses proof-of-history to facilitate sub-second processing speeds." },
  LINK: { price: 16.15, change24h: 0.54, high24h: 16.70, low24h: 15.85, volume24h: 890000000, marketCap: 9500000000, supply: '587M / 1B', name: 'Chainlink', description: "A decentralized oracle network providing real-world data feeds to smart contracts across multiple host blockchains." },
  DOGE: { price: 0.285, change24h: 14.25, high24h: 0.31, low24h: 0.24, volume24h: 2150000000, marketCap: 41000000000, supply: '144B', name: 'Dogecoin', description: "The original decentralized open-source meme coin. Dogecoin relies on rapid mining and supportive cooperative communities." },
  BNB: { price: 600.00, change24h: 1.5, high24h: 610.00, low24h: 590.00, volume24h: 1200000000, marketCap: 90000000000, supply: '147M', name: 'BNB', description: "The native cryptocurrency of the Binance ecosystem." },
  XRP: { price: 0.55, change24h: 2.1, high24h: 0.56, low24h: 0.53, volume24h: 1500000000, marketCap: 30000000000, supply: '55B', name: 'XRP', description: "A digital asset built for global payments." },
  ADA: { price: 0.45, change24h: 0.5, high24h: 0.46, low24h: 0.44, volume24h: 400000000, marketCap: 15000000000, supply: '35B', name: 'Cardano', description: "A proof-of-stake blockchain platform that says its goal is to allow 'changemakers, innovators and visionaries' to bring about positive global change." },
  AVAX: { price: 35.00, change24h: 4.2, high24h: 36.50, low24h: 33.00, volume24h: 600000000, marketCap: 13000000000, supply: '377M', name: 'Avalanche', description: "A smart contracts platform built to scale infinitely and finalize transactions in under a second." },
  DOT: { price: 6.50, change24h: 1.2, high24h: 6.70, low24h: 6.40, volume24h: 250000000, marketCap: 8000000000, supply: '1.4B', name: 'Polkadot', description: "An open-source sharded multichain protocol that connects and secures a network of specialized blockchains." },
  MATIC: { price: 0.65, change24h: -0.5, high24h: 0.68, low24h: 0.64, volume24h: 300000000, marketCap: 6000000000, supply: '9.8B', name: 'Polygon', description: "The first well-structured, easy-to-use platform for Ethereum scaling and infrastructure development." },
};

const BINANCE_SYMBOLS: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', LINK: 'LINKUSDT', DOGE: 'DOGEUSDT', 
  BNB: 'BNBUSDT', XRP: 'XRPUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT', DOT: 'DOTUSDT', MATIC: 'MATICUSDT'
};

let lastBinanceFetch = 0;

// Periodically update serverPrices slightly to simulate real-time price changes, and fetch from Binance occasionally
setInterval(async () => {
  const now = Date.now();
  if (now - lastBinanceFetch > 10000) { // Fetch every 10 seconds
    try {
      const symbolsStr = JSON.stringify(Object.values(BINANCE_SYMBOLS));
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsStr}`);
      if (res.ok) {
        const data = await res.json();
        data.forEach((ticker: any) => {
          const symbol = Object.keys(BINANCE_SYMBOLS).find(k => BINANCE_SYMBOLS[k] === ticker.symbol);
          if (symbol && serverPrices[symbol]) {
            serverPrices[symbol].price = parseFloat(ticker.lastPrice);
            serverPrices[symbol].change24h = parseFloat(ticker.priceChangePercent);
            serverPrices[symbol].high24h = parseFloat(ticker.highPrice);
            serverPrices[symbol].low24h = parseFloat(ticker.lowPrice);
            serverPrices[symbol].volume24h = parseFloat(ticker.quoteVolume);
          }
        });
        lastBinanceFetch = now;
        return; // Skip simulation if we just fetched
      }
    } catch (e) {
      console.error('Failed to fetch from Binance, falling back to simulation', e);
    }
  }

  // Fallback / in-between simulation
  Object.keys(serverPrices).forEach(symbol => {
    const changePercent = (Math.random() - 0.48) * 0.002; // slight upward bias
    const oldPrice = serverPrices[symbol].price;
    const newPrice = Number((oldPrice * (1 + changePercent)).toFixed(symbol === 'DOGE' || symbol === 'XRP' || symbol === 'ADA' || symbol === 'MATIC' ? 4 : 2));
    serverPrices[symbol].price = newPrice;
    serverPrices[symbol].high24h = Math.max(serverPrices[symbol].high24h, newPrice);
    serverPrices[symbol].low24h = Math.min(serverPrices[symbol].low24h, newPrice);
    serverPrices[symbol].change24h = Number((serverPrices[symbol].change24h + changePercent * 100).toFixed(2));
  });
}, 3000);

// Wrapped/native aliases map onto the arena's spot price universe so a swap into
// WETH is scored as ETH, etc. Anything not here (e.g. stablecoins) has no spot
// price and is not scored in the arena.
export const SYMBOL_ALIAS: Record<string, string> = {
  WETH: 'ETH', WBTC: 'BTC', WSOL: 'SOL', WMATIC: 'MATIC', WBNB: 'BNB'
};

export function arenaSymbol(sym: string): string {
  const s = (sym || '').toUpperCase();
  return SYMBOL_ALIAS[s] || s;
}

// The single, consistent price universe the Agent Arena marks positions against.
// Returns null for tokens we don't price (so they simply aren't scored).
export function getSpotPrice(sym: string): number | null {
  const entry = serverPrices[arenaSymbol(sym)];
  return entry ? entry.price : null;
}

// --- PRICES ENDPOINT ---
pricesRouter.get('/api/prices', (req, res) => {
  res.json({ success: true, prices: serverPrices });
});
