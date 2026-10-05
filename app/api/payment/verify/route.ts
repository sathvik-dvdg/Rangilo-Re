import { fulfill, parseNotes } from '@/lib/payments';
import { razorpay, verifyCheckoutSignature } from '@/lib/razorpay';
import { HttpError, errorResponse, getRevealed, requireUserId } from '@/lib/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const { orderId, paymentId, signature } = (await req.json().catch(() => ({}))) as Record<string, string>;
    if (!orderId || !paymentId || !signature) throw new HttpError(400, 'Missing payment fields');

    if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Signature proves Razorpay issued this payment for this order; the order
    // notes (written by us in create-order) say what it unlocks.
    const order = await razorpay().orders.fetch(orderId);
    const notes = parseNotes(order.notes);
    if (!notes || notes.userId !== userId) throw new HttpError(403, 'Order does not belong to you');

    await fulfill(notes, paymentId, Number(order.amount));

    if (notes.type === 'reveal') {
      const identity = await getRevealed(userId, notes.targetUserId!);
      return Response.json({ success: true, type: 'reveal', identity });
    }
    return Response.json({ success: true, type: 'extend' });
  } catch (e) {
    return errorResponse(e);
  }
}
