'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const features = [
  {
    title: 'A nickname, not a name',
    body: 'Everyone gets a generated garba handle. Real names and email stay hidden from the list and the chat.',
    icon: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 18c0-3.9 3.1-7 7-7s7 3.1 7 7M3 3l18 18',
  },
  {
    title: 'Two minutes to click',
    body: 'The clock only starts once both of you have spoken and both are in the room. No ghosting a timer.',
    icon: 'M12 7v5l3 2M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
  },
  {
    title: 'Rooms for two',
    body: 'A chat room belongs to exactly one pair of dancers. Nobody else can open it, read it or join it.',
    icon: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5m0-5c.6-.1 1.3-.1 2-.1 3.3 0 6 2 6 5',
  },
  {
    title: '₹29 when it matters',
    body: 'Unlock their real name and Gmail, or add two more minutes. Paid through Razorpay, checked on our server.',
    icon: 'M6 4h12M6 9h12M6 4c5 0 7 2 7 5s-3 5-7 5l8 6',
  },
];

function Feature({ f, index }: { f: (typeof features)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const delay = index * 0.15;

  return (
    <div ref={ref} className="border-t border-ink/15 pt-6">
      <svg viewBox="0 0 24 24" className="h-9 w-9 text-kumkum" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <motion.path d={f.icon} initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}} transition={{ duration: 1.1, delay, ease: 'easeInOut' }} />
      </svg>
      <div className="mt-5 overflow-hidden">
        <motion.h3
          initial={{ y: '100%' }}
          animate={inView ? { y: 0 } : {}}
          transition={{ duration: 0.7, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-2xl font-semibold text-ink"
        >
          {f.title}
        </motion.h3>
      </div>
      <div className="mt-2 overflow-hidden">
        <motion.p
          initial={{ y: '100%' }}
          animate={inView ? { y: 0 } : {}}
          transition={{ duration: 0.7, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="leading-relaxed text-ink/70"
        >
          {f.body}
        </motion.p>
      </div>
    </div>
  );
}

export function FeaturesReveal() {
  return (
    <section className="grain bg-paper py-24 text-ink md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-kumkum">Built for the garba ground</p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight md:text-5xl">
              Shy is fine.
              <br />
              <span className="italic text-kumkum">Fast is better.</span>
            </h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-2">
            {features.map((f, i) => (
              <Feature key={f.title} f={f} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
