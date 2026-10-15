'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateDisplayName, isGeneratedName } from '@/lib/displayNames';
import { hit } from '@/lib/rateLimit';
import type { Gender } from '@/lib/types';

// A server action is a public endpoint: its argument is checked before use (SEC-004).
// The caps only bound the size; the fields are trimmed and shortened further below.
const OnboardingInput = z.object({
  gender: z.enum(['male', 'female', 'other']),
  displayName: z.string(),
  realName: z.string().max(200).optional(),
  email: z.string().max(254).optional(),
  branch: z.string().max(100).optional(),
  collegeYear: z.string().max(100).optional(),
  vibeTag: z.string().max(200).optional(),
  outfitColor: z.string().max(300).optional(),
  instagramHandle: z.string().max(100).optional(),
});

async function nameTaken(name: string, excludeClerkId?: string) {
  let query = supabaseAdmin().from('users').select('id').eq('display_name', name);
  if (excludeClerkId) {
    query = query.neq('clerk_id', excludeClerkId);
  }
  const { data } = await query.maybeSingle();
  return !!data;
}

export async function rerollDisplayName() {
  const { userId } = auth();
  if (!userId) throw new Error('Unauthorised');
  // Past the limit, skip the database: completeOnboarding still checks the name is free (CHAT-007).
  if (hit('account', userId) > 0) return generateDisplayName();
  for (let i = 0; i < 5; i++) {
    const n = generateDisplayName();
    if (!(await nameTaken(n))) return n;
  }
  return generateDisplayName();
}

export async function completeOnboarding(raw: {
  gender: Gender;
  displayName: string;
  realName?: string;
  email?: string;
  branch?: string;
  collegeYear?: string;
  vibeTag?: string;
  outfitColor?: string;
  instagramHandle?: string;
}) {
  const { userId } = auth();
  if (!userId) return { error: 'Sign in first' };
  if (hit('account', userId) > 0) return { error: 'Too many attempts. Wait a minute and try again.' };
  const parsed = OnboardingInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.path[0] === 'gender' ? 'Pick a gender' : 'Check your profile details and try again.' };
  const input = parsed.data;

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
  const vibeTag = input.vibeTag ? input.vibeTag.trim().slice(0, 50) : null;
  const outfitColor = input.outfitColor ? input.outfitColor.trim().slice(0, 100) : null;
  const cleanInstagram = input.instagramHandle
    ? input.instagramHandle.trim().replace(/^@+/, '').replace(/\s+/g, '').slice(0, 30)
    : null;

  const userPayload: Record<string, unknown> = {
    clerk_id: userId,
    display_name: cleanDisplayName,
    gender: input.gender,
    real_name: realName,
    email,
    branch,
    college_year: collegeYear,
    vibe_tag: vibeTag,
    outfit_color: outfitColor,
    instagram_handle: cleanInstagram,
    is_online: true,
    last_seen: new Date().toISOString(),
  };

  let { error } = await supabaseAdmin().from('users').upsert(userPayload, { onConflict: 'clerk_id' });
  if (error && (error.message?.includes('vibe_tag') || error.message?.includes('outfit_color') || error.message?.includes('instagram_handle'))) {
    delete userPayload.vibe_tag;
    delete userPayload.outfit_color;
    delete userPayload.instagram_handle;
    const retry = await supabaseAdmin().from('users').upsert(userPayload, { onConflict: 'clerk_id' });
    error = retry.error;
  }
  if (error && (error.message?.includes('branch') || error.message?.includes('college_year'))) {
    delete userPayload.branch;
    delete userPayload.college_year;
    const retry = await supabaseAdmin().from('users').upsert(userPayload, { onConflict: 'clerk_id' });
    error = retry.error;
  }
  if (error) return { error: 'Could not save your profile. Try again.' };

  revalidatePath('/dashboard');
  return { ok: true };
}
