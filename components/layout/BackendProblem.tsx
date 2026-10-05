import { Code, ProblemScreen } from './ProblemScreen';
import type { Diagnosis } from '@/lib/dbDiagnosis';

export function BackendProblem({ diagnosis }: { diagnosis: Diagnosis }) {
  return (
    <ProblemScreen
      title={diagnosis.title}
      intro="You're signed in, but the dancer list and chat need the database. Here's what's wrong:"
      problems={diagnosis.problems}
      steps={[
        diagnosis.hint,
        <>
          After editing <Code>.env.local</Code>, stop the dev server and run <Code>npm run dev</Code> again.
        </>,
      ]}
      detail={diagnosis.detail}
    />
  );
}
