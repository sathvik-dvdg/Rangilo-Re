'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';

const quotes = [
  { name: 'RaasQueen_Meera_2210', city: 'Ahmedabad', text: 'Found someone who actually knew the do-taali steps. Two minutes was exactly enough to say “meet by the dhol”.' },
  { name: 'DholKing_Karan_8812', city: 'Vadodara', text: 'I am terrible at walking up to people. Typing “nice chaniya” under a nickname is much easier.' },
  { name: 'DiyaStar_Isha_4471', city: 'Mumbai', text: 'Paid the ₹29 on night three. We are still dancing together on night nine.' },
  { name: 'Dandiya_Rohan_3390', city: 'Surat', text: 'The timer is the best part. No endless “hi”, “hello”, “wyd”. You just get to the point.' },
  { name: 'GhoomarSpark_Tara_6625', city: 'Rajkot', text: 'Loved that nobody could see my real name until I was comfortable. Felt safe, felt fun.' },
  { name: 'KesarDancer_Parth_1907', city: 'Pune', text: 'Our society garba had 400 people. This is how I found the only other person who wanted to do dandiya fast.' },
];

export function Testimonials() {
  const viewport = useRef<HTMLDivElement>(null);
  const loop = [...quotes, ...quotes];

  return (
    <section className="grain overflow-hidden bg-ink-2 py-24">
      <div className="mx-auto mb-12 max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-haldi">From the circle</p>
        <h2 className="mt-4 font-display text-4xl font-semibold text-paper md:text-5xl">Said between rounds</h2>
      </div>

      <div ref={viewport} className="overflow-hidden">
        <motion.div drag="x" dragConstraints={viewport} dragElastic={0.15} className="cursor-grab active:cursor-grabbing">
          {/* The CSS marquee gives the infinite loop; drag nudges it. Hover pauses. */}
          <div className="flex w-max animate-marquee gap-6 px-4 hover:[animation-play-state:paused]">
            {loop.map((q, i) => (
              <figure key={i} className="w-[300px] shrink-0 select-none rounded-lg stitch bg-ink p-6 sm:w-[360px]">
                <blockquote className="text-[15px] leading-relaxed text-paper/85">“{q.text}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <Avatar name={q.name} size={36} />
                  <div>
                    <p className="font-display text-sm text-paper">{q.name}</p>
                    <p className="text-xs text-paper/50">{q.city}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
