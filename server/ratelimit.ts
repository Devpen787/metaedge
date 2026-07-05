import type { Request, Response, NextFunction } from 'express';

// Reusable per-key sliding-window rate limiter. Keyed by userId (falls back to
// IP) so one abusive client can't spam mutations and starve everyone else.
export function rateLimit(opts: { windowMs: number; max: number; name?: string }) {
  const buckets = new Map<string, number[]>();
  // Periodically drop stale buckets so memory doesn't grow unbounded.
  setInterval(() => {
    const cutoff = Date.now() - opts.windowMs;
    for (const [k, arr] of buckets) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length) buckets.set(k, kept); else buckets.delete(k);
    }
  }, opts.windowMs).unref?.();

  return (req: any, res: Response, next: NextFunction) => {
    const key = req.userId || req.ip || 'anon';
    const now = Date.now();
    const bucket = (buckets.get(key) || []).filter((t) => now - t < opts.windowMs);
    if (bucket.length >= opts.max) {
      res.status(429).json({ error: 'rate_limited', message: 'Too many requests — slow down for a few seconds.' });
      return;
    }
    bucket.push(now);
    buckets.set(key, bucket);
    next();
  };
}

// Guards all mutating requests (POST/PUT/PATCH/DELETE). Generous enough for real
// play (manual trades, bets, agent tweaks) but a wall against floods.
export function mutationLimiter() {
  const limiter = rateLimit({ windowMs: 30_000, max: 80, name: 'mutations' });
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    return limiter(req, res, next);
  };
}
