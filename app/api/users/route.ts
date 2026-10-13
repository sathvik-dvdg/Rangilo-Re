import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PUBLIC_COLUMNS, errorResponse, requireUserId } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Every dancer except you — public columns only. */
export async function GET() {
  try {
    const userId = requireUserId();
    let { data, error } = await supabaseAdmin()
      .from('users')
      .select('clerk_id, display_name, gender, branch, college_year, vibe_tag, outfit_color, last_seen')
      .neq('clerk_id', userId)
      .order('last_seen', { ascending: false })
      .limit(2000);

    if (error) {
      const fallback = await supabaseAdmin()
        .from('users')
        .select('clerk_id, display_name, gender, branch, college_year, last_seen')
        .neq('clerk_id', userId)
        .order('last_seen', { ascending: false })
        .limit(2000);
      if (fallback.error) {
        const basic = await supabaseAdmin()
          .from('users')
          .select(PUBLIC_COLUMNS)
          .neq('clerk_id', userId)
          .order('last_seen', { ascending: false })
          .limit(2000);
        if (basic.error) throw basic.error;
        data = (basic.data ?? []).map((u: any) => ({
          ...u,
          branch: undefined,
          college_year: undefined,
          vibe_tag: undefined,
          outfit_color: undefined,
        }));
      } else {
        data = (fallback.data ?? []).map((u: any) => ({
          ...u,
          vibe_tag: undefined,
          outfit_color: undefined,
        }));
      }
    }

    return Response.json({ users: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
