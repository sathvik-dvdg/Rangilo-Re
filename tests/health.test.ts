// GET /api/health: the load balancer's liveness check. It must answer without a session
// and without touching the database.
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ supabaseAdmin: vi.fn(), auth: vi.fn() }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.supabaseAdmin }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 { ok: true }, uncached', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('needs no session and makes no database call', () => {
    GET();
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
  });
});
