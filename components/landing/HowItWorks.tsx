'use client';

import { useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const cards = [
  {
    n: '01',
    title: 'Join the Night',
    body: 'Sign up and we hand you a garba nickname — DiyaDancer_Avni_4821, say. That is all anyone sees.',
    tone: 'bg-kumkum text-paper',
  },
  {
    n: '02',
    title: 'Find a Partner',
    body: 'Browse who is dancing tonight. Filter by gender or by who is online right now.',
    tone: 'bg-haldi text-ink',
  },
  {
    n: '03',
    title: 'Connect Privately',
    body: 'Open a room for exactly two. Once you both say hi, a two-minute clock starts. Make it count.',
    tone: 'bg-neel text-paper',
  },
];

export function HowItWorks() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    // Horizontal pinned scroll on desktop; plain stacked cards on mobile.
    mm.add('(min-width: 768px)', () => {
      const el = track.current!;
      const distance = () => el.scrollWidth - window.innerWidth + 48;
      gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="how" ref={section} className="relative overflow-hidden bg-ink py-20 md:flex md:h-screen md:items-center md:pb-0 md:pt-16">
      <div ref={track} className="flex flex-col gap-6 px-4 sm:px-6 md:flex-row md:gap-10 md:pl-[8vw] md:pr-[8vw]">
        <div className="shrink-0 md:w-[30vw] md:self-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-haldi">How it works</p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-paper md:text-5xl">
            Three steps,
            <br />
            one circle.
          </h2>
          <p className="mt-4 max-w-xs text-paper/65">Garba moves in a circle. So does this — join, find, connect, and back to the floor.</p>
        </div>

        {cards.map((c) => (
          <div key={c.n} style={{ perspective: 1000 }} className="shrink-0">
            <motion.article
              whileHover={{ rotateY: 12, rotateX: -4 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              data-cursor="hover"
              className={`grain flex h-[360px] w-full flex-col justify-between rounded-lg p-8 md:h-[62vh] md:w-[30vw] md:max-w-[420px] ${c.tone}`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <span className="font-display text-7xl font-semibold opacity-30">{c.n}</span>
              <div style={{ transform: 'translateZ(30px)' }}>
                <h3 className="font-display text-3xl font-semibold">{c.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed opacity-85">{c.body}</p>
              </div>
            </motion.article>
          </div>
        ))}
      </div>
    </section>
  );
}
