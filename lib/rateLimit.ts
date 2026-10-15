import 'server-only';
import { HttpError } from './server';

/**
 * Per-user request limits (CHAT-007). Fixed one-minute windows counted in
 * this server process's memory: no new infrastructure, but each server
 * instance counts on its own and a restart forgets every count, so on a
 * platform that runs several instances this slows abuse rather than capping
 * it exactly. A shared store (e.g. Redis) would be needed for a hard cap.
 *
 * Limits are keyed on the signed-in Clerk user, not the IP address: a whole
 * garba venue on one Wi-Fi network, or many phones behind one mobile-carrier
 * address, would otherwise share a single allowance.
 */

export type Limit = { limit: number; windowMs: number };

export const LIMITS = {
  /** Opening a chat with someone new creates the room. */
  roomCreate: { limit: 5, windowMs: 60_000 },
  message: { limit: 30, windowMs: 60_000 },
  /** create-order and verify. */
  payment: { limit: 10, windowMs: 60_000 },
  /** Blocking and unblocking (SAFE-001). */
  block: { limit: 10, windowMs: 60_000 },
  /** Reporting a dancer (SAFE-002). */
  report: { limit: 5, windowMs: 60_000 },
  /** Onboarding, nickname rerolls, push subscriptions, consent answers, presence heartbeats. */
  account: { limit: 10, windowMs: 60_000 },
} satisfies Record<string, Limit>;

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const SWEEP_AT = 10_000;

/** Counts one request. Returns how many seconds to wait when over the limit, otherwise 0. */
export function hit(bucket: keyof typeof LIMITS, key: string, now = Date.now()): number {
  const { limit, windowMs } = LIMITS[bucket];
  if (windows.size >= SWEEP_AT) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }
  const id = `${bucket}:${key}`;
  const current = windows.get(id);
  if (!current || current.resetAt <= now) {
    windows.set(id, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  current.count += 1;
  return current.count > limit ? Math.ceil((current.resetAt - now) / 1000) : 0;
}

/** Throws a 429 with Retry-After once `key` has used up its allowance for `bucket`. */
export function enforceRateLimit(bucket: keyof typeof LIMITS, key: string) {
  const retryAfter = hit(bucket, key);
  if (retryAfter > 0) {
    throw new HttpError(429, 'Too many requests. Wait a moment and try again.', { 'Retry-After': String(retryAfter) });
  }
}

/** Test hook: forget every count. */
export function resetRateLimits() {
  windows.clear();
}
