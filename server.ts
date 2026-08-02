import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
// NOTE: `vite` is a BUILD tool and a devDependency. It must NOT be imported at
// the top level — esbuild externalizes it, so a static import makes the bundled
// production server `require('vite')` at startup, and if devDeps aren't installed
// (NODE_ENV=production prunes them) the live site crash-loops on boot with
// "Cannot find module 'vite'" — which is exactly what took prod down on
// 2026-07-15. It is loaded via dynamic import() inside the dev-only branch below,
// so production never touches it.

import { authRouter, sessionMiddleware, persistEphemeralOnMutation } from './server/auth.js';
import { DATABASE_BACKEND, databaseStatus, readDatabase } from './server/storage.js';
import { pricesRouter } from './server/prices.js';
import { historyRouter } from './server/history.js';
import { roomsRouter } from './server/rooms.js';
import { agentsRouter } from './server/agents.js';
import { startPaperBroker, tradesRouter } from './server/trades.js';
import { vaultsRouter } from './server/vaults.js';
import { predictionsRouter } from './server/predictions.js';
import { graphRouter } from './server/graph.js';
import { metamaskRouter } from './server/metamask.js';
import { quantRouter } from './server/quant.js';
import { arenaRouter } from './server/arena.js';
import { startAutotrader } from './server/autotrader.js';
import { startRecorder } from './server/recorder.js';
import { startPredictionScout } from './server/scouts.js';
import { platformRouter } from './server/platform.js';
import { researchRouter } from './server/research.js';
import { startJanitor } from './server/janitor.js';
import { startKillGuard } from './server/killguard.js';
import { startDecisionRuntime } from './server/decision/runtime.js';
import { startRiskLoop } from './server/decision/risk_loop.js';
import { startBroadFeed } from './server/broad_feed.js';
import { startDailyRoll } from './server/decision/daily_features.js';
import { startGoldenCrossScanner } from './server/decision/golden_cross_scanner.js';
import { discoveryRouter } from './server/discovery/router.js';
import { startOpportunityFactory } from './server/discovery/runtime.js';
import { startFastPerpRecorder } from './server/discovery/fast_perp_recorder.js';
import { startFastPerpOperation, startFastPerpOperatorSummary } from './server/discovery/fast_perp_scheduler.js';
import { mutationLimiter } from './server/ratelimit.js';
import { reconcileOrderIntents } from './src/secure-core/trading/intents.js';
import { initializeV5Authority } from './server/v5/authority.js';
import { v5Router } from './server/v5/router.js';
import { startExperimentOutcomeReconcilerV5 } from './server/v5/outcomes.js';
import { startPortfolioAllocatorReconcilerV5 } from './server/v5/portfolio.js';
import { startPopulationOperationSupervisorV5 } from './server/v5/population.js';

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.disable('x-powered-by');

// Baseline security headers on every response.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');           // no embedding (clickjacking)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// CORS, deny-by-default. MetaEdge is same-origin in production (Caddy serves the
// SPA and the API from one host), so no browser needs this. It exists for the
// agent-facing API, and it is opt-in via CORS_ALLOWED_ORIGINS (comma-separated).
//
// An unconfigured origin list authorizes NOBODY, never everybody — the same rule
// the live-execution allowlist follows. `Access-Control-Allow-Origin: *` here
// would be worse than no CORS at all: it invites credentialed cross-origin reads
// against session-cookie-authenticated endpoints.
const CORS_ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  // Vary regardless: the response body differs by Origin, and a cache that
  // misses this will serve one origin's allowance to another.
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.sendStatus(origin && CORS_ALLOWED_ORIGINS.has(origin) ? 204 : 403); return; }
  next();
});

app.use(express.json({ limit: '256kb' }));

// No fallback cookie secret. A hardcoded default means every session cookie is
// signed with a string visible in source, so sessions can be forged. Fail at
// startup rather than serve forgeable sessions. gcp_setup.sh generates this into
// .env.production, which systemd loads via EnvironmentFile.
const COOKIE_SECRET = process.env.COOKIE_SECRET;
if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET environment variable is required');
app.use(cookieParser(COOKIE_SECRET));

