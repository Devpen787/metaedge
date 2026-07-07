import { Router } from 'express';

export const pricesRouter = Router();

// Server-side price state. Seeded with realistic values so it's sane before the
// first live fetch; then kept current from CoinGecko (which, unlike Binance,
// isn't geo-blocked on cloud IPs and needs no key). Prices are NEVER random-
// walked upward anymore — that bias is what drifted BTC to $444k.
export const serverPrices: Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number; marketCap: number; supply: string; name: string; description: string }> = {
  BTC: { price: 63089, change24h: 0.17, high24h: 63500, low24h: 62000, volume24h: 20000000000, marketCap: 1240000000000, supply: '19.6M / 21M', name: 'Bitcoin', description: "The world's first decentralized digital currency. Bitcoin operates as a sovereign store of value and digital gold." },
  ETH: { price: 1771, change24h: 0.10, high24h: 1800, low24h: 1740, volume24h: 9000000000, marketCap: 213000000000, supply: '120.1M', name: 'Ethereum', description: "A decentralized, open-source blockchain with smart contract functionality. Ether is the native fuel powering the EVM." },
  SOL: { price: 81.38, change24h: 0.94, high24h: 83, low24h: 79, volume24h: 2000000000, marketCap: 39000000000, supply: '446.2M', name: 'Solana', description: "A high-performance blockchain supporting builders globally. Solana uses proof-of-history to facilitate sub-second processing speeds." },
  LINK: { price: 7.90, change24h: -0.56, high24h: 8.1, low24h: 7.7, volume24h: 300000000, marketCap: 5000000000, supply: '587M / 1B', name: 'Chainlink', description: "A decentralized oracle network providing real-world data feeds to smart contracts across multiple host blockchains." },
  DOGE: { price: 0.0748, change24h: -2.68, high24h: 0.078, low24h: 0.073, volume24h: 500000000, marketCap: 11000000000, supply: '144B', name: 'Dogecoin', description: "The original decentralized open-source meme coin. Dogecoin relies on rapid mining and supportive cooperative communities." },
  BNB: { price: 576.97, change24h: -0.79, high24h: 585, low24h: 570, volume24h: 1000000000, marketCap: 84000000000, supply: '147M', name: 'BNB', description: "The native cryptocurrency of the Binance ecosystem." },
  XRP: { price: 1.13, change24h: -1.66, high24h: 1.16, low24h: 1.11, volume24h: 2000000000, marketCap: 64000000000, supply: '55B', name: 'XRP', description: "A digital asset built for global payments." },
  ADA: { price: 0.1791, change24h: -2.70, high24h: 0.185, low24h: 0.176, volume24h: 300000000, marketCap: 6300000000, supply: '35B', name: 'Cardano', description: "A proof-of-stake blockchain platform for changemakers, innovators and visionaries." },
  AVAX: { price: 6.74, change24h: -2.36, high24h: 6.95, low24h: 6.6, volume24h: 200000000, marketCap: 2800000000, supply: '377M', name: 'Avalanche', description: "A smart contracts platform built to scale infinitely and finalize transactions in under a second." },
  DOT: { price: 0.8617, change24h: -0.74, high24h: 0.88, low24h: 0.85, volume24h: 100000000, marketCap: 1300000000, supply: '1.4B', name: 'Polkadot', description: "An open-source sharded multichain protocol that connects and secures a network of specialized blockchains." },
  MATIC: { price: 0.20, change24h: -0.5, high24h: 0.21, low24h: 0.19, volume24h: 100000000, marketCap: 2000000000, supply: '9.8B', name: 'Polygon', description: "The first well-structured, easy-to-use platform for Ethereum scaling and infrastructure development." },
};

// Symbol → CoinGecko id.
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', LINK: 'chainlink', DOGE: 'dogecoin',
  BNB: 'binancecoin', XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche-2', DOT: 'polkadot', MATIC: 'matic-network'
};

let lastGoodFetch = 0;

async function refreshFromCoinGecko(): Promise<boolean> {
  try {
    const ids = Object.values(COINGECKO_IDS).join(',');
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`, {
      headers: { accept: 'application/json' }
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!Array.isArray(data)) return false;
    const byId: Record<string, string> = {};
    for (const [sym, id] of Object.entries(COINGECKO_IDS)) byId[id] = sym;
    let updated = 0;
    for (const c of data) {
      const sym = byId[c.id];
      if (!sym || !serverPrices[sym] || typeof c.current_price !== 'number') continue; // skip nulls/unknowns
      const p = serverPrices[sym];
      p.price = c.current_price;
      if (typeof c.price_change_percentage_24h === 'number') p.change24h = Number(c.price_change_percentage_24h.toFixed(2));
      if (typeof c.high_24h === 'number') p.high24h = c.high_24h;
      if (typeof c.low_24h === 'number') p.low24h = c.low_24h;
      if (typeof c.total_volume === 'number') p.volume24h = c.total_volume;
      if (typeof c.market_cap === 'number') p.marketCap = c.market_cap;
      updated++;
    }
    if (updated > 0) { lastGoodFetch = Date.now(); return true; }
    return false;
  } catch (e) {
    return false;
  }
}

// Fetch real prices ~every 12s. Between fetches, apply a small CENTERED jitter
// (mean 0 — no drift) for a live feel; every real fetch re-anchors to truth, so
// prices can never wander far from reality the way the old biased walk did.
refreshFromCoinGecko();
setInterval(async () => {
  const now = Date.now();
  if (now - lastGoodFetch > 12000) {
    const ok = await refreshFromCoinGecko();
    if (ok) return; // just re-anchored; skip jitter this tick
  }
  for (const symbol of Object.keys(serverPrices)) {
    const jitter = (Math.random() - 0.5) * 0.0006; // ±0.03%, unbiased
    const decimals = symbol === 'DOGE' || symbol === 'ADA' || symbol === 'MATIC' ? 4 : symbol === 'XRP' ? 4 : 2;
    const next = Number((serverPrices[symbol].price * (1 + jitter)).toFixed(decimals));
    serverPrices[symbol].price = next;
    serverPrices[symbol].high24h = Math.max(serverPrices[symbol].high24h, next);
    serverPrices[symbol].low24h = Math.min(serverPrices[symbol].low24h, next);
  }
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
