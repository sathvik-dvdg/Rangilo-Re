import { beforeEach } from 'vitest';

// Every test starts with fresh rate-limit counts (lib/rateLimit.ts keeps them in memory).
// Imported lazily so that a test file's vi.mock calls apply to what it loads.
beforeEach(async () => {
  (await import('@/lib/rateLimit')).resetRateLimits();
});
