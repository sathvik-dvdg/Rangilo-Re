import { billingDisabledResponse } from '@/lib/billing';
import { recordOrder, type OrderNotes } from '@/lib/payments';
import { razorpay } from '@/lib/razorpay';
import { hasRealName, isRevealAllowed } from '@/lib/reveal';
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

    if (type !== 'extend' && type !== 'reveal') throw new HttpError(400, 'Unknown payment type');
    const partnerId = typeof roomId === 'string' ? partnerFromRoomId(roomId, userId) : null;
    if (typeof roomId !== 'string' || !partnerId) throw new HttpError(400, 'Unknown room');

    // A reveal can be bought only after the other dancer has agreed, and only while that
    // agreement stands. The buyer cannot create it, and neither can this route (ID-001, PAY-017).
    if (type === 'reveal') {
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
