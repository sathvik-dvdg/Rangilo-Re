import 'server-only';
import { supabaseAdmin } from './supabaseAdmin';
import { partnerFromRoomId } from './room';
import { grantReveal } from './reveal';
import { isRecord } from './utils';
import type { PaymentType } from './types';

/**
 * Payment ledger (PAY-003): one `payment_orders` row per Razorpay order this
 * app created. Every function here uses the service role client, so callers
 * must authorise first: a signed-in user for create-order, a verified
 * checkout signature for verify, a verified webhook signature for the webhook.
 *
 * Do not enable Paid Mode in production: the OBJECTIVES.md §8 gates are not met.
 */

/** 'fulfilment_failed': the payment was captured but nothing could be granted (PAY-010). */
export type PaymentOrderStatus = 'created' | 'paid' | 'failed' | 'fulfilment_failed';

const ORDER_STATUSES: readonly unknown[] = ['created', 'paid', 'failed', 'fulfilment_failed'] satisfies PaymentOrderStatus[];
const isOrderStatus = (value: unknown): value is PaymentOrderStatus => ORDER_STATUSES.includes(value);

export type PaymentOrder = {
  user_id: string;
  room_id: string;
  order_id: string;
  payment_id: string | null;
  status: PaymentOrderStatus;
  amount: number;
  currency: string;
  /** What the order buys. Fixed when the order is created, never taken from a later request. */
  product: PaymentType;
};

/** What create-order writes on the Razorpay order, for reading in their dashboard only. */
export type OrderNotes = { type: PaymentType; userId: string; roomId: string };

// Every column: `product` (migration 0008) may not exist yet, and a row without it is an extension.
const ORDER_COLUMNS = '*';
const EXTENSION_SECONDS = 120;

function toPaymentOrder(row: unknown): PaymentOrder {
  if (isRecord(row)) {
    const { user_id, room_id, order_id, payment_id, status, amount, currency } = row;
    const product: PaymentType = row.product === 'reveal' ? 'reveal' : 'extend';
    if (
      typeof user_id === 'string' &&
      typeof room_id === 'string' &&
      typeof order_id === 'string' &&
      isOrderStatus(status) &&
      typeof amount === 'number' &&
      typeof currency === 'string'
    ) {
      return { user_id, room_id, order_id, payment_id: typeof payment_id === 'string' ? payment_id : null, status, amount, currency, product };
    }
  }
  throw new Error('Malformed payment_orders row');
}

export async function recordOrder(order: { userId: string; roomId: string; orderId: string; amount: number; currency: string; product: PaymentType }) {
  const { error } = await supabaseAdmin().from('payment_orders').insert({
    user_id: order.userId,
    room_id: order.roomId,
    order_id: order.orderId,
    status: 'created',
    amount: order.amount,
    currency: order.currency,
    // 'extend' is the column default, so an extension order needs no `product` column to exist.
    ...(order.product === 'reveal' ? { product: 'reveal' } : {}),
  });
  if (error) throw error;
}

/** Null when this app never created the order: nothing may be granted for it. */
export async function getOrder(orderId: string): Promise<PaymentOrder | null> {
  const { data, error } = await supabaseAdmin().from('payment_orders').select(ORDER_COLUMNS).eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  return data ? toPaymentOrder(data) : null;
}

/**
 * A fulfilment failure that retrying cannot fix: the order's room is not one
 * the buyer is in, it no longer exists, or (for a reveal) the other dancer's
 * agreement is not there. Anything else thrown while settling (a database or
 * network error) is treated as temporary.
 */
export class FulfilmentError extends Error {
  constructor(public reason: 'bad_room' | 'room_not_found' | 'consent_missing') {
    super(`Fulfilment failed: ${reason}`);
  }
}

// Postgres foreign_key_violation: chat_extensions.room_id has no rooms row.
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Grants what an order paid for (a chat extension, or a name and photo reveal
 * the other dancer already agreed to) and marks the order paid.
 * Idempotent: an order already marked paid is left alone, so the checkout
 * handler and the webhook (or a repeated webhook) grant once between them.
 *
 * The grant comes first and is itself keyed on payment_id, so a crash between
 * the two writes is repaired by the next delivery instead of leaving an order
 * marked paid with nothing granted.
 *
 * Throws FulfilmentError for a permanent failure. Routes call fulfilOrder,
 * which records that on the ledger.
 */
