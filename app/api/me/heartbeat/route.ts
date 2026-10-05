import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, requireUserId } from '@/lib/server';

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const { online } = (await req.json().catch(() => ({ online: true }))) as { online?: boolean };
    const { error } = await supabaseAdmin()
      .from('users')
      .update({ is_online: online !== false, last_seen: new Date().toISOString() })
      .eq('clerk_id', userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
