'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While `active`, moves focus into `ref` (give it tabIndex={-1}), keeps Tab
 * and Shift+Tab inside it, and returns focus to whatever opened it on close.
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      const node = ref.current;
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      const current = document.activeElement;
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
      } else if (!node.contains(current)) {
        e.preventDefault();
        items[0].focus();
      } else if (e.shiftKey && (current === items[0] || current === node)) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && current === items[items.length - 1]) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active, ref]);
}
