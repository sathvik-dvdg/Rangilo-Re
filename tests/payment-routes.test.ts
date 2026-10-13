// TEST-004 (subset): payment routes are inert unless Paid Mode is effective (FREE-004,
// CFG-002, CFG-003), and in Paid Mode act only on a verified signature and the ledger
// (PAY-003, PAY-004, PAY-005, PAY-006, PAY-007, PAY-008, PAY-009, PAY-010).
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  ordersCreate: vi.fn(),
  paymentsFetch: vi.fn(),
  razorpayClient: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: mocks.userId }) }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.supabaseAdmin }));
vi.mock('@/lib/razorpay', async (importOriginal) => ({
  // Keep the real signature checks; replace only the SDK client.
  ...(await importOriginal<typeof import('@/lib/razorpay')>()),
  razorpay: mocks.razorpayClient,
}));

import { POST as createOrder } from '@/app/api/payment/create-order/route';
import { POST as verify } from '@/app/api/payment/verify/route';
import { POST as webhook } from '@/app/api/webhooks/razorpay/route';
import { resetBillingDiagnostics } from '@/lib/billing';

// Fake, well-formed values. Never real credentials.
const CREDENTIALS = {
  RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
  RAZORPAY_KEY_SECRET: 'fake_key_secret_0123456789',
  RAZORPAY_WEBHOOK_SECRET: 'fake_webhook_secret_0123',
  NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
};
const ROOM = 'user_alice_user_bob';
const ORDER = 'order_test_1';
const PAYMENT = 'pay_test_1';

// A stand-in for the tables the payment code touches: `payment_orders` rows
// live in `ledger`, `webhook_events` rows in `events`, and every write to any
// table is recorded in `writes`. `grantError`, when set, is what the
// `chat_extensions` upsert fails with.
// `reveal_requests` rows live in `requests` and `users` rows in `people` (PAY-017).
let ledger: Row[] = [];
let events: Row[] = [];
let requests: Row[] = [];
let people: Row[] = [];
let writes: { table: string; op: 'insert' | 'upsert' | 'update'; row: Row }[] = [];
let grantError: Row | null = null;
let eventCount = 0;

function fakeSupabase() {
  return {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let update: Row | null = null;
      const rows =
        table === 'payment_orders' ? ledger : table === 'webhook_events' ? events : table === 'reveal_requests' ? requests : table === 'users' ? people : [];
      const matching = () => rows.filter((row) => filters.every((f) => f(row)));
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), query),
        neq: (column: string, value: unknown) => (filters.push((row) => row[column] !== value), query),
        in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), query),
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        insert: async (row: Row) => {
          writes.push({ table, op: 'insert', row });
          if (table === 'payment_orders') ledger.push({ payment_id: null, ...row });
          return { error: null };
        },
        upsert: async (row: Row) => {
          if (table === 'chat_extensions' && grantError) return { error: grantError };
          writes.push({ table, op: 'upsert', row });
          if (table === 'webhook_events' && !events.some((e) => e.event_id === row.event_id)) events.push(row);
          return { error: null };
        },
        update: (values: Row) => ((update = values), query),
        // Awaiting the builder runs the update, as the Supabase client does. `data` is the rows it matched.
        then: (resolve: (result: { data: Row[]; error: null }) => unknown) => {
          const values = update;
          const matched = matching();
          if (values) {
            for (const row of matched) {
              Object.assign(row, values);
              writes.push({ table, op: 'update', row: values });
            }
          }
          return Promise.resolve({ data: matched, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

const writesTo = (table: string) => writes.filter((w) => w.table === table);
/** Writes that change what a user has or what the ledger says; event bookkeeping left out. */
const ledgerAndGrantWrites = () => writes.filter((w) => w.table !== 'webhook_events');

function seedOrder(overrides: Row = {}) {
  ledger.push({ user_id: 'user_alice', room_id: ROOM, order_id: ORDER, payment_id: null, status: 'created', amount: 2900, currency: 'INR', ...overrides });
}

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) });

