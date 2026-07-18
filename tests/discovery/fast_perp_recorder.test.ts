import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FastPerpRecorder, parseFastPerpMessage, selectFastPerpUniverse, type SocketLike } from '../../server/discovery/fast_perp_recorder.js';
import { FastPerpEvidenceStore } from '../../server/discovery/fast_perp_store.js';

class FakeSocket implements SocketLike {
  listeners: Record<string, Array<(event: any) => void>> = {};
  sent: string[] = [];
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: any) => void): void {
    (this.listeners[type] ||= []).push(listener);
  }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.emit('close', {}); }
  emit(type: string, event: any): void { for (const listener of this.listeners[type] ?? []) listener(event); }
}

test('universe is selected by current liquidity rather than a scattered symbol list', () => {
  const response = [{ universe: [{ name: 'LOW' }, { name: 'SOL' }, { name: 'BTC' }] }, [
    { dayNtlVlm: '10', openInterest: '1', markPx: '1' },
    { dayNtlVlm: '20000000', openInterest: '4', markPx: '100' },
    { dayNtlVlm: '50000000', openInterest: '5', markPx: '50000' },
  ]];
  assert.deepEqual(selectFastPerpUniverse(response, { minimumDayNotionalVolumeUsd: 1_000_000, maximumSymbols: 2 })
    .map((row) => row.symbol), ['BTC', 'SOL']);
});

test('trade and L2 messages become point-in-time paper evidence', () => {
  const trade = parseFastPerpMessage(JSON.stringify({ channel: 'trades', data: [
    { coin: 'SOL', side: 'B', px: '100', sz: '2', time: 900, tid: 4, hash: '0x1' },
  ] }), 1_000).trades[0];
  assert.equal(trade.side, 'buy'); assert.equal(trade.notionalUsd, 200); assert.equal(trade.liquidation, null);
  const book = parseFastPerpMessage(JSON.stringify({ channel: 'l2Book', data: { coin: 'SOL', time: 950,
    levels: [[{ px: '99', sz: '3', n: 2 }], [{ px: '101', sz: '1', n: 1 }]] } }), 1_000).books[0];
  assert.equal(book.midPrice, 100); assert.ok(book.imbalance > 0); assert.equal(book.liveExecution, 'locked');
  const context = parseFastPerpMessage(JSON.stringify({ channel: 'activeAssetCtx', data: { coin: 'SOL', ctx: {
    funding: '0.0001', openInterest: '1000', markPx: '100', oraclePx: '99.9', premium: '0.0002', time: 975,
  } } }), 1_000).contexts[0];
  assert.equal(context.fundingRate, 0.0001); assert.equal(context.symbol, 'SOL');
});

test('book identity includes complete depth levels, not only aggregate depth', () => {
  const first = parseFastPerpMessage(JSON.stringify({ channel: 'l2Book', data: { coin: 'SOL', time: 950,
    levels: [[{ px: '99', sz: '1', n: 1 }, { px: '98', sz: '1', n: 1 }],
      [{ px: '101', sz: '1', n: 1 }, { px: '102', sz: '1', n: 1 }]] } }), 1_000).books[0];
  const second = parseFastPerpMessage(JSON.stringify({ channel: 'l2Book', data: { coin: 'SOL', time: 950,
    levels: [[{ px: '99', sz: '0.5', n: 1 }, { px: '98', sz: `${(147.5 / 98)}`, n: 2 }],
      [{ px: '101', sz: '0.5', n: 1 }, { px: '102', sz: `${(152.5 / 102)}`, n: 2 }]] } }), 1_000).books[0];
  assert.equal(first.bestBid, second.bestBid);
  assert.equal(first.bestAsk, second.bestAsk);
  assert.equal(first.bidDepthUsd, second.bidDepthUsd);
  assert.equal(first.askDepthUsd, second.askDepthUsd);
  assert.notEqual(first.id, second.id);
});

test('recorder persists evidence, subscriptions, malformed gaps, and reconnect intent', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-perp-')); const store = new FastPerpEvidenceStore(root);
  const sockets: FakeSocket[] = []; const scheduled: Array<{ callback: () => void; delay: number }> = [];
  let now = 1_000;
  const recorder = new FastPerpRecorder({ store, now: () => now,
    universe: async () => [{ symbol: 'SOL', dayNotionalVolumeUsd: 20_000_000, openInterest: 1, markPrice: 100 }],
    socketFactory: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; },
    schedule: (callback, delay) => { scheduled.push({ callback, delay }); return 1 as any; }, cancel: () => {} });
  await recorder.start(); sockets[0].emit('open', {});
  assert.equal(sockets[0].sent.length, 3);
  now = 1_100; sockets[0].emit('message', { data: JSON.stringify({ channel: 'trades', data: [
    { coin: 'SOL', side: 'A', px: '100', sz: '1', time: 1_050, tid: 1 },
  ] }) });
  now = 1_200; sockets[0].emit('message', { data: '{bad' });
  sockets[0].emit('close', {});
  const snapshot = store.snapshot(now);
  assert.equal(snapshot.counts.trades, 1); assert.equal(snapshot.counts.gaps, 1);
  assert.equal(scheduled.length, 1); assert.equal(recorder.status().connected, false);
  recorder.stop();
});

test('default recorder constructs one evidence store for its entire lifetime', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-perp-single-store-'));
  let storesConstructed = 0;
  const sockets: FakeSocket[] = [];
  const recorder = new FastPerpRecorder({
    storeFactory: () => {
      storesConstructed += 1;
      return new FastPerpEvidenceStore(root);
    },
    now: () => 1_000,
    universe: async () => [{ symbol: 'SOL', dayNotionalVolumeUsd: 20_000_000, openInterest: 1, markPrice: 100 }],
    socketFactory: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; },
    schedule: () => 1 as any,
    cancel: () => {},
  });

  await recorder.start();
  sockets[0].emit('open', {});
  sockets[0].emit('message', { data: JSON.stringify({ channel: 'trades', data: [
    { coin: 'SOL', side: 'A', px: '100', sz: '1', time: 950, tid: 1 },
  ] }) });
  sockets[0].emit('message', { data: JSON.stringify({ channel: 'trades', data: [
    { coin: 'SOL', side: 'B', px: '101', sz: '1', time: 960, tid: 2 },
  ] }) });
  recorder.stop();

  assert.equal(storesConstructed, 1);
  assert.equal(new FastPerpEvidenceStore(root).snapshot(1_000).counts.trades, 2);
});
