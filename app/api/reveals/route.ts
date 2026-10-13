import { listRevealed } from '@/lib/reveal';
import { errorResponse, requireUserId } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** The dancers whose real name and photo the caller may see: each agreed, and the caller paid (ID-001). */
export async function GET() {
  try {
    const userId = requireUserId();
    return Response.json({ revealed: await listRevealed(userId) });
  } catch (e) {
    return errorResponse(e);
  }
}
