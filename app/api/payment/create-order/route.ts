import { billingDisabledResponse } from '@/lib/billing';
import { recordOrder, type OrderNotes } from '@/lib/payments';
import { razorpay } from '@/lib/razorpay';
import { PRICE_PAISE, partnerFromRoomId } from '@/lib/room';
import { HttpError, errorResponse, requireUserId } from '@/lib/server';
import { isRecord } from '@/lib/utils';

export const runtime = 'nodejs';

const CURRENCY = 'INR';

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    // Before touching the body, the database or Razorpay (FREE-004).
    // Paid Mode must not be enabled in production: the OBJECTIVES.md §8 gates are not met.
    const disabled = billingDisabledResponse();
    if (disabled) return disabled;

    const body: unknown = await req.json().catch(() => null);
    const type = isRecord(body) ? body.type : undefined;
    const roomId = isRecord(body) ? body.roomId : undefined;

    // The chat extension is the only paid product. Identity is never sold (DEC-002, ID-002).
    if (type !== 'extend') throw new HttpError(400, 'Unknown payment type');
    if (typeof roomId !== 'string' || !partnerFromRoomId(roomId, userId)) throw new HttpError(400, 'Unknown room');

    // Amount is fixed here, never taken from the client.
    const notes: OrderNotes = { type, userId, roomId };
    const order = await razorpay().orders.create({
      amount: PRICE_PAISE,
      currency: CURRENCY,
      receipt: `gc_${type}_${Date.now()}`,
      notes,
    });
    // The ledger row, not the Razorpay notes, is what verify and the webhook act on.
    await recordOrder({ userId, roomId, orderId: order.id, amount: PRICE_PAISE, currency: CURRENCY });

    return Response.json({
      orderId: order.id,
      amount: PRICE_PAISE,
      currency: CURRENCY,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // public key id only
    });
  } catch (e) {
    return errorResponse(e);
  }
}
