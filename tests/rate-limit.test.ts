// CHAT-007 rate limits and SEC-004 body validation on the routes not covered elsewhere.
// Clerk, the database (tests/helpers/fakeDb.ts) and the Razorpay SDK are mocked; the limiter,
// the routes and lib/server.ts are the real ones. Counts are kept per server process, so these
// tests show the per-instance behaviour only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from './helpers/fakeDb';

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  supabaseAdmin: vi.fn(),
  Razorpay: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: mocks.userId }) }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.supabaseAdmin }));
vi.mock('razorpay', () => ({ default: mocks.Razorpay }));

import { GET as getRoom } from '@/app/api/rooms/[roomId]/route';
import { POST as answerConsent } from '@/app/api/rooms/[roomId]/consent/route';
import { POST as heartbeat } from '@/app/api/me/heartbeat/route';
import { POST as createOrder } from '@/app/api/payment/create-order/route';
import { POST as verify } from '@/app/api/payment/verify/route';
import { LIMITS, hit } from '@/lib/rateLimit';

const ALICE = 'user_alice';
const PARTNERS = ['user_b1', 'user_b2', 'user_b3', 'user_b4', 'user_b5', 'user_b6'];
const roomWith = (partner: string) => [ALICE, partner].sort().join('_');

let db: FakeDb;
const post = (body: unknown) => new Request('http://localhost/', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const open = (roomId: string) => getRoom(new Request('http://localhost/'), { params: { roomId } });

beforeEach(() => {
  db = createFakeDb();
  mocks.supabaseAdmin.mockImplementation(() => db.client);
  mocks.userId = ALICE;
  for (const clerk_id of [ALICE, ...PARTNERS]) {
    db.seed('users', { clerk_id, display_name: `Dancer_${clerk_id}_1000`, gender: 'female', last_seen: new Date().toISOString() });
  }
  vi.stubEnv('BILLING_MODE', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('the limiter', () => {
  it('allows `limit` hits in a window, refuses the next with the seconds left, then starts afresh', () => {
    const { limit, windowMs } = LIMITS.account;
    const t0 = 1_000_000;
    for (let i = 0; i < limit; i++) expect(hit('account', 'k', t0)).toBe(0);
    expect(hit('account', 'k', t0 + 15_000)).toBe(45);
    expect(hit('account', 'k', t0 + windowMs)).toBe(0);
  });

  it('keeps buckets and keys apart', () => {
    for (let i = 0; i < LIMITS.account.limit; i++) hit('account', 'k');
    expect(hit('account', 'k')).toBeGreaterThan(0);
    expect(hit('account', 'other')).toBe(0);
    expect(hit('message', 'k')).toBe(0);
  });
});

describe('creating rooms: 5 a minute per dancer', () => {
  it('the sixth new room in a minute is refused with 429 and not created; reopening an existing room still works', async () => {
    for (const partner of PARTNERS.slice(0, 5)) expect((await open(roomWith(partner))).status).toBe(200);
    expect(db.rowsOf('rooms')).toHaveLength(5);

    const res = await open(roomWith(PARTNERS[5]));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(db.rowsOf('rooms')).toHaveLength(5);

    expect((await open(roomWith(PARTNERS[0]))).status).toBe(200);
  });
});

describe('payment routes: 10 a minute per dancer, before the billing gate', () => {
  it.each([
    ['create-order', () => createOrder(post({ type: 'connect', roomId: roomWith(PARTNERS[0]) }))],
    ['verify', () => verify(post({ orderId: 'order_1', paymentId: 'pay_1', signature: 'sig' }))],
  ])('%s: ten Free Mode refusals, then 429, with no database or Razorpay access', async (_name, call) => {
    for (let i = 0; i < 10; i++) expect((await call()).status).toBe(403);
    expect((await call()).status).toBe(429);
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
    expect(mocks.Razorpay).not.toHaveBeenCalled();
  });
});

describe('consent answers (SEC-004, CHAT-007)', () => {
  it.each([['no body', ''], ['an unknown action', { action: 'approve' }], ['a non-string action', { action: 1 }], ['an array', '[]']])(
    'refuses %s with 400 Unknown action',
    async (_name, body) => {
      const res = await answerConsent(post(body), { params: { roomId: roomWith(PARTNERS[0]) } });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Unknown action' });
    },
  );
});

describe('heartbeat (SEC-004, CHAT-007)', () => {
  const me = () => db.rowsOf('users').find((u) => u.clerk_id === ALICE)!;

  it('a missing body means still online; { online: false } means leaving', async () => {
    expect((await heartbeat(post(''))).status).toBe(200);
    expect(me()).toMatchObject({ is_online: true });
    expect((await heartbeat(post({ online: false }))).status).toBe(200);
    expect(me()).toMatchObject({ is_online: false });
  });

  it('refuses a body of the wrong shape and writes nothing', async () => {
    const res = await heartbeat(post({ online: 'no' }));
    expect(res.status).toBe(400);
    expect(db.writesTo('users')).toEqual([]);
  });

  it('allows 10 a minute, then 429', async () => {
    for (let i = 0; i < 10; i++) expect((await heartbeat(post({ online: true }))).status).toBe(200);
    expect((await heartbeat(post({ online: true }))).status).toBe(429);
  });
});
