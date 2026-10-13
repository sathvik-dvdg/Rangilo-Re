import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PUBLIC_COLUMNS, errorResponse, requireUserId } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Every dancer except you — public columns only. */
export async function GET() {
  try {
    const userId = requireUserId();
    let { data, error } = await supabaseAdmin()
      .from('users')
      .select('clerk_id, display_name, gender, branch, college_year, last_seen')
      .neq('clerk_id', userId)
      .order('last_seen', { ascending: false })
      .limit(2000);

    if (error) {
      const fallback = await supabaseAdmin()
        .from('users')
        .select(PUBLIC_COLUMNS)
        .neq('clerk_id', userId)
        .order('last_seen', { ascending: false })
        .limit(2000);
      if (fallback.error) throw fallback.error;
      data = (fallback.data ?? []).map((u: any) => ({
        ...u,
        branch: undefined,
        college_year: undefined,
      }));
    }

    return Response.json({ users: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
