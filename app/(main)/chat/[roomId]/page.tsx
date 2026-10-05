import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getClerkConfigProblems } from '@/lib/clerkConfig';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { HttpError, getRoomState } from '@/lib/server';
import { buttonVariants } from '@/components/ui/button';
import { Diya } from '@/components/chat/TimerExpiredOverlay';
import { diagnoseDbError } from '@/lib/dbDiagnosis';
import { BackendProblem } from '@/components/layout/BackendProblem';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: { roomId: string } }) {
  // The root layout shows the setup screen; don't call auth() without valid keys.
  if (getClerkConfigProblems().length > 0) return null;
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  try {
    const state = await getRoomState(decodeURIComponent(params.roomId), userId);
    return <ChatRoom key={state.roomId} initial={state} />;
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) redirect('/dashboard');
    if (!(e instanceof HttpError)) {
      const diagnosis = diagnoseDbError(e);
      if (diagnosis) {
        console.error('[chat]', diagnosis.title, diagnosis.detail ?? '');
        return <BackendProblem diagnosis={diagnosis} />;
      }
      console.error('[chat]', e);
    }
    const message = e instanceof HttpError ? e.message : 'Could not open this chat';
    return (
      <main className="grain bandhani flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Diya className="h-14 w-14 opacity-70" />
        <h1 className="font-display text-3xl text-paper">{message}</h1>
        <p className="max-w-sm text-paper/60">
          {message === 'Room is full'
            ? 'Every GarbaConnect room is for exactly two dancers, and this one already has its pair.'
            : 'Head back and pick another dancer.'}
        </p>
        <Link href="/dashboard" className={buttonVariants({ variant: 'outline', className: 'mt-4' })}>
          Back to dancers
        </Link>
      </main>
    );
  }
}