function checkoutResponse(orderId = ORDER, paymentId = PAYMENT, secret = CREDENTIALS.RAZORPAY_KEY_SECRET) {
  const razorpay_signature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature };
}

// Razorpay gives every event its own id; pass `eventId` to simulate a redelivery.
function signedWebhook(body: string, secret = CREDENTIALS.RAZORPAY_WEBHOOK_SECRET, eventId = `evt_test_${++eventCount}`) {
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return new Request('http://localhost/api/webhooks/razorpay', {
    method: 'POST',
    body,
    headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId },
  });
}

const paymentEvent = (event: string, entity: Row = {}) =>
  JSON.stringify({ event, payload: { payment: { entity: { id: PAYMENT, order_id: ORDER, amount: 2900, currency: 'INR', ...entity } } } });
const capturedEvent = paymentEvent('payment.captured');
/** What Razorpay returns for the payment when all is well. */
const capturedPayment = { id: PAYMENT, order_id: ORDER, status: 'captured', amount: 2900, currency: 'INR' };
// Postgres codes: a missing rooms row is permanent, a dropped connection is not.
const ROOM_MISSING = { code: '23503', message: 'violates foreign key constraint' };
const CONNECTION_LOST = { code: '08006', message: 'connection failure' };

let warnLog: ReturnType<typeof vi.spyOn>;
let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  ledger = [];
  events = [];
  requests = [];
  people = [];
  writes = [];
  grantError = null;
  eventCount = 0;
  mocks.userId = 'user_alice';
  mocks.ordersCreate.mockResolvedValue({ id: ORDER });
  mocks.paymentsFetch.mockResolvedValue(capturedPayment);
  mocks.razorpayClient.mockReturnValue({ orders: { create: mocks.ordersCreate }, payments: { fetch: mocks.paymentsFetch } });
  mocks.supabaseAdmin.mockImplementation(() => {
    throw new Error('the database must not be touched');
  });
  resetBillingDiagnostics();
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Free Mode (BILLING_MODE unset, valid credentials present)', () => {
  beforeEach(() => setEnv({ ...CREDENTIALS, BILLING_MODE: '' }));

  it('create-order returns 403 billing_disabled without touching Razorpay or the database', async () => {
    const res = await createOrder(post('/api/payment/create-order', { type: 'extend', roomId: ROOM }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'billing_disabled' });
    expect(mocks.razorpayClient).not.toHaveBeenCalled();
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
  });

  it('verify returns 403 billing_disabled and grants nothing, even for a correctly signed checkout', async () => {
    const res = await verify(post('/api/payment/verify', checkoutResponse()));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'billing_disabled' });
    expect(mocks.razorpayClient).not.toHaveBeenCalled();
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
  });

  it('unauthenticated callers still get 401', async () => {
    mocks.userId = null;
    const res = await createOrder(post('/api/payment/create-order', { type: 'extend', roomId: ROOM }));
    expect(res.status).toBe(401);
  });

  it('a correctly signed webhook is logged and acknowledged but grants nothing', async () => {
    const res = await webhook(signedWebhook(capturedEvent));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: 'billing_disabled' });
    expect(mocks.razorpayClient).not.toHaveBeenCalled();
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
    expect(warnLog).toHaveBeenCalledWith(
      expect.stringContaining('nothing granted'),
      expect.objectContaining({ eventId: 'evt_test_1', paymentId: PAYMENT, orderId: ORDER }),
    );
  });

  it('a signed but unparseable webhook body does not crash and grants nothing', async () => {
    const res = await webhook(signedWebhook('not json'));
    expect(res.status).toBe(200);
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
  });

  it('a webhook with a bad signature is still rejected', async () => {
    const res = await webhook(signedWebhook(capturedEvent, 'wrong_secret_0123456789'));
    expect(res.status).toBe(400);
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
  });

  it('a webhook is rejected when no webhook secret is configured', async () => {
    setEnv({ RAZORPAY_WEBHOOK_SECRET: '' });
    const res = await webhook(signedWebhook(capturedEvent, ''));
    expect(res.status).toBe(400);
  });
});

