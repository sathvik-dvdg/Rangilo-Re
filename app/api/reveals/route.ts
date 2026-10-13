import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, requireUserId } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * Returns all identities unlocked by the current user so dashboard and chat
 * consistently display real names and unlocked status even after page refresh.
 */
export async function GET() {
  try {
    const userId = requireUserId();
    const db = supabaseAdmin();

    const { data: myReveals, error: rErr } = await db
      .from('reveals')
      .select('target_id')
      .eq('payer_id', userId);

    if (rErr) throw rErr;

    const targetIds = (myReveals ?? []).map((r) => r.target_id).filter(Boolean);
    const revealed: Record<string, { real_name: string; email: string }> = {};

    if (targetIds.length > 0) {
      const { data: users, error: uErr } = await db
        .from('users')
        .select('clerk_id, real_name, email')
        .in('clerk_id', targetIds);

      if (uErr) throw uErr;

      for (const u of users ?? []) {
        if (u.clerk_id && u.real_name && u.email) {
          revealed[u.clerk_id] = {
            real_name: u.real_name,
            email: u.email,
          };
        }
      }
    }

    return Response.json({ revealed });
  } catch (e) {
    return errorResponse(e);
  }
}
