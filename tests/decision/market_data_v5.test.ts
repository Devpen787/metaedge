import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-market-v5-'));
const marketDir = path.join(dir, 'market');
const bootstrapDir = path.join(dir, 'bootstrap');
process.env.DATABASE_URL = path.join(dir, 'db.json');
process.env.MARKET_DATA_DIR = marketDir;
process.env.DAILY_BOOTSTRAP_DIR = bootstrapDir;

test('display projection cannot mutate canonical market evidence', async () => {
  const {
    __applyCanonicalPriceForTest,
    __projectDisplayPriceForTest,
    getDisplayPricesSnapshot,
    getPriceObservation,
    serverPrices,
  } = await import('../../server/prices.js');
  serverPrices.TESTV5 = {
    price: 90,
    change24h: 1,
    high24h: 95,
    low24h: 85,
    volume24h: 1_000_000,
    marketCap: 10_000_000,
    supply: 'test',
    name: 'Test V5',
    description: 'fixture',
  };
  const observedAt = Date.now();
  assert.equal(__applyCanonicalPriceForTest('TESTV5', 100, observedAt), true);
  const canonicalHash = getPriceObservation('TESTV5')?.observationHash;

  __projectDisplayPriceForTest('TESTV5', 101);

  assert.equal(serverPrices.TESTV5.price, 100);
  assert.equal(getPriceObservation('TESTV5')?.price, 100);
  assert.equal(getPriceObservation('TESTV5')?.observationHash, canonicalHash);
  assert.equal(getDisplayPricesSnapshot().TESTV5.price, 101);
});

test('long-tail lookup identifies its actual venue and immutable observation', async () => {
  const { __setBroadTickForTest } = await import('../../server/broad_feed.js');
  const { getPriceObservation } = await import('../../server/prices.js');
  const observedAt = Date.now();
  __setBroadTickForTest('TAILV5', 2.5, 75_000_000, 'gate', observedAt);

  const observation = getPriceObservation('TAILV5');
  assert.equal(observation?.price, 2.5);
  assert.equal(observation?.provider, 'gate');
  assert.equal(observation?.venue, 'gate');
  assert.equal(observation?.dataset, 'spot_ticker_24h');
  assert.equal(observation?.observedAt, observedAt);
  assert.match(observation?.observationHash || '', /^[a-f0-9]{64}$/);
});

test('recorder captures only the active universe, persists gaps, and reconstructs hourly evidence', async () => {
  const {
    activateUniverseVersionV5,
    createUniverseVersionV5,
  } = await import('../../server/market_data_v5.js');
  const {
    __reloadRecorderEvidenceV5ForTest,
    captureMarketObservationsOnce,
    configureRecorderUniverseV5,
    getHourlySeries,
  } = await import('../../server/recorder.js');
  const version = activateUniverseVersionV5(
    createUniverseVersionV5(['TESTV5', 'TAILV5', 'MISSINGV5'], Date.now()),
  );
  configureRecorderUniverseV5(version);

  const capture = captureMarketObservationsOnce();
  assert.equal(capture.universeId, version.universeId);
  assert.equal(capture.requested, 3);
  assert.equal(capture.recorded, 2);
  assert.equal(capture.gaps, 1);
  assert.equal(capture.writeFailed, false);
  assert.deepEqual(capture.observations.map((item) => item.symbol).sort(), ['TAILV5', 'TESTV5']);

  const tickFile = fs.readdirSync(marketDir).find((file) => file.startsWith('ticks-'));
  const rows = fs.readFileSync(path.join(marketDir, tickFile!), 'utf8')
    .trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) =>
    row.schema === 'market-observation.v5'
    && row.universeId === version.universeId
    && row.provider
    && row.venue
    && row.observedAt
    && row.receivedAt
    && row.observationHash));

  const gapFile = fs.readdirSync(marketDir).find((file) => file.startsWith('gaps-'));
  const gap = JSON.parse(fs.readFileSync(path.join(marketDir, gapFile!), 'utf8').trim());
  assert.equal(gap.symbol, 'MISSINGV5');
  assert.equal(gap.gapPolicy, 'do_not_fill');

  const duplicate = captureMarketObservationsOnce();
  assert.equal(duplicate.recorded, 0);
  assert.equal(duplicate.unchanged, 2);

  __reloadRecorderEvidenceV5ForTest();
  assert.equal(getHourlySeries('TESTV5').length, 1);
  assert.equal(getHourlySeries('TAILV5').length, 1);

  const tampered = rows.map((row) => row.sym === 'TESTV5' ? { ...row, price: 999, px: 999 } : row);
  fs.writeFileSync(path.join(marketDir, tickFile!), `${tampered.map((row) => JSON.stringify(row)).join('\n')}\n`);
  __reloadRecorderEvidenceV5ForTest();
  assert.equal(getHourlySeries('TESTV5').length, 0);
  assert.equal(getHourlySeries('TAILV5').length, 1);
});