describe('Paid Mode requested but not ready', () => {
  beforeEach(() => setEnv({ ...CREDENTIALS, BILLING_MODE: 'paid', RAZORPAY_KEY_SECRET: '' }));

  it('create-order returns 503 billing_unavailable without touching Razorpay', async () => {
    const res = await createOrder(post('/api/payment/create-order', { type: 'extend', roomId: ROOM }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'billing_unavailable' });
    expect(mocks.razorpayClient).not.toHaveBeenCalled();
  });

  it('verify returns 503 and grants nothing', async () => {
    const res = await verify(post('/api/payment/verify', checkoutResponse()));
    expect(res.status).toBe(503);
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
  });

  it('a correctly signed webhook grants nothing', async () => {
    const res = await webhook(signedWebhook(capturedEvent));
    expect(res.status).toBe(200);
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
    expect(mocks.razorpayClient).not.toHaveBeenCalled();
  });
});

describe('Paid Mode ready (fake test keys, Razorpay SDK and database mocked)', () => {
  beforeEach(() => {
    setEnv({ ...CREDENTIALS, BILLING_MODE: 'paid' });
    mocks.supabaseAdmin.mockImplementation(fakeSupabase);
  });

  describe('create-order', () => {
    it('creates a Razorpay order at the server-fixed price and returns its public details', async () => {
      const res = await createOrder(post('/api/payment/create-order', { type: 'extend', roomId: ROOM, amount: 1 }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ orderId: ORDER, amount: 2900, currency: 'INR', keyId: CREDENTIALS.NEXT_PUBLIC_RAZORPAY_KEY_ID });
      expect(mocks.ordersCreate).toHaveBeenCalledTimes(1);
      expect(mocks.ordersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 2900, currency: 'INR' }));
    });

    it('records the order in the ledger as created, owned by the caller', async () => {
      await createOrder(post('/api/payment/create-order', { type: 'extend', roomId: ROOM }));
      expect(writesTo('payment_orders')).toEqual([
        { table: 'payment_orders', op: 'insert', row: { user_id: 'user_alice', room_id: ROOM, order_id: ORDER, status: 'created', amount: 2900, currency: 'INR' } },
      ]);
    });

    it('never returns a secret', async () => {
      const res = await createOrder(post('/api/payment/create-order', { type: 'extend', roomId: ROOM }));
      const body = await res.text();
      expect(body).not.toContain(CREDENTIALS.RAZORPAY_KEY_SECRET);
      expect(body).not.toContain(CREDENTIALS.RAZORPAY_WEBHOOK_SECRET);
    });

    it('refuses a reveal order that names a person instead of a room', async () => {
      const res = await createOrder(post('/api/payment/create-order', { type: 'reveal', targetUserId: 'user_bob' }));
      expect(res.status).toBe(400);
      expect(mocks.ordersCreate).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    });

    it('refuses an unknown product', async () => {
      const res = await createOrder(post('/api/payment/create-order', { type: 'identity', roomId: ROOM }));
      expect(res.status).toBe(400);
      expect(mocks.ordersCreate).not.toHaveBeenCalled();
    });

    it("refuses a room the caller is not part of", async () => {
      const res = await createOrder(post('/api/payment/create-order', { type: 'extend', roomId: 'user_bob_user_carol' }));
      expect(res.status).toBe(400);
      expect(mocks.ordersCreate).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    beforeEach(() => seedOrder());

    it.each([
      ['a forged signature', { ...checkoutResponse(), razorpay_signature: 'f'.repeat(64) }],
      ['a signature made with the wrong secret', checkoutResponse(ORDER, PAYMENT, 'wrong_secret_0123456789')],
      ['a signature for a different order', { ...checkoutResponse('order_other', PAYMENT), razorpay_order_id: ORDER }],
      ['a truncated signature', { ...checkoutResponse(), razorpay_signature: checkoutResponse().razorpay_signature.slice(0, 32) }],
      ['an empty signature', { ...checkoutResponse(), razorpay_signature: '' }],
      ['missing fields', {}],
    ])('returns 400 { verified: false } for %s and writes nothing', async (_name, body) => {
      const res = await verify(post('/api/payment/verify', body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ verified: false });
      expect(writes).toEqual([]);
      expect(mocks.paymentsFetch).not.toHaveBeenCalled();
    });

    it('returns 200 { verified: true } for a correct signature, grants the extension and marks the order paid', async () => {
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ verified: true });
      expect(writesTo('chat_extensions')).toEqual([
        { table: 'chat_extensions', op: 'upsert', row: expect.objectContaining({ room_id: ROOM, payment_id: PAYMENT, extra_seconds: 120 }) },
      ]);
      expect(ledger[0]).toMatchObject({ order_id: ORDER, payment_id: PAYMENT, status: 'paid' });
      expect(mocks.paymentsFetch).toHaveBeenCalledWith(PAYMENT);
    });

    it.each([
      ['is failed', { status: 'failed' }],
      ['is authorized but not captured', { status: 'authorized' }],
      ['is only created', { status: 'created' }],
      ['belongs to a different order', { order_id: 'order_other' }],
    ])('refuses a correctly signed checkout when Razorpay says the payment %s (PAY-006)', async (_name, payment) => {
      mocks.paymentsFetch.mockResolvedValue({ ...capturedPayment, ...payment });
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ verified: false, reason: 'payment_not_captured' });
      expect(writes).toEqual([]);
      expect(ledger[0]).toMatchObject({ status: 'created', payment_id: null });
    });

    it.each([
      ['amount', { amount: 100 }],
      ['currency', { currency: 'USD' }],
    ])('refuses a captured payment whose %s differs from the ledger (PAY-006, PAY-002)', async (_name, payment) => {
      mocks.paymentsFetch.mockResolvedValue({ ...capturedPayment, ...payment });
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ verified: false, reason: 'amount_mismatch' });
      expect(writes).toEqual([]);
    });

    it('accepts the amount as a numeric string, which the Razorpay SDK types allow', async () => {
      mocks.paymentsFetch.mockResolvedValue({ ...capturedPayment, amount: '2900' });
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(200);
      expect(ledger[0]).toMatchObject({ status: 'paid' });
    });

    it('grants nothing when the payment cannot be fetched from Razorpay (PAY-006)', async () => {
      mocks.paymentsFetch.mockRejectedValue(new Error('Razorpay is unreachable'));
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ verified: false, reason: 'payment_unconfirmed' });
      expect(writes).toEqual([]);
      expect(ledger[0]).toMatchObject({ status: 'created', payment_id: null });
    });

    it('a captured payment for a room that no longer exists is recorded as fulfilment_failed, not granted (PAY-010)', async () => {
      grantError = ROOM_MISSING;
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ verified: false, reason: 'fulfilment_failed' });
      expect(writesTo('chat_extensions')).toEqual([]);
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'fulfilment_failed' });
    });

    it("refuses another user's order with 403 and grants nothing (PAY-004)", async () => {
      mocks.userId = 'user_bob';
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(403);
      expect(writes).toEqual([]);
      expect(ledger[0]).toMatchObject({ status: 'created', payment_id: null });
    });

    it('refuses a correctly signed order that is not in the ledger', async () => {
      const res = await verify(post('/api/payment/verify', checkoutResponse('order_unknown')));
      expect(res.status).toBe(403);
      expect(writes).toEqual([]);
    });

    it('replaying a verified payment grants nothing more (PAY-008)', async () => {
      await verify(post('/api/payment/verify', checkoutResponse()));
      const before = writes.length;
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(200);
      expect(writes.length).toBe(before);
    });
  });

  describe('webhook', () => {
    beforeEach(() => seedOrder());

    it('returns 400 on a bad signature and writes nothing', async () => {
      const res = await webhook(signedWebhook(capturedEvent, 'wrong_secret_0123456789'));
      expect(res.status).toBe(400);
      expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
    });

    it('rejects a body that was changed after signing (PAY-007)', async () => {
      const signed = signedWebhook(capturedEvent);
      const res = await webhook(new Request(signed.url, { method: 'POST', body: capturedEvent.replace('2900', '2900 '), headers: signed.headers }));
      expect(res.status).toBe(400);
      expect(writes).toEqual([]);
    });

    it('returns 400 for a signed body that is not a Razorpay event (PAY-007)', async () => {
      const res = await webhook(signedWebhook('not json'));
      expect(res.status).toBe(400);
      expect(writes).toEqual([]);
    });

    it('payment.captured grants the extension and marks the order paid', async () => {
      const res = await webhook(signedWebhook(capturedEvent));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result: 'fulfilled' });
      expect(writesTo('chat_extensions')).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'paid' });
    });

    it('a second payment.captured event for a paid order is acknowledged without granting again (PAY-008)', async () => {
      await webhook(signedWebhook(capturedEvent));
      const before = ledgerAndGrantWrites().length;
      const res = await webhook(signedWebhook(capturedEvent));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result: 'already_processed' });
      expect(ledgerAndGrantWrites().length).toBe(before);
    });

    it('records each handled event with its id and outcome (PAY-008)', async () => {
      await webhook(signedWebhook(capturedEvent));
      expect(events).toEqual([{ event_id: 'evt_test_1', event: 'payment.captured', order_id: ORDER, payment_id: PAYMENT, outcome: 'fulfilled' }]);
    });

    it('a redelivered event id is skipped before anything is written (PAY-008)', async () => {
      await webhook(signedWebhook(capturedEvent, undefined, 'evt_same'));
      const before = writes.length;
      const res = await webhook(signedWebhook(capturedEvent, undefined, 'evt_same'));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result: 'duplicate_event' });
      expect(writes.length).toBe(before);
      expect(events).toHaveLength(1);
    });

    it('a redelivered payment.failed cannot undo a retry that has since succeeded', async () => {
      await webhook(signedWebhook(paymentEvent('payment.failed', { id: 'pay_failed_1' }), undefined, 'evt_failed'));
      await webhook(signedWebhook(capturedEvent));
      const res = await webhook(signedWebhook(paymentEvent('payment.failed', { id: 'pay_failed_1' }), undefined, 'evt_failed'));
      expect(await res.json()).toEqual({ ok: true, result: 'duplicate_event' });
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'paid' });
    });

    it('a captured payment for a room that no longer exists is recorded as fulfilment_failed and acknowledged (PAY-010)', async () => {
      grantError = ROOM_MISSING;
      const res = await webhook(signedWebhook(capturedEvent));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result: 'fulfilment_failed' });
      expect(writesTo('chat_extensions')).toEqual([]);
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'fulfilment_failed' });
      expect(events[0]).toMatchObject({ outcome: 'fulfilment_failed' });
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining('fulfilment_failed'),
        expect.objectContaining({ orderId: ORDER, paymentId: PAYMENT, reason: 'room_not_found' }),
      );
    });

    it('a captured payment for a room the buyer is not in is recorded as fulfilment_failed (PAY-010)', async () => {
      ledger[0].room_id = 'user_bob_user_carol';
      const res = await webhook(signedWebhook(capturedEvent));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result: 'fulfilment_failed' });
      expect(writesTo('chat_extensions')).toEqual([]);
      expect(ledger[0]).toMatchObject({ status: 'fulfilment_failed' });
    });

    it('a temporary database error returns 500 and the redelivery of the same event then fulfils (PAY-010)', async () => {
      grantError = CONNECTION_LOST;
      const first = await webhook(signedWebhook(capturedEvent, undefined, 'evt_retry'));
      expect(first.status).toBe(500);
      expect(ledger[0]).toMatchObject({ status: 'created', payment_id: null });
      expect(events).toEqual([]);

      grantError = null;
      const second = await webhook(signedWebhook(capturedEvent, undefined, 'evt_retry'));
      expect(await second.json()).toEqual({ ok: true, result: 'fulfilled' });
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'paid' });
    });

    it('an order left fulfilment_failed is settled by a later event once the cause is gone (PAY-010)', async () => {
      grantError = ROOM_MISSING;
      await webhook(signedWebhook(capturedEvent));
      grantError = null;
      const res = await webhook(signedWebhook(capturedEvent));
      expect(await res.json()).toEqual({ ok: true, result: 'fulfilled' });
      expect(writesTo('chat_extensions')).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'paid' });
    });

    it('a late payment.failed never overwrites a fulfilment_failed order (PAY-009, PAY-010)', async () => {
      grantError = ROOM_MISSING;
      await webhook(signedWebhook(capturedEvent));
      await webhook(signedWebhook(paymentEvent('payment.failed', { id: 'pay_failed_1' })));
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'fulfilment_failed' });
    });

    it('verify followed by the webhook for the same payment grants once', async () => {
      await verify(post('/api/payment/verify', checkoutResponse()));
      await webhook(signedWebhook(capturedEvent));
      expect(writesTo('chat_extensions')).toHaveLength(1);
    });

    it('payment.failed marks the order failed and grants nothing', async () => {
      const res = await webhook(signedWebhook(paymentEvent('payment.failed')));
      expect(res.status).toBe(200);
      expect(writesTo('chat_extensions')).toEqual([]);
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'failed' });
    });

    it('a failed attempt can be followed by a successful one on the same order', async () => {
      await webhook(signedWebhook(paymentEvent('payment.failed', { id: 'pay_failed_1' })));
      await webhook(signedWebhook(capturedEvent));
      expect(writesTo('chat_extensions')).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'paid' });
    });

    it('a late payment.failed never downgrades a paid order (PAY-009)', async () => {
      await webhook(signedWebhook(capturedEvent));
      await webhook(signedWebhook(paymentEvent('payment.failed', { id: 'pay_failed_1' })));
      expect(ledger[0]).toMatchObject({ payment_id: PAYMENT, status: 'paid' });
    });

    it('a captured payment for an order with no ledger row grants nothing', async () => {
      const res = await webhook(signedWebhook(paymentEvent('payment.captured', { order_id: 'order_unknown' })));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, ignored: 'unknown_order' });
      expect(ledgerAndGrantWrites()).toEqual([]);
      expect(events[0]).toMatchObject({ order_id: 'order_unknown', outcome: 'unknown_order' });
    });

    it.each([
      ['amount', { amount: 100 }],
      ['currency', { currency: 'USD' }],
    ])('a captured payment whose %s differs from the ledger grants nothing (PAY-002)', async (_name, entity) => {
      const res = await webhook(signedWebhook(paymentEvent('payment.captured', entity)));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, ignored: 'amount_mismatch' });
      expect(ledgerAndGrantWrites()).toEqual([]);
      expect(events[0]).toMatchObject({ outcome: 'amount_mismatch' });
      expect(ledger[0]).toMatchObject({ status: 'created' });
    });

    it('other events are acknowledged, recorded and otherwise ignored', async () => {
      const res = await webhook(signedWebhook(paymentEvent('refund.processed')));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(ledgerAndGrantWrites()).toEqual([]);
      expect(events[0]).toMatchObject({ event: 'refund.processed', outcome: 'ignored_event' });
    });

    it('does not fetch the payment from Razorpay: the webhook acts on the signed payload and the ledger', async () => {
      await webhook(signedWebhook(capturedEvent));
      expect(mocks.paymentsFetch).not.toHaveBeenCalled();
    });
  });
});

