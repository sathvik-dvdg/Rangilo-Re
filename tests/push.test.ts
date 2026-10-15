// NOTIF-002: Web Push. Route- and library-level tests; Clerk, the database and the
// web-push library are mocked, so nothing reaches a real push service.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { user_id: string; endpoint: string; p256dh: string; auth: string };

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  rows: [] as { user_id: string; endpoint: string; p256dh: string; auth: string }[],
  upsertError: null as { code: string } | null,
  dbCalls: 0,
  sendNotification: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: mocks.userId }) }));
vi.mock('web-push', () => ({ default: { sendNotification: mocks.sendNotification } }));

// A small in-memory stand-in for the push_subscriptions table.
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      expect(table).toBe('push_subscriptions');
      mocks.dbCalls += 1;
      const filters: ((r: Row) => boolean)[] = [];
      let action: 'select' | 'delete' = 'select';
      let max = Infinity;
      const run = () => {
        const matched = mocks.rows.filter((r) => filters.every((f) => f(r)));
        if (action === 'delete') mocks.rows = mocks.rows.filter((r) => !matched.includes(r));
        return { data: matched.slice(0, max), error: null };
      };
      const query = {
        select: () => query,
        delete: () => {
          action = 'delete';
          return query;
        },
        eq: (col: keyof Row, value: string) => {
          filters.push((r) => r[col] === value);
          return query;
        },
        in: (col: keyof Row, values: string[]) => {
          filters.push((r) => values.includes(r[col]));
          return query;
        },
        order: () => query,
        limit: (n: number) => {
          max = n;
          return query;
        },
        upsert: async (row: Row) => {
          if (mocks.upsertError) return { error: mocks.upsertError };
          mocks.rows = [row, ...mocks.rows.filter((r) => r.endpoint !== row.endpoint)];
          return { error: null };
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
      };
      return query;
    },
  }),
}));

import { DELETE, GET, POST } from '@/app/api/push/subscribe/route';
import { isAllowedPushEndpoint, notifyNewMessage, sendPushToUser } from '@/lib/push';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';
const KEYS = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
const request = (method: string, body?: unknown) =>
  new Request('http://localhost/api/push/subscribe', { method, body: body === undefined ? undefined : JSON.stringify(body) });
const row = (user_id: string, endpoint: string): Row => ({ user_id, endpoint, ...KEYS });

function configure() {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'public-key');
  vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key');
  vi.stubEnv('VAPID_SUBJECT', 'mailto:owner@example.com');
}

beforeEach(() => {
  mocks.userId = 'user_alice';
  mocks.rows = [];
  mocks.upsertError = null;
  mocks.dbCalls = 0;
  mocks.sendNotification.mockReset().mockResolvedValue({});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('push endpoint allow-list (the server posts to these URLs)', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-by3p.notify.windows.com/w/?token=abc',
  ])('accepts %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc', // not https
    'https://localhost/internal',
    'https://169.254.169.254/latest/meta-data',
    'https://evil.example/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.example/x',
    'https://notfcm.googleapis.com.evil.example/x',
    'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    `https://fcm.googleapis.com/${'x'.repeat(1100)}`,
    'not a url',
    '',
    null,
    42,
  ])('rejects %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe('GET /api/push/subscribe', () => {
  it('requires a signed-in user', async () => {
    mocks.userId = null;
    expect((await GET()).status).toBe(401);
  });

  it('reports push as unavailable when the server has no keys', async () => {
    expect(await (await GET()).json()).toEqual({ enabled: false, publicKey: null });
  });

  it('returns the public key, and never the private key', async () => {
    configure();
    const text = await (await GET()).text();
    expect(JSON.parse(text)).toEqual({ enabled: true, publicKey: 'public-key' });
    expect(text).not.toContain('private-key');
  });
});

