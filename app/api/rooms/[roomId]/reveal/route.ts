import { billingDisabledResponse } from '@/lib/billing';
import { getRevealState, hasRealName, requestReveal, respondToReveal } from '@/lib/reveal';
import { HttpError, errorResponse, loadRoom, requireUserId } from '@/lib/server';
import { isRecord } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Asking to see the other dancer's real name and photo, and answering such a
 * request (ID-001..003). Free in itself; the reveal is paid for separately and
 * only after an "allow". Each action is taken as the caller, about the one
 * other person in this room:
 *   request  the caller asks to see their partner
 *   allow    the caller agrees to their partner's pending request
 *   decline  the caller refuses it, or withdraws an earlier yes not yet paid for
 * So nobody can answer a request on someone else's behalf, their own included.
 */
export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  try {
    const userId = requireUserId();
    const roomId = decodeURIComponent(params.roomId);
    const body: unknown = await req.json().catch(() => null);
    const action = isRecord(body) ? body.action : undefined;
    if (action !== 'request' && action !== 'allow' && action !== 'decline') throw new HttpError(400, 'Unknown action');

    // The reveal is a paid feature, so with billing off nothing new can be asked or agreed.
    // Saying no always works.
    if (action !== 'decline') {
      const disabled = billingDisabledResponse();
      if (disabled) return disabled;
    }

    const { db, partnerId } = await loadRoom(roomId, userId);

    if (action === 'request') {
      // Only once a real conversation exists: both of them have written something here.
      const { data: senders, error } = await db.from('messages').select('sender_id').eq('room_id', roomId);
      if (error) throw error;
      const spoke = new Set((senders ?? []).map((m) => m.sender_id as string));
      if (!spoke.has(userId) || !spoke.has(partnerId)) throw new HttpError(409, 'Say hi to each other first');
      await requestReveal(userId, partnerId);
    } else if (action === 'allow') {
      if (!(await hasRealName(userId))) throw new HttpError(409, 'Add your real name to your profile first');
      if (!(await respondToReveal(userId, partnerId, true))) throw new HttpError(409, 'There is no request waiting for your answer');
    } else {
      await respondToReveal(userId, partnerId, false);
    }

    return Response.json({ reveal: await getRevealState(userId, partnerId) });
  } catch (e) {
    return errorResponse(e);
  }
}
