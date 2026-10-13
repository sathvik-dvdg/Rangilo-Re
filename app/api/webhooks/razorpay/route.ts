import { isBillingEnabled } from '@/lib/billing';
import { fulfilOrder, getOrder, hasProcessedEvent, recordEvent, recordFailedPayment } from '@/lib/payments';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { isRecord } from '@/lib/utils';

export const runtime = 'nodejs';

type WebhookEvent = {
  event: string;
  payment: { id: string; orderId: string; amount: number | null; currency: string | null } | null;
};

function parseEvent(raw: string): WebhookEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(body) || typeof body.event !== 'string') return null;
  const wrapper = isRecord(body.payload) ? body.payload.payment : undefined;
  const entity = isRecord(wrapper) ? wrapper.entity : undefined;
  if (!isRecord(entity) || typeof entity.id !== 'string' || typeof entity.order_id !== 'string') {
    return { event: body.event, payment: null };
  }
  return {
    event: body.event,
    payment: {
      id: entity.id,
      orderId: entity.order_id,
      amount: typeof entity.amount === 'number' ? entity.amount : null,
      currency: typeof entity.currency === 'string' ? entity.currency : null,
    },
  };
}

type Ids = { eventId?: string; event: string; paymentId?: string; orderId?: string };
/** `outcome` goes to the webhook_events row, `body` back to Razorpay. */
type Handled = { outcome: string; body: Record<string, unknown> };

/** Acts on one signed event. Throws only for a failure that a later delivery might get past. */
async function handleEvent(event: WebhookEvent, ids: Ids): Promise<Handled> {
  if (!event.payment || (event.event !== 'payment.captured' && event.event !== 'payment.failed')) {
    return { outcome: 'ignored_event', body: { ok: true } };
  }
  const { payment } = event;

  const order = await getOrder(payment.orderId);
  if (!order) {
    // Not an order this app created, so there is nothing it could unlock.
    console.warn('[billing] webhook for an order with no ledger row; nothing granted', ids);
    return { outcome: 'unknown_order', body: { ok: true, ignored: 'unknown_order' } };
  }

  if (event.event === 'payment.failed') {
    await recordFailedPayment(order, payment.id);
    return { outcome: 'payment_failed', body: { ok: true } };
  }

  if (payment.amount !== order.amount || payment.currency !== order.currency) {
    // Retrying cannot fix this, so acknowledge it and leave it for manual review or refund.
    console.error('[billing] captured payment does not match the ledger amount or currency; nothing granted', ids);
    return { outcome: 'amount_mismatch', body: { ok: true, ignored: 'amount_mismatch' } };
  }

  // Idempotent: an order already marked paid is not written again (PAY-008).
  // A permanent failure comes back as 'fulfilment_failed', already recorded
  // on the ledger, and is acknowledged like any other outcome (PAY-010).
  const result = await fulfilOrder(order, payment.id);
  return { outcome: result, body: { ok: true, result } };
}

/**
 * Safety net for checkouts where the browser closed before calling
 * /api/payment/verify. Register for `payment.captured` and `payment.failed`
 * in the Razorpay dashboard. No Clerk auth: the signature is the only proof
 * of origin, so it is checked on the raw body before anything else.
 *
 * Paid Mode must not be enabled in production: the OBJECTIVES.md §8 gates are not met.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  if (!verifyWebhookSignature(raw, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = parseEvent(raw);
  const eventId = req.headers.get('x-razorpay-event-id') ?? undefined;
  const ids: Ids = { eventId, event: event?.event ?? 'unparseable', paymentId: event?.payment?.id, orderId: event?.payment?.orderId };

  if (!isBillingEnabled()) {
    // FREE-004: with billing off nothing is granted, whatever the event says.
    // Log the ids so the payment can be reviewed or refunded. 200 stops
    // Razorpay retrying an event we will never act on.
    console.warn('[billing] webhook received while billing is off; nothing granted', ids);
    return Response.json({ ok: true, ignored: 'billing_disabled' });
  }

  if (!event) {
    console.error('[billing] signed webhook body is not a Razorpay event', { eventId });
    return Response.json({ error: 'Malformed event' }, { status: 400 });
  }

  try {
    // Razorpay redelivers an event under the same id. One that has already
    // been handled is acknowledged without being acted on again (PAY-008).
    if (eventId && (await hasProcessedEvent(eventId))) {
      return Response.json({ ok: true, result: 'duplicate_event' });
    }

    const { outcome, body } = await handleEvent(event, ids);
    // Recorded only now that handling has finished: after a 500 the event is
    // not on record, so the redelivery is processed, not skipped.
    if (eventId) await recordEvent({ eventId, event: event.event, orderId: ids.orderId, paymentId: ids.paymentId, outcome });
    return Response.json(body);
  } catch (e) {
    console.error('razorpay webhook', e);
    // 500 makes Razorpay retry later.
    return Response.json({ error: 'fulfil failed' }, { status: 500 });
  }
}
