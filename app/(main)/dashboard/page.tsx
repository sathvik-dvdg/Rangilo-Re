import { auth } from '@clerk/nextjs/server';
import { getClerkConfigProblems } from '@/lib/clerkConfig';
import { getProfile } from '@/lib/server';
import { diagnoseDbError } from '@/lib/dbDiagnosis';
import { generateDisplayName } from '@/lib/displayNames';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { BackendProblem } from '@/components/layout/BackendProblem';
import type { PublicProfile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // The root layout shows the setup screen; don't call auth() without valid keys.
  if (getClerkConfigProblems().length > 0) return null;
  const { userId } = auth();

  let me: PublicProfile | null = null;
  try {
    me = userId ? await getProfile(userId) : null;
  } catch (e) {
    const diagnosis = diagnoseDbError(e);
    if (!diagnosis) throw e;
    console.error('[dashboard]', diagnosis.title, diagnosis.detail ?? '');
    return <BackendProblem diagnosis={diagnosis} />;
  }

  return <Dashboard me={me} suggestedName={me ? null : generateDisplayName()} />;
}
