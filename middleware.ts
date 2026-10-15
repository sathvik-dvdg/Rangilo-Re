import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { getClerkConfigProblems } from '@/lib/clerkConfig';
import { isSuspiciousUserAgent, isUserAgentExempt, needsHttpsRedirect } from '@/lib/requestGuards';
import { securityHeaders } from '@/lib/securityHeaders.mjs';

// Clerk v5 replaces the deprecated authMiddleware with clerkMiddleware.
// /admin needs a session here; whether that session is an admin is decided by requireAdmin() on the server.
const isProtected = createRouteMatcher(['/dashboard(.*)', '/chat(.*)', '/admin(.*)']);

const withClerk = clerkMiddleware((auth, req) => {
  if (isProtected(req)) auth().protect();
});

// next.config.mjs sends these on every response; this adds any a middleware response would lack.
const SECURITY_HEADERS = securityHeaders({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

function withSecurityHeaders(res: Response) {
  try {
    for (const { key, value } of SECURITY_HEADERS) if (!res.headers.has(key)) res.headers.set(key, value);
  } catch {
    // Response.redirect() headers are immutable; next.config.mjs still covers that response.
  }
  return res;
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!isUserAgentExempt(req.nextUrl.pathname) && isSuspiciousUserAgent(req.headers.get('user-agent'))) {
    return withSecurityHeaders(new NextResponse('Forbidden', { status: 403 }));
  }
  if (needsHttpsRedirect(process.env.NODE_ENV, req.headers.get('x-forwarded-proto'), req.nextUrl.hostname)) {
    const url = req.nextUrl.clone();
    url.protocol = 'https:';
    url.port = '';
    return withSecurityHeaders(NextResponse.redirect(url, 308));
  }

  const problems = getClerkConfigProblems();
  if (problems.length > 0) {
    // Without valid keys Clerk throws on every request. Let pages through so
    // the root layout can render the setup screen; fail API calls cleanly.
    if (req.nextUrl.pathname.startsWith('/api') || req.nextUrl.pathname.startsWith('/trpc')) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Clerk is not configured', problems: problems.map((p) => `${p.variable} ${p.reason}`) }, { status: 503 }),
      );
    }
    return withSecurityHeaders(NextResponse.next());
  }
  return withSecurityHeaders((await withClerk(req, event)) ?? NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
