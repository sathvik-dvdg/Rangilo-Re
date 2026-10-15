// @ts-check
/**
 * HTTP security headers. next.config.mjs sends them on every response, and
 * middleware.ts adds any that are missing as a fallback. Plain JavaScript so
 * that next.config.mjs can import it.
 *
 * The Content-Security-Policy lists every origin the browser talks to:
 * Clerk (its Frontend API, derived from the publishable key, plus avatars,
 * telemetry and Cloudflare's bot check), Supabase (REST and Realtime), and
 * Razorpay Checkout, which is only ever loaded in Paid Mode. Next.js inlines
 * bootstrap scripts without a nonce, so scripts need 'unsafe-inline'.
 */

const HOST = /^[a-z0-9.-]+$/i;

/**
 * Clerk publishable keys are `pk_(test|live)_` + base64("<frontend api host>$").
 * @param {string | undefined} key
 * @returns {string | null}
 */
export function clerkFrontendApiHost(key) {
  const match = /^pk_(?:test|live)_([A-Za-z0-9+/=]+)$/.exec(key ?? '');
  if (!match) return null;
  try {
    const host = atob(match[1]).replace(/\$$/, '');
    return HOST.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * @param {string | undefined} url
 * @returns {string | null}
 */
function supabaseHost(url) {
  try {
    const host = new URL(url ?? '').host;
    return HOST.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ NODE_ENV?: string, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string, NEXT_PUBLIC_SUPABASE_URL?: string }} env
 */
export function contentSecurityPolicy(env) {
  const dev = env.NODE_ENV !== 'production';
  const clerkHost = clerkFrontendApiHost(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const clerk = clerkHost ? `https://${clerkHost}` : 'https://*.clerk.accounts.dev';
  const supa = supabaseHost(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabase = supa ? [`https://${supa}`, `wss://${supa}`] : ['https://*.supabase.co', 'wss://*.supabase.co'];

  /** @type {Record<string, string[]>} */
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), clerk, 'https://challenges.cloudflare.com', 'https://checkout.razorpay.com'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://img.clerk.com', 'https://*.razorpay.com'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      clerk,
      'https://clerk-telemetry.com',
      ...supabase,
      'https://api.razorpay.com',
      'https://lumberjack.razorpay.com',
      ...(dev ? ['ws:'] : []),
    ],
    'frame-src': ['https://challenges.cloudflare.com', 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
    'worker-src': ["'self'", 'blob:'],
    'media-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!dev) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/**
 * @param {{ NODE_ENV?: string, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string, NEXT_PUBLIC_SUPABASE_URL?: string }} env
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders(env) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(env) },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // Browsers ignore this over plain http, so it is harmless in development.
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  ];
}
