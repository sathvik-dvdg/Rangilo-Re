import { Code, ProblemScreen } from './ProblemScreen';
import type { ClerkConfigProblem } from '@/lib/clerkConfig';

/** Shown instead of the app when Clerk keys are missing or still placeholders. */
export function SetupNotice({ problems }: { problems: ClerkConfigProblem[] }) {
  return (
    <ProblemScreen
      title="Clerk isn't set up yet"
      intro="The app needs real Clerk keys before it can start. Here's what's wrong:"
      problems={problems}
      steps={[
        <>
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
        </>,
        <>
          Put them in <Code>.env.local</Code> in the project root. If you also have a <Code>.env</Code>, values in{' '}
          <Code>.env.local</Code> win, so remove any placeholder there.
        </>,
        <>
          Stop the dev server and run <Code>npm run dev</Code> again. Env files are read only at startup.
        </>,
      ]}
    />
  );
}
