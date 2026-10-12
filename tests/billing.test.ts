// TEST-002: billing-mode resolution and Paid Mode readiness (CFG-001, CFG-002, CFG-003).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  billingDisabledResponse,
  getBillingStatus,
  resetBillingDiagnostics,
  resolveRequestedMode,
} from '@/lib/billing';
import { razorpay } from '@/lib/razorpay';

// Fake, well-formed values. Never real credentials.
const READY = {
  RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
  RAZORPAY_KEY_SECRET: 'fake_key_secret_0123456789',
  RAZORPAY_WEBHOOK_SECRET: 'fake_webhook_secret_0123',
  NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
  NODE_ENV: 'test',
};

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetBillingDiagnostics();
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('CFG-001: BILLING_MODE resolution', () => {
  it.each([
    [undefined, 'free', false],
    ['', 'free', false],
    ['   ', 'free', false],
    ['free', 'free', false],
    ['FREE', 'free', false],
    ['paid', 'paid', false],
    ['paid ', 'paid', false],
    ['Paid', 'paid', false],
    [' PAID ', 'paid', false],
    ['true', 'free', true],
    ['1', 'free', true],
    ['premium', 'free', true],
    ['paid-mode', 'free', true],
    ['p aid', 'free', true],
  ])('%j requests %s (invalid: %s)', (raw, requested, invalid) => {
    const r = resolveRequestedMode(raw);
    expect(r.requested).toBe(requested);
    expect(Boolean(r.problem)).toBe(invalid);
  });

  it('an invalid value logs exactly one error, without echoing the value', () => {
    const env = { ...READY, BILLING_MODE: 'premium' };
    expect(getBillingStatus(env).mode).toBe('free');
    getBillingStatus(env);
    getBillingStatus(env);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0][0])).toContain('BILLING_MODE');
    expect(String(errorLog.mock.calls[0][0])).not.toContain('premium');
  });

  it('missing or "free" logs nothing', () => {
    getBillingStatus({});
    getBillingStatus({ BILLING_MODE: 'free' });
    expect(errorLog).not.toHaveBeenCalled();
  });
});

describe('CFG-003: credentials never imply Paid Mode', () => {
  it.each([undefined, '', 'free', 'yes'])('BILLING_MODE=%j with full valid credentials stays free', (mode) => {
    expect(getBillingStatus({ ...READY, BILLING_MODE: mode }).mode).toBe('free');
  });

  it('paid with full valid credentials is paid', () => {
    const s = getBillingStatus({ ...READY, BILLING_MODE: 'paid' });
    expect(s).toEqual({ mode: 'paid', requested: 'paid', problems: [] });
    expect(errorLog).not.toHaveBeenCalled();
  });
});

describe('CFG-002: Paid Mode fails closed', () => {
  const paid = (overrides: Record<string, string | undefined>) =>
    getBillingStatus({ ...READY, BILLING_MODE: 'paid', ...overrides });

  it.each([
    ['RAZORPAY_KEY_ID', { RAZORPAY_KEY_ID: undefined }],
    ['RAZORPAY_KEY_ID', { RAZORPAY_KEY_ID: 'rzp_test_xxx' }],
    ['RAZORPAY_KEY_ID', { RAZORPAY_KEY_ID: 'rzp_test_xxxxxxxxxx', NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_xxxxxxxxxx' }],
    ['RAZORPAY_KEY_ID', { RAZORPAY_KEY_ID: 'key_FakeKey12345678' }],
    ['RAZORPAY_KEY_SECRET', { RAZORPAY_KEY_SECRET: undefined }],
    ['RAZORPAY_KEY_SECRET', { RAZORPAY_KEY_SECRET: '' }],
    ['RAZORPAY_KEY_SECRET', { RAZORPAY_KEY_SECRET: 'xxx' }],
    ['RAZORPAY_KEY_SECRET', { RAZORPAY_KEY_SECRET: 'short' }],
    ['RAZORPAY_WEBHOOK_SECRET', { RAZORPAY_WEBHOOK_SECRET: undefined }],
    ['RAZORPAY_WEBHOOK_SECRET', { RAZORPAY_WEBHOOK_SECRET: 'xxx' }],
    ['NEXT_PUBLIC_RAZORPAY_KEY_ID', { NEXT_PUBLIC_RAZORPAY_KEY_ID: undefined }],
    ['NEXT_PUBLIC_RAZORPAY_KEY_ID', { NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_OtherKey1234567' }],
  ])('%s problem keeps billing off', (variable, overrides) => {
    const s = paid(overrides);
    expect(s.mode).toBe('free');
    expect(s.requested).toBe('paid');
    expect(s.problems.map((p) => p.variable)).toContain(variable);
  });

  it('a live key is rejected outside a production build', () => {
    const live = { RAZORPAY_KEY_ID: 'rzp_live_FakeKey12345678', NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_live_FakeKey12345678' };
    expect(paid({ ...live, NODE_ENV: 'development' }).mode).toBe('free');
    expect(paid({ ...live, NODE_ENV: 'production' }).mode).toBe('paid');
  });

  it('no credentials at all keeps billing off and names every missing variable', () => {
    const s = getBillingStatus({ BILLING_MODE: 'paid' });
    expect(s.mode).toBe('free');
    expect(s.problems.map((p) => p.variable).sort()).toEqual(
      ['NEXT_PUBLIC_RAZORPAY_KEY_ID', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'].sort(),
    );
  });

  it('diagnostics never contain configured values', () => {
    paid({ NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_OtherKey1234567', RAZORPAY_WEBHOOK_SECRET: 'tooshort' });
    const logged = errorLog.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toBe('');
    for (const value of [...Object.values(READY), 'rzp_test_OtherKey1234567', 'tooshort']) {
      if (value.length > 4) expect(logged).not.toContain(value);
    }
  });
});

describe('billingDisabledResponse', () => {
  it('403 billing_disabled when billing is off', async () => {
    const res = billingDisabledResponse(getBillingStatus({ ...READY }))!;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'billing_disabled' });
  });

  it('503 billing_unavailable when Paid Mode is requested but not ready', async () => {
    const res = billingDisabledResponse(getBillingStatus({ BILLING_MODE: 'paid' }))!;
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'billing_unavailable' });
  });

  it('null when Paid Mode is ready', () => {
    expect(billingDisabledResponse(getBillingStatus({ ...READY, BILLING_MODE: 'paid' }))).toBeNull();
  });
});

describe('FREE-002: the Razorpay client cannot be built in Free Mode', () => {
  it('razorpay() throws when billing is off, even with valid credentials', () => {
    for (const [k, v] of Object.entries(READY)) vi.stubEnv(k, v);
    vi.stubEnv('BILLING_MODE', '');
    expect(() => razorpay()).toThrow('Billing is not enabled');
  });
});
