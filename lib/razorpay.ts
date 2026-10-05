import 'server-only';
import crypto from 'crypto';
import Razorpay from 'razorpay';

let client: Razorpay | null = null;

export function razorpay() {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqualHex(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
  return safeEqualHex(expected, signature);
}