describe('POST /api/push/subscribe', () => {
  it('requires a signed-in user and writes nothing', async () => {
    configure();
    mocks.userId = null;
    expect((await POST(request('POST', { endpoint: ENDPOINT, keys: KEYS }))).status).toBe(401);
    expect(mocks.dbCalls).toBe(0);
  });

  it('refuses when push is not configured, before any database access', async () => {
    expect((await POST(request('POST', { endpoint: ENDPOINT, keys: KEYS }))).status).toBe(503);
    expect(mocks.dbCalls).toBe(0);
  });

  it.each([
    ['an endpoint outside the push services', { endpoint: 'https://internal.example/hook', keys: KEYS }],
    ['a missing endpoint', { keys: KEYS }],
    ['missing keys', { endpoint: ENDPOINT }],
    ['a malformed key', { endpoint: ENDPOINT, keys: { p256dh: 'not base64url!', auth: KEYS.auth } }],
    ['a non-string key', { endpoint: ENDPOINT, keys: { p256dh: KEYS.p256dh, auth: 5 } }],
    ['a body that is not an object', 'nonsense'],
  ])('rejects %s with 400 and writes nothing', async (_name, body) => {
    configure();
    expect((await POST(request('POST', body))).status).toBe(400);
    expect(mocks.dbCalls).toBe(0);
  });

  it('stores the subscription under the caller, ignoring any user id in the body', async () => {
    configure();
    const res = await POST(request('POST', { endpoint: ENDPOINT, keys: KEYS, user_id: 'user_bob' }));
    expect(res.status).toBe(200);
    expect(mocks.rows).toHaveLength(1);
    expect(mocks.rows[0]).toMatchObject({ user_id: 'user_alice', endpoint: ENDPOINT, ...KEYS });
  });

  it('keeps only the five most recent browsers per user', async () => {
    configure();
    mocks.rows = Array.from({ length: 5 }, (_, i) => row('user_alice', `https://fcm.googleapis.com/fcm/send/old${i}`));
    mocks.rows.push(row('user_bob', 'https://fcm.googleapis.com/fcm/send/bob'));
    expect((await POST(request('POST', { endpoint: ENDPOINT, keys: KEYS }))).status).toBe(200);
    const mine = mocks.rows.filter((r) => r.user_id === 'user_alice');
    expect(mine).toHaveLength(5);
    expect(mine[0].endpoint).toBe(ENDPOINT);
    expect(mocks.rows.some((r) => r.user_id === 'user_bob')).toBe(true); // other users untouched
  });

  it('tells a user without a profile to finish onboarding', async () => {
    configure();
    mocks.upsertError = { code: '23503' };
    expect((await POST(request('POST', { endpoint: ENDPOINT, keys: KEYS }))).status).toBe(409);
  });
});

describe('DELETE /api/push/subscribe', () => {
  it("removes the caller's subscription and nobody else's", async () => {
    mocks.rows = [row('user_alice', ENDPOINT), row('user_bob', 'https://fcm.googleapis.com/fcm/send/bob')];
    expect((await DELETE(request('DELETE', { endpoint: 'https://fcm.googleapis.com/fcm/send/bob' }))).status).toBe(200);
    expect(mocks.rows).toHaveLength(2); // not Alice's to delete
    expect((await DELETE(request('DELETE', { endpoint: ENDPOINT }))).status).toBe(200);
    expect(mocks.rows.map((r) => r.user_id)).toEqual(['user_bob']);
  });

  it('requires a signed-in user', async () => {
    mocks.userId = null;
    mocks.rows = [row('user_alice', ENDPOINT)];
    expect((await DELETE(request('DELETE', { endpoint: ENDPOINT }))).status).toBe(401);
    expect(mocks.rows).toHaveLength(1);
  });
});

describe('sending', () => {
  it('does nothing, and touches no database, when push is not configured', async () => {
    mocks.rows = [row('user_bob', ENDPOINT)];
    await notifyNewMessage('user_bob', 'DiyaDancer_Avni_4821', 'user_alice_user_bob');
    expect(mocks.dbCalls).toBe(0);
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("sends to the recipient's browsers only, with the nickname and room but not the message text", async () => {
    configure();
    mocks.rows = [row('user_bob', ENDPOINT), row('user_carol', 'https://fcm.googleapis.com/fcm/send/carol')];
    await notifyNewMessage('user_bob', 'DiyaDancer_Avni_4821', 'user_alice_user_bob');

    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, payload, options] = mocks.sendNotification.mock.calls[0];
    expect(subscription).toEqual({ endpoint: ENDPOINT, keys: KEYS });
    expect(JSON.parse(payload)).toEqual({
      title: 'GarbaConnect',
      body: 'DiyaDancer_Avni_4821 sent you a message',
      url: '/chat/user_alice_user_bob',
      tag: 'user_alice_user_bob',
    });
    expect(options).toMatchObject({ TTL: 3600, vapidDetails: { subject: 'mailto:owner@example.com', publicKey: 'public-key', privateKey: 'private-key' } });
  });

  it('forgets a subscription the push service reports as gone', async () => {
    configure();
    mocks.rows = [row('user_bob', ENDPOINT), row('user_bob', 'https://fcm.googleapis.com/fcm/send/second')];
    mocks.sendNotification.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
    await sendPushToUser('user_bob', { title: 't', body: 'b', url: '/dashboard', tag: 'x' });
    expect(mocks.rows.map((r) => r.endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/second']);
  });

  it('never throws, keeps the subscription on a temporary failure, and logs no endpoint', async () => {
    configure();
    mocks.rows = [row('user_bob', ENDPOINT)];
    mocks.sendNotification.mockRejectedValueOnce(Object.assign(new Error(`failed for ${ENDPOINT}`), { statusCode: 500 }));
    await expect(sendPushToUser('user_bob', { title: 't', body: 'b', url: '/dashboard', tag: 'x' })).resolves.toBeUndefined();
    expect(mocks.rows).toHaveLength(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('fcm.googleapis.com');
  });

  it('never posts to a stored endpoint that is outside the allow-list', async () => {
    configure();
    mocks.rows = [row('user_bob', 'https://internal.example/hook')];
    await sendPushToUser('user_bob', { title: 't', body: 'b', url: '/dashboard', tag: 'x' });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
