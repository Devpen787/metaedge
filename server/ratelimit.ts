import type { Request, Response, NextFunction } from 'express';

// The bucket key for a request.
//
// `req.userId || req.ip` looked like "userId, with an IP fallback for anonymous
// callers". It is not: sessionMiddleware MINTS a fresh `usr_...` for every
// request that arrives without a valid session cookie, so `req.userId` is always
// set and the IP branch was unreachable. Each cookieless request therefore got
// its own private bucket of one, and no limiter in this app could ever throttle
// the one caller that matters — the one who simply omits the cookie.
//
// Measured before the fix: 20 consecutive `GET /api/mm/status` with no cookie
// returned 20x 200 and created 20 users.
//
// So: trust `req.userId` only when the request actually PRESENTED a session that
// resolved (`req.sessionAuthenticated`, set in sessionMiddleware). Otherwise fall
// back to the network peer, which an attacker cannot mint on demand.
export function rateLimitKey(req: any): string {
  if (req.sessionAuthenticated && req.userId) return `usr:${req.userId}`;
  return `ip:${req.ip || 'unknown'}`;
}

// Reusable per-key sliding-window rate limiter, so one abusive client can't spam
// mutations and starve everyone else.
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
    const key = rateLimitKey(req);
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