app.use(sessionMiddleware);

// Abuse guard: cap mutating requests per user (after session so we key by userId).
app.use(mutationLimiter());

// Persist an anonymous user only when they first mutate — after the rate limiter,
// so a throttled flood never writes. Read-only traffic stays in-memory (see
// sessionMiddleware), which is what closes the cookieless-flood DB DoS.
app.use(persistEphemeralOnMutation);

// --- HEALTH ENDPOINT (honest: actually probes the DB) ---
const START_TIME = Date.now();
app.get('/api/health', (_req, res) => {
  let dbOk = false;
  let users = 0;
  try {
    const db = readDatabase();
    users = Object.keys(db.users || {}).length;
    dbOk = true;
  } catch { /* dbOk stays false */ }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    app: 'MetaEdge',
    commit: process.env.GIT_COMMIT || 'dev',
    uptimeSec: Math.round((Date.now() - START_TIME) / 1000),
    dbConnectivity: dbOk,
    storage: databaseStatus(),
    users,
    liveModeGlobalLock: process.env.LIVE_EXECUTION_ENABLED !== 'true'
  });
});

// Agent-facing guide at the /llms.txt convention (AI agents look here first),
// plus the human quickstart. Served before the SPA catch-all.
//
// Read once at boot, not per request. These are immutable build artifacts, and
// readFileSync inside a handler blocks the event loop for every caller — on a
// shared e2-micro that is the whole server, not just this route. A missing file
// also threw from inside the handler, turning a packaging mistake into a 500.
import fsDocs from 'fs';
function loadDoc(name: string): string {
  try {
    return fsDocs.readFileSync(path.join(process.cwd(), 'docs', name), 'utf8');
  } catch {
    console.warn(`[docs] ${name} missing — its route will report so rather than throw`);
    return '';
  }
}
const DOC_AGENTS = loadDoc('AGENTS.md');
const DOC_HOWTO = loadDoc('HOW_TO.md');

function serveDoc(body: string) {
  return (_req: express.Request, res: express.Response) => {
    if (!body) { res.status(404).type('text/plain').send('Not available in this build.'); return; }
    res.type('text/plain; charset=utf-8').send(body);
  };
}
app.get(['/llms.txt', '/agents.md'], serveDoc(DOC_AGENTS));
app.get('/how-to', serveDoc(DOC_HOWTO));

app.use(authRouter);
app.use(pricesRouter);
app.use(historyRouter);
app.use(roomsRouter);
app.use(agentsRouter);
app.use(tradesRouter);
app.use(vaultsRouter);
app.use(predictionsRouter);
app.use(graphRouter);
app.use(metamaskRouter);
app.use(quantRouter);
app.use(arenaRouter);
app.use(platformRouter);
app.use(researchRouter);
app.use(discoveryRouter);
app.use(v5Router);

