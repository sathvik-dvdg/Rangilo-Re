'use client';

import { useCallback, useState } from 'react';
import type { PaymentType, RevealedIdentity } from '@/lib/types';

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

let scriptPromise: Promise<boolean> | null = null;
function loadRazorpay() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(true);
  scriptPromise ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export type PaymentResult = { type: 'reveal'; identity: RevealedIdentity } | { type: 'extend' };

/**
 * Opens Razorpay checkout for a ₹29 unlock. The server creates the order
 * (fixing the amount and what it unlocks) and verifies the signature; the UI
 * only changes after the server says the payment is good.
 */
export function useRazorpay() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(
    (type: PaymentType, ctx: { targetUserId?: string; roomId?: string; prefill?: { name?: string; email?: string } }) =>
      new Promise<PaymentResult | null>(async (resolve) => {
        setBusy(true);
        setError(null);
        const fail = (msg: string) => {
          setError(msg);
          setBusy(false);
          resolve(null);
        };

        if (!(await loadRazorpay()) || !window.Razorpay) return fail('Could not load Razorpay. Check your connection.');

        const orderRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, targetUserId: ctx.targetUserId, roomId: ctx.roomId }),
        });
        const order = await orderRes.json().catch(() => ({}));
        if (!orderRes.ok) return fail(order.error ?? 'Could not start payment.');

        const rzp = new window.Razorpay({
          key: order.keyId, // public key id only
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'GarbaConnect',
          description: type === 'reveal' ? 'Reveal Identity' : 'Extend Chat',
          prefill: ctx.prefill,
          theme: { color: '#B23A2E' },
          modal: { ondismiss: () => fail('Payment cancelled.') },
          handler: async (r: RazorpayResponse) => {
            const res = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) return fail(data.error ?? 'We could not verify that payment. If you were charged, it will unlock shortly.');
            setBusy(false);
            resolve(data.type === 'reveal' ? { type: 'reveal', identity: data.identity } : { type: 'extend' });
          },
        });
        rzp.on('payment.failed', () => fail('Payment failed. You have not been charged.'));
        rzp.open();
      }),
    [],
  );

  return { pay, busy, error, clearError: () => setError(null) };
}
