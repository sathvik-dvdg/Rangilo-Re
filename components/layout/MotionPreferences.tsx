'use client';

import { MotionConfig } from 'framer-motion';

/** Framer Motion skips transform and layout animations for people who ask for reduced motion. */
export function MotionPreferences({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
