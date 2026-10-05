import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PUBLIC_COLUMNS, errorResponse, requireUserId } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Every dancer except you — public columns only. */
export async function GET() {
  try {
    const userId = requireUserId();
    const { data, error } = await supabaseAdmin()
      .from('users')
      .select(PUBLIC_COLUMNS)
      .neq('clerk_id', userId)
      .order('last_seen', { ascending: false })
      .limit(2000);
    if (error) throw error;
    return Response.json({ users: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
