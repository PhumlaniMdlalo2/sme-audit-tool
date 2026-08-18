const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

// Best-effort per-instance limiter. Vercel serverless instances aren't shared
// state, so this only throttles a single warm instance — good enough to deter
// casual abuse of a free, no-signup endpoint, not a substitute for a real
// store (Upstash/Redis) if this ever gets real traffic.
const hits = new Map<string, number[]>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(ip, timestamps);

  if (hits.size > 5000) hits.clear();

  return timestamps.length > MAX_REQUESTS;
}
