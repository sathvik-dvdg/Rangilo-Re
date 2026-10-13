import { getConnections } from '@/lib/consent';
import { errorResponse, requireUserId } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * For the dancer list: `revealed` holds the real name and email of everyone
 * the caller is connected with, and `incoming` the ids of dancers whose
 * connect request is waiting for the caller's answer.
 *
 * Both come from the consent tables. A name appears only when a
 * contact_reveals row exists for the pair, which takes the other person's
 * acceptance; the old payer-only `reveals` table is not read (DEC-003).
 */
export async function GET() {
  try {
    const userId = requireUserId();
    return Response.json(await getConnections(userId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
