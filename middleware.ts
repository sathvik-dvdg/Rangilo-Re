import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { getClerkConfigProblems } from '@/lib/clerkConfig';

// Clerk v5 replaces the deprecated authMiddleware with clerkMiddleware.
const isProtected = createRouteMatcher(['/dashboard(.*)', '/chat(.*)']);

const withClerk = clerkMiddleware((auth, req) => {
  if (isProtected(req)) auth().protect();
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const problems = getClerkConfigProblems();
  if (problems.length > 0) {
    // Without valid keys Clerk throws on every request. Let pages through so
    // the root layout can render the setup screen; fail API calls cleanly.
    if (req.nextUrl.pathname.startsWith('/api') || req.nextUrl.pathname.startsWith('/trpc')) {
      return NextResponse.json(
        { error: 'Clerk is not configured', problems: problems.map((p) => `${p.variable} ${p.reason}`) },
        { status: 503 },
      );
    }
    return NextResponse.next();
  }
  return withClerk(req, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
