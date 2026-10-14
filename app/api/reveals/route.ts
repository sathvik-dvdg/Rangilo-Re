import { getConnections } from '@/lib/consent';
import { listRevealed } from '@/lib/reveal';
import { errorResponse, requireUserId } from '@/lib/server';
import type { RevealedIdentity } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * For the dancer list:
 * - `revealed` holds the real name and contact details (email from connect flow,
 *   photo from reveal flow) of everyone the caller may see.
 * - `incoming` holds the ids of dancers whose connect request is waiting for the
 *   caller's answer.
 *
 * Both come from the consent and reveal tables. The old payer-only `reveals`
 * table is not read (DEC-003).
 */
export async function GET() {
  try {
    const userId = requireUserId();
    const [revealList, connections] = await Promise.all([
      listRevealed(userId),
      getConnections(userId),
    ]);
    const revealed: Record<string, RevealedIdentity> = { ...connections.revealed };
    for (const { clerk_id, ...identity } of revealList) {
      revealed[clerk_id] = { ...revealed[clerk_id], ...identity };
    }
    return Response.json({
      revealed,
      incoming: connections.incoming,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

