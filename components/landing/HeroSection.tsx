'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { SignedOut } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MandalaScene = dynamic(() => import('@/components/3d/MandalaScene'), { ssr: false });

const lines = [['Find', 'Your'], ['Garba', 'Partner'], ['Tonight']];
const ease = [0.22, 1, 0.36, 1] as const;

export function HeroSection() {
  let i = 0;
  return (
    <section className="grain relative overflow-hidden bg-ink pt-16">
      {/* A slow warm glow, like a lamp behind a jaali — not a rainbow mesh. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 55% at 70% 45%, rgba(178,58,46,0.28), transparent 70%)' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto grid max-w-6xl md:min-h-[calc(100vh-4rem)] md:grid-cols-[1.05fr_1fr] md:items-center">
        <div className="relative order-2 px-4 pb-14 pt-4 sm:px-6 sm:pb-16 sm:pt-6 md:order-1 md:py-24">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-haldi"
          >
            <span className="h-px w-8 bg-haldi" /> Navratri · 9 nights
          </motion.p>

          <motion.h1 style={{ perspective: 1000 }} className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-paper sm:text-6xl lg:text-7xl">
            {lines.map((words, li) => (
              <span key={li} className="block overflow-hidden pb-1">
                {words.map((w) => {
                  const index = i++;
                  return (
                    <motion.span
                      key={w}
                      className={cn('mr-[0.25em] inline-block', li === 2 && 'italic text-kumkum')}
                      initial={{ opacity: 0, y: 60, rotateX: -30 }}
                      animate={{ opacity: 1, y: 0, rotateX: 0 }}
                      transition={{ duration: 0.7, delay: index * 0.12, ease }}
                    >
                      {w}
                    </motion.span>
                  );
                })}
              </span>
            ))}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.6, ease }}
            className="mt-5 max-w-md space-y-3 text-base leading-relaxed text-paper/80 sm:mt-6 sm:text-lg"
          >
            <p className="font-medium text-paper">
              Find a Garba partner at tonight&apos;s event — no waiting, no awkward circles.
            </p>
            <p className="text-sm leading-relaxed text-paper/70 sm:text-base">
              Join, browse who is dancing tonight, and start a private chat. Made for Navratri nights.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6, ease }}
            className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 sm:mt-9"
          >
            <Link href="/sign-up" className={buttonVariants({ size: 'lg' })}>
              Join Navratri
            </Link>
            <Link href="#how" className="inline-flex h-11 items-center text-sm font-semibold text-paper/75 underline decoration-haldi/60 underline-offset-4 hover:text-paper">
              How it works
            </Link>
            {/* The navbar has no room for Sign in on phones; returning dancers get it here. */}
            <SignedOut>
              <Link href="/sign-in" className="inline-flex h-11 items-center text-sm font-semibold text-paper/75 underline decoration-haldi/60 underline-offset-4 hover:text-paper sm:hidden">
                Sign in
              </Link>
            </SignedOut>
          </motion.div>
        </div>

        <div className="relative order-1 h-[30vh] min-h-[190px] max-h-[340px] md:order-2 md:h-[80vh] md:max-h-none">
          <MandalaScene />
        </div>
      </div>
    </section>
  );
}
