import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isMissingSchema } from '@/lib/consent';
import { HttpError, errorResponse, requireUserId } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import { ClerkUserId, parseBody } from '@/lib/validation';

// Matches the reports.reason check constraint (at most 500 characters).
const ReportBody = z.object({ reportedUserId: ClerkUserId, reason: z.string().trim().max(500) });

/**
 * Files a report about another dancer (SAFE-002). Reports land in the database
 * for the team to review; the reported dancer is not told. The reason is never
 * logged (PRIV-003).
 */
export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    enforceRateLimit('report', userId);
    const { reportedUserId, reason } = await parseBody(req, ReportBody, 'Invalid report');
    if (reportedUserId === userId) throw new HttpError(400, 'You cannot report yourself');

    const { error } = await supabaseAdmin().from('reports').insert({ reporter_id: userId, reported_id: reportedUserId, reason });
    // 23503: one of the two has no users row (the dancer left, or the caller has not onboarded).
    if (error?.code === '23503') throw new HttpError(404, 'That dancer has left');
    if (isMissingSchema(error)) throw new HttpError(503, 'Reporting is not available yet');
    if (error) throw error;
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
