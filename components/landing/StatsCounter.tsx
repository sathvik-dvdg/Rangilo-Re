'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const stats = [
  { value: 5000, prefix: '', suffix: '+', label: 'Dancers' },
  { value: 200, prefix: '', suffix: '+', label: 'Events' },
  { value: 29, prefix: '₹', suffix: '', label: 'Unlock' },
];

export function StatsCounter() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      root.current!.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count);
        const obj = { v: 0 };
        ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          once: true,
          onEnter: () =>
            gsap.to(obj, {
              v: target,
              duration: 2,
              ease: 'power2.out',
              onUpdate: () => {
                el.textContent = Math.round(obj.v).toLocaleString('en-IN');
              },
            }),
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="bandhani bg-kumkum py-20 text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-3 sm:px-6">
        {stats.map((s) => (
          <div key={s.label} className="border-l-2 border-paper/40 pl-6">
            <p className="tabular font-display text-6xl font-semibold md:text-7xl">
              {s.prefix}
              <span data-count={s.value}>0</span>
              {s.suffix}
            </p>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.2em] text-paper/80">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
