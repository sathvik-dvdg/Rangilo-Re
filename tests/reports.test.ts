// SAFE-002 reporting. Route-level tests: Clerk and the database are mocked (tests/helpers/fakeDb.ts,
// which copies the users foreign keys of migration 0010); the route is the real one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from './helpers/fakeDb';

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  supabaseAdmin: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: mocks.userId }) }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.supabaseAdmin }));

import { POST as report } from '@/app/api/reports/route';

const ALICE = 'user_alice';
const BOB = 'user_bob';

let db: FakeDb;
let errorLog: ReturnType<typeof vi.spyOn>;
const post = (body: unknown) => report(new Request('http://localhost/', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const reports = () => db.rowsOf('reports');

beforeEach(() => {
  db = createFakeDb();
  mocks.supabaseAdmin.mockImplementation(() => db.client);
  for (const clerk_id of [ALICE, BOB]) db.seed('users', { clerk_id, display_name: `Dancer_${clerk_id}_1000`, gender: 'female' });
  mocks.userId = ALICE;
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('POST /api/reports', () => {
  it('stores the report under the signed-in user and answers 201', async () => {
    const res = await post({ reportedUserId: BOB, reason: '  Kept messaging after I said no  ' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(reports()).toEqual([expect.objectContaining({ reporter_id: ALICE, reported_id: BOB, reason: 'Kept messaging after I said no' })]);
  });

  it('accepts an empty reason and exactly 500 characters', async () => {
    expect((await post({ reportedUserId: BOB, reason: '' })).status).toBe(201);
    expect((await post({ reportedUserId: BOB, reason: 'a'.repeat(500) })).status).toBe(201);
    expect(reports()).toHaveLength(2);
  });

  it('needs a session', async () => {
    mocks.userId = null;
    expect((await post({ reportedUserId: BOB, reason: 'x' })).status).toBe(401);
    expect(reports()).toEqual([]);
  });

  it.each([
    ['no body', ''],
    ['a reason over 500 characters', { reportedUserId: BOB, reason: 'a'.repeat(501) }],
    ['a missing reason', { reportedUserId: BOB }],
    ['a non-string reason', { reportedUserId: BOB, reason: 5 }],
    ['a malformed id', { reportedUserId: 'bob', reason: 'x' }],
    ['a uuid instead of a Clerk id', { reportedUserId: '0f8fad5b-d9cb-469f-a165-70867728950e', reason: 'x' }],
  ])('refuses %s with 400 and writes nothing', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(reports()).toEqual([]);
  });

  it('refuses a report about yourself, and 404s for a dancer who does not exist', async () => {
    expect((await post({ reportedUserId: ALICE, reason: 'x' })).status).toBe(400);
    expect((await post({ reportedUserId: 'user_nobody', reason: 'x' })).status).toBe(404);
    expect(reports()).toEqual([]);
  });

  it('allows 5 a minute per dancer, then 429', async () => {
    for (let i = 0; i < 5; i++) expect((await post({ reportedUserId: BOB, reason: `report ${i}` })).status).toBe(201);
    expect((await post({ reportedUserId: BOB, reason: 'one more' })).status).toBe(429);
    expect(reports()).toHaveLength(5);
  });

  it('answers 503 before migration 0010 is applied, without logging the reason (PRIV-003)', async () => {
    db.writeErrors.reports = { code: '42P01', message: 'relation "public.reports" does not exist' };
    expect((await post({ reportedUserId: BOB, reason: 'private details here' })).status).toBe(503);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private details here');
  });
});
