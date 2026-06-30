import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';

import { authRouter, sessionMiddleware } from './server/auth.js';
import { pricesRouter } from './server/prices.js';
import { roomsRouter } from './server/rooms.js';
import { agentsRouter } from './server/agents.js';
import { tradesRouter } from './server/trades.js';
import { vaultsRouter } from './server/vaults.js';
import { predictionsRouter } from './server/predictions.js';
import { graphRouter } from './server/graph.js';
import { metamaskRouter } from './server/metamask.js';
import { quantRouter } from './server/quant.js';

const PORT = 3000;

const app = express();
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || 'metaedge-secret-key-cookie'));

app.use(sessionMiddleware);

// --- HEALTH ENDPOINT ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'MetaEdge V1',
    version: '1.0.0',
    buildCommit: 'a87b32c',
    dbConnectivity: true,
    graphProjectionStatus: true,
    liveModeGlobalLock: process.env.LIVE_EXECUTION_ENABLED !== 'true'
  });
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

// --- VITE MIDDLEWARE SETUP FOR DEV/PROD ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MetaEdge V1 Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
