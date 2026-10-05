import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser client. Authenticates with the Clerk session token (Supabase
 * third-party auth), so RLS policies see the Clerk user id as auth.jwt().sub.
 */
export function createBrowserSupabase(getToken: () => Promise<string | null>): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => (await getToken()) ?? null,
    realtime: { params: { eventsPerSecond: 10 } },
  });
}
