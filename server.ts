import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';

import { authRouter, sessionMiddleware } from './server/auth.js';
import { readDatabase } from './server/storage.js';
import { pricesRouter } from './server/prices.js';
import { roomsRouter } from './server/rooms.js';
import { agentsRouter } from './server/agents.js';
import { tradesRouter } from './server/trades.js';
import { vaultsRouter } from './server/vaults.js';
import { predictionsRouter } from './server/predictions.js';
import { graphRouter } from './server/graph.js';
import { metamaskRouter } from './server/metamask.js';
import { quantRouter } from './server/quant.js';
import { arenaRouter } from './server/arena.js';
import { startAutotrader } from './server/autotrader.js';
import { startRecorder } from './server/recorder.js';
import { platformRouter } from './server/platform.js';
import { researchRouter } from './server/research.js';
import { startJanitor } from './server/janitor.js';
import { startKillGuard } from './server/killguard.js';
import { mutationLimiter } from './server/ratelimit.js';

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
    users,
    liveModeGlobalLock: process.env.LIVE_EXECUTION_ENABLED !== 'true'
  });
});

// Agent-facing guide at the /llms.txt convention (AI agents look here first),
// plus the human quickstart. Served before the SPA catch-all.
import fsDocs from 'fs';
app.get(['/llms.txt', '/agents.md'], (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.send(fsDocs.readFileSync(path.join(process.cwd(), 'docs', 'AGENTS.md'), 'utf8'));
});
app.get('/how-to', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.send(fsDocs.readFileSync(path.join(process.cwd(), 'docs', 'HOW_TO.md'), 'utf8'));
});

app.use(authRouter);
app.use(pricesRouter);
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

// --- VITE MIDDLEWARE SETUP FOR DEV/PROD ---
import fs from 'fs';
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(distPath, 'index.html'));

  if (!isProd) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error('Failed to start Vite middleware:', err);
    }
  } else {
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MetaEdge V1 Server] running on http://0.0.0.0:${PORT}`);
    startAutotrader();
    startRecorder();
    startJanitor();
    startKillGuard();

    // EdgeOps report automation: regenerate the edge report daily so fresh
    // evidence is always sitting in data/edgeops/ — no cron, no SSH needed.
    const runReport = () => {
      import('node:child_process').then(({ execFile }) =>
        execFile('node', ['scripts/edgeops_report.mjs'], { timeout: 60_000 }, (err) =>
          console.log(err ? `[edgeops] report failed: ${err.message}` : '[edgeops] daily edge report written'))
      ).catch((e) => console.warn('[edgeops] report scheduling failed:', e?.message));
    };
    setTimeout(runReport, 60_000);                       // once shortly after boot
    setInterval(runReport, 24 * 60 * 60 * 1000).unref(); // then daily
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
