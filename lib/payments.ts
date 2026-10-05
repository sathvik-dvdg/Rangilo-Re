import 'server-only';
import { supabaseAdmin } from './supabaseAdmin';
import { PRICE_PAISE, partnerFromRoomId } from './room';
import type { PaymentType } from './types';

export type OrderNotes = {
  type: PaymentType;
  userId: string;
  targetUserId?: string;
  roomId?: string;
};

export function parseNotes(notes: unknown): OrderNotes | null {
  if (!notes || typeof notes !== 'object') return null;
  const n = notes as Record<string, unknown>;
  if ((n.type !== 'reveal' && n.type !== 'extend') || typeof n.userId !== 'string') return null;
  return {
    type: n.type,
    userId: n.userId,
    targetUserId: typeof n.targetUserId === 'string' ? n.targetUserId : undefined,
    roomId: typeof n.roomId === 'string' ? n.roomId : undefined,
  };
}

/**
 * Applies a paid order. Idempotent: payment_id is unique in both tables, so
 * the checkout handler and the webhook can both call this for the same
 * payment without double-unlocking.
 *
 * Everything it acts on comes from the order notes we wrote server-side when
 * creating the order, never from the client's verify request body.
 */
export async function fulfill(notes: OrderNotes, paymentId: string, amount: number) {
  if (amount !== PRICE_PAISE) throw new Error('Unexpected amount');
  const db = supabaseAdmin();

  if (notes.type === 'reveal') {
    if (!notes.targetUserId) throw new Error('Missing target');
    const { error } = await db.from('reveals').upsert(
      {
        payer_id: notes.userId,
        target_id: notes.targetUserId,
        payment_id: paymentId,
        paid_at: new Date().toISOString(),
      },
      { onConflict: 'payer_id,target_id', ignoreDuplicates: true },
    );
    if (error) throw error;
    return;
  }

  if (!notes.roomId || !partnerFromRoomId(notes.roomId, notes.userId)) throw new Error('Bad room');
  const { error } = await db.from('chat_extensions').upsert(
    {
      room_id: notes.roomId,
      payment_id: paymentId,
      extra_seconds: 120,
      paid_at: new Date().toISOString(),
    },
    { onConflict: 'payment_id', ignoreDuplicates: true },
  );
  if (error) throw error;
}
