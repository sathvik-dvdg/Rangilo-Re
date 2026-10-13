import 'server-only';
import { supabaseAdmin } from './supabaseAdmin';
import { partnerFromRoomId } from './room';
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

/**
 * 'paid': captured, the chat is unlimited and the contact request exists.
 * 'fulfilment_failed': captured, but the chat could not be unlocked (PAY-010).
 *   This is the only state that is owed a refund (PAY-012).
 * 'refunded': set by hand once the money has gone back.
 */
export type PaymentOrderStatus = 'created' | 'paid' | 'failed' | 'fulfilment_failed' | 'refunded';

const ORDER_STATUSES: readonly unknown[] = ['created', 'paid', 'failed', 'fulfilment_failed', 'refunded'] satisfies PaymentOrderStatus[];
/** A captured payment has been dealt with: nothing more is granted and nothing overwrites it. */
const SETTLED: readonly PaymentOrderStatus[] = ['paid', 'refunded'];
/** States a captured payment may still move out of. */
const UNSETTLED: PaymentOrderStatus[] = ['created', 'failed', 'fulfilment_failed'];
const isOrderStatus = (value: unknown): value is PaymentOrderStatus => ORDER_STATUSES.includes(value);

export type PaymentOrder = {
  /** Ledger row id; a contact request points at it. */
  id: string;
  user_id: string;
  room_id: string;
  order_id: string;
  payment_id: string | null;
  status: PaymentOrderStatus;
  amount: number;
  currency: string;
};

/** What create-order writes on the Razorpay order, for reading in their dashboard only. */
export type OrderNotes = { type: PaymentType; userId: string; roomId: string };

const ORDER_COLUMNS = 'id, user_id, room_id, order_id, payment_id, status, amount, currency';

function toPaymentOrder(row: unknown): PaymentOrder {
  if (isRecord(row)) {
    const { id, user_id, room_id, order_id, payment_id, status, amount, currency } = row;
    if (
      typeof id === 'string' &&
      typeof user_id === 'string' &&
      typeof room_id === 'string' &&
      typeof order_id === 'string' &&
      isOrderStatus(status) &&
      typeof amount === 'number' &&
      typeof currency === 'string'
    ) {
      return { id, user_id, room_id, order_id, payment_id: typeof payment_id === 'string' ? payment_id : null, status, amount, currency };
    }
  }
  throw new Error('Malformed payment_orders row');
}

export async function recordOrder(order: { userId: string; roomId: string; orderId: string; amount: number; currency: string }) {
  const { error } = await supabaseAdmin().from('payment_orders').insert({
    user_id: order.userId,
    room_id: order.roomId,
    order_id: order.orderId,
    status: 'created',
    amount: order.amount,
    currency: order.currency,
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
 * the buyer is in, it no longer exists, or it has already been paid for.
 * Anything else thrown while settling (a database or network error) is
 * treated as temporary.
 */
export class FulfilmentError extends Error {
  constructor(public reason: 'bad_room' | 'room_not_found' | 'duplicate_request') {
    super(`Fulfilment failed: ${reason}`);
  }
}

// Postgres foreign_key_violation: contact_consents.room_id has no rooms row.
const FOREIGN_KEY_VIOLATION = '23503';
// Postgres unique_violation: the room already has an open or accepted request,
// or this buyer has already asked in it (the indexes in migration 0006).
const UNIQUE_VIOLATION = '23505';

/**
 * Grants what an order paid for and marks the order paid. A payment does two
 * things, in this order:
 *   1. asks the partner to exchange contact details: a 'pending' request,
 *      which discloses nothing. Only the partner's answer can (lib/consent.ts),
 *      so a payment never stands in for their consent (ID-002);
 *   2. makes the room unlimited, at once and whatever the partner answers.
 *
 * Idempotent: a settled order is left alone, the request is keyed on the
 * order, and setting the flag twice changes nothing, so the checkout handler
 * and the webhook (or a repeated webhook) grant once between them.
 *
 * The order is marked paid last, so a crash part-way is repaired by the next
 * delivery instead of leaving an order marked paid with the chat still
 * locked.
 *
 * Throws FulfilmentError for a permanent failure. Routes call fulfilOrder,
 * which records that on the ledger.
 */
export async function settlePayment(order: PaymentOrder, paymentId: string): Promise<'fulfilled' | 'already_processed'> {
  if (SETTLED.includes(order.status)) {
    if (order.payment_id !== paymentId) {
      console.warn('[billing] second payment for an order that is already settled; nothing granted', { orderId: order.order_id, paymentId });
    }
    return 'already_processed';
  }
  const partnerId = partnerFromRoomId(order.room_id, order.user_id);
  if (!partnerId) throw new FulfilmentError('bad_room');

  const db = supabaseAdmin();
  const request = await db
    .from('contact_consents')
    .upsert(
      { room_id: order.room_id, requester_id: order.user_id, partner_id: partnerId, payment_order_id: order.id },
      { onConflict: 'payment_order_id', ignoreDuplicates: true },
    );
  if (request.error) {
    if (request.error.code === FOREIGN_KEY_VIOLATION) throw new FulfilmentError('room_not_found');
    if (request.error.code === UNIQUE_VIOLATION) throw new FulfilmentError('duplicate_request');
    throw request.error;
  }

  // The buyer's part does not wait for the partner: the chat is unlimited from now on.
  const unlocked = await db.from('rooms').update({ unlimited: true }).eq('id', order.room_id).select('id');
  if (unlocked.error) throw unlocked.error;
  // No row changed, so nothing was unlocked: never mark that paid.
  if (!unlocked.data?.length) throw new FulfilmentError('room_not_found');

  const paid = await db
    .from('payment_orders')
    .update({ status: 'paid', payment_id: paymentId })
    .eq('order_id', order.order_id)
    .in('status', UNSETTLED);
  if (paid.error) throw paid.error;
  return 'fulfilled';
}

/**
 * Settles a captured payment, or records that it cannot be fulfilled (PAY-010).
 * A permanent failure leaves the order `fulfilment_failed` for review and
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
      .in('status', UNSETTLED);
    if (error) throw error;
    // The only alert there is until OPS-003 exists. Ids only, no personal data.
    console.error('[billing] fulfilment_failed: payment captured but the chat was not unlocked; refund due', {
      orderId: order.order_id,
      paymentId,
      reason: e.reason,
    });
    return 'fulfilment_failed';
  }
}

/**
 * Records a failed attempt. Never downgrades an order holding a captured
 * payment, whether settled or not yet fulfilled; a later successful attempt
 * can still settle it.
 */
export async function recordFailedPayment(order: PaymentOrder, paymentId: string) {
  if (order.status !== 'created' && order.status !== 'failed') return;
  const { error } = await supabaseAdmin()
    .from('payment_orders')
    .update({ status: 'failed', payment_id: paymentId })
    .eq('order_id', order.order_id)
    .in('status', ['created', 'failed']);
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