// --- VITE MIDDLEWARE SETUP FOR DEV/PROD ---
import fs from 'fs';
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');

  // NODE_ENV is the ONLY thing that decides the mode. The old condition also
  // flipped to prod whenever `dist/index.html` merely existed, so any developer
  // who had ever run `npm run build` got a stale bundle served silently over
  // their live source, with no Vite and no HMR — the mode depended on a file's
  // presence rather than on intent. (Observed: an explicit NODE_ENV=development
  // boot served static assets and never started Vite.)
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // A dev server that cannot build cannot serve. Logging and continuing left
    // Express answering every SPA route with a 404 while claiming it had
    // started — the same fail-open shape as the Tier-0 handlers we replaced.
    // Dynamic import so production never loads the build tool (see note at top).
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In prod the bundle is the product. Missing means the deploy is broken;
    // say so at boot rather than 404 on every page load.
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      throw new Error(`NODE_ENV=production but ${distPath}/index.html is missing — run \`npm run build\` before starting.`);
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Last-resort error handler: any thrown/rejected route returns clean JSON
  // instead of hanging the request or leaking a stack trace.
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled route error:', req.method, req.path, err?.message);
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  // Establish the immutable pre-v5 cutoff and migrate current mutable agents
  // before any writer or reconciliation path can run.
  const authority = initializeV5Authority();
  console.log(
    `[authority-v5] active cutoff=${authority.cutoffAt}`
    + ` legacy_agents=${authority.legacyAgentIds.length}`
    + ` legacy_specs=${authority.legacyStrategySpecIds.length}`,
  );

  // Resolve interrupted V5 paper-order state before any autonomous loop can
  // submit another intent. Failure is fatal: trading must not start from
  // unexamined canonical state.
  const reconciliation = reconcileOrderIntents();
  console.log(
    `[order-v5] startup reconciliation inspected=${reconciliation.inspected}`
    + ` recovered=${reconciliation.recoveredExecuted}`
    + ` unresolved=${reconciliation.markedUnresolved}`,
  );

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MetaEdge V5 Server] running on http://0.0.0.0:${PORT}`);
    startAutotrader();
    startRecorder();
    startPredictionScout();
    startBroadFeed();  // live price + 24h volume for the long-tail universe (feeds getSpotPrice + the gates)
    startDailyRoll();  // keep the daily 50/200 series current from the broad feed (once per UTC day)
    startPaperBroker();
    startPortfolioAllocatorReconcilerV5();
    startExperimentOutcomeReconcilerV5();
    startDecisionRuntime();
    startPopulationOperationSupervisorV5();
    startRiskLoop();   // event-driven hard-stop + trailing-stop defense between the runtime's slow cycles
    startGoldenCrossScanner();  // volume-confirmed 50/200 entries → paper positions with a 15% trailing stop
    startOpportunityFactory();
    // Recovery containment: both fast-perp loops are fail-closed and must opt in
    // independently after storage/recovery gates pass. Ordinary paper product
    // startup remains available while the flywheel is disabled.
    startFastPerpRecorder();
    startFastPerpOperation();
    startFastPerpOperatorSummary();
    startJanitor();
    startKillGuard();

    // The legacy EdgeOps report reads data/db.json directly. PostgreSQL V5 must
    // not spawn a writer that cannot see canonical state.
    if (DATABASE_BACKEND === 'file') {
      const runReport = () => {
        import('node:child_process').then(({ execFile }) =>
          execFile('node', ['scripts/edgeops_report.mjs'], { timeout: 60_000 }, (err) =>
            console.log(err ? `[edgeops] report failed: ${err.message}` : '[edgeops] daily edge report written'))
        ).catch((e) => console.warn('[edgeops] report scheduling failed:', e?.message));
      };
      setTimeout(runReport, 60_000);
      setInterval(runReport, 24 * 60 * 60 * 1000).unref();
    } else {
      console.log('[edgeops-v5] legacy file report disabled under PostgreSQL authority');
    }
  });

  // Graceful shutdown: stop accepting connections and exit cleanly on deploy
  // signals (DB writes are synchronous, so nothing is left half-written).
  const shutdown = (sig: string) => {
    console.log(`[MetaEdge] ${sig} received — shutting down gracefully.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// A rejected promise is usually one request's problem — log it and keep serving.
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));

// An uncaught exception is different: the process is now in an undefined state.
// Continuing means serving requests from corrupt memory, and — because the flat
// db is read-modify-written in place — potentially persisting that corruption.
// Log, then exit non-zero. systemd (Restart=always, RestartSec=3) brings us back
// on clean state. Staying up is the more dangerous option, not the safer one.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception — exiting so systemd can restart cleanly:', err);
  process.exit(1);
});

startServer().catch((err) => {
  // A fatal startup error (e.g. a required secret is missing) must not leave a
  // zombie process listening on nothing.
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
