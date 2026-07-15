// ponytail: per-process fixed-window limiter. Not shared across serverless
// instances, so limits are per-instance — swap for Upstash Ratelimit (Redis)
// when you need global enforcement. Enough to stop casual abuse and runaway
// AI spend on a demo deploy.
const WINDOW_MS = 60_000;
const MAX = 20; // requests per IP per window

const hits = new Map<string, { count: number; reset: number }>();

export function rateLimited(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();

  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }

  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  e.count++;
  return e.count > MAX;
}
