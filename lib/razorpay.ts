import 'server-only';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { isBillingEnabled } from './billing';

// Paid Mode is for Razorpay test keys only. Do not enable it in production:
// the OBJECTIVES.md §8 gates are not met.

let client: Razorpay | null = null;

function setting(name: 'RAZORPAY_KEY_ID' | 'RAZORPAY_KEY_SECRET' | 'RAZORPAY_WEBHOOK_SECRET') {
  return process.env[name]?.trim() ?? '';
}

export function razorpay() {
  // Routes check first; this stops any future caller reaching Razorpay in Free Mode (FREE-002).
  if (!isBillingEnabled()) throw new Error('Billing is not enabled');
  // isBillingEnabled() has already checked that both values are set and well formed.
  client ??= new Razorpay({ key_id: setting('RAZORPAY_KEY_ID'), key_secret: setting('RAZORPAY_KEY_SECRET') });
  return client;
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** False when the secret is not configured, so a missing secret can never verify anything. */
function verifyHmac(secret: string, payload: string, signature: string) {
  if (!secret || !signature) return false;
  return safeEqualHex(crypto.createHmac('sha256', secret).update(payload).digest('hex'), signature);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  return verifyHmac(setting('RAZORPAY_KEY_SECRET'), `${orderId}|${paymentId}`, signature);
}

/** `rawBody` must be the exact bytes Razorpay sent, not re-serialised JSON. */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  return verifyHmac(setting('RAZORPAY_WEBHOOK_SECRET'), rawBody, signature);
}
