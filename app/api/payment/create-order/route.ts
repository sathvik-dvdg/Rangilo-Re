import { billingDisabledResponse } from '@/lib/billing';
import { getRoomConsent } from '@/lib/consent';
import { recordOrder, type OrderNotes } from '@/lib/payments';
import { razorpay } from '@/lib/razorpay';
import { hasRealName, isRevealAllowed } from '@/lib/reveal';
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

    if (type !== 'connect' && type !== 'extend' && type !== 'reveal') throw new HttpError(400, 'Unknown payment type');
    const partnerId = typeof roomId === 'string' ? partnerFromRoomId(roomId, userId) : null;
    if (typeof roomId !== 'string' || !partnerId) throw new HttpError(400, 'Unknown room');

    if (type === 'connect') {
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
    }

    if (type === 'reveal') {
      // A reveal can be bought only after the other dancer has agreed, and only while that
      // agreement stands. The buyer cannot create it, and neither can this route (ID-001, PAY-017).
      if (!(await isRevealAllowed(userId, partnerId))) throw new HttpError(409, 'They have not agreed to share their name and photo');
      if (!(await hasRealName(partnerId))) throw new HttpError(409, 'They have no name to share yet');
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
    await recordOrder({ userId, roomId, orderId: order.id, amount: PRICE_PAISE, currency: CURRENCY, product: type });

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
