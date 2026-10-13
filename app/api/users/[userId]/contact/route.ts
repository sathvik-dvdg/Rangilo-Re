import { getRevealedContact } from '@/lib/consent';
import { errorResponse, requireUserId } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * Another dancer's real name and email, and only when a contact_reveals row
 * exists for the caller and that dancer. Anything else is a 404, which also
 * keeps it from confirming whether an id belongs to anyone (PRIV-001).
 */
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const userId = requireUserId();
    const contact = await getRevealedContact(userId, decodeURIComponent(params.userId));
    if (!contact) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(contact, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
