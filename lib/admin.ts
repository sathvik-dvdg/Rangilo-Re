import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { supabaseAdmin } from './supabaseAdmin';

/**
 * Admin console access (ADMIN-001). An admin is a Clerk account whose public
 * metadata has `role: "admin"`, set in the Clerk dashboard (Users → the user →
 * Metadata → Public). Public metadata can only be written from the dashboard or
 * the Backend API. Never read `unsafeMetadata` here: users can edit that themselves.
 */
export function isAdminUser(user: { publicMetadata?: Record<string, unknown> | null }): boolean {
  return user.publicMetadata?.role === 'admin';
}

/**
 * Call at the top of every admin page and every admin server action; a layout
 * check alone does not cover either. Everyone else gets a 404, so the console
 * looks like a page that does not exist.
 */
export async function requireAdmin(): Promise<{ id: string }> {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  if (!isAdminUser(user)) notFound();
  return { id: user.id };
}

export type AdminAction = 'view_roster' | 'remove_user' | 'block_user' | 'remove_room';

/** The audit table from supabase/migrations/0007_admin_actions.sql has not been created. */
export class AdminSetupError extends Error {
  constructor() {
    super('The admin audit log table is missing');
  }
}

/**
 * Writes the audit row (ADMIN-003). Throws if it cannot, and callers do this
 * before acting, so an unrecorded admin action is not possible.
 */
export async function recordAdminAction(adminId: string, action: AdminAction, target: string | null = null): Promise<void> {
  const { error } = await supabaseAdmin().from('admin_actions').insert({ admin_id: adminId, action, target });
  if (!error) return;
  if (error.code === 'PGRST205' || error.code === '42P01') throw new AdminSetupError();
  throw error;
}

/** Clerk ids and room ids are letters, digits and underscores; nothing else is ever used in a query. */
export const isId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_]{1,120}$/.test(value);
