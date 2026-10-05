import { Mark } from '@/components/ui/Mark';
import type { ClerkConfigProblem } from '@/lib/clerkConfig';

/** Shown instead of the app when Clerk keys are missing or still placeholders. */
export function SetupNotice({ problems }: { problems: ClerkConfigProblem[] }) {
  return (
    <main className="grain bandhani flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-lg border border-haldi/30 bg-ink-2 p-6 sm:p-8">
        <p className="flex items-center gap-2.5 font-display text-lg tracking-wide text-haldi">
          <Mark className="h-6 w-6" /> GarbaConnect
        </p>
        <h1 className="mt-6 font-display text-2xl text-paper sm:text-3xl">Clerk isn&apos;t set up yet</h1>
        <p className="mt-2 text-paper/70">The app needs real Clerk keys before it can start. Here&apos;s what&apos;s wrong:</p>

        <ul className="mt-5 space-y-2">
          {problems.map((p) => (
            <li key={p.variable} className="rounded-md border border-kumkum/40 bg-kumkum/10 px-4 py-3 text-sm text-paper">
              <code className="font-bold text-[#E8A79E]">{p.variable}</code> {p.reason}
            </li>
          ))}
        </ul>

        <ol className="mt-6 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-paper/80">
          <li>
            Copy both keys from{' '}
            <a
              href="https://dashboard.clerk.com/last-active?path=api-keys"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-haldi underline underline-offset-2"
            >
              Clerk Dashboard → API keys
            </a>
            .
          </li>
          <li>
            Put them in <code className="text-haldi">.env.local</code> in the project root. If you also have a{' '}
            <code className="text-haldi">.env</code>, values in <code className="text-haldi">.env.local</code> win, so
            remove any placeholder there.
          </li>
          <li>
            Stop the dev server and run <code className="text-haldi">npm run dev</code> again. Env files are read only at
            startup.
          </li>
        </ol>
      </div>
    </main>
  );
}
