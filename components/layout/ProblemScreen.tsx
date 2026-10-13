import { Mark } from '@/components/ui/Mark';
import type { ConfigProblem } from '@/lib/supabaseConfig';

/** Full-page explanation of a setup problem, with the exact variables and steps to fix it. */
export function ProblemScreen({
  title,
  intro,
  problems,
  steps,
  detail,
}: {
  title: string;
  intro: string;
  problems: ConfigProblem[];
  steps: React.ReactNode[];
  detail?: string;
}) {
  return (
    <main className="grain bandhani flex min-h-screen items-center justify-center px-4 py-24">
      <div className="w-full max-w-xl rounded-lg border border-haldi/30 bg-ink-2 p-6 sm:p-8">
        <p className="flex items-center gap-2.5 font-display text-lg tracking-wide text-haldi">
          <Mark className="h-6 w-6" /> GarbaConnect
        </p>
        <h1 className="mt-6 font-display text-2xl text-paper sm:text-3xl">{title}</h1>
        <p className="mt-2 text-paper/70">{intro}</p>

        {problems.length > 0 && (
          <ul className="mt-5 space-y-2">
            {problems.map((p) => (
              <li key={p.variable} className="rounded-md border border-kumkum/40 bg-kumkum/10 px-4 py-3 text-sm text-paper">
                <code className="font-bold text-[#E8A79E]">{p.variable}</code> {p.reason}
              </li>
            ))}
          </ul>
        )}

        <ol className="mt-6 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-paper/80">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>

        {detail && (
          <p className="mt-6 rounded-md bg-ink px-3 py-2 font-mono text-xs text-paper/50">
            Error: {detail}
          </p>
        )}
      </div>
    </main>
  );
}

export const Code = ({ children }: { children: React.ReactNode }) => <code className="text-haldi">{children}</code>;
