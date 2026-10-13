import { getRoomConsent, respondToConsent } from '@/lib/consent';
import { HttpError, errorResponse, requireUserId } from '@/lib/server';
import { isRecord } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Where this room's contact request stands, for one of its two participants. */
export async function GET(_req: Request, { params }: { params: { roomId: string } }) {
  try {
    const userId = requireUserId();
    return Response.json(await getRoomConsent(decodeURIComponent(params.roomId), userId));
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * The asked person's answer. Not gated on the billing mode: a request paid
 * for while Paid Mode was on can still be answered after a rollback to Free
 * Mode, and answering takes no payment (FREE-007).
 */
export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  try {
    const userId = requireUserId();
    const body: unknown = await req.json().catch(() => null);
    const action = isRecord(body) ? body.action : undefined;
    if (action !== 'accept' && action !== 'decline') throw new HttpError(400, 'Unknown action');

    const status = await respondToConsent(decodeURIComponent(params.roomId), userId, action);
    return Response.json({ status });
  } catch (e) {
    return errorResponse(e);
  }
}
