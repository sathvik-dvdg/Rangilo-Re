'use client';

import { useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createBrowserSupabase } from '@/lib/supabase';

/** One browser Supabase client per mount, authenticated with the live Clerk token. */
export function useSupabase() {
  const { getToken } = useAuth();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  return useMemo(() => createBrowserSupabase(() => tokenRef.current()), []);
}