// PAY-017, ID-001, ID-002, PAY-011. Alice pays to see Bob's real name and photo. Only Bob's
// own "allow" (a `reveal_requests` row with status 'allowed') makes that possible; no order,
// signature or webhook can stand in for it.
describe('Paid Mode: paying to see a name and photo', () => {
  const REVEAL_ORDER = { user_id: 'user_alice', room_id: ROOM, order_id: ORDER, status: 'created', amount: 2900, currency: 'INR', product: 'reveal' };
  const reveal = () => post('/api/payment/create-order', { type: 'reveal', roomId: ROOM });
  const ask = (status: string, overrides: Row = {}) =>
    requests.push({ requester_id: 'user_alice', target_id: 'user_bob', status, payment_id: null, ...overrides });

  beforeEach(() => {
    setEnv({ ...CREDENTIALS, BILLING_MODE: 'paid' });
    mocks.supabaseAdmin.mockImplementation(fakeSupabase);
    people.push({ clerk_id: 'user_bob', real_name: 'Bob Sharma' }, { clerk_id: 'user_alice', real_name: 'Alice Patel' });
  });

  describe('create-order', () => {
    it.each(['pending', 'declined', 'revealed'])('is refused while the request is %s, before any Razorpay order exists', async (status) => {
      ask(status);
      const res = await createOrder(reveal());
      expect(res.status).toBe(409);
      expect(mocks.ordersCreate).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    });

    it('is refused when nobody was ever asked: an order cannot create consent', async () => {
      const res = await createOrder(reveal());
      expect(res.status).toBe(409);
      expect(mocks.ordersCreate).not.toHaveBeenCalled();
      expect(requests).toEqual([]);
      expect(writes).toEqual([]);
    });

    it("is refused when only the opposite direction was allowed (Bob may see Alice, not Alice Bob)", async () => {
      requests.push({ requester_id: 'user_bob', target_id: 'user_alice', status: 'allowed', payment_id: null });
      expect((await createOrder(reveal())).status).toBe(409);
      expect(mocks.ordersCreate).not.toHaveBeenCalled();
    });

    it('is refused when the other dancer has no name to share', async () => {
      ask('allowed');
      people[0].real_name = '   ';
      expect((await createOrder(reveal())).status).toBe(409);
      expect(mocks.ordersCreate).not.toHaveBeenCalled();
    });

    it('once the other dancer has allowed it, creates the order at the fixed price and records it as a reveal', async () => {
      ask('allowed');
      const res = await createOrder(post('/api/payment/create-order', { type: 'reveal', roomId: ROOM, amount: 1 }));
      expect(res.status).toBe(200);
      expect(mocks.ordersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 2900, currency: 'INR' }));
      expect(writesTo('payment_orders')).toEqual([{ table: 'payment_orders', op: 'insert', row: REVEAL_ORDER }]);
      // Ordering alone reveals nothing.
      expect(requests[0]).toMatchObject({ status: 'allowed', payment_id: null });
    });
  });

  describe('fulfilment', () => {
    beforeEach(() => seedOrder({ product: 'reveal' }));

    it('a verified checkout reveals: the request becomes revealed with the payment id and the order is paid', async () => {
      ask('allowed');
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(200);
      // The response still carries no identity; the chat reads it from the room state afterwards.
      expect(await res.json()).toEqual({ verified: true });
      expect(requests[0]).toMatchObject({ status: 'revealed', payment_id: PAYMENT });
      expect(ledger[0]).toMatchObject({ status: 'paid', payment_id: PAYMENT });
      expect(writesTo('chat_extensions')).toEqual([]); // a reveal adds no chat time
    });

    it('the webhook alone reveals too, and verify plus webhook reveal once', async () => {
      ask('allowed');
      expect((await webhook(signedWebhook(capturedEvent))).status).toBe(200);
      expect(requests[0]).toMatchObject({ status: 'revealed', payment_id: PAYMENT });
      const again = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(again.status).toBe(200);
      expect(writesTo('reveal_requests')).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ status: 'paid' });
    });

    it.each([
      ['there is no request at all', null],
      ['the request is still pending', 'pending'],
      ['the other dancer declined, or withdrew their yes before the payment arrived', 'declined'],
    ])('a captured payment reveals nothing when %s; the order is kept for refund', async (_name, status) => {
      if (status) ask(status);
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ verified: false, reason: 'fulfilment_failed' });
      expect(writesTo('reveal_requests')).toEqual([]);
      expect(requests.map((r) => r.status)).toEqual(status ? [status] : []);
      expect(ledger[0]).toMatchObject({ status: 'fulfilment_failed', payment_id: PAYMENT });
    });

    it('the same holds for the webhook: no consent, nothing revealed, acknowledged and recorded', async () => {
      ask('declined');
      const res = await webhook(signedWebhook(capturedEvent));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result: 'fulfilment_failed' });
      expect(requests[0]).toMatchObject({ status: 'declined', payment_id: null });
    });

    it('a second payment for a pair already revealed changes nothing and is kept for refund', async () => {
      ask('revealed', { payment_id: 'pay_earlier' });
      const res = await verify(post('/api/payment/verify', checkoutResponse()));
      expect(res.status).toBe(409);
      expect(requests[0]).toMatchObject({ status: 'revealed', payment_id: 'pay_earlier' });
      expect(ledger[0]).toMatchObject({ status: 'fulfilment_failed' });
    });

    it('a redelivery after the reveal was granted but before the order was marked paid settles it without a second grant', async () => {
      ask('revealed', { payment_id: PAYMENT });
      const res = await webhook(signedWebhook(capturedEvent));
      expect(await res.json()).toEqual({ ok: true, result: 'fulfilled' });
      expect(writesTo('reveal_requests')).toEqual([]);
      expect(ledger[0]).toMatchObject({ status: 'paid', payment_id: PAYMENT });
    });

    it.each([
      ['a forged signature', { ...checkoutResponse(), razorpay_signature: 'f'.repeat(64) }, 400],
      ['a payment Razorpay has not captured', checkoutResponse(), 400],
    ])('%s reveals nothing', async (name, body, status) => {
      ask('allowed');
      if (name.includes('captured')) mocks.paymentsFetch.mockResolvedValue({ ...capturedPayment, status: 'authorized' });
      expect((await verify(post('/api/payment/verify', body))).status).toBe(status);
      expect(requests[0]).toMatchObject({ status: 'allowed', payment_id: null });
    });

    it("another user cannot settle Alice's reveal order", async () => {
      ask('allowed');
      mocks.userId = 'user_mallory';
      expect((await verify(post('/api/payment/verify', checkoutResponse()))).status).toBe(403);
      expect(requests[0]).toMatchObject({ status: 'allowed', payment_id: null });
    });

    it('with billing off, a correctly signed reveal payment reveals nothing', async () => {
      ask('allowed');
      setEnv({ BILLING_MODE: '' });
      expect((await verify(post('/api/payment/verify', checkoutResponse()))).status).toBe(403);
      expect((await webhook(signedWebhook(capturedEvent))).status).toBe(200);
      expect(requests[0]).toMatchObject({ status: 'allowed', payment_id: null });
      expect(ledger[0]).toMatchObject({ status: 'created' });
    });
  });

  it('paying for an extension never reveals anyone, even where a reveal has been allowed', async () => {
    ask('allowed');
    seedOrder(); // an ordinary extension order
    expect((await verify(post('/api/payment/verify', checkoutResponse()))).status).toBe(200);
    expect(writesTo('chat_extensions')).toHaveLength(1);
    expect(writesTo('reveal_requests')).toEqual([]);
    expect(requests[0]).toMatchObject({ status: 'allowed', payment_id: null });
  });
});
