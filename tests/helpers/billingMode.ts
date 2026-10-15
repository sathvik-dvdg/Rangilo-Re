import { vi } from 'vitest';

// Fake, well-formed test-mode values: enough for the billing readiness check, never used to pay.
const PAID_ENV = {
  BILLING_MODE: 'paid',
  RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
  RAZORPAY_KEY_SECRET: 'fake_key_secret_0123456789',
  RAZORPAY_WEBHOOK_SECRET: 'fake_webhook_secret_0123',
  NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
};

/** Runs `fn` with the billing mode the server would resolve as effective `mode`. */
export function inMode<T>(mode: 'free' | 'paid', fn: () => T): T {
  if (mode === 'paid') for (const [k, v] of Object.entries(PAID_ENV)) vi.stubEnv(k, v);
  else vi.stubEnv('BILLING_MODE', '');
  try {
    return fn();
  } finally {
    vi.unstubAllEnvs();
  }
}
