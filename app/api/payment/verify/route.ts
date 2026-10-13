import { billingDisabledResponse } from '@/lib/billing';
import { fulfilOrder, getOrder } from '@/lib/payments';
import { razorpay, verifyCheckoutSignature } from '@/lib/razorpay';
import { HttpError, errorResponse, requireUserId } from '@/lib/server';
import { isRecord } from '@/lib/utils';

export const runtime = 'nodejs';

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    // Before touching the body, the database or Razorpay (FREE-004).
    // Paid Mode must not be enabled in production: the OBJECTIVES.md §8 gates are not met.
    const disabled = billingDisabledResponse();
    if (disabled) return disabled;

    const body: unknown = await req.json().catch(() => null);
    const fields = isRecord(body) ? body : {};
    const orderId = text(fields.razorpay_order_id);
    const paymentId = text(fields.razorpay_payment_id);
    const signature = text(fields.razorpay_signature);

    // HMAC-SHA256 of "order_id|payment_id" with RAZORPAY_KEY_SECRET (PAY-005).
    if (!orderId || !paymentId || !verifyCheckoutSignature(orderId, paymentId, signature)) {
      return Response.json({ verified: false }, { status: 400 });
    }

    // The signature proves Razorpay took this payment for this order. Who
    // owns the order and what it buys come from our ledger, never from the
    // request body (PAY-004).
    const order = await getOrder(orderId);
    if (!order || order.user_id !== userId) throw new HttpError(403, 'Order does not belong to you');

    // The signature alone does not say the money arrived. Ask Razorpay for
    // the payment itself and grant only a captured payment for this order at
    // the ledger's amount and currency (PAY-006). An authorized payment is
    // refused here; the webhook settles it once payment.captured arrives.
    const payment = await razorpay()
      .payments.fetch(paymentId)
      .catch(() => null);
    if (!payment) {
      // Razorpay could not be asked, so nothing is confirmed and nothing is granted.
      console.error('[billing] could not fetch the payment from Razorpay; nothing granted', { orderId, paymentId });
      return Response.json({ verified: false, reason: 'payment_unconfirmed' }, { status: 502 });
    }
    if (payment.order_id !== orderId || payment.status !== 'captured') {
      return Response.json({ verified: false, reason: 'payment_not_captured' }, { status: 400 });
    }
    if (Number(payment.amount) !== order.amount || payment.currency !== order.currency) {
      console.error('[billing] captured payment does not match the ledger amount or currency; nothing granted', { orderId, paymentId });
      return Response.json({ verified: false, reason: 'amount_mismatch' }, { status: 400 });
    }

    const result = await fulfilOrder(order, paymentId);
    if (result === 'fulfilment_failed') {
      // Paid, but there is nothing to grant it to: the ledger row is kept for review or refund (PAY-010).
      return Response.json({ verified: false, reason: 'fulfilment_failed' }, { status: 409 });
    }
    return Response.json({ verified: true });
  } catch (e) {
    return errorResponse(e);
  }
}
