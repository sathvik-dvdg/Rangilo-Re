'use client';

import { useEffect } from 'react';

export function useLenis(enabled = true) {
  useEffect(() => {
    // Smooth scrolling is motion too; keep native scrolling for reduced-motion users.
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    // Loaded on demand: this hook sits in the shared layout, and only the landing page scrolls smoothly.
    void Promise.all([import('lenis'), import('gsap'), import('gsap/ScrollTrigger')]).then(([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({ lerp: 0.08, duration: 1.4 });
      lenis.on('scroll', ScrollTrigger.update);

      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enabled]);
}
