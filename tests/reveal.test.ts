// ID-001..003, PRIV-001: a dancer's real name and photo are shown to another dancer only
// after the first agreed to share with that person, and a verified payment followed.
// Since 2026-10-14 nobody can ask for a name and photo any more: only a paying user may
// request, through the connect payment (DEC-013). What is tested here is what remains:
// reading reveals granted before then, and finishing a reveal order paid for before then.
// Clerk and the database are mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  db: {} as Record<string, Record<string, unknown>[]>,
  touched: [] as string[],
  missingTable: false,
  photos: {} as Record<string, string | null>,
  clerkDown: false,
  notifyRevealRequest: vi.fn(async () => {}),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: mocks.userId }),
  clerkClient: () => ({
    users: {
      getUser: async (id: string) => {
        if (mocks.clerkDown) throw new Error('clerk down');
        return { id, hasImage: Boolean(mocks.photos[id]), imageUrl: mocks.photos[id] ?? 'https://img.example/default-avatar.png' };
      },
      getUserList: async ({ userId }: { userId: string[] }) => {
        if (mocks.clerkDown) throw new Error('clerk down');
        return { data: userId.map((id) => ({ id, hasImage: Boolean(mocks.photos[id]), imageUrl: mocks.photos[id] ?? 'https://img.example/default-avatar.png' })) };
      },
    },
  }),
}));
vi.mock('@/lib/push', () => ({ notifyRevealRequest: mocks.notifyRevealRequest }));

