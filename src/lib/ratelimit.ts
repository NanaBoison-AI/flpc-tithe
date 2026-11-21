// Simple fixed-window in-memory limiter. On Vercel each instance has its own
// memory, so this is best-effort; swap for Upstash/Redis if stricter limits are needed.
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const b = buckets.get(key);
  if (!b || b.reset <= now) { buckets.set(key, { n: 1, reset: now + windowMs }); return { ok: true, retryAfterSec: 0 }; }
  b.n += 1;
  if (b.n > limit) return { ok: false, retryAfterSec: Math.ceil((b.reset - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}
export const _resetRateLimits = () => buckets.clear();
