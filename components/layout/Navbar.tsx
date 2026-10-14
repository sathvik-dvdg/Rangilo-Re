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
  if (pathname?.startsWith('/chat')) return null;

  return (
    <motion.header
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="fixed inset-x-0 top-0 z-50 bg-ink stitch-b"
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex h-11 min-w-0 items-center gap-2 min-[360px]:gap-2.5">
          <Mark className="h-7 w-7" />
          <span className="font-display text-base font-semibold tracking-[0.03em] text-haldi min-[360px]:text-lg min-[360px]:tracking-[0.06em]">GarbaConnect</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <SignedIn>
            {pathname !== '/dashboard' && (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-11 sm:h-9')}>
                Dancers
              </Link>
            )}
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden h-9 sm:inline-flex')}>
              Sign in
            </Link>
            <Link href="/sign-up" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'h-11 sm:h-9')}>
              Join Navratri
            </Link>
          </SignedOut>
        </div>
      </nav>
    </motion.header>
  );
}
