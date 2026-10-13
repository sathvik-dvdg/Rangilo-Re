import 'server-only';

/**
 * Billing mode (OBJECTIVES.md CFG-001..003). Free unless BILLING_MODE is
 * "paid" AND every Razorpay setting passes the readiness check. Credentials
 * on their own never turn payments on. This is the only module that reads
 * BILLING_MODE; diagnostics name variables, never their values.
 */

export type BillingMode = 'free' | 'paid';
export type BillingProblem = { variable: string; reason: string };
export type BillingStatus = {
  /** What the server actually does. */
  mode: BillingMode;
  /** What BILLING_MODE asked for. */
  requested: BillingMode;
  problems: BillingProblem[];
};

type Env = Record<string, string | undefined>;

const KEY_ID = /^rzp_(test|live)_([A-Za-z0-9]{8,})$/;
const MIN_SECRET_LENGTH = 16;
const isPlaceholder = (s: string) => /^x+$/i.test(s);

export function resolveRequestedMode(raw: string | undefined): { requested: BillingMode; problem?: BillingProblem } {
  const value = raw?.trim().toLowerCase() ?? '';
  if (value === '' || value === 'free') return { requested: 'free' };
  if (value === 'paid') return { requested: 'paid' };
  return { requested: 'free', problem: { variable: 'BILLING_MODE', reason: 'is not "free" or "paid"; billing stays off' } };
}

export function checkPaidReadiness(env: Env): BillingProblem[] {
  const problems: BillingProblem[] = [];
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? '';
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? '';
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '';
  const publicKeyId = env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ?? '';

  const m = KEY_ID.exec(keyId);
  if (!keyId) problems.push({ variable: 'RAZORPAY_KEY_ID', reason: 'is not set' });
  else if (!m || isPlaceholder(m[2])) problems.push({ variable: 'RAZORPAY_KEY_ID', reason: 'is a placeholder or not a valid Razorpay key id' });
  else if (m[1] === 'live' && env.NODE_ENV !== 'production')
    problems.push({ variable: 'RAZORPAY_KEY_ID', reason: 'is a live key outside a production build' });

  for (const [variable, value] of [
    ['RAZORPAY_KEY_SECRET', keySecret],
    ['RAZORPAY_WEBHOOK_SECRET', webhookSecret],
  ] as const) {
    if (!value) problems.push({ variable, reason: 'is not set' });
    else if (isPlaceholder(value) || value.length < MIN_SECRET_LENGTH)
      problems.push({ variable, reason: `is a placeholder or shorter than ${MIN_SECRET_LENGTH} characters` });
  }

  if (!publicKeyId) problems.push({ variable: 'NEXT_PUBLIC_RAZORPAY_KEY_ID', reason: 'is not set' });
  else if (publicKeyId !== keyId) problems.push({ variable: 'NEXT_PUBLIC_RAZORPAY_KEY_ID', reason: 'does not match RAZORPAY_KEY_ID' });

  return problems;
}

const logged = new Set<string>();

/** Logs each distinct configuration problem once per server process. */
function report(problems: BillingProblem[]) {
  for (const p of problems) {
    const line = `[billing] ${p.variable} ${p.reason}`;
    if (logged.has(line)) continue;
    logged.add(line);
    console.error(line);
  }
}

/** Test hook: forget which problems have already been logged. */
export function resetBillingDiagnostics() {
  logged.clear();
}

export function getBillingStatus(env: Env = process.env): BillingStatus {
  const { requested, problem } = resolveRequestedMode(env.BILLING_MODE);
  if (requested === 'free') {
    const problems = problem ? [problem] : [];
    report(problems);
    return { mode: 'free', requested, problems };
  }
  const problems = checkPaidReadiness(env);
  report(problems);
  return { mode: problems.length === 0 ? 'paid' : 'free', requested, problems };
}

/**
 * For billing endpoints: null when payments are on, otherwise the response
 * to send. 403 when billing is deliberately off, 503 when Paid Mode was
 * requested but is misconfigured.
 */
export function billingDisabledResponse(status: BillingStatus = getBillingStatus()): Response | null {
  if (status.mode === 'paid') return null;
  return status.requested === 'paid'
    ? Response.json({ error: 'billing_unavailable' }, { status: 503 })
    : Response.json({ error: 'billing_disabled' }, { status: 403 });
}