// In-memory tables. Any table not listed here (the old `reveals` table in particular) throws.
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (!(table in mocks.db)) throw new Error(`unexpected table: ${table}`);
      mocks.touched.push(table);
      const filters: ((r: Row) => boolean)[] = [];
      let patch: Row | null = null;
      let max = Infinity;
      const run = () => {
        if (mocks.missingTable && table === 'reveal_requests') return { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } };
        const matched = mocks.db[table].filter((r) => filters.every((f) => f(r)));
        if (patch) for (const r of matched) Object.assign(r, patch);
        return { data: matched.slice(0, max), error: null };
      };
      const q = {
        select: () => q,
        eq: (col: string, value: unknown) => (filters.push((r) => r[col] === value), q),
        in: (col: string, values: unknown[]) => (filters.push((r) => values.includes(r[col])), q),
        order: () => q,
        limit: (n: number) => ((max = n), q),
        update: (values: Row) => ((patch = values), q),
        upsert: async (row: Row) => {
          const rows = mocks.db[table];
          if (!rows.some((r) => r.requester_id === row.requester_id && r.target_id === row.target_id)) rows.push({ status: 'pending', payment_id: null, ...row });
          return { error: null };
        },
        maybeSingle: async () => {
          const { data, error } = run();
          return { data: data?.[0] ?? null, error };
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { resetBillingDiagnostics } from '@/lib/billing';
import * as reveal from '@/lib/reveal';
import { getRevealed, grantReveal, listRevealed } from '@/lib/reveal';

const ROOM = 'user_alice_user_bob';
const PAID = {
  BILLING_MODE: 'paid',
  RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
  RAZORPAY_KEY_SECRET: 'fake_key_secret_0123456789',
  RAZORPAY_WEBHOOK_SECRET: 'fake_webhook_secret_0123',
  NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
};
const person = (clerk_id: string, display_name: string, real_name: string) => ({
  clerk_id, display_name, real_name, email: `${clerk_id}@private.example`, instagram_handle: `${clerk_id}_insta`, gender: 'female', last_seen: new Date().toISOString(),
});
const requests = () => mocks.db.reveal_requests;
const seed = (requester_id: string, target_id: string, status: string, payment_id: string | null = null) =>
  requests().push({ requester_id, target_id, status, payment_id });

beforeEach(() => {
  for (const [k, v] of Object.entries(PAID)) vi.stubEnv(k, v);
  resetBillingDiagnostics();
  mocks.userId = 'user_alice';
  mocks.db = {
    users: [person('user_alice', 'DiyaDancer_Avni_4821', 'Alice Patel'), person('user_bob', 'GarbaKing_Arjun_7302', 'Bob Sharma'), person('user_carol', 'RaasQueen_Meera_1184', 'Carol Shah')],
    rooms: [{ id: ROOM, participant_ids: ['user_alice', 'user_bob'], timer_started_at: null }],
    messages: [],
    reveal_requests: [],
  };
  mocks.touched = [];
  mocks.missingTable = false;
  mocks.photos = { user_bob: 'https://img.example/bob.jpg' };
  mocks.clerkDown = false;
  mocks.notifyRevealRequest.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('only paying users may request (DEC-013)', () => {
  it('nothing is left that could create, allow or decline a name-and-photo request', () => {
    // Reading granted reveals, and finishing a reveal paid for before the change, are all that remain.
    expect(Object.keys(reveal).sort()).toEqual(['getRevealed', 'grantReveal', 'listRevealed']);
  });
});

describe('what one dancer may see of another (getRevealed)', () => {
  it.each(['pending', 'allowed', 'declined'])('is nothing while the request is %s', async (status) => {
    seed('user_alice', 'user_bob', status);
    expect(await getRevealed('user_alice', 'user_bob')).toBeNull();
  });

  it('is nothing when nobody asked', async () => {
    expect(await getRevealed('user_alice', 'user_bob')).toBeNull();
  });

  it('is exactly the real name and photo once agreed and paid: no email, no Instagram, nothing else', async () => {
    seed('user_alice', 'user_bob', 'revealed', 'pay_1');
    const identity = await getRevealed('user_alice', 'user_bob');
    expect(identity).toEqual({ real_name: 'Bob Sharma', image_url: 'https://img.example/bob.jpg' });
    expect(Object.keys(identity!).sort()).toEqual(['image_url', 'real_name']);
    expect(JSON.stringify(identity)).not.toMatch(/private\.example|insta/);
  });

  it('works one way only: Bob sharing with Alice shows Alice nothing to Bob, and nothing to Carol', async () => {
    seed('user_alice', 'user_bob', 'revealed', 'pay_1');
    expect(await getRevealed('user_bob', 'user_alice')).toBeNull();
    expect(await getRevealed('user_carol', 'user_bob')).toBeNull();
  });

  it('has no photo when the dancer never uploaded one, or when Clerk cannot be reached', async () => {
    seed('user_bob', 'user_alice', 'revealed', 'pay_1'); // Alice has no uploaded photo
    expect(await getRevealed('user_bob', 'user_alice')).toEqual({ real_name: 'Alice Patel', image_url: null });
    seed('user_alice', 'user_bob', 'revealed', 'pay_2');
    mocks.clerkDown = true;
    expect(await getRevealed('user_alice', 'user_bob')).toEqual({ real_name: 'Bob Sharma', image_url: null });
  });

  it('never reads the old `reveals` table, whose rows were created by payment alone (DEC-003)', async () => {
    seed('user_alice', 'user_bob', 'revealed', 'pay_1');
    await getRevealed('user_alice', 'user_bob');
    await listRevealed('user_alice');
    expect(mocks.touched).not.toContain('reveals'); // and the fake throws for any table it does not know
    expect(new Set(mocks.touched)).toEqual(new Set(['reveal_requests', 'users']));
  });

  it('shows nothing, and does not fail, when migration 0008 has not been applied', async () => {
    mocks.missingTable = true;
    expect(await getRevealed('user_alice', 'user_bob')).toBeNull();
    expect(await listRevealed('user_alice')).toEqual([]);
  });
});

describe('the dancer list (listRevealed)', () => {
  it('returns only the dancers who shared with this viewer, with name and photo only', async () => {
    seed('user_alice', 'user_bob', 'revealed', 'pay_1');
    seed('user_alice', 'user_carol', 'allowed'); // agreed but not paid for
    seed('user_carol', 'user_alice', 'revealed', 'pay_2'); // someone else's view of Alice
    const list = await listRevealed('user_alice');
    expect(list).toEqual([{ clerk_id: 'user_bob', real_name: 'Bob Sharma', image_url: 'https://img.example/bob.jpg' }]);
    expect(JSON.stringify(list)).not.toMatch(/private\.example|insta/);
  });
});

describe('grantReveal (called by payment fulfilment only)', () => {
  it('moves an allowed request to revealed, recording the payment', async () => {
    seed('user_alice', 'user_bob', 'allowed');
    expect(await grantReveal('user_alice', 'user_bob', 'pay_1')).toBe('granted');
    expect(requests()[0]).toMatchObject({ status: 'revealed', payment_id: 'pay_1' });
  });

  it.each([['no request', null], ['a pending request', 'pending'], ['a declined request', 'declined']])('grants nothing for %s', async (_name, status) => {
    if (status) seed('user_alice', 'user_bob', status);
    expect(await grantReveal('user_alice', 'user_bob', 'pay_1')).toBe('no_consent');
    expect(requests().map((r) => r.status)).toEqual(status ? [status] : []);
  });

  it('is safe to repeat for the same payment, and refuses a different one', async () => {
    seed('user_alice', 'user_bob', 'allowed');
    await grantReveal('user_alice', 'user_bob', 'pay_1');
    expect(await grantReveal('user_alice', 'user_bob', 'pay_1')).toBe('already_granted');
    expect(await grantReveal('user_alice', 'user_bob', 'pay_2')).toBe('no_consent');
    expect(requests()[0]).toMatchObject({ status: 'revealed', payment_id: 'pay_1' });
  });

  it("an allowed request in the other direction does not count", async () => {
    seed('user_bob', 'user_alice', 'allowed');
    expect(await grantReveal('user_alice', 'user_bob', 'pay_1')).toBe('no_consent');
    expect(requests()[0]).toMatchObject({ status: 'allowed', payment_id: null });
  });
});
