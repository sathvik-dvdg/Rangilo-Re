import type { Metadata, Viewport } from 'next';
// Self-hosted via Fontsource so builds don't depend on reaching Google Fonts.
import '@fontsource-variable/cinzel';
import '@fontsource-variable/nunito';
import { ClerkProvider } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';
import './globals.css';

export const metadata: Metadata = {
  title: 'GarbaConnect — Find your Garba partner tonight',
  description: 'Meet other dancers at your Navratri garba, chat privately for two minutes, and keep the rhythm going.',
};

export const viewport: Viewport = {
  themeColor: '#1A1410',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
