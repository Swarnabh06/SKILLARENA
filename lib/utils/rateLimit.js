import "server-only";
import { apiError } from "@/lib/auth/guards";

/**
 * Small in-memory sliding-window rate limiter for Route Handlers.
 * Good enough for a single server or a demo; swap for a shared store
 * (e.g. a MongoDB TTL collection or Redis) when running several instances.
 */
const buckets = (globalThis.__skillarenaRateLimit ??= new Map());

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear(); // crude memory cap
  return { ok: true };
}

/** Returns an error response when the user/action is over the limit, otherwise null. */
export function limitOrNull(key, options) {
  const result = rateLimit(key, options);
  if (result.ok) return null;
  const response = apiError(429, `Too many requests. Try again in ${result.retryAfter} seconds.`);
  response.headers.set("Retry-After", String(result.retryAfter));
  return response;
}
