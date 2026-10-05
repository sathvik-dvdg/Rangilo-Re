import 'server-only';
import { getSupabaseConfigProblems, type ConfigProblem } from './supabaseConfig';

export type Diagnosis = { title: string; problems: ConfigProblem[]; hint: string; detail?: string };

export class SupabaseConfigError extends Error {
  constructor(public problems: ConfigProblem[]) {
    super('Supabase is not configured: ' + problems.map((p) => `${p.variable} ${p.reason}`).join('; '));
  }
}

/** Turns a Supabase/PostgREST failure into something a person can act on. */
export function diagnoseDbError(e: unknown): Diagnosis | null {
  const config = getSupabaseConfigProblems({ server: true });
  if (e instanceof SupabaseConfigError || config.length > 0) {
    return {
      title: "Supabase isn't set up yet",
      problems: e instanceof SupabaseConfigError ? e.problems : config,
      hint: 'Copy the Project URL and API keys from Supabase → Project Settings → API into .env.local, then restart npm run dev.',
    };
  }

  const err = e as { message?: string; code?: string; details?: string; hint?: string } | null;
  const message = String(err?.message ?? '').trim();
  const code = String(err?.code ?? '');
  if (!message && !code) return null;

  if (/404 page not found/i.test(message)) {
    return {
      title: 'Supabase URL is wrong',
      problems: [{ variable: 'NEXT_PUBLIC_SUPABASE_URL', reason: 'reaches a server, but it answers "404 page not found" for the REST API' }],
      hint: 'Use the Project URL from Supabase → Project Settings → API (https://<ref>.supabase.co), with nothing after .co, then restart the dev server.',
      detail: message,
    };
  }
  if (code === 'PGRST205' || code === '42P01' || /could not find the table|relation .* does not exist/i.test(message)) {
    return {
      title: 'Database tables are missing',
      problems: [],
      hint: 'Open Supabase → SQL Editor, paste supabase/migrations/0001_init.sql and run it.',
      detail: message,
    };
  }
  if (/invalid api key|jwt|no api key/i.test(message) || code === 'PGRST301') {
    return {
      title: 'Supabase rejected the API key',
      problems: [{ variable: 'SUPABASE_SERVICE_ROLE_KEY', reason: 'was not accepted by this project' }],
      hint: 'Make sure the keys come from the same project as the URL, and that SUPABASE_SERVICE_ROLE_KEY is the service_role (secret) key.',
      detail: message,
    };
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(message)) {
    return {
      title: "Can't reach Supabase",
      problems: [{ variable: 'NEXT_PUBLIC_SUPABASE_URL', reason: 'could not be reached' }],
      hint: 'Check the Project URL for typos and that the project is not paused in the Supabase dashboard.',
      detail: message,
    };
  }
  // Only PostgREST-shaped errors from here on; anything else isn't a database problem.
  if (err && typeof err === 'object' && 'details' in err && 'hint' in err) {
    return { title: 'The database returned an error', problems: [], hint: 'Check the terminal running npm run dev for details.', detail: message };
  }
  return null;
}
