import { contentHash } from './store.js';
import { FastPerpEvidenceStore } from './fast_perp_store.js';
import { legacyWritersEnabled } from '../v5/authority.js';
import type {
  FastPerpBookEvent,
  FastPerpBookLevel,
  FastPerpContextEvent,
  FastPerpGap,
  FastPerpRecorderStatus,
  FastPerpSourceSession,
  FastPerpTradeEvent,
  FastPerpUniverseMember,
} from './fast_perp_types.js';

const SOURCE_VERSION = 'hyperliquid-websocket-v1' as const;
const WS_URL = 'wss://api.hyperliquid.xyz/ws';

export interface SocketLike {
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: any) => void): void;
  send(data: string): void;
  close(): void;
}

export type SocketFactory = (url: string) => SocketLike;

function numeric(value: unknown): number | null {
  const number = Number(value); return Number.isFinite(number) ? number : null;
}

function level(row: any): FastPerpBookLevel | null {
  const price = numeric(row?.px); const size = numeric(row?.sz); const orders = numeric(row?.n);
  return price != null && price > 0 && size != null && size >= 0
    ? { price, size, orders: orders != null && orders >= 0 ? Math.floor(orders) : 0 } : null;
}

export function selectFastPerpUniverse(response: unknown, options: { minimumDayNotionalVolumeUsd: number; maximumSymbols: number }): FastPerpUniverseMember[] {
  if (!Array.isArray(response) || !Array.isArray(response[0]?.universe) || !Array.isArray(response[1])) return [];
  const members = response[0].universe.flatMap((row: any, index: number) => {
    const context = response[1][index]; const dayNotionalVolumeUsd = numeric(context?.dayNtlVlm);
    const openInterest = numeric(context?.openInterest); const markPrice = numeric(context?.markPx);
    return typeof row?.name === 'string' && dayNotionalVolumeUsd != null && openInterest != null && markPrice != null && markPrice > 0
      ? [{ symbol: row.name, dayNotionalVolumeUsd, openInterest, markPrice }] : [];
  });
  return members.filter((row: FastPerpUniverseMember) => row.dayNotionalVolumeUsd >= options.minimumDayNotionalVolumeUsd)
    .sort((left: FastPerpUniverseMember, right: FastPerpUniverseMember) => right.dayNotionalVolumeUsd - left.dayNotionalVolumeUsd
      || left.symbol.localeCompare(right.symbol)).slice(0, Math.max(1, options.maximumSymbols));
}

