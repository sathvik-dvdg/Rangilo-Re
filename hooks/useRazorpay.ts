'use client';

import { useCallback, useState } from 'react';
import { isRecord } from '@/lib/utils';
import type { PaymentType } from '@/lib/types';

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

let scriptPromise: Promise<boolean> | null = null;
function loadRazorpay(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  scriptPromise ??= new Promise<boolean>((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => {
      // Forget the failed attempt and its tag so the next click can try again.
      scriptPromise = null;
      s.remove();
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export type CheckoutResult = { verified: true } | { verified: false; error: string };

export type CheckoutOptions = {
  orderId: string;
  amount: number;
  currency: string;
  /** Public key id from create-order. Never a secret. */
  keyId: string;
  description?: string;
  prefill?: { name?: string; email?: string };
  onSuccess?: (result: { verified: true }) => void;
  onFailure?: (error: string) => void;
};

const failed = (error: string): CheckoutResult => ({ verified: false, error });

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const data: unknown = await res.json().catch(() => null);
  return isRecord(data) ? data : {};
}

async function verifyPayment(response: RazorpayResponse): Promise<CheckoutResult> {
  const unverified = failed('We could not verify that payment. If you were charged, it will unlock shortly.');
  try {
    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });
    const data = await readJson(res);
    return res.ok && data.verified === true ? { verified: true } : unverified;
  } catch {
    return unverified;
  }
}

/**
 * Opens Razorpay checkout for an order the server already created. Resolves
 * once the outcome is known: `{ verified: true }` only after the server has
 * verified the payment (PAY-014: the client never grants anything itself),
 * otherwise `{ verified: false, error }`. `onSuccess` / `onFailure` are called
 * with the same outcome. Never rejects.
 */
export async function openCheckout({ orderId, amount, currency, keyId, description, prefill, onSuccess, onFailure }: CheckoutOptions): Promise<CheckoutResult> {
  const Checkout = (await loadRazorpay()) ? window.Razorpay : undefined;

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      if (result.verified) onSuccess?.(result);
      else onFailure?.(result.error);
      resolve(result);
    };

    if (!Checkout) return finish(failed('Could not load Razorpay. Check your connection.'));

    const rzp = new Checkout({
      key: keyId,
      amount,
      currency,
      order_id: orderId,
      name: 'GarbaConnect',
      description,
      prefill,
      theme: { color: '#B23A2E' },
      modal: { ondismiss: () => finish(failed('Payment cancelled.')) },
      handler: async (response: RazorpayResponse) => finish(await verifyPayment(response)),
    });
    rzp.on('payment.failed', () => finish(failed('Payment failed. You have not been charged.')));
    rzp.open();
  });
}

/**
 * Pays ₹29 for a chat extension or, once the other dancer has agreed, for
 * seeing their name and photo. The server creates the order (fixing the amount
 * and what it buys, and refusing a reveal nobody agreed to) and verifies the
 * signature; the UI only changes after the server says the payment is good.
 */
export function useRazorpay() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(async (roomId: string, type: PaymentType = 'extend', prefill?: { name?: string; email?: string }): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const fail = (message: string) => {
      setError(message);
      setBusy(false);
      return false;
    };

    let order: Record<string, unknown>;
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, roomId }),
      });
      order = await readJson(res);
      if (!res.ok) return fail(typeof order.error === 'string' ? order.error : 'Could not start payment.');
    } catch {
      return fail('Could not start payment.');
    }

    const { orderId, amount, currency, keyId } = order;
    if (typeof orderId !== 'string' || typeof amount !== 'number' || typeof currency !== 'string' || typeof keyId !== 'string') {
      return fail('Could not start payment.');
    }

    const result = await openCheckout({ orderId, amount, currency, keyId, description: type === 'reveal' ? 'See name and photo' : 'Extend Chat', prefill });
    if (!result.verified) return fail(result.error);
    setBusy(false);
    return true;
  }, []);

  return { pay, openCheckout, busy, error, clearError: () => setError(null) };
}
