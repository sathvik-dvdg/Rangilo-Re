'use client';

import { usePathname } from 'next/navigation';
import { useLenis } from '@/hooks/useLenis';

/** Lenis only on the landing page; app screens have their own scroll areas. */
export function SmoothScroll() {
  useLenis(usePathname() === '/');
  return null;
}