export async function fetchFastPerpUniverse(options: { minimumDayNotionalVolumeUsd: number; maximumSymbols: number },
  fetcher: typeof fetch = fetch): Promise<FastPerpUniverseMember[]> {
  const response = await fetcher('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }) });
  if (!response.ok) throw new Error(`HYPERLIQUID_UNIVERSE_HTTP_${response.status}`);
  return selectFastPerpUniverse(await response.json(), options);
}

export function parseFastPerpMessage(raw: string, receivedAt: number): {
  trades: FastPerpTradeEvent[]; books: FastPerpBookEvent[]; contexts: FastPerpContextEvent[] } {
  const message = JSON.parse(raw); const channel = message?.channel; const data = message?.data;
  if (channel === 'trades' && Array.isArray(data)) {
    const trades = data.flatMap((row: any): FastPerpTradeEvent[] => {
      const price = numeric(row?.px); const size = numeric(row?.sz); const eventTime = numeric(row?.time);
      if (typeof row?.coin !== 'string' || price == null || !(price > 0) || size == null || !(size > 0)
        || eventTime == null || eventTime > receivedAt + 5_000) return [];
      const side = row.side === 'B' ? 'buy' as const : row.side === 'A' ? 'sell' as const : null;
      if (!side) return [];
      const identity = { venue: 'hyperliquid' as const, sourceVersion: SOURCE_VERSION, symbol: row.coin, eventTime,
        tradeId: numeric(row.tid), sourceHash: typeof row.hash === 'string' ? row.hash : null, side, price, size };
      return [{ id: `fast_perp_trade_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1, ...identity,
        receivedAt, notionalUsd: price * size,
        liquidation: typeof row.liquidation === 'boolean' ? row.liquidation : null, liveExecution: 'locked' }];
    });
    return { trades, books: [], contexts: [] };
  }
  if (channel === 'l2Book' && data && typeof data === 'object') {
    const eventTime = numeric(data.time); const rawBids = Array.isArray(data.levels?.[0]) ? data.levels[0] : [];
    const rawAsks = Array.isArray(data.levels?.[1]) ? data.levels[1] : [];
    const bids = rawBids.map(level).filter((row: FastPerpBookLevel | null): row is FastPerpBookLevel => row != null).slice(0, 20);
    const asks = rawAsks.map(level).filter((row: FastPerpBookLevel | null): row is FastPerpBookLevel => row != null).slice(0, 20);
    if (typeof data.coin !== 'string' || eventTime == null || eventTime > receivedAt + 5_000 || !bids.length || !asks.length) {
      return { trades: [], books: [], contexts: [] };
    }
    const bestBid = Math.max(...bids.map((row) => row.price)); const bestAsk = Math.min(...asks.map((row) => row.price));
    if (bestAsk < bestBid) return { trades: [], books: [], contexts: [] };
    const midPrice = (bestBid + bestAsk) / 2; const spreadBps = (bestAsk - bestBid) / midPrice * 10_000;
    const bidDepthUsd = bids.reduce((sum, row) => sum + row.price * row.size, 0);
    const askDepthUsd = asks.reduce((sum, row) => sum + row.price * row.size, 0);
    const imbalance = bidDepthUsd + askDepthUsd > 0 ? (bidDepthUsd - askDepthUsd) / (bidDepthUsd + askDepthUsd) : 0;
    const identity = { venue: 'hyperliquid' as const, sourceVersion: SOURCE_VERSION, symbol: data.coin, eventTime,
      bestBid, bestAsk, bidDepthUsd, askDepthUsd, bids, asks };
    return { trades: [], books: [{ id: `fast_perp_book_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
      ...identity, receivedAt, bids, asks, midPrice, spreadBps, imbalance, liveExecution: 'locked' }], contexts: [] };
  }
  if (channel === 'activeAssetCtx' && data && typeof data === 'object') {
    const ctx = data.ctx && typeof data.ctx === 'object' ? data.ctx : data;
    const symbol = typeof data.coin === 'string' ? data.coin : typeof ctx.coin === 'string' ? ctx.coin : null;
    const fundingRate = numeric(ctx.funding); const openInterest = numeric(ctx.openInterest);
    const markPrice = numeric(ctx.markPx); const oraclePrice = numeric(ctx.oraclePx); const premium = numeric(ctx.premium);
    const eventTime = numeric(ctx.time) ?? receivedAt;
    if (symbol && fundingRate != null && openInterest != null && openInterest >= 0 && markPrice != null && markPrice > 0
      && oraclePrice != null && oraclePrice > 0 && eventTime <= receivedAt + 5_000) {
      const identity = { venue: 'hyperliquid' as const, sourceVersion: SOURCE_VERSION, symbol, eventTime,
        fundingRate, openInterest, markPrice, oraclePrice, premium };
      return { trades: [], books: [], contexts: [{ id: `fast_perp_context_${contentHash(identity).slice(0, 20)}`,
        schemaVersion: 1, ...identity, receivedAt, liveExecution: 'locked' }] };
    }
  }
  return { trades: [], books: [], contexts: [] };
}

export class FastPerpRecorder {
  private readonly evidenceStore: FastPerpEvidenceStore;
  private socket: SocketLike | null = null;
  private running = false;
  private connected = false;
  private symbols: string[] = [];
  private reconnectAttempt = 0;
  private lastMessageAt: number | null = null;
  private startedAt: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: {
    store?: FastPerpEvidenceStore;
    storeFactory?: () => FastPerpEvidenceStore;
    socketFactory?: SocketFactory;
    universe?: () => Promise<FastPerpUniverseMember[]>;
    now?: () => number;
    schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
    cancel?: (timer: ReturnType<typeof setTimeout>) => void;
    baseReconnectMs?: number;
    maximumReconnectMs?: number;
  } = {}) {
    this.evidenceStore = options.store ?? options.storeFactory?.() ?? new FastPerpEvidenceStore();
  }

  private get store(): FastPerpEvidenceStore { return this.evidenceStore; }
  private now(): number { return (this.options.now ?? Date.now)(); }
  private session(status: FastPerpSourceSession['status']): FastPerpSourceSession {
    const base = { venue: 'hyperliquid' as const, sourceVersion: SOURCE_VERSION, status, at: this.now(),
      symbols: [...this.symbols].sort(), reconnectAttempt: this.reconnectAttempt, liveExecution: 'locked' as const };
    return { id: `fast_perp_session_${contentHash(base).slice(0, 20)}`, schemaVersion: 1, ...base };
  }
  private gap(kind: FastPerpGap['kind'], reason: string, raw: string | null = null): FastPerpGap {
    const base = { venue: 'hyperliquid' as const, sourceVersion: SOURCE_VERSION, detectedAt: this.now(), kind,
      reason, symbol: null, rawHash: raw == null ? null : contentHash(raw), liveExecution: 'locked' as const };
    return { id: `fast_perp_gap_${contentHash(base).slice(0, 20)}`, schemaVersion: 1, ...base };
  }
  status(): FastPerpRecorderStatus {
    return { running: this.running, connected: this.connected, symbols: [...this.symbols],
      reconnectAttempt: this.reconnectAttempt, lastMessageAt: this.lastMessageAt, startedAt: this.startedAt,
      sourceVersion: SOURCE_VERSION, liveExecution: 'locked' };
  }
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true; this.startedAt = this.now();
    await this.connect();
  }
  stop(): void {
    this.running = false; this.connected = false;
    if (this.reconnectTimer) (this.options.cancel ?? clearTimeout)(this.reconnectTimer);
    this.reconnectTimer = null; this.socket?.close(); this.socket = null; this.store.appendSessions([this.session('stopped')]);
    this.store.close();
  }
  private async connect(): Promise<void> {
    if (!this.running) return;
    try {
      const universe = await (this.options.universe ?? (() => fetchFastPerpUniverse({ minimumDayNotionalVolumeUsd: 10_000_000,
        maximumSymbols: 20 })))();
      this.symbols = universe.map((row) => row.symbol);
      if (!this.symbols.length) throw new Error('FAST_PERP_UNIVERSE_EMPTY');
      this.store.appendSessions([this.session('connecting')]);
      const factory = this.options.socketFactory ?? ((url: string) => new WebSocket(url));
      const socket = factory(WS_URL); this.socket = socket;
      socket.addEventListener('open', () => {
        if (!this.running || socket !== this.socket) return;
        this.connected = true; this.reconnectAttempt = 0; this.store.appendSessions([this.session('connected')]);
        for (const symbol of this.symbols) {
          socket.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin: symbol } }));
          socket.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'l2Book', coin: symbol } }));
          socket.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'activeAssetCtx', coin: symbol } }));
        }
      });
      socket.addEventListener('message', (event: { data?: unknown }) => {
        if (!this.running || socket !== this.socket || typeof event.data !== 'string') return;
        const pauseRoot = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'pauses');
        if (fs.existsSync(path.join(pauseRoot, 'global.json')) || fs.existsSync(path.join(pauseRoot, 'recorder.json'))) {
          this.store.appendGaps([this.gap('stale_stream', 'RECORDER_PAUSED_BY_RECOVERY_GUARD')]); this.stop(); return;
        }
        const receivedAt = this.now();
        try {
          const parsed = parseFastPerpMessage(event.data, receivedAt);
          if (parsed.trades.length) this.store.appendTrades(parsed.trades);
          if (parsed.books.length) this.store.appendBooks(parsed.books);
          if (parsed.contexts.length) this.store.appendContexts(parsed.contexts);
          if (parsed.trades.length || parsed.books.length || parsed.contexts.length) this.lastMessageAt = receivedAt;
        } catch (error) {
          this.store.appendGaps([this.gap('malformed_message', error instanceof Error ? error.message : String(error), event.data)]);
        }
      });
      socket.addEventListener('error', () => {
        if (socket === this.socket) this.store.appendGaps([this.gap('transport', 'WEBSOCKET_ERROR')]);
      });
      socket.addEventListener('close', () => {
        if (socket !== this.socket) return;
        this.connected = false; this.socket = null; this.store.appendSessions([this.session('disconnected')]);
        if (this.running) this.scheduleReconnect();
      });
    } catch (error) {
      this.store.appendGaps([this.gap('source_unavailable', error instanceof Error ? error.message : String(error))]);
      if (this.running) this.scheduleReconnect();
    }
  }
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempt++;
    const base = this.options.baseReconnectMs ?? 1_000; const maximum = this.options.maximumReconnectMs ?? 60_000;
    const delay = Math.min(maximum, base * 2 ** Math.max(0, this.reconnectAttempt - 1));
    this.reconnectTimer = (this.options.schedule ?? setTimeout)(() => {
      this.reconnectTimer = null; void this.connect();
    }, delay) as ReturnType<typeof setTimeout>;
  }
}

let singleton: FastPerpRecorder | null = null;
export function startFastPerpRecorder(): FastPerpRecorder {
  if (!singleton) singleton = new FastPerpRecorder();
  if (process.env.FAST_PERP_RECORDER_ENABLED !== 'true') {
    console.log('[fast-perps] recorder disabled by default; set FAST_PERP_RECORDER_ENABLED=true after recovery checks');
    return singleton;
  }
  if (!legacyWritersEnabled()) {
    console.log('[fast-perps] legacy recorder writer disabled by v5 authority');
    return singleton;
  }
  void singleton.start(); return singleton;
}

export function fastPerpRecorderStatus(): FastPerpRecorderStatus {
  return singleton?.status() ?? { running: false, connected: false, symbols: [], reconnectAttempt: 0,
    lastMessageAt: null, startedAt: null, sourceVersion: SOURCE_VERSION, liveExecution: 'locked' };
}
import fs from 'node:fs';
import path from 'node:path';
