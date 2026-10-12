// FREE-004 / CFG-002 / CFG-003: payment routes are inert unless Paid Mode is effective.
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  ordersCreate: vi.fn(),
  ordersFetch: vi.fn(),
  razorpayClient: vi.fn(),
  supabaseAdmin: vi.fn(),
  fulfill: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: mocks.userId }) }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.supabaseAdmin }));
vi.mock('@/lib/razorpay', async (importOriginal) => ({
  // Keep the real signature checks; replace only the SDK client.
  ...(await importOriginal<typeof import('@/lib/razorpay')>()),
  razorpay: mocks.razorpayClient,
}));
vi.mock('@/lib/payments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payments')>()),
  fulfill: mocks.fulfill,
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

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v as string);
}

const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) });

function signedWebhook(body: string, secret = CREDENTIALS.RAZORPAY_WEBHOOK_SECRET) {
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return new Request('http://localhost/api/webhooks/razorpay', {
    method: 'POST',
    body,
    headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'evt_test_1' },
  });
}

const capturedEvent = JSON.stringify({
  event: 'payment.captured',
  payload: { payment: { entity: { id: 'pay_test_1', order_id: 'order_test_1', amount: 2900 } } },
});

let warnLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.userId = 'user_alice';
  mocks.ordersCreate.mockResolvedValue({ id: 'order_test_1' });
  mocks.ordersFetch.mockResolvedValue({ amount: 2900, notes: { type: 'extend', userId: 'user_alice', roomId: ROOM } });
  mocks.razorpayClient.mockReturnValue({ orders: { create: mocks.ordersCreate, fetch: mocks.ordersFetch } });
  mocks.supabaseAdmin.mockImplementation(() => {
    throw new Error('the database must not be touched');
  });
  resetBillingDiagnostics();
  vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('verify returns 403 billing_disabled and grants nothing', async () => {
    const res = await verify(post('/api/payment/verify', { orderId: 'order_x', paymentId: 'pay_x', signature: 'sig' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'billing_disabled' });
    expect(mocks.razorpayClient).not.toHaveBeenCalled();
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
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
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
    expect(warnLog).toHaveBeenCalledWith(
      expect.stringContaining('nothing granted'),
      expect.objectContaining({ eventId: 'evt_test_1', paymentId: 'pay_test_1', orderId: 'order_test_1' }),
    );
  });

  it('a signed but unparseable webhook body does not crash and grants nothing', async () => {
    const res = await webhook(signedWebhook('not json'));
    expect(res.status).toBe(200);
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it('a webhook with a bad signature is still rejected', async () => {
    const res = await webhook(signedWebhook(capturedEvent, 'wrong_secret_0123456789'));
    expect(res.status).toBe(400);
    expect(mocks.fulfill).not.toHaveBeenCalled();
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
    const res = await verify(post('/api/payment/verify', { orderId: 'order_x', paymentId: 'pay_x', signature: 'sig' }));
    expect(res.status).toBe(503);
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it('a correctly signed webhook grants nothing', async () => {
    const res = await webhook(signedWebhook(capturedEvent));
    expect(res.status).toBe(200);
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.razorpayClient).not.toHaveBeenCalled();
  });
});

describe('Paid Mode ready (control: existing behaviour is unchanged)', () => {
  beforeEach(() => setEnv({ ...CREDENTIALS, BILLING_MODE: 'paid' }));

  it('create-order reaches Razorpay with the server-fixed amount', async () => {
    const res = await createOrder(post('/api/payment/create-order', { type: 'extend', roomId: ROOM }));
    expect(res.status).toBe(200);
    expect(mocks.ordersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 2900, currency: 'INR' }));
  });

  it('a correctly signed captured webhook is fulfilled', async () => {
    const res = await webhook(signedWebhook(capturedEvent));
    expect(res.status).toBe(200);
    expect(mocks.ordersFetch).toHaveBeenCalledWith('order_test_1');
    expect(mocks.fulfill).toHaveBeenCalledTimes(1);
  });
});