test('coverage matrix makes missing requirements explicitly unarmed', async () => {
  const {
    activeUniverseVersionV5,
    coverageEntryV5,
    persistCoverageMatrixV5,
  } = await import('../../server/market_data_v5.js');
  const { readDatabase } = await import('../../server/storage.js');
  const version = activeUniverseVersionV5();
  assert.ok(version);
  const ready = coverageEntryV5({
    strategyHash: 'strategy_ready',
    pluginId: 'momentum_24h',
    symbol: 'TESTV5',
    requiredFeatures: ['price.v5', 'volume_24h_usd.v5'],
    features: {
      'price.v5': { quality: 'good' },
      'volume_24h_usd.v5': { quality: 'good' },
    },
  });
  const blocked = coverageEntryV5({
    strategyHash: 'strategy_blocked',
    pluginId: 'rsi_mean_reversion',
    symbol: 'MISSINGV5',
    requiredFeatures: ['price.v5', 'sma_200.v5'],
    features: {
      'price.v5': { quality: 'missing' },
      'sma_200.v5': { quality: 'missing' },
    },
  });
  const matrix = persistCoverageMatrixV5(version!.universeId, [ready, blocked], Date.now());

  assert.equal(ready.armed, true);
  assert.equal(blocked.armed, false);
  assert.deepEqual(blocked.unavailableFeatures, ['price.v5', 'sma_200.v5']);
  assert.equal(matrix.ready, 1);
  assert.equal(matrix.total, 2);
  assert.equal(matrix.coveragePct, 50);
  assert.equal(readDatabase().marketDataV5?.latestCoverage?.matrixId, matrix.matrixId);
});

test('settled daily bars persist provenance and reconstruct after an in-memory reset', async () => {
  const DAY_MS = 86_400_000;
  const today = Math.floor(Date.now() / DAY_MS);
  const priorDay = today - 1;
  fs.mkdirSync(bootstrapDir, { recursive: true });
  const bootstrap = Array.from({ length: 200 }, (_, index) => ({
    t: (priorDay - 200 + index) * DAY_MS + DAY_MS - 1,
    p: 80 + index / 10,
    v: 60_000_000,
  }));
  fs.writeFileSync(path.join(bootstrapDir, 'DAYV5.json'), JSON.stringify(bootstrap));

  const {
    __resetDailyStateForTest,
    dailyIndicators,
    dailyRollStep,
    readPersistedDailyBarsV5,
  } = await import('../../server/decision/daily_features.js');
  assert.ok(dailyIndicators('DAYV5'));
  const priorTickAt = priorDay * DAY_MS + DAY_MS / 2;
  dailyRollStep(priorTickAt, () => ({ price: 123, vol24hUsd: 70_000_000 }));
  const finalized = dailyRollStep(today * DAY_MS + 1_000, () => ({ price: 124, vol24hUsd: 71_000_000 }));
  assert.equal(finalized, 1);

  const bars = readPersistedDailyBarsV5('DAYV5');
  assert.equal(bars.length, 1);
  assert.equal(bars[0].day, priorDay);
  assert.equal(bars[0].close, 123);
  assert.equal(bars[0].provider, 'injected');
  assert.equal(bars[0].crossVenuePolicy, 'preserve_and_flag');
  assert.match(bars[0].barHash, /^[a-f0-9]{64}$/);

  __resetDailyStateForTest();
  const reconstructed = dailyIndicators('DAYV5');
  assert.ok(reconstructed);
  assert.equal(reconstructed?.days, 201);
  assert.equal(reconstructed?.lastClose, 123);
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
