import { auth } from '@clerk/nextjs/server';
import { getClerkConfigProblems } from '@/lib/clerkConfig';
import { getProfile } from '@/lib/server';
import { generateDisplayName } from '@/lib/displayNames';
import { Dashboard } from '@/components/dashboard/Dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // The root layout shows the setup screen; don't call auth() without valid keys.
  if (getClerkConfigProblems().length > 0) return null;
  const { userId } = auth();
  const me = userId ? await getProfile(userId) : null;
  return <Dashboard me={me} suggestedName={me ? null : generateDisplayName()} />;
}
