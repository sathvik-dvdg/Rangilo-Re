'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateDisplayName, isGeneratedName } from '@/lib/displayNames';
import type { Gender } from '@/lib/types';

async function nameTaken(name: string, excludeClerkId?: string) {
  let query = supabaseAdmin().from('users').select('id').eq('display_name', name);
  if (excludeClerkId) {
    query = query.neq('clerk_id', excludeClerkId);
  }
  const { data } = await query.maybeSingle();
  return !!data;
}

export async function rerollDisplayName() {
  if (!auth().userId) throw new Error('Unauthorised');
  for (let i = 0; i < 5; i++) {
    const n = generateDisplayName();
    if (!(await nameTaken(n))) return n;
  }
  return generateDisplayName();
}

export async function completeOnboarding(input: {
  gender: Gender;
  displayName: string;
  realName?: string;
  email?: string;
  branch?: string;
  collegeYear?: string;
}) {
  const { userId } = auth();
  if (!userId) return { error: 'Sign in first' };
  if (!['male', 'female', 'other'].includes(input.gender)) return { error: 'Pick a gender' };

  const cleanDisplayName = input.displayName.trim();
  if (!cleanDisplayName || cleanDisplayName.length < 2 || cleanDisplayName.length > 35) {
    return { error: 'Garba name must be between 2 and 35 characters.' };
  }
  if (await nameTaken(cleanDisplayName, userId)) {
    return { error: 'Someone has already taken that Garba name. Please pick another or reroll!' };
  }

  const user = await currentUser();
  const defaultRealName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || '';
  const defaultEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '';

  const realName = input.realName !== undefined ? input.realName.trim() : defaultRealName;
  const email = input.email !== undefined ? input.email.trim() : defaultEmail;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  const branch = (input.branch || 'CSE').trim();
  const collegeYear = (input.collegeYear || '3rd Year').trim();

  const userPayload: Record<string, unknown> = {
    clerk_id: userId,
    display_name: cleanDisplayName,
    gender: input.gender,
    real_name: realName,
    email,
    branch,
    college_year: collegeYear,
    is_online: true,
    last_seen: new Date().toISOString(),
  };

  let { error } = await supabaseAdmin().from('users').upsert(userPayload, { onConflict: 'clerk_id' });
  if (error && error.message?.includes('branch')) {
    delete userPayload.branch;
    delete userPayload.college_year;
    const retry = await supabaseAdmin().from('users').upsert(userPayload, { onConflict: 'clerk_id' });
    error = retry.error;
  }
  if (error) return { error: 'Could not save your profile. Try again.' };

  revalidatePath('/dashboard');
  return { ok: true };
}