export async function settlePayment(order: PaymentOrder, paymentId: string): Promise<'fulfilled' | 'already_processed'> {
  if (order.status === 'paid') {
    if (order.payment_id !== paymentId) {
      console.warn('[billing] second payment for an order that is already paid; nothing granted', { orderId: order.order_id, paymentId });
    }
    return 'already_processed';
  }
  const partnerId = partnerFromRoomId(order.room_id, order.user_id);
  if (!partnerId) throw new FulfilmentError('bad_room');

  const db = supabaseAdmin();
  if (order.product === 'reveal') {
    await grantReveal(order.user_id, partnerId, paymentId);
  } else {
    const grant = await db.from('chat_extensions').upsert(
      {
        room_id: order.room_id,
        payment_id: paymentId,
        extra_seconds: EXTENSION_SECONDS,
        paid_at: new Date().toISOString(),
      },
      { onConflict: 'payment_id', ignoreDuplicates: true },
    );
    if (grant.error) {
      if (grant.error.code === FOREIGN_KEY_VIOLATION) throw new FulfilmentError('room_not_found');
      throw grant.error;
    }

    // DEC-013: Paying ₹29 directly reveals partner's real name and profile to the buyer
    try {
      await db.from('reveal_requests').upsert(
        {
          requester_id: order.user_id,
          target_id: partnerId,
          status: 'revealed',
          payment_id: paymentId,
          revealed_at: new Date().toISOString(),
        },
        { onConflict: 'requester_id,target_id' },
      );
    } catch {
      // Table may not exist or error handled gracefully
    }

    try {
      await db.from('reveals').upsert(
        {
          payer_id: order.user_id,
          target_id: partnerId,
          payment_id: paymentId,
          paid_at: new Date().toISOString(),
        },
        { onConflict: 'payer_id,target_id', ignoreDuplicates: true },
      );
    } catch {
      // Table may not exist or error handled gracefully
    }
  }

  const paid = await db.from('payment_orders').update({ status: 'paid', payment_id: paymentId }).eq('order_id', order.order_id).neq('status', 'paid');
  if (paid.error) throw paid.error;
  return 'fulfilled';
}

/**
 * Settles a captured payment, or records that it cannot be fulfilled (PAY-010).
 * A permanent failure leaves the order `fulfilment_failed` for review or
 * refund and is returned, not thrown, so the webhook can acknowledge it and
 * Razorpay stops retrying. A temporary failure still throws, so the caller
 * answers 5xx and the next delivery tries again. An order left
 * `fulfilment_failed` is settled by a later delivery if the cause has gone.
 */
export async function fulfilOrder(order: PaymentOrder, paymentId: string): Promise<'fulfilled' | 'already_processed' | 'fulfilment_failed'> {
  try {
    return await settlePayment(order, paymentId);
  } catch (e) {
    if (!(e instanceof FulfilmentError)) throw e;
    const { error } = await supabaseAdmin()
      .from('payment_orders')
      .update({ status: 'fulfilment_failed', payment_id: paymentId })
      .eq('order_id', order.order_id)
      .neq('status', 'paid');
    if (error) throw error;
    // The only alert there is until OPS-003 exists. Ids only, no personal data.
    console.error('[billing] fulfilment_failed: payment captured but nothing granted; review for refund', {
      orderId: order.order_id,
      paymentId,
      reason: e.reason,
    });
    return 'fulfilment_failed';
  }
}

/**
 * Records a failed attempt. Never downgrades a paid order, or one holding a
 * captured payment that could not be fulfilled; a later successful attempt
 * can still settle it.
 */
export async function recordFailedPayment(order: PaymentOrder, paymentId: string) {
  if (order.status === 'paid' || order.status === 'fulfilment_failed') return;
  const { error } = await supabaseAdmin()
    .from('payment_orders')
    .update({ status: 'failed', payment_id: paymentId })
    .eq('order_id', order.order_id)
    .neq('status', 'paid')
    .neq('status', 'fulfilment_failed');
  if (error) throw error;
}

/** A webhook event the handler has finished with. `outcome` says what it did. */
export type WebhookEventRecord = { eventId: string; event: string; orderId?: string; paymentId?: string; outcome: string };

/** True when this Razorpay event id has already been handled (PAY-008). */
export async function hasProcessedEvent(eventId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from('webhook_events').select('event_id').eq('event_id', eventId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Records a handled event. Called only once handling has finished, so an
 * event whose handling failed part-way is processed again when Razorpay
 * redelivers it. Two deliveries racing each other can both get past
 * hasProcessedEvent; settlePayment's own idempotency covers that case.
 */
export async function recordEvent(record: WebhookEventRecord) {
  const { error } = await supabaseAdmin()
    .from('webhook_events')
    .upsert(
      { event_id: record.eventId, event: record.event, order_id: record.orderId ?? null, payment_id: record.paymentId ?? null, outcome: record.outcome },
      { onConflict: 'event_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}
