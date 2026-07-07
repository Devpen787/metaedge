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
app.use(cookieParser(process.env.COOKIE_SECRET || 'metaedge-secret-key-cookie'));

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

// Keep the process alive on unexpected errors — log, don't crash. A friends
// beta shouldn't go down because one request hit an edge case.
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
});
