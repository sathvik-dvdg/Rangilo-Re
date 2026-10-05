import { razorpay } from '@/lib/razorpay';
import { PRICE_PAISE, partnerFromRoomId } from '@/lib/room';
import { HttpError, errorResponse, getProfile, getRevealed, requireUserId } from '@/lib/server';
import type { OrderNotes } from '@/lib/payments';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      targetUserId?: string;
      roomId?: string;
    };

    const notes: OrderNotes = { type: body.type === 'extend' ? 'extend' : 'reveal', userId };
    if (body.type !== 'reveal' && body.type !== 'extend') throw new HttpError(400, 'Unknown payment type');

    if (notes.type === 'reveal') {
      const target = body.targetUserId;
      if (!target || target === userId || !(await getProfile(target))) throw new HttpError(400, 'Unknown dancer');
      if (await getRevealed(userId, target)) throw new HttpError(409, 'Already unlocked');
      notes.targetUserId = target;
    } else {
      if (!body.roomId || !partnerFromRoomId(body.roomId, userId)) throw new HttpError(400, 'Unknown room');
      notes.roomId = body.roomId;
    }

    // Amount is fixed here, never taken from the client.
    const order = await razorpay().orders.create({
      amount: PRICE_PAISE,
      currency: 'INR',
      receipt: `gc_${notes.type}_${Date.now()}`,
      notes: notes as unknown as Record<string, string>,
    });

    return Response.json({
      orderId: order.id,
      amount: PRICE_PAISE,
      currency: 'INR',
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
