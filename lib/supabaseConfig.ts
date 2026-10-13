/**
 * Shape checks for the Supabase env vars, so a placeholder or a wrong URL is
 * reported by name instead of surfacing as a cryptic PostgREST error.
 */

export type ConfigProblem = { variable: string; reason: string };

const PLACEHOLDER = /^(x+|xxx.*|your[-_].*|changeme|anon|svc)$/i;

function looksLikeKey(value: string, kind: 'anon' | 'service') {
  if (PLACEHOLDER.test(value)) return false;
  // Legacy JWT keys, or the newer sb_publishable_ / sb_secret_ keys.
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) return true;
  return kind === 'anon' ? value.startsWith('sb_publishable_') : value.startsWith('sb_secret_');
}

export function getSupabaseConfigProblems({ server }: { server: boolean }): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

  if (!url) {
    problems.push({ variable: 'NEXT_PUBLIC_SUPABASE_URL', reason: 'is not set' });
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      /* handled below */
    }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) {
      problems.push({ variable: 'NEXT_PUBLIC_SUPABASE_URL', reason: 'is not a URL. Use the Project URL, e.g. https://abcd1234.supabase.co' });
    } else if (/^x+\.supabase\.co$/i.test(parsed.hostname)) {
      problems.push({ variable: 'NEXT_PUBLIC_SUPABASE_URL', reason: 'is still the placeholder from .env.example' });
    } else if (parsed.hostname === 'supabase.com' || parsed.hostname.endsWith('.supabase.com')) {
      problems.push({
        variable: 'NEXT_PUBLIC_SUPABASE_URL',
        reason: 'points at the Supabase dashboard. Use the Project URL from Project Settings → API (https://<ref>.supabase.co)',
      });
    } else if (parsed.pathname.replace(/\/+$/, '') !== '') {
      problems.push({
        variable: 'NEXT_PUBLIC_SUPABASE_URL',
        reason: `has an extra path (${parsed.pathname}). Use only the origin, e.g. ${parsed.origin}, without /rest/v1`,
      });
    }
  }

  if (!anon) problems.push({ variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', reason: 'is not set' });
  else if (!looksLikeKey(anon, 'anon')) problems.push({ variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', reason: 'is a placeholder or not a Supabase anon/publishable key' });

  if (server) {
    if (!service) problems.push({ variable: 'SUPABASE_SERVICE_ROLE_KEY', reason: 'is not set' });
    else if (!looksLikeKey(service, 'service')) problems.push({ variable: 'SUPABASE_SERVICE_ROLE_KEY', reason: 'is a placeholder or not a Supabase service-role/secret key' });
    else if (service === anon) problems.push({ variable: 'SUPABASE_SERVICE_ROLE_KEY', reason: 'is the same as the anon key. Use the service_role (secret) key' });
  }

  return problems;
}
