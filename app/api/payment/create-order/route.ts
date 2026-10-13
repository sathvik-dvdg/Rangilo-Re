import { billingDisabledResponse } from '@/lib/billing';
import { getRoomConsent } from '@/lib/consent';
import { recordOrder, type OrderNotes } from '@/lib/payments';
import { razorpay } from '@/lib/razorpay';
import { PRICE_PAISE, partnerFromRoomId } from '@/lib/room';
import { HttpError, errorResponse, loadRoom, requireUserId } from '@/lib/server';
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

    // 'connect' is the only paid product: it makes the chat unlimited and asks
    // the partner to exchange contact details. It never discloses anyone's
    // identity by itself (DEC-002, ID-002).
    if (type !== 'connect') throw new HttpError(400, 'Unknown payment type');
    if (typeof roomId !== 'string' || !partnerFromRoomId(roomId, userId)) throw new HttpError(400, 'Unknown room');

    // Take no money for something that could not be delivered: the room and
    // both dancers must exist, the room must be able to take a request, and
    // it must not already be unlimited (one payment per room).
    const { room } = await loadRoom(roomId, userId);
    const consent = await getRoomConsent(roomId, userId);
    if (!consent.canRequest || room.unlimited) {
      throw new HttpError(
        409,
        consent.status === 'accepted'
          ? 'You two are already connected'
          : consent.status === 'pending'
            ? 'A request to share contact details is already waiting for an answer'
            : !consent.canRequest
              ? 'You have already asked in this chat'
              : 'This chat already has no time limit',
      );
    }

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
