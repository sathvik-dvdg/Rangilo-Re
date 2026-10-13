import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfigProblems } from './supabaseConfig';
import { SupabaseConfigError } from './dbDiagnosis';

let admin: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS, so it must only ever run on the server. */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const problems = getSupabaseConfigProblems({ server: true });
    if (problems.length > 0) throw new SupabaseConfigError(problems);
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
