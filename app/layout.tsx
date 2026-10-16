import type { Metadata, Viewport } from 'next';
// Self-hosted via Fontsource so builds don't depend on reaching Google Fonts.
import '@fontsource-variable/cinzel';
import '@fontsource-variable/nunito';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';
import { getClerkConfigProblems } from '@/lib/clerkConfig';
import { SetupNotice } from '@/components/layout/SetupNotice';
import { MotionPreferences } from '@/components/layout/MotionPreferences';
import './globals.css';

export const metadata: Metadata = {
  title: 'GarbaConnect — Find your Garba partner tonight',
  description: 'Meet dancers at your Navratri garba tonight. Chat privately and find your Garba partner.',
};

// Rendered per request so the Clerk key check reflects the runtime env, not the build env.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: '#1A1410',
  // Android Chrome shrinks the layout when the keyboard opens, so the chat composer stays visible.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const problems = getClerkConfigProblems();
  if (problems.length > 0) {
    // ClerkProvider throws on an invalid key, so render the setup screen without it.
    return (
      <html lang="en">
        <body>
          <SetupNotice problems={problems} />
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en">
        <body>
          <MotionPreferences>{children}</MotionPreferences>
          {/* Vercel Web Analytics: page views only, no cookies, served from this site's own domain
              (the CSP's 'self'). Loaded only on Vercel, where the endpoint exists. Not the
              @vercel/analytics package: its optional SvelteKit peer breaks `npm install` here. */}
          {process.env.VERCEL === '1' && <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />}
        </body>
      </html>
    </ClerkProvider>
  );
}
