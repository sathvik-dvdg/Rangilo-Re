import { auth } from '@clerk/nextjs/server';
import { getProfile } from '@/lib/server';
import { generateDisplayName } from '@/lib/displayNames';
import { Dashboard } from '@/components/dashboard/Dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { userId } = auth();
  const me = userId ? await getProfile(userId) : null;
  return <Dashboard me={me} suggestedName={me ? null : generateDisplayName()} />;
}
