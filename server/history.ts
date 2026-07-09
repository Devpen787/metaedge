import { Router } from 'express';
import { getHourlySeries } from './recorder.js';
import { serverPrices, arenaSymbol } from './prices.js';

// Historical price series, served from the ticks WE recorded — never from a
// generator. The client chart used to invent its own history with a random walk
// biased upward (`Math.random() - 0.46`), which is the same defect that once
// drifted the server's BTC to $444k. It is fixed here the same way it was fixed
// there: by deleting the generator and serving the record.
//
// A fresh deployment therefore has almost no history, and this endpoint says so
// plainly via `hoursAvailable`. That number being small is a fact about our data
// collection, not a bug to paper over.

export const historyRouter = Router();

// Live in the same file as the route it constrains, so a reader can't miss it.
const MAX_POINTS = 400; // matches the recorder's HOURLY_MAX ring

historyRouter.get('/api/prices/history/:symbol', (req, res) => {
  const raw = String(req.params.symbol || '').toUpperCase().trim();
  const sym = arenaSymbol(raw);

  if (!serverPrices[sym]) {
    return res.status(404).json({ success: false, error: `Unknown symbol: ${raw}` });
  }

  // `hours` is a request for a WINDOW, not a promise that the window is full.
  const requested = Number(req.query.hours);
  const window = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), MAX_POINTS)
    : MAX_POINTS;

  const full = getHourlySeries(sym);

  // Slice by TIME, not by count. `full.slice(-window)` would return the last
  // `window` RECORDED points, which is a different thing whenever recording has
  // gaps: with 4 points spread over two days, a "24H" request would hand back a
  // point 27 hours old and let the client label it as within the window.
  const cutoff = Date.now() - window * 3_600_000;
  const points = full.filter((p) => p.t >= cutoff);

  // Recording gaps are a fact the client needs, because a line drawn straight
  // across a gap asserts prices we never observed.
  let gaps = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].t - points[i - 1].t > 3_600_000) gaps++;
  }

  res.json({
    success: true,
    symbol: sym,
    resolution: 'hourly',
    source: 'metaedge-recorder',
    points,
    // What the caller asked for vs. what exists. A chart that renders
    // `points.length` while labelling it `hoursRequested` is lying again.
    hoursRequested: window,
    hoursAvailable: points.length,
    gaps,
    totalHoursRecorded: full.length,
  });
});
