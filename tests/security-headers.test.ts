// HTTP security headers (lib/securityHeaders.mjs, used by next.config.mjs and middleware.ts)
// and the middleware's request checks (lib/requestGuards.ts). Unit level: no server runs,
// so this does not show that a browser loads the app under this policy.
import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';
import { clerkFrontendApiHost, contentSecurityPolicy, securityHeaders } from '@/lib/securityHeaders.mjs';
import { isSuspiciousUserAgent, isUserAgentExempt, needsHttpsRedirect } from '@/lib/requestGuards';

const pk = (host: string) => `pk_live_${Buffer.from(`${host}$`).toString('base64')}`;
const PROD = { NODE_ENV: 'production', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk('clerk.garbaconnect.example'), NEXT_PUBLIC_SUPABASE_URL: 'https://abcd1234.supabase.co' };
const directive = (policy: string, name: string) => policy.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('security headers', () => {
  it('sends the six required headers with the required values', () => {
    const headers = Object.fromEntries(securityHeaders(PROD).map((h) => [h.key, h.value]));
    expect(headers).toMatchObject({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    });
    expect(headers['Content-Security-Policy']).toBe(contentSecurityPolicy(PROD));
  });

  it('next.config.mjs applies them to every path', async () => {
    // A path in a variable: the config is untyped JavaScript, so it is imported as such.
    const configPath = '../next.config.mjs';
    const nextConfig = (await import(/* @vite-ignore */ configPath)).default as NextConfig;
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe('/:path*');
    expect(rules[0].headers.map((h) => h.key)).toEqual(securityHeaders(PROD).map((h) => h.key));
  });
});

describe('Content-Security-Policy', () => {
  const csp = contentSecurityPolicy(PROD);

  it('allows this deployment’s Clerk, Supabase (REST and Realtime) and Razorpay Checkout', () => {
    expect(directive(csp, 'script-src')).toContain('https://clerk.garbaconnect.example');
    expect(directive(csp, 'script-src')).toContain('https://checkout.razorpay.com');
    expect(directive(csp, 'connect-src')).toContain('https://clerk.garbaconnect.example');
    expect(directive(csp, 'connect-src')).toContain('https://abcd1234.supabase.co');
    expect(directive(csp, 'connect-src')).toContain('wss://abcd1234.supabase.co');
    expect(directive(csp, 'frame-src')).toContain('https://api.razorpay.com');
    expect(directive(csp, 'img-src')).toContain('https://img.clerk.com');
  });

  it('forbids framing, plugins and foreign base URLs, and upgrades http in production', () => {
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it("allows eval and the dev-server websocket only in development", () => {
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-eval'");
    const dev = contentSecurityPolicy({ ...PROD, NODE_ENV: 'development' });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toContain('ws:');
    expect(dev).not.toContain('upgrade-insecure-requests');
  });

  it('falls back to the providers’ wildcard hosts when the public config is missing', () => {
    const bare = contentSecurityPolicy({ NODE_ENV: 'production' });
    expect(directive(bare, 'connect-src')).toContain('https://*.clerk.accounts.dev');
    expect(directive(bare, 'connect-src')).toContain('wss://*.supabase.co');
  });

  it('never copies anything but a plain host name out of the environment into the header', () => {
    expect(clerkFrontendApiHost(pk('evil.example; script-src *'))).toBeNull();
    expect(clerkFrontendApiHost('not-a-key')).toBeNull();
    expect(clerkFrontendApiHost(pk('clever-cat-12.clerk.accounts.dev'))).toBe('clever-cat-12.clerk.accounts.dev');
    const csp = contentSecurityPolicy({ NODE_ENV: 'production', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk('evil.example; script-src *') });
    expect(csp).not.toContain('evil.example');
  });
});

describe('middleware request checks', () => {
  it.each([null, '', '   ', 'sqlmap/1.7.2#stable', 'Mozilla/5.0 (compatible; Nmap Scripting Engine)', 'Nuclei - Open-source project', 'Nikto/2.5.0', 'WPScan v3.8'])(
    'blocks the user agent %j',
    (ua) => expect(isSuspiciousUserAgent(ua)).toBe(true),
  );

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
    'curl/8.4.0',
    'Razorpay-Webhook/v1',
  ])('lets %s through', (ua) => expect(isSuspiciousUserAgent(ua)).toBe(false));

  it('never applies the user-agent check to payment webhooks', () => {
    expect(isUserAgentExempt('/api/webhooks/razorpay')).toBe(true);
    expect(isUserAgentExempt('/api/rooms/x/messages')).toBe(false);
  });

  it('redirects to https only in production, only when the proxy reports http, and never for local hosts', () => {
    expect(needsHttpsRedirect('production', 'http', 'garbaconnect.example')).toBe(true);
    expect(needsHttpsRedirect('production', 'http, https', 'garbaconnect.example')).toBe(true);
    expect(needsHttpsRedirect('production', 'https', 'garbaconnect.example')).toBe(false);
    expect(needsHttpsRedirect('production', null, 'garbaconnect.example')).toBe(false);
    expect(needsHttpsRedirect('development', 'http', 'garbaconnect.example')).toBe(false);
    for (const host of ['localhost', '127.0.0.1', '192.168.1.20']) expect(needsHttpsRedirect('production', 'http', host)).toBe(false);
  });
});
