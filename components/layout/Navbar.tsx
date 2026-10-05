'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Mark } from '@/components/ui/Mark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  // The chat screen has its own header.
  if (pathname.startsWith('/chat')) return null;

  return (
    <motion.header
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="fixed inset-x-0 top-0 z-50 bg-ink stitch-b"
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark className="h-7 w-7" />
          <span className="font-display text-lg font-semibold tracking-[0.06em] text-haldi">GarbaConnect</span>
        </Link>
        <div className="flex items-center gap-3">
          <SignedIn>
            {pathname !== '/dashboard' && (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                Dancers
              </Link>
            )}
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden sm:inline-flex')}>
              Sign in
            </Link>
            <Link href="/sign-up" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
              Join Navratri
            </Link>
          </SignedOut>
        </div>
      </nav>
    </motion.header>
  );
}
