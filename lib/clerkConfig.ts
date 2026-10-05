/**
 * Detects missing or placeholder Clerk keys so the app can show a setup
 * screen instead of crashing on every request. Edge-safe (used by middleware).
 */

export type ClerkConfigProblem = { variable: string; reason: string };

function decodeBase64(s: string) {
  try {
    return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return '';
  }
}

/** Same shape check Clerk does: pk_(test|live)_ + base64("<frontend-api-host>$"). */
function isValidPublishableKey(key: string) {
  const m = /^pk_(test|live)_(.+)$/.exec(key);
  if (!m) return false;
  const decoded = decodeBase64(m[2]);
  return decoded.endsWith('$') && decoded.slice(0, -1).includes('.');
}

function isValidSecretKey(key: string) {
  return /^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(key);
}

export function getClerkConfigProblems(): ClerkConfigProblem[] {
  const problems: ClerkConfigProblem[] = [];
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
  const sk = process.env.CLERK_SECRET_KEY?.trim() ?? '';

  if (!pk) problems.push({ variable: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', reason: 'is not set' });
  else if (!isValidPublishableKey(pk))
    problems.push({ variable: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', reason: 'is a placeholder or not a valid Clerk publishable key' });

  if (!sk) problems.push({ variable: 'CLERK_SECRET_KEY', reason: 'is not set' });
  else if (!isValidSecretKey(sk)) problems.push({ variable: 'CLERK_SECRET_KEY', reason: 'is a placeholder or not a valid Clerk secret key' });

  return problems;
}
