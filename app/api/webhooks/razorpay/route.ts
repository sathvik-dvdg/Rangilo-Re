import { fulfill, parseNotes } from '@/lib/payments';
import { razorpay, verifyWebhookSignature } from '@/lib/razorpay';

export const runtime = 'nodejs';

/**
 * Safety net for checkouts where the browser closed before calling
 * /api/payment/verify. Register for `payment.captured` in the Razorpay
 * dashboard. fulfill() is idempotent, so double delivery is harmless.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !verifyWebhookSignature(raw, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(raw) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; amount: number } } };
  };
  if (event.event !== 'payment.captured') return Response.json({ ok: true });

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) return Response.json({ ok: true });

  try {
    const order = await razorpay().orders.fetch(payment.order_id);
    const notes = parseNotes(order.notes);
    if (notes) await fulfill(notes, payment.id, Number(order.amount));
    return Response.json({ ok: true });
  } catch (e) {
    console.error('razorpay webhook', e);
    // 500 makes Razorpay retry later.
    return Response.json({ error: 'fulfil failed' }, { status: 500 });
  }
}
